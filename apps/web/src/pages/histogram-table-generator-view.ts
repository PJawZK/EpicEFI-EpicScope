import { buildNumericHeatmap, type NumericHeatmapResult } from '../../../../core/analysis/heatmap';
import type { NumericAggregationMethod } from '../../../../core/analysis/numeric-aggregation';
import { subtractNumericRanges } from '../../../../core/analysis/numeric-range-arithmetic';
import {
  qualifyNumericSamples,
  type NumericQualificationCondition,
  type NumericQualificationOperator,
} from '../../../../core/analysis/sample-qualification';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import type { ChannelDefinition } from '../../../../core/log-model/log-types';
import type { HistogramPageContext, HistogramTraceContext } from './histogram-page';

export interface HistogramTableGeneratorController {
  readonly element: HTMLElement;
  setContext(context: HistogramPageContext): void;
  refresh(): void;
}

interface FilterRowControls {
  readonly row: HTMLElement;
  readonly enabled: HTMLInputElement;
  readonly channel: HTMLSelectElement;
  readonly operator: HTMLSelectElement;
  readonly value: HTMLInputElement;
}

interface ResolvedScope {
  readonly label: string;
  readonly startMs?: number;
  readonly endMs?: number;
}

interface ChartLayout {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
}

const MAX_FILTERS = 6;

function channelLabel(channel: ChannelDefinition): string {
  return channel.displayName || channel.sourceName;
}

function traceLabel(trace: HistogramTraceContext): string {
  return channelLabel(trace.channel);
}

