import { createOwnerEvidence } from '../observability/producers/owner';
import type { ObservabilityRecorder } from '../observability/recorder';
import type { Origin } from '../observability/record';
import { decorateCompareHelp } from './analyzer-additional-help';
import { sameChannelOptionCatalog } from './channel-option-label';
import { analyzerChannelOptionLabel } from './analyzer-channel-roles';
import { compareNumericCohorts, type NumericCompareResult } from '../../../../core/analysis/numeric-compare';
import { qualifyNumericSampleGroups, type NumericQualificationGroup } from '../../../../core/analysis/sample-qualification';
import type { TuneModel } from '../../../../core/tune/tune-model';
import { loadAnalysisFilterSets, type AnalysisFilterSetState } from '../state/analysis-filter-storage';
import type { LoggerAnalysisContext } from './logger-page';
import { analyzerScopeBounds, populateAnalyzerScopeSelect, selectedAnalyzerScope, type AnalyzerScope } from './analyzer-scope';
import { createTuneTableView } from './tune-table-view';
import { createBoostAnalyzerView } from './boost-analyzer-view';
import { createIgnitionAnalyzerView } from './ignition-analyzer-view';
import { createFuelInjectorAnalyzerView } from './fuel-injector-analyzer-view';
import { createVeAnalyzerView } from './ve-analyzer-view';
import {
  createSpecializedAnalyzerSuiteView,
  type SpecializedAnalyzerDomain,
} from './specialized-analyzer-suite-view';

export interface AnalyzerPageController {
  readonly element: HTMLElement;
  setActive(active: boolean): void;
  dispose(): void;
  readonly headerControl: HTMLElement;
  setContext(context: LoggerAnalysisContext): void;
  setTuneModel(model: TuneModel | undefined, sourceName?: string): void;
  openRangeCompareScope(scopeValue: 'ab'): void;
  refresh(): void;
}

function formatNumber(value: number | undefined, precision = 3): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  return value.toFixed(precision).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function formatPercent(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const percent = value * 100;
  return `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`;
}

function formatScope(scope: AnalyzerScope): string {
  if (scope.kind === 'full') return 'Entire source';
  if (scope.startMs === undefined || scope.endMs === undefined) return '—';
  const seconds = Math.abs(scope.endMs - scope.startMs) / 1000;
  return seconds < 60 ? `${seconds.toFixed(3)} s` : `${(seconds / 60).toFixed(2)} min`;
}

function sameChannelCatalog(
  left: LoggerAnalysisContext['channels'],
  right: LoggerAnalysisContext['channels'],
): boolean {
  return sameChannelOptionCatalog(left, right);
}

