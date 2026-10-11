import { compareNumericCohorts, type NumericCompareResult } from '../../../../core/analysis/numeric-compare';
import { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';
import type { TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext } from './logger-page';
import { analyzerScopeBounds, populateAnalyzerScopeSelect, selectedAnalyzerScope, type AnalyzerScope } from './analyzer-scope';
import { createTuneTableView } from './tune-table-view';
import { createBoostAnalyzerView } from './boost-analyzer-view';
import {
  createSpecializedAnalyzerSuiteView,
  type SpecializedAnalyzerDomain,
} from './specialized-analyzer-suite-view';

export interface AnalyzerPageController {
  readonly element: HTMLElement;
  readonly headerControl: HTMLElement;
  setContext(context: LoggerAnalysisContext): void;
  setTuneModel(model: TuneModel | undefined, sourceName?: string): void;
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
  return left.length === right.length && left.every((channel, index) => channel === right[index]);
}

export function createAnalyzerPage(): AnalyzerPageController {
  let context: LoggerAnalysisContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };
  let currentResult: NumericCompareResult | undefined;
  let renderGeneration = 0;
  let suppressImmediateRefresh = false;
  let contextUpdateGeneration = 0;
  type AnalyzerView = 'compare' | 'tune-table' | 'boost' | SpecializedAnalyzerDomain;
  let currentView: AnalyzerView = 'compare';
  const tuneTableView = createTuneTableView();
  const boostView = createBoostAnalyzerView();
  const specializedView = createSpecializedAnalyzerSuiteView();

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
        <button type="button" class="analyzer-refresh">Refresh</button>
        </div>
      </div>
    </section>
    <section class="analyzer-empty">
      <strong>Analyzer needs one available channel and two comparison scopes.</strong>
      <span>Compare Full Log, the current Logger A/B selection, or saved Logger ranges.</span>
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
        <div><span>Valid</span><strong data-analyzer="left-valid">0</strong></div>
        <div><span>Invalid</span><strong data-analyzer="left-invalid">0</strong></div>
        <div><span>Unavailable</span><strong data-analyzer="left-unavailable">0</strong></div>
        <div><span>Coverage</span><strong data-analyzer="left-coverage">—</strong></div>
      </div>
      <div class="analyzer-evidence analyzer-evidence--right">
        <div><span>Input</span><strong data-analyzer="right-input">0</strong></div>
        <div><span>Valid</span><strong data-analyzer="right-valid">0</strong></div>
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
        <span>Delta convention <strong>Right − Left</strong></span>
      </div>
    </section>
  `;
  root.append(tuneTableView.element, boostView.element, specializedView.element);

  const channelSelect = root.querySelector<HTMLSelectElement>('.analyzer-channel');
  const leftSelect = root.querySelector<HTMLSelectElement>('.analyzer-left-range');
  const rightSelect = root.querySelector<HTMLSelectElement>('.analyzer-right-range');
  const refreshButton = root.querySelector<HTMLButtonElement>('.analyzer-refresh');
  const empty = root.querySelector<HTMLElement>('.analyzer-empty');
  const content = root.querySelector<HTMLElement>('.analyzer-content');
  const tableBody = root.querySelector<HTMLTableSectionElement>('.analyzer-table tbody');
  const compareControls = root.querySelector<HTMLElement>('.analyzer-controls');
  const heading = root.querySelector<HTMLElement>('.analyzer-head h1');
  const description = root.querySelector<HTMLElement>('.analyzer-head p');
  const viewSelect = headerControl.querySelector<HTMLSelectElement>('.analyzer-header-view-select');
  if (!channelSelect || !leftSelect || !rightSelect || !refreshButton || !empty || !content || !tableBody || !compareControls || !heading || !description || !viewSelect) {
    throw new Error('Analyzer page structure is incomplete.');
  }

  const field = (name: string): HTMLElement => {
    const element = root.querySelector<HTMLElement>(`[data-analyzer="${name}"]`);
    if (!element) throw new Error(`Analyzer field is missing: ${name}`);
    return element;
  };

  const render = async (): Promise<void> => {
    const generation = ++renderGeneration;
    if (currentView !== 'compare') return;
    const channelId = channelSelect.value || context.channels[0]?.id;
    const leftScope = selectedAnalyzerScope(leftSelect, context);
    const rightScope = selectedAnalyzerScope(rightSelect, context);
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
    const [trace] = await context.loadTraces([channelId], loadStartMs, loadEndMs);
    if (generation !== renderGeneration || currentView !== 'compare') return;
    if (!trace) { empty.hidden = false; content.hidden = true; return; }
    const channels = new Map([[trace.channel.id, { range: trace.range, complete: trace.complete }]]);
    const leftQualified = qualifyNumericSamples({
      referenceChannelId: trace.channel.id,
      channels,
      conditions: [],
      ...(leftScope.kind === 'range' && leftScope.startMs !== undefined && leftScope.endMs !== undefined
        ? { timeRange: { startMs: leftScope.startMs, endMs: leftScope.endMs } }
        : {}),
    });
    const rightQualified = qualifyNumericSamples({
      referenceChannelId: trace.channel.id,
      channels,
      conditions: [],
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
    field('left-input').textContent = currentResult.left.inputSampleCount.toLocaleString();
    field('left-valid').textContent = currentResult.left.validSampleCount.toLocaleString();
    field('left-invalid').textContent = currentResult.left.invalidSampleCount.toLocaleString();
    field('left-unavailable').textContent = currentResult.left.unavailableSampleCount.toLocaleString();
    field('left-coverage').textContent = leftQualified.complete ? 'Complete' : 'Partial decoded';
    field('right-input').textContent = currentResult.right.inputSampleCount.toLocaleString();
    field('right-valid').textContent = currentResult.right.validSampleCount.toLocaleString();
    field('right-invalid').textContent = currentResult.right.invalidSampleCount.toLocaleString();
    field('right-unavailable').textContent = currentResult.right.unavailableSampleCount.toLocaleString();
    field('right-coverage').textContent = rightQualified.complete ? 'Complete' : 'Partial decoded';
    field('coverage').textContent = currentResult.complete ? 'Complete' : 'Partial decoded';

    const unit = trace.channel.unit ? ` ${trace.channel.unit}` : '';
    const rows: Array<{ label: string; key: 'count' | 'mean' | 'min' | 'max' | 'standard-deviation'; unit: string }> = [
      { label: 'Valid samples', key: 'count', unit: '' },
      { label: 'Mean', key: 'mean', unit },
      { label: 'Minimum', key: 'min', unit },
      { label: 'Maximum', key: 'max', unit },
      { label: 'Std dev', key: 'standard-deviation', unit },
    ];
    tableBody.replaceChildren(...rows.map((row) => {
      const metric = currentResult!.metrics[row.key];
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
    for (const channel of context.channels) channelSelect.add(new Option(channel.displayName || channel.sourceName, channel.id));
    if (context.channels.some((channel) => channel.id === preferred)) channelSelect.value = preferred;
  };

  const fillScopeSelect = (select: HTMLSelectElement, preferred: string, fallback: string): void => {
    populateAnalyzerScopeSelect(select, context, preferred);
    if ([...select.options].some((option) => option.value === preferred)) return;
    if ([...select.options].some((option) => option.value === fallback)) select.value = fallback;
  };

  const specializedTitles: Record<SpecializedAnalyzerDomain, [string, string]> = {
    idle: ['Idle analysis', 'Target/error, valve duty/bias/feed-forward, PID terms and sag/recovery behavior.'],
    'ae-map': ['AE / MAP Predict analysis', 'Tip-in/decel events, measured/predicted MAP response and AFR excursion.'],
    fueling: ['Fueling analysis', 'AFR target/actual error, lean/rich evidence and optional VE context.'],
    ignition: ['Ignition analysis', 'Advance, retard and knock-oriented evidence with grouped knock events.'],
    'fuel-injector': ['Fuel pressure / injector analysis', 'Rail pressure, injector PW/duty/deadtime and threshold-event evidence.'],
    'trigger-sync': ['Trigger / sync analysis', 'Synchronization dropouts, trigger errors and sync-loss counter events.'],
  };

  const setView = (view: AnalyzerView): void => {
    renderGeneration += 1;
    currentView = view;
    const compareActive = view === 'compare';
    const tuneActive = view === 'tune-table';
    const boostActive = view === 'boost';
    const specializedActive = !compareActive && !tuneActive && !boostActive;
    compareControls.hidden = !compareActive;
    tuneTableView.element.hidden = !tuneActive;
    boostView.element.hidden = !boostActive;
    specializedView.element.hidden = !specializedActive;
    viewSelect.value = view;
    if (compareActive) {
      heading.textContent = 'Range comparison';
      description.textContent = 'Compare any available log channel across Full Log, Current A/B, or saved Logger ranges.';
      void render();
      return;
    }
    empty.hidden = true;
    content.hidden = true;
    if (tuneActive) {
      heading.textContent = 'Tune table correlation';
      description.textContent = 'Map decoded operating points and observed values into an explicitly selected MSQ table.';
      tuneTableView.setContext(context);
      return;
    }
    if (boostActive) {
      heading.textContent = 'Boost analysis';
      description.textContent = 'Analyze boost tracking, spool and steady-state behavior using any channels available in the loaded log.';
      boostView.setContext(context);
      return;
    }
    const [title, detail] = specializedTitles[view];
    heading.textContent = title;
    description.textContent = detail;
    specializedView.setDomain(view);
  };

  const setContext = (nextContext: LoggerAnalysisContext): void => {
    const generation = ++contextUpdateGeneration;
    suppressImmediateRefresh = true;
    queueMicrotask(() => {
      if (generation === contextUpdateGeneration) suppressImmediateRefresh = false;
    });
    const previousChannel = channelSelect.value;
    const previousLeft = leftSelect.value;
    const previousRight = rightSelect.value;
    const channelsChanged = !sameChannelCatalog(context.channels, nextContext.channels);
    context = nextContext;
    if (currentView === 'tune-table') tuneTableView.setContext(nextContext);
    else if (currentView === 'boost') boostView.setContext(nextContext);
    specializedView.setContext(nextContext);
    if (channelsChanged) fillChannelSelect(previousChannel);
    const hasCurrentAb = context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs;
    const leftFallback = context.savedRanges.length > 0 ? 'saved:0' : hasCurrentAb ? 'ab' : 'full';
    const rightFallback = context.savedRanges.length > 1 ? 'saved:1' : hasCurrentAb && leftFallback !== 'ab' ? 'ab' : 'full';
    fillScopeSelect(leftSelect, previousLeft, leftFallback);
    fillScopeSelect(rightSelect, previousRight, rightFallback);
    if (currentView === 'compare') void render();
  };

  channelSelect.addEventListener('change', () => { void render(); });
  leftSelect.addEventListener('change', () => { void render(); });
  rightSelect.addEventListener('change', () => { void render(); });
  refreshButton.addEventListener('click', () => { void render(); });
  viewSelect.addEventListener('change', () => {
    const view = viewSelect.value;
    if (view === 'compare' || view === 'tune-table' || view === 'boost' || view === 'idle' || view === 'ae-map' || view === 'fueling' || view === 'ignition' || view === 'fuel-injector' || view === 'trigger-sync') setView(view);
  });

  return {
    element: root,
    headerControl,
    setContext,
    setTuneModel: (model, sourceName) => tuneTableView.setTuneModel(model, sourceName),
    refresh: () => {
      if (suppressImmediateRefresh) {
        suppressImmediateRefresh = false;
        return;
      }
      if (currentView === 'compare') void render();
      else if (currentView === 'tune-table') tuneTableView.refresh();
      else if (currentView === 'boost') boostView.refresh();
      else specializedView.refresh();
    },
  };
}
