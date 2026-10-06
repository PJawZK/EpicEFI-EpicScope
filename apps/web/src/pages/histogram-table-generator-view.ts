import { buildNumericHeatmap, type NumericHeatmapResult } from '../../../../core/analysis/heatmap';
import { buildCellCenteredWeightedMean } from '../../../../core/analysis/weighted-cell-mean';
import type { NumericAggregationMethod } from '../../../../core/analysis/numeric-aggregation';
import { subtractNumericRanges } from '../../../../core/analysis/numeric-range-arithmetic';
import { compileCalculatedField, evaluateCalculatedFieldRange } from '../../../../core/analysis/calculated-field';
import {
  qualifyNumericSampleGroups,
  type NumericQualificationCondition,
  type NumericQualificationGroup,
  type NumericQualificationLogic,
  type NumericQualificationOperator,
} from '../../../../core/analysis/sample-qualification';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import { createTuneTable2D } from '../../../../core/tune/table-correlation';
import type { ChannelDefinition } from '../../../../core/log-model/log-types';
import type { HistogramPageContext, HistogramTraceContext } from './histogram-page';
import {
  createHistogramLocalId,
  loadHistogramCalculatedFields,
  loadHistogramFilterSets,
  loadHistogramTablePresets,
  saveHistogramCalculatedFields,
  saveHistogramFilterSets,
  saveHistogramTablePresets,
  type HistogramCalculatedFieldDefinition,
  type HistogramFilterConditionState,
  type HistogramTableAggregation,
  type HistogramTableColorMode,
  type HistogramTablePresetState,
} from '../state/histogram-table-storage';

export interface HistogramTableGeneratorController {
  readonly element: HTMLElement;
  setContext(context: HistogramPageContext): void;
  refresh(): void;
}