export function createAnalyzerPage(observability?: ObservabilityRecorder): AnalyzerPageController {
  let context: LoggerAnalysisContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };
  let currentResult: NumericCompareResult | undefined;
  let analysisFilterSets = loadAnalysisFilterSets();
  let renderGeneration = 0;
  let suppressImmediateRefresh = false;
  let contextUpdateGeneration = 0;
  type AnalyzerView = 'compare' | 'tune-table' | 'boost' | 've' | SpecializedAnalyzerDomain;
  let currentView: AnalyzerView = 'compare';
  let active = true;
  let disposed = false;
  let tuneModel: TuneModel | undefined;
  let tuneSourceName: string | undefined;
  let comparisonChannels: LoggerAnalysisContext['channels'] = [];
  const tuneTableView = createTuneTableView(observability);
  const boostView = createBoostAnalyzerView(observability);
  const ignitionView = createIgnitionAnalyzerView(observability);
  const fuelInjectorView = createFuelInjectorAnalyzerView(observability);
  const veAnalyzerView = createVeAnalyzerView(observability);
  const specializedView = createSpecializedAnalyzerSuiteView(observability);
  const domainViews = [tuneTableView, boostView, ignitionView, fuelInjectorView, veAnalyzerView, specializedView];
  for (const view of domainViews) view.setActive(false);

  const headerControl = document.createElement('label');
  headerControl.className = 'histogram-header-view analyzer-header-view';
  headerControl.innerHTML = `
    <select class="analyzer-header-view-select" aria-label="Analyzer analysis view">
      <option value="compare" selected>Range Compare</option>
      <option value="tune-table">Tune Table</option>
      <option value="boost">Boost · Experimental</option>
      <option value="idle">Idle · Experimental</option>
      <option value="ae-map">AE / MAP Predict · Experimental</option>
      <option value="fueling">Fueling · Experimental</option>
      <option value="ve">VE Analyzer · Experimental</option>
      <option value="ignition">Ignition · Experimental</option>
      <option value="fuel-injector">Fuel Pressure / Injector · Experimental</option>
      <option value="trigger-sync">Trigger / Sync · Experimental</option>
    </select>
  `;

  const root = document.createElement('main');
  root.className = 'analyzer-page';
  root.hidden = true;
  root.innerHTML = `
    <section class="analyzer-head">
      <div>
        <span class="analyzer-eyebrow">Analyzer</span>
        <h1>Range comparison</h1>
        <p>Compare one available log channel across two analysis scopes.</p>
      </div>
      <div class="analyzer-head-actions">
        <div class="analyzer-controls">
        <label><span>Channel</span><select class="analyzer-channel"></select></label>
        <label><span>Left scope</span><select class="analyzer-left-range"></select></label>
        <label><span>Right scope</span><select class="analyzer-right-range"></select></label>
        <label><span>Qualification</span><select class="analyzer-qualification-filter"><option value="">None</option></select></label>
        <button type="button" class="analyzer-refresh">Refresh</button>
        </div>
      </div>
    </section>
    <section class="analyzer-empty">
      <strong>Analyzer needs one available channel and two comparison scopes.</strong>
      <span>Compare Full Log, Current A/B, or saved ranges, with an optional saved qualification filter.</span>
    </section>
    <section class="analyzer-content" hidden>
      <div class="analyzer-side analyzer-side--left">
        <span>Left</span><strong data-analyzer="left-label">—</strong><small data-analyzer="left-scope">—</small>
      </div>
      <div class="analyzer-side analyzer-side--right">
        <span>Right</span><strong data-analyzer="right-label">—</strong><small data-analyzer="right-scope">—</small>
      </div>
      <div class="analyzer-evidence analyzer-evidence--left">
        <div><span>Input</span><strong data-analyzer="left-input">0</strong></div>
        <div><span>Eligible</span><strong data-analyzer="left-eligible">0</strong></div>
        <div><span>Rejected</span><strong data-analyzer="left-rejected">0</strong></div>
        <div><span>Invalid</span><strong data-analyzer="left-invalid">0</strong></div>
        <div><span>Unavailable</span><strong data-analyzer="left-unavailable">0</strong></div>
        <div><span>Coverage</span><strong data-analyzer="left-coverage">—</strong></div>
      </div>
      <div class="analyzer-evidence analyzer-evidence--right">
        <div><span>Input</span><strong data-analyzer="right-input">0</strong></div>
        <div><span>Eligible</span><strong data-analyzer="right-eligible">0</strong></div>
        <div><span>Rejected</span><strong data-analyzer="right-rejected">0</strong></div>
        <div><span>Invalid</span><strong data-analyzer="right-invalid">0</strong></div>
        <div><span>Unavailable</span><strong data-analyzer="right-unavailable">0</strong></div>
        <div><span>Coverage</span><strong data-analyzer="right-coverage">—</strong></div>
      </div>
      <div class="analyzer-table-wrap">
        <table class="analyzer-table">
          <thead><tr><th>Metric</th><th>Left</th><th>Right</th><th>Δ</th><th>Relative</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="analyzer-foot">
        <span>Comparison coverage <strong data-analyzer="coverage">—</strong></span>
        <span>Qualification <strong data-analyzer="qualification">None</strong></span>
        <span>Delta convention <strong>Right − Left</strong></span>
      </div>
    </section>
  `;
  decorateCompareHelp(root);

  root.append(tuneTableView.element, boostView.element, ignitionView.element, fuelInjectorView.element, veAnalyzerView.element, specializedView.element);

  const channelSelect = root.querySelector<HTMLSelectElement>('.analyzer-channel');
  const leftSelect = root.querySelector<HTMLSelectElement>('.analyzer-left-range');
  const rightSelect = root.querySelector<HTMLSelectElement>('.analyzer-right-range');
  const qualificationSelect = root.querySelector<HTMLSelectElement>('.analyzer-qualification-filter');
  const refreshButton = root.querySelector<HTMLButtonElement>('.analyzer-refresh');
  const empty = root.querySelector<HTMLElement>('.analyzer-empty');
  const content = root.querySelector<HTMLElement>('.analyzer-content');
  const tableBody = root.querySelector<HTMLTableSectionElement>('.analyzer-table tbody');
  const compareControls = root.querySelector<HTMLElement>('.analyzer-controls');
  const heading = root.querySelector<HTMLElement>('.analyzer-head h1');
  const description = root.querySelector<HTMLElement>('.analyzer-head p');
  const viewSelect = headerControl.querySelector<HTMLSelectElement>('.analyzer-header-view-select');
  if (!channelSelect || !leftSelect || !rightSelect || !qualificationSelect || !refreshButton || !empty || !content || !tableBody || !compareControls || !heading || !description || !viewSelect) {
    throw new Error('Analyzer page structure is incomplete.');
  }

  const emptyTitle = empty.querySelector<HTMLElement>('strong')!;
  const emptyHint = empty.querySelector<HTMLElement>('span')!;
  const defaultEmptyTitle = emptyTitle.textContent;
  const defaultEmptyHint = emptyHint.textContent;
  let traceLoadFailed = false;

  const field = (name: string): HTMLElement => {
    const element = root.querySelector<HTMLElement>(`[data-analyzer="${name}"]`);
    if (!element) throw new Error(`Analyzer field is missing: ${name}`);
    return element;
  };

  const selectedQualificationFilter = (): AnalysisFilterSetState | undefined =>
    qualificationSelect.value ? analysisFilterSets.find((filterSet) => filterSet.id === qualificationSelect.value) : undefined;

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

  const render = async (): Promise<void> => {
    const generation = ++renderGeneration;
    ownerEvidence.event('analyzer.compare.request', { generation, active, view: currentView });
    if (!active || currentView !== 'compare') return;
    if (traceLoadFailed) {
      traceLoadFailed = false;
      emptyTitle.textContent = defaultEmptyTitle;
      emptyHint.textContent = defaultEmptyHint;
    }
    const channelId = channelSelect.value || context.channels[0]?.id;
    const leftScope = selectedAnalyzerScope(leftSelect, context);
    const rightScope = selectedAnalyzerScope(rightSelect, context);
    const filterSet = selectedQualificationFilter();
    if (!channelId || !leftScope || !rightScope) {
      currentResult = undefined;
      empty.hidden = false;
      content.hidden = true;
      refreshButton.disabled = true;
      return;
    }

    refreshButton.disabled = false;
    const leftBounds = analyzerScopeBounds(leftScope);
    const rightBounds = analyzerScopeBounds(rightScope);
    const needsFullRange = leftScope.kind === 'full' || rightScope.kind === 'full';
    const loadStartMs = needsFullRange ? undefined : Math.min(leftBounds.startMs!, rightBounds.startMs!);
    const loadEndMs = needsFullRange ? undefined : Math.max(leftBounds.endMs!, rightBounds.endMs!);
    const filterChannelIds = filterSet
      ? [...new Set(filterSet.conditions.filter((condition) => condition.enabled).map((condition) => condition.channelId))]
      : [];
    const requestedChannelIds = [channelId, ...filterChannelIds.filter((id) => id !== channelId)];
    let traces: Awaited<ReturnType<LoggerAnalysisContext['loadTraces']>>;
    try {
      traces = await context.loadTraces(requestedChannelIds, loadStartMs, loadEndMs);
    } catch (error) {
      if (!active || generation !== renderGeneration || currentView !== 'compare') { ownerEvidence.event('analyzer.compare.stale', { generation, currentGeneration: renderGeneration, active }); return; }
      currentResult = undefined;
      refreshButton.disabled = false;
      traceLoadFailed = true;
      empty.hidden = false; content.hidden = true;
      emptyTitle.textContent = 'Range comparison could not load log channels.';
      const detail = (error instanceof Error ? error.message : typeof error === 'string' ? error : '') || 'The log data could not be loaded.';
      emptyHint.textContent = `${detail} Retry with Refresh. If it keeps failing, reload the log or choose another scope.`;
      return;
    }
    if (!active || generation !== renderGeneration || currentView !== 'compare') { ownerEvidence.event('analyzer.compare.stale', { generation, currentGeneration: renderGeneration, active }); return; }
    const trace = traces.find((candidate) => candidate.channel.id === channelId);
    if (!trace) { empty.hidden = false; content.hidden = true; return; }
    const channels = new Map(traces.map((candidate) => [candidate.channel.id, { range: candidate.range, complete: candidate.complete }]));
    const groups = qualificationGroups(filterSet);
    if (filterChannelIds.some((id) => !channels.has(id))) {
      currentResult = undefined;
      empty.hidden = false;
      content.hidden = true;
      return;
    }
    const leftQualified = qualifyNumericSampleGroups({
      referenceChannelId: trace.channel.id,
      channels,
      groupLogic: filterSet?.groupLogic ?? 'and',
      groups,
      ...(leftScope.kind === 'range' && leftScope.startMs !== undefined && leftScope.endMs !== undefined
        ? { timeRange: { startMs: leftScope.startMs, endMs: leftScope.endMs } }
        : {}),
    });
    const rightQualified = qualifyNumericSampleGroups({
      referenceChannelId: trace.channel.id,
      channels,
      groupLogic: filterSet?.groupLogic ?? 'and',
      groups,
      ...(rightScope.kind === 'range' && rightScope.startMs !== undefined && rightScope.endMs !== undefined
        ? { timeRange: { startMs: rightScope.startMs, endMs: rightScope.endMs } }
        : {}),
    });

    currentResult = compareNumericCohorts(
      { range: trace.range, sampleIndices: leftQualified.eligibleSampleIndices, complete: leftQualified.complete },
      { range: trace.range, sampleIndices: rightQualified.eligibleSampleIndices, complete: rightQualified.complete },
    );

    empty.hidden = true;
    content.hidden = false;
    field('left-label').textContent = leftScope.label;
    field('right-label').textContent = rightScope.label;
    field('left-scope').textContent = formatScope(leftScope);
    field('right-scope').textContent = formatScope(rightScope);
    field('left-input').textContent = leftQualified.inputSampleCount.toLocaleString();
    field('left-eligible').textContent = leftQualified.eligibleSampleCount.toLocaleString();
    field('left-rejected').textContent = leftQualified.valueRejectedSampleCount.toLocaleString();
    field('left-invalid').textContent = leftQualified.invalidSampleCount.toLocaleString();
    field('left-unavailable').textContent = leftQualified.unavailableSampleCount.toLocaleString();
    field('left-coverage').textContent = leftQualified.complete ? 'Complete' : 'Partial decoded';
    field('right-input').textContent = rightQualified.inputSampleCount.toLocaleString();
    field('right-eligible').textContent = rightQualified.eligibleSampleCount.toLocaleString();
    field('right-rejected').textContent = rightQualified.valueRejectedSampleCount.toLocaleString();
    field('right-invalid').textContent = rightQualified.invalidSampleCount.toLocaleString();
    field('right-unavailable').textContent = rightQualified.unavailableSampleCount.toLocaleString();
    field('right-coverage').textContent = rightQualified.complete ? 'Complete' : 'Partial decoded';
    field('coverage').textContent = currentResult.complete ? 'Complete' : 'Partial decoded';
    field('qualification').textContent = filterSet?.name ?? 'None';

    const unit = trace.channel.unit ? ` ${trace.channel.unit}` : '';
    const rows = [
      { label: 'Valid samples', metric: currentResult.metrics.count, unit: '' },
      { label: 'Mean', metric: currentResult.metrics.mean, unit },
      { label: 'P10', metric: currentResult.percentiles.p10, unit },
      { label: 'Median', metric: currentResult.percentiles.median, unit },
      { label: 'P90', metric: currentResult.percentiles.p90, unit },
      { label: 'Minimum', metric: currentResult.metrics.min, unit },
      { label: 'Maximum', metric: currentResult.metrics.max, unit },
      { label: 'Std dev', metric: currentResult.metrics['standard-deviation'], unit },
    ];
    ownerEvidence.event('analyzer.compare.rendered', { generation, rows: rows.length });
    tableBody.replaceChildren(...rows.map((row) => {
      const metric = row.metric;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <th>${row.label}</th>
        <td>${formatNumber(metric.left)}${metric.left === undefined ? '' : row.unit}</td>
        <td>${formatNumber(metric.right)}${metric.right === undefined ? '' : row.unit}</td>
        <td>${metric.delta !== undefined && metric.delta > 0 ? '+' : ''}${formatNumber(metric.delta)}${metric.delta === undefined ? '' : row.unit}</td>
        <td>${formatPercent(metric.relativeDelta)}</td>
      `;
      return tr;
    }));
  };

  const fillChannelSelect = (preferred: string): void => {
    channelSelect.replaceChildren();
    for (const channel of context.channels) channelSelect.add(new Option(analyzerChannelOptionLabel(channel), channel.id));
    if (context.channels.some((channel) => channel.id === preferred)) channelSelect.value = preferred;
  };

  const fillScopeSelect = (select: HTMLSelectElement, preferred: string, fallback: string): void => {
    populateAnalyzerScopeSelect(select, context, preferred);
    if ([...select.options].some((option) => option.value === preferred)) return;
    if ([...select.options].some((option) => option.value === fallback)) select.value = fallback;
  };

  const fillQualificationSelect = (preferred: string): void => {
    analysisFilterSets = loadAnalysisFilterSets();
    qualificationSelect.replaceChildren(new Option('None', ''));
    const availableChannelIds = new Set(context.channels.map((channel) => channel.id));
    for (const filterSet of analysisFilterSets) {
      const missingChannel = filterSet.conditions.some((condition) => condition.enabled && !availableChannelIds.has(condition.channelId));
      const option = new Option(missingChannel ? `${filterSet.name} · unavailable channels` : filterSet.name, filterSet.id);
      option.disabled = missingChannel;
      qualificationSelect.add(option);
    }
    const preferredOption = [...qualificationSelect.options].find((option) => option.value === preferred && !option.disabled);
    qualificationSelect.value = preferredOption?.value ?? '';
  };

  const specializedTitles: Record<SpecializedAnalyzerDomain, [string, string]> = {
    idle: ['Idle analysis', 'Target/error, valve duty/bias/feed-forward, PID terms and sag/recovery behavior.'],
    'ae-map': ['AE / MAP Predict analysis', 'Tip-in/decel events, measured/predicted MAP response and AFR excursion.'],
    fueling: ['Fueling analysis', 'AFR target/actual error, lean/rich evidence and optional VE context.'],
    ignition: ['Ignition analysis', 'Advance behavior, timing-step stability, dwell and ECU correction context without knock inference.'],
    'fuel-injector': ['Fuel pressure / injector analysis', 'Architecture-aware low-side, rail-differential or GDI high-side pressure evidence with injector headroom and threshold events.'],
    'trigger-sync': ['Trigger / sync analysis', 'Synchronization dropouts, trigger errors and sync-loss counter events.'],
  };

  const configureComparison = (): void => {
    const previousChannel = channelSelect.value;
    const previousLeft = leftSelect.value;
    const previousRight = rightSelect.value;
    const previousQualification = qualificationSelect.value;
    if (!sameChannelCatalog(comparisonChannels, context.channels)) fillChannelSelect(previousChannel);
    comparisonChannels = context.channels;
    const hasCurrentAb = context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs;
    const leftFallback = context.savedRanges.length > 0 ? 'saved:0' : hasCurrentAb ? 'ab' : 'full';
    const rightFallback = context.savedRanges.length > 1 ? 'saved:1' : hasCurrentAb && leftFallback !== 'ab' ? 'ab' : 'full';
    fillScopeSelect(leftSelect, previousLeft, leftFallback);
    fillScopeSelect(rightSelect, previousRight, rightFallback);
    fillQualificationSelect(previousQualification);
  };

  const ownerEvidence = createOwnerEvidence(observability, 'analyzer-router');
  const routeActiveView = (renderComparison = true, tuneOnly = false): void => {
    if (disposed) return;
    ownerEvidence.event('analyzer.route', { view: currentView, renderComparison, tuneOnly, active }, { visibility: active ? 'active' : 'hidden' });
    renderGeneration += 1;
    const selected = currentView === 'compare' ? undefined
      : currentView === 'tune-table' ? tuneTableView
      : currentView === 'boost' ? boostView
      : currentView === 'ignition' ? ignitionView
      : currentView === 'fuel-injector' ? fuelInjectorView
      : currentView === 've' ? veAnalyzerView : specializedView;
    for (const view of domainViews) if (!active || view !== selected) view.setActive(false);
    if (!active) return;
    if (currentView === 'compare') {
      configureComparison();
      if (renderComparison) void render();
    } else if (currentView === 'tune-table') {
      tuneTableView.setTuneModel(tuneModel, tuneSourceName);
      if (!tuneOnly) tuneTableView.setContext(context);
      tuneTableView.setActive(true);
    } else if (currentView === 'boost') {
      boostView.setContext(context);
      boostView.setActive(true);
    } else if (currentView === 'ignition') {
      ignitionView.setTuneModel(tuneModel, tuneSourceName);
      if (!tuneOnly) ignitionView.setContext(context);
      ignitionView.setActive(true);
    } else if (currentView === 'fuel-injector') {
      fuelInjectorView.setContext(context);
      fuelInjectorView.setActive(true);
    } else if (currentView === 've') {
      veAnalyzerView.setTuneModel(tuneModel, tuneSourceName);
      if (!tuneOnly) veAnalyzerView.setContext(context);
      veAnalyzerView.setActive(true);
    } else {
      specializedView.setDomain(currentView);
      specializedView.setContext(context);
      specializedView.setActive(true);
    }
  };

  const setView = (view: AnalyzerView, renderComparison = true, origin: Origin = 'programmatic'): void => {
    if (disposed) return;
    if (currentView !== view) observability?.record({ recordKind: 'event', subsystem: 'navigation', component: 'analyzer', name: 'navigation.domain.changed', origin, activeView: view, visibility: active ? 'active' : 'hidden', metadata: { previous: currentView, next: view } });
    if (currentView !== view) for (const domain of domainViews) domain.setActive(false);
    currentView = view;
    const compareActive = view === 'compare';
    const specializedActive = view === 'idle' || view === 'ae-map' || view === 'fueling' || view === 'trigger-sync';
    compareControls.hidden = !compareActive;
    tuneTableView.element.hidden = view !== 'tune-table';
    boostView.element.hidden = view !== 'boost';
    ignitionView.element.hidden = view !== 'ignition';
    fuelInjectorView.element.hidden = view !== 'fuel-injector';
    veAnalyzerView.element.hidden = view !== 've';
    specializedView.element.hidden = !specializedActive;
    viewSelect.value = view;
    if (compareActive) {
      heading.textContent = 'Range comparison';
      description.textContent = 'Compare any available log channel across Full Log, Current A/B, or saved Logger ranges with optional saved qualification.';
    } else {
      empty.hidden = true;
      content.hidden = true;
      if (specializedActive) [heading.textContent, description.textContent] = specializedTitles[view as SpecializedAnalyzerDomain];
      else if (view === 'tune-table') { heading.textContent = 'Tune table correlation'; description.textContent = 'Map decoded operating points and observed values into an explicitly selected MSQ table.'; }
      else if (view === 'boost') { heading.textContent = 'Boost analysis'; description.textContent = 'Analyze boost tracking, spool and steady-state behavior using any channels available in the loaded log.'; }
      else if (view === 've') { heading.textContent = 'VE Analyzer'; description.textContent = 'Validate VE-table geometry, semantic fueling inputs and scope before building evidence-backed VE recommendations.'; }
      else if (view === 'ignition') [heading.textContent, description.textContent] = specializedTitles.ignition;
      else [heading.textContent, description.textContent] = specializedTitles['fuel-injector'];
    }
    routeActiveView(renderComparison);
  };

  const suppressNextRefresh = (): void => {
    const generation = ++contextUpdateGeneration;
    suppressImmediateRefresh = true;
    queueMicrotask(() => { if (generation === contextUpdateGeneration) suppressImmediateRefresh = false; });
  };

  const setContext = (nextContext: LoggerAnalysisContext): void => {
    if (disposed) return;
    context = nextContext;
    suppressNextRefresh();
    if (active) routeActiveView();
  };

  channelSelect.addEventListener('change', () => { void render(); });
  leftSelect.addEventListener('change', () => { void render(); });
  rightSelect.addEventListener('change', () => { void render(); });
  qualificationSelect.addEventListener('change', () => { void render(); });
  refreshButton.addEventListener('click', () => { fillQualificationSelect(qualificationSelect.value); void render(); });
  viewSelect.addEventListener('change', (event) => {
    const view = viewSelect.value;
    if (view === 'compare' || view === 'tune-table' || view === 'boost' || view === 'idle' || view === 'ae-map' || view === 'fueling' || view === 've' || view === 'ignition' || view === 'fuel-injector' || view === 'trigger-sync') setView(view, true, event.isTrusted ? 'user' : 'programmatic');
  });

  return {
    element: root,
    headerControl,
    dispose() {
      if (disposed) return;
      disposed = true; active = false;
      renderGeneration += 1; contextUpdateGeneration += 1;
      for (const view of domainViews) view.setActive(false);
      veAnalyzerView.dispose();
    },
    setActive(next) {
      if (disposed) return;
      if (active === next) return;
      active = next;
      observability?.record({ recordKind: 'event', subsystem: 'navigation', component: 'analyzer', name: 'controller.activity.changed', origin: 'programmatic', activeView: currentView, visibility: next ? 'active' : 'hidden' });
      routeActiveView();
    },
    setContext,
    setTuneModel: (model, sourceName) => {
      if (disposed) return;
      if (model === tuneModel && sourceName === tuneSourceName) return;
      tuneModel = model; tuneSourceName = sourceName;
      suppressNextRefresh();
      if (active && (currentView === 'tune-table' || currentView === 'ignition' || currentView === 've')) routeActiveView(true, true);
    },
    openRangeCompareScope: (scopeValue) => {
      setView('compare', false);
      const leftHasScope = [...leftSelect.options].some((option) => option.value === scopeValue);
      const rightHasScope = [...rightSelect.options].some((option) => option.value === scopeValue);
      if (!leftHasScope && !rightHasScope) return;
      if (leftSelect.value !== scopeValue && rightSelect.value !== scopeValue && rightHasScope) rightSelect.value = scopeValue;
      void render();
    },
    refresh: () => {
      if (!active) return;
      if (suppressImmediateRefresh) {
        suppressImmediateRefresh = false;
        return;
      }
      if (currentView === 'compare') void render();
      else if (currentView === 'tune-table') tuneTableView.refresh();
      else if (currentView === 'boost') boostView.refresh();
      else if (currentView === 'ignition') ignitionView.refresh();
      else if (currentView === 'fuel-injector') fuelInjectorView.refresh();
      else if (currentView === 've') veAnalyzerView.refresh();
      else specializedView.refresh();
    },
  };
}
