import { buildNumericScatter, selectNumericScatterRegion, summarizeNumericScatterRegionRuns, type NumericScatterRegionSelection, type NumericScatterResult } from '../../../../core/analysis/scatter';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import type { HistogramPageContext, HistogramTraceContext } from './histogram-page';
import {
  histogramQualificationChannelIds,
  loadHistogramQualificationSets,
  populateHistogramQualificationSelect,
  qualifyHistogramSamples,
  selectedHistogramQualification,
} from './histogram-qualification';
import { createHistogramLocalId } from '../state/histogram-table-storage';
import { loadHistogramScatterPresets, saveHistogramScatterPresets, type HistogramScatterPresetState } from '../state/histogram-scatter-storage';

const MAX_RENDERED_POINTS = 28_000;

type ScatterLayout = 'single' | 'dual';
type ScatterTraceMode = 'dots' | 'lines';

interface ScatterPlotLayout {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly stride: number;
}

interface ScatterRegionState {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly selection: NumericScatterRegionSelection;
}

interface ScatterDragState {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  currentX: number;
  currentY: number;
}

interface ScatterPaneState {
  readonly root: HTMLElement;
  readonly xSelect: HTMLSelectElement;
  readonly ySelect: HTMLSelectElement;
  readonly canvas: HTMLCanvasElement;
  readonly title: HTMLElement;
  readonly status: HTMLElement;
  readonly pointDetail: HTMLElement;
  readonly pointLabel: HTMLElement;
  readonly pointOpenLogger: HTMLButtonElement;
  readonly pointClear: HTMLButtonElement;
  readonly regionDragOverlay: HTMLElement;
  readonly regionCard: HTMLElement;
  readonly regionCardCount: HTMLElement;
  readonly regionCardBounds: HTMLElement;
  readonly regionCardVisits: HTMLElement;
  readonly regionOpenLogger: HTMLButtonElement;
  readonly regionClear: HTMLButtonElement;
  result: NumericScatterResult | undefined;
  xTrace: HistogramTraceContext | undefined;
  yTrace: HistogramTraceContext | undefined;
  renderedPointCount: number;
  plotLayout: ScatterPlotLayout | undefined;
  selectedResultIndex: number | undefined;
  selectedRegion: ScatterRegionState | undefined;
  dragState: ScatterDragState | undefined;
  suppressNextClick: boolean;
}

interface DensityModel {
  readonly binsX: number;
  readonly binsY: number;
  readonly counts: Uint32Array;
  readonly maxHits: number;
  readonly heatCeiling: number;
}

interface ResolvedScatterScope {
  readonly label: string;
  readonly startMs?: number;
  readonly endMs?: number;
}

