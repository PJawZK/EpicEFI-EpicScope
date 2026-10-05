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

export interface HeatmapViewOptions {
  readonly label?: string;
  readonly compact?: boolean;
}

function formatNumber(value: number | undefined, precision = 3): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  return value.toFixed(precision).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function formatCellValue(value: number | undefined, method: NumericAggregationMethod, availableWidth: number): string {
  if (value === undefined || !Number.isFinite(value)) return method === 'count' ? '0' : '—';
  if (method === 'count') return Math.round(value).toLocaleString();
  const abs = Math.abs(value);
  const precision = availableWidth < 28 ? 0 : availableWidth < 42 ? 1 : abs >= 100 ? 1 : 2;
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

export function createHeatmapView(options: HeatmapViewOptions = {}): HeatmapViewController {
  let context: HistogramPageContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined };
  let currentResult: NumericHeatmapResult | undefined;
  let currentXTrace: HistogramTraceContext | undefined;
  let currentYTrace: HistogramTraceContext | undefined;

  const root = document.createElement('section');
  root.className = `heatmap-view${options.compact ? ' heatmap-view--compact' : ''}`;
  root.hidden = true;
  root.innerHTML = `
    <div class="heatmap-toolbar">
      ${options.label ? `<strong class="heatmap-pane-label">${options.label}</strong>` : ''}
      <label class="heatmap-inline-field"><span>X</span><select class="heatmap-x-channel"></select></label>
      <label class="heatmap-inline-field"><span>Y</span><select class="heatmap-y-channel"></select></label>
      <label class="heatmap-inline-field"><span>Cell</span><select class="heatmap-aggregation">
        <option value="count">Count</option>
        <option value="mean">Mean</option>
        <option value="min">Minimum</option>
        <option value="max">Maximum</option>
        <option value="standard-deviation">Std dev</option>
      </select></label>
      <label class="heatmap-inline-field heatmap-value-channel-field" hidden><span>Value</span><select class="heatmap-value-channel"></select></label>
      <details class="heatmap-options">
        <summary>Options</summary>
        <div class="heatmap-options-popover">
          <label><span>X bins</span><select class="heatmap-x-bins"><option value="8">8</option><option value="10">10</option><option value="12">12</option><option value="16">16</option><option value="20" selected>20</option><option value="24">24</option><option value="30">30</option><option value="40">40</option></select></label>
          <label><span>Y bins</span><select class="heatmap-y-bins"><option value="8">8</option><option value="10">10</option><option value="12">12</option><option value="16">16</option><option value="20" selected>20</option><option value="24">24</option><option value="30">30</option><option value="40">40</option></select></label>
          <p>Cell values are always drawn in the table. Empty count cells show 0; empty statistical cells show —.</p>
        </div>
      </details>
    </div>
    <div class="heatmap-stage">
      <div class="heatmap-empty">
        <strong>Heatmap needs a selected range and two available channels.</strong>
        <span>Set A/B in Logger, then choose any X/Y/value channels present in the loaded log.</span>
      </div>
      <canvas class="heatmap-chart" aria-label="Two-dimensional histogram heatmap table"></canvas>
      <div class="heatmap-stage-status" hidden>
        <span data-heatmap-summary="scope">—</span>
        <span data-heatmap-summary="coverage">—</span>
        <span data-heatmap-summary="cell-value">Count</span>
        <span data-heatmap-summary="cell-range">—</span>
        <span>Pairs <strong data-heatmap-summary="valid">0</strong></span>
        <span>Binned <strong data-heatmap-summary="binned">0</strong></span>
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
  const empty = root.querySelector<HTMLElement>('.heatmap-empty');
  const status = root.querySelector<HTMLElement>('.heatmap-stage-status');
  const canvas = root.querySelector<HTMLCanvasElement>('.heatmap-chart');
  if (!xSelect || !ySelect || !aggregationSelect || !valueField || !valueSelect || !xBinsSelect || !yBinsSelect || !empty || !status || !canvas) {
    throw new Error('Heatmap view structure is incomplete.');
  }

  const summary = (name: string): HTMLElement => {
    const node = root.querySelector<HTMLElement>(`[data-heatmap-summary="${name}"]`);
    if (!node) throw new Error(`Heatmap summary field is missing: ${name}`);
    return node;
  };

  const selectedAggregation = (): NumericAggregationMethod => aggregationSelect.value as NumericAggregationMethod;
  const hasValidRange = (): boolean => context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs;

  const cellValueUnit = (method: NumericAggregationMethod, valueTrace: HistogramTraceContext | undefined): string => {
    if (method === 'count') return '';
    if (method === 'variance') return valueTrace?.channel.unit ? `${valueTrace.channel.unit}²` : '';
    return valueTrace?.channel.unit ?? '';
  };

  const renderChart = (result: NumericHeatmapResult, xTrace: HistogramTraceContext, yTrace: HistogramTraceContext): void => {
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

    const padLeft = options.compact ? 52 : 62;
    const padRight = 10;
    const padTop = 8;
    const padBottom = options.compact ? 34 : 40;
    const chartWidth = Math.max(1, width - padLeft - padRight);
    const chartHeight = Math.max(1, height - padTop - padBottom);
    const cellWidth = chartWidth / result.xBins.length;
    const cellHeight = chartHeight / result.yBins.length;
    const valueMin = result.cellValueMin;
    const valueMax = result.cellValueMax;
    const valueSpan = valueMin === undefined || valueMax === undefined ? 0 : valueMax - valueMin;

    ctx.fillStyle = '#071119';
    ctx.fillRect(padLeft, padTop, chartWidth, chartHeight);

    for (let yIndex = 0; yIndex < result.yBins.length; yIndex += 1) {
      for (let xIndex = 0; xIndex < result.xBins.length; xIndex += 1) {
        const cellIndex = yIndex * result.xBins.length + xIndex;
        const rawValue = result.cellValues[cellIndex];
        const count = result.counts[cellIndex] ?? 0;
        const displayValue = result.aggregationMethod === 'count' ? count : rawValue;
        const finite = displayValue !== undefined && Number.isFinite(displayValue);
        const normalized = !finite
          ? 0
          : result.aggregationMethod === 'count'
            ? Math.max(0, Math.min(1, Number(displayValue) / Math.max(1, result.maxCellCount)))
            : valueSpan > 0 && valueMin !== undefined
              ? Math.max(0, Math.min(1, (Number(displayValue) - valueMin) / valueSpan))
              : 1;
        const intensity = result.aggregationMethod === 'count' ? Math.sqrt(normalized) : normalized;
        const x = padLeft + xIndex * cellWidth;
        const y = padTop + chartHeight - (yIndex + 1) * cellHeight;

        if (finite && (count > 0 || result.aggregationMethod !== 'count')) {
          ctx.globalAlpha = 0.16 + intensity * 0.84;
          ctx.fillStyle = xTrace.color || '#58aef6';
          ctx.fillRect(x, y, cellWidth, cellHeight);
          ctx.globalAlpha = 1;
        }

        ctx.strokeStyle = 'rgba(73, 103, 122, .42)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, cellWidth - 1), Math.max(0, cellHeight - 1));

        const text = formatCellValue(finite ? Number(displayValue) : undefined, result.aggregationMethod, cellWidth);
        const fontSize = Math.max(6, Math.min(11, Math.floor(cellHeight * 0.42), Math.floor(cellWidth / Math.max(3, text.length) * 1.45)));
        ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = intensity > 0.62 ? '#061018' : count > 0 ? '#eef8fc' : '#66808f';
        ctx.fillText(text, x + cellWidth / 2, y + cellHeight / 2, Math.max(1, cellWidth - 3));
      }
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#7f96a5';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    const xStep = Math.max(1, Math.ceil(result.xBins.length / Math.max(4, Math.floor(chartWidth / 70))));
    result.xBins.forEach((bin, index) => {
      if (index % xStep !== 0 && index !== result.xBins.length - 1) return;
      const center = padLeft + (index + 0.5) * cellWidth;
      ctx.textAlign = 'center';
      ctx.fillText(formatNumber((bin.lowerBound + bin.upperBound) / 2, 1), center, padTop + chartHeight + 5);
    });
    ctx.textAlign = 'center';
    ctx.fillText(`${channelLabel(xTrace)}${xTrace.channel.unit ? ` · ${xTrace.channel.unit}` : ''}`, padLeft + chartWidth / 2, padTop + chartHeight + 20);

    ctx.textBaseline = 'middle';
    const yStep = Math.max(1, Math.ceil(result.yBins.length / Math.max(4, Math.floor(chartHeight / 34))));
    result.yBins.forEach((bin, index) => {
      if (index % yStep !== 0 && index !== result.yBins.length - 1) return;
      const center = padTop + chartHeight - (index + 0.5) * cellHeight;
      ctx.textAlign = 'right';
      ctx.fillText(formatNumber((bin.lowerBound + bin.upperBound) / 2, 1), padLeft - 6, center);
    });
    ctx.save();
    ctx.translate(11, padTop + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(`${channelLabel(yTrace)}${yTrace.channel.unit ? ` · ${yTrace.channel.unit}` : ''}`, 0, 0);
    ctx.restore();
  };

  const render = async (): Promise<void> => {
    const xId = xSelect.value || context.channels[0]?.id;
    const yId = ySelect.value || context.channels[1]?.id || context.channels[0]?.id;
    const aggregation = selectedAggregation();
    const valueId = aggregation === 'count' ? undefined : (valueSelect.value || context.channels[0]?.id);
    valueField.hidden = aggregation === 'count';

    if (!xId || !yId || context.channels.length < 2 || !hasValidRange() || (aggregation !== 'count' && !valueId)) {
      currentResult = undefined;
      currentXTrace = undefined;
      currentYTrace = undefined;
      empty.hidden = false;
      canvas.hidden = true;
      status.hidden = true;
      return;
    }

    const startMs = Math.min(context.aTimeMs!, context.bTimeMs!);
    const endMs = Math.max(context.aTimeMs!, context.bTimeMs!);
    const loaded = await context.loadTraces([xId, yId, ...(valueId ? [valueId] : [])], startMs, endMs);
    const byId = new Map(loaded.map((trace) => [trace.channel.id, trace]));
    const xTrace = byId.get(xId);
    const yTrace = byId.get(yId);
    const valueTrace = valueId ? byId.get(valueId) : undefined;
    if (!xTrace || !yTrace || (aggregation !== 'count' && !valueTrace)) {
      currentResult = undefined;
      currentXTrace = undefined;
      currentYTrace = undefined;
      empty.hidden = false;
      canvas.hidden = true;
      status.hidden = true;
      return;
    }

    const channels = new Map([[xTrace.channel.id, { range: xTrace.range, complete: xTrace.complete }]]);
    const scoped = qualifyNumericSamples({ referenceChannelId: xTrace.channel.id, channels, conditions: [], timeRange: { startMs, endMs } });

    currentResult = buildNumericHeatmap(xTrace.range, yTrace.range, {
      sampleIndices: scoped.eligibleSampleIndices,
      xBinCount: Number(xBinsSelect.value),
      yBinCount: Number(yBinsSelect.value),
      aggregation,
      ...(valueTrace ? { valueRange: valueTrace.range } : {}),
    });
    currentXTrace = xTrace;
    currentYTrace = yTrace;

    const yComplete = yTrace.complete || numericRangeCoversTime(yTrace.range, startMs, endMs);
    const valueComplete = !valueTrace || valueTrace.complete || numericRangeCoversTime(valueTrace.range, startMs, endMs);
    const complete = scoped.complete && yComplete && valueComplete && currentResult.unavailableSampleCount === 0 && currentResult.valueUnavailableSampleCount === 0;
    const unit = cellValueUnit(aggregation, valueTrace);
    const cellMeaning = aggregation === 'count' ? 'Count' : `${aggregationLabel(aggregation)} · ${channelLabel(valueTrace!)}`;

    empty.hidden = true;
    canvas.hidden = false;
    status.hidden = false;
    summary('scope').textContent = `A/B ${((endMs - startMs) / 1000).toFixed(3)} s`;
    summary('coverage').textContent = complete ? 'Complete' : 'Partial decoded';
    summary('valid').textContent = currentResult.validPairSampleCount.toLocaleString();
    summary('binned').textContent = currentResult.binnedSampleCount.toLocaleString();
    summary('cell-value').textContent = cellMeaning;
    summary('cell-range').textContent = currentResult.cellValueMin === undefined || currentResult.cellValueMax === undefined
      ? '—'
      : `${formatNumber(currentResult.cellValueMin)}–${formatNumber(currentResult.cellValueMax)}${unit ? ` ${unit}` : ''}`;
    renderChart(currentResult, xTrace, yTrace);
  };

  const fillSelects = (previousX: string, previousY: string, previousValue: string): void => {
    xSelect.replaceChildren();
    ySelect.replaceChildren();
    valueSelect.replaceChildren();
    for (const channel of context.channels) {
      const label = channel.displayName || channel.sourceName;
      xSelect.add(new Option(label, channel.id));
      ySelect.add(new Option(label, channel.id));
      valueSelect.add(new Option(label, channel.id));
    }
    if (context.channels.some((channel) => channel.id === previousX)) xSelect.value = previousX;
    if (context.channels.some((channel) => channel.id === previousY)) ySelect.value = previousY;
    else if (context.channels[1]) ySelect.value = context.channels[1].id;
    if (context.channels.some((channel) => channel.id === previousValue)) valueSelect.value = previousValue;
  };

  const setContext = (nextContext: HistogramPageContext): void => {
    const previousX = xSelect.value;
    const previousY = ySelect.value;
    const previousValue = valueSelect.value;
    context = nextContext;
    fillSelects(previousX, previousY, previousValue);
    void render();
  };

  [xSelect, ySelect, aggregationSelect, valueSelect, xBinsSelect, yBinsSelect].forEach((control) => control.addEventListener('change', () => { void render(); }));
  new ResizeObserver(() => {
    if (currentResult && currentXTrace && currentYTrace && !canvas.hidden && !root.hidden) renderChart(currentResult, currentXTrace, currentYTrace);
  }).observe(canvas);

  return { element: root, setContext, refresh: () => { void render(); } };
}
