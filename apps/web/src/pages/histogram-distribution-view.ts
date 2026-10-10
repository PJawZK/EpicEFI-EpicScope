import type { NumericChannelRange } from '../../../../core/log-model/log-types';
import type { HistogramPageContext, HistogramTraceContext } from './histogram-page';
import type { SavedTimelineRangeState } from '../state/workspace-state';

type DistributionScope = 'range' | 'full';
type DistributionMetric = 'count' | 'percent' | 'time';
type DistributionBinMode = 'auto' | 'manual';
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
}

interface SelectedBin {
  readonly index: number;
  readonly lower: number;
  readonly upper: number;
  readonly includesUpper: boolean;
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

function autoBinCount(range: NumericChannelRange, localIndices: readonly number[]): number {
  const values: number[] = [];
  for (const localIndex of localIndices) {
    const value = range.values[localIndex];
    if (range.validity[localIndex] === 1 && value !== undefined && Number.isFinite(value)) values.push(value);
  }
  if (values.length < 2) return 10;
  values.sort((a, b) => a - b);
  const min = values[0]!;
  const max = values[values.length - 1]!;
  if (min === max) return 1;
  const q1 = percentile(values, .25) ?? min;
  const q3 = percentile(values, .75) ?? max;
  const iqr = q3 - q1;
  if (iqr > 0) {
    const width = (2 * iqr) / Math.cbrt(values.length);
    if (width > 0) return Math.max(8, Math.min(80, Math.ceil((max - min) / width)));
  }
  return Math.max(8, Math.min(80, Math.ceil(Math.sqrt(values.length))));
}

function matchingLocalIndices(trace: HistogramTraceContext, startMs?: number, endMs?: number): number[] {
  const indices: number[] = [];
  const minTime = startMs === undefined || endMs === undefined ? undefined : Math.min(startMs, endMs);
  const maxTime = startMs === undefined || endMs === undefined ? undefined : Math.max(startMs, endMs);
  for (let index = 0; index < trace.range.values.length; index += 1) {
    const value = trace.range.values[index];
    const time = trace.range.timeMs[index];
    if (trace.range.validity[index] !== 1 || value === undefined || time === undefined || !Number.isFinite(value) || !Number.isFinite(time)) continue;
    if (minTime !== undefined && maxTime !== undefined && (time < minTime || time > maxTime)) continue;
    indices.push(index);
  }
  return indices;
}

function metricBins(trace: HistogramTraceContext, localIndices: readonly number[], binCount: number, rangeMin: number, rangeMax: number, metric: DistributionMetric): number[] {
  const counts = new Array<number>(binCount).fill(0);
  const durations = new Array<number>(binCount).fill(0);
  const span = Math.max(Number.EPSILON, rangeMax - rangeMin);
  let validCount = 0;

  for (let position = 0; position < localIndices.length; position += 1) {
    const localIndex = localIndices[position]!;
    const value = trace.range.values[localIndex];
    const time = trace.range.timeMs[localIndex];
    if (value === undefined || time === undefined || !Number.isFinite(value) || !Number.isFinite(time)) continue;
    const normalized = Math.max(0, Math.min(1, (value - rangeMin) / span));
    const binIndex = value === rangeMax ? binCount - 1 : Math.min(binCount - 1, Math.max(0, Math.floor(normalized * binCount)));
    counts[binIndex] = (counts[binIndex] ?? 0) + 1;
    validCount += 1;

    const nextLocalIndex = localIndices[position + 1];
    const nextTime = nextLocalIndex === undefined ? undefined : trace.range.timeMs[nextLocalIndex];
    if (nextTime !== undefined && Number.isFinite(nextTime)) {
      durations[binIndex] = (durations[binIndex] ?? 0) + Math.max(0, nextTime - time);
    }
  }

  if (metric === 'count') return counts;
  if (metric === 'percent') return counts.map((count) => validCount > 0 ? (count / validCount) * 100 : 0);
  return durations.map((duration) => duration / 1000);
}

function savedRangeOption(range: SavedTimelineRangeState, index: number): HTMLOptionElement {
  const duration = Math.abs(range.endMs - range.startMs) / 1000;
  return new Option(`${range.label || `Range ${index + 1}`} · ${duration.toFixed(2)} s`, String(index));
}

function sameChannelCatalog(
  left: HistogramPageContext['channels'],
  right: HistogramPageContext['channels'],
): boolean {
  return left.length === right.length && left.every((channel, index) => channel === right[index]);
}

export function createHistogramDistributionView(): HistogramDistributionViewController {
  let context: HistogramPageContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined };
  let scope: DistributionScope = 'range';
  let metric: DistributionMetric = 'count';
  let binMode: DistributionBinMode = 'auto';
  let display: DistributionDisplay = 'histogram';
  let compare = false;
  let renderGeneration = 0;
  let selectedBin: SelectedBin | undefined;
  let lastSeries: readonly DistributionSeries[] = [];
  let lastRangeMin = 0;
  let lastRangeMax = 1;