interface FilterRowControls {
  readonly row: HTMLElement;
  readonly enabled: HTMLInputElement;
  readonly group: HTMLSelectElement;
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

function formatCellValue(value: number | undefined, method: HistogramTableAggregation, width: number): string {
  if (value === undefined || !Number.isFinite(value)) return method === 'count' ? '0' : '—';
  if (method === 'count') return Math.round(value).toLocaleString();
  const precision = width < 30 ? 0 : width < 48 ? 1 : Math.abs(value) >= 100 ? 1 : 2;
  return value.toFixed(precision).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function aggregationLabel(method: HistogramTableAggregation): string {
  if (method === 'weighted-mean') return 'MLV weighted mean';
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
  if (operator === 'neq') return '≠';
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
  let currentAggregation: HistogramTableAggregation = 'weighted-mean';
  let currentCellTotalWeights: Float64Array | undefined;
  let currentWeightedContributingCounts: Uint32Array | undefined;
  let currentXTrace: HistogramTraceContext | undefined;
  let currentYTrace: HistogramTraceContext | undefined;
  let currentZTrace: HistogramTraceContext | undefined;
  let currentDeltaTrace: HistogramTraceContext | undefined;
  let currentScope: ResolvedScope | undefined;
  let currentFilterDescription = 'None';
  let layout: ChartLayout | undefined;
  let selectedCell: { readonly cellIndex: number; readonly xIndex: number; readonly yIndex: number; readonly sampleIndices: readonly number[]; readonly timeMs: readonly number[]; readonly label: string } | undefined;
  let calculatedFields = loadHistogramCalculatedFields();
  let filterSets = loadHistogramFilterSets();
  let tablePresets = loadHistogramTablePresets();

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
        <option value="weighted-mean" selected>MLV weighted mean</option>
        <option value="mean">Mean</option>
        <option value="count">Count</option>
        <option value="min">Minimum</option>
        <option value="max">Maximum</option>
        <option value="sum">Sum</option>
        <option value="standard-deviation">Std dev</option>
        <option value="variance">Variance</option>
      </select></label>
      <label class="histogram-table-delta-field"><span>Z delta</span><select class="histogram-table-delta"><option value="">(none)</option></select></label>
      <details class="histogram-table-presets">
        <summary title="Saved Table Generator setups">Presets</summary>
        <div class="histogram-table-preset-popover">
          <select class="histogram-preset-select" aria-label="Saved table setup"></select>
          <div><button type="button" class="histogram-preset-apply">Apply</button><button type="button" class="histogram-preset-save">Save setup…</button><button type="button" class="histogram-preset-delete">Delete</button></div>
          <small>Saved setups retain scope, X/Y/Z, statistic, filters, axis/grid configuration and weighting options.</small>
        </div>
      </details>
      <details class="histogram-table-formulas">
        <summary>ƒ <span class="histogram-formula-count">0</span></summary>
        <div class="histogram-formula-popover">
          <label><span>Calculated field</span><select class="histogram-formula-select"></select></label>
          <label><span>Name</span><input class="histogram-formula-name" type="text" placeholder="AFR Error" /></label>
          <label><span>Formula</span><input class="histogram-formula-expression" type="text" placeholder="[AFR] - [AFR Target]" /></label>
          <label><span>Unit</span><input class="histogram-formula-unit" type="text" placeholder="optional" /></label>
          <div class="histogram-formula-actions"><button type="button" class="histogram-formula-save">Save</button><button type="button" class="histogram-formula-delete">Delete</button><span class="histogram-formula-status">Use [Channel Name] references. Functions: abs/min/max/sqrt/pow/clamp/round/floor/ceil/log/exp.</span></div>
        </div>
      </details>
      <details class="histogram-table-filters">
        <summary>Filters <span class="histogram-filter-count">0</span></summary>
        <div class="histogram-table-filter-popover histogram-filter-manager">
          <aside class="histogram-filter-library">
            <header><strong>Saved filters</strong><button type="button" class="histogram-filter-set-save">Save current…</button></header>
            <select class="histogram-filter-set-select" aria-label="Saved filter set" size="7"></select>
            <footer><button type="button" class="histogram-filter-set-apply">Apply</button><button type="button" class="histogram-filter-set-delete">Delete</button></footer>
          </aside>
          <section class="histogram-filter-editor">
            <header><div><strong>Filter conditions</strong><small>Qualify samples before they enter the table.</small></div><button type="button" class="histogram-add-filter">+ Condition</button></header>
            <div class="histogram-filter-logic-bar"><label><span>Within group</span><select class="histogram-filter-within-logic"><option value="and">ALL</option><option value="or">ANY</option></select></label><label><span>Between groups</span><select class="histogram-filter-between-logic"><option value="and">ALL</option><option value="or">ANY</option></select></label><small>Rows may be grouped A/B/C. ALL/ANY controls conditions inside and between groups.</small></div>
            <div class="histogram-filter-list"></div>
            <footer class="histogram-filter-actions"><span>Physical and Math/Calculated channels are available.</span></footer>
          </section>
        </div>
      </details>
      <details class="histogram-table-size">
        <summary title="Choose the visible auto-bin table grid">Size</summary>
        <div class="histogram-table-size-popover">
          <strong>Table grid</strong>
          <div class="histogram-table-size-grid" role="group" aria-label="Table grid size">
            <button type="button" data-grid="8x8">8×8</button>
            <button type="button" data-grid="12x12">12×12</button>
            <button type="button" data-grid="16x16">16×16</button>
            <button type="button" data-grid="8x16">8×16</button>
            <button type="button" data-grid="16x8">16×8</button>
            <button type="button" data-grid="1x16">16×1</button>
          </div>
          <small>Grid size applies to Auto bins. Custom breakpoints and loaded MSQ tables keep their own dimensions.</small>
        </div>
      </details>
      <details class="histogram-table-options">
        <summary>Table</summary>
        <div class="histogram-table-options-popover">
          <label><span>Axis source</span><select class="histogram-table-axis-source"><option value="auto">Auto bins</option><option value="custom">Custom breakpoints</option><option value="msq">Loaded MSQ table</option></select></label>
          <div class="histogram-table-axis-custom" hidden>
            <label><span>X breakpoints</span><input class="histogram-table-x-breakpoints" type="text" placeholder="800, 1200, 1600, …" /></label>
            <label><span>Y breakpoints</span><input class="histogram-table-y-breakpoints" type="text" placeholder="30, 50, 70, …" /></label>
          </div>
          <div class="histogram-table-axis-msq" hidden>
            <label><span>MSQ table</span><select class="histogram-table-msq-table"></select></label>
            <label><span>X axis</span><select class="histogram-table-msq-x-axis"></select></label>
            <label><span>Y axis</span><select class="histogram-table-msq-y-axis"></select></label>
          </div>
          <div class="histogram-table-axis-auto">
            <label><span>X columns</span><input class="histogram-table-x-bins" type="number" min="1" max="64" step="1" value="16" /></label>
            <label><span>Y rows</span><input class="histogram-table-y-bins" type="number" min="1" max="64" step="1" value="16" /></label>
            <label><span>X min</span><input class="histogram-table-x-min" type="number" step="any" placeholder="Auto" /></label>
            <label><span>X max</span><input class="histogram-table-x-max" type="number" step="any" placeholder="Auto" /></label>
            <label><span>Y min</span><input class="histogram-table-y-min" type="number" step="any" placeholder="Auto" /></label>
            <label><span>Y max</span><input class="histogram-table-y-max" type="number" step="any" placeholder="Auto" /></label>
          </div>
          <label class="histogram-table-toggle"><input class="histogram-table-show-hits" type="checkbox" checked /><span>Show hit count in cells</span></label>
          <div class="histogram-table-weighting" hidden>
            <label><span>Min individual weight</span><input class="histogram-table-min-individual-weight" type="number" min="0" max="1" step="0.01" value="0" /></label>
            <label><span>Min total hit weight</span><input class="histogram-table-min-total-weight" type="number" min="0" step="0.1" value="0" /></label>
            <label><span>Cell color</span><select class="histogram-table-color-mode"><option value="value">Cell value</option><option value="weight">Hit weight</option></select></label>
            <p>MLV-style weighting: 1.0 at the X/Y cell center, falling toward 0.0 at the cell boundary. The two thresholds mirror MLV's hit-weight controls.</p>
          </div>
          <p>Set Y rows to 1 for an MLV-style single-row bar graph. Blank limits use observed data range.</p>
        </div>
      </details>
      <details class="histogram-table-help">
        <summary aria-label="Table Generator information" title="How Table Generator works">i</summary>
        <div class="histogram-table-help-popover">
          <strong>Table Generator</strong>
          <p>Choose X and Y to define the table cells, then choose the Cell statistic and Z value to calculate inside each cell.</p>
          <p><b>Auto bins</b> divides the observed/requested range. <b>Custom breakpoints</b> uses your cell centers. <b>Loaded MSQ table</b> uses the tune-table grid and suggests matching X/Y axes, which remain editable.</p>
          <p>Filters qualify samples before binning. Custom/MSQ values beyond the outer breakpoints are assigned to the nearest edge cell so table results do not lose edge samples.</p>
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
      <aside class="histogram-cell-inspector" hidden>
        <header><div><strong class="histogram-cell-inspector-title">Cell samples</strong><small class="histogram-cell-inspector-subtitle">—</small></div><button type="button" class="histogram-cell-inspector-close" aria-label="Close cell inspector">×</button></header>
        <div class="histogram-cell-inspector-summary"></div>
        <div class="histogram-cell-sample-list"></div>
        <footer><span class="histogram-cell-list-note"></span><button type="button" class="histogram-cell-copy">Copy</button><button type="button" class="histogram-cell-open-logger">Open in Logger</button></footer>
      </aside>
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
  const presetSelect = root.querySelector<HTMLSelectElement>('.histogram-preset-select');
  const presetApplyButton = root.querySelector<HTMLButtonElement>('.histogram-preset-apply');
  const presetSaveButton = root.querySelector<HTMLButtonElement>('.histogram-preset-save');
  const presetDeleteButton = root.querySelector<HTMLButtonElement>('.histogram-preset-delete');
  const formulaCount = root.querySelector<HTMLElement>('.histogram-formula-count');
  const formulaSelect = root.querySelector<HTMLSelectElement>('.histogram-formula-select');
  const formulaNameInput = root.querySelector<HTMLInputElement>('.histogram-formula-name');
  const formulaExpressionInput = root.querySelector<HTMLInputElement>('.histogram-formula-expression');
  const formulaUnitInput = root.querySelector<HTMLInputElement>('.histogram-formula-unit');
  const formulaSaveButton = root.querySelector<HTMLButtonElement>('.histogram-formula-save');
  const formulaDeleteButton = root.querySelector<HTMLButtonElement>('.histogram-formula-delete');
  const formulaStatus = root.querySelector<HTMLElement>('.histogram-formula-status');
  const filterCount = root.querySelector<HTMLElement>('.histogram-filter-count');
  const filterSetSelect = root.querySelector<HTMLSelectElement>('.histogram-filter-set-select');
  const filterSetApplyButton = root.querySelector<HTMLButtonElement>('.histogram-filter-set-apply');
  const filterSetSaveButton = root.querySelector<HTMLButtonElement>('.histogram-filter-set-save');
  const filterSetDeleteButton = root.querySelector<HTMLButtonElement>('.histogram-filter-set-delete');
  const filterWithinLogicSelect = root.querySelector<HTMLSelectElement>('.histogram-filter-within-logic');
  const filterBetweenLogicSelect = root.querySelector<HTMLSelectElement>('.histogram-filter-between-logic');
  const filterList = root.querySelector<HTMLElement>('.histogram-filter-list');
  const addFilterButton = root.querySelector<HTMLButtonElement>('.histogram-add-filter');
  const sizeButtons = [...root.querySelectorAll<HTMLButtonElement>('.histogram-table-size-grid [data-grid]')];
  const axisSourceSelect = root.querySelector<HTMLSelectElement>('.histogram-table-axis-source');
  const autoAxisFields = root.querySelector<HTMLElement>('.histogram-table-axis-auto');
  const customAxisFields = root.querySelector<HTMLElement>('.histogram-table-axis-custom');
  const xBreakpointsInput = root.querySelector<HTMLInputElement>('.histogram-table-x-breakpoints');
  const yBreakpointsInput = root.querySelector<HTMLInputElement>('.histogram-table-y-breakpoints');
  const msqAxisFields = root.querySelector<HTMLElement>('.histogram-table-axis-msq');
  const msqTableSelect = root.querySelector<HTMLSelectElement>('.histogram-table-msq-table');
  const msqXAxisSelect = root.querySelector<HTMLSelectElement>('.histogram-table-msq-x-axis');
  const msqYAxisSelect = root.querySelector<HTMLSelectElement>('.histogram-table-msq-y-axis');
  const xBinsInput = root.querySelector<HTMLInputElement>('.histogram-table-x-bins');
  const yBinsInput = root.querySelector<HTMLInputElement>('.histogram-table-y-bins');
  const xMinInput = root.querySelector<HTMLInputElement>('.histogram-table-x-min');
  const xMaxInput = root.querySelector<HTMLInputElement>('.histogram-table-x-max');
  const yMinInput = root.querySelector<HTMLInputElement>('.histogram-table-y-min');
  const yMaxInput = root.querySelector<HTMLInputElement>('.histogram-table-y-max');
  const showHitsInput = root.querySelector<HTMLInputElement>('.histogram-table-show-hits');
  const weightingFields = root.querySelector<HTMLElement>('.histogram-table-weighting');
  const minimumIndividualWeightInput = root.querySelector<HTMLInputElement>('.histogram-table-min-individual-weight');
  const minimumTotalWeightInput = root.querySelector<HTMLInputElement>('.histogram-table-min-total-weight');
  const colorModeSelect = root.querySelector<HTMLSelectElement>('.histogram-table-color-mode');
  const exportButton = root.querySelector<HTMLButtonElement>('.histogram-table-export');
  const empty = root.querySelector<HTMLElement>('.histogram-table-empty');
  const status = root.querySelector<HTMLElement>('.histogram-table-status');
  const canvas = root.querySelector<HTMLCanvasElement>('.histogram-table-canvas');
  const tooltip = root.querySelector<HTMLElement>('.histogram-table-tooltip');
  const cellInspector = root.querySelector<HTMLElement>('.histogram-cell-inspector');
  const cellInspectorTitle = root.querySelector<HTMLElement>('.histogram-cell-inspector-title');
  const cellInspectorSubtitle = root.querySelector<HTMLElement>('.histogram-cell-inspector-subtitle');
  const cellInspectorSummary = root.querySelector<HTMLElement>('.histogram-cell-inspector-summary');
  const cellSampleList = root.querySelector<HTMLElement>('.histogram-cell-sample-list');
  const cellListNote = root.querySelector<HTMLElement>('.histogram-cell-list-note');
  const cellInspectorClose = root.querySelector<HTMLButtonElement>('.histogram-cell-inspector-close');
  const cellCopyButton = root.querySelector<HTMLButtonElement>('.histogram-cell-copy');
  const cellOpenLoggerButton = root.querySelector<HTMLButtonElement>('.histogram-cell-open-logger');
  if (
    !scopeSelect || !xSelect || !ySelect || !zField || !zSelect || !aggregationSelect || !deltaField || !deltaSelect
    || !presetSelect || !presetApplyButton || !presetSaveButton || !presetDeleteButton || !formulaCount || !formulaSelect || !formulaNameInput
    || !formulaExpressionInput || !formulaUnitInput || !formulaSaveButton || !formulaDeleteButton || !formulaStatus || !filterCount
    || !filterSetSelect || !filterSetApplyButton || !filterSetSaveButton || !filterSetDeleteButton || !filterWithinLogicSelect || !filterBetweenLogicSelect
    || !filterList || !addFilterButton || !axisSourceSelect || !autoAxisFields || !customAxisFields || !xBreakpointsInput || !yBreakpointsInput
    || !msqAxisFields || !msqTableSelect || !msqXAxisSelect || !msqYAxisSelect || !xBinsInput || !yBinsInput || !xMinInput || !xMaxInput
    || !yMinInput || !yMaxInput || !showHitsInput || !weightingFields || !minimumIndividualWeightInput || !minimumTotalWeightInput || !colorModeSelect
    || !exportButton || !empty || !status || !canvas || !tooltip
    || !cellInspector || !cellInspectorTitle || !cellInspectorSubtitle || !cellInspectorSummary || !cellSampleList || !cellListNote
    || !cellInspectorClose || !cellCopyButton || !cellOpenLoggerButton
  ) {
    throw new Error('Histogram table generator structure is incomplete.');
  }

  const filters: FilterRowControls[] = [];
  const summary = (name: string): HTMLElement => {
    const node = root.querySelector<HTMLElement>(`[data-hist-table-summary="${name}"]`);
    if (!node) throw new Error(`Histogram table summary field is missing: ${name}`);
    return node;
  };
  const selectedAggregation = (): HistogramTableAggregation => aggregationSelect.value as HistogramTableAggregation;

  const formulaChannelId = (id: string): string => `formula:${id}`;
  const formulaForChannelId = (id: string): HistogramCalculatedFieldDefinition | undefined =>
    id.startsWith('formula:') ? calculatedFields.find((field) => field.id === id.slice(8)) : undefined;
  const logicalChannelExists = (id: string): boolean => context.channels.some((channel) => channel.id === id) || formulaForChannelId(id) !== undefined;
  const virtualDefinition = (field: HistogramCalculatedFieldDefinition): ChannelDefinition => ({
    id: formulaChannelId(field.id),
    sourceName: field.name,
    displayName: `ƒ ${field.name}`,
    valueType: 'number',
    category: 'Calculated',
    ...(field.unit ? { unit: field.unit } : {}),
  });

  const refillChannelSelect = (select: HTMLSelectElement, previous: string, includeNone = false): void => {
    select.replaceChildren();
    if (includeNone) select.add(new Option('(none)', ''));
    for (const channel of context.channels) select.add(new Option(channelLabel(channel), channel.id));
    for (const field of calculatedFields) select.add(new Option(`ƒ ${field.name}`, formulaChannelId(field.id)));
    if (previous && logicalChannelExists(previous)) select.value = previous;
  };

  const refreshLogicalSelectors = (): void => {
    const values = new Map<HTMLSelectElement, string>([[xSelect, xSelect.value], [ySelect, ySelect.value], [zSelect, zSelect.value], [deltaSelect, deltaSelect.value]]);
    refillChannelSelect(xSelect, values.get(xSelect) ?? '');
    refillChannelSelect(ySelect, values.get(ySelect) ?? '');
    refillChannelSelect(zSelect, values.get(zSelect) ?? '');
    refillChannelSelect(deltaSelect, values.get(deltaSelect) ?? '', true);
    for (const filter of filters) {
      const previous = filter.channel.value;
      refillChannelSelect(filter.channel, previous);
    }
  };

  const resolvePhysicalReference = (reference: string): ChannelDefinition => {
    const normalized = reference.trim().toLocaleLowerCase();
    const matches = context.channels.filter((channel) =>
      channel.id === reference || channel.displayName.toLocaleLowerCase() === normalized || channel.sourceName.toLocaleLowerCase() === normalized,
    );
    if (matches.length === 0) throw new RangeError(`Formula channel not found: [${reference}]`);
    if (matches.length > 1) throw new RangeError(`Formula channel reference is ambiguous: [${reference}]`);
    return matches[0]!;
  };

  const populateFormulaManager = (): void => {
    const previous = formulaSelect.value;
    formulaSelect.replaceChildren(new Option('(new calculated field)', ''));
    for (const field of calculatedFields) formulaSelect.add(new Option(field.name, field.id));
    if (previous && calculatedFields.some((field) => field.id === previous)) formulaSelect.value = previous;
    formulaCount.textContent = String(calculatedFields.length);
    formulaDeleteButton.disabled = !formulaSelect.value;
  };

  const loadSelectedFormulaEditor = (): void => {
    const field = calculatedFields.find((candidate) => candidate.id === formulaSelect.value);
    formulaNameInput.value = field?.name ?? '';
    formulaExpressionInput.value = field?.expression ?? '';
    formulaUnitInput.value = field?.unit ?? '';
    formulaDeleteButton.disabled = !field;
    formulaStatus.textContent = field ? 'Editing saved calculated field.' : 'Use [Channel Name] references. No JavaScript is executed.';
  };

  const saveFormula = (): void => {
    const name = formulaNameInput.value.trim();
    const expression = formulaExpressionInput.value.trim();
    if (!name || !expression) { formulaStatus.textContent = 'Name and formula are required.'; return; }
    try {
      const program = compileCalculatedField(expression);
      for (const reference of program.references) resolvePhysicalReference(reference);
      const existing = calculatedFields.find((field) => field.id === formulaSelect.value);
      const field: HistogramCalculatedFieldDefinition = {
        id: existing?.id ?? createHistogramLocalId('formula'),
        name,
        expression,
        ...(formulaUnitInput.value.trim() ? { unit: formulaUnitInput.value.trim() } : {}),
      };
      calculatedFields = existing
        ? calculatedFields.map((candidate) => candidate.id === existing.id ? field : candidate)
        : [...calculatedFields, field];
      const persisted = saveHistogramCalculatedFields(calculatedFields);
      populateFormulaManager();
      formulaSelect.value = field.id;
      refreshLogicalSelectors();
      formulaStatus.textContent = persisted
        ? `Saved ${field.name}.`
        : `${field.name} is available this session; could not save locally.`;
      scheduleRender();
    } catch (error) {
      formulaStatus.textContent = error instanceof Error ? error.message : 'Formula is invalid.';
    }
  };

  const deleteFormula = (): void => {
    if (!formulaSelect.value) return;
    calculatedFields = calculatedFields.filter((field) => field.id !== formulaSelect.value);
    saveHistogramCalculatedFields(calculatedFields);
    formulaSelect.value = '';
    populateFormulaManager();
    loadSelectedFormulaEditor();
    refreshLogicalSelectors();
    scheduleRender();
  };

  const scheduleRender = (delay = 0): void => {
    if (renderTimer !== undefined) window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      renderTimer = undefined;
      void render();
    }, delay);
  };

