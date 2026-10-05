from pathlib import Path


def read(path): return Path(path).read_text(encoding='utf-8')
def write(path, text): Path(path).write_text(text, encoding='utf-8')
def rep(text, old, new, label):
    if old not in text: raise SystemExit(f'missing marker: {label}')
    return text.replace(old, new, 1)

path = 'apps/web/src/pages/histogram-table-generator-view.ts'
s = read(path)

# Imports and filter row state.
s = rep(s,
"import { subtractNumericRanges } from '../../../../core/analysis/numeric-range-arithmetic';\nimport {\n  qualifyNumericSamples,\n  type NumericQualificationCondition,\n  type NumericQualificationOperator,\n} from '../../../../core/analysis/sample-qualification';",
"import { subtractNumericRanges } from '../../../../core/analysis/numeric-range-arithmetic';\nimport { compileCalculatedField, evaluateCalculatedFieldRange } from '../../../../core/analysis/calculated-field';\nimport {\n  qualifyNumericSampleGroups,\n  type NumericQualificationCondition,\n  type NumericQualificationGroup,\n  type NumericQualificationLogic,\n  type NumericQualificationOperator,\n} from '../../../../core/analysis/sample-qualification';",
'import qualification')
s = rep(s,
"import type { HistogramPageContext, HistogramTraceContext } from './histogram-page';",
"import type { HistogramPageContext, HistogramTraceContext } from './histogram-page';\nimport {\n  createHistogramLocalId,\n  loadHistogramCalculatedFields,\n  loadHistogramFilterSets,\n  loadHistogramTablePresets,\n  saveHistogramCalculatedFields,\n  saveHistogramFilterSets,\n  saveHistogramTablePresets,\n  type HistogramCalculatedFieldDefinition,\n  type HistogramFilterConditionState,\n  type HistogramTablePresetState,\n} from '../state/histogram-table-storage';",
'import storage')
s = rep(s,
"interface FilterRowControls {\n  readonly row: HTMLElement;\n  readonly enabled: HTMLInputElement;\n  readonly channel: HTMLSelectElement;\n  readonly operator: HTMLSelectElement;\n  readonly value: HTMLInputElement;\n}",
"interface FilterRowControls {\n  readonly row: HTMLElement;\n  readonly enabled: HTMLInputElement;\n  readonly group: HTMLSelectElement;\n  readonly channel: HTMLSelectElement;\n  readonly operator: HTMLSelectElement;\n  readonly value: HTMLInputElement;\n}",
'filter row interface')

# Operator label neq.
s = rep(s,
"  if (operator === 'lte') return '≤';\n  return '=';",
"  if (operator === 'lte') return '≤';\n  if (operator === 'neq') return '≠';\n  return '=';",
'operator neq')

# State loaded from local browser.
s = rep(s,
"  let currentFilterDescription = 'None';\n  let layout: ChartLayout | undefined;",
"  let currentFilterDescription = 'None';\n  let layout: ChartLayout | undefined;\n  let calculatedFields = loadHistogramCalculatedFields();\n  let filterSets = loadHistogramFilterSets();\n  let tablePresets = loadHistogramTablePresets();",
'local state')

