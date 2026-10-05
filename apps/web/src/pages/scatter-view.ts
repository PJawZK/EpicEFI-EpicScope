import { buildNumericScatter, type NumericScatterResult } from '../../../../core/analysis/scatter';
import { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import type { HistogramPageContext, HistogramTraceContext } from './histogram-page';

const MAX_RENDERED_POINTS = 24_000;
const DENSITY_BINS_X = 44;
const DENSITY_BINS_Y = 32;

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
  result?: NumericScatterResult;
  xTrace?: HistogramTraceContext;
  yTrace?: HistogramTraceContext;
  renderedPointCount: number;
}

export interface ScatterViewController {
  readonly element: HTMLElement;
  setContext(context: HistogramPageContext): void;
  refresh(): void;
}

function formatNumber(value: number | undefined, precision = 3): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  return value.toFixed(precision).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function channelLabel(trace: HistogramTraceContext): string {
  return trace.channel.displayName || trace.channel.sourceName;
}

function finiteTimeBounds(trace: HistogramTraceContext): { startMs: number; endMs: number } | undefined {
  const times = trace.range.timeMs;
  if (times.length === 0) return undefined;
  let startMs: number | undefined;
  let endMs: number | undefined;
  for (let index = 0; index < times.length; index += 1) {
    const value = times[index];
    if (!Number.isFinite(value)) continue;
    startMs = value;
    break;
  }
  for (let index = times.length - 1; index >= 0; index -= 1) {
    const value = times[index];
    if (!Number.isFinite(value)) continue;
    endMs = value;
    break;
  }
  if (startMs === undefined || endMs === undefined) return undefined;
  return { startMs, endMs };
}

function heatColor(ratio: number): string {
  const clamped = Math.max(0, Math.min(1, ratio));
  const hue = 235 - clamped * 235;
  const lightness = clamped > 0.82 ? 52 : 48;
  return `hsl(${hue} 100% ${lightness}%)`;
}

function createPane(label: string): ScatterPaneState {
  const root = document.createElement('section');
  root.className = 'scatter-pane';
  root.innerHTML = `
    <div class="scatter-pane-toolbar">
      <span class="scatter-pane-label">${label}</span>
      <label><span>X Axis</span><select class="scatter-pane-x"></select></label>
      <label><span>Y Axis</span><select class="scatter-pane-y"></select></label>
      <span class="scatter-pane-z">Z Axis <strong>Hits</strong></span>
    </div>
    <div class="scatter-pane-stage">
      <canvas class="scatter-pane-chart" aria-label="Scatter plot"></canvas>
      <div class="scatter-pane-title"></div>
      <div class="scatter-pane-status"></div>
    </div>
  `;
  const xSelect = root.querySelector<HTMLSelectElement>('.scatter-pane-x');
  const ySelect = root.querySelector<HTMLSelectElement>('.scatter-pane-y');
  const canvas = root.querySelector<HTMLCanvasElement>('.scatter-pane-chart');
  const title = root.querySelector<HTMLElement>('.scatter-pane-title');
  const status = root.querySelector<HTMLElement>('.scatter-pane-status');
  if (!xSelect || !ySelect || !canvas || !title || !status) throw new Error('Scatter pane structure is incomplete.');
  return { root, xSelect, ySelect, canvas, title, status, renderedPointCount: 0 };
}

