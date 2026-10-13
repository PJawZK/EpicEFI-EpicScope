import type { NumericChannelRange } from '../../../../core/log-model/log-types';
import { distributionValueInsideGeometry, resolveFixedDistributionGeometry } from '../../../../core/analysis/distribution-geometry';
import type { HistogramPageContext, HistogramTraceContext } from './histogram-page';
import type { SavedTimelineRangeState } from '../state/workspace-state';
import { createHistogramLocalId } from '../state/histogram-table-storage';
import { loadHistogramDistributionPresets, saveHistogramDistributionPresets, type HistogramDistributionPresetState } from '../state/histogram-distribution-storage';
import { buildDistributionCsv, distributionCsvFilename } from './histogram-distribution-csv';
import {
  histogramQualificationChannelIds,
  loadHistogramQualificationSets,
  populateHistogramQualificationSelect,
  qualifyHistogramSamples,
  selectedHistogramQualification,
  type HistogramQualificationState,
} from './histogram-qualification';

type DistributionMetric = 'count' | 'percent' | 'time';
type DistributionBinMode = 'auto' | 'manual' | 'fixed';
type DistributionDisplay = 'histogram' | 'cumulative';

interface DistributionStats {
  readonly count: number;
  readonly min: number | undefined;
  readonly max: number | undefined;
  readonly mean: number | undefined;
  readonly median: number | undefined;
  readonly standardDeviation: number | undefined;
  readonly p05: number | undefined;
  readonly p25: number | undefined;
  readonly p75: number | undefined;
  readonly p95: number | undefined;
}

interface DistributionSeries {
  readonly label: string;
  readonly trace: HistogramTraceContext;
  readonly localIndices: readonly number[];
  readonly stats: DistributionStats;
  readonly binValues: readonly number[];
  readonly color: string;
  readonly qualification: HistogramQualificationState;
  readonly outsideGeometrySampleCount: number;
}

interface SelectedBin {
  readonly index: number;
  readonly lower: number;
  readonly upper: number;
  readonly includesUpper: boolean;
}

interface ResolvedScope {
  readonly label: string;
  readonly startMs?: number;
  readonly endMs?: number;
}

export interface HistogramDistributionViewController {
  readonly element: HTMLElement;
  setContext(context: HistogramPageContext): void;
  refresh(): void;
}

function channelLabel(trace: HistogramTraceContext): string {
  return trace.channel.displayName || trace.channel.sourceName;
}

function formatNumber(value: number | undefined, precision = 3): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  return value.toFixed(precision).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function percentile(sorted: readonly number[], ratio: number): number | undefined {
  if (sorted.length === 0) return undefined;
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * Math.max(0, Math.min(1, ratio));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const a = sorted[lower];
  const b = sorted[upper];
  if (a === undefined || b === undefined) return undefined;
  return a + (b - a) * (position - lower);
}

function statsFor(range: NumericChannelRange, localIndices: readonly number[]): DistributionStats {
  const values: number[] = [];
  let sum = 0;
  for (const localIndex of localIndices) {
    const value = range.values[localIndex];
    if (range.validity[localIndex] !== 1 || value === undefined || !Number.isFinite(value)) continue;
    values.push(value);
    sum += value;
  }
  values.sort((a, b) => a - b);
  if (values.length === 0) {
    return { count: 0, min: undefined, max: undefined, mean: undefined, median: undefined, standardDeviation: undefined, p05: undefined, p25: undefined, p75: undefined, p95: undefined };
  }
  const mean = sum / values.length;
  let variance = 0;
  for (const value of values) variance += (value - mean) ** 2;
  variance /= values.length;
  return {
    count: values.length,
    min: values[0],
    max: values[values.length - 1],
    mean,
    median: percentile(values, .5),
    standardDeviation: Math.sqrt(variance),
    p05: percentile(values, .05),
    p25: percentile(values, .25),
    p75: percentile(values, .75),
    p95: percentile(values, .95),
  };
}

function autoBinCountFromValues(values: readonly number[]): number {
  if (values.length < 2) return 10;
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  if (min === max) return 1;
  const q1 = percentile(sorted, .25) ?? min;
  const q3 = percentile(sorted, .75) ?? max;
  const iqr = q3 - q1;
  if (iqr > 0) {
    const width = (2 * iqr) / Math.cbrt(sorted.length);
    if (width > 0) return Math.max(8, Math.min(80, Math.ceil((max - min) / width)));
  }
  return Math.max(8, Math.min(80, Math.ceil(Math.sqrt(sorted.length))));
}

function finiteExtent(values: readonly number[]): { min: number; max: number } | undefined {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let count = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
    count += 1;
  }
  return count > 0 ? { min, max } : undefined;
}