  const parseBreakpointList = (input: HTMLInputElement): readonly number[] | undefined => {
    const raw = input.value.trim();
    if (!raw) return undefined;
    const values = raw.split(/[\s,;]+/).filter(Boolean).map(Number);
    if (values.length === 0 || values.some((value) => !Number.isFinite(value))) return undefined;
    return values;
  };

  const populateMsqAxisSelectors = (preferSuggested = false): void => {
    const previousTable = msqTableSelect.value;
    const previousX = msqXAxisSelect.value;
    const previousY = msqYAxisSelect.value;
    msqTableSelect.replaceChildren();
    msqXAxisSelect.replaceChildren();
    msqYAxisSelect.replaceChildren();
    const model = context.tuneModel;
    if (!model) {
      msqTableSelect.add(new Option('No MSQ loaded', ''));
      msqXAxisSelect.add(new Option('—', ''));
      msqYAxisSelect.add(new Option('—', ''));
      return;
    }
    const tables = model.entries.filter((entry) => entry.kind === 'table' && entry.numericValues);
    for (const tableEntry of tables) msqTableSelect.add(new Option(tableEntry.name, tableEntry.name));
    if (previousTable && tables.some((tableEntry) => tableEntry.name === previousTable)) msqTableSelect.value = previousTable;
    const selectedTable = model.byName.get(msqTableSelect.value) ?? tables[0];
    if (!selectedTable) return;
    if (!msqTableSelect.value) msqTableSelect.value = selectedTable.name;
    const numeric = model.entries.filter((entry) => entry.numericValues);
    const xCandidates = numeric.filter((entry) => entry.numericValues?.length === selectedTable.cols && entry.name !== selectedTable.name);
    const yCandidates = numeric.filter((entry) => entry.numericValues?.length === selectedTable.rows && entry.name !== selectedTable.name);
    const tableIndex = model.entries.indexOf(selectedTable);
    const score = (entry: (typeof model.entries)[number], axis: 'x' | 'y'): number => {
      const entryIndex = model.entries.indexOf(entry);
      const name = entry.name.toLocaleLowerCase();
      let value = entry.kind === 'vector' ? 1000 : 0;
      if (entry.pageNumber !== undefined && entry.pageNumber === selectedTable.pageNumber) value += 500;
      value += Math.max(0, 240 - Math.abs(entryIndex - tableIndex) * 12);
      if (entryIndex < tableIndex) value += 50;
      if (axis === 'x' && /(rpm|speed|x.?axis|x.?bin|column)/i.test(name)) value += 140;
      if (axis === 'y' && /(map|load|tps|pressure|y.?axis|y.?bin|row)/i.test(name)) value += 140;
      return value;
    };
    const rankedX = [...xCandidates].sort((left, right) => score(right, 'x') - score(left, 'x'));
    const rankedY = [...yCandidates].sort((left, right) => score(right, 'y') - score(left, 'y'));
    for (const entry of rankedX) msqXAxisSelect.add(new Option(entry.name, entry.name));
    for (const entry of rankedY) msqYAxisSelect.add(new Option(entry.name, entry.name));
    const tableChanged = previousTable !== selectedTable.name;
    const keepX = !preferSuggested && !tableChanged && previousX && xCandidates.some((entry) => entry.name === previousX);
    const suggestedX = keepX ? previousX : rankedX[0]?.name ?? '';
    if (suggestedX) msqXAxisSelect.value = suggestedX;
    const keepY = !preferSuggested && !tableChanged && previousY && yCandidates.some((entry) => entry.name === previousY);
    const suggestedY = keepY
      ? previousY
      : rankedY.find((entry) => entry.name !== suggestedX)?.name ?? rankedY[0]?.name ?? '';
    if (suggestedY) msqYAxisSelect.value = suggestedY;
  };

