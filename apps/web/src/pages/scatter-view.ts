import { buildNumericScatter, type NumericScatterResult } from '../../../../core/analysis/scatter';
import { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import type { HistogramPageContext, HistogramTraceContext } from './histogram-page';

const MAX_RENDERED_POINTS = 28_000;

type ScatterScope = 'range' | 'full';
type ScatterLayout = 'single' | 'dual';
type ScatterTraceMode = 'dots' | 'lines';

interface ScatterPaneState {
  readonly root: HTMLElement;
  readonly xSelect: HTMLSelectElement;
  readonly ySelect: HTMLSelectElement;
  readonly canvas: HTMLCanvasElement;
  readonly title: HTMLElement;
  readonly status: HTMLElement;
  result: NumericScatterResult | undefined;
  xTrace: HistogramTraceContext | undefined;
  yTrace: HistogramTraceContext | undefined;
  renderedPointCount: number;
}

interface DensityModel {
  readonly binsX: number;
  readonly binsY: number;
  readonly counts: Uint32Array;
  readonly maxHits: number;
  readonly heatCeiling: number;
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
    if (value !== undefined && Number.isFinite(value)) {
      startMs = value;
      break;
    }
  }
  for (let index = times.length - 1; index >= 0; index -= 1) {
    const value = times[index];
    if (value !== undefined && Number.isFinite(value)) {
      endMs = value;
      break;
    }
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
  return {
    aOffsetMs: parseTimelineDuration(match[1] ?? '—'),
    bOffsetMs: parseTimelineDuration(match[2] ?? '—'),
  };
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
      <span class="scatter-pane-z">Heat <strong>Hits / cell</strong></span>
    </div>
    <div class="scatter-pane-stage">
      <canvas class="scatter-pane-chart" aria-label="Scatter plot"></canvas>
      <div class="scatter-pane-title"></div>
    </div>
    <div class="scatter-pane-status"></div>
  `;
  const xSelect = root.querySelector<HTMLSelectElement>('.scatter-pane-x');
  const ySelect = root.querySelector<HTMLSelectElement>('.scatter-pane-y');
  const canvas = root.querySelector<HTMLCanvasElement>('.scatter-pane-chart');
  const title = root.querySelector<HTMLElement>('.scatter-pane-title');
  const status = root.querySelector<HTMLElement>('.scatter-pane-status');
  if (!xSelect || !ySelect || !canvas || !title || !status) throw new Error('Scatter pane structure is incomplete.');
  return { root, xSelect, ySelect, canvas, title, status, result: undefined, xTrace: undefined, yTrace: undefined, renderedPointCount: 0 };
}

function createDensityModel(
  result: NumericScatterResult,
  stride: number,
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

  for (let index = 0; index < result.validPairSampleCount; index += stride) {
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

function drawHeatLegend(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  model: DensityModel,
): void {
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

export function createScatterView(): ScatterViewController {
  let context: HistogramPageContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined };
  let scope: ScatterScope = 'range';
  let layout: ScatterLayout = 'single';
  let traceMode: ScatterTraceMode = 'dots';
  let renderGeneration = 0;
  let analysisA = context.aTimeMs;
  let analysisB = context.bTimeMs;
  let fullStartMs: number | undefined;
  let fullEndMs: number | undefined;

  const root = document.createElement('section');
  root.className = 'scatter-view scatter-view--mlv';
  root.hidden = true;
  root.innerHTML = `
    <div class="scatter-controls scatter-controls--mlv">
      <label><span>Scope</span><select class="scatter-scope"><option value="range">Range A/B</option><option value="full">Full Log</option></select></label>
      <label><span>View</span><select class="scatter-layout"><option value="single">Single</option><option value="dual">Dual</option></select></label>
      <label><span>Trace</span><select class="scatter-trace-mode"><option value="dots">Dots</option><option value="lines">Lines</option></select></label>
      <button type="button" class="scatter-refresh">Refresh</button>
      <span class="scatter-scope-note"></span>
    </div>
    <div class="scatter-empty">
      <strong>Scatter needs two available numeric channels.</strong>
      <span>Use the timeline below to set A and B, or choose Full Log.</span>
    </div>
    <div class="scatter-content scatter-content--mlv" hidden>
      <div class="scatter-panes"></div>
    </div>
    <div class="scatter-shared-timeline-slot" aria-label="Analysis timeline"></div>
  `;

  const scopeSelect = root.querySelector<HTMLSelectElement>('.scatter-scope');
  const layoutSelect = root.querySelector<HTMLSelectElement>('.scatter-layout');
  const traceModeSelect = root.querySelector<HTMLSelectElement>('.scatter-trace-mode');
  const refreshButton = root.querySelector<HTMLButtonElement>('.scatter-refresh');
  const scopeNote = root.querySelector<HTMLElement>('.scatter-scope-note');
  const empty = root.querySelector<HTMLElement>('.scatter-empty');
  const content = root.querySelector<HTMLElement>('.scatter-content');
  const paneHost = root.querySelector<HTMLElement>('.scatter-panes');
  if (!scopeSelect || !layoutSelect || !traceModeSelect || !refreshButton || !scopeNote || !empty || !content || !paneHost) {
    throw new Error('Scatter view structure is incomplete.');
  }

  const panes: ScatterPaneState[] = [createPane('A'), createPane('B')];
  paneHost.append(panes[0]!.root, panes[1]!.root);

  const hasValidRange = (): boolean => analysisA !== undefined && analysisB !== undefined && analysisA !== analysisB;

  const scopeBounds = (): { startMs?: number; endMs?: number } => {
    if (scope !== 'range' || !hasValidRange()) return {};
    return { startMs: Math.min(analysisA!, analysisB!), endMs: Math.max(analysisA!, analysisB!) };
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
    const density = createDensityModel(result, stride, xMin, xSpan, yMin, ySpan, chartWidth, chartHeight);

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
      for (let index = 0; index < result.validPairSampleCount; index += stride) {
        const xValue = result.xValues[index];
        const yValue = result.yValues[index];
        if (xValue === undefined || yValue === undefined || !Number.isFinite(xValue) || !Number.isFinite(yValue)) {
          previousX = undefined;
          previousY = undefined;
          continue;
        }
        const xNorm = clamp01((xValue - xMin) / xSpan);
        const yNorm = clamp01((yValue - yMin) / ySpan);
        const x = padLeft + xNorm * chartWidth;
        const y = padTop + chartHeight - yNorm * chartHeight;
        if (previousX !== undefined && previousY !== undefined) {
          const ratio = densityRatio(density, xNorm, yNorm);
          ctx.strokeStyle = heatColor(ratio);
          ctx.globalAlpha = 0.46 + ratio * 0.5;
          ctx.lineWidth = 0.85 + ratio * 1.15;
          ctx.beginPath();
          ctx.moveTo(previousX, previousY);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        previousX = x;
        previousY = y;
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

    const legendHeight = Math.max(80, Math.min(190, chartHeight * 0.62));
    drawHeatLegend(ctx, padLeft + chartWidth + 16, padTop + (chartHeight - legendHeight) / 2, legendHeight, density);

    ctx.fillStyle = '#8ca1ad';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(formatNumber(xMin), padLeft, padTop + chartHeight + 7);
    ctx.textAlign = 'right';
    ctx.fillText(formatNumber(xMax), padLeft + chartWidth, padTop + chartHeight + 7);
    ctx.textAlign = 'center';
    ctx.fillText(axisLabel(xTrace), padLeft + chartWidth / 2, padTop + chartHeight + 24);

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText(formatNumber(yMax), padLeft - 8, padTop + 4);
    ctx.fillText(formatNumber(yMin), padLeft - 8, padTop + chartHeight - 4);
    ctx.save();
    ctx.translate(15, padTop + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(axisLabel(yTrace), 0, 0);
    ctx.restore();

    pane.status.textContent = `${result.validPairSampleCount.toLocaleString()} pairs · ${pane.renderedPointCount.toLocaleString()} rendered · heat ≥${density.heatCeiling} / max ${density.maxHits} hits per cell`;
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
    const abText = document.querySelector<HTMLElement>('.timeline-shell .timeline-ab-value')?.textContent ?? '';
    const parsed = parseTimelineAB(abText);
    if (!parsed) return;
    await ensureFullTimeBounds();
    if (fullStartMs === undefined) return;
    analysisA = parsed.aOffsetMs === undefined ? undefined : fullStartMs + parsed.aOffsetMs;
    analysisB = parsed.bOffsetMs === undefined ? undefined : fullStartMs + parsed.bOffsetMs;
    if (scope === 'range' && !root.hidden) await render();
  };

  const render = async (): Promise<void> => {
    const generation = ++renderGeneration;
    const visiblePanes = layout === 'dual' ? panes : [panes[0]!];
    if (context.channels.length < 2 || (scope === 'range' && !hasValidRange())) {
      for (const pane of panes) {
        pane.result = undefined;
        pane.xTrace = undefined;
        pane.yTrace = undefined;
      }
      empty.hidden = false;
      content.hidden = true;
      refreshButton.disabled = context.channels.length < 2;
      scopeNote.textContent = scope === 'range' && !hasValidRange() ? 'Set A and B in the timeline below.' : '';
      return;
    }

    refreshButton.disabled = false;
    empty.hidden = true;
    content.hidden = false;
    syncLayout();
    const bounds = scopeBounds();
    scopeNote.textContent = scope === 'full'
      ? 'Whole recorded log'
      : `${((bounds.endMs! - bounds.startMs!) / 1000).toFixed(3)} s A/B range`;

    await Promise.all(visiblePanes.map(async (pane) => {
      const xId = pane.xSelect.value;
      const yId = pane.ySelect.value;
      if (!xId || !yId) return;
      const loaded = await context.loadTraces([xId, yId], bounds.startMs, bounds.endMs);
      if (generation !== renderGeneration) return;
      const byId = new Map(loaded.map((trace) => [trace.channel.id, trace]));
      const xTrace = byId.get(xId);
      const yTrace = byId.get(yId);
      if (!xTrace || !yTrace) {
        pane.status.textContent = 'Selected channel data is unavailable.';
        return;
      }

      let result: NumericScatterResult;
      let complete: boolean;
      if (scope === 'range') {
        const channels = new Map([[xTrace.channel.id, { range: xTrace.range, complete: xTrace.complete }]]);
        const qualified = qualifyNumericSamples({
          referenceChannelId: xTrace.channel.id,
          channels,
          conditions: [],
          timeRange: { startMs: bounds.startMs!, endMs: bounds.endMs! },
        });
        result = buildNumericScatter(xTrace.range, yTrace.range, { sampleIndices: qualified.eligibleSampleIndices });
        complete = qualified.complete
          && (yTrace.complete || numericRangeCoversTime(yTrace.range, bounds.startMs!, bounds.endMs!))
          && result.unavailableSampleCount === 0;
      } else {
        result = buildNumericScatter(xTrace.range, yTrace.range);
        complete = xTrace.complete && yTrace.complete && result.unavailableSampleCount === 0;
      }

      pane.result = result;
      pane.xTrace = xTrace;
      pane.yTrace = yTrace;
      renderPane(pane, result, xTrace, yTrace);
      pane.status.textContent += complete ? ' · complete' : ' · partial decoded';
    }));
  };

  const refreshCanvasOnly = (): void => {
    for (const pane of panes) {
      if (pane.result && pane.xTrace && pane.yTrace && !pane.root.hidden) renderPane(pane, pane.result, pane.xTrace, pane.yTrace);
    }
  };

  const setContext = (nextContext: HistogramPageContext): void => {
    const previous = panes.map((pane) => ({ x: pane.xSelect.value, y: pane.ySelect.value }));
    context = nextContext;
    analysisA = nextContext.aTimeMs;
    analysisB = nextContext.bTimeMs;
    fullStartMs = undefined;
    fullEndMs = undefined;
    fillSelect(panes[0]!.xSelect, previous[0]?.x ?? '', 0);
    fillSelect(panes[0]!.ySelect, previous[0]?.y ?? '', 1);
    fillSelect(panes[1]!.xSelect, previous[1]?.x ?? '', 0);
    fillSelect(panes[1]!.ySelect, previous[1]?.y ?? '', 2);
    void render();
  };

  for (const pane of panes) {
    pane.xSelect.addEventListener('change', () => {
      if (pane === panes[0]) {
        fullStartMs = undefined;
        fullEndMs = undefined;
      }
      void render();
    });
    pane.ySelect.addEventListener('change', () => { void render(); });
  }
  scopeSelect.addEventListener('change', () => {
    scope = scopeSelect.value === 'full' ? 'full' : 'range';
    void syncRangeFromSharedTimeline().then(() => render());
  });
  layoutSelect.addEventListener('change', () => {
    layout = layoutSelect.value === 'dual' ? 'dual' : 'single';
    syncLayout();
    void render();
  });
  traceModeSelect.addEventListener('change', () => {
    traceMode = traceModeSelect.value === 'lines' ? 'lines' : 'dots';
    refreshCanvasOnly();
  });
  refreshButton.addEventListener('click', () => { void syncRangeFromSharedTimeline().then(() => render()); });

  const sharedTimelineInteraction = (event: Event): void => {
    if (root.hidden) return;
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

  syncLayout();
  return { element: root, setContext, refresh: () => { void syncRangeFromSharedTimeline().then(() => render()); } };
}