export function createScatterView(): ScatterViewController {
  let context: HistogramPageContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined };
  let scope: ScatterScope = 'range';
  let layout: ScatterLayout = 'single';
  let traceMode: ScatterTraceMode = 'dots';
  let timelineVisible = true;
  let renderGeneration = 0;

  const root = document.createElement('section');
  root.className = 'scatter-view scatter-view--mlv';
  root.hidden = true;
  root.innerHTML = `
    <div class="scatter-controls scatter-controls--mlv">
      <label><span>Scope</span><select class="scatter-scope"><option value="range">Range</option><option value="full">Full Log</option></select></label>
      <label><span>View</span><select class="scatter-layout"><option value="single">Single</option><option value="dual">Dual</option></select></label>
      <label><span>Trace</span><select class="scatter-trace-mode"><option value="dots">Dots</option><option value="lines">Lines</option></select></label>
      <label class="scatter-timeline-toggle"><input type="checkbox" checked /><span>Timeline</span></label>
      <button type="button" class="scatter-refresh">Refresh</button>
      <span class="scatter-scope-note"></span>
    </div>
    <div class="scatter-empty">
      <strong>Scatter needs two available numeric channels.</strong>
      <span>Choose Full Log, or use Range after setting A/B in Logger.</span>
    </div>
    <div class="scatter-content scatter-content--mlv" hidden>
      <div class="scatter-panes"></div>
      <div class="scatter-overview">
        <div class="scatter-overview-head"><span>Timeline</span><strong class="scatter-overview-range">—</strong></div>
        <canvas class="scatter-overview-canvas" aria-label="Scatter source timeline overview"></canvas>
      </div>
    </div>
  `;

  const scopeSelect = root.querySelector<HTMLSelectElement>('.scatter-scope');
  const layoutSelect = root.querySelector<HTMLSelectElement>('.scatter-layout');
  const traceModeSelect = root.querySelector<HTMLSelectElement>('.scatter-trace-mode');
  const timelineToggle = root.querySelector<HTMLInputElement>('.scatter-timeline-toggle input');
  const refreshButton = root.querySelector<HTMLButtonElement>('.scatter-refresh');
  const scopeNote = root.querySelector<HTMLElement>('.scatter-scope-note');
  const empty = root.querySelector<HTMLElement>('.scatter-empty');
  const content = root.querySelector<HTMLElement>('.scatter-content');
  const paneHost = root.querySelector<HTMLElement>('.scatter-panes');
  const overview = root.querySelector<HTMLElement>('.scatter-overview');
  const overviewCanvas = root.querySelector<HTMLCanvasElement>('.scatter-overview-canvas');
  const overviewRange = root.querySelector<HTMLElement>('.scatter-overview-range');
  if (!scopeSelect || !layoutSelect || !traceModeSelect || !timelineToggle || !refreshButton || !scopeNote || !empty || !content || !paneHost || !overview || !overviewCanvas || !overviewRange) {
    throw new Error('Scatter view structure is incomplete.');
  }

  const panes = [createPane('A'), createPane('B')];
  paneHost.append(panes[0]!.root, panes[1]!.root);

  const hasValidRange = (): boolean =>
    context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs;

  const fillSelect = (select: HTMLSelectElement, preferred: string, fallbackIndex: number): void => {
    select.replaceChildren();
    for (const channel of context.channels) select.add(new Option(channel.displayName || channel.sourceName, channel.id));
    if (context.channels.some((channel) => channel.id === preferred)) select.value = preferred;
    else if (context.channels[fallbackIndex]) select.value = context.channels[fallbackIndex]!.id;
  };

  const syncLayout = (): void => {
    panes[1]!.root.hidden = layout !== 'dual';
    paneHost.classList.toggle('scatter-panes--dual', layout === 'dual');
    overview.hidden = !timelineVisible;
  };

  const scopeBounds = (): { startMs?: number; endMs?: number } => {
    if (scope !== 'range' || !hasValidRange()) return {};
    return {
      startMs: Math.min(context.aTimeMs!, context.bTimeMs!),
      endMs: Math.max(context.aTimeMs!, context.bTimeMs!),
    };
  };

  const renderPane = (
    pane: ScatterPaneState,
    result: NumericScatterResult,
    xTrace: HistogramTraceContext,
    yTrace: HistogramTraceContext,
  ): void => {
    const canvas = pane.canvas;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const padLeft = 58;
    const padRight = 42;
    const padTop = 32;
    const padBottom = 42;
    const chartWidth = Math.max(1, width - padLeft - padRight);
    const chartHeight = Math.max(1, height - padTop - padBottom);

    ctx.fillStyle = '#030608';
    ctx.fillRect(padLeft, padTop, chartWidth, chartHeight);
    ctx.strokeStyle = 'rgba(128, 145, 154, .72)';
    ctx.lineWidth = 1;
    ctx.strokeRect(padLeft, padTop, chartWidth, chartHeight);

    if (
      result.validPairSampleCount === 0
      || result.xMin === undefined
      || result.xMax === undefined
      || result.yMin === undefined
      || result.yMax === undefined
    ) {
      pane.renderedPointCount = 0;
      pane.title.textContent = `${channelLabel(yTrace)} vs ${channelLabel(xTrace)} vs Hits`;
      pane.status.textContent = 'No valid paired samples';
      return;
    }

    const xSpan = Math.max(Number.EPSILON, result.xMax - result.xMin);
    const ySpan = Math.max(Number.EPSILON, result.yMax - result.yMin);
    const stride = Math.max(1, Math.ceil(result.validPairSampleCount / MAX_RENDERED_POINTS));
    pane.renderedPointCount = Math.ceil(result.validPairSampleCount / stride);

    ctx.strokeStyle = 'rgba(54, 75, 87, .58)';
    ctx.setLineDash([2, 5]);
    for (let index = 1; index < 4; index += 1) {
      const x = padLeft + (chartWidth * index) / 4;
      const y = padTop + (chartHeight * index) / 4;
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + chartHeight);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + chartWidth, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    if (traceMode === 'lines') {
      ctx.strokeStyle = xTrace.color || '#2584ff';
      ctx.globalAlpha = 0.62;
      ctx.lineWidth = 1;
      ctx.beginPath();
      let started = false;
      for (let index = 0; index < result.validPairSampleCount; index += stride) {
        const xValue = result.xValues[index];
        const yValue = result.yValues[index];
        if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) continue;
        const x = padLeft + ((xValue - result.xMin) / xSpan) * chartWidth;
        const y = padTop + chartHeight - ((yValue - result.yMin) / ySpan) * chartHeight;
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      const density = new Uint32Array(DENSITY_BINS_X * DENSITY_BINS_Y);
      let maxDensity = 1;
      for (let index = 0; index < result.validPairSampleCount; index += stride) {
        const xValue = result.xValues[index];
        const yValue = result.yValues[index];
        if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) continue;
        const bx = Math.max(0, Math.min(DENSITY_BINS_X - 1, Math.floor(((xValue - result.xMin) / xSpan) * DENSITY_BINS_X)));
        const by = Math.max(0, Math.min(DENSITY_BINS_Y - 1, Math.floor(((yValue - result.yMin) / ySpan) * DENSITY_BINS_Y)));
        const densityIndex = by * DENSITY_BINS_X + bx;
        const next = (density[densityIndex] ?? 0) + 1;
        density[densityIndex] = next;
        if (next > maxDensity) maxDensity = next;
      }
      for (let index = 0; index < result.validPairSampleCount; index += stride) {
        const xValue = result.xValues[index];
        const yValue = result.yValues[index];
        if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) continue;
        const xNorm = (xValue - result.xMin) / xSpan;
        const yNorm = (yValue - result.yMin) / ySpan;
        const bx = Math.max(0, Math.min(DENSITY_BINS_X - 1, Math.floor(xNorm * DENSITY_BINS_X)));
        const by = Math.max(0, Math.min(DENSITY_BINS_Y - 1, Math.floor(yNorm * DENSITY_BINS_Y)));
        const hits = density[by * DENSITY_BINS_X + bx] ?? 1;
        const ratio = Math.log1p(hits) / Math.log1p(maxDensity);
        const x = padLeft + xNorm * chartWidth;
        const y = padTop + chartHeight - yNorm * chartHeight;
        ctx.fillStyle = heatColor(ratio);
        ctx.globalAlpha = 0.74;
        const size = 1.25 + ratio * 1.75;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;

      const legendX = padLeft + chartWidth + 14;
      const legendHeight = Math.min(210, chartHeight * .66);
      const legendY = padTop + (chartHeight - legendHeight) / 2;
      const gradient = ctx.createLinearGradient(0, legendY + legendHeight, 0, legendY);
      for (let stop = 0; stop <= 1; stop += .1) gradient.addColorStop(stop, heatColor(stop));
      ctx.fillStyle = gradient;
      ctx.fillRect(legendX, legendY, 8, legendHeight);
      ctx.fillStyle = '#8da1ad';
      ctx.font = '8px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('Hits', legendX - 2, legendY - 9);
      ctx.fillText(String(maxDensity), legendX + 12, legendY + 2);
      ctx.fillText('1', legendX + 12, legendY + legendHeight - 2);
    }

    ctx.fillStyle = '#8ca1ad';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(formatNumber(result.xMin), padLeft, padTop + chartHeight + 7);
    ctx.textAlign = 'right';
    ctx.fillText(formatNumber(result.xMax), padLeft + chartWidth, padTop + chartHeight + 7);
    ctx.textAlign = 'center';
    ctx.fillText(`${channelLabel(xTrace)}${xTrace.channel.unit ? ` · ${xTrace.channel.unit}` : ''}`, padLeft + chartWidth / 2, padTop + chartHeight + 24);

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText(formatNumber(result.yMax), padLeft - 7, padTop + 3);
    ctx.fillText(formatNumber(result.yMin), padLeft - 7, padTop + chartHeight - 3);
    ctx.save();
    ctx.translate(14, padTop + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(`${channelLabel(yTrace)}${yTrace.channel.unit ? ` · ${yTrace.channel.unit}` : ''}`, 0, 0);
    ctx.restore();

    pane.title.textContent = `${channelLabel(yTrace)} vs ${channelLabel(xTrace)} vs Hits`;
    pane.status.textContent = `${result.validPairSampleCount.toLocaleString()} pairs · ${pane.renderedPointCount.toLocaleString()} rendered`;
  };

  const renderOverview = (trace: HistogramTraceContext): void => {
    if (!timelineVisible) return;
    const bounds = finiteTimeBounds(trace);
    const rect = overviewCanvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    overviewCanvas.width = Math.max(1, Math.round(width * dpr));
    overviewCanvas.height = Math.max(1, Math.round(height * dpr));
    const ctx = overviewCanvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#050b10';
    ctx.fillRect(0, 0, width, height);
    if (!bounds || trace.range.values.length === 0) return;

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const value of trace.range.values) {
      if (!Number.isFinite(value)) continue;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return;
    const span = Math.max(Number.EPSILON, max - min);
    const timeSpan = Math.max(Number.EPSILON, bounds.endMs - bounds.startMs);
    const stride = Math.max(1, Math.ceil(trace.range.values.length / Math.max(300, width * 1.5)));

    ctx.strokeStyle = trace.color || '#37a2ff';
    ctx.globalAlpha = .75;
    ctx.lineWidth = 1;
    ctx.beginPath();
    let started = false;
    for (let index = 0; index < trace.range.values.length; index += stride) {
      const value = trace.range.values[index];
      const time = trace.range.timeMs[index];
      if (!Number.isFinite(value) || !Number.isFinite(time)) continue;
      const x = ((time - bounds.startMs) / timeSpan) * width;
      const y = height - 4 - ((value - min) / span) * Math.max(1, height - 8);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (hasValidRange()) {
      const startMs = Math.min(context.aTimeMs!, context.bTimeMs!);
      const endMs = Math.max(context.aTimeMs!, context.bTimeMs!);
      const x1 = Math.max(0, Math.min(width, ((startMs - bounds.startMs) / timeSpan) * width));
      const x2 = Math.max(0, Math.min(width, ((endMs - bounds.startMs) / timeSpan) * width));
      ctx.fillStyle = 'rgba(72, 167, 231, .16)';
      ctx.fillRect(Math.min(x1, x2), 0, Math.max(1, Math.abs(x2 - x1)), height);
      ctx.strokeStyle = 'rgba(115, 202, 255, .9)';
      ctx.strokeRect(Math.min(x1, x2) + .5, .5, Math.max(1, Math.abs(x2 - x1) - 1), height - 1);
    }
    overviewRange.textContent = `${(bounds.startMs / 1000).toFixed(2)}–${(bounds.endMs / 1000).toFixed(2)} s`;
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
      scopeNote.textContent = scope === 'range' && !hasValidRange() ? 'Set A/B in Logger for Range.' : '';
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
      let complete = xTrace.complete && yTrace.complete;
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

    if (generation !== renderGeneration || !timelineVisible) return;
    const xId = panes[0]!.xSelect.value;
    if (!xId) return;
    const [overviewTrace] = await context.loadTraces([xId]);
    if (generation !== renderGeneration || !overviewTrace) return;
    renderOverview(overviewTrace);
  };

  const refreshCanvasOnly = (): void => {
    for (const pane of panes) {
      if (pane.result && pane.xTrace && pane.yTrace && !pane.root.hidden) renderPane(pane, pane.result, pane.xTrace, pane.yTrace);
    }
  };

  const setContext = (nextContext: HistogramPageContext): void => {
    const previous = panes.map((pane) => ({ x: pane.xSelect.value, y: pane.ySelect.value }));
    context = nextContext;
    fillSelect(panes[0]!.xSelect, previous[0]?.x ?? '', 0);
    fillSelect(panes[0]!.ySelect, previous[0]?.y ?? '', 1);
    fillSelect(panes[1]!.xSelect, previous[1]?.x ?? '', 0);
    fillSelect(panes[1]!.ySelect, previous[1]?.y ?? '', 2);
    void render();
  };

  for (const pane of panes) {
    pane.xSelect.addEventListener('change', () => { void render(); });
    pane.ySelect.addEventListener('change', () => { void render(); });
  }
  scopeSelect.addEventListener('change', () => {
    scope = scopeSelect.value === 'full' ? 'full' : 'range';
    void render();
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
  timelineToggle.addEventListener('change', () => {
    timelineVisible = timelineToggle.checked;
    syncLayout();
    if (timelineVisible) void render();
  });
  refreshButton.addEventListener('click', () => { void render(); });

  new ResizeObserver(() => {
    if (root.hidden || content.hidden) return;
    refreshCanvasOnly();
    if (timelineVisible && panes[0]!.xTrace) {
      void context.loadTraces([panes[0]!.xSelect.value]).then(([trace]) => {
        if (trace && !root.hidden && timelineVisible) renderOverview(trace);
      });
    }
  }).observe(root);

  syncLayout();
  return {
    element: root,
    setContext,
    refresh: () => { void render(); },
  };
}