# Toolbar: presets/formulas and richer filters.
s = rep(s,
'''      <label class="histogram-table-delta-field"><span>Z delta</span><select class="histogram-table-delta"><option value="">(none)</option></select></label>
      <details class="histogram-table-filters">
        <summary>Filters <span class="histogram-filter-count">0</span></summary>
        <div class="histogram-table-filter-popover">
          <div class="histogram-filter-list"></div>
          <div class="histogram-filter-actions">
            <button type="button" class="histogram-add-filter">+ Add filter</button>
            <span>Enabled filters use AND semantics.</span>
          </div>
        </div>
      </details>''',
'''      <label class="histogram-table-delta-field"><span>Z delta</span><select class="histogram-table-delta"><option value="">(none)</option></select></label>
      <details class="histogram-table-presets">
        <summary>Presets</summary>
        <div class="histogram-table-preset-popover">
          <select class="histogram-preset-select" aria-label="Saved table preset"></select>
          <div><button type="button" class="histogram-preset-apply">Apply</button><button type="button" class="histogram-preset-save">Save current…</button><button type="button" class="histogram-preset-delete">Delete</button></div>
          <small>Presets retain channels, formulas by ID, filters, statistic, scope and axis configuration.</small>
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
        <div class="histogram-table-filter-popover">
          <div class="histogram-filter-set-bar"><select class="histogram-filter-set-select" aria-label="Saved filter set"></select><button type="button" class="histogram-filter-set-apply">Apply</button><button type="button" class="histogram-filter-set-save">Save set…</button><button type="button" class="histogram-filter-set-delete">Delete</button></div>
          <div class="histogram-filter-logic-bar"><label><span>Within group</span><select class="histogram-filter-within-logic"><option value="and">ALL</option><option value="or">ANY</option></select></label><label><span>Between groups</span><select class="histogram-filter-between-logic"><option value="and">ALL</option><option value="or">ANY</option></select></label><small>Assign rows to A/B/C. ALL/ANY controls conditions inside and between groups.</small></div>
          <div class="histogram-filter-list"></div>
          <div class="histogram-filter-actions">
            <button type="button" class="histogram-add-filter">+ Add filter</button>
            <span>Filters can use physical or calculated channels.</span>
          </div>
        </div>
      </details>''',
'toolbar tooling')

# Query new controls.
s = rep(s,
"  const filterCount = root.querySelector<HTMLElement>('.histogram-filter-count');\n  const filterList = root.querySelector<HTMLElement>('.histogram-filter-list');\n  const addFilterButton = root.querySelector<HTMLButtonElement>('.histogram-add-filter');",
"""  const presetSelect = root.querySelector<HTMLSelectElement>('.histogram-preset-select');
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
  const addFilterButton = root.querySelector<HTMLButtonElement>('.histogram-add-filter');""",
'query tooling')

s = rep(s,
"    || !filterCount || !filterList || !addFilterButton || !axisSourceSelect || !customAxisFields || !xBreakpointsInput || !yBreakpointsInput",
"""    || !presetSelect || !presetApplyButton || !presetSaveButton || !presetDeleteButton || !formulaCount || !formulaSelect || !formulaNameInput
    || !formulaExpressionInput || !formulaUnitInput || !formulaSaveButton || !formulaDeleteButton || !formulaStatus || !filterCount
    || !filterSetSelect || !filterSetApplyButton || !filterSetSaveButton || !filterSetDeleteButton || !filterWithinLogicSelect || !filterBetweenLogicSelect
    || !filterList || !addFilterButton || !axisSourceSelect || !customAxisFields || !xBreakpointsInput || !yBreakpointsInput""",
'structure tooling')

# Replace channel refill with logical virtual-channel awareness and managers.
old = '''  const refillChannelSelect = (select: HTMLSelectElement, previous: string, includeNone = false): void => {
    select.replaceChildren();
    if (includeNone) select.add(new Option('(none)', ''));
    for (const channel of context.channels) select.add(new Option(channelLabel(channel), channel.id));
    if (previous && context.channels.some((channel) => channel.id === previous)) select.value = previous;
  };
'''
new = '''  const formulaChannelId = (id: string): string => `formula:${id}`;
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
      saveHistogramCalculatedFields(calculatedFields);
      populateFormulaManager();
      formulaSelect.value = field.id;
      refreshLogicalSelectors();
      formulaStatus.textContent = `Saved ${field.name}.`;
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
'''
if old not in s: raise SystemExit('missing refill logical marker')
s = s.replace(old, new, 1)

# Replace addFilter and enabledConditions with grouped/state aware implementation.
start = s.index('  const updateFilterCount = (): void => {')
end = s.index('  const populateScopeOptions = (): void => {', start)
block = '''  const updateFilterCount = (): void => {
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

'''
s = s[:start] + block + s[end:]

