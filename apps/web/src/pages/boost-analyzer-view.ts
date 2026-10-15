import { sameChannelOptionCatalog } from './channel-option-label';
import { analyzerChannelOptionLabel } from './analyzer-channel-roles';
import { analyzeBoost, compareBoostOperatingPoints, summarizeBoostDutyResponse, type BoostAnalyzerResult } from '../../../../core/analysis/boost-analyzer';
import { qualifyNumericSampleGroups, type NumericQualificationGroup } from '../../../../core/analysis/sample-qualification';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import type { LoggerAnalysisContext, LoggerAnalysisTraceContext } from './logger-page';
import { loadAnalysisFilterSets, type AnalysisFilterSetState } from '../state/analysis-filter-storage';
import { analyzerScopeBounds, populateAnalyzerScopeSelect, selectedAnalyzerScope, type AnalyzerScope } from './analyzer-scope';
import { ensureBoostAnalyzerHelp } from './boost-analyzer-help';

export interface BoostAnalyzerViewController {
  readonly element: HTMLElement;
  setActive(active: boolean): void;
  setContext(context: LoggerAnalysisContext): void;
  refresh(): void;
}

function formatNumber(value: number | undefined, precision = 3): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  return value.toFixed(precision).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function optionalNumber(input: HTMLInputElement): number | undefined {
  if (input.value.trim() === '') return undefined;
  const value = Number(input.value);
  return Number.isFinite(value) ? value : undefined;
}

function sameChannelCatalog(
  left: LoggerAnalysisContext['channels'],
  right: LoggerAnalysisContext['channels'],
): boolean {
  return sameChannelOptionCatalog(left, right);
}