function formatNumber(value: number | undefined, precision = 3): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  return value.toFixed(precision).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function formatCellValue(value: number | undefined, method: NumericAggregationMethod, width: number): string {
  if (value === undefined || !Number.isFinite(value)) return method === 'count' ? '0' : '—';
  if (method === 'count') return Math.round(value).toLocaleString();
  const precision = width < 30 ? 0 : width < 48 ? 1 : Math.abs(value) >= 100 ? 1 : 2;
  return value.toFixed(precision).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function aggregationLabel(method: NumericAggregationMethod): string {
  if (method === 'count') return 'Count';
  if (method === 'mean') return 'Mean';
  if (method === 'min') return 'Minimum';
  if (method === 'max') return 'Maximum';
  if (method === 'sum') return 'Sum';
  if (method === 'standard-deviation') return 'Std dev';
  return 'Variance';
}

function operatorLabel(operator: NumericQualificationOperator): string {
  if (operator === 'gt') return '>';
  if (operator === 'gte') return '≥';
  if (operator === 'lt') return '<';
  if (operator === 'lte') return '≤';
  return '=';
}

function optionalFinite(input: HTMLInputElement): number | undefined {
  const raw = input.value.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function binCount(input: HTMLInputElement, fallback: number): number {
  const value = Number(input.value);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(64, Math.floor(value)));
}

function preferredChannel(
  channels: readonly ChannelDefinition[],
  patterns: readonly RegExp[],
  fallbackIndex: number,
): ChannelDefinition | undefined {
  return channels.find((channel) => {
    const label = `${channel.displayName} ${channel.sourceName}`;
    return patterns.some((pattern) => pattern.test(label));
  }) ?? channels[fallbackIndex] ?? channels[0];
}

function safeFilenamePart(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'histogram';
}

export function createHistogramTableGeneratorView(): HistogramTableGeneratorController {
  let context: HistogramPageContext = {
    traces: [],
    channels: [],
    loadTraces: async () => [],
    aTimeMs: undefined,
    bTimeMs: undefined,
  };
  let renderGeneration = 0;
  let renderTimer: number | undefined;
  let currentResult: NumericHeatmapResult | undefined;
  let currentXTrace: HistogramTraceContext | undefined;
  let currentYTrace: HistogramTraceContext | undefined;
  let currentZTrace: HistogramTraceContext | undefined;
  let currentDeltaTrace: HistogramTraceContext | undefined;
  let currentScope: ResolvedScope | undefined;
  let currentFilterDescription = 'None';
  let layout: ChartLayout | undefined;

  const root = document.createElement('section');
  root.className = 'histogram-table-generator-view';
  root.hidden = true;
  root.innerHTML = `
    <div class="histogram-table-toolbar">
      <label><span>Scope</span><select class="histogram-table-scope"></select></label>
      <label><span>X</span><select class="histogram-table-x"></select></label>
      <label><span>Y</span><select class="histogram-table-y"></select></label>
      <label class="histogram-table-z-field"><span>Z</span><select class="histogram-table-z"></select></label>
      <label><span>Cell</span><select class="histogram-table-aggregation">
        <option value="mean" selected>Mean</option>
        <option value="count">Count</option>
        <option value="min">Minimum</option>
        <option value="max">Maximum</option>
        <option value="sum">Sum</option>
        <option value="standard-deviation">Std dev</option>
        <option value="variance">Variance</option>
      </select></label>
      <label class="histogram-table-delta-field"><span>Z delta</span><select class="histogram-table-delta"><option value="">(none)</option></select></label>
      <details class="histogram-table-filters">
        <summary>Filters <span class="histogram-filter-count">0</span></summary>
        <div class="histogram-table-filter-popover">
          <div class="histogram-filter-list"></div>
          <div class="histogram-filter-actions">
            <button type="button" class="histogram-add-filter">+ Add filter</button>
            <span>Enabled filters use AND semantics.</span>
          </div>
        </div>
      </details>
      <details class="histogram-table-options">
        <summary>Table</summary>
        <div class="histogram-table-options-popover">
          <label><span>X columns</span><input class="histogram-table-x-bins" type="number" min="1" max="64" step="1" value="16" /></label>
          <label><span>Y rows</span><input class="histogram-table-y-bins" type="number" min="1" max="64" step="1" value="16" /></label>
          <label><span>X min</span><input class="histogram-table-x-min" type="number" step="any" placeholder="Auto" /></label>
          <label><span>X max</span><input class="histogram-table-x-max" type="number" step="any" placeholder="Auto" /></label>
          <label><span>Y min</span><input class="histogram-table-y-min" type="number" step="any" placeholder="Auto" /></label>
          <label><span>Y max</span><input class="histogram-table-y-max" type="number" step="any" placeholder="Auto" /></label>
          <label class="histogram-table-toggle"><input class="histogram-table-show-hits" type="checkbox" checked /><span>Show hit count in cells</span></label>
          <p>Set Y rows to 1 for an MLV-style single-row bar graph. Blank limits use observed data range.</p>
        </div>
      </details>
      <button type="button" class="histogram-table-export" disabled>Export CSV</button>
    </div>
    <div class="histogram-table-stage">
      <div class="histogram-table-empty">
        <strong>Table Generator needs analyzable log data.</strong>
        <span>Use A/B, a saved range, or the whole log, then choose any available X/Y/Z channels.</span>
      </div>
      <canvas class="histogram-table-canvas" aria-label="Histogram table generator"></canvas>
      <div class="histogram-table-tooltip" hidden></div>
      <div class="histogram-table-status" hidden>
        <span data-hist-table-summary="scope">—</span>
        <span data-hist-table-summary="coverage">—</span>
        <span data-hist-table-summary="cell">—</span>
        <span>Input <strong data-hist-table-summary="input">0</strong></span>
        <span>Eligible <strong data-hist-table-summary="eligible">0</strong></span>
        <span>Filtered <strong data-hist-table-summary="filtered">0</strong></span>
        <span>Binned <strong data-hist-table-summary="binned">0</strong></span>
        <span>Outside <strong data-hist-table-summary="outside">0</strong></span>
      </div>
    </div>
  `;

  const scopeSelect = root.querySelector<HTMLSelectElement>('.histogram-table-scope');
  const xSelect = root.querySelector<HTMLSelectElement>('.histogram-table-x');
  const ySelect = root.querySelector<HTMLSelectElement>('.histogram-table-y');
  const zField = root.querySelector<HTMLElement>('.histogram-table-z-field');
  const zSelect = root.querySelector<HTMLSelectElement>('.histogram-table-z');
  const aggregationSelect = root.querySelector<HTMLSelectElement>('.histogram-table-aggregation');
  const deltaField = root.querySelector<HTMLElement>('.histogram-table-delta-field');
  const deltaSelect = root.querySelector<HTMLSelectElement>('.histogram-table-delta');
  const filterCount = root.querySelector<HTMLElement>('.histogram-filter-count');
  const filterList = root.querySelector<HTMLElement>('.histogram-filter-list');
  const addFilterButton = root.querySelector<HTMLButtonElement>('.histogram-add-filter');
  const xBinsInput = root.querySelector<HTMLInputElement>('.histogram-table-x-bins');
  const yBinsInput = root.querySelector<HTMLInputElement>('.histogram-table-y-bins');
  const xMinInput = root.querySelector<HTMLInputElement>('.histogram-table-x-min');
  const xMaxInput = root.querySelector<HTMLInputElement>('.histogram-table-x-max');
  const yMinInput = root.querySelector<HTMLInputElement>('.histogram-table-y-min');
  const yMaxInput = root.querySelector<HTMLInputElement>('.histogram-table-y-max');
  const showHitsInput = root.querySelector<HTMLInputElement>('.histogram-table-show-hits');
  const exportButton = root.querySelector<HTMLButtonElement>('.histogram-table-export');
  const empty = root.querySelector<HTMLElement>('.histogram-table-empty');
  const status = root.querySelector<HTMLElement>('.histogram-table-status');
  const canvas = root.querySelector<HTMLCanvasElement>('.histogram-table-canvas');
  const tooltip = root.querySelector<HTMLElement>('.histogram-table-tooltip');
  if (
    !scopeSelect || !xSelect || !ySelect || !zField || !zSelect || !aggregationSelect || !deltaField || !deltaSelect
    || !filterCount || !filterList || !addFilterButton || !xBinsInput || !yBinsInput || !xMinInput || !xMaxInput
    || !yMinInput || !yMaxInput || !showHitsInput || !exportButton || !empty || !status || !canvas || !tooltip
  ) {
    throw new Error('Histogram table generator structure is incomplete.');
  }

  const filters: FilterRowControls[] = [];
  const summary = (name: string): HTMLElement => {
    const node = root.querySelector<HTMLElement>(`[data-hist-table-summary="${name}"]`);
    if (!node) throw new Error(`Histogram table summary field is missing: ${name}`);
    return node;
  };
  const selectedAggregation = (): NumericAggregationMethod => aggregationSelect.value as NumericAggregationMethod;

  const refillChannelSelect = (select: HTMLSelectElement, previous: string, includeNone = false): void => {
    select.replaceChildren();
    if (includeNone) select.add(new Option('(none)', ''));
    for (const channel of context.channels) select.add(new Option(channelLabel(channel), channel.id));
    if (previous && context.channels.some((channel) => channel.id === previous)) select.value = previous;
  };

  const scheduleRender = (delay = 0): void => {
    if (renderTimer !== undefined) window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      renderTimer = undefined;
      void render();
    }, delay);
  };

  const updateFilterCount = (): void => {
    const enabledCount = filters.filter((filter) => filter.enabled.checked).length;
    filterCount.textContent = String(enabledCount);
    filterCount.dataset.active = enabledCount > 0 ? 'true' : 'false';
    addFilterButton.disabled = filters.length >= MAX_FILTERS;
  };

  const addFilter = (): void => {
    if (filters.length >= MAX_FILTERS) return;
    const row = document.createElement('div');
    row.className = 'histogram-filter-row';
    row.innerHTML = `
      <input class="histogram-filter-enabled" type="checkbox" checked aria-label="Enable filter" />
      <select class="histogram-filter-channel" aria-label="Filter channel"></select>
      <select class="histogram-filter-operator" aria-label="Filter operator">
        <option value="gt">&gt;</option><option value="gte">≥</option><option value="lt">&lt;</option><option value="lte">≤</option><option value="eq">=</option>
      </select>
      <input class="histogram-filter-value" type="number" step="any" value="0" aria-label="Filter value" />
      <button type="button" class="histogram-filter-remove" aria-label="Remove filter">×</button>
    `;
    const enabled = row.querySelector<HTMLInputElement>('.histogram-filter-enabled');
    const channel = row.querySelector<HTMLSelectElement>('.histogram-filter-channel');
    const operator = row.querySelector<HTMLSelectElement>('.histogram-filter-operator');
    const value = row.querySelector<HTMLInputElement>('.histogram-filter-value');
    const remove = row.querySelector<HTMLButtonElement>('.histogram-filter-remove');
    if (!enabled || !channel || !operator || !value || !remove) throw new Error('Histogram filter row is incomplete.');
    for (const definition of context.channels) channel.add(new Option(channelLabel(definition), definition.id));
    const controls: FilterRowControls = { row, enabled, channel, operator, value };
    filters.push(controls);
    filterList.append(row);
    enabled.addEventListener('change', () => { updateFilterCount(); scheduleRender(); });
    channel.addEventListener('change', () => scheduleRender());
    operator.addEventListener('change', () => scheduleRender());
    value.addEventListener('input', () => scheduleRender(140));
    remove.addEventListener('click', () => {
      const index = filters.indexOf(controls);
      if (index >= 0) filters.splice(index, 1);
      row.remove();
      updateFilterCount();
      scheduleRender();
    });
    updateFilterCount();
    scheduleRender();
  };

  const enabledConditions = (): readonly NumericQualificationCondition[] => filters.flatMap((filter) => {
    if (!filter.enabled.checked || !filter.channel.value) return [];
    const value = Number(filter.value.value);
    if (!Number.isFinite(value)) return [];
    return [{
      channelId: filter.channel.value,
      operator: filter.operator.value as NumericQualificationOperator,
      value,
    }];
  });

  const populateScopeOptions = (): void => {
    const previous = scopeSelect.value || 'ab';
    scopeSelect.replaceChildren(new Option('A/B selection', 'ab'), new Option('Whole log', 'full'));
    (context.savedRanges ?? []).forEach((saved, index) => {
      const seconds = Math.abs(saved.endMs - saved.startMs) / 1000;
      scopeSelect.add(new Option(`${saved.label || `Range ${index + 1}`} · ${seconds.toFixed(seconds >= 10 ? 1 : 3)} s`, `saved:${index}`));
    });
    if ([...scopeSelect.options].some((option) => option.value === previous)) scopeSelect.value = previous;
    else scopeSelect.value = context.aTimeMs !== undefined && context.bTimeMs !== undefined ? 'ab' : 'full';
  };

  const resolveScope = (): ResolvedScope | undefined => {
    if (scopeSelect.value === 'full') return { label: 'Full log' };
    if (scopeSelect.value.startsWith('saved:')) {
      const index = Number(scopeSelect.value.slice(6));
      const saved = context.savedRanges?.[index];
      if (!saved) return undefined;
      return {
        label: saved.label || `Saved range ${index + 1}`,
        startMs: Math.min(saved.startMs, saved.endMs),
        endMs: Math.max(saved.startMs, saved.endMs),
      };
    }
    if (context.aTimeMs === undefined || context.bTimeMs === undefined || context.aTimeMs === context.bTimeMs) return undefined;
    return {
      label: 'A/B',
      startMs: Math.min(context.aTimeMs, context.bTimeMs),
      endMs: Math.max(context.aTimeMs, context.bTimeMs),
    };
  };

  const updateValueControls = (): void => {
    const usesValue = selectedAggregation() !== 'count';
    zField.hidden = !usesValue;
    deltaField.hidden = !usesValue;
  };

  const traceCoversScope = (trace: HistogramTraceContext, scope: ResolvedScope): boolean => {
    if (trace.complete) return true;
    if (scope.startMs === undefined || scope.endMs === undefined) return false;
    return numericRangeCoversTime(trace.range, scope.startMs, scope.endMs);
  };

  const renderChart = (): void => {
    const result = currentResult;
    const xTrace = currentXTrace;
    const yTrace = currentYTrace;
    if (!result || !xTrace || !yTrace || result.xBins.length === 0 || result.yBins.length === 0) {
      layout = undefined;
      return;
    }

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

    const left = 68;
    const right = 12;
    const top = 20;
    const bottom = 46;
    const chartWidth = Math.max(1, width - left - right);
    const chartHeight = Math.max(1, height - top - bottom);
    const cellWidth = chartWidth / result.xBins.length;
    const cellHeight = chartHeight / result.yBins.length;
    layout = { left, top, width: chartWidth, height: chartHeight, cellWidth, cellHeight };

    const valueMin = result.cellValueMin;
    const valueMax = result.cellValueMax;
    const valueSpan = valueMin === undefined || valueMax === undefined ? 0 : valueMax - valueMin;
    const isBar = result.yBins.length === 1;

    if (isBar) {
      const finite = [...result.cellValues].filter((value) => Number.isFinite(value));
      const min = finite.length > 0 ? Math.min(0, ...finite) : 0;
      const max = finite.length > 0 ? Math.max(0, ...finite) : 1;
      const span = Math.max(1e-12, max - min);
      const zeroY = top + chartHeight - ((0 - min) / span) * chartHeight;
      ctx.strokeStyle = 'rgba(91,118,136,.48)';
      ctx.beginPath();
      ctx.moveTo(left, zeroY);
      ctx.lineTo(left + chartWidth, zeroY);
      ctx.stroke();
      result.xBins.forEach((_bin, xIndex) => {
        const value = result.cellValues[xIndex];
        if (value === undefined || !Number.isFinite(value)) return;
        const valueY = top + chartHeight - ((Number(value) - min) / span) * chartHeight;
        const x = left + xIndex * cellWidth + Math.max(1, cellWidth * 0.08);
        const barWidth = Math.max(1, cellWidth * 0.84);
        ctx.globalAlpha = .82;
        ctx.fillStyle = xTrace.color || '#58aef6';
        ctx.fillRect(x, Math.min(valueY, zeroY), barWidth, Math.max(1, Math.abs(zeroY - valueY)));
        ctx.globalAlpha = 1;
        if (barWidth >= 25) {
          ctx.fillStyle = '#eaf5fa';
          ctx.font = '600 9px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = valueY <= zeroY ? 'bottom' : 'top';
          ctx.fillText(formatCellValue(Number(value), result.aggregationMethod, barWidth), x + barWidth / 2, valueY + (valueY <= zeroY ? -3 : 3), barWidth + 8);
        }
      });
    } else {
      for (let yIndex = 0; yIndex < result.yBins.length; yIndex += 1) {
        for (let xIndex = 0; xIndex < result.xBins.length; xIndex += 1) {
          const cellIndex = yIndex * result.xBins.length + xIndex;
          const value = result.cellValues[cellIndex];
          const count = result.counts[cellIndex] ?? 0;
          const finite = value !== undefined && Number.isFinite(value);
          const normalized = !finite
            ? 0
            : valueSpan > 0 && valueMin !== undefined
              ? Math.max(0, Math.min(1, (Number(value) - valueMin) / valueSpan))
              : count > 0 ? 1 : 0;
          const x = left + xIndex * cellWidth;
          const y = top + chartHeight - (yIndex + 1) * cellHeight;
          if (count > 0) {
            ctx.globalAlpha = .16 + normalized * .84;
            ctx.fillStyle = xTrace.color || '#58aef6';
            ctx.fillRect(x, y, cellWidth, cellHeight);
            ctx.globalAlpha = 1;
          }
          ctx.strokeStyle = 'rgba(73,103,122,.46)';
          ctx.strokeRect(x + .5, y + .5, Math.max(0, cellWidth - 1), Math.max(0, cellHeight - 1));
          const text = formatCellValue(finite ? Number(value) : undefined, result.aggregationMethod, cellWidth);
          const fontSize = Math.max(6, Math.min(11, Math.floor(cellHeight * (showHitsInput.checked ? .31 : .42)), Math.floor(cellWidth / Math.max(3, text.length) * 1.4)));
          ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = normalized > .62 ? '#061018' : count > 0 ? '#eef8fc' : '#66808f';
          ctx.fillText(text, x + cellWidth / 2, y + cellHeight / 2 - (showHitsInput.checked && count > 0 ? fontSize * .35 : 0), Math.max(1, cellWidth - 4));
          if (showHitsInput.checked && count > 0 && cellHeight >= 18) {
            ctx.font = `500 ${Math.max(6, fontSize - 2)}px system-ui, sans-serif`;
            ctx.fillText(`n=${count.toLocaleString()}`, x + cellWidth / 2, y + cellHeight / 2 + fontSize * .65, Math.max(1, cellWidth - 4));
          }
        }
      }
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#7f96a5';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    const xStep = Math.max(1, Math.ceil(result.xBins.length / Math.max(4, Math.floor(chartWidth / 72))));
    result.xBins.forEach((bin, index) => {
      if (index % xStep !== 0 && index !== result.xBins.length - 1) return;
      ctx.textAlign = 'center';
      ctx.fillText(formatNumber((bin.lowerBound + bin.upperBound) / 2, 1), left + (index + .5) * cellWidth, top + chartHeight + 6);
    });
    ctx.textAlign = 'center';
    ctx.fillText(`${traceLabel(xTrace)}${xTrace.channel.unit ? ` · ${xTrace.channel.unit}` : ''}`, left + chartWidth / 2, top + chartHeight + 23);

    if (!isBar) {
      ctx.textBaseline = 'middle';
      const yStep = Math.max(1, Math.ceil(result.yBins.length / Math.max(4, Math.floor(chartHeight / 34))));
      result.yBins.forEach((bin, index) => {
        if (index % yStep !== 0 && index !== result.yBins.length - 1) return;
        ctx.textAlign = 'right';
        ctx.fillText(formatNumber((bin.lowerBound + bin.upperBound) / 2, 1), left - 6, top + chartHeight - (index + .5) * cellHeight);
      });
      ctx.save();
      ctx.translate(12, top + chartHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText(`${traceLabel(yTrace)}${yTrace.channel.unit ? ` · ${yTrace.channel.unit}` : ''}`, 0, 0);
      ctx.restore();
    }

    const valueName = result.aggregationMethod === 'count'
      ? 'Samples'
      : currentDeltaTrace && currentZTrace
        ? `${traceLabel(currentZTrace)} − ${traceLabel(currentDeltaTrace)}`
        : currentZTrace ? traceLabel(currentZTrace) : 'Value';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#93a9b6';
    ctx.font = '600 9px system-ui, sans-serif';
    ctx.fillText(`${aggregationLabel(result.aggregationMethod)} · ${valueName}`, left, 5);
  };

  const render = async (): Promise<void> => {
    const generation = ++renderGeneration;
    updateValueControls();
    tooltip.hidden = true;
    const scope = resolveScope();
    const xId = xSelect.value || context.channels[0]?.id;
    const yId = ySelect.value || context.channels[1]?.id || context.channels[0]?.id;
    const aggregation = selectedAggregation();
    const zId = aggregation === 'count' ? undefined : (zSelect.value || context.channels[0]?.id);
    const deltaId = aggregation === 'count' ? undefined : (deltaSelect.value || undefined);
    const conditions = enabledConditions();

    if (!scope || !xId || !yId || (aggregation !== 'count' && !zId)) {
      currentResult = undefined;
      currentXTrace = undefined;
      currentYTrace = undefined;
      currentZTrace = undefined;
      currentDeltaTrace = undefined;
      currentScope = scope;
      layout = undefined;
      empty.hidden = false;
      canvas.hidden = true;
      status.hidden = true;
      exportButton.disabled = true;
      return;
    }

    const requestedIds = [...new Set([
      xId,
      yId,
      ...(zId ? [zId] : []),
      ...(deltaId ? [deltaId] : []),
      ...conditions.map((condition) => condition.channelId),
    ])];
    const loaded = await context.loadTraces(requestedIds, scope.startMs, scope.endMs);
    if (generation !== renderGeneration) return;
    const byId = new Map(loaded.map((trace) => [trace.channel.id, trace]));
    const xTrace = byId.get(xId);
    const yTrace = byId.get(yId);
    const zTrace = zId ? byId.get(zId) : undefined;
    const deltaTrace = deltaId ? byId.get(deltaId) : undefined;
    if (!xTrace || !yTrace || (aggregation !== 'count' && !zTrace) || (deltaId && !deltaTrace)) {
      currentResult = undefined;
      currentXTrace = undefined;
      currentYTrace = undefined;
      currentZTrace = undefined;
      currentDeltaTrace = undefined;
      currentScope = scope;
      layout = undefined;
      empty.hidden = false;
      empty.querySelector('strong')!.textContent = 'One or more selected channels could not be decoded.';
      empty.querySelector('span')!.textContent = 'Choose another channel or scope and try again.';
      canvas.hidden = true;
      status.hidden = true;
      exportButton.disabled = true;
      return;
    }

    const qualificationChannels = new Map<string, { range: HistogramTraceContext['range']; complete: boolean }>();
    qualificationChannels.set(xTrace.channel.id, { range: xTrace.range, complete: xTrace.complete });
    for (const condition of conditions) {
      const trace = byId.get(condition.channelId);
      if (trace) qualificationChannels.set(trace.channel.id, { range: trace.range, complete: trace.complete });
    }
    const qualified = qualifyNumericSamples({
      referenceChannelId: xTrace.channel.id,
      channels: qualificationChannels,
      conditions,
      ...(scope.startMs !== undefined && scope.endMs !== undefined
        ? { timeRange: { startMs: scope.startMs, endMs: scope.endMs } }
        : {}),
    });

    const valueRange = aggregation === 'count'
      ? undefined
      : deltaTrace && zTrace ? subtractNumericRanges(zTrace.range, deltaTrace.range) : zTrace!.range;
    const xMin = optionalFinite(xMinInput);
    const xMax = optionalFinite(xMaxInput);
    const yMin = optionalFinite(yMinInput);
    const yMax = optionalFinite(yMaxInput);
    const result = buildNumericHeatmap(xTrace.range, yTrace.range, {
      sampleIndices: qualified.eligibleSampleIndices,
      xBinCount: binCount(xBinsInput, 16),
      yBinCount: binCount(yBinsInput, 16),
      ...(xMin !== undefined ? { xMin } : {}),
      ...(xMax !== undefined ? { xMax } : {}),
      ...(yMin !== undefined ? { yMin } : {}),
      ...(yMax !== undefined ? { yMax } : {}),
      aggregation,
      ...(valueRange ? { valueRange } : {}),
    });

    const complete = qualified.complete
      && traceCoversScope(yTrace, scope)
      && (!zTrace || traceCoversScope(zTrace, scope))
      && (!deltaTrace || traceCoversScope(deltaTrace, scope))
      && result.unavailableSampleCount === 0
      && result.valueUnavailableSampleCount === 0;

    currentResult = result;
    currentXTrace = xTrace;
    currentYTrace = yTrace;
    currentZTrace = zTrace;
    currentDeltaTrace = deltaTrace;
    currentScope = scope;
    currentFilterDescription = conditions.length === 0
      ? 'None'
      : conditions.map((condition) => {
          const channel = context.channels.find((definition) => definition.id === condition.channelId);
          return `${channel ? channelLabel(channel) : condition.channelId} ${operatorLabel(condition.operator)} ${condition.value}`;
        }).join(' AND ');

    empty.hidden = true;
    canvas.hidden = false;
    status.hidden = false;
    exportButton.disabled = false;
    summary('scope').textContent = scope.startMs !== undefined && scope.endMs !== undefined
      ? `${scope.label} · ${((scope.endMs - scope.startMs) / 1000).toFixed(3)} s`
      : scope.label;
    summary('coverage').textContent = complete ? 'Complete' : 'Partial decoded';
    const cellUnit = aggregation === 'count' ? '' : zTrace?.channel.unit ?? '';
    const cellName = aggregation === 'count'
      ? 'Count'
      : deltaTrace && zTrace
        ? `${aggregationLabel(aggregation)} · ${traceLabel(zTrace)} − ${traceLabel(deltaTrace)}`
        : `${aggregationLabel(aggregation)} · ${zTrace ? traceLabel(zTrace) : 'Value'}`;
    summary('cell').textContent = `${cellName}${cellUnit ? ` · ${cellUnit}` : ''}`;
    summary('input').textContent = qualified.inputSampleCount.toLocaleString();
    summary('eligible').textContent = qualified.eligibleSampleCount.toLocaleString();
    summary('filtered').textContent = qualified.valueRejectedSampleCount.toLocaleString();
    summary('binned').textContent = result.binnedSampleCount.toLocaleString();
    summary('outside').textContent = result.outsideRangeSampleCount.toLocaleString();
    renderChart();
  };

  const exportCsv = (): void => {
    const result = currentResult;
    const xTrace = currentXTrace;
    const yTrace = currentYTrace;
    if (!result || !xTrace || !yTrace || !currentScope) return;
    const zDescription = result.aggregationMethod === 'count'
      ? 'Samples'
      : currentDeltaTrace && currentZTrace
        ? `${traceLabel(currentZTrace)} - ${traceLabel(currentDeltaTrace)}`
        : currentZTrace ? traceLabel(currentZTrace) : 'Value';
    const quote = (value: string | number): string => {
      const text = String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const xCenters = result.xBins.map((bin) => (bin.lowerBound + bin.upperBound) / 2);
    const rows: string[] = [
      quote('EpicScope Histogram Table Generator'),
      ['Scope', currentScope.label].map(quote).join(','),
      ['X', traceLabel(xTrace), xTrace.channel.unit ?? ''].map(quote).join(','),
      ['Y', traceLabel(yTrace), yTrace.channel.unit ?? ''].map(quote).join(','),
      ['Cell', aggregationLabel(result.aggregationMethod), zDescription, currentZTrace?.channel.unit ?? ''].map(quote).join(','),
      ['Filters', currentFilterDescription].map(quote).join(','),
      '',
      [traceLabel(yTrace) + ' \\ ' + traceLabel(xTrace), ...xCenters.map((value) => formatNumber(value, 6))].map(quote).join(','),
    ];
    for (let yIndex = result.yBins.length - 1; yIndex >= 0; yIndex -= 1) {
      const yBin = result.yBins[yIndex]!;
      const values: (string | number)[] = [formatNumber((yBin.lowerBound + yBin.upperBound) / 2, 6)];
      for (let xIndex = 0; xIndex < result.xBins.length; xIndex += 1) {
        const value = result.cellValues[yIndex * result.xBins.length + xIndex];
        values.push(value !== undefined && Number.isFinite(value) ? Number(value) : '');
      }
      rows.push(values.map(quote).join(','));
    }
    rows.push('', 'Hit counts', [traceLabel(yTrace) + ' \\ ' + traceLabel(xTrace), ...xCenters.map((value) => formatNumber(value, 6))].map(quote).join(','));
    for (let yIndex = result.yBins.length - 1; yIndex >= 0; yIndex -= 1) {
      const yBin = result.yBins[yIndex]!;
      const values: (string | number)[] = [formatNumber((yBin.lowerBound + yBin.upperBound) / 2, 6)];
      for (let xIndex = 0; xIndex < result.xBins.length; xIndex += 1) {
        values.push(result.counts[yIndex * result.xBins.length + xIndex] ?? 0);
      }
      rows.push(values.map(quote).join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${safeFilenamePart(`EpicScope-${traceLabel(xTrace)}-${traceLabel(yTrace)}-${zDescription}`)}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const updateTooltip = (event: MouseEvent): void => {
    const result = currentResult;
    const currentLayout = layout;
    const xTrace = currentXTrace;
    const yTrace = currentYTrace;
    if (!result || !currentLayout || !xTrace || !yTrace) {
      tooltip.hidden = true;
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (
      x < currentLayout.left || x >= currentLayout.left + currentLayout.width
      || y < currentLayout.top || y >= currentLayout.top + currentLayout.height
    ) {
      tooltip.hidden = true;
      return;
    }
    const xIndex = Math.min(result.xBins.length - 1, Math.max(0, Math.floor((x - currentLayout.left) / currentLayout.cellWidth)));
    const yFromTop = Math.min(result.yBins.length - 1, Math.max(0, Math.floor((y - currentLayout.top) / currentLayout.cellHeight)));
    const yIndex = result.yBins.length - 1 - yFromTop;
    const cellIndex = yIndex * result.xBins.length + xIndex;
    const xBin = result.xBins[xIndex]!;
    const yBin = result.yBins[yIndex]!;
    const value = result.cellValues[cellIndex];
    const count = result.counts[cellIndex] ?? 0;
    const validValues = result.cellValueSampleCounts[cellIndex] ?? 0;
    const zName = result.aggregationMethod === 'count'
      ? 'Count'
      : currentDeltaTrace && currentZTrace
        ? `${traceLabel(currentZTrace)} − ${traceLabel(currentDeltaTrace)}`
        : currentZTrace ? traceLabel(currentZTrace) : 'Value';
    tooltip.innerHTML = `
      <strong>${aggregationLabel(result.aggregationMethod)} · ${zName}: ${formatCellValue(value, result.aggregationMethod, 100)}</strong>
      <span>${traceLabel(xTrace)}: ${formatNumber(xBin.lowerBound)} to ${formatNumber(xBin.upperBound)}</span>
      <span>${traceLabel(yTrace)}: ${formatNumber(yBin.lowerBound)} to ${formatNumber(yBin.upperBound)}</span>
      <span>Hits: ${count.toLocaleString()}${result.aggregationMethod === 'count' ? '' : ` · valid Z: ${validValues.toLocaleString()}`}</span>
    `;
    tooltip.style.left = `${Math.min(rect.width - 230, Math.max(8, x + 14))}px`;
    tooltip.style.top = `${Math.min(rect.height - 96, Math.max(8, y + 14))}px`;
    tooltip.hidden = false;
  };

  const setContext = (nextContext: HistogramPageContext): void => {
    const previousX = xSelect.value;
    const previousY = ySelect.value;
    const previousZ = zSelect.value;
    const previousDelta = deltaSelect.value;
    context = nextContext;
    refillChannelSelect(xSelect, previousX);
    refillChannelSelect(ySelect, previousY);
    refillChannelSelect(zSelect, previousZ);
    refillChannelSelect(deltaSelect, previousDelta, true);
    if (!previousX || !context.channels.some((channel) => channel.id === previousX)) {
      xSelect.value = preferredChannel(context.channels, [/\brpm\b/i, /engine.*speed/i], 0)?.id ?? '';
    }
    if (!previousY || !context.channels.some((channel) => channel.id === previousY)) {
      ySelect.value = preferredChannel(context.channels, [/\bmap\b/i, /manifold.*pressure/i, /\bload\b/i], 1)?.id ?? xSelect.value;
    }
    if (!previousZ || !context.channels.some((channel) => channel.id === previousZ)) {
      zSelect.value = preferredChannel(context.channels, [/\bafr\b/i, /lambda/i, /spark.*adv/i], 2)?.id ?? xSelect.value;
    }
    for (const filter of filters) {
      const previous = filter.channel.value;
      filter.channel.replaceChildren();
      for (const channel of context.channels) filter.channel.add(new Option(channelLabel(channel), channel.id));
      if (previous && context.channels.some((channel) => channel.id === previous)) filter.channel.value = previous;
    }
    populateScopeOptions();
    updateValueControls();
    scheduleRender();
  };

  addFilterButton.addEventListener('click', addFilter);
  scopeSelect.addEventListener('change', () => scheduleRender());
  xSelect.addEventListener('change', () => scheduleRender());
  ySelect.addEventListener('change', () => scheduleRender());
  zSelect.addEventListener('change', () => scheduleRender());
  deltaSelect.addEventListener('change', () => scheduleRender());
  aggregationSelect.addEventListener('change', () => { updateValueControls(); scheduleRender(); });
  xBinsInput.addEventListener('input', () => scheduleRender(120));
  yBinsInput.addEventListener('input', () => scheduleRender(120));
  xMinInput.addEventListener('input', () => scheduleRender(160));
  xMaxInput.addEventListener('input', () => scheduleRender(160));
  yMinInput.addEventListener('input', () => scheduleRender(160));
  yMaxInput.addEventListener('input', () => scheduleRender(160));
  showHitsInput.addEventListener('change', renderChart);
  exportButton.addEventListener('click', exportCsv);
  canvas.addEventListener('mousemove', updateTooltip);
  canvas.addEventListener('mouseleave', () => { tooltip.hidden = true; });
  new ResizeObserver(() => {
    if (!root.hidden && currentResult && !canvas.hidden) renderChart();
  }).observe(canvas);

  populateScopeOptions();
  updateFilterCount();
  updateValueControls();

  return { element: root, setContext, refresh: () => scheduleRender() };
}