# Preset functions inserted before scope options.
marker = '  const populateScopeOptions = (): void => {'
preset_funcs = '''  const populatePresets = (): void => {
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
    aggregation: aggregationSelect.value as NumericAggregationMethod,
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
    saveHistogramTablePresets(tablePresets);
    populatePresets();
    presetSelect.value = preset.id;
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

'''
if marker not in s: raise SystemExit('missing scope marker')
s = s.replace(marker, preset_funcs + marker, 1)

# Insert logical trace materialization helpers before traceCoversScope.
marker = '  const traceCoversScope = (trace: HistogramTraceContext, scope: ResolvedScope): boolean => {'
helpers = '''  const materializeLogicalTraces = async (
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

'''
if marker not in s: raise SystemExit('missing trace scope marker')
s = s.replace(marker, helpers + marker, 1)

# Render: replace conditions/request loading and qualification with logical/grouped.
old = '''    const conditions = enabledConditions();
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
'''
new = '''    const groups = qualificationGroups();
    const filterChannelIds = groups.flatMap((group) => group.conditions.map((condition) => condition.channelId));
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
'''
if old not in s: raise SystemExit('missing render loading block')
s = s.replace(old, new, 1)

old = '''    const qualificationChannels = new Map<string, { range: HistogramTraceContext['range']; complete: boolean }>();
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
'''
new = '''    const qualificationChannels = new Map<string, { range: HistogramTraceContext['range']; complete: boolean }>();
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
'''
if old not in s: raise SystemExit('missing qualification block')
s = s.replace(old, new, 1)

# Filter description grouped.
s = rep(s,
'''    currentFilterDescription = conditions.length === 0
      ? 'None'
      : conditions.map((condition) => {
          const channel = context.channels.find((definition) => definition.id === condition.channelId);
          return `${channel ? channelLabel(channel) : condition.channelId} ${operatorLabel(condition.operator)} ${condition.value}`;
        }).join(' AND ');''',
'''    currentFilterDescription = groups.length === 0
      ? 'None'
      : groups.map((group) => `(${group.conditions.map((condition) => {
          const trace = byId.get(condition.channelId);
          return `${trace ? traceLabel(trace) : condition.channelId} ${operatorLabel(condition.operator)} ${condition.value}`;
        }).join(group.logic === 'and' ? ' AND ' : ' OR ')})`).join(filterBetweenLogicSelect.value === 'and' ? ' AND ' : ' OR ');''',
'filter description')

# setContext logical selector refill and tooling refresh.
s = rep(s,
'''    refillChannelSelect(xSelect, previousX);
    refillChannelSelect(ySelect, previousY);
    refillChannelSelect(zSelect, previousZ);
    refillChannelSelect(deltaSelect, previousDelta, true);
    if (!previousX || !context.channels.some((channel) => channel.id === previousX)) {''',
'''    refillChannelSelect(xSelect, previousX);
    refillChannelSelect(ySelect, previousY);
    refillChannelSelect(zSelect, previousZ);
    refillChannelSelect(deltaSelect, previousDelta, true);
    if (!previousX || !logicalChannelExists(previousX)) {''',
'setcontext x')
s = s.replace("if (!previousY || !context.channels.some((channel) => channel.id === previousY)) {", "if (!previousY || !logicalChannelExists(previousY)) {", 1)
s = s.replace("if (!previousZ || !context.channels.some((channel) => channel.id === previousZ)) {", "if (!previousZ || !logicalChannelExists(previousZ)) {", 1)
# Replace filter refill in setContext.
old = '''    for (const filter of filters) {
      const previous = filter.channel.value;
      filter.channel.replaceChildren();
      for (const channel of context.channels) filter.channel.add(new Option(channelLabel(channel), channel.id));
      if (previous && context.channels.some((channel) => channel.id === previous)) filter.channel.value = previous;
    }
    populateScopeOptions();
    populateMsqAxisSelectors();'''
new = '''    for (const filter of filters) {
      const previous = filter.channel.value;
      refillChannelSelect(filter.channel, previous);
    }
    populateFormulaManager();
    populateFilterSets();
    populatePresets();
    populateScopeOptions();
    populateMsqAxisSelectors();'''
if old not in s: raise SystemExit('missing setContext filter refill')
s = s.replace(old, new, 1)