function localIndicesForSourceIndices(trace: HistogramTraceContext, sampleIndices: ArrayLike<number>): number[] {
  const indices: number[] = [];
  for (let position = 0; position < sampleIndices.length; position += 1) {
    const sampleIndex = sampleIndices[position];
    if (sampleIndex === undefined) continue;
    const localIndex = sampleIndex - trace.range.startSampleIndex;
    if (!Number.isSafeInteger(localIndex) || localIndex < 0 || localIndex >= trace.range.values.length) continue;
    indices.push(localIndex);
  }
  return indices;
}

function continuityThresholdMs(trace: HistogramTraceContext, localIndices: readonly number[]): number | undefined {
  const deltas: number[] = [];
  const stride = Math.max(1, Math.floor(localIndices.length / 4096));
  for (let position = 0; position + stride < localIndices.length; position += stride) {
    const localIndex = localIndices[position];
    const nextLocalIndex = localIndices[position + stride];
    if (localIndex === undefined || nextLocalIndex === undefined || nextLocalIndex !== localIndex + stride) continue;
    const time = trace.range.timeMs[localIndex];
    const nextTime = trace.range.timeMs[nextLocalIndex];
    if (time === undefined || nextTime === undefined || !Number.isFinite(time) || !Number.isFinite(nextTime)) continue;
    const delta = (nextTime - time) / stride;
    if (delta > 0 && Number.isFinite(delta)) deltas.push(delta);
  }
  if (deltas.length === 0) return undefined;
  deltas.sort((a, b) => a - b);
  const median = percentile(deltas, .5);
  return median === undefined ? undefined : Math.max(1, median * 5);
}

function metricBins(trace: HistogramTraceContext, localIndices: readonly number[], binCount: number, rangeMin: number, rangeMax: number, metric: DistributionMetric): number[] {
  const counts = new Array<number>(binCount).fill(0);
  const durations = new Array<number>(binCount).fill(0);
  const span = Math.max(Number.EPSILON, rangeMax - rangeMin);
  const maxContinuousDeltaMs = metric === 'time' ? continuityThresholdMs(trace, localIndices) : undefined;
  let validCount = 0;

  for (let position = 0; position < localIndices.length; position += 1) {
    const localIndex = localIndices[position]!;
    const value = trace.range.values[localIndex];
    const time = trace.range.timeMs[localIndex];
    if (value === undefined || time === undefined || !Number.isFinite(value) || !Number.isFinite(time)) continue;
    validCount += 1;
    if (!distributionValueInsideGeometry(value, rangeMin, rangeMax)) continue;
    const normalized = Math.max(0, Math.min(1, (value - rangeMin) / span));
    const binIndex = value === rangeMax ? binCount - 1 : Math.min(binCount - 1, Math.max(0, Math.floor(normalized * binCount)));
    counts[binIndex] = (counts[binIndex] ?? 0) + 1;

    if (metric !== 'time') continue;
    const nextLocalIndex = localIndices[position + 1];
    if (nextLocalIndex === undefined || nextLocalIndex !== localIndex + 1) continue;
    const nextTime = trace.range.timeMs[nextLocalIndex];
    if (nextTime === undefined || !Number.isFinite(nextTime)) continue;
    const delta = nextTime - time;
    if (delta <= 0 || (maxContinuousDeltaMs !== undefined && delta > maxContinuousDeltaMs)) continue;
    durations[binIndex] = (durations[binIndex] ?? 0) + delta;
  }

  if (metric === 'count') return counts;
  if (metric === 'percent') return counts.map((count) => validCount > 0 ? (count / validCount) * 100 : 0);
  return durations.map((duration) => duration / 1000);
}

function sameChannelCatalog(left: HistogramPageContext['channels'], right: HistogramPageContext['channels']): boolean {
  return left.length === right.length && left.every((channel, index) => channel === right[index]);
}