  const root = document.createElement('section');
  root.className = 'histogram-distribution-view';
  root.hidden = true;
  root.innerHTML = `
    <div class="distribution-controls">
      <label><span>Channel</span><select class="distribution-channel"></select></label>
      <label><span>Scope</span><select class="distribution-scope"><option value="range">Range A/B</option><option value="full">Full Log</option></select></label>
      <label><span>Y Axis</span><select class="distribution-metric"><option value="count">Count</option><option value="percent">% Samples</option><option value="time">Time</option></select></label>
      <label><span>Bins</span><select class="distribution-bin-mode"><option value="auto">Auto</option><option value="manual">Manual</option></select></label>
      <input class="distribution-bin-count" type="number" min="1" max="512" step="1" value="20" aria-label="Manual bin count" hidden />
      <label><span>View</span><select class="distribution-display"><option value="histogram">Histogram</option><option value="cumulative">Cumulative</option></select></label>
      <label class="distribution-compare-toggle"><input type="checkbox" /><span>Compare</span></label>
      <button type="button" class="distribution-refresh">Refresh</button>
    </div>
    <div class="distribution-compare-controls" hidden>
      <label><span>Range A</span><select class="distribution-range-a"></select></label>
      <label><span>Range B</span><select class="distribution-range-b"></select></label>
      <span class="distribution-compare-note">Saved timeline ranges are compared on shared bin boundaries.</span>
    </div>
    <div class="distribution-main">
      <div class="distribution-empty" hidden>
        <strong>Distribution needs numeric samples.</strong>
        <span>Choose Full Log, set A/B on the timeline, or select saved ranges for Compare.</span>
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
  const metricSelect = root.querySelector<HTMLSelectElement>('.distribution-metric')!;
  const binModeSelect = root.querySelector<HTMLSelectElement>('.distribution-bin-mode')!;
  const binCountInput = root.querySelector<HTMLInputElement>('.distribution-bin-count')!;
  const displaySelect = root.querySelector<HTMLSelectElement>('.distribution-display')!;
  const compareToggle = root.querySelector<HTMLInputElement>('.distribution-compare-toggle input')!;
  const refreshButton = root.querySelector<HTMLButtonElement>('.distribution-refresh')!;
  const compareControls = root.querySelector<HTMLElement>('.distribution-compare-controls')!;
  const rangeASelect = root.querySelector<HTMLSelectElement>('.distribution-range-a')!;
  const rangeBSelect = root.querySelector<HTMLSelectElement>('.distribution-range-b')!;
  const empty = root.querySelector<HTMLElement>('.distribution-empty')!;
  const canvas = root.querySelector<HTMLCanvasElement>('.distribution-chart')!;
  const legend = root.querySelector<HTMLElement>('.distribution-legend')!;
  const statsPanel = root.querySelector<HTMLElement>('.distribution-stats')!;
  const binDetail = root.querySelector<HTMLElement>('.distribution-bin-detail')!;
  const binLabel = root.querySelector<HTMLElement>('.distribution-bin-label')!;
  const binCountLabel = root.querySelector<HTMLElement>('.distribution-bin-count-label')!;
  const openLoggerButton = root.querySelector<HTMLButtonElement>('.distribution-open-logger')!;
  const clearBinButton = root.querySelector<HTMLButtonElement>('.distribution-clear-bin')!;

  const hasValidCurrentRange = (): boolean => context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs;

  const refreshRangeSelectors = (): void => {
    const ranges = context.savedRanges ?? [];
    const previousA = rangeASelect.value;
    const previousB = rangeBSelect.value;
    rangeASelect.replaceChildren();
    rangeBSelect.replaceChildren();
    ranges.forEach((range, index) => {
      rangeASelect.add(savedRangeOption(range, index));
      rangeBSelect.add(savedRangeOption(range, index));
    });
    if (ranges.length > 0) {
      rangeASelect.value = ranges[Number(previousA)] ? previousA : '0';
      rangeBSelect.value = ranges[Number(previousB)] ? previousB : String(Math.min(1, ranges.length - 1));
    }
    rangeASelect.disabled = ranges.length === 0;
    rangeBSelect.disabled = ranges.length < 2;
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
        <header><i style="--series-color:${item.color}"></i><strong>${item.label}</strong><small>${item.stats.count.toLocaleString()} samples</small></header>
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
      return item.binValues.map((value) => {
        running += value;
        return total > 0 ? (running / total) * 100 : 0;
      });
    });
    const maxValue = display === 'cumulative' ? 100 : Math.max(1, ...plotted.flat());
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

  const selectedRangeFor = (select: HTMLSelectElement): SavedTimelineRangeState | undefined => {
    const index = Number(select.value);
    return Number.isInteger(index) ? context.savedRanges?.[index] : undefined;
  };

  const buildSeries = (trace: HistogramTraceContext, label: string, startMs: number | undefined, endMs: number | undefined, binCount: number, rangeMin: number, rangeMax: number, color: string): DistributionSeries => {
    const localIndices = matchingLocalIndices(trace, startMs, endMs);
    return {
      label,
      trace,
      localIndices,
      stats: statsFor(trace.range, localIndices),
      binValues: metricBins(trace, localIndices, binCount, rangeMin, rangeMax, metric),
      color,
    };
  };

  const render = async (): Promise<void> => {
    const generation = ++renderGeneration;
    selectedBin = undefined;
    binDetail.hidden = true;
    const channelId = channelSelect.value || context.channels[0]?.id;
    if (!channelId) {
      empty.hidden = false;
      canvas.hidden = true;
      statsPanel.replaceChildren();
      legend.replaceChildren();
      return;
    }

    const ranges = context.savedRanges ?? [];
    const compareReady = compare && ranges.length >= 2;
    if (!compareReady && scope === 'range' && !hasValidCurrentRange()) {
      empty.hidden = false;
      canvas.hidden = true;
      statsPanel.replaceChildren();
      legend.replaceChildren();
      return;
    }

    let requests: { label: string; startMs?: number; endMs?: number; color: string }[];
    if (compareReady) {
      const a = selectedRangeFor(rangeASelect);
      const b = selectedRangeFor(rangeBSelect);
      if (!a || !b) {
        empty.hidden = false;
        canvas.hidden = true;
        return;
      }
      requests = [
        { label: a.label || 'Range A', startMs: Math.min(a.startMs, a.endMs), endMs: Math.max(a.startMs, a.endMs), color: '#49aef4' },
        { label: b.label || 'Range B', startMs: Math.min(b.startMs, b.endMs), endMs: Math.max(b.startMs, b.endMs), color: '#f0a44b' },
      ];
    } else if (scope === 'range') {
      requests = [{ label: 'A/B Range', startMs: Math.min(context.aTimeMs!, context.bTimeMs!), endMs: Math.max(context.aTimeMs!, context.bTimeMs!), color: '#49aef4' }];
    } else {
      requests = [{ label: 'Full Log', color: '#49aef4' }];
    }

    const loaded = await Promise.all(requests.map(async (request) => {
      const [trace] = await context.loadTraces([channelId], request.startMs, request.endMs);
      return trace ? { trace, request } : undefined;
    }));
    if (generation !== renderGeneration) return;
    const available = loaded.filter((item): item is NonNullable<typeof item> => item !== undefined);
    if (available.length === 0) {
      empty.hidden = false;
      canvas.hidden = true;
      return;
    }

    const allValues: number[] = [];
    const indexSets: { trace: HistogramTraceContext; indices: number[] }[] = [];
    for (const item of available) {
      const indices = matchingLocalIndices(item.trace, item.request.startMs, item.request.endMs);
      indexSets.push({ trace: item.trace, indices });
      for (const index of indices) {
        const value = item.trace.range.values[index];
        if (value !== undefined && Number.isFinite(value)) allValues.push(value);
      }
    }
    if (allValues.length === 0) {
      empty.hidden = false;
      canvas.hidden = true;
      return;
    }

    const rangeMin = Math.min(...allValues);
    const rangeMax = Math.max(...allValues);
    const reference = indexSets[0]!;
    const resolvedBinCount = binMode === 'manual'
      ? Math.max(1, Math.min(512, Math.floor(Number(binCountInput.value) || 20)))
      : autoBinCount(reference.trace.range, reference.indices);
    binCountInput.value = String(resolvedBinCount);

    const series = available.map((item) => buildSeries(item.trace, item.request.label, item.request.startMs, item.request.endMs, resolvedBinCount, rangeMin, rangeMax, item.request.color));
    if (generation !== renderGeneration) return;

    lastSeries = series;
    lastRangeMin = rangeMin;
    lastRangeMax = rangeMax;
    empty.hidden = true;
    canvas.hidden = false;
    renderLegend(series);
    renderStats(series);
    renderChart(series, rangeMin, rangeMax);
  };

  const updateBinDetail = (): void => {
    if (!selectedBin || lastSeries.length === 0) {
      binDetail.hidden = true;
      return;
    }
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
    selectedBin = {
      index,
      lower: lastRangeMin + width * index,
      upper: index === binCount - 1 ? lastRangeMax : lastRangeMin + width * (index + 1),
      includesUpper: index === binCount - 1,
    };
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

  const wireRefresh = (element: HTMLElement): void => {
    element.addEventListener('change', () => { void render(); });
  };
  wireRefresh(channelSelect);
  scopeSelect.addEventListener('change', () => { scope = scopeSelect.value === 'full' ? 'full' : 'range'; void render(); });
  metricSelect.addEventListener('change', () => { metric = metricSelect.value === 'percent' ? 'percent' : metricSelect.value === 'time' ? 'time' : 'count'; void render(); });
  binModeSelect.addEventListener('change', () => {
    binMode = binModeSelect.value === 'manual' ? 'manual' : 'auto';
    binCountInput.hidden = binMode !== 'manual';
    void render();
  });
  binCountInput.addEventListener('change', () => { void render(); });
  displaySelect.addEventListener('change', () => { display = displaySelect.value === 'cumulative' ? 'cumulative' : 'histogram'; void render(); });
  compareToggle.addEventListener('change', () => {
    compare = compareToggle.checked;
    compareControls.hidden = !compare;
    scopeSelect.disabled = compare;
    void render();
  });
  wireRefresh(rangeASelect);
  wireRefresh(rangeBSelect);
  refreshButton.addEventListener('click', () => { void render(); });

  new ResizeObserver(() => {
    if (!root.hidden && !canvas.hidden && lastSeries.length > 0) renderChart(lastSeries, lastRangeMin, lastRangeMax);
  }).observe(canvas);

  const setContext = (nextContext: HistogramPageContext): void => {
    const previousChannel = channelSelect.value;
    const channelsChanged = !sameChannelCatalog(context.channels, nextContext.channels);
    context = nextContext;
    if (channelsChanged) {
      channelSelect.replaceChildren();
      for (const channel of context.channels) channelSelect.add(new Option(channel.displayName || channel.sourceName, channel.id));
      if (previousChannel && context.channels.some((channel) => channel.id === previousChannel)) channelSelect.value = previousChannel;
    }
    refreshRangeSelectors();
    void render();
  };

  return { element: root, setContext, refresh: () => { void render(); } };
}