export function createBoostAnalyzerView(): BoostAnalyzerViewController {
  let context: LoggerAnalysisContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };

  let active = true;
  let applyingPending = false;
  let pendingContext: LoggerAnalysisContext | undefined;
  let currentResult: BoostAnalyzerResult | undefined;
  let renderGeneration = 0;
  let analysisFilterSets = loadAnalysisFilterSets();

  const root = document.createElement('section');
  root.className = 'boost-analyzer-view';
  root.hidden = true;
  root.innerHTML = `
    <div class="boost-analyzer-banner"><strong>Boost · Experimental</strong><span>Analyze the physical pressure response to wastegate control. Closed Loop additionally enables Boost Target tracking metrics.</span></div>
    <div class="boost-analyzer-controls">
      <label><span>Control mode</span><select class="boost-control-mode"><option value="open-loop">Open Loop</option><option value="closed-loop">Closed Loop</option></select></label>
      <label><span>Measured pressure</span><select class="boost-measured"></select></label>
      <label class="boost-closed-loop-only"><span>Target pressure</span><select class="boost-target"></select></label>
      <label><span>RPM</span><select class="boost-rpm"></select></label>
      <label><span>TPS / load</span><select class="boost-tps"></select></label>
      <label><span>Upper duty</span><select class="boost-upper"></select></label>
      <label><span>Lower duty</span><select class="boost-lower"></select></label>
      <label><span>Scope</span><select class="boost-scope"></select></label>
      <label class="boost-open-loop-only"><span>Compare scope</span><select class="boost-compare-scope"></select></label>
      <label><span>Qualification</span><select class="boost-qualification"><option value="">None</option></select></label>
      <button type="button" class="boost-refresh">Analyze</button>
    </div>
    <div class="boost-analyzer-guidance" hidden><strong data-boost-help="title">What this setting does</strong><span data-boost-help="text"></span></div>
    <details class="boost-analysis-options boost-open-loop-only">
      <summary>Open-loop RPM × TPS/load operating points</summary>
      <div class="boost-analysis-options-grid">
        <label class="boost-option-toggle"><input type="checkbox" class="boost-operating-enabled" checked /><span>Build operating points</span></label>
        <label class="boost-option-toggle"><input type="checkbox" class="boost-pull-gate-enabled" /><span>High-load pull gate</span></label>
        <label><span>Min TPS / load</span><input type="number" step="any" value="80" class="boost-pull-min-tps" /></label>
        <label><span>Min pull RPM</span><input type="number" step="1" min="0" value="2000" class="boost-pull-min-rpm" /></label>
        <label><span>RPM bin size</span><input type="number" step="1" min="1" value="250" class="boost-operating-rpm-bin" /></label>
        <label><span>TPS / load bin size</span><input type="number" step="any" min="0.000001" value="5" class="boost-operating-tps-bin" /></label>
        <label><span>Minimum samples / bin</span><input type="number" step="1" min="1" value="10" class="boost-operating-min-samples" /></label>
      </div>
    </details>
    <details class="boost-analysis-options boost-open-loop-only">
      <summary>Open-loop pressure-rise spool</summary>
      <div class="boost-analysis-options-grid">
        <label class="boost-option-toggle"><input type="checkbox" class="boost-open-spool-enabled" /><span>Detect pressure-rise spool</span></label>
        <label><span>Open-loop start pressure</span><input type="number" step="any" class="boost-open-spool-start" /></label>
        <label><span>Open-loop end pressure</span><input type="number" step="any" class="boost-open-spool-end" /></label>
        <label><span>Open-loop min duration ms</span><input type="number" step="1" min="0" value="0" class="boost-open-spool-duration" /></label>
      </div>
    </details>
    <details class="boost-analysis-options boost-closed-loop-only">
      <summary>Closed-loop tracking / spool / steady-state</summary>
      <div class="boost-analysis-options-grid">
        <label><span>Target tolerance</span><input type="number" step="any" min="0" class="boost-target-tolerance" placeholder="native pressure unit" /></label>
        <label class="boost-option-toggle"><input type="checkbox" class="boost-spool-enabled" /><span>Detect spool</span></label>
        <label><span>Spool start pressure</span><input type="number" step="any" class="boost-spool-start" /></label>
        <label><span>Minimum target pressure</span><input type="number" step="any" class="boost-spool-target" /></label>
        <label><span>Completion fraction</span><input type="number" step="0.01" min="0.01" max="1" value="0.90" class="boost-spool-fraction" /></label>
        <label><span>Min spool duration ms</span><input type="number" step="1" min="0" value="0" class="boost-spool-duration" /></label>
        <label class="boost-option-toggle"><input type="checkbox" class="boost-steady-enabled" /><span>Detect steady state</span></label>
        <label><span>Max target rate / s</span><input type="number" step="any" min="0" class="boost-steady-target-rate" /></label>
        <label><span>Max measured rate / s</span><input type="number" step="any" min="0" class="boost-steady-measured-rate" /></label>
        <label><span>Min steady duration ms</span><input type="number" step="1" min="0" value="500" class="boost-steady-duration" /></label>
      </div>
    </details>
    <div class="boost-analyzer-empty">
      <strong>Boost analysis needs a measured-pressure channel available in the log and a valid scope.</strong>
      <span>RPM, TPS/load and wastegate duty channels are optional but strongly recommended for useful Open Loop evidence. Boost Target is only used in Closed Loop mode.</span>
    </div>
    <div class="boost-analyzer-content" hidden>
      <div class="boost-analyzer-summary">
        <div><span>Scope</span><strong data-boost="scope">—</strong></div>
        <div><span>Coverage</span><strong data-boost="coverage">—</strong></div>
        <div><span>Qualification</span><strong data-boost="qualification">None</strong></div>
        <div><span>Measured mean</span><strong data-boost="measured-mean">—</strong></div>
        <div><span>Measured max</span><strong data-boost="measured-max">—</strong></div>
        <div><span>Peak RPM</span><strong data-boost="peak-rpm">—</strong></div>
        <div><span>Peak TPS / load</span><strong data-boost="peak-tps">—</strong></div>
        <div><span>Peak upper duty</span><strong data-boost="peak-upper">—</strong></div>
        <div><span>Peak lower duty</span><strong data-boost="peak-lower">—</strong></div>
        <div><span>TPS / load mean</span><strong data-boost="tps-mean">—</strong></div>
        <div class="boost-closed-loop-only"><span>Target mean</span><strong data-boost="target-mean">—</strong></div>
        <div class="boost-closed-loop-only"><span>Mean error</span><strong data-boost="mean-error">—</strong></div>
        <div class="boost-closed-loop-only"><span>Mean abs error</span><strong data-boost="mae">—</strong></div>
        <div class="boost-closed-loop-only"><span>RMSE</span><strong data-boost="rmse">—</strong></div>
        <div class="boost-closed-loop-only"><span>Target attainment</span><strong data-boost="target-attainment">—</strong></div>
        <div class="boost-closed-loop-only"><span>Max overshoot</span><strong data-boost="overshoot">—</strong></div>
        <div class="boost-closed-loop-only"><span>Max undershoot</span><strong data-boost="undershoot">—</strong></div>
        <div><span>Upper duty mean</span><strong data-boost="upper-duty">—</strong></div>
        <div><span>Lower duty mean</span><strong data-boost="lower-duty">—</strong></div>
      </div>
      <div class="boost-evidence">
        <span>Scope input <strong data-boost="qualification-input">0</strong></span>
        <span>Saved eligible <strong data-boost="qualification-eligible">0</strong></span>
        <span>Quick gate eligible <strong data-boost="quick-gate-eligible">Off</strong></span>
        <span>Final eligible <strong data-boost="final-eligible">0</strong></span>
        <span>Rejected (saved) <strong data-boost="qualification-rejected">0</strong></span>
        <span>Qualification invalid <strong data-boost="qualification-invalid">0</strong></span>
        <span>Qualification unavailable <strong data-boost="qualification-unavailable">0</strong></span>
        <span class="boost-closed-loop-only">Tracking valid <strong data-boost="tracking-valid">0</strong></span>
        <span class="boost-closed-loop-only">Tracking invalid <strong data-boost="tracking-invalid">0</strong></span>
        <span class="boost-closed-loop-only">Tracking unavailable <strong data-boost="tracking-unavailable">0</strong></span>
      </div>
      <section class="boost-result-section boost-open-loop-only">
        <header><strong>RPM × TPS/load operating points</strong><span data-boost="operating-count">0</span></header>
        <div class="boost-table-wrap"><table class="boost-table boost-operating-table"><thead><tr><th>RPM bin</th><th>TPS/load bin</th><th>Samples</th><th>RPM mean</th><th>TPS/load mean</th><th>Pressure mean</th><th>Pressure min</th><th>Pressure max</th><th>Pressure SD</th><th>Variation</th><th>Evidence</th><th>Assessment</th><th>RPM trend</th><th>Load trend</th><th>What this suggests</th><th>Upper duty mean</th><th>Lower duty mean</th></tr></thead><tbody></tbody></table></div>
      </section>
      <section class="boost-result-section boost-open-loop-only boost-comparison-section" hidden>
        <header><strong>Matched scope comparison</strong><span data-boost="comparison-count">0</span></header>
        <div class="boost-evidence boost-duty-response-summary">
          <span><span data-boost-help-key="Upper response">Upper response</span> <strong data-boost="upper-response">—</strong></span>
          <span><span data-boost-help-key="Lower response">Lower response</span> <strong data-boost="lower-response">—</strong></span>
        </div>
        <div class="boost-table-wrap"><table class="boost-table boost-comparison-table"><thead><tr><th>RPM bin</th><th>TPS/load bin</th><th>Primary N</th><th>Compare N</th><th>Primary P</th><th>Compare P</th><th>Δ pressure</th><th>Δ upper duty</th><th>Δ lower duty</th><th>Observed result</th></tr></thead><tbody></tbody></table></div>
      </section>
      <section class="boost-result-section boost-open-loop-only">
        <header><strong>Open-loop pressure-rise spool events</strong><span data-boost="open-spool-count">0</span></header>
        <div class="boost-table-wrap"><table class="boost-table boost-open-spool-table"><thead><tr><th>#</th><th>Start</th><th>End</th><th>Duration</th><th>T10</th><th>T50</th><th>T90</th><th>Start P</th><th>End P</th><th>Start RPM</th><th>End RPM</th><th>Start TPS</th><th>End TPS</th><th>Upper start→end</th><th>Lower start→end</th></tr></thead><tbody></tbody></table></div>
      </section>
      <section class="boost-result-section boost-closed-loop-only">
        <header><strong>Target-relative spool events</strong><span data-boost="spool-count">0</span></header>
        <div class="boost-table-wrap"><table class="boost-table boost-spool-table"><thead><tr><th>#</th><th>Start</th><th>End</th><th>Duration</th><th>T10</th><th>T50</th><th>T90</th><th>Start P</th><th>End P</th><th>Target</th><th>Start RPM</th><th>End RPM</th></tr></thead><tbody></tbody></table></div>
      </section>
      <section class="boost-result-section boost-closed-loop-only">
        <header><strong>Closed-loop steady-state windows</strong><span data-boost="steady-count">0</span></header>
        <div class="boost-table-wrap"><table class="boost-table boost-steady-table"><thead><tr><th>#</th><th>Start</th><th>End</th><th>Duration</th><th>Samples</th><th>Target mean</th><th>Measured mean</th><th>Mean error</th><th>Overshoot</th><th>Undershoot</th></tr></thead><tbody></tbody></table></div>
      </section>
    </div>
  `;

  const modeSelect = root.querySelector<HTMLSelectElement>('.boost-control-mode');
  const measuredSelect = root.querySelector<HTMLSelectElement>('.boost-measured');
  const targetSelect = root.querySelector<HTMLSelectElement>('.boost-target');
  const rpmSelect = root.querySelector<HTMLSelectElement>('.boost-rpm');
  const tpsSelect = root.querySelector<HTMLSelectElement>('.boost-tps');
  const upperSelect = root.querySelector<HTMLSelectElement>('.boost-upper');
  const lowerSelect = root.querySelector<HTMLSelectElement>('.boost-lower');
  const scopeSelect = root.querySelector<HTMLSelectElement>('.boost-scope');
  const compareScopeSelect = root.querySelector<HTMLSelectElement>('.boost-compare-scope');
  const qualificationSelect = root.querySelector<HTMLSelectElement>('.boost-qualification');
  const refreshButton = root.querySelector<HTMLButtonElement>('.boost-refresh');
  const targetTolerance = root.querySelector<HTMLInputElement>('.boost-target-tolerance');
  const operatingEnabled = root.querySelector<HTMLInputElement>('.boost-operating-enabled');
  const pullGateEnabled = root.querySelector<HTMLInputElement>('.boost-pull-gate-enabled');
  const pullMinTps = root.querySelector<HTMLInputElement>('.boost-pull-min-tps');
  const pullMinRpm = root.querySelector<HTMLInputElement>('.boost-pull-min-rpm');
  const operatingRpmBin = root.querySelector<HTMLInputElement>('.boost-operating-rpm-bin');
  const operatingTpsBin = root.querySelector<HTMLInputElement>('.boost-operating-tps-bin');
  const operatingMinSamples = root.querySelector<HTMLInputElement>('.boost-operating-min-samples');
  const openSpoolEnabled = root.querySelector<HTMLInputElement>('.boost-open-spool-enabled');
  const openSpoolStart = root.querySelector<HTMLInputElement>('.boost-open-spool-start');
  const openSpoolEnd = root.querySelector<HTMLInputElement>('.boost-open-spool-end');
  const openSpoolDuration = root.querySelector<HTMLInputElement>('.boost-open-spool-duration');
  const spoolEnabled = root.querySelector<HTMLInputElement>('.boost-spool-enabled');
  const spoolStart = root.querySelector<HTMLInputElement>('.boost-spool-start');
  const spoolTarget = root.querySelector<HTMLInputElement>('.boost-spool-target');
  const spoolFraction = root.querySelector<HTMLInputElement>('.boost-spool-fraction');
  const spoolDuration = root.querySelector<HTMLInputElement>('.boost-spool-duration');
  const steadyEnabled = root.querySelector<HTMLInputElement>('.boost-steady-enabled');
  const steadyTargetRate = root.querySelector<HTMLInputElement>('.boost-steady-target-rate');
  const steadyMeasuredRate = root.querySelector<HTMLInputElement>('.boost-steady-measured-rate');
  const steadyDuration = root.querySelector<HTMLInputElement>('.boost-steady-duration');
  const empty = root.querySelector<HTMLElement>('.boost-analyzer-empty');
  const content = root.querySelector<HTMLElement>('.boost-analyzer-content');
  const operatingBody = root.querySelector<HTMLTableSectionElement>('.boost-operating-table tbody');
  const comparisonSection = root.querySelector<HTMLElement>('.boost-comparison-section');
  const comparisonBody = root.querySelector<HTMLTableSectionElement>('.boost-comparison-table tbody');
  const openSpoolBody = root.querySelector<HTMLTableSectionElement>('.boost-open-spool-table tbody');
  const spoolBody = root.querySelector<HTMLTableSectionElement>('.boost-spool-table tbody');
  const steadyBody = root.querySelector<HTMLTableSectionElement>('.boost-steady-table tbody');
  if (!modeSelect || !measuredSelect || !targetSelect || !rpmSelect || !tpsSelect || !upperSelect || !lowerSelect || !scopeSelect || !compareScopeSelect || !qualificationSelect || !refreshButton || !targetTolerance || !operatingEnabled || !pullGateEnabled || !pullMinTps || !pullMinRpm || !operatingRpmBin || !operatingTpsBin || !operatingMinSamples || !openSpoolEnabled || !openSpoolStart || !openSpoolEnd || !openSpoolDuration || !spoolEnabled || !spoolStart || !spoolTarget || !spoolFraction || !spoolDuration || !steadyEnabled || !steadyTargetRate || !steadyMeasuredRate || !steadyDuration || !empty || !content || !operatingBody || !comparisonSection || !comparisonBody || !openSpoolBody || !spoolBody || !steadyBody) {
    throw new Error('Boost Analyzer view structure is incomplete.');
  }

  const emptyTitle = empty.querySelector<HTMLElement>('strong')!;
  const emptyHint = empty.querySelector<HTMLElement>('span')!;
  const defaultEmptyTitle = emptyTitle.textContent;
  const defaultEmptyHint = emptyHint.textContent;
  let traceLoadFailed = false;

  const field = (name: string): HTMLElement => {
    const node = root.querySelector<HTMLElement>(`[data-boost="${name}"]`);
    if (!node) throw new Error(`Boost Analyzer field is missing: ${name}`);
    return node;
  };

  const isClosedLoop = (): boolean => modeSelect.value === 'closed-loop';

  const syncControlModeUi = (): void => {
    const closedLoop = isClosedLoop();
    for (const node of root.querySelectorAll<HTMLElement>('.boost-closed-loop-only')) node.hidden = !closedLoop;
    for (const node of root.querySelectorAll<HTMLElement>('.boost-open-loop-only')) node.hidden = closedLoop;
    targetSelect.disabled = !closedLoop;
  };

  const selectedScope = (): AnalyzerScope | undefined => selectedAnalyzerScope(scopeSelect, context);
  const selectedComparisonScope = (): AnalyzerScope | undefined => compareScopeSelect.value ? selectedAnalyzerScope(compareScopeSelect, context) : undefined;

  const selectedQualificationFilter = (): AnalysisFilterSetState | undefined =>
    qualificationSelect.value ? analysisFilterSets.find((filterSet) => filterSet.id === qualificationSelect.value) : undefined;

  const intersectSampleIndices = (left: ArrayLike<number>, right: ArrayLike<number>): Uint32Array => {
    const rightSet = new Set<number>();
    for (let index = 0; index < right.length; index += 1) {
      const value = right[index];
      if (value !== undefined) rightSet.add(value);
    }
    const result: number[] = [];
    for (let index = 0; index < left.length; index += 1) {
      const value = left[index];
      if (value !== undefined && rightSet.has(value)) result.push(value);
    }
    return Uint32Array.from(result);
  };

  const qualificationGroups = (filterSet: AnalysisFilterSetState | undefined): NumericQualificationGroup[] => {
    if (!filterSet) return [];
    const grouped = new Map<string, Array<{ channelId: string; operator: AnalysisFilterSetState['conditions'][number]['operator']; value: number }>>();
    for (const condition of filterSet.conditions) {
      if (!condition.enabled) continue;
      const groupId = condition.group || 'A';
      const conditions = grouped.get(groupId) ?? [];
      conditions.push({ channelId: condition.channelId, operator: condition.operator, value: condition.value });
      grouped.set(groupId, conditions);
    }
    return [...grouped.entries()].map(([id, conditions]) => ({ id, logic: filterSet.groupConditionLogic, conditions }));
  };

  const addOptionalTraceOptions = (select: HTMLSelectElement, preferred: string): void => {
    select.replaceChildren(new Option('(none)', ''));
    for (const channel of context.channels) select.add(new Option(analyzerChannelOptionLabel(channel), channel.id));
    if ([...select.options].some((option) => option.value === preferred)) select.value = preferred;
  };

  const fillScope = (preferred: string, comparisonPreferred = ''): void => {
    populateAnalyzerScopeSelect(scopeSelect, context, preferred);
    populateAnalyzerScopeSelect(compareScopeSelect, context, comparisonPreferred);
    compareScopeSelect.insertBefore(new Option('(none)', ''), compareScopeSelect.firstChild);
    if (comparisonPreferred === '' || ![...compareScopeSelect.options].some((option) => option.value === comparisonPreferred)) compareScopeSelect.value = '';
  };

  const fillQualification = (preferred: string): void => {
    analysisFilterSets = loadAnalysisFilterSets();
    qualificationSelect.replaceChildren(new Option('None', ''));
    const available = new Set(context.channels.map((channel) => channel.id));
    for (const filterSet of analysisFilterSets) {
      const unavailable = filterSet.conditions.some((condition) => condition.enabled && !available.has(condition.channelId));
      const option = new Option(unavailable ? `${filterSet.name} · unavailable channels` : filterSet.name, filterSet.id);
      option.disabled = unavailable;
      qualificationSelect.add(option);
    }
    const option = [...qualificationSelect.options].find((candidate) => candidate.value === preferred && !candidate.disabled);
    qualificationSelect.value = option?.value ?? '';
  };

  const render = async (): Promise<void> => {
    if (!active || applyingPending) return;
    const generation = ++renderGeneration;
    if (traceLoadFailed) {
      traceLoadFailed = false;
      emptyTitle.textContent = defaultEmptyTitle;
      emptyHint.textContent = defaultEmptyHint;
    }
    const closedLoop = isClosedLoop();
    const measuredId = measuredSelect.value || context.channels[0]?.id;
    const targetId = closedLoop ? (targetSelect.value || undefined) : undefined;
    const rpmId = rpmSelect.value || undefined;
    const tpsId = tpsSelect.value || undefined;
    const upperId = upperSelect.value || undefined;
    const lowerId = lowerSelect.value || undefined;
    const scope = selectedScope();
    const comparisonScope = !closedLoop ? selectedComparisonScope() : undefined;
    const filterSet = selectedQualificationFilter();
    if (!measuredId || !scope) {
      currentResult = undefined;
      empty.hidden = false;
      content.hidden = true;
      refreshButton.disabled = true;
      return;
    }

    const bounds = analyzerScopeBounds(scope);
    const startMs = bounds.startMs;
    const endMs = bounds.endMs;
    const comparisonBounds = comparisonScope ? analyzerScopeBounds(comparisonScope) : {};
    const filterChannelIds = filterSet
      ? [...new Set(filterSet.conditions.filter((condition) => condition.enabled).map((condition) => condition.channelId))]
      : [];
    const requestedIds = [...new Set([
      ...[measuredId, targetId, rpmId, tpsId, upperId, lowerId].filter((id): id is string => id !== undefined),
      ...filterChannelIds,
    ])];
    let loaded: Awaited<ReturnType<LoggerAnalysisContext['loadTraces']>>;
    try {
      loaded = comparisonScope ? await context.loadTraces(requestedIds) : await context.loadTraces(requestedIds, startMs, endMs);
    } catch (error) {
      if (!active || generation !== renderGeneration) return;
      currentResult = undefined;
      refreshButton.disabled = false;
      traceLoadFailed = true;
      empty.hidden = false; content.hidden = true;
      emptyTitle.textContent = 'Boost analysis could not load log channels.';
      const detail = (error instanceof Error ? error.message : typeof error === 'string' ? error : '') || 'The log data could not be loaded.';
      emptyHint.textContent = `${detail} Retry with Analyze. If it keeps failing, reload the log or choose another scope.`;
      return;
    }
    if (!active || generation !== renderGeneration) return;
    const byId = new Map(loaded.map((trace) => [trace.channel.id, trace]));
    const measured = byId.get(measuredId);
    const target = targetId ? byId.get(targetId) : undefined;
    const rpm = rpmId ? byId.get(rpmId) : undefined;
    const tps = tpsId ? byId.get(tpsId) : undefined;
    const upper = upperId ? byId.get(upperId) : undefined;
    const lower = lowerId ? byId.get(lowerId) : undefined;
    if (!measured) { empty.hidden = false; content.hidden = true; return; }
    const channels = new Map(loaded.map((trace) => [trace.channel.id, { range: trace.range, complete: trace.complete }]));
    const groups = qualificationGroups(filterSet);
    if (filterChannelIds.some((id) => !channels.has(id))) { empty.hidden = false; content.hidden = true; return; }
    const scoped = qualifyNumericSampleGroups({
      referenceChannelId: measured.channel.id,
      channels,
      groupLogic: filterSet?.groupLogic ?? 'and',
      groups,
      ...(scope.kind === 'range' && startMs !== undefined && endMs !== undefined ? { timeRange: { startMs, endMs } } : {}),
    });
    let finalEligibleSampleIndices = scoped.eligibleSampleIndices;
    let quickGateEligibleCount: number | undefined;
    let quickGateComplete = true;
    if (!closedLoop && pullGateEnabled.checked) {
      const minimumTps = optionalNumber(pullMinTps);
      const minimumRpm = optionalNumber(pullMinRpm);
      if (!rpm || !tps || minimumTps === undefined || minimumRpm === undefined) {
        currentResult = undefined;
        empty.hidden = false;
        content.hidden = true;
        empty.querySelector('strong')!.textContent = 'High-load pull gate needs RPM, TPS/load and finite minimum thresholds.';
        refreshButton.disabled = false;
        return;
      }
      const quick = qualifyNumericSampleGroups({
        referenceChannelId: measured.channel.id,
        channels,
        groupLogic: 'and',
        groups: [{ id: 'boost-high-load', logic: 'and', conditions: [
          { channelId: tps.channel.id, operator: 'gte', value: minimumTps },
          { channelId: rpm.channel.id, operator: 'gte', value: minimumRpm },
        ] }],
        ...(scope.kind === 'range' && startMs !== undefined && endMs !== undefined ? { timeRange: { startMs, endMs } } : {}),
      });
      quickGateEligibleCount = quick.eligibleSampleCount;
      quickGateComplete = quick.complete;
      finalEligibleSampleIndices = intersectSampleIndices(scoped.eligibleSampleIndices, quick.eligibleSampleIndices);
    }
    const selectedTraces = [measured, target, rpm, tps, upper, lower].filter((trace): trace is LoggerAnalysisTraceContext => trace !== undefined);
    const complete = scoped.complete && quickGateComplete && selectedTraces.every((trace) =>
      trace.complete || (startMs !== undefined && endMs !== undefined && numericRangeCoversTime(trace.range, startMs, endMs)),
    );

    const rpmBinSize = optionalNumber(operatingRpmBin);
    const tpsBinSize = optionalNumber(operatingTpsBin);
    const minimumSamples = optionalNumber(operatingMinSamples);
    let operatingPoints;
    if (!closedLoop && operatingEnabled.checked && rpm && tps && rpmBinSize !== undefined && tpsBinSize !== undefined && minimumSamples !== undefined) {
      operatingPoints = { rpmBinSize, tpsBinSize, minimumSamples };
    }
    const openSpoolStartValue = optionalNumber(openSpoolStart);
    const openSpoolEndValue = optionalNumber(openSpoolEnd);
    let openLoopSpool;
    if (!closedLoop && openSpoolEnabled.checked && openSpoolStartValue !== undefined && openSpoolEndValue !== undefined) {
      openLoopSpool = {
        startPressure: openSpoolStartValue,
        endPressure: openSpoolEndValue,
        minimumDurationMs: optionalNumber(openSpoolDuration) ?? 0,
      };
    }
    const spoolStartValue = optionalNumber(spoolStart);
    const spoolTargetValue = optionalNumber(spoolTarget);
    const steadyTargetRateValue = optionalNumber(steadyTargetRate);
    let spool;
    if (closedLoop && spoolEnabled.checked && target && spoolStartValue !== undefined && spoolTargetValue !== undefined) {
      spool = {
        startPressure: spoolStartValue,
        minimumTargetPressure: spoolTargetValue,
        completionFraction: optionalNumber(spoolFraction) ?? 0.9,
        minimumDurationMs: optionalNumber(spoolDuration) ?? 0,
      };
    }
    let steadyState;
    if (closedLoop && steadyEnabled.checked && target && steadyTargetRateValue !== undefined) {
      const measuredRate = optionalNumber(steadyMeasuredRate);
      steadyState = {
        maxTargetRatePerSecond: steadyTargetRateValue,
        ...(measuredRate !== undefined ? { maxMeasuredRatePerSecond: measuredRate } : {}),
        minimumDurationMs: optionalNumber(steadyDuration) ?? 500,
      };
    }

    try {
      currentResult = analyzeBoost({
        measuredPressure: measured.range,
        ...(target ? { targetPressure: target.range } : {}),
        ...(rpm ? { rpm: rpm.range } : {}),
        ...(tps ? { tps: tps.range } : {}),
        ...(upper ? { upperDuty: upper.range } : {}),
        ...(lower ? { lowerDuty: lower.range } : {}),
      }, {
        sampleIndices: finalEligibleSampleIndices,
        complete,
        ...(closedLoop && optionalNumber(targetTolerance) !== undefined ? { targetTolerance: optionalNumber(targetTolerance)! } : {}),
        ...(operatingPoints ? { operatingPoints } : {}),
        ...(openLoopSpool ? { openLoopSpool } : {}),
        ...(spool ? { spool } : {}),
        ...(steadyState ? { steadyState } : {}),
      });
    } catch (error) {
      currentResult = undefined;
      empty.hidden = false;
      content.hidden = true;
      empty.querySelector('strong')!.textContent = error instanceof Error ? error.message : 'Boost analysis configuration is invalid.';
      refreshButton.disabled = false;
      return;
    }

    empty.hidden = true;
    content.hidden = false;
    refreshButton.disabled = false;
    field('scope').textContent = scope.kind === 'full'
      ? `${scope.label} · entire source`
      : `${scope.label} · ${(((endMs ?? 0) - (startMs ?? 0)) / 1000).toFixed(3)} s`;
    field('coverage').textContent = currentResult.complete ? 'Complete' : 'Partial decoded';
    field('qualification').textContent = filterSet?.name ?? 'None';
    field('measured-mean').textContent = formatNumber(currentResult.measured.mean);
    field('measured-max').textContent = formatNumber(currentResult.measured.max);
    field('peak-rpm').textContent = formatNumber(currentResult.peak?.rpm, 0);
    field('peak-tps').textContent = formatNumber(currentResult.peak?.tps);
    field('peak-upper').textContent = formatNumber(currentResult.peak?.upperDuty);
    field('peak-lower').textContent = formatNumber(currentResult.peak?.lowerDuty);
    field('tps-mean').textContent = formatNumber(currentResult.tps?.mean);
    field('target-mean').textContent = formatNumber(currentResult.target?.mean);
    field('mean-error').textContent = formatNumber(currentResult.tracking?.meanError);
    field('mae').textContent = formatNumber(currentResult.tracking?.meanAbsoluteError);
    field('rmse').textContent = formatNumber(currentResult.tracking?.rootMeanSquareError);
    field('target-attainment').textContent = currentResult.tracking?.targetAttainmentFraction === undefined
      ? '—'
      : `${(currentResult.tracking.targetAttainmentFraction * 100).toFixed(1)}% · ±${formatNumber(currentResult.tracking.targetTolerance)}`;
    field('overshoot').textContent = formatNumber(currentResult.tracking?.maxOvershoot);
    field('undershoot').textContent = formatNumber(currentResult.tracking?.maxUndershoot);
    field('upper-duty').textContent = formatNumber(currentResult.upperDuty?.mean);
    field('lower-duty').textContent = formatNumber(currentResult.lowerDuty?.mean);
    field('qualification-input').textContent = scoped.inputSampleCount.toLocaleString();
    field('qualification-eligible').textContent = scoped.eligibleSampleCount.toLocaleString();
    field('quick-gate-eligible').textContent = quickGateEligibleCount === undefined ? 'Off' : quickGateEligibleCount.toLocaleString();
    field('final-eligible').textContent = finalEligibleSampleIndices.length.toLocaleString();
    field('qualification-rejected').textContent = scoped.valueRejectedSampleCount.toLocaleString();
    field('qualification-invalid').textContent = scoped.invalidSampleCount.toLocaleString();
    field('qualification-unavailable').textContent = scoped.unavailableSampleCount.toLocaleString();
    field('tracking-valid').textContent = (currentResult.tracking?.sampleCount ?? 0).toLocaleString();
    field('tracking-invalid').textContent = (currentResult.tracking?.invalidSampleCount ?? 0).toLocaleString();
    field('tracking-unavailable').textContent = (currentResult.tracking?.unavailableSampleCount ?? 0).toLocaleString();
    field('operating-count').textContent = currentResult.operatingPoints.length.toLocaleString();
    field('open-spool-count').textContent = currentResult.openLoopSpoolEvents.length.toLocaleString();
    field('spool-count').textContent = currentResult.spoolEvents.length.toLocaleString();
    field('steady-count').textContent = currentResult.steadyStateWindows.length.toLocaleString();

    let comparisonRows = [] as ReturnType<typeof compareBoostOperatingPoints>;
    if (!closedLoop && comparisonScope && operatingPoints && compareScopeSelect.value !== scopeSelect.value) {
      const compareStartMs = comparisonBounds.startMs;
      const compareEndMs = comparisonBounds.endMs;
      const compareScoped = qualifyNumericSampleGroups({
        referenceChannelId: measured.channel.id,
        channels,
        groupLogic: filterSet?.groupLogic ?? 'and',
        groups,
        ...(comparisonScope.kind === 'range' && compareStartMs !== undefined && compareEndMs !== undefined ? { timeRange: { startMs: compareStartMs, endMs: compareEndMs } } : {}),
      });
      let compareEligible = compareScoped.eligibleSampleIndices;
      if (pullGateEnabled.checked && rpm && tps) {
        const minimumTps = optionalNumber(pullMinTps);
        const minimumRpm = optionalNumber(pullMinRpm);
        if (minimumTps !== undefined && minimumRpm !== undefined) {
          const compareQuick = qualifyNumericSampleGroups({
            referenceChannelId: measured.channel.id,
            channels,
            groupLogic: 'and',
            groups: [{ id: 'boost-high-load', logic: 'and', conditions: [
              { channelId: tps.channel.id, operator: 'gte', value: minimumTps },
              { channelId: rpm.channel.id, operator: 'gte', value: minimumRpm },
            ] }],
            ...(comparisonScope.kind === 'range' && compareStartMs !== undefined && compareEndMs !== undefined ? { timeRange: { startMs: compareStartMs, endMs: compareEndMs } } : {}),
          });
          compareEligible = intersectSampleIndices(compareEligible, compareQuick.eligibleSampleIndices);
        }
      }
      const comparisonResult = analyzeBoost({
        measuredPressure: measured.range,
        ...(rpm ? { rpm: rpm.range } : {}),
        ...(tps ? { tps: tps.range } : {}),
        ...(upper ? { upperDuty: upper.range } : {}),
        ...(lower ? { lowerDuty: lower.range } : {}),
      }, { sampleIndices: compareEligible, operatingPoints });
      comparisonRows = compareBoostOperatingPoints(currentResult.operatingPoints, comparisonResult.operatingPoints);
    }
    const comparisonActive = !closedLoop && comparisonScope !== undefined && compareScopeSelect.value !== scopeSelect.value;
    comparisonSection.hidden = !comparisonActive;
    field('comparison-count').textContent = comparisonRows.length.toLocaleString();
    const responseText = (summary: ReturnType<typeof summarizeBoostDutyResponse>): string => {
      if (summary.qualifyingComparisonCount === 0) return 'No isolated duty-change evidence';
      const unavailable = summary.otherDutyUnavailableCount > 0 ? ` · other duty unavailable ${summary.otherDutyUnavailableCount}` : '';
      const prefix = `${summary.qualifyingComparisonCount} usable${unavailable}`;
      if (summary.association === 'insufficient') return `${prefix} · need more comparisons`;
      if (summary.association === 'higher-duty-higher-pressure') return `${prefix} · higher duty accompanied higher pressure`;
      if (summary.association === 'higher-duty-lower-pressure') return `${prefix} · higher duty accompanied lower pressure`;
      if (summary.association === 'little-pressure-response') return `${prefix} · duty changed with little pressure response`;
      return `${prefix} · mixed observed association`;
    };
    field('upper-response').textContent = responseText(summarizeBoostDutyResponse(comparisonRows, 'upper'));
    field('lower-response').textContent = responseText(summarizeBoostDutyResponse(comparisonRows, 'lower'));
    if (comparisonActive && comparisonRows.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="10">No trustworthy matched RPM × TPS/load bins between these scopes. Collect more evidence or adjust qualification/binning.</td>';
      comparisonBody.replaceChildren(row);
    } else comparisonBody.replaceChildren(...comparisonRows.map((comparison) => {
      const row = document.createElement('tr');
      const direction = comparison.pressureDirection === 'rising' ? '↑' : comparison.pressureDirection === 'falling' ? '↓' : '→';
      const delta = (value: number | undefined): string => value === undefined ? '—' : `${value >= 0 ? '+' : ''}${formatNumber(value)}`;
      const interpretation = comparison.interpretation === 'pressure-only' ? 'Pressure comparison; duty unavailable'
        : comparison.interpretation === 'pressure-changed-similar-duty' ? 'Pressure changed at similar duty'
          : comparison.interpretation === 'duty-changed-little-pressure-response' ? 'Duty changed with little pressure response'
            : comparison.interpretation === 'duty-and-pressure-response' ? 'Observed duty + pressure response; repeat to confirm'
              : 'Similar duty and pressure';
      row.innerHTML = `<td>${formatNumber(comparison.rpmStart, 0)}–${formatNumber(comparison.rpmEnd, 0)}</td><td>${formatNumber(comparison.tpsStart)}–${formatNumber(comparison.tpsEnd)}</td><td>${comparison.primarySampleCount.toLocaleString()}</td><td>${comparison.comparisonSampleCount.toLocaleString()}</td><td>${formatNumber(comparison.primaryPressureMean)}</td><td>${formatNumber(comparison.comparisonPressureMean)}</td><td>${direction} ${delta(comparison.pressureDelta)}</td><td>${delta(comparison.upperDutyDelta)}</td><td>${delta(comparison.lowerDutyDelta)}</td><td>${interpretation}</td>`;
      return row;
    }));

    operatingBody.replaceChildren(...currentResult.operatingPoints.map((point) => {
      const row = document.createElement('tr');
      const evidence = point.evidenceQuality === 'strong' ? 'Strong' : point.evidenceQuality === 'moderate' ? 'Moderate' : 'Limited';
      const consistency = point.pressureConsistency === 'stable' ? 'Stable' : point.pressureConsistency === 'variable' ? 'Variable' : 'Mixed';
      const assessment = point.assessment === 'good-comparison' ? 'Good comparison evidence' : point.assessment === 'usable-with-care' ? 'Usable with care' : point.assessment === 'limited-evidence' ? 'Limited evidence' : 'Mixed/transient likely';
      const trendText = (trend: typeof point.rpmTrend): string => {
        if (!trend) return '—';
        const direction = trend.direction === 'rising' ? '↑' : trend.direction === 'falling' ? '↓' : '→';
        const duty = trend.upperDutyDelta === undefined && trend.lowerDutyDelta === undefined
          ? ''
          : ` · U ${trend.upperDutyDelta === undefined ? '—' : `${trend.upperDutyDelta >= 0 ? '+' : ''}${formatNumber(trend.upperDutyDelta)}`} · L ${trend.lowerDutyDelta === undefined ? '—' : `${trend.lowerDutyDelta >= 0 ? '+' : ''}${formatNumber(trend.lowerDutyDelta)}`}`;
        return `${direction} P ${trend.pressureDelta >= 0 ? '+' : ''}${formatNumber(trend.pressureDelta)}${duty}`;
      };
      const suggestionText = (): string => {
        if (point.assessment === 'mixed-transient-likely') return 'Qualify further before tuning';
        if (point.assessment === 'limited-evidence') return 'Collect more evidence';
        const trend = point.rpmTrend ?? point.loadTrend;
        if (!trend) return point.assessment === 'good-comparison' ? 'Good standalone evidence; no comparable neighbor' : 'Usable, but no trustworthy adjacent bin';
        const dutyDeltas = [trend.upperDutyDelta, trend.lowerDutyDelta].filter((value): value is number => value !== undefined);
        if (dutyDeltas.length === 0) return 'Pressure trend only; duty response unavailable';
        const dutyChanged = dutyDeltas.some((value) => Math.abs(value) >= 0.5);
        if (!dutyChanged && trend.direction !== 'similar') return 'Pressure changed at similar duty';
        if (dutyChanged && trend.direction === 'similar') return 'Duty changed with little pressure response';
        if (dutyChanged) return 'Observed duty + pressure response; confirm with another pull';
        return 'Similar duty and pressure';
      };
      row.dataset.boostAssessment = point.assessment;
      row.innerHTML = `<td>${formatNumber(point.rpmStart, 0)}–${formatNumber(point.rpmEnd, 0)}</td><td>${formatNumber(point.tpsStart)}–${formatNumber(point.tpsEnd)}</td><td>${point.sampleCount.toLocaleString()}</td><td>${formatNumber(point.rpmMean, 0)}</td><td>${formatNumber(point.tpsMean)}</td><td>${formatNumber(point.pressureMean)}</td><td>${formatNumber(point.pressureMin)}</td><td>${formatNumber(point.pressureMax)}</td><td>${formatNumber(point.pressureStdDev)}</td><td>${(point.pressureVariationFraction * 100).toFixed(1)}% · ${consistency}</td><td>${evidence}</td><td>${assessment}</td><td>${trendText(point.rpmTrend)}</td><td>${trendText(point.loadTrend)}</td><td>${suggestionText()}</td><td>${formatNumber(point.upperDutyMean)}</td><td>${formatNumber(point.lowerDutyMean)}</td>`;
      return row;
    }));

    openSpoolBody.replaceChildren(...currentResult.openLoopSpoolEvents.map((event, index) => {
      const row = document.createElement('tr');
      const dutyRange = (start: number | undefined, end: number | undefined): string => start === undefined && end === undefined ? '—' : `${formatNumber(start)} → ${formatNumber(end)}`;
      row.innerHTML = `<td>${index + 1}</td><td>${(event.startTimeMs / 1000).toFixed(3)}</td><td>${(event.endTimeMs / 1000).toFixed(3)}</td><td>${event.durationMs.toFixed(0)} ms</td><td>${event.attainment10 ? `${event.attainment10.durationMs.toFixed(0)} ms` : '—'}</td><td>${event.attainment50 ? `${event.attainment50.durationMs.toFixed(0)} ms` : '—'}</td><td>${event.attainment90 ? `${event.attainment90.durationMs.toFixed(0)} ms` : '—'}</td><td>${formatNumber(event.startPressure)}</td><td>${formatNumber(event.endPressure)}</td><td>${formatNumber(event.startRpm, 0)}</td><td>${formatNumber(event.endRpm, 0)}</td><td>${formatNumber(event.startTps)}</td><td>${formatNumber(event.endTps)}</td><td>${dutyRange(event.startUpperDuty, event.endUpperDuty)}</td><td>${dutyRange(event.startLowerDuty, event.endLowerDuty)}</td>`;
      return row;
    }));

    spoolBody.replaceChildren(...currentResult.spoolEvents.map((event, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${index + 1}</td><td>${(event.startTimeMs / 1000).toFixed(3)}</td><td>${(event.endTimeMs / 1000).toFixed(3)}</td><td>${event.durationMs.toFixed(0)} ms</td><td>${event.attainment10 ? `${event.attainment10.durationMs.toFixed(0)} ms` : '—'}</td><td>${event.attainment50 ? `${event.attainment50.durationMs.toFixed(0)} ms` : '—'}</td><td>${event.attainment90 ? `${event.attainment90.durationMs.toFixed(0)} ms` : '—'}</td><td>${formatNumber(event.startPressure)}</td><td>${formatNumber(event.endPressure)}</td><td>${formatNumber(event.endTargetPressure)}</td><td>${formatNumber(event.startRpm, 0)}</td><td>${formatNumber(event.endRpm, 0)}</td>`;
      return row;
    }));
    steadyBody.replaceChildren(...currentResult.steadyStateWindows.map((window, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${index + 1}</td><td>${(window.startTimeMs / 1000).toFixed(3)}</td><td>${(window.endTimeMs / 1000).toFixed(3)}</td><td>${window.durationMs.toFixed(0)} ms</td><td>${window.sampleCount.toLocaleString()}</td><td>${formatNumber(window.meanTargetPressure)}</td><td>${formatNumber(window.meanMeasuredPressure)}</td><td>${formatNumber(window.meanError)}</td><td>${formatNumber(window.maxOvershoot)}</td><td>${formatNumber(window.maxUndershoot)}</td>`;
      return row;
    }));
  };

  const setContext = (nextContext: LoggerAnalysisContext): void => {
    if (!active) { pendingContext = nextContext; return; }
    const previousMeasured = measuredSelect.value;
    const previousTarget = targetSelect.value;
    const previousRpm = rpmSelect.value;
    const previousTps = tpsSelect.value;
    const previousUpper = upperSelect.value;
    const previousLower = lowerSelect.value;
    const previousScope = scopeSelect.value;
    const previousCompareScope = compareScopeSelect.value;
    const previousQualification = qualificationSelect.value;
    const channelsChanged = !sameChannelCatalog(context.channels, nextContext.channels);
    context = nextContext;
    if (channelsChanged) {
      measuredSelect.replaceChildren(...context.channels.map((channel) => new Option(analyzerChannelOptionLabel(channel), channel.id)));
      if (context.channels.some((channel) => channel.id === previousMeasured)) measuredSelect.value = previousMeasured;
      addOptionalTraceOptions(targetSelect, previousTarget);
      addOptionalTraceOptions(rpmSelect, previousRpm);
      addOptionalTraceOptions(tpsSelect, previousTps);
      addOptionalTraceOptions(upperSelect, previousUpper);
      addOptionalTraceOptions(lowerSelect, previousLower);
    }
    fillScope(previousScope, previousCompareScope);
    fillQualification(previousQualification);
    void render();
  };

  modeSelect.addEventListener('change', () => { syncControlModeUi(); void render(); });
  for (const select of [measuredSelect, targetSelect, rpmSelect, tpsSelect, upperSelect, lowerSelect, scopeSelect, compareScopeSelect, qualificationSelect]) select.addEventListener('change', () => { void render(); });
  for (const input of [operatingEnabled, pullGateEnabled, pullMinTps, pullMinRpm, operatingRpmBin, operatingTpsBin, operatingMinSamples, openSpoolEnabled, openSpoolStart, openSpoolEnd, openSpoolDuration, targetTolerance, spoolEnabled, spoolStart, spoolTarget, spoolFraction, spoolDuration, steadyEnabled, steadyTargetRate, steadyMeasuredRate, steadyDuration]) input.addEventListener('change', () => { void render(); });
  refreshButton.addEventListener('click', () => { void render(); });
  syncControlModeUi();
  ensureBoostAnalyzerHelp(root);

  const setActive = (next: boolean): void => {
    if (active === next) return;
    active = next;
    if (!active) { renderGeneration += 1; return; }
    applyingPending = true;
    const nextContext = pendingContext; pendingContext = undefined;
    if (nextContext) controller.setContext(nextContext);
    applyingPending = false;
    void render();
  };

  const controller: BoostAnalyzerViewController = {
    element: root,
    setActive,
    setContext,
    refresh: () => { void render(); },
  };
  return controller;
}