  const updateAxisControls = (): void => {
    const mode = axisSourceSelect.value;
    autoAxisFields.hidden = mode !== 'auto';
    customAxisFields.hidden = mode !== 'custom';
    msqAxisFields.hidden = mode !== 'msq';
    const fixed = mode !== 'auto';
    xBinsInput.disabled = fixed;
    yBinsInput.disabled = fixed;
    xMinInput.disabled = fixed;
    xMaxInput.disabled = fixed;
    yMinInput.disabled = fixed;
    yMaxInput.disabled = fixed;
  };

  const resolveExplicitAxes = (): { xAxisValues?: readonly number[]; yAxisValues?: readonly number[]; error?: string } => {
    if (axisSourceSelect.value === 'auto') return {};
    if (axisSourceSelect.value === 'custom') {
      const xAxisValues = parseBreakpointList(xBreakpointsInput);
      const yAxisValues = parseBreakpointList(yBreakpointsInput);
      if (!xAxisValues || !yAxisValues) return { error: 'Custom X and Y breakpoints must both contain finite numeric values.' };
      return { xAxisValues, yAxisValues };
    }
    const model = context.tuneModel;
    if (!model) return { error: 'Load an MSQ file before using MSQ table axes.' };
    if (!msqTableSelect.value || !msqXAxisSelect.value || !msqYAxisSelect.value) return { error: 'Choose an MSQ table and matching X/Y axes.' };
    try {
      const table = createTuneTable2D(model, {
        tableName: msqTableSelect.value,
        xAxisName: msqXAxisSelect.value,
        yAxisName: msqYAxisSelect.value,
      });
      return { xAxisValues: table.xAxis, yAxisValues: table.yAxis };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unable to resolve MSQ table axes.' };
    }
  };

  const updateFilterCount = (): void => {
    const enabledCount = filters.filter((filter) => filter.enabled.checked).length;
    filterCount.textContent = String(enabledCount);
    filterCount.dataset.active = enabledCount > 0 ? 'true' : 'false';
    addFilterButton.disabled = filters.length >= MAX_FILTERS;
  };

  const addFilter = (seed?: Partial<HistogramFilterConditionState>): void => {
    if (filters.length >= MAX_FILTERS) return;
    const row = document.createElement('div');
    row.className = 'histogram-filter-row';
    row.innerHTML = `
      <input class="histogram-filter-enabled" type="checkbox" checked aria-label="Enable filter" />
      <select class="histogram-filter-group" aria-label="Filter group"><option value="A">A</option><option value="B">B</option><option value="C">C</option></select>
      <select class="histogram-filter-channel" aria-label="Filter channel"></select>
      <select class="histogram-filter-operator" aria-label="Filter operator">
        <option value="gt">&gt;</option><option value="gte">≥</option><option value="lt">&lt;</option><option value="lte">≤</option><option value="eq">=</option><option value="neq">≠</option>
      </select>
      <input class="histogram-filter-value" type="number" step="any" value="0" aria-label="Filter value" />
      <button type="button" class="histogram-filter-remove" aria-label="Remove filter">×</button>
    `;
    const enabled = row.querySelector<HTMLInputElement>('.histogram-filter-enabled');
    const group = row.querySelector<HTMLSelectElement>('.histogram-filter-group');
    const channel = row.querySelector<HTMLSelectElement>('.histogram-filter-channel');
    const operator = row.querySelector<HTMLSelectElement>('.histogram-filter-operator');
    const value = row.querySelector<HTMLInputElement>('.histogram-filter-value');
    const remove = row.querySelector<HTMLButtonElement>('.histogram-filter-remove');
    if (!enabled || !group || !channel || !operator || !value || !remove) throw new Error('Histogram filter row is incomplete.');
    refillChannelSelect(channel, seed?.channelId ?? '');
    enabled.checked = seed?.enabled ?? true;
    group.value = seed?.group ?? 'A';
    if (seed?.channelId && logicalChannelExists(seed.channelId)) channel.value = seed.channelId;
    if (seed?.operator) operator.value = seed.operator;
    if (seed?.value !== undefined) value.value = String(seed.value);
    const controls: FilterRowControls = { row, enabled, group, channel, operator, value };
    filters.push(controls);
    filterList.append(row);
    enabled.addEventListener('change', () => { updateFilterCount(); scheduleRender(); });
    group.addEventListener('change', () => scheduleRender());
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
  };

  const filterStates = (): HistogramFilterConditionState[] => filters.map((filter) => ({
    channelId: filter.channel.value,
    operator: filter.operator.value as NumericQualificationOperator,
    value: Number(filter.value.value),
    group: filter.group.value || 'A',
    enabled: filter.enabled.checked,
  })).filter((filter) => filter.channelId && Number.isFinite(filter.value));

  const clearFilters = (): void => {
    filters.splice(0, filters.length);
    filterList.replaceChildren();
    updateFilterCount();
  };

  const applyFilterStates = (states: readonly HistogramFilterConditionState[]): void => {
    clearFilters();
    for (const state of states.slice(0, MAX_FILTERS)) addFilter(state);
    updateFilterCount();
  };

  const qualificationGroups = (): readonly NumericQualificationGroup[] => {
    const grouped = new Map<string, NumericQualificationCondition[]>();
    for (const filter of filterStates().filter((state) => state.enabled)) {
      const conditions = grouped.get(filter.group) ?? [];
      conditions.push({ channelId: filter.channelId, operator: filter.operator, value: filter.value });
      grouped.set(filter.group, conditions);
    }
    return [...grouped.entries()].map(([id, conditions]) => ({
      id,
      logic: filterWithinLogicSelect.value as NumericQualificationLogic,
      conditions,
    }));
  };