# Add listeners for new managers and group logic.
marker = "  addFilterButton.addEventListener('click', addFilter);"
listeners = '''  formulaSelect.addEventListener('change', loadSelectedFormulaEditor);
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
'''
if marker not in s: raise SystemExit('missing listeners marker')
s = s.replace(marker, listeners + marker, 1)

# Initial manager population.
s = rep(s,
'''  populateScopeOptions();
  populateMsqAxisSelectors();
  updateAxisControls();
  updateFilterCount();
  updateValueControls();''',
'''  populateFormulaManager();
  loadSelectedFormulaEditor();
  populateFilterSets();
  populatePresets();
  populateScopeOptions();
  populateMsqAxisSelectors();
  updateAxisControls();
  updateFilterCount();
  updateValueControls();''',
'initial tooling')

write(path, s)

# Extend styling compactly without extra permanent height.
path = 'apps/web/src/styles/histogram-table-generator.css'
s = read(path)
s += r'''

.histogram-table-presets,
.histogram-table-formulas {
  position: relative;
}

.histogram-table-presets summary,
.histogram-table-formulas summary {
  display: flex;
  min-width: 54px;
  min-height: 27px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 7px;
  cursor: pointer;
  list-style: none;
  border: 1px solid #2b4554;
  border-radius: 3px;
  background: #0f1d27;
  color: #dce9ef;
  font: 9px system-ui, sans-serif;
}

.histogram-table-presets summary::-webkit-details-marker,
.histogram-table-formulas summary::-webkit-details-marker { display: none; }

.histogram-formula-count {
  min-width: 14px;
  padding: 1px 3px;
  border-radius: 8px;
  background: #1b2c38;
  color: #8fa6b3;
  font-size: 7px;
  text-align: center;
}

.histogram-table-preset-popover,
.histogram-formula-popover {
  position: absolute;
  z-index: 35;
  top: 31px;
  right: 0;
  padding: 9px;
  border: 1px solid #355164;
  border-radius: 4px;
  background: #0b171f;
  box-shadow: 0 10px 30px rgba(0,0,0,.4);
}

.histogram-table-preset-popover { width: 330px; }
.histogram-table-preset-popover > select { width: 100%; }
.histogram-table-preset-popover > div,
.histogram-formula-actions { display: flex; gap: 6px; margin-top: 7px; align-items: center; }
.histogram-table-preset-popover small,
.histogram-formula-status,
.histogram-filter-logic-bar small { color: #718a99; font-size: 8px; line-height: 1.35; }

.histogram-formula-popover {
  display: grid;
  width: min(520px, 72vw);
  grid-template-columns: minmax(120px,.7fr) minmax(180px,1.3fr);
  gap: 7px;
}
.histogram-formula-popover label { display: grid; gap: 3px; }
.histogram-formula-popover label:nth-of-type(3) { grid-column: 1 / -1; }
.histogram-formula-popover input,
.histogram-formula-popover select,
.histogram-table-preset-popover select,
.histogram-table-preset-popover button,
.histogram-formula-popover button {
  min-height: 27px; border: 1px solid #2b4554; border-radius: 3px; background: #0f1d27; color: #dce9ef; font: 9px system-ui,sans-serif; padding: 0 6px;
}
.histogram-formula-actions { grid-column: 1 / -1; }
.histogram-formula-status { flex: 1; }

.histogram-filter-set-bar,
.histogram-filter-logic-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 7px;
  padding-bottom: 7px;
  border-bottom: 1px solid #233746;
}
.histogram-filter-set-bar select { flex: 1; min-width: 140px; }
.histogram-filter-logic-bar label { display: flex; align-items: center; gap: 4px; }
.histogram-filter-logic-bar small { margin-left: auto; }

.histogram-filter-row {
  grid-template-columns: 22px 46px minmax(140px,1fr) 58px minmax(80px,105px) 28px;
}
.histogram-filter-group { width: 46px; }
'''
write(path, s)

Path('scripts/tmp-presets-formulas-filters.py').unlink(missing_ok=True)
