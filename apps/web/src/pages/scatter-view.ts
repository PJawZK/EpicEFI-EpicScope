import { buildNumericScatter, type NumericScatterResult } from '../../../../core/analysis/scatter';
import { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import type { HistogramPageContext, HistogramTraceContext } from './histogram-page';

const MAX_RENDERED_POINTS = 20_000;

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

export function createScatterView(): ScatterViewController {
  let context: HistogramPageContext = { traces: [], aTimeMs: undefined, bTimeMs: undefined };
  let currentResult: NumericScatterResult | undefined;
  let renderedPointCount = 0;

  const root = document.createElement('section');
  root.className = 'scatter-view';
  root.hidden = true;
  root.innerHTML = `
    <div class="scatter-controls">
      <label>
        <span>X channel</span>
        <select class="scatter-x-channel"></select>
      </label>
      <label>
        <span>Y channel</span>
        <select class="scatter-y-channel"></select>
      </label>
      <button type="button" class="scatter-refresh">Refresh</button>
    </div>
    <div class="scatter-empty">
      <strong>Scatter needs a selected range and two active channels.</strong>
      <span>Return to Logger, set A and B, and keep both X and Y channels active in the current graph pane.</span>
    </div>
    <div class="scatter-content" hidden>
      <div class="scatter-summary">
        <div><span>Scope</span><strong data-scatter-summary="scope">—</strong></div>
        <div><span>Coverage</span><strong data-scatter-summary="coverage">—</strong></div>
        <div><span>Input</span><strong data-scatter-summary="input">0</strong></div>
        <div><span>Valid pairs</span><strong data-scatter-summary="valid">0</strong></div>
        <div><span>Invalid</span><strong data-scatter-summary="invalid">0</strong></div>
        <div><span>Unavailable</span><strong data-scatter-summary="unavailable">0</strong></div>
      </div>
      <div class="scatter-chart-wrap">
        <canvas class="scatter-chart" aria-label="Scatter plot"></canvas>
      </div>
      <div class="scatter-axis-summary">
        <span>X <strong data-scatter-summary="x-range">—</strong></span>
        <span>Y <strong data-scatter-summary="y-range">—</strong></span>
        <span>Rendered points <strong data-scatter-summary="rendered">0</strong></span>
      </div>
    </div>
  `;

  const xSelect = root.querySelector<HTMLSelectElement>('.scatter-x-channel');
  const ySelect = root.querySelector<HTMLSelectElement>('.scatter-y-channel');
  const refreshButton = root.querySelector<HTMLButtonElement>('.scatter-refresh');
  const empty = root.querySelector<HTMLElement>('.scatter-empty');
  const content = root.querySelector<HTMLElement>('.scatter-content');
  const canvas = root.querySelector<HTMLCanvasElement>('.scatter-chart');
  if (!xSelect || !ySelect || !refreshButton || !empty || !content || !canvas) {
    throw new Error('Scatter view structure is incomplete.');
  }

  const summary = (name: string): HTMLElement => {
    const node = root.querySelector<HTMLElement>(`[data-scatter-summary="${name}"]`);
    if (!node) throw new Error(`Scatter summary field is missing: ${name}`);
    return node;
  };

  const traceFor = (channelId: string): HistogramTraceContext | undefined =>
    context.traces.find((trace) => trace.channel.id === channelId);

  const hasValidRange = (): boolean =>
    context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs;

  const renderChart = (
    result: NumericScatterResult,
    xTrace: HistogramTraceContext,
    yTrace: HistogramTraceContext,
  ): void => {
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

    const padLeft = 64;
    const padRight = 22;
    const padTop = 20;
    const padBottom = 48;
    const chartWidth = Math.max(1, width - padLeft - padRight);
    const chartHeight = Math.max(1, height - padTop - padBottom);

    ctx.fillStyle = '#0b171f';
    ctx.fillRect(padLeft, padTop, chartWidth, chartHeight);
    ctx.strokeStyle = 'rgba(91, 118, 136, .5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(padLeft, padTop, chartWidth, chartHeight);

    if (
      result.validPairSampleCount === 0
      || result.xMin === undefined
      || result.xMax === undefined
      || result.yMin === undefined
      || result.yMax === undefined
    ) {
      renderedPointCount = 0;
      return;
    }

    const xSpan = Math.max(Number.EPSILON, result.xMax - result.xMin);
    const ySpan = Math.max(Number.EPSILON, result.yMax - result.yMin);
    const stride = Math.max(1, Math.ceil(result.validPairSampleCount / MAX_RENDERED_POINTS));
    renderedPointCount = Math.ceil(result.validPairSampleCount / stride);

    ctx.fillStyle = xTrace.color || '#58aef6';
    ctx.globalAlpha = 0.42;
    for (let index = 0; index < result.validPairSampleCount; index += stride) {
      const xValue = result.xValues[index];
      const yValue = result.yValues[index];
      if (xValue === undefined || yValue === undefined) continue;
      const x = padLeft + ((xValue - result.xMin) / xSpan) * chartWidth;
      const y = padTop + chartHeight - ((yValue - result.yMin) / ySpan) * chartHeight;
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#78909e';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(formatNumber(result.xMin), padLeft, padTop + chartHeight + 7);
    ctx.textAlign = 'right';
    ctx.fillText(formatNumber(result.xMax), padLeft + chartWidth, padTop + chartHeight + 7);
    ctx.textAlign = 'center';
    ctx.fillText(`${channelLabel(xTrace)}${xTrace.channel.unit ? ` · ${xTrace.channel.unit}` : ''}`, padLeft + chartWidth / 2, padTop + chartHeight + 25);

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText(formatNumber(result.yMax), padLeft - 7, padTop + 3);
    ctx.fillText(formatNumber(result.yMin), padLeft - 7, padTop + chartHeight - 3);

    ctx.save();
    ctx.translate(15, padTop + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(`${channelLabel(yTrace)}${yTrace.channel.unit ? ` · ${yTrace.channel.unit}` : ''}`, 0, 0);
    ctx.restore();
  };

  const render = (): void => {
    const xTrace = traceFor(xSelect.value) ?? context.traces[0];
    const yTrace = traceFor(ySelect.value) ?? context.traces[1] ?? context.traces[0];
    if (!xTrace || !yTrace || context.traces.length < 2 || !hasValidRange()) {
      currentResult = undefined;
      renderedPointCount = 0;
      empty.hidden = false;
      content.hidden = true;
      refreshButton.disabled = true;
      return;
    }

    refreshButton.disabled = false;
    const startMs = Math.min(context.aTimeMs!, context.bTimeMs!);
    const endMs = Math.max(context.aTimeMs!, context.bTimeMs!);
    const channels = new Map([[xTrace.channel.id, { range: xTrace.range, complete: xTrace.complete }]]);
    const scoped = qualifyNumericSamples({
      referenceChannelId: xTrace.channel.id,
      channels,
      conditions: [],
      timeRange: { startMs, endMs },
    });
    currentResult = buildNumericScatter(xTrace.range, yTrace.range, {
      sampleIndices: scoped.eligibleSampleIndices,
    });

    const yComplete = yTrace.complete || numericRangeCoversTime(yTrace.range, startMs, endMs);
    const complete = scoped.complete && yComplete && currentResult.unavailableSampleCount === 0;
    empty.hidden = true;
    content.hidden = false;
    summary('scope').textContent = `${((endMs - startMs) / 1000).toFixed(3)} s`;
    summary('coverage').textContent = complete ? 'Complete' : 'Partial decoded';
    summary('input').textContent = currentResult.inputSampleCount.toLocaleString();
    summary('valid').textContent = currentResult.validPairSampleCount.toLocaleString();
    summary('invalid').textContent = currentResult.invalidSampleCount.toLocaleString();
    summary('unavailable').textContent = currentResult.unavailableSampleCount.toLocaleString();
    summary('x-range').textContent = currentResult.xMin === undefined || currentResult.xMax === undefined
      ? '—'
      : `${formatNumber(currentResult.xMin)} – ${formatNumber(currentResult.xMax)}${xTrace.channel.unit ? ` ${xTrace.channel.unit}` : ''}`;
    summary('y-range').textContent = currentResult.yMin === undefined || currentResult.yMax === undefined
      ? '—'
      : `${formatNumber(currentResult.yMin)} – ${formatNumber(currentResult.yMax)}${yTrace.channel.unit ? ` ${yTrace.channel.unit}` : ''}`;
    renderChart(currentResult, xTrace, yTrace);
    summary('rendered').textContent = renderedPointCount.toLocaleString();
  };

  const fillSelect = (select: HTMLSelectElement, preferred: string, fallbackIndex: number): void => {
    select.replaceChildren();
    for (const trace of context.traces) select.add(new Option(channelLabel(trace), trace.channel.id));
    if (context.traces.some((trace) => trace.channel.id === preferred)) select.value = preferred;
    else if (context.traces[fallbackIndex]) select.value = context.traces[fallbackIndex]!.channel.id;
  };

  const setContext = (nextContext: HistogramPageContext): void => {
    const previousX = xSelect.value;
    const previousY = ySelect.value;
    context = nextContext;
    fillSelect(xSelect, previousX, 0);
    fillSelect(ySelect, previousY, 1);
    render();
  };

  xSelect.addEventListener('change', render);
  ySelect.addEventListener('change', render);
  refreshButton.addEventListener('click', render);
  new ResizeObserver(() => {
    if (currentResult && !content.hidden && !root.hidden) render();
  }).observe(canvas);

  return {
    element: root,
    setContext,
    refresh: render,
  };
}