export function createHistogramDistributionView(): HistogramDistributionViewController {
  let context: HistogramPageContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined };
  let metric: DistributionMetric = 'count';
  let binMode: DistributionBinMode = 'auto';
  let display: DistributionDisplay = 'histogram';
  let compare = false;
  let renderGeneration = 0;
  let selectedBin: SelectedBin | undefined;
  let lastSeries: readonly DistributionSeries[] = [];
  let lastRangeMin = 0;
  let lastRangeMax = 1;
  let qualificationSets = loadHistogramQualificationSets();
  let distributionPresets = loadHistogramDistributionPresets();

  const root = document.createElement('section');
  root.className = 'histogram-distribution-view';
  root.hidden = true;
  root.innerHTML = `
    <div class="distribution-controls">
      <label><span>Channel</span><select class="distribution-channel"></select></label>
      <label><span>Scope</span><select class="distribution-scope"></select></label>
      <label><span>Qualification</span><select class="distribution-qualification"><option value="">None</option></select></label>
      <label><span>Y Axis</span><select class="distribution-metric"><option value="count">Count</option><option value="percent">% Samples</option><option value="time">Time</option></select></label>
      <label><span>Bins</span><select class="distribution-bin-mode"><option value="auto">Auto</option><option value="manual">Count</option><option value="fixed">Fixed</option></select></label>
      <input class="distribution-bin-count" type="number" min="1" max="512" step="1" value="20" aria-label="Manual bin count" title="Manual bin count" hidden />
      <label class="distribution-fixed-control" hidden><span>Min</span><input class="distribution-fixed-min" type="number" step="any" value="0" /></label>
      <label class="distribution-fixed-control" hidden><span>Max</span><input class="distribution-fixed-max" type="number" step="any" value="100" /></label>
      <label class="distribution-fixed-control" hidden><span>Width</span><input class="distribution-fixed-width" type="number" min="0" step="any" value="5" /></label>
      <label><span>View</span><select class="distribution-display"><option value="histogram">Histogram</option><option value="cumulative">Cumulative</option></select></label>
      <label class="distribution-compare-toggle"><input type="checkbox" /><span>Compare</span></label>
      <details class="distribution-presets">
        <summary title="Saved Distribution setups">Presets</summary>
        <div class="distribution-preset-popover">
          <select class="distribution-preset-select" aria-label="Saved Distribution setup"></select>
          <div class="distribution-preset-actions"><button type="button" class="distribution-preset-apply">Apply</button><button type="button" class="distribution-preset-save">Save setup…</button><button type="button" class="distribution-preset-delete">Delete</button></div>
          <small>Saved setups retain channel, scope, Qualification, Y axis, bins, view and compare scope.</small>
        </div>
      </details>
      <button type="button" class="distribution-export-csv" disabled>CSV</button>
    </div>
    <div class="distribution-compare-controls" hidden>
      <label><span>Compare scope</span><select class="distribution-compare-scope"></select></label>
      <span class="distribution-compare-note">Primary and compare scopes use the same bin boundaries and qualification.</span>
    </div>
    <div class="distribution-main">
      <div class="distribution-empty" hidden>
        <strong>Distribution needs numeric samples.</strong>
        <span>Choose Full Log, Current A/B, or a Saved Range.</span>
      </div>
      <div class="distribution-chart-wrap">
        <canvas class="distribution-chart" aria-label="Distribution histogram"></canvas>
        <div class="distribution-legend"></div>
      </div>
      <aside class="distribution-stats" aria-label="Distribution statistics"></aside>
    </div>
    <div class="distribution-bin-detail" hidden>
      <span class="distribution-bin-label">—</span>
      <span class="distribution-bin-count-label">—</span>
      <button type="button" class="distribution-open-logger" disabled>Open bin in Logger</button>
      <button type="button" class="distribution-clear-bin">Clear selection</button>
    </div>
    <div class="distribution-shared-timeline-slot"></div>
  `;

  const channelSelect = root.querySelector<HTMLSelectElement>('.distribution-channel')!;
  const scopeSelect = root.querySelector<HTMLSelectElement>('.distribution-scope')!;
  const qualificationSelect = root.querySelector<HTMLSelectElement>('.distribution-qualification')!;
  const metricSelect = root.querySelector<HTMLSelectElement>('.distribution-metric')!;
  const binModeSelect = root.querySelector<HTMLSelectElement>('.distribution-bin-mode')!;
  const binCountInput = root.querySelector<HTMLInputElement>('.distribution-bin-count')!;
  const fixedControls = [...root.querySelectorAll<HTMLElement>('.distribution-fixed-control')];
  const fixedMinInput = root.querySelector<HTMLInputElement>('.distribution-fixed-min')!;
  const fixedMaxInput = root.querySelector<HTMLInputElement>('.distribution-fixed-max')!;
  const fixedWidthInput = root.querySelector<HTMLInputElement>('.distribution-fixed-width')!;
  const displaySelect = root.querySelector<HTMLSelectElement>('.distribution-display')!;
  const compareToggle = root.querySelector<HTMLInputElement>('.distribution-compare-toggle input')!;
  const compareControls = root.querySelector<HTMLElement>('.distribution-compare-controls')!;
  const compareScopeSelect = root.querySelector<HTMLSelectElement>('.distribution-compare-scope')!;
  const presetSelect = root.querySelector<HTMLSelectElement>('.distribution-preset-select')!;
  const presetApply = root.querySelector<HTMLButtonElement>('.distribution-preset-apply')!;
  const presetSave = root.querySelector<HTMLButtonElement>('.distribution-preset-save')!;
  const presetDelete = root.querySelector<HTMLButtonElement>('.distribution-preset-delete')!;
  const exportCsvButton = root.querySelector<HTMLButtonElement>('.distribution-export-csv')!;
  const empty = root.querySelector<HTMLElement>('.distribution-empty')!;
  const canvas = root.querySelector<HTMLCanvasElement>('.distribution-chart')!;
  const legend = root.querySelector<HTMLElement>('.distribution-legend')!;
  const statsPanel = root.querySelector<HTMLElement>('.distribution-stats')!;
  const binDetail = root.querySelector<HTMLElement>('.distribution-bin-detail')!;
  const binLabel = root.querySelector<HTMLElement>('.distribution-bin-label')!;
  const binCountLabel = root.querySelector<HTMLElement>('.distribution-bin-count-label')!;
  const openLoggerButton = root.querySelector<HTMLButtonElement>('.distribution-open-logger')!;
  const clearBinButton = root.querySelector<HTMLButtonElement>('.distribution-clear-bin')!;

  const populatePresetSelect = (preferredId = ''): void => {
    presetSelect.replaceChildren(new Option(distributionPresets.length > 0 ? 'Select saved setup…' : 'No saved setups', ''));
    for (const preset of distributionPresets) presetSelect.add(new Option(preset.name, preset.id));
    presetSelect.value = preferredId && distributionPresets.some((preset) => preset.id === preferredId) ? preferredId : '';
    presetApply.disabled = !presetSelect.value;
    presetDelete.disabled = !presetSelect.value;
  };

  const currentPresetState = (id: string, name: string): HistogramDistributionPresetState => ({
    id,
    name,
    channelId: channelSelect.value,
    scope: scopeSelect.value,
    qualificationId: qualificationSelect.value,
    metric,
    binMode,
    binCount: binCountInput.value,
    fixedMin: fixedMinInput.value,
    fixedMax: fixedMaxInput.value,
    fixedWidth: fixedWidthInput.value,
    display,
    compare,
    compareScope: compareScopeSelect.value,
  });

  const syncBinGeometryControls = (): void => {
    binCountInput.hidden = binMode !== 'manual';
    for (const control of fixedControls) control.hidden = binMode !== 'fixed';
  };

  const setSelectIfAvailable = (select: HTMLSelectElement, value: string): void => {
    if ([...select.options].some((option) => option.value === value && !option.disabled)) select.value = value;
  };

  const downloadCsv = (csv: string, filename: string): void => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const hasValidCurrentRange = (): boolean => context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs;

  const populateScopeSelect = (select: HTMLSelectElement, previous: string, fallback: 'ab' | 'full'): void => {
    select.replaceChildren(new Option('Full Log', 'full'), new Option('Current A/B', 'ab'));
    for (const [index, range] of (context.savedRanges ?? []).entries()) {
      const seconds = Math.abs(range.endMs - range.startMs) / 1000;
      select.add(new Option(`${range.label || `Range ${index + 1}`} · ${seconds.toFixed(seconds >= 10 ? 1 : 3)} s`, `saved:${index}`));
    }
    const abOption = [...select.options].find((option) => option.value === 'ab');
    if (abOption) abOption.disabled = !hasValidCurrentRange();
    if (previous && [...select.options].some((option) => option.value === previous && !option.disabled)) select.value = previous;
    else select.value = fallback === 'ab' && hasValidCurrentRange() ? 'ab' : 'full';
  };

  const refreshScopeSelectors = (): void => {
    const previousPrimary = scopeSelect.value;
    const previousCompare = compareScopeSelect.value;
    populateScopeSelect(scopeSelect, previousPrimary, 'ab');
    populateScopeSelect(compareScopeSelect, previousCompare, 'full');
    if (compareScopeSelect.value === scopeSelect.value && compareScopeSelect.options.length > 1) {
      const alternative = [...compareScopeSelect.options].find((option) => !option.disabled && option.value !== scopeSelect.value);
      if (alternative) compareScopeSelect.value = alternative.value;
    }
  };

  const resolveScope = (value: string, fallbackLabel: string): ResolvedScope | undefined => {
    if (value === 'full') return { label: 'Full Log' };
    if (value === 'ab') {
      if (!hasValidCurrentRange()) return undefined;
      return { label: 'Current A/B', startMs: Math.min(context.aTimeMs!, context.bTimeMs!), endMs: Math.max(context.aTimeMs!, context.bTimeMs!) };
    }
    if (value.startsWith('saved:')) {
      const index = Number(value.slice(6));
      const saved: SavedTimelineRangeState | undefined = context.savedRanges?.[index];
      if (!saved) return undefined;
      return { label: saved.label || fallbackLabel, startMs: Math.min(saved.startMs, saved.endMs), endMs: Math.max(saved.startMs, saved.endMs) };
    }
    return undefined;
  };

  const configureCanvas = (): { ctx: CanvasRenderingContext2D; width: number; height: number } | undefined => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return { ctx, width, height };
  };

  const renderStats = (series: readonly DistributionSeries[]): void => {
    statsPanel.replaceChildren();
    for (const item of series) {
      const section = document.createElement('section');
      section.className = 'distribution-stat-series';
      section.innerHTML = `
        <header><i style="--series-color:${item.color}"></i><strong>${item.label}</strong><small>${item.stats.count.toLocaleString()} samples · eligible ${item.qualification.eligibleSampleCount.toLocaleString()} / ${item.qualification.inputSampleCount.toLocaleString()}${item.outsideGeometrySampleCount > 0 ? ` · outside geometry ${item.outsideGeometrySampleCount.toLocaleString()}` : ''}</small></header>
        <dl>
          <div><dt>Mean</dt><dd>${formatNumber(item.stats.mean)}</dd></div>
          <div><dt>Median</dt><dd>${formatNumber(item.stats.median)}</dd></div>
          <div><dt>Std dev</dt><dd>${formatNumber(item.stats.standardDeviation)}</dd></div>
          <div><dt>Min / Max</dt><dd>${formatNumber(item.stats.min)} / ${formatNumber(item.stats.max)}</dd></div>
          <div><dt>P05 / P95</dt><dd>${formatNumber(item.stats.p05)} / ${formatNumber(item.stats.p95)}</dd></div>
          <div><dt>P25 / P75</dt><dd>${formatNumber(item.stats.p25)} / ${formatNumber(item.stats.p75)}</dd></div>
        </dl>
      `;
      statsPanel.append(section);
    }
  };

  const renderLegend = (series: readonly DistributionSeries[]): void => {
    legend.replaceChildren();
    for (const item of series) {
      const entry = document.createElement('span');
      entry.innerHTML = `<i style="--series-color:${item.color}"></i>${item.label}`;
      legend.append(entry);
    }
  };

  const renderChart = (series: readonly DistributionSeries[], rangeMin: number, rangeMax: number): void => {
    const configured = configureCanvas();
    if (!configured || series.length === 0) return;
    const { ctx, width, height } = configured;
    const padLeft = 58;
    const padRight = 18;
    const padTop = 24;
    const padBottom = 42;
    const chartWidth = Math.max(1, width - padLeft - padRight);
    const chartHeight = Math.max(1, height - padTop - padBottom);
    const binCount = series[0]?.binValues.length ?? 0;
    if (binCount === 0) return;

    ctx.fillStyle = '#020608';
    ctx.fillRect(padLeft, padTop, chartWidth, chartHeight);
    ctx.strokeStyle = 'rgba(67, 91, 106, .6)';
    ctx.strokeRect(padLeft, padTop, chartWidth, chartHeight);
    ctx.strokeStyle = 'rgba(50, 71, 83, .45)';
    ctx.setLineDash([2, 5]);
    for (let index = 1; index < 4; index += 1) {
      const y = padTop + chartHeight * index / 4;
      ctx.beginPath(); ctx.moveTo(padLeft, y); ctx.lineTo(padLeft + chartWidth, y); ctx.stroke();
    }
    ctx.setLineDash([]);

    const plotted = series.map((item) => {
      if (display === 'histogram') return [...item.binValues];
      const total = item.binValues.reduce((sum, value) => sum + value, 0);
      let running = 0;
      return item.binValues.map((value) => { running += value; return total > 0 ? (running / total) * 100 : 0; });
    });
    let maxValue = display === 'cumulative' ? 100 : 1;
    if (display !== 'cumulative') for (const values of plotted) for (const value of values) maxValue = Math.max(maxValue, value);
    const slotWidth = chartWidth / binCount;

    if (display === 'histogram') {
      plotted.forEach((values, seriesIndex) => {
        const item = series[seriesIndex]!;
        const innerWidth = Math.max(1, slotWidth * .82);
        const seriesWidth = innerWidth / series.length;
        values.forEach((value, index) => {
          const barHeight = (value / maxValue) * chartHeight;
          const x = padLeft + slotWidth * index + slotWidth * .09 + seriesWidth * seriesIndex;
          const y = padTop + chartHeight - barHeight;
          ctx.fillStyle = item.color;
          ctx.globalAlpha = .78;
          ctx.fillRect(x, y, Math.max(1, seriesWidth - 1), barHeight);
        });
      });
      ctx.globalAlpha = 1;
    } else {
      plotted.forEach((values, seriesIndex) => {
        const item = series[seriesIndex]!;
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        values.forEach((value, index) => {
          const x = padLeft + ((index + .5) / binCount) * chartWidth;
          const y = padTop + chartHeight - (value / maxValue) * chartHeight;
          if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
      });
    }

    if (selectedBin && display === 'histogram') {
      const x = padLeft + selectedBin.index * slotWidth;
      ctx.fillStyle = 'rgba(142, 206, 244, .12)';
      ctx.fillRect(x, padTop, slotWidth, chartHeight);
      ctx.strokeStyle = '#8ecef4';
      ctx.strokeRect(x + .5, padTop + .5, Math.max(1, slotWidth - 1), Math.max(1, chartHeight - 1));
    }

    ctx.fillStyle = '#78909e';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const yLabel = display === 'cumulative' ? '100%' : metric === 'percent' ? `${formatNumber(maxValue, 1)}%` : metric === 'time' ? `${formatNumber(maxValue, 2)} s` : Math.round(maxValue).toLocaleString();
    ctx.fillText(yLabel, padLeft - 6, padTop + 4);
    ctx.fillText('0', padLeft - 6, padTop + chartHeight);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(formatNumber(rangeMin), padLeft, padTop + chartHeight + 7);
    ctx.textAlign = 'right';
    ctx.fillText(formatNumber(rangeMax), padLeft + chartWidth, padTop + chartHeight + 7);
    ctx.textAlign = 'center';
    const unit = series[0]?.trace.channel.unit;
    ctx.fillText(`${channelLabel(series[0]!.trace)}${unit ? ` · ${unit}` : ''}`, padLeft + chartWidth / 2, padTop + chartHeight + 22);
  };

  const buildSeries = (
    trace: HistogramTraceContext,
    scope: ResolvedScope,
    qualification: HistogramQualificationState,
    binCount: number,
    rangeMin: number,
    rangeMax: number,
    color: string,
  ): DistributionSeries => {
    const localIndices = localIndicesForSourceIndices(trace, qualification.eligibleSampleIndices);
    let outsideGeometrySampleCount = 0;
    for (const localIndex of localIndices) {
      const value = trace.range.values[localIndex];
      if (trace.range.validity[localIndex] !== 1 || value === undefined || !Number.isFinite(value)) continue;
      if (!distributionValueInsideGeometry(value, rangeMin, rangeMax)) outsideGeometrySampleCount += 1;
    }
    return {
      label: scope.label,
      trace,
      localIndices,
      stats: statsFor(trace.range, localIndices),
      binValues: metricBins(trace, localIndices, binCount, rangeMin, rangeMax, metric),
      color,
      qualification,
      outsideGeometrySampleCount,
    };
  };

  const render = async (): Promise<void> => {
    const generation = ++renderGeneration;
    selectedBin = undefined;
    lastSeries = [];
    exportCsvButton.disabled = true;
    binDetail.hidden = true;
    const channelId = channelSelect.value || context.channels[0]?.id;
    if (!channelId) {
      empty.hidden = false; canvas.hidden = true; statsPanel.replaceChildren(); legend.replaceChildren(); return;
    }

    const primaryScope = resolveScope(scopeSelect.value, 'Saved Range');
    const compareScope = compare ? resolveScope(compareScopeSelect.value, 'Compare Range') : undefined;
    if (!primaryScope || (compare && !compareScope)) {
      empty.hidden = false; canvas.hidden = true; statsPanel.replaceChildren(); legend.replaceChildren(); return;
    }

    const filterSet = selectedHistogramQualification(qualificationSelect, qualificationSets);
    const filterChannelIds = histogramQualificationChannelIds(filterSet);
    const requestedChannelIds = [channelId, ...filterChannelIds.filter((id) => id !== channelId)];
    const requests: { scope: ResolvedScope; color: string }[] = [{ scope: primaryScope, color: '#49aef4' }];
    if (compareScope) requests.push({ scope: compareScope, color: '#f0a44b' });

    const loaded = await Promise.all(requests.map(async (request) => {
      const traces = await context.loadTraces(requestedChannelIds, request.scope.startMs, request.scope.endMs);
      const trace = traces.find((candidate) => candidate.channel.id === channelId);
      if (!trace) return undefined;
      const qualification = qualifyHistogramSamples(trace, traces, filterSet, request.scope.startMs, request.scope.endMs);
      return qualification ? { trace, qualification, request } : undefined;
    }));
    if (generation !== renderGeneration) return;
    const available = loaded.filter((item): item is NonNullable<typeof item> => item !== undefined);
    if (available.length !== requests.length) {
      empty.hidden = false;
      empty.querySelector('strong')!.textContent = 'Distribution qualification data is unavailable.';
      empty.querySelector('span')!.textContent = 'The selected saved qualification references channels that are unavailable in this source.';
      canvas.hidden = true;
      statsPanel.replaceChildren();
      legend.replaceChildren();
      return;
    }

    const allValues: number[] = [];
    for (const item of available) {
      const indices = localIndicesForSourceIndices(item.trace, item.qualification.eligibleSampleIndices);
      for (const index of indices) {
        const value = item.trace.range.values[index];
        if (value !== undefined && Number.isFinite(value)) allValues.push(value);
      }
    }
    const extent = finiteExtent(allValues);
    if (!extent) {
      empty.hidden = false;
      empty.querySelector('strong')!.textContent = 'No eligible Distribution samples.';
      empty.querySelector('span')!.textContent = filterSet ? `Qualification “${filterSet.name}” rejected or invalidated all samples in the selected scope.` : 'The selected scope has no finite numeric samples.';
      canvas.hidden = true;
      statsPanel.replaceChildren();
      legend.replaceChildren();
      return;
    }

    let rangeMin = extent.min;
    let rangeMax = extent.max;
    let resolvedBinCount: number;
    if (binMode === 'fixed') {
      try {
        const geometry = resolveFixedDistributionGeometry({
          min: Number(fixedMinInput.value),
          max: Number(fixedMaxInput.value),
          width: Number(fixedWidthInput.value),
          maximumBinCount: 512,
        });
        rangeMin = geometry.min;
        rangeMax = geometry.max;
        resolvedBinCount = geometry.binCount;
      } catch (error) {
        empty.hidden = false;
        empty.querySelector('strong')!.textContent = 'Fixed Distribution geometry is invalid.';
        empty.querySelector('span')!.textContent = error instanceof Error ? error.message : String(error);
        canvas.hidden = true; statsPanel.replaceChildren(); legend.replaceChildren(); return;
      }
    } else {
      resolvedBinCount = binMode === 'manual'
        ? Math.max(1, Math.min(512, Math.floor(Number(binCountInput.value) || 20)))
        : autoBinCountFromValues(allValues);
      binCountInput.value = String(resolvedBinCount);
    }

    const series = available.map((item) => buildSeries(item.trace, item.request.scope, item.qualification, resolvedBinCount, rangeMin, rangeMax, item.request.color));
    if (generation !== renderGeneration) return;
    lastSeries = series;
    lastRangeMin = rangeMin;
    lastRangeMax = rangeMax;
    empty.hidden = true;
    canvas.hidden = false;
    renderLegend(series);
    renderStats(series);
    renderChart(series, rangeMin, rangeMax);
    exportCsvButton.disabled = false;
  };

  const updateBinDetail = (): void => {
    if (!selectedBin || lastSeries.length === 0) { binDetail.hidden = true; return; }
    const unit = lastSeries[0]?.trace.channel.unit ?? '';
    binLabel.textContent = `${formatNumber(selectedBin.lower)}–${formatNumber(selectedBin.upper)}${unit ? ` ${unit}` : ''}`;
    binCountLabel.textContent = lastSeries.map((series) => {
      const value = series.binValues[selectedBin!.index] ?? 0;
      const formatted = metric === 'count' ? Math.round(value).toLocaleString() : metric === 'percent' ? `${formatNumber(value, 2)}%` : `${formatNumber(value, 3)} s`;
      return `${series.label}: ${formatted}`;
    }).join(' · ');
    openLoggerButton.disabled = !context.openSamplesInLogger;
    binDetail.hidden = false;
  };

  canvas.addEventListener('click', (event) => {
    if (lastSeries.length === 0 || display !== 'histogram') return;
    const rect = canvas.getBoundingClientRect();
    const padLeft = 58;
    const padRight = 18;
    const chartWidth = Math.max(1, rect.width - padLeft - padRight);
    const binCount = lastSeries[0]?.binValues.length ?? 0;
    if (binCount === 0) return;
    const x = event.clientX - rect.left;
    if (x < padLeft || x > padLeft + chartWidth) return;
    const index = Math.min(binCount - 1, Math.max(0, Math.floor(((x - padLeft) / chartWidth) * binCount)));
    const width = (lastRangeMax - lastRangeMin) / binCount;
    selectedBin = { index, lower: lastRangeMin + width * index, upper: index === binCount - 1 ? lastRangeMax : lastRangeMin + width * (index + 1), includesUpper: index === binCount - 1 };
    updateBinDetail();
    renderChart(lastSeries, lastRangeMin, lastRangeMax);
  });

  openLoggerButton.addEventListener('click', () => {
    if (!selectedBin || !context.openSamplesInLogger) return;
    const sampleIndices: number[] = [];
    const timeMs: number[] = [];
    for (const series of lastSeries) {
      for (const localIndex of series.localIndices) {
        const value = series.trace.range.values[localIndex];
        const time = series.trace.range.timeMs[localIndex];
        if (value === undefined || time === undefined || !Number.isFinite(value) || !Number.isFinite(time)) continue;
        const inside = value >= selectedBin.lower && (selectedBin.includesUpper ? value <= selectedBin.upper : value < selectedBin.upper);
        if (!inside) continue;
        sampleIndices.push(series.trace.range.startSampleIndex + localIndex);
        timeMs.push(time);
      }
    }
    void context.openSamplesInLogger({ sampleIndices, timeMs, label: `${channelLabel(lastSeries[0]!.trace)} ${formatNumber(selectedBin.lower)}–${formatNumber(selectedBin.upper)}` });
  });

  clearBinButton.addEventListener('click', () => {
    selectedBin = undefined;
    binDetail.hidden = true;
    if (lastSeries.length > 0) renderChart(lastSeries, lastRangeMin, lastRangeMax);
  });

  presetSelect.addEventListener('change', () => {
    presetApply.disabled = !presetSelect.value;
    presetDelete.disabled = !presetSelect.value;
  });
  presetApply.addEventListener('click', () => {
    const preset = distributionPresets.find((candidate) => candidate.id === presetSelect.value);
    if (!preset) return;
    setSelectIfAvailable(channelSelect, preset.channelId);
    setSelectIfAvailable(scopeSelect, preset.scope);
    setSelectIfAvailable(qualificationSelect, preset.qualificationId);
    metric = preset.metric; metricSelect.value = metric;
    binMode = preset.binMode; binModeSelect.value = binMode; binCountInput.value = preset.binCount;
    fixedMinInput.value = preset.fixedMin ?? fixedMinInput.value;
    fixedMaxInput.value = preset.fixedMax ?? fixedMaxInput.value;
    fixedWidthInput.value = preset.fixedWidth ?? fixedWidthInput.value;
    syncBinGeometryControls();
    display = preset.display; displaySelect.value = display;
    compare = preset.compare; compareToggle.checked = compare; compareControls.hidden = !compare;
    setSelectIfAvailable(compareScopeSelect, preset.compareScope);
    void render();
  });
  presetSave.addEventListener('click', () => {
    const suggested = distributionPresets.find((candidate) => candidate.id === presetSelect.value)?.name ?? `${channelSelect.selectedOptions[0]?.text ?? 'Distribution'} setup`;
    const name = window.prompt('Distribution setup name', suggested)?.trim();
    if (!name) return;
    const existing = distributionPresets.find((candidate) => candidate.id === presetSelect.value);
    const id = existing?.id ?? createHistogramLocalId('distribution-preset');
    const next = currentPresetState(id, name);
    distributionPresets = existing ? distributionPresets.map((candidate) => candidate.id === id ? next : candidate) : [...distributionPresets, next];
    saveHistogramDistributionPresets(distributionPresets);
    populatePresetSelect(id);
  });
  presetDelete.addEventListener('click', () => {
    const id = presetSelect.value;
    if (!id) return;
    distributionPresets = distributionPresets.filter((candidate) => candidate.id !== id);
    saveHistogramDistributionPresets(distributionPresets);
    populatePresetSelect();
  });
  exportCsvButton.addEventListener('click', () => {
    if (lastSeries.length === 0) return;
    const first = lastSeries[0]!;
    const exported = buildDistributionCsv({
      channelLabel: channelLabel(first.trace),
      unit: first.trace.channel.unit,
      metric,
      display,
      binMode,
      rangeMin: lastRangeMin,
      rangeMax: lastRangeMax,
      series: lastSeries.map((series) => ({
        label: series.label,
        binValues: series.binValues,
        stats: series.stats,
        inputSampleCount: series.qualification.inputSampleCount,
        eligibleSampleCount: series.qualification.eligibleSampleCount,
        rejectedSampleCount: series.qualification.rejectedSampleCount,
        outsideGeometrySampleCount: series.outsideGeometrySampleCount,
      })),
    });
    if (exported.binRowCount === 0) return;
    downloadCsv(exported.csv, distributionCsvFilename(channelLabel(first.trace)));
  });

  channelSelect.addEventListener('change', () => { void render(); });
  scopeSelect.addEventListener('change', () => { if (compare && compareScopeSelect.value === scopeSelect.value) refreshScopeSelectors(); void render(); });
  compareScopeSelect.addEventListener('change', () => { void render(); });
  qualificationSelect.addEventListener('change', () => { void render(); });
  metricSelect.addEventListener('change', () => { metric = metricSelect.value === 'percent' ? 'percent' : metricSelect.value === 'time' ? 'time' : 'count'; void render(); });
  binModeSelect.addEventListener('change', () => { binMode = binModeSelect.value === 'manual' ? 'manual' : binModeSelect.value === 'fixed' ? 'fixed' : 'auto'; syncBinGeometryControls(); void render(); });
  binCountInput.addEventListener('change', () => { void render(); });
  fixedMinInput.addEventListener('change', () => { void render(); });
  fixedMaxInput.addEventListener('change', () => { void render(); });
  fixedWidthInput.addEventListener('change', () => { void render(); });
  displaySelect.addEventListener('change', () => { display = displaySelect.value === 'cumulative' ? 'cumulative' : 'histogram'; void render(); });
  compareToggle.addEventListener('change', () => { compare = compareToggle.checked; compareControls.hidden = !compare; refreshScopeSelectors(); void render(); });

  new ResizeObserver(() => {
    if (!root.hidden && !canvas.hidden && lastSeries.length > 0) renderChart(lastSeries, lastRangeMin, lastRangeMax);
  }).observe(canvas);

  const setContext = (nextContext: HistogramPageContext): void => {
    const previousChannel = channelSelect.value;
    const previousQualification = qualificationSelect.value;
    const channelsChanged = !sameChannelCatalog(context.channels, nextContext.channels);
    context = nextContext;
    qualificationSets = loadHistogramQualificationSets();
    if (channelsChanged) {
      channelSelect.replaceChildren();
      for (const channel of context.channels) channelSelect.add(new Option(channel.displayName || channel.sourceName, channel.id));
      if (previousChannel && context.channels.some((channel) => channel.id === previousChannel)) channelSelect.value = previousChannel;
    }
    populateHistogramQualificationSelect(qualificationSelect, qualificationSets, context.channels, previousQualification);
    refreshScopeSelectors();
    void render();
  };

  populateHistogramQualificationSelect(qualificationSelect, qualificationSets, context.channels);
  syncBinGeometryControls();
  refreshScopeSelectors();
  populatePresetSelect();
  return { element: root, setContext, refresh: () => { void render(); } };
}
