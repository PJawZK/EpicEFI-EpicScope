import { buildNumericHeatmap, type NumericHeatmapResult } from '../../../../core/analysis/heatmap';
import type { NumericAggregationMethod } from '../../../../core/analysis/numeric-aggregation';
import { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import type { HistogramPageContext, HistogramTraceContext } from './histogram-page';

export interface HeatmapViewController {
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

function aggregationLabel(method: NumericAggregationMethod): string {
  if (method === 'count') return 'Count';
  if (method === 'mean') return 'Mean';
  if (method === 'min') return 'Minimum';
  if (method === 'max') return 'Maximum';
  if (method === 'standard-deviation') return 'Std dev';
  if (method === 'sum') return 'Sum';
  return 'Variance';
}

export function createHeatmapView(): HeatmapViewController {
  let context: HistogramPageContext = { traces: [], aTimeMs: undefined, bTimeMs: undefined };
  let currentResult: NumericHeatmapResult | undefined;

  const root = document.createElement('section');
  root.className = 'heatmap-view';
  root.hidden = true;
  root.innerHTML = `
    <div class="heatmap-controls">
      <label>
        <span>X channel</span>
        <select class="heatmap-x-channel"></select>
      </label>
      <label>
        <span>Y channel</span>
        <select class="heatmap-y-channel"></select>
      </label>
      <label>
        <span>Cell value</span>
        <select class="heatmap-aggregation">
          <option value="count">Count</option>
          <option value="mean">Mean</option>
          <option value="min">Minimum</option>
          <option value="max">Maximum</option>
          <option value="standard-deviation">Std dev</option>
        </select>
      </label>
      <label class="heatmap-value-channel-field" hidden>
        <span>Value channel</span>
        <select class="heatmap-value-channel"></select>
      </label>
      <label>
        <span>X bins</span>
        <select class="heatmap-x-bins">
          <option value="10">10</option>
          <option value="20" selected>20</option>
          <option value="30">30</option>
          <option value="40">40</option>
        </select>
      </label>
      <label>
        <span>Y bins</span>
        <select class="heatmap-y-bins">
          <option value="10">10</option>
          <option value="20" selected>20</option>
          <option value="30">30</option>
          <option value="40">40</option>
        </select>
      </label>
      <button type="button" class="heatmap-refresh">Refresh</button>
    </div>
    <div class="heatmap-empty">
      <strong>Heatmap needs a selected range and two active channels.</strong>
      <span>Return to Logger, set A and B, and keep both X and Y channels active in the current graph pane.</span>
    </div>
    <div class="heatmap-content" hidden>
      <div class="heatmap-summary">
        <div><span>Scope</span><strong data-heatmap-summary="scope">—</strong></div>
        <div><span>Coverage</span><strong data-heatmap-summary="coverage">—</strong></div>
        <div><span>Input</span><strong data-heatmap-summary="input">0</strong></div>
        <div><span>Valid XY pairs</span><strong data-heatmap-summary="valid">0</strong></div>
        <div><span>XY invalid</span><strong data-heatmap-summary="invalid">0</strong></div>
        <div><span>XY unavailable</span><strong data-heatmap-summary="unavailable">0</strong></div>
      </div>
      <div class="heatmap-chart-wrap">
        <canvas class="heatmap-chart" aria-label="Two-dimensional histogram heatmap"></canvas>
      </div>
      <div class="heatmap-axis-summary">
        <span>X <strong data-heatmap-summary="x-range">—</strong></span>
        <span>Y <strong data-heatmap-summary="y-range">—</strong></span>
        <span>Cell value <strong data-heatmap-summary="cell-value">Count</strong></span>
        <span>Cell range <strong data-heatmap-summary="cell-range">—</strong></span>
        <span>Binned <strong data-heatmap-summary="binned">0</strong></span>
        <span>Outside range <strong data-heatmap-summary="outside">0</strong></span>
      </div>
      <div class="heatmap-value-evidence" hidden>
        <span>Value samples <strong data-heatmap-summary="value-valid">0</strong></span>
        <span>Value invalid <strong data-heatmap-summary="value-invalid">0</strong></span>
        <span>Value unavailable <strong data-heatmap-summary="value-unavailable">0</strong></span>
      </div>
    </div>
  `;

  const xSelect = root.querySelector<HTMLSelectElement>('.heatmap-x-channel');
  const ySelect = root.querySelector<HTMLSelectElement>('.heatmap-y-channel');
  const aggregationSelect = root.querySelector<HTMLSelectElement>('.heatmap-aggregation');
  const valueField = root.querySelector<HTMLElement>('.heatmap-value-channel-field');
  const valueSelect = root.querySelector<HTMLSelectElement>('.heatmap-value-channel');
  const xBinsSelect = root.querySelector<HTMLSelectElement>('.heatmap-x-bins');
  const yBinsSelect = root.querySelector<HTMLSelectElement>('.heatmap-y-bins');
  const refreshButton = root.querySelector<HTMLButtonElement>('.heatmap-refresh');
  const empty = root.querySelector<HTMLElement>('.heatmap-empty');
  const content = root.querySelector<HTMLElement>('.heatmap-content');
  const valueEvidence = root.querySelector<HTMLElement>('.heatmap-value-evidence');
  const canvas = root.querySelector<HTMLCanvasElement>('.heatmap-chart');
  if (!xSelect || !ySelect || !aggregationSelect || !valueField || !valueSelect || !xBinsSelect || !yBinsSelect || !refreshButton || !empty || !content || !valueEvidence || !canvas) {
    throw new Error('Heatmap view structure is incomplete.');
  }

  const summary = (name: string): HTMLElement => {
    const node = root.querySelector<HTMLElement>(`[data-heatmap-summary="${name}"]`);
    if (!node) throw new Error(`Heatmap summary field is missing: ${name}`);
    return node;
  };

  const traceFor = (channelId: string): HistogramTraceContext | undefined =>
    context.traces.find((trace) => trace.channel.id === channelId);

  const selectedAggregation = (): NumericAggregationMethod =>
    aggregationSelect.value as NumericAggregationMethod;

  const hasValidRange = (): boolean =>
    context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs;

  const cellValueUnit = (
    method: NumericAggregationMethod,
    valueTrace: HistogramTraceContext | undefined,
  ): string => {
    if (method === 'count') return '';
    if (method === 'variance') return valueTrace?.channel.unit ? `${valueTrace.channel.unit}²` : '';
    return valueTrace?.channel.unit ?? '';
  };

  const renderChart = (
    result: NumericHeatmapResult,
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
    if (result.xBins.length === 0 || result.yBins.length === 0) return;

    const padLeft = 64;
    const padRight = 22;
    const padTop = 20;
    const padBottom = 48;
    const chartWidth = Math.max(1, width - padLeft - padRight);
    const chartHeight = Math.max(1, height - padTop - padBottom);
    const cellWidth = chartWidth / result.xBins.length;
    const cellHeight = chartHeight / result.yBins.length;
    const valueMin = result.cellValueMin;
    const valueMax = result.cellValueMax;
    const valueSpan = valueMin === undefined || valueMax === undefined ? 0 : valueMax - valueMin;

    ctx.fillStyle = '#0b171f';
    ctx.fillRect(padLeft, padTop, chartWidth, chartHeight);

    for (let yIndex = 0; yIndex < result.yBins.length; yIndex += 1) {
      for (let xIndex = 0; xIndex < result.xBins.length; xIndex += 1) {
        const cellIndex = yIndex * result.xBins.length + xIndex;
        const value = result.cellValues[cellIndex];
        if (value === undefined || !Number.isFinite(value)) continue;
        const normalized = result.aggregationMethod === 'count'
          ? Math.max(0, Math.min(1, value / Math.max(1, result.maxCellCount)))
          : valueSpan > 0 && valueMin !== undefined
            ? Math.max(0, Math.min(1, (value - valueMin) / valueSpan))
            : 1;
        const intensity = result.aggregationMethod === 'count' ? Math.sqrt(normalized) : normalized;
        const x = padLeft + xIndex * cellWidth;
        const y = padTop + chartHeight - (yIndex + 1) * cellHeight;
        ctx.globalAlpha = 0.18 + intensity * 0.82;
        ctx.fillStyle = xTrace.color || '#58aef6';
        ctx.fillRect(x + 0.5, y + 0.5, Math.max(1, cellWidth - 1), Math.max(1, cellHeight - 1));
      }
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(91, 118, 136, .5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(padLeft, padTop, chartWidth, chartHeight);

    ctx.fillStyle = '#78909e';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(formatNumber(result.xRangeMin), padLeft, padTop + chartHeight + 7);
    ctx.textAlign = 'right';
    ctx.fillText(formatNumber(result.xRangeMax), padLeft + chartWidth, padTop + chartHeight + 7);
    ctx.textAlign = 'center';
    ctx.fillText(`${channelLabel(xTrace)}${xTrace.channel.unit ? ` · ${xTrace.channel.unit}` : ''}`, padLeft + chartWidth / 2, padTop + chartHeight + 25);

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText(formatNumber(result.yRangeMax), padLeft - 7, padTop + 3);
    ctx.fillText(formatNumber(result.yRangeMin), padLeft - 7, padTop + chartHeight - 3);

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
    const aggregation = selectedAggregation();
    const valueTrace = aggregation === 'count'
      ? undefined
      : traceFor(valueSelect.value) ?? context.traces[0];
    valueField.hidden = aggregation === 'count';
    valueEvidence.hidden = aggregation === 'count';

    if (!xTrace || !yTrace || context.traces.length < 2 || !hasValidRange() || (aggregation !== 'count' && !valueTrace)) {
      currentResult = undefined;
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

    currentResult = buildNumericHeatmap(xTrace.range, yTrace.range, {
      sampleIndices: scoped.eligibleSampleIndices,
      xBinCount: Number(xBinsSelect.value),
      yBinCount: Number(yBinsSelect.value),
      aggregation,
      ...(valueTrace ? { valueRange: valueTrace.range } : {}),
    });

    const yComplete = yTrace.complete || numericRangeCoversTime(yTrace.range, startMs, endMs);
    const valueComplete = !valueTrace
      || valueTrace.complete
      || numericRangeCoversTime(valueTrace.range, startMs, endMs);
    const complete = scoped.complete
      && yComplete
      && valueComplete
      && currentResult.unavailableSampleCount === 0
      && currentResult.valueUnavailableSampleCount === 0;
    const unit = cellValueUnit(aggregation, valueTrace);
    const cellMeaning = aggregation === 'count'
      ? 'Count'
      : `${aggregationLabel(aggregation)} · ${channelLabel(valueTrace!)}`;

    empty.hidden = true;
    content.hidden = false;
    summary('scope').textContent = `${((endMs - startMs) / 1000).toFixed(3)} s`;
    summary('coverage').textContent = complete ? 'Complete' : 'Partial decoded';
    summary('input').textContent = currentResult.inputSampleCount.toLocaleString();
    summary('valid').textContent = currentResult.validPairSampleCount.toLocaleString();
    summary('invalid').textContent = currentResult.invalidSampleCount.toLocaleString();
    summary('unavailable').textContent = currentResult.unavailableSampleCount.toLocaleString();
    summary('binned').textContent = currentResult.binnedSampleCount.toLocaleString();
    summary('outside').textContent = currentResult.outsideRangeSampleCount.toLocaleString();
    summary('cell-value').textContent = cellMeaning;
    summary('cell-range').textContent = currentResult.cellValueMin === undefined || currentResult.cellValueMax === undefined
      ? '—'
      : `${formatNumber(currentResult.cellValueMin)} – ${formatNumber(currentResult.cellValueMax)}${unit ? ` ${unit}` : ''}`;
    summary('value-valid').textContent = currentResult.valueValidSampleCount.toLocaleString();
    summary('value-invalid').textContent = currentResult.valueInvalidSampleCount.toLocaleString();
    summary('value-unavailable').textContent = currentResult.valueUnavailableSampleCount.toLocaleString();
    summary('x-range').textContent = currentResult.xRangeMin === undefined || currentResult.xRangeMax === undefined
      ? '—'
      : `${formatNumber(currentResult.xRangeMin)} – ${formatNumber(currentResult.xRangeMax)}${xTrace.channel.unit ? ` ${xTrace.channel.unit}` : ''}`;
    summary('y-range').textContent = currentResult.yRangeMin === undefined || currentResult.yRangeMax === undefined
      ? '—'
      : `${formatNumber(currentResult.yRangeMin)} – ${formatNumber(currentResult.yRangeMax)}${yTrace.channel.unit ? ` ${yTrace.channel.unit}` : ''}`;
    renderChart(currentResult, xTrace, yTrace);
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
    const previousValue = valueSelect.value;
    context = nextContext;
    fillSelect(xSelect, previousX, 0);
    fillSelect(ySelect, previousY, 1);
    fillSelect(valueSelect, previousValue, 0);
    render();
  };

  xSelect.addEventListener('change', render);
  ySelect.addEventListener('change', render);
  aggregationSelect.addEventListener('change', render);
  valueSelect.addEventListener('change', render);
  xBinsSelect.addEventListener('change', render);
  yBinsSelect.addEventListener('change', render);
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