export interface ScatterViewController {
  readonly element: HTMLElement;
  setContext(context: HistogramPageContext): void;
  refresh(): void;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function formatNumber(value: number | undefined, precision = 3): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  return value.toFixed(precision).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function channelLabel(trace: HistogramTraceContext): string {
  return trace.channel.displayName || trace.channel.sourceName;
}

function axisLabel(trace: HistogramTraceContext): string {
  const label = channelLabel(trace);
  const unit = trace.channel.unit?.trim() ?? '';
  if (!unit) return label;
  const normalizedLabel = label.trim().toLocaleLowerCase();
  const normalizedUnit = unit.toLocaleLowerCase();
  if (normalizedLabel === normalizedUnit || normalizedLabel.endsWith(` ${normalizedUnit}`)) return label;
  return `${label} · ${unit}`;
}

function finiteTimeBounds(trace: HistogramTraceContext): { startMs: number; endMs: number } | undefined {
  const times = trace.range.timeMs;
  let startMs: number | undefined;
  let endMs: number | undefined;
  for (let index = 0; index < times.length; index += 1) {
    const value = times[index];
    if (value !== undefined && Number.isFinite(value)) { startMs = value; break; }
  }
  for (let index = times.length - 1; index >= 0; index -= 1) {
    const value = times[index];
    if (value !== undefined && Number.isFinite(value)) { endMs = value; break; }
  }
  return startMs === undefined || endMs === undefined ? undefined : { startMs, endMs };
}

function parseTimelineDuration(value: string): number | undefined {
  if (value === '—') return undefined;
  const match = /^(\d+):(\d{2})\.(\d{3})$/.exec(value.trim());
  if (!match) return undefined;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const milliseconds = Number(match[3]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || !Number.isFinite(milliseconds)) return undefined;
  return minutes * 60_000 + seconds * 1_000 + milliseconds;
}

function parseTimelineAB(text: string): { aOffsetMs: number | undefined; bOffsetMs: number | undefined } | undefined {
  const match = /A\s+(—|\d+:\d{2}\.\d{3})\s+·\s+B\s+(—|\d+:\d{2}\.\d{3})/.exec(text);
  if (!match) return undefined;
  return { aOffsetMs: parseTimelineDuration(match[1] ?? '—'), bOffsetMs: parseTimelineDuration(match[2] ?? '—') };
}

const HEAT_STOPS = [
  [0.00, [24, 73, 214]],
  [0.18, [0, 155, 255]],
  [0.38, [0, 224, 196]],
  [0.58, [55, 232, 82]],
  [0.76, [244, 239, 55]],
  [0.90, [255, 145, 35]],
  [1.00, [255, 46, 46]],
] as const;

function heatColor(ratio: number): string {
  const value = clamp01(ratio);
  for (let index = 1; index < HEAT_STOPS.length; index += 1) {
    const left = HEAT_STOPS[index - 1]!;
    const right = HEAT_STOPS[index]!;
    if (value > right[0]) continue;
    const span = Math.max(Number.EPSILON, right[0] - left[0]);
    const mix = (value - left[0]) / span;
    const red = Math.round(left[1][0] + (right[1][0] - left[1][0]) * mix);
    const green = Math.round(left[1][1] + (right[1][1] - left[1][1]) * mix);
    const blue = Math.round(left[1][2] + (right[1][2] - left[1][2]) * mix);
    return `rgb(${red} ${green} ${blue})`;
  }
  return 'rgb(255 46 46)';
}

function createPane(label: string): ScatterPaneState {
  const root = document.createElement('section');
  root.className = 'scatter-pane';
  root.innerHTML = `
    <div class="scatter-pane-toolbar">
      <span class="scatter-pane-label">${label}</span>
      <label><span>X Axis</span><select class="scatter-pane-x"></select></label>
      <label><span>Y Axis</span><select class="scatter-pane-y"></select></label>
      <span class="scatter-pane-select">Drag: region</span>
      <span class="scatter-pane-z">Heat <strong>Hits / cell</strong></span>
    </div>
    <div class="scatter-pane-stage">
      <canvas class="scatter-pane-chart" aria-label="Scatter plot"></canvas>
      <div class="scatter-region-drag" hidden></div>
      <div class="scatter-pane-title"></div>
      <aside class="scatter-region-card" hidden aria-live="polite">
        <strong>Region evidence</strong>
        <div class="scatter-region-card-count">—</div>
        <div class="scatter-region-card-bounds">—</div>
        <div class="scatter-region-card-visits">—</div>
        <div class="scatter-region-card-actions">
          <button type="button" class="scatter-region-open-logger">Open strongest visit in Logger</button>
          <button type="button" class="scatter-region-clear">Clear</button>
        </div>
      </aside>
    </div>
    <div class="scatter-pane-status"></div>
    <div class="scatter-point-detail" hidden>
      <span class="scatter-point-label">—</span>
      <button type="button" class="scatter-point-open-logger" disabled>Open point in Logger</button>
      <button type="button" class="scatter-point-clear">Clear selection</button>
    </div>
  `;
  const xSelect = root.querySelector<HTMLSelectElement>('.scatter-pane-x');
  const ySelect = root.querySelector<HTMLSelectElement>('.scatter-pane-y');
  const canvas = root.querySelector<HTMLCanvasElement>('.scatter-pane-chart');
  const title = root.querySelector<HTMLElement>('.scatter-pane-title');
  const status = root.querySelector<HTMLElement>('.scatter-pane-status');
  const pointDetail = root.querySelector<HTMLElement>('.scatter-point-detail');
  const pointLabel = root.querySelector<HTMLElement>('.scatter-point-label');
  const pointOpenLogger = root.querySelector<HTMLButtonElement>('.scatter-point-open-logger');
  const pointClear = root.querySelector<HTMLButtonElement>('.scatter-point-clear');
  const regionDragOverlay = root.querySelector<HTMLElement>('.scatter-region-drag');
  const regionCard = root.querySelector<HTMLElement>('.scatter-region-card');
  const regionCardCount = root.querySelector<HTMLElement>('.scatter-region-card-count');
  const regionCardBounds = root.querySelector<HTMLElement>('.scatter-region-card-bounds');
  const regionCardVisits = root.querySelector<HTMLElement>('.scatter-region-card-visits');
  const regionOpenLogger = root.querySelector<HTMLButtonElement>('.scatter-region-open-logger');
  const regionClear = root.querySelector<HTMLButtonElement>('.scatter-region-clear');
  if (!xSelect || !ySelect || !canvas || !title || !status || !pointDetail || !pointLabel || !pointOpenLogger || !pointClear || !regionDragOverlay || !regionCard || !regionCardCount || !regionCardBounds || !regionCardVisits || !regionOpenLogger || !regionClear) {
    throw new Error('Scatter pane structure is incomplete.');
  }
  return {
    root, xSelect, ySelect, canvas, title, status, pointDetail, pointLabel, pointOpenLogger, pointClear, regionDragOverlay,
    regionCard, regionCardCount, regionCardBounds, regionCardVisits, regionOpenLogger, regionClear,
    result: undefined, xTrace: undefined, yTrace: undefined, renderedPointCount: 0, plotLayout: undefined, selectedResultIndex: undefined,
    selectedRegion: undefined, dragState: undefined, suppressNextClick: false,
  };
}

function createDensityModel(
  result: NumericScatterResult,
  xMin: number,
  xSpan: number,
  yMin: number,
  ySpan: number,
  chartWidth: number,
  chartHeight: number,
): DensityModel {
  const binsX = Math.max(36, Math.min(112, Math.round(chartWidth / 9)));
  const binsY = Math.max(24, Math.min(78, Math.round(chartHeight / 9)));
  const counts = new Uint32Array(binsX * binsY);
  let maxHits = 1;
  for (let index = 0; index < result.validPairSampleCount; index += 1) {
    const xValue = result.xValues[index];
    const yValue = result.yValues[index];
    if (xValue === undefined || yValue === undefined || !Number.isFinite(xValue) || !Number.isFinite(yValue)) continue;
    const xNorm = clamp01((xValue - xMin) / xSpan);
    const yNorm = clamp01((yValue - yMin) / ySpan);
    const bx = Math.min(binsX - 1, Math.floor(xNorm * binsX));
    const by = Math.min(binsY - 1, Math.floor(yNorm * binsY));
    const cell = by * binsX + bx;
    const next = (counts[cell] ?? 0) + 1;
    counts[cell] = next;
    maxHits = Math.max(maxHits, next);
  }
  const occupied: number[] = [];
  for (const count of counts) if (count > 0) occupied.push(count);
  occupied.sort((left, right) => left - right);
  const percentileIndex = Math.max(0, Math.min(occupied.length - 1, Math.floor((occupied.length - 1) * 0.94)));
  const percentile = occupied[percentileIndex] ?? maxHits;
  const heatCeiling = Math.max(2, Math.min(maxHits, percentile));
  return { binsX, binsY, counts, maxHits, heatCeiling };
}

function densityRatio(model: DensityModel, xNorm: number, yNorm: number): number {
  const bx = Math.min(model.binsX - 1, Math.floor(clamp01(xNorm) * model.binsX));
  const by = Math.min(model.binsY - 1, Math.floor(clamp01(yNorm) * model.binsY));
  const hits = model.counts[by * model.binsX + bx] ?? 1;
  const normalized = Math.log1p(Math.min(hits, model.heatCeiling)) / Math.log1p(model.heatCeiling);
  return Math.pow(clamp01(normalized), 0.72);
}

function drawHeatLegend(ctx: CanvasRenderingContext2D, x: number, y: number, height: number, model: DensityModel): void {
  const gradient = ctx.createLinearGradient(0, y + height, 0, y);
  for (const [stop] of HEAT_STOPS) gradient.addColorStop(stop, heatColor(stop));
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, 9, height);
  ctx.strokeStyle = 'rgba(205, 222, 231, .55)';
  ctx.strokeRect(x + 0.5, y + 0.5, 8, Math.max(1, height - 1));
  ctx.fillStyle = '#9eb0ba';
  ctx.font = '8px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Hits', x - 1, y - 9);
  ctx.fillText(`≥${model.heatCeiling}`, x + 13, y + 3);
  ctx.fillText('1', x + 13, y + height - 3);
  if (model.maxHits > model.heatCeiling) {
    ctx.fillStyle = '#d5e0e6';
    ctx.fillText(`max ${model.maxHits}`, x - 2, y + height + 11);
  }
}