  const populateFilterSets = (): void => {
    const previous = filterSetSelect.value;
    filterSetSelect.replaceChildren(new Option('(current filters)', ''));
    for (const set of filterSets) filterSetSelect.add(new Option(set.name, set.id));
    if (previous && filterSets.some((set) => set.id === previous)) filterSetSelect.value = previous;
    filterSetApplyButton.disabled = !filterSetSelect.value;
    filterSetDeleteButton.disabled = !filterSetSelect.value;
  };

  const applySelectedFilterSet = (): void => {
    const set = filterSets.find((candidate) => candidate.id === filterSetSelect.value);
    if (!set) return;
    filterBetweenLogicSelect.value = set.groupLogic;
    filterWithinLogicSelect.value = set.groupConditionLogic;
    applyFilterStates(set.conditions);
    scheduleRender();
  };

  const saveCurrentFilterSet = (): void => {
    const suggested = filterSets.find((candidate) => candidate.id === filterSetSelect.value)?.name ?? 'Histogram filters';
    const name = window.prompt('Filter set name', suggested)?.trim();
    if (!name) return;
    const existing = filterSets.find((candidate) => candidate.id === filterSetSelect.value);
    const set = {
      id: existing?.id ?? createHistogramLocalId('filters'),
      name,
      groupLogic: filterBetweenLogicSelect.value as NumericQualificationLogic,
      groupConditionLogic: filterWithinLogicSelect.value as NumericQualificationLogic,
      conditions: filterStates(),
    };
    filterSets = existing ? filterSets.map((candidate) => candidate.id === existing.id ? set : candidate) : [...filterSets, set];
    saveHistogramFilterSets(filterSets);
    populateFilterSets();
    filterSetSelect.value = set.id;
  };

  const deleteSelectedFilterSet = (): void => {
    if (!filterSetSelect.value) return;
    filterSets = filterSets.filter((set) => set.id !== filterSetSelect.value);
    saveHistogramFilterSets(filterSets);
    filterSetSelect.value = '';
    populateFilterSets();
  };

  const populatePresets = (): void => {
    const previous = presetSelect.value;
    presetSelect.replaceChildren(new Option('(no preset)', ''));
    for (const preset of tablePresets) presetSelect.add(new Option(preset.name, preset.id));
    if (previous && tablePresets.some((preset) => preset.id === previous)) presetSelect.value = previous;
    presetApplyButton.disabled = !presetSelect.value;
    presetDeleteButton.disabled = !presetSelect.value;
  };

  const capturePreset = (id: string, name: string): HistogramTablePresetState => ({
    id,
    name,
    scope: scopeSelect.value,
    xChannelId: xSelect.value,
    yChannelId: ySelect.value,
    zChannelId: zSelect.value,
    deltaChannelId: deltaSelect.value,
    aggregation: aggregationSelect.value as HistogramTableAggregation,
    axisSource: axisSourceSelect.value as 'auto' | 'custom' | 'msq',
    xBins: xBinsInput.value,
    yBins: yBinsInput.value,
    xMin: xMinInput.value,
    xMax: xMaxInput.value,
    yMin: yMinInput.value,
    yMax: yMaxInput.value,
    xBreakpoints: xBreakpointsInput.value,
    yBreakpoints: yBreakpointsInput.value,
    msqTable: msqTableSelect.value,
    msqXAxis: msqXAxisSelect.value,
    msqYAxis: msqYAxisSelect.value,
    showHits: showHitsInput.checked,
    minimumIndividualWeight: Number(minimumIndividualWeightInput.value) || 0,
    minimumTotalWeight: Number(minimumTotalWeightInput.value) || 0,
    colorMode: colorModeSelect.value as HistogramTableColorMode,
    groupLogic: filterBetweenLogicSelect.value as NumericQualificationLogic,
    groupConditionLogic: filterWithinLogicSelect.value as NumericQualificationLogic,
    filters: filterStates(),
  });

  const saveCurrentPreset = (): void => {
    const selected = tablePresets.find((preset) => preset.id === presetSelect.value);
    const name = window.prompt('Table preset name', selected?.name ?? 'Histogram table')?.trim();
    if (!name) return;
    const preset = capturePreset(selected?.id ?? createHistogramLocalId('preset'), name);
    tablePresets = selected ? tablePresets.map((candidate) => candidate.id === selected.id ? preset : candidate) : [...tablePresets, preset];
    const persisted = saveHistogramTablePresets(tablePresets);
    populatePresets();
    presetSelect.value = preset.id;
    presetSaveButton.title = persisted
      ? 'Save the current Table Generator setup'
      : 'Available this session; could not save locally.';
  };

  const setIfPresent = (select: HTMLSelectElement, value: string): void => {
    if ([...select.options].some((option) => option.value === value)) select.value = value;
  };

  const applyPreset = (preset: HistogramTablePresetState): void => {
    refreshLogicalSelectors();
    setIfPresent(scopeSelect, preset.scope);
    setIfPresent(xSelect, preset.xChannelId);
    setIfPresent(ySelect, preset.yChannelId);
    setIfPresent(zSelect, preset.zChannelId);
    setIfPresent(deltaSelect, preset.deltaChannelId);
    aggregationSelect.value = preset.aggregation;
    axisSourceSelect.value = preset.axisSource;
    xBinsInput.value = preset.xBins;
    yBinsInput.value = preset.yBins;
    xMinInput.value = preset.xMin;
    xMaxInput.value = preset.xMax;
    yMinInput.value = preset.yMin;
    yMaxInput.value = preset.yMax;
    xBreakpointsInput.value = preset.xBreakpoints;
    yBreakpointsInput.value = preset.yBreakpoints;
    setIfPresent(msqTableSelect, preset.msqTable);
    populateMsqAxisSelectors();
    setIfPresent(msqXAxisSelect, preset.msqXAxis);
    setIfPresent(msqYAxisSelect, preset.msqYAxis);
    showHitsInput.checked = preset.showHits;
    minimumIndividualWeightInput.value = String(preset.minimumIndividualWeight ?? 0);
    minimumTotalWeightInput.value = String(preset.minimumTotalWeight ?? 0);
    colorModeSelect.value = preset.colorMode ?? 'value';
    filterBetweenLogicSelect.value = preset.groupLogic;
    filterWithinLogicSelect.value = preset.groupConditionLogic;
    applyFilterStates(preset.filters);
    updateAxisControls();
    updateValueControls();
    scheduleRender();
  };

  const applySelectedPreset = (): void => {
    const preset = tablePresets.find((candidate) => candidate.id === presetSelect.value);
    if (preset) applyPreset(preset);
  };