function sameChannelCatalog(left: HistogramPageContext['channels'], right: HistogramPageContext['channels']): boolean {
  return left.length === right.length && left.every((channel, index) => channel === right[index]);
}

export function createScatterView(): ScatterViewController {
  let context: HistogramPageContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined };
  let layout: ScatterLayout = 'single';
  let traceMode: ScatterTraceMode = 'dots';
  let renderGeneration = 0;
  let analysisA = context.aTimeMs;
  let analysisB = context.bTimeMs;
  let fullStartMs: number | undefined;
  let fullEndMs: number | undefined;
  let qualificationSets = loadHistogramQualificationSets();
  let scatterPresets = loadHistogramScatterPresets();

  const root = document.createElement('section');
  root.className = 'scatter-view scatter-view--mlv';
  root.hidden = true;
  root.innerHTML = `
    <div class="scatter-controls scatter-controls--mlv">
      <label><span>Scope</span><select class="scatter-scope"></select></label>
      <label><span>Qualification</span><select class="scatter-qualification"><option value="">None</option></select></label>
      <label><span>View</span><select class="scatter-layout"><option value="single">Single</option><option value="dual">Dual</option></select></label>
      <label><span>Trace</span><select class="scatter-trace-mode"><option value="dots">Dots</option><option value="lines">Lines</option></select></label>
      <details class="scatter-presets">
        <summary title="Saved Scatter setups">Presets</summary>
        <div class="scatter-preset-popover">
          <select class="scatter-preset-select" aria-label="Saved Scatter setup"></select>
          <div class="scatter-preset-actions"><button type="button" class="scatter-preset-apply">Apply</button><button type="button" class="scatter-preset-save">Save setup…</button><button type="button" class="scatter-preset-delete">Delete</button></div>
          <small>Saved setups retain scope, Qualification, layout, trace mode and both panes' X/Y channels.</small>
        </div>
      </details>
      <span class="scatter-scope-note"></span>
    </div>
    <div class="scatter-empty">
      <strong>Scatter needs two available numeric channels.</strong>
      <span>Choose Full Log, Current A/B, or a Saved Range.</span>
    </div>
    <div class="scatter-content scatter-content--mlv" hidden>
      <div class="scatter-panes"></div>
    </div>
    <div class="scatter-shared-timeline-slot" aria-label="Analysis timeline"></div>
  `;

  const scopeSelect = root.querySelector<HTMLSelectElement>('.scatter-scope');
  const qualificationSelect = root.querySelector<HTMLSelectElement>('.scatter-qualification');
  const layoutSelect = root.querySelector<HTMLSelectElement>('.scatter-layout');
  const traceModeSelect = root.querySelector<HTMLSelectElement>('.scatter-trace-mode');
  const presetSelect = root.querySelector<HTMLSelectElement>('.scatter-preset-select');
  const presetApply = root.querySelector<HTMLButtonElement>('.scatter-preset-apply');
  const presetSave = root.querySelector<HTMLButtonElement>('.scatter-preset-save');
  const presetDelete = root.querySelector<HTMLButtonElement>('.scatter-preset-delete');
  const scopeNote = root.querySelector<HTMLElement>('.scatter-scope-note');
  const empty = root.querySelector<HTMLElement>('.scatter-empty');
  const content = root.querySelector<HTMLElement>('.scatter-content');
  const paneHost = root.querySelector<HTMLElement>('.scatter-panes');
  if (!scopeSelect || !qualificationSelect || !layoutSelect || !traceModeSelect || !presetSelect || !presetApply || !presetSave || !presetDelete || !scopeNote || !empty || !content || !paneHost) {
    throw new Error('Scatter view structure is incomplete.');
  }

  const panes: ScatterPaneState[] = [createPane('A'), createPane('B')];
  paneHost.append(panes[0]!.root, panes[1]!.root);

  const populatePresetSelect = (preferredId = ''): void => {
    presetSelect.replaceChildren(new Option(scatterPresets.length > 0 ? 'Select saved setup…' : 'No saved setups', ''));
    for (const preset of scatterPresets) presetSelect.add(new Option(preset.name, preset.id));
    presetSelect.value = preferredId && scatterPresets.some((preset) => preset.id === preferredId) ? preferredId : '';
    presetApply.disabled = !presetSelect.value;
    presetDelete.disabled = !presetSelect.value;
  };

  const currentPresetState = (id: string, name: string): HistogramScatterPresetState => ({
    id, name, scope: scopeSelect.value, qualificationId: qualificationSelect.value, layout, traceMode,
    paneAXChannelId: panes[0]!.xSelect.value, paneAYChannelId: panes[0]!.ySelect.value,
    paneBXChannelId: panes[1]!.xSelect.value, paneBYChannelId: panes[1]!.ySelect.value,
  });

  const setSelectIfAvailable = (select: HTMLSelectElement, value: string): void => {
    if ([...select.options].some((option) => option.value === value && !option.disabled)) select.value = value;
  };

  const hasValidRange = (): boolean => analysisA !== undefined && analysisB !== undefined && analysisA !== analysisB;

  const populateScopeOptions = (): void => {
    const previous = scopeSelect.value;
    scopeSelect.replaceChildren(new Option('Full Log', 'full'), new Option('Current A/B', 'ab'));
    for (const [index, saved] of (context.savedRanges ?? []).entries()) {
      const seconds = Math.abs(saved.endMs - saved.startMs) / 1000;
      scopeSelect.add(new Option(`${saved.label || `Range ${index + 1}`} · ${seconds.toFixed(seconds >= 10 ? 1 : 3)} s`, `saved:${index}`));
    }
    const abOption = [...scopeSelect.options].find((option) => option.value === 'ab');
    if (abOption) abOption.disabled = !hasValidRange();
    if (previous && [...scopeSelect.options].some((option) => option.value === previous && !option.disabled)) scopeSelect.value = previous;
    else scopeSelect.value = hasValidRange() ? 'ab' : 'full';
  };

  const resolveScope = (): ResolvedScatterScope | undefined => {
    const value = scopeSelect.value;
    if (value === 'full') return { label: 'Full Log' };
    if (value === 'ab') {
      if (!hasValidRange()) return undefined;
      return { label: 'Current A/B', startMs: Math.min(analysisA!, analysisB!), endMs: Math.max(analysisA!, analysisB!) };
    }
    if (value.startsWith('saved:')) {
      const index = Number(value.slice(6));
      const saved = context.savedRanges?.[index];
      if (!saved) return undefined;
      return { label: saved.label || `Saved Range ${index + 1}`, startMs: Math.min(saved.startMs, saved.endMs), endMs: Math.max(saved.startMs, saved.endMs) };
    }
    return undefined;
  };

  const fillSelect = (select: HTMLSelectElement, preferred: string, fallbackIndex: number): void => {
    select.replaceChildren();
    for (const channel of context.channels) select.add(new Option(channel.displayName || channel.sourceName, channel.id));
    if (context.channels.some((channel) => channel.id === preferred)) select.value = preferred;
    else if (context.channels[fallbackIndex]) select.value = context.channels[fallbackIndex]!.id;
  };

  const syncLayout = (): void => {
    panes[1]!.root.hidden = layout !== 'dual';
    paneHost.classList.toggle('scatter-panes--dual', layout === 'dual');
  };

  const configureCanvas = (canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; width: number; height: number } | undefined => {
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

  const renderPane = (pane: ScatterPaneState, result: NumericScatterResult, xTrace: HistogramTraceContext, yTrace: HistogramTraceContext): void => {
    const configured = configureCanvas(pane.canvas);
    if (!configured) return;
    const { ctx, width, height } = configured;
    const padLeft = 62;
    const padRight = 68;
    const padTop = 35;
    const padBottom = 42;
    const chartWidth = Math.max(1, width - padLeft - padRight);
    const chartHeight = Math.max(1, height - padTop - padBottom);

    ctx.fillStyle = '#020507';
    ctx.fillRect(padLeft, padTop, chartWidth, chartHeight);
    ctx.strokeStyle = 'rgba(128, 145, 154, .72)';
    ctx.lineWidth = 1;
    ctx.strokeRect(padLeft + 0.5, padTop + 0.5, Math.max(1, chartWidth - 1), Math.max(1, chartHeight - 1));

    pane.title.textContent = `${channelLabel(yTrace)} vs ${channelLabel(xTrace)} · Heat: Hits`;
    if (result.validPairSampleCount === 0 || result.xMin === undefined || result.xMax === undefined || result.yMin === undefined || result.yMax === undefined) {
      pane.renderedPointCount = 0;
      pane.plotLayout = undefined;
      pane.status.textContent = 'No valid paired samples';
      return;
    }

    const xMin = result.xMin;
    const xMax = result.xMax;
    const yMin = result.yMin;
    const yMax = result.yMax;
    const xSpan = Math.max(Number.EPSILON, xMax - xMin);
    const ySpan = Math.max(Number.EPSILON, yMax - yMin);
    const stride = Math.max(1, Math.ceil(result.validPairSampleCount / MAX_RENDERED_POINTS));
    pane.renderedPointCount = Math.ceil(result.validPairSampleCount / stride);
    pane.plotLayout = { left: padLeft, top: padTop, width: chartWidth, height: chartHeight, xMin, xMax, yMin, yMax, stride };
    const density = createDensityModel(result, xMin, xSpan, yMin, ySpan, chartWidth, chartHeight);

    ctx.strokeStyle = 'rgba(50, 76, 91, .68)';
    ctx.setLineDash([2, 5]);
    for (let index = 1; index < 4; index += 1) {
      const gx = padLeft + (chartWidth * index) / 4;
      const gy = padTop + (chartHeight * index) / 4;
      ctx.beginPath(); ctx.moveTo(gx, padTop); ctx.lineTo(gx, padTop + chartHeight); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(padLeft, gy); ctx.lineTo(padLeft + chartWidth, gy); ctx.stroke();
    }
    ctx.setLineDash([]);

    if (traceMode === 'lines') {
      let previousX: number | undefined;
      let previousY: number | undefined;
      let previousSampleIndex: number | undefined;
      for (let index = 0; index < result.validPairSampleCount; index += stride) {
        const xValue = result.xValues[index];
        const yValue = result.yValues[index];
        const sampleIndex = result.sampleIndices[index];
        if (xValue === undefined || yValue === undefined || sampleIndex === undefined || !Number.isFinite(xValue) || !Number.isFinite(yValue)) {
          previousX = undefined; previousY = undefined; previousSampleIndex = undefined; continue;
        }
        const xNorm = clamp01((xValue - xMin) / xSpan);
        const yNorm = clamp01((yValue - yMin) / ySpan);
        const x = padLeft + xNorm * chartWidth;
        const y = padTop + chartHeight - yNorm * chartHeight;
        const discontinuity = previousSampleIndex !== undefined && sampleIndex - previousSampleIndex > stride * 4;
        if (!discontinuity && previousX !== undefined && previousY !== undefined) {
          const ratio = densityRatio(density, xNorm, yNorm);
          ctx.strokeStyle = heatColor(ratio);
          ctx.globalAlpha = 0.46 + ratio * 0.5;
          ctx.lineWidth = 0.85 + ratio * 1.15;
          ctx.beginPath(); ctx.moveTo(previousX, previousY); ctx.lineTo(x, y); ctx.stroke();
        }
        previousX = x; previousY = y; previousSampleIndex = sampleIndex;
      }
      ctx.globalAlpha = 1;
    } else {
      for (let index = 0; index < result.validPairSampleCount; index += stride) {
        const xValue = result.xValues[index];
        const yValue = result.yValues[index];
        if (xValue === undefined || yValue === undefined || !Number.isFinite(xValue) || !Number.isFinite(yValue)) continue;
        const xNorm = clamp01((xValue - xMin) / xSpan);
        const yNorm = clamp01((yValue - yMin) / ySpan);
        const ratio = densityRatio(density, xNorm, yNorm);
        const x = padLeft + xNorm * chartWidth;
        const y = padTop + chartHeight - yNorm * chartHeight;
        const size = 1.2 + ratio * 2.3;
        ctx.fillStyle = heatColor(ratio);
        ctx.globalAlpha = 0.58 + ratio * 0.4;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    }

    if (pane.selectedResultIndex !== undefined) {
      const xValue = result.xValues[pane.selectedResultIndex];
      const yValue = result.yValues[pane.selectedResultIndex];
      if (xValue !== undefined && yValue !== undefined) {
        const x = padLeft + clamp01((xValue - xMin) / xSpan) * chartWidth;
        const y = padTop + chartHeight - clamp01((yValue - yMin) / ySpan) * chartHeight;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke();
      }
    }

    if (pane.selectedRegion) {
      const left = padLeft + clamp01((pane.selectedRegion.xMin - xMin) / xSpan) * chartWidth;
      const right = padLeft + clamp01((pane.selectedRegion.xMax - xMin) / xSpan) * chartWidth;
      const top = padTop + chartHeight - clamp01((pane.selectedRegion.yMax - yMin) / ySpan) * chartHeight;
      const bottom = padTop + chartHeight - clamp01((pane.selectedRegion.yMin - yMin) / ySpan) * chartHeight;
      ctx.fillStyle = 'rgba(139, 200, 237, .10)';
      ctx.fillRect(left, top, Math.max(1, right - left), Math.max(1, bottom - top));
      ctx.strokeStyle = '#8bc8ed';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(left + 0.5, top + 0.5, Math.max(1, right - left - 1), Math.max(1, bottom - top - 1));
      ctx.setLineDash([]);
    }

    const legendHeight = Math.max(80, Math.min(190, chartHeight * 0.62));
    drawHeatLegend(ctx, padLeft + chartWidth + 16, padTop + (chartHeight - legendHeight) / 2, legendHeight, density);

    ctx.fillStyle = '#8ca1ad';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left'; ctx.fillText(formatNumber(xMin), padLeft, padTop + chartHeight + 7);
    ctx.textAlign = 'right'; ctx.fillText(formatNumber(xMax), padLeft + chartWidth, padTop + chartHeight + 7);
    ctx.textAlign = 'center'; ctx.fillText(axisLabel(xTrace), padLeft + chartWidth / 2, padTop + chartHeight + 24);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right'; ctx.fillText(formatNumber(yMax), padLeft - 8, padTop + 4); ctx.fillText(formatNumber(yMin), padLeft - 8, padTop + chartHeight - 4);
    ctx.save(); ctx.translate(15, padTop + chartHeight / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText(axisLabel(yTrace), 0, 0); ctx.restore();

    pane.status.textContent = `${result.validPairSampleCount.toLocaleString()} pairs · ${pane.renderedPointCount.toLocaleString()} rendered · density uses all pairs · heat ≥${density.heatCeiling} / max ${density.maxHits} hits per cell`;
  };

  const ensureFullTimeBounds = async (): Promise<void> => {
    if (fullStartMs !== undefined && fullEndMs !== undefined) return;
    const channelId = panes[0]!.xSelect.value || context.channels[0]?.id;
    if (!channelId) return;
    const [trace] = await context.loadTraces([channelId]);
    if (!trace) return;
    const bounds = finiteTimeBounds(trace);
    if (!bounds) return;
    fullStartMs = bounds.startMs;
    fullEndMs = bounds.endMs;
  };

  const syncRangeFromSharedTimeline = async (): Promise<void> => {
    if (scopeSelect.value !== 'ab') return;
    const abText = document.querySelector<HTMLElement>('.timeline-shell .timeline-ab-value')?.textContent ?? '';
    const parsed = parseTimelineAB(abText);
    if (!parsed) return;
    await ensureFullTimeBounds();
    if (fullStartMs === undefined) return;
    analysisA = parsed.aOffsetMs === undefined ? undefined : fullStartMs + parsed.aOffsetMs;
    analysisB = parsed.bOffsetMs === undefined ? undefined : fullStartMs + parsed.bOffsetMs;
    populateScopeOptions();
    if (!root.hidden) await render();
  };

  const render = async (): Promise<void> => {
    const generation = ++renderGeneration;
    const visiblePanes = layout === 'dual' ? panes : [panes[0]!];
    const resolvedScope = resolveScope();
    if (context.channels.length < 2 || !resolvedScope) {
      for (const pane of panes) {
        pane.result = undefined; pane.xTrace = undefined; pane.yTrace = undefined; pane.plotLayout = undefined; pane.selectedResultIndex = undefined; pane.selectedRegion = undefined; pane.dragState = undefined; pane.regionDragOverlay.hidden = true; pane.regionCard.hidden = true; pane.pointDetail.hidden = true;
      }
      empty.hidden = false;
      content.hidden = true;
      scopeNote.textContent = scopeSelect.value === 'ab' && !hasValidRange() ? 'Set A and B in the timeline below.' : '';
      return;
    }

    const filterSet = selectedHistogramQualification(qualificationSelect, qualificationSets);
    const filterChannelIds = histogramQualificationChannelIds(filterSet);
    empty.hidden = true;
    content.hidden = false;
    syncLayout();
    scopeNote.textContent = resolvedScope.startMs !== undefined && resolvedScope.endMs !== undefined
      ? `${resolvedScope.label} · ${((resolvedScope.endMs - resolvedScope.startMs) / 1000).toFixed(3)} s${filterSet ? ` · ${filterSet.name}` : ''}`
      : `${resolvedScope.label}${filterSet ? ` · ${filterSet.name}` : ''}`;

    await Promise.all(visiblePanes.map(async (pane) => {
      const xId = pane.xSelect.value;
      const yId = pane.ySelect.value;
      pane.result = undefined;
      pane.xTrace = undefined;
      pane.yTrace = undefined;
      pane.renderedPointCount = 0;
      pane.plotLayout = undefined;
      pane.selectedResultIndex = undefined;
      pane.selectedRegion = undefined;
      pane.dragState = undefined;
      pane.regionDragOverlay.hidden = true;
      pane.regionCard.hidden = true;
      pane.pointDetail.hidden = true;
      pane.canvas.getContext('2d')?.clearRect(0, 0, pane.canvas.width, pane.canvas.height);
      if (!xId || !yId) { pane.status.textContent = 'Select X and Y channels.'; return; }

      const requestedIds = [...new Set([xId, yId, ...filterChannelIds])];
      let loaded: Awaited<ReturnType<HistogramPageContext['loadTraces']>>;
      try {
        loaded = await context.loadTraces(requestedIds, resolvedScope.startMs, resolvedScope.endMs);
      } catch (error) {
        if (generation !== renderGeneration) return;
        pane.status.textContent = error instanceof Error ? `Unable to load selected channels: ${error.message}` : 'Unable to load selected channels.';
        return;
      }
      if (generation !== renderGeneration) return;
      const byId = new Map(loaded.map((trace) => [trace.channel.id, trace]));
      const xTrace = byId.get(xId);
      const yTrace = byId.get(yId);
      if (!xTrace || !yTrace) { pane.status.textContent = 'Selected channel data is unavailable.'; return; }

      const qualification = qualifyHistogramSamples(xTrace, loaded, filterSet, resolvedScope.startMs, resolvedScope.endMs);
      if (!qualification) {
        pane.status.textContent = 'Selected qualification references unavailable channels.';
        return;
      }

      const result = buildNumericScatter(xTrace.range, yTrace.range, { sampleIndices: qualification.eligibleSampleIndices });
      const yComplete = resolvedScope.startMs !== undefined && resolvedScope.endMs !== undefined
        ? yTrace.complete || numericRangeCoversTime(yTrace.range, resolvedScope.startMs, resolvedScope.endMs)
        : yTrace.complete;
      const complete = qualification.complete && yComplete && result.unavailableSampleCount === 0;

      pane.result = result;
      pane.xTrace = xTrace;
      pane.yTrace = yTrace;
      renderPane(pane, result, xTrace, yTrace);
      pane.status.textContent += ` · eligible ${qualification.eligibleSampleCount.toLocaleString()} / ${qualification.inputSampleCount.toLocaleString()}`;
      if (qualification.rejectedSampleCount > 0) pane.status.textContent += ` · rejected ${qualification.rejectedSampleCount.toLocaleString()}`;
      pane.status.textContent += complete ? ' · complete' : ' · partial decoded';
    }));
  };

  const refreshCanvasOnly = (): void => {
    for (const pane of panes) if (pane.result && pane.xTrace && pane.yTrace && !pane.root.hidden) renderPane(pane, pane.result, pane.xTrace, pane.yTrace);
  };

  const nearestRenderedPoint = (pane: ScatterPaneState, event: MouseEvent): number | undefined => {
    const result = pane.result;
    const plot = pane.plotLayout;
    if (!result || !plot) return undefined;
    const rect = pane.canvas.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    if (px < plot.left || px > plot.left + plot.width || py < plot.top || py > plot.top + plot.height) return undefined;
    const xSpan = Math.max(Number.EPSILON, plot.xMax - plot.xMin);
    const ySpan = Math.max(Number.EPSILON, plot.yMax - plot.yMin);
    let bestIndex: number | undefined;
    let bestDistanceSq = 10 * 10;
    for (let index = 0; index < result.validPairSampleCount; index += plot.stride) {
      const xValue = result.xValues[index];
      const yValue = result.yValues[index];
      if (xValue === undefined || yValue === undefined) continue;
      const x = plot.left + clamp01((xValue - plot.xMin) / xSpan) * plot.width;
      const y = plot.top + plot.height - clamp01((yValue - plot.yMin) / ySpan) * plot.height;
      const distanceSq = (x - px) ** 2 + (y - py) ** 2;
      if (distanceSq <= bestDistanceSq) { bestDistanceSq = distanceSq; bestIndex = index; }
    }
    return bestIndex;
  };

  const canvasPoint = (pane: ScatterPaneState, event: PointerEvent | MouseEvent): { x: number; y: number } => {
    const rect = pane.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const clampToPlot = (value: number, start: number, length: number): number => Math.max(start, Math.min(start + length, value));

  const regionBoundsFromPixels = (pane: ScatterPaneState, x1: number, y1: number, x2: number, y2: number): Omit<ScatterRegionState, 'selection'> | undefined => {
    const plot = pane.plotLayout;
    if (!plot) return undefined;
    const left = clampToPlot(Math.min(x1, x2), plot.left, plot.width);
    const right = clampToPlot(Math.max(x1, x2), plot.left, plot.width);
    const top = clampToPlot(Math.min(y1, y2), plot.top, plot.height);
    const bottom = clampToPlot(Math.max(y1, y2), plot.top, plot.height);
    const xSpan = Math.max(Number.EPSILON, plot.xMax - plot.xMin);
    const ySpan = Math.max(Number.EPSILON, plot.yMax - plot.yMin);
    return {
      xMin: plot.xMin + ((left - plot.left) / plot.width) * xSpan,
      xMax: plot.xMin + ((right - plot.left) / plot.width) * xSpan,
      yMin: plot.yMax - ((bottom - plot.top) / plot.height) * ySpan,
      yMax: plot.yMax - ((top - plot.top) / plot.height) * ySpan,
    };
  };

  const updateDragOverlay = (pane: ScatterPaneState): void => {
    const drag = pane.dragState;
    const plot = pane.plotLayout;
    if (!drag || !plot) { pane.regionDragOverlay.hidden = true; return; }
    const left = clampToPlot(Math.min(drag.startX, drag.currentX), plot.left, plot.width);
    const right = clampToPlot(Math.max(drag.startX, drag.currentX), plot.left, plot.width);
    const top = clampToPlot(Math.min(drag.startY, drag.currentY), plot.top, plot.height);
    const bottom = clampToPlot(Math.max(drag.startY, drag.currentY), plot.top, plot.height);
    pane.regionDragOverlay.style.left = `${left}px`;
    pane.regionDragOverlay.style.top = `${top}px`;
    pane.regionDragOverlay.style.width = `${Math.max(1, right - left)}px`;
    pane.regionDragOverlay.style.height = `${Math.max(1, bottom - top)}px`;
    pane.regionDragOverlay.hidden = false;
  };

  const sampleTime = (trace: HistogramTraceContext, sampleIndex: number): number | undefined => {
    const localIndex = sampleIndex - trace.range.startSampleIndex;
    const time = localIndex >= 0 && localIndex < trace.range.timeMs.length ? trace.range.timeMs[localIndex] : undefined;
    return time !== undefined && Number.isFinite(time) ? time : undefined;
  };

  const updateSelectionDetail = (pane: ScatterPaneState): void => {
    const result = pane.result;
    const xTrace = pane.xTrace;
    const yTrace = pane.yTrace;
    if (!result || !xTrace || !yTrace) { pane.regionCard.hidden = true; pane.pointDetail.hidden = true; return; }

    if (pane.selectedRegion) {
      const region = pane.selectedRegion;
      const visits = summarizeNumericScatterRegionRuns(region.selection);
      const strongest = visits.strongestRun;
      const firstTime = strongest ? sampleTime(xTrace, strongest.startSampleIndex) : undefined;
      const lastTime = strongest ? sampleTime(xTrace, strongest.endSampleIndex) : undefined;
      const duration = firstTime !== undefined && lastTime !== undefined ? Math.max(0, lastTime - firstTime) : undefined;
      const share = result.validPairSampleCount > 0 ? (region.selection.selectedPairCount / result.validPairSampleCount) * 100 : 0;
      pane.regionCardCount.textContent = `${region.selection.selectedPairCount.toLocaleString()} of ${result.validPairSampleCount.toLocaleString()} pairs · ${share.toFixed(1)}%`;
      pane.regionCardBounds.textContent = `${channelLabel(xTrace)} ${formatNumber(region.xMin)}–${formatNumber(region.xMax)}${xTrace.channel.unit ? ` ${xTrace.channel.unit}` : ''} · ${channelLabel(yTrace)} ${formatNumber(region.yMin)}–${formatNumber(region.yMax)}${yTrace.channel.unit ? ` ${yTrace.channel.unit}` : ''}`;
      pane.regionCardVisits.textContent = `${visits.runCount.toLocaleString()} contiguous visit${visits.runCount === 1 ? '' : 's'}${strongest ? ` · strongest ${strongest.sampleCount.toLocaleString()} samples${duration !== undefined ? ` · ${(duration / 1000).toFixed(duration >= 1000 ? 2 : 3)} s` : ''}` : ''}`;
      pane.regionOpenLogger.disabled = !context.openSamplesInLogger || !strongest;
      pane.regionCard.hidden = false;
      pane.pointDetail.hidden = true;
      return;
    }

    pane.regionCard.hidden = true;
    const index = pane.selectedResultIndex;
    if (index === undefined) { pane.pointDetail.hidden = true; return; }
    const sampleIndex = result.sampleIndices[index];
    const xValue = result.xValues[index];
    const yValue = result.yValues[index];
    if (sampleIndex === undefined || xValue === undefined || yValue === undefined) { pane.pointDetail.hidden = true; return; }
    const localIndex = sampleIndex - xTrace.range.startSampleIndex;
    const time = localIndex >= 0 && localIndex < xTrace.range.timeMs.length ? xTrace.range.timeMs[localIndex] : undefined;
    pane.pointLabel.textContent = `${channelLabel(xTrace)} ${formatNumber(xValue)} · ${channelLabel(yTrace)} ${formatNumber(yValue)} · #${sampleIndex.toLocaleString()}${time !== undefined ? ` · ${(time / 1000).toFixed(3)} s` : ''}`;
    pane.pointOpenLogger.textContent = 'Open point in Logger';
    pane.pointOpenLogger.disabled = !context.openSamplesInLogger || time === undefined;
    pane.pointDetail.hidden = false;
  };

  for (const pane of panes) {
    pane.xSelect.addEventListener('change', () => { if (pane === panes[0]) { fullStartMs = undefined; fullEndMs = undefined; } void render(); });
    pane.ySelect.addEventListener('change', () => { void render(); });

    pane.canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !pane.plotLayout || !pane.result) return;
      const point = canvasPoint(pane, event);
      const plot = pane.plotLayout;
      if (point.x < plot.left || point.x > plot.left + plot.width || point.y < plot.top || point.y > plot.top + plot.height) return;
      pane.dragState = { pointerId: event.pointerId, startX: point.x, startY: point.y, currentX: point.x, currentY: point.y };
      pane.suppressNextClick = false;
      pane.canvas.setPointerCapture(event.pointerId);
    });
    pane.canvas.addEventListener('pointermove', (event) => {
      const drag = pane.dragState;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const point = canvasPoint(pane, event);
      drag.currentX = point.x;
      drag.currentY = point.y;
      if (Math.hypot(drag.currentX - drag.startX, drag.currentY - drag.startY) >= 4) updateDragOverlay(pane);
    });
    const finishRegionDrag = (event: PointerEvent): void => {
      const drag = pane.dragState;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const point = canvasPoint(pane, event);
      drag.currentX = point.x;
      drag.currentY = point.y;
      pane.dragState = undefined;
      pane.regionDragOverlay.hidden = true;
      if (pane.canvas.hasPointerCapture(event.pointerId)) pane.canvas.releasePointerCapture(event.pointerId);
      if (Math.hypot(drag.currentX - drag.startX, drag.currentY - drag.startY) < 6) return;
      const result = pane.result;
      const bounds = regionBoundsFromPixels(pane, drag.startX, drag.startY, drag.currentX, drag.currentY);
      if (!result || !bounds) return;
      pane.suppressNextClick = true;
      pane.selectedResultIndex = undefined;
      pane.selectedRegion = { ...bounds, selection: selectNumericScatterRegion(result, bounds) };
      updateSelectionDetail(pane);
      if (pane.xTrace && pane.yTrace) renderPane(pane, result, pane.xTrace, pane.yTrace);
    };
    pane.canvas.addEventListener('pointerup', finishRegionDrag);
    pane.canvas.addEventListener('pointercancel', (event) => {
      const drag = pane.dragState;
      if (!drag || drag.pointerId !== event.pointerId) return;
      pane.dragState = undefined;
      pane.regionDragOverlay.hidden = true;
    });
    pane.canvas.addEventListener('click', (event) => {
      if (pane.suppressNextClick) { pane.suppressNextClick = false; return; }
      const index = nearestRenderedPoint(pane, event);
      if (index === undefined) return;
      pane.selectedRegion = undefined;
      pane.regionCard.hidden = true;
      pane.selectedResultIndex = index;
      updateSelectionDetail(pane);
      if (pane.result && pane.xTrace && pane.yTrace) renderPane(pane, pane.result, pane.xTrace, pane.yTrace);
    });
    pane.pointClear.addEventListener('click', () => {
      pane.selectedResultIndex = undefined;
      pane.selectedRegion = undefined;
      pane.regionCard.hidden = true;
      pane.pointDetail.hidden = true;
      if (pane.result && pane.xTrace && pane.yTrace) renderPane(pane, pane.result, pane.xTrace, pane.yTrace);
    });
    pane.regionClear.addEventListener('click', () => {
      pane.selectedRegion = undefined;
      pane.regionCard.hidden = true;
      if (pane.result && pane.xTrace && pane.yTrace) renderPane(pane, pane.result, pane.xTrace, pane.yTrace);
    });
    pane.regionOpenLogger.addEventListener('click', () => {
      const region = pane.selectedRegion;
      const xTrace = pane.xTrace;
      const yTrace = pane.yTrace;
      if (!region || !xTrace || !yTrace || !context.openSamplesInLogger) return;
      const strongest = summarizeNumericScatterRegionRuns(region.selection).strongestRun;
      if (!strongest) return;
      const sampleIndices: number[] = [];
      const timeMs: number[] = [];
      for (const sampleIndex of region.selection.sampleIndices) {
        if (sampleIndex < strongest.startSampleIndex || sampleIndex > strongest.endSampleIndex) continue;
        const time = sampleTime(xTrace, sampleIndex);
        if (time === undefined) continue;
        sampleIndices.push(sampleIndex);
        timeMs.push(time);
      }
      if (timeMs.length === 0) return;
      void context.openSamplesInLogger({
        sampleIndices,
        timeMs,
        label: `${channelLabel(yTrace)} vs ${channelLabel(xTrace)} region · strongest visit · ${sampleIndices.length.toLocaleString()} pairs`,
      });
    });
    pane.pointOpenLogger.addEventListener('click', () => {
      const result = pane.result;
      const xTrace = pane.xTrace;
      const yTrace = pane.yTrace;
      if (!result || !xTrace || !yTrace || !context.openSamplesInLogger) return;
      const index = pane.selectedResultIndex;
      if (index === undefined) return;
      const sampleIndex = result.sampleIndices[index];
      const xValue = result.xValues[index];
      const yValue = result.yValues[index];
      if (sampleIndex === undefined || xValue === undefined || yValue === undefined) return;
      const localIndex = sampleIndex - xTrace.range.startSampleIndex;
      const time = localIndex >= 0 && localIndex < xTrace.range.timeMs.length ? xTrace.range.timeMs[localIndex] : undefined;
      if (time === undefined) return;
      void context.openSamplesInLogger({ sampleIndices: [sampleIndex], timeMs: [time], label: `${channelLabel(yTrace)} vs ${channelLabel(xTrace)} point` });
    });
  }

  presetSelect.addEventListener('change', () => { presetApply.disabled = !presetSelect.value; presetDelete.disabled = !presetSelect.value; });
  presetApply.addEventListener('click', () => {
    const preset = scatterPresets.find((candidate) => candidate.id === presetSelect.value);
    if (!preset) return;
    setSelectIfAvailable(scopeSelect, preset.scope);
    setSelectIfAvailable(qualificationSelect, preset.qualificationId);
    layout = preset.layout; layoutSelect.value = layout; syncLayout();
    traceMode = preset.traceMode; traceModeSelect.value = traceMode;
    setSelectIfAvailable(panes[0]!.xSelect, preset.paneAXChannelId);
    setSelectIfAvailable(panes[0]!.ySelect, preset.paneAYChannelId);
    setSelectIfAvailable(panes[1]!.xSelect, preset.paneBXChannelId);
    setSelectIfAvailable(panes[1]!.ySelect, preset.paneBYChannelId);
    void render();
  });
  presetSave.addEventListener('click', () => {
    const suggested = scatterPresets.find((candidate) => candidate.id === presetSelect.value)?.name ?? `${panes[0]!.ySelect.selectedOptions[0]?.text ?? 'Y'} vs ${panes[0]!.xSelect.selectedOptions[0]?.text ?? 'X'}`;
    const name = window.prompt('Scatter setup name', suggested)?.trim();
    if (!name) return;
    const existing = scatterPresets.find((candidate) => candidate.id === presetSelect.value);
    const id = existing?.id ?? createHistogramLocalId('scatter-preset');
    const next = currentPresetState(id, name);
    scatterPresets = existing ? scatterPresets.map((candidate) => candidate.id === id ? next : candidate) : [...scatterPresets, next];
    saveHistogramScatterPresets(scatterPresets);
    populatePresetSelect(id);
  });
  presetDelete.addEventListener('click', () => {
    const id = presetSelect.value;
    if (!id) return;
    scatterPresets = scatterPresets.filter((candidate) => candidate.id !== id);
    saveHistogramScatterPresets(scatterPresets);
    populatePresetSelect();
  });

  scopeSelect.addEventListener('change', () => {
    if (scopeSelect.value === 'ab') void syncRangeFromSharedTimeline().then(() => render());
    else void render();
  });
  qualificationSelect.addEventListener('change', () => { void render(); });
  layoutSelect.addEventListener('change', () => { layout = layoutSelect.value === 'dual' ? 'dual' : 'single'; syncLayout(); void render(); });
  traceModeSelect.addEventListener('change', () => { traceMode = traceModeSelect.value === 'lines' ? 'lines' : 'dots'; refreshCanvasOnly(); });

  const sharedTimelineInteraction = (event: Event): void => {
    if (root.hidden || scopeSelect.value !== 'ab') return;
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('.timeline-shell')) return;
    window.setTimeout(() => { void syncRangeFromSharedTimeline(); }, 0);
  };
  document.addEventListener('click', sharedTimelineInteraction);
  document.addEventListener('change', sharedTimelineInteraction);

  new ResizeObserver(() => {
    if (root.hidden || content.hidden) return;
    refreshCanvasOnly();
  }).observe(root);

  const setContext = (nextContext: HistogramPageContext): void => {
    const previous = panes.map((pane) => ({ x: pane.xSelect.value, y: pane.ySelect.value }));
    const previousQualification = qualificationSelect.value;
    const channelsChanged = !sameChannelCatalog(context.channels, nextContext.channels);
    context = nextContext;
    analysisA = nextContext.aTimeMs;
    analysisB = nextContext.bTimeMs;
    fullStartMs = undefined;
    fullEndMs = undefined;
    qualificationSets = loadHistogramQualificationSets();
    populateScopeOptions();
    populateHistogramQualificationSelect(qualificationSelect, qualificationSets, context.channels, previousQualification);
    if (channelsChanged) {
      fillSelect(panes[0]!.xSelect, previous[0]?.x ?? '', 0);
      fillSelect(panes[0]!.ySelect, previous[0]?.y ?? '', 1);
      fillSelect(panes[1]!.xSelect, previous[1]?.x ?? '', 0);
      fillSelect(panes[1]!.ySelect, previous[1]?.y ?? '', 2);
    }
    void render();
  };

  populateScopeOptions();
  populateHistogramQualificationSelect(qualificationSelect, qualificationSets, context.channels);
  populatePresetSelect();
  syncLayout();
  return { element: root, setContext, refresh: () => scopeSelect.value === 'ab' ? void syncRangeFromSharedTimeline().then(() => render()) : void render() };
}