  const deleteSelectedPreset = (): void => {
    if (!presetSelect.value) return;
    tablePresets = tablePresets.filter((preset) => preset.id !== presetSelect.value);
    saveHistogramTablePresets(tablePresets);
    presetSelect.value = '';
    populatePresets();
  };

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
    const aggregation = selectedAggregation();
    const usesValue = aggregation !== 'count';
    zField.hidden = !usesValue;
    deltaField.hidden = !usesValue;
    weightingFields.hidden = aggregation !== 'weighted-mean';
  };

  const materializeLogicalTraces = async (
    logicalIds: readonly string[],
    scope: ResolvedScope,
  ): Promise<ReadonlyMap<string, HistogramTraceContext>> => {
    const uniqueLogicalIds = [...new Set(logicalIds.filter(Boolean))];
    const formulaPrograms = new Map<string, ReturnType<typeof compileCalculatedField>>();
    const formulaReferenceChannels = new Map<string, ReadonlyMap<string, ChannelDefinition>>();
    const physicalIds = new Set<string>();
    for (const logicalId of uniqueLogicalIds) {
      const field = formulaForChannelId(logicalId);
      if (!field) { physicalIds.add(logicalId); continue; }
      const program = compileCalculatedField(field.expression);
      const references = new Map<string, ChannelDefinition>();
      for (const reference of program.references) {
        const channel = resolvePhysicalReference(reference);
        references.set(reference, channel);
        physicalIds.add(channel.id);
      }
      formulaPrograms.set(logicalId, program);
      formulaReferenceChannels.set(logicalId, references);
    }
    const loaded = await context.loadTraces([...physicalIds], scope.startMs, scope.endMs);
    const physical = new Map(loaded.map((trace) => [trace.channel.id, trace]));
    const result = new Map<string, HistogramTraceContext>();
    for (const logicalId of uniqueLogicalIds) {
      const direct = physical.get(logicalId);
      if (direct) { result.set(logicalId, direct); continue; }
      const field = formulaForChannelId(logicalId);
      const program = formulaPrograms.get(logicalId);
      const references = formulaReferenceChannels.get(logicalId);
      if (!field || !program || !references) continue;
      const ranges = new Map<string, HistogramTraceContext['range']>();
      let complete = true;
      let firstTrace: HistogramTraceContext | undefined;
      for (const [reference, channel] of references) {
        const trace = physical.get(channel.id);
        if (!trace) { complete = false; continue; }
        firstTrace ??= trace;
        ranges.set(reference, trace.range);
        complete &&= traceCoversScope(trace, scope);
      }
      if (ranges.size !== references.size) continue;
      result.set(logicalId, {
        channel: virtualDefinition(field),
        range: evaluateCalculatedFieldRange(program, ranges),
        complete,
        color: firstTrace?.color ?? '#58aef6',
      });
    }
    return result;
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
          ctx.font = '600 10px system-ui, sans-serif';
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
          const cellWeight = currentCellTotalWeights?.[cellIndex] ?? 0;
          const maxWeight = currentCellTotalWeights ? Math.max(0, ...currentCellTotalWeights) : 0;
          const normalized = currentAggregation === 'weighted-mean' && colorModeSelect.value === 'weight'
            ? maxWeight > 0 ? Math.max(0, Math.min(1, cellWeight / maxWeight)) : 0
            : !finite
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
          const text = formatCellValue(finite ? Number(value) : undefined, currentAggregation, cellWidth);
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
    ctx.font = '10px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    const xStep = Math.max(1, Math.ceil(result.xBins.length / Math.max(4, Math.floor(chartWidth / 72))));
    result.xBins.forEach((bin, index) => {
      if (index % xStep !== 0 && index !== result.xBins.length - 1) return;
      ctx.textAlign = 'center';
      ctx.fillText(formatNumber(bin.centerValue, 1), left + (index + .5) * cellWidth, top + chartHeight + 6);
    });
    ctx.textAlign = 'center';
    ctx.fillText(`${traceLabel(xTrace)}${xTrace.channel.unit ? ` · ${xTrace.channel.unit}` : ''}`, left + chartWidth / 2, top + chartHeight + 23);

    if (!isBar) {
      ctx.textBaseline = 'middle';
      const yStep = Math.max(1, Math.ceil(result.yBins.length / Math.max(4, Math.floor(chartHeight / 34))));
      result.yBins.forEach((bin, index) => {
        if (index % yStep !== 0 && index !== result.yBins.length - 1) return;
        ctx.textAlign = 'right';
        ctx.fillText(formatNumber(bin.centerValue, 1), left - 6, top + chartHeight - (index + .5) * cellHeight);
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
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.fillText(`${aggregationLabel(currentAggregation)} · ${valueName}`, left, 5);
  };

  const render = async (): Promise<void> => {
    const generation = ++renderGeneration;
    updateValueControls();
    tooltip.hidden = true;
    const scope = resolveScope();
    const xId = xSelect.value || context.channels[0]?.id;
    const yId = ySelect.value || context.channels[1]?.id || context.channels[0]?.id;
    const aggregation = selectedAggregation();
    const baseAggregation: NumericAggregationMethod = aggregation === 'weighted-mean' ? 'mean' : aggregation;
    const zId = aggregation === 'count' ? undefined : (zSelect.value || context.channels[0]?.id);
    const deltaId = aggregation === 'count' ? undefined : (deltaSelect.value || undefined);
    const groups = qualificationGroups();
    const filterChannelIds = groups.flatMap((group) => group.conditions.map((condition) => condition.channelId));

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
      ...filterChannelIds,
    ])];
    let byId: ReadonlyMap<string, HistogramTraceContext>;
    try {
      byId = await materializeLogicalTraces(requestedIds, scope);
    } catch (error) {
      if (generation !== renderGeneration) return;
      currentResult = undefined;
      empty.hidden = false;
      empty.querySelector('strong')!.textContent = 'Calculated field could not be evaluated.';
      empty.querySelector('span')!.textContent = error instanceof Error ? error.message : 'Check the saved formula.';
      canvas.hidden = true;
      status.hidden = true;
      exportButton.disabled = true;
      return;
    }
    if (generation !== renderGeneration) return;
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
    qualificationChannels.set(xId, { range: xTrace.range, complete: xTrace.complete });
    for (const channelId of filterChannelIds) {
      const trace = byId.get(channelId);
      if (trace) qualificationChannels.set(channelId, { range: trace.range, complete: trace.complete });
    }
    const qualified = qualifyNumericSampleGroups({
      referenceChannelId: xId,
      channels: qualificationChannels,
      groupLogic: filterBetweenLogicSelect.value as NumericQualificationLogic,
      groups,
      ...(scope.startMs !== undefined && scope.endMs !== undefined
        ? { timeRange: { startMs: scope.startMs, endMs: scope.endMs } }
        : {}),
    });

    const valueRange = aggregation === 'count'
      ? undefined
      : deltaTrace && zTrace ? subtractNumericRanges(zTrace.range, deltaTrace.range) : zTrace!.range;
    const explicitAxes = resolveExplicitAxes();
    if (explicitAxes.error) {
      currentResult = undefined;
      currentXTrace = xTrace;
      currentYTrace = yTrace;
      currentZTrace = zTrace;
      currentDeltaTrace = deltaTrace;
      currentScope = scope;
      layout = undefined;
      empty.hidden = false;
      empty.querySelector('strong')!.textContent = 'Table axis configuration is incomplete.';
      empty.querySelector('span')!.textContent = explicitAxes.error;
      canvas.hidden = true;
      status.hidden = true;
      exportButton.disabled = true;
      return;
    }
    const xMin = optionalFinite(xMinInput);
    const xMax = optionalFinite(xMaxInput);
    const yMin = optionalFinite(yMinInput);
    const yMax = optionalFinite(yMaxInput);
    const result = buildNumericHeatmap(xTrace.range, yTrace.range, {
      sampleIndices: qualified.eligibleSampleIndices,
      ...(explicitAxes.xAxisValues ? { xAxisValues: explicitAxes.xAxisValues } : { xBinCount: binCount(xBinsInput, 16) }),
      ...(explicitAxes.yAxisValues ? { yAxisValues: explicitAxes.yAxisValues } : { yBinCount: binCount(yBinsInput, 16) }),
      ...(explicitAxes.xAxisValues || explicitAxes.yAxisValues ? { clampExplicitAxisEdges: true } : {}),
      ...(!explicitAxes.xAxisValues && xMin !== undefined ? { xMin } : {}),
      ...(!explicitAxes.xAxisValues && xMax !== undefined ? { xMax } : {}),
      ...(!explicitAxes.yAxisValues && yMin !== undefined ? { yMin } : {}),
      ...(!explicitAxes.yAxisValues && yMax !== undefined ? { yMax } : {}),
      aggregation: baseAggregation,
      ...(valueRange ? { valueRange } : {}),
    });

    let displayResult = result;
    currentCellTotalWeights = undefined;
    currentWeightedContributingCounts = undefined;
    if (aggregation === 'weighted-mean' && valueRange) {
      const weighted = buildCellCenteredWeightedMean(xTrace.range, yTrace.range, valueRange, result, {
        minimumIndividualWeight: Math.max(0, Math.min(1, Number(minimumIndividualWeightInput.value) || 0)),
        minimumTotalWeight: Math.max(0, Number(minimumTotalWeightInput.value) || 0),
      });
      currentCellTotalWeights = weighted.cellTotalWeights;
      currentWeightedContributingCounts = weighted.cellContributingSampleCounts;
      displayResult = {
        ...result,
        counts: weighted.cellContributingSampleCounts,
        cellValues: weighted.cellValues,
        cellValueSampleCounts: weighted.cellContributingSampleCounts,
        cellSampleIndices: weighted.cellSampleIndices,
        cellValueMin: weighted.cellValueMin,
        cellValueMax: weighted.cellValueMax,
        maxCellCount: Math.max(0, ...weighted.cellContributingSampleCounts),
        valueValidSampleCount: weighted.contributingSampleCount,
        valueInvalidSampleCount: weighted.invalidValueSampleCount,
        valueUnavailableSampleCount: weighted.unavailableValueSampleCount,
      };
    }

    const complete = qualified.complete
      && traceCoversScope(yTrace, scope)
      && (!zTrace || traceCoversScope(zTrace, scope))
      && (!deltaTrace || traceCoversScope(deltaTrace, scope))
      && displayResult.unavailableSampleCount === 0
      && displayResult.valueUnavailableSampleCount === 0;

    currentResult = displayResult;
    currentAggregation = aggregation;
    currentXTrace = xTrace;
    currentYTrace = yTrace;
    currentZTrace = zTrace;
    currentDeltaTrace = deltaTrace;
    currentScope = scope;
    currentFilterDescription = groups.length === 0
      ? 'None'
      : groups.map((group) => `(${group.conditions.map((condition) => {
          const trace = byId.get(condition.channelId);
          return `${trace ? traceLabel(trace) : condition.channelId} ${operatorLabel(condition.operator)} ${condition.value}`;
        }).join(group.logic === 'and' ? ' AND ' : ' OR ')})`).join(filterBetweenLogicSelect.value === 'and' ? ' AND ' : ' OR ');

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
    summary('binned').textContent = displayResult.binnedSampleCount.toLocaleString();
    summary('outside').textContent = displayResult.outsideRangeSampleCount.toLocaleString();
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
    const xCenters = result.xBins.map((bin) => bin.centerValue);
    const rows: string[] = [
      quote('EpicScope Histogram Table Generator'),
      ['Scope', currentScope.label].map(quote).join(','),
      ['X', traceLabel(xTrace), xTrace.channel.unit ?? ''].map(quote).join(','),
      ['Y', traceLabel(yTrace), yTrace.channel.unit ?? ''].map(quote).join(','),
      ['Cell', aggregationLabel(currentAggregation), zDescription, currentZTrace?.channel.unit ?? ''].map(quote).join(','),
      ['Filters', currentFilterDescription].map(quote).join(','),
      '',
      [traceLabel(yTrace) + ' \\ ' + traceLabel(xTrace), ...xCenters.map((value) => formatNumber(value, 6))].map(quote).join(','),
    ];
    for (let yIndex = result.yBins.length - 1; yIndex >= 0; yIndex -= 1) {
      const yBin = result.yBins[yIndex]!;
      const values: (string | number)[] = [formatNumber(yBin.centerValue, 6)];
      for (let xIndex = 0; xIndex < result.xBins.length; xIndex += 1) {
        const value = result.cellValues[yIndex * result.xBins.length + xIndex];
        values.push(value !== undefined && Number.isFinite(value) ? Number(value) : '');
      }
      rows.push(values.map(quote).join(','));
    }
    rows.push('', 'Hit counts', [traceLabel(yTrace) + ' \\ ' + traceLabel(xTrace), ...xCenters.map((value) => formatNumber(value, 6))].map(quote).join(','));
    for (let yIndex = result.yBins.length - 1; yIndex >= 0; yIndex -= 1) {
      const yBin = result.yBins[yIndex]!;
      const values: (string | number)[] = [formatNumber(yBin.centerValue, 6)];
      for (let xIndex = 0; xIndex < result.xBins.length; xIndex += 1) {
        values.push(result.counts[yIndex * result.xBins.length + xIndex] ?? 0);
      }
      rows.push(values.map(quote).join(','));
    }
    if (currentAggregation === 'weighted-mean' && currentCellTotalWeights) {
      rows.push('', 'Total hit weights', [traceLabel(yTrace) + ' \\ ' + traceLabel(xTrace), ...xCenters.map((value) => formatNumber(value, 6))].map(quote).join(','));
      for (let yIndex = result.yBins.length - 1; yIndex >= 0; yIndex -= 1) {
        const yBin = result.yBins[yIndex]!;
        const values: (string | number)[] = [formatNumber(yBin.centerValue, 6)];
        for (let xIndex = 0; xIndex < result.xBins.length; xIndex += 1) {
          values.push(currentCellTotalWeights[yIndex * result.xBins.length + xIndex] ?? 0);
        }
        rows.push(values.map(quote).join(','));
      }
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

  const cellAtPointer = (event: MouseEvent): { xIndex: number; yIndex: number; cellIndex: number } | undefined => {
    const result = currentResult;
    const currentLayout = layout;
    if (!result || !currentLayout || result.xBins.length === 0 || result.yBins.length === 0) return undefined;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < currentLayout.left || x >= currentLayout.left + currentLayout.width || y < currentLayout.top || y >= currentLayout.top + currentLayout.height) return undefined;
    const xIndex = Math.min(result.xBins.length - 1, Math.max(0, Math.floor((x - currentLayout.left) / currentLayout.cellWidth)));
    const yFromTop = Math.min(result.yBins.length - 1, Math.max(0, Math.floor((y - currentLayout.top) / currentLayout.cellHeight)));
    const yIndex = result.yBins.length - 1 - yFromTop;
    return { xIndex, yIndex, cellIndex: yIndex * result.xBins.length + xIndex };
  };

  const timeForSourceIndex = (sampleIndex: number): number | undefined => {
    const trace = currentXTrace;
    if (!trace) return undefined;
    const localIndex = sampleIndex - trace.range.startSampleIndex;
    if (!Number.isSafeInteger(localIndex) || localIndex < 0 || localIndex >= trace.range.timeMs.length) return undefined;
    const time = trace.range.timeMs[localIndex];
    return time !== undefined && Number.isFinite(time) ? time : undefined;
  };

  const closeCellInspector = (): void => {
    selectedCell = undefined;
    cellInspector.hidden = true;
  };

  const openCellInspector = (event: MouseEvent): void => {
    const result = currentResult;
    const xTrace = currentXTrace;
    const yTrace = currentYTrace;
    const cell = cellAtPointer(event);
    if (!result || !xTrace || !yTrace || !cell) return;
    const sourceIndices = [...(result.cellSampleIndices[cell.cellIndex] ?? new Uint32Array(0))];
    const times = sourceIndices.flatMap((sampleIndex) => {
      const time = timeForSourceIndex(sampleIndex);
      return time === undefined ? [] : [time];
    });
    const xBin = result.xBins[cell.xIndex]!;
    const yBin = result.yBins[cell.yIndex]!;
    const value = result.cellValues[cell.cellIndex];
    const count = result.counts[cell.cellIndex] ?? 0;
    const label = `${traceLabel(xTrace)} ${formatNumber(xBin.centerValue)} × ${traceLabel(yTrace)} ${formatNumber(yBin.centerValue)}`;
    selectedCell = { cellIndex: cell.cellIndex, xIndex: cell.xIndex, yIndex: cell.yIndex, sampleIndices: sourceIndices, timeMs: times, label };
    cellInspectorTitle.textContent = label;
    const totalWeight = currentCellTotalWeights?.[cell.cellIndex];
    cellInspectorSubtitle.textContent = `${aggregationLabel(currentAggregation)} ${formatCellValue(value, currentAggregation, 120)} · ${count.toLocaleString()} hits${currentAggregation === 'weighted-mean' ? ` · weight ${formatNumber(totalWeight, 3)}` : ''}`;
    cellInspectorSummary.innerHTML = `<span>${traceLabel(xTrace)} ${formatNumber(xBin.lowerBound)}–${formatNumber(xBin.upperBound)}</span><span>${traceLabel(yTrace)} ${formatNumber(yBin.lowerBound)}–${formatNumber(yBin.upperBound)}</span>`;
    const shown = sourceIndices.slice(0, 200);
    cellSampleList.replaceChildren(...shown.map((sampleIndex, index) => {
      const row = document.createElement('div');
      const time = times[index];
      row.innerHTML = `<span>#${sampleIndex.toLocaleString()}</span><strong>${time === undefined ? '—' : `${(time / 1000).toFixed(3)} s`}</strong>`;
      return row;
    }));
    cellListNote.textContent = sourceIndices.length > 200 ? `Showing 200 of ${sourceIndices.length.toLocaleString()} exact hits` : `${sourceIndices.length.toLocaleString()} exact hits`;
    cellOpenLoggerButton.disabled = times.length === 0 || !context.openSamplesInLogger;
    cellCopyButton.disabled = sourceIndices.length === 0;
    cellInspector.hidden = false;
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
    const cell = cellAtPointer(event);
    if (!cell) {
      tooltip.hidden = true;
      return;
    }
    const { xIndex, yIndex, cellIndex } = cell;
    const xBin = result.xBins[xIndex]!;
    const yBin = result.yBins[yIndex]!;
    const value = result.cellValues[cellIndex];
    const count = result.counts[cellIndex] ?? 0;
    const validValues = result.cellValueSampleCounts[cellIndex] ?? 0;
    const totalWeight = currentCellTotalWeights?.[cellIndex];
    const weightedHits = currentWeightedContributingCounts?.[cellIndex];
    const zName = result.aggregationMethod === 'count'
      ? 'Count'
      : currentDeltaTrace && currentZTrace
        ? `${traceLabel(currentZTrace)} − ${traceLabel(currentDeltaTrace)}`
        : currentZTrace ? traceLabel(currentZTrace) : 'Value';
    const heading = document.createElement('strong');
    heading.textContent = `${aggregationLabel(currentAggregation)} · ${zName}: ${formatCellValue(value, currentAggregation, 100)}`;
    const xDetail = document.createElement('span');
    xDetail.textContent = `${traceLabel(xTrace)}: ${formatNumber(xBin.lowerBound)} to ${formatNumber(xBin.upperBound)}`;
    const yDetail = document.createElement('span');
    yDetail.textContent = `${traceLabel(yTrace)}: ${formatNumber(yBin.lowerBound)} to ${formatNumber(yBin.upperBound)}`;
    const hitDetail = document.createElement('span');
    hitDetail.textContent = `Hits: ${count.toLocaleString()}${result.aggregationMethod === 'count' ? '' : ` · valid Z: ${validValues.toLocaleString()}`}`;
    const tooltipChildren: Node[] = [heading, xDetail, yDetail, hitDetail];
    if (currentAggregation === 'weighted-mean') {
      const weightDetail = document.createElement('span');
      weightDetail.textContent = `Total hit weight: ${formatNumber(totalWeight, 3)} · weighted hits: ${(weightedHits ?? 0).toLocaleString()}`;
      tooltipChildren.push(weightDetail);
    }
    tooltip.replaceChildren(...tooltipChildren);
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
    closeCellInspector();
    refillChannelSelect(xSelect, previousX);
    refillChannelSelect(ySelect, previousY);
    refillChannelSelect(zSelect, previousZ);
    refillChannelSelect(deltaSelect, previousDelta, true);
    if (!previousX || !logicalChannelExists(previousX)) {
      xSelect.value = preferredChannel(context.channels, [/\brpm\b/i, /engine.*speed/i], 0)?.id ?? '';
    }
    if (!previousY || !logicalChannelExists(previousY)) {
      ySelect.value = preferredChannel(context.channels, [/\bmap\b/i, /manifold.*pressure/i, /\bload\b/i], 1)?.id ?? xSelect.value;
    }
    if (!previousZ || !logicalChannelExists(previousZ)) {
      zSelect.value = preferredChannel(context.channels, [/\bafr\b/i, /lambda/i, /spark.*adv/i], 2)?.id ?? xSelect.value;
    }
    for (const filter of filters) {
      const previous = filter.channel.value;
      refillChannelSelect(filter.channel, previous);
    }
    populateFormulaManager();
    populateFilterSets();
    populatePresets();
    populateScopeOptions();
    populateMsqAxisSelectors();
    updateAxisControls();
    updateValueControls();
    scheduleRender();
  };

  formulaSelect.addEventListener('change', loadSelectedFormulaEditor);
  formulaSaveButton.addEventListener('click', saveFormula);
  formulaDeleteButton.addEventListener('click', deleteFormula);
  presetSelect.addEventListener('change', () => { presetApplyButton.disabled = !presetSelect.value; presetDeleteButton.disabled = !presetSelect.value; });
  presetApplyButton.addEventListener('click', applySelectedPreset);
  presetSaveButton.addEventListener('click', saveCurrentPreset);
  presetDeleteButton.addEventListener('click', deleteSelectedPreset);
  filterSetSelect.addEventListener('change', () => { filterSetApplyButton.disabled = !filterSetSelect.value; filterSetDeleteButton.disabled = !filterSetSelect.value; });
  filterSetApplyButton.addEventListener('click', applySelectedFilterSet);
  filterSetSaveButton.addEventListener('click', saveCurrentFilterSet);
  filterSetDeleteButton.addEventListener('click', deleteSelectedFilterSet);
  filterWithinLogicSelect.addEventListener('change', () => scheduleRender());
  filterBetweenLogicSelect.addEventListener('change', () => scheduleRender());
  addFilterButton.addEventListener('click', () => addFilter());
  for (const button of sizeButtons) {
    button.addEventListener('click', () => {
      const raw = button.dataset.grid ?? '';
      const [columnsRaw, rowsRaw] = raw.split('x');
      const columns = Number(columnsRaw);
      const rows = Number(rowsRaw);
      if (!Number.isFinite(columns) || !Number.isFinite(rows)) return;
      axisSourceSelect.value = 'auto';
      xBinsInput.value = String(columns);
      yBinsInput.value = String(rows);
      axisSourceSelect.dispatchEvent(new Event('change'));
      scheduleRender();
    });
  }
  scopeSelect.addEventListener('change', () => scheduleRender());
  xSelect.addEventListener('change', () => scheduleRender());
  ySelect.addEventListener('change', () => scheduleRender());
  zSelect.addEventListener('change', () => scheduleRender());
  deltaSelect.addEventListener('change', () => scheduleRender());
  aggregationSelect.addEventListener('change', () => { updateValueControls(); scheduleRender(); });
  axisSourceSelect.addEventListener('change', () => { updateAxisControls(); scheduleRender(); });
  xBreakpointsInput.addEventListener('input', () => scheduleRender(180));
  yBreakpointsInput.addEventListener('input', () => scheduleRender(180));
  msqTableSelect.addEventListener('change', () => { populateMsqAxisSelectors(true); scheduleRender(); });
  msqXAxisSelect.addEventListener('change', () => scheduleRender());
  msqYAxisSelect.addEventListener('change', () => scheduleRender());
  xBinsInput.addEventListener('input', () => scheduleRender(120));
  yBinsInput.addEventListener('input', () => scheduleRender(120));
  xMinInput.addEventListener('input', () => scheduleRender(160));
  xMaxInput.addEventListener('input', () => scheduleRender(160));
  yMinInput.addEventListener('input', () => scheduleRender(160));
  yMaxInput.addEventListener('input', () => scheduleRender(160));
  showHitsInput.addEventListener('change', renderChart);
  minimumIndividualWeightInput.addEventListener('input', () => scheduleRender(120));
  minimumTotalWeightInput.addEventListener('input', () => scheduleRender(120));
  colorModeSelect.addEventListener('change', renderChart);
  window.addEventListener('epicscope-histogram-calculated-fields-changed', () => {
    calculatedFields = loadHistogramCalculatedFields();
    populateFormulaManager();
    loadSelectedFormulaEditor();
    refreshLogicalSelectors();
    scheduleRender();
  });
  exportButton.addEventListener('click', exportCsv);
  cellInspectorClose.addEventListener('click', closeCellInspector);
  cellCopyButton.addEventListener('click', () => {
    if (!selectedCell) return;
    const lines = selectedCell.sampleIndices.map((sampleIndex, index) => `${sampleIndex}\t${selectedCell!.timeMs[index] ?? ''}`);
    void navigator.clipboard.writeText(['sampleIndex\ttimeMs', ...lines].join('\n'));
  });
  cellOpenLoggerButton.addEventListener('click', () => {
    if (!selectedCell || !context.openSamplesInLogger || selectedCell.timeMs.length === 0) return;
    void context.openSamplesInLogger({ sampleIndices: selectedCell.sampleIndices, timeMs: selectedCell.timeMs, label: selectedCell.label });
  });
  canvas.addEventListener('click', openCellInspector);
  canvas.addEventListener('mousemove', updateTooltip);
  canvas.addEventListener('mouseleave', () => { tooltip.hidden = true; });
  new ResizeObserver(() => {
    if (!root.hidden && currentResult && !canvas.hidden) renderChart();
  }).observe(canvas);

  populateFormulaManager();
  loadSelectedFormulaEditor();
  populateFilterSets();
  populatePresets();
  populateScopeOptions();
  populateMsqAxisSelectors();
  updateAxisControls();
  updateFilterCount();
  updateValueControls();

  return { element: root, setContext, refresh: () => scheduleRender() };
}
