import { analyzeIdleControlDiagnostics } from '../../../../core/analysis/idle-control-diagnostics';
import { aggregateNumericSamples } from '../../../../core/analysis/numeric-aggregation';
import { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import { analyzeAfrDelay } from '../../../../core/analysis/afr-delay-analyzer';
import { buildFuelingOperatingMap } from '../../../../core/analysis/fueling-operating-map';
import { qualifyFuelingContext, type FuelingCutReasonCount } from '../../../../core/analysis/fueling-context';
import {
  analyzeAeMapPredict,
  analyzeFueling,
  analyzeFuelPressureInjector,
  analyzeIdle,
  analyzeIgnition,
  analyzeTriggerSync,
} from '../../../../core/analysis/specialized-analyzers';
import type { LoggerAnalysisContext, LoggerAnalysisTraceContext } from './logger-page';
import { suggestAnalyzerChannel } from './analyzer-channel-roles';
import { analyzerScopeBounds, populateAnalyzerScopeSelect, selectedAnalyzerScope } from './analyzer-scope';
import { renderAlignedAnalyzerEvidence, type AnalyzerEvidenceSeries } from './analyzer-event-evidence';
import { ensureFuelingAnalyzerHelp } from './fueling-analyzer-help';

export type SpecializedAnalyzerDomain =
  | 'idle'
  | 'ae-map'
  | 'fueling'
  | 'ignition'
  | 'fuel-injector'
  | 'trigger-sync';

export interface SpecializedAnalyzerSuiteController {
  readonly element: HTMLElement;
  setContext(context: LoggerAnalysisContext): void;
  setDomain(domain: SpecializedAnalyzerDomain): void;
  refresh(): void;
}

type IdleSystem = 'combined' | 'rpm-control' | 'dc-valve' | 'iac' | 'etb' | 'ignition';
type MixtureScale = 'lambda' | 'afr' | 'unknown';

interface RoleSpec {
  readonly key: string;
  readonly label: string;
  readonly required?: boolean;
  readonly systems?: readonly IdleSystem[];
  readonly group?: string;
}

interface OptionSpec {
  readonly key: string;
  readonly label: string;
  readonly value?: string;
  readonly placeholder?: string;
  readonly step?: string;
}

interface DomainSpec {
  readonly title: string;
  readonly description: string;
  readonly roles: readonly RoleSpec[];
  readonly options: readonly OptionSpec[];
}

const FUEL_CUT_REASON_LABELS: Readonly<Record<number, string>> = {
  1: 'Fatal error',
  2: 'Setting disabled',
  3: 'RPM limit',
  4: 'ETB RPM limit',
  5: 'Boost cut',
  6: 'Oil pressure',
  7: 'Stop requested',
  8: 'ETB problem',
  9: 'Launch control',
  10: 'Max injector duty',
  11: 'Flood clear',
  12: 'Engine sync',
  13: 'Kickstart',
  14: 'Ignition off',
  15: 'Lua',
  16: 'ACR',
  17: 'Lambda protection',
  18: 'GDI comms',
  19: 'Brake',
  20: 'Fatal',
  21: 'GDI limits',
  22: 'Pump limit',
  23: 'Logic output',
  24: 'Neutral safety',
  25: 'Fuel pressure',
};

const IDLE_SYSTEMS: readonly { value: IdleSystem; label: string; description: string }[] = [
  { value: 'combined', label: 'Combined', description: 'Inspect how the available idle-control layers respond together.' },
  { value: 'rpm-control', label: 'RPM Control', description: 'Focus on the outer idle RPM controller that decides requested idle-air position.' },
  { value: 'dc-valve', label: 'DC Valve Control', description: 'Focus on how the feedback DC idle valve tracks the requested position and how hard its position controller works.' },
  { value: 'iac', label: 'IAC Valve', description: 'Focus on the idle-air valve command and available actuator headroom evidence.' },
  { value: 'etb', label: 'ETB', description: 'Focus on electronic-throttle idle target, position and idle contribution.' },
  { value: 'ignition', label: 'Ignition', description: 'Focus on idle spark advance and ignition correction.' },
];

const SPECS: Record<SpecializedAnalyzerDomain, DomainSpec> = {
  idle: {
    title: 'Idle',
    description: 'Sag/recovery analysis with separate outer RPM-control and inner actuator-control evidence.',
    roles: [
      { key: 'rpm', label: 'RPM', required: true, group: 'Engine' },
      { key: 'target', label: 'Idle target', required: true, group: 'Engine' },
      { key: 'basePosition', label: 'Base idle position', systems: ['rpm-control'], group: 'RPM Control' },
      { key: 'closedLoop', label: 'Closed-loop correction', systems: ['rpm-control'], group: 'RPM Control' },
      { key: 'finalPosition', label: 'Final idle position', systems: ['rpm-control'], group: 'RPM Control' },
      { key: 'p', label: 'P term', systems: ['rpm-control'], group: 'RPM Control' },
      { key: 'i', label: 'I term', systems: ['rpm-control'], group: 'RPM Control' },
      { key: 'd', label: 'D term', systems: ['rpm-control'], group: 'RPM Control' },
      { key: 'dcTarget', label: 'Valve target', systems: ['dc-valve'], group: 'DC Valve Control' },
      { key: 'dcPosition', label: 'Valve position', systems: ['dc-valve'], group: 'DC Valve Control' },
      { key: 'dcBiasOutput', label: 'DC Bias / feed-forward (runtime)', systems: ['dc-valve'], group: 'DC Valve Control' },
      { key: 'dcP', label: 'Position P term', systems: ['dc-valve'], group: 'DC Valve Control' },
      { key: 'dcI', label: 'Position I term', systems: ['dc-valve'], group: 'DC Valve Control' },
      { key: 'dcD', label: 'Position D term', systems: ['dc-valve'], group: 'DC Valve Control' },
      { key: 'dcOutput', label: 'Position-controller output', systems: ['dc-valve'], group: 'DC Valve Control' },
      { key: 'valve', label: 'IAC valve duty', systems: ['iac'], group: 'IAC Valve' },
      { key: 'etbTarget', label: 'ETB idle target', systems: ['etb'], group: 'ETB' },
      { key: 'etbPosition', label: 'ETB position', systems: ['etb'], group: 'ETB' },
      { key: 'etbContribution', label: 'ETB idle contribution', systems: ['etb'], group: 'ETB' },
      { key: 'ignitionAdvance', label: 'Ignition advance', systems: ['ignition'], group: 'Ignition' },
      { key: 'ignitionCorrection', label: 'Idle ignition correction', systems: ['ignition'], group: 'Ignition' },
    ],
    options: [
      { key: 'sag', label: 'Sag threshold RPM', value: '100', step: '1' },
      { key: 'settled', label: 'Settled band RPM', value: '40', step: '1' },
    ],
  },
  'ae-map': {
    title: 'AE / MAP Predict',
    description: 'Tip-in/decel events with MAP response, predicted MAP error and mixture excursion; lambda is preferred when available.',
    roles: [
      { key: 'tps', label: 'TPS', required: true },
      { key: 'map', label: 'Measured MAP' },
      { key: 'predictedMap', label: 'Predicted MAP' },
      { key: 'afr', label: 'Mixture (λ preferred)' },
    ],
    options: [
      { key: 'tpsThreshold', label: 'TPS delta threshold', value: '2', step: '0.1' },
      { key: 'window', label: 'Event window ms', value: '500', step: '10' },
    ],
  },
  fueling: {
    title: 'Fueling',
    description: 'State-aware steady mixture error by RPM/VE-load plus observed response-delay evidence from isolated injector-PW changes.',
    roles: [
      { key: 'actual', label: 'Actual mixture (λ preferred)', required: true },
      { key: 'target', label: 'Target mixture (λ preferred)' },
      { key: 've', label: 'Current VE' },
      { key: 'fuelCommand', label: 'Fuel command / injector PW · higher = more fuel' },
      { key: 'rpm', label: 'RPM' },
      { key: 'load', label: 'VE table load axis' },
      { key: 'dfco', label: 'DFCO active', group: 'State' },
      { key: 'fuelCutReason', label: 'Fuel cut code', group: 'State' },
      { key: 'aeActive', label: 'TPS AE active', group: 'Transient' },
      { key: 'decelActive', label: 'TPS Decel active', group: 'Transient' },
      { key: 'totalCorrection', label: 'Total fuel correction', group: 'Corrections' },
      { key: 'stft', label: 'STFT Bank 1', group: 'Corrections' },
      { key: 'ltft', label: 'LTFT Bank 1', group: 'Corrections' },
    ],
    options: [
      { key: 'deadband', label: 'Mixture error deadband', placeholder: 'auto: 0.015 λ / 0.20 AFR', step: '0.001' },
      { key: 'mapRpmBin', label: 'Map RPM bin size', value: '250', step: '1' },
      { key: 'mapLoadBin', label: 'Map load bin size', value: '10', step: 'any' },
      { key: 'mapMinSamples', label: 'Map minimum samples / bin', value: '10', step: '1' },
      { key: 'mapMaxRpmRate', label: 'Map max RPM rate / s', value: '500', step: '1' },
      { key: 'mapMaxLoadRate', label: 'Map max load rate / s', value: '25', step: 'any' },
      { key: 'mapSettleMs', label: 'Map stable settling ms', value: '300', step: '10' },
      { key: 'delayCommandDelta', label: 'Delay command Δ threshold', value: '0.5', step: 'any' },
      { key: 'delayAfrDelta', label: 'Delay mixture response threshold', placeholder: 'auto: 0.010 λ / 0.15 AFR', step: '0.001' },
      { key: 'delayWindow', label: 'Delay search window ms', value: '1200', step: '10' },
      { key: 'delaySpacing', label: 'Delay min event spacing ms', value: '250', step: '10' },
    ],
  },
  ignition: {
    title: 'Ignition',
    description: 'Advance/retard/knock evidence with grouped knock events and peak context.',
    roles: [
      { key: 'advance', label: 'Ignition advance', required: true },
      { key: 'retard', label: 'Retard' },
      { key: 'knock', label: 'Knock signal' },
    ],
    options: [{ key: 'knockThreshold', label: 'Knock threshold', value: '0', step: '0.1' }],
  },
  'fuel-injector': {
    title: 'Fuel Pressure / Injector',
    description: 'Rail pressure and injector PW/duty/deadtime evidence with low-pressure and high-duty events.',
    roles: [
      { key: 'reference', label: 'Reference sample grid', required: true },
      { key: 'fuelPressure', label: 'Fuel pressure' },
      { key: 'railDiff', label: 'Rail differential' },
      { key: 'pw', label: 'Injector PW' },
      { key: 'duty', label: 'Injector duty' },
      { key: 'deadtime', label: 'Injector deadtime' },
    ],
    options: [
      { key: 'lowPressure', label: 'Low differential threshold', placeholder: 'optional', step: 'any' },
      { key: 'highDuty', label: 'High duty threshold', value: '90', step: '0.1' },
    ],
  },
  'trigger-sync': {
    title: 'Trigger / Sync',
    description: 'Sync-state dropouts, trigger errors and sync-loss counter increments.',
    roles: [
      { key: 'reference', label: 'Reference sample grid', required: true },
      { key: 'syncState', label: 'Sync state' },
      { key: 'triggerError', label: 'Trigger error' },
      { key: 'lossCounter', label: 'Sync loss counter' },
      { key: 'rpm', label: 'RPM' },
    ],
    options: [
      { key: 'syncedMinimum', label: 'Synced minimum', value: '1', step: '1' },
      { key: 'errorThreshold', label: 'Trigger error threshold', value: '0', step: '0.1' },
    ],
  },
};

function numberText(value: number | undefined, precision = 3): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  return value.toFixed(precision).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function timeText(ms: number | undefined): string {
  return ms === undefined || !Number.isFinite(ms) ? '—' : `${(ms / 1000).toFixed(3)} s`;
}

function percentageText(count: number, total: number): string {
  if (total <= 0) return '0%';
  return `${((count / total) * 100).toFixed(1)}%`;
}

function fuelCutReasonSummary(counts: readonly FuelingCutReasonCount[]): string {
  if (!counts.length) return 'None in scope';
  return counts.slice(0, 4).map(({ code, count }) => `${FUEL_CUT_REASON_LABELS[code] ?? `Code ${code}`} ${count}`).join(' · ')
    + (counts.length > 4 ? ` · +${counts.length - 4} more` : '');
}

export function createSpecializedAnalyzerSuiteView(): SpecializedAnalyzerSuiteController {
  let context: LoggerAnalysisContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };
  let domain: SpecializedAnalyzerDomain = 'idle';
  let analysisGeneration = 0;
  const rememberedSelections = new Map<string, string>();

  const root = document.createElement('section');
  root.className = 'specialized-analyzer-view';
  root.hidden = true;
  root.innerHTML = `
    <div class="specialized-analyzer-banner">
      <div><strong data-specialized="title">Idle · Experimental</strong><span data-specialized="description"></span></div>
      <span class="specialized-analyzer-badge">EXP</span>
    </div>
    <div class="specialized-analyzer-controls"></div>
    <div class="specialized-analyzer-guidance" hidden><strong data-specialized="guidance-title">What Analyze does</strong><span data-specialized="guidance-text"></span></div>
    <details class="specialized-analyzer-options" open>
      <summary>Analysis thresholds</summary>
      <div class="specialized-analyzer-options-grid"></div>
    </details>
    <div class="specialized-analyzer-empty">
      <strong>Select the required available channel and a valid scope.</strong>
      <span>All channels present in the loaded log are available; selected roles decode on demand. Optional roles can remain unselected.</span>
    </div>
    <div class="specialized-analyzer-content" hidden>
      <div class="specialized-analyzer-summary"></div>
      <section class="specialized-analyzer-events specialized-analyzer-map-section" hidden>
        <header><strong data-specialized="map-title">Steady-state mixture operating points</strong><span data-specialized="map-count">0</span></header>
        <div class="specialized-analyzer-table-wrap">
          <table class="specialized-analyzer-table specialized-analyzer-map-table"><thead></thead><tbody></tbody></table>
        </div>
      </section>
      <section class="specialized-analyzer-evidence" hidden>
        <header><div><strong data-specialized="evidence-title">Event evidence</strong><span data-specialized="evidence-note">Median with 10–90% envelope · t=0 at event onset</span></div><button type="button" data-specialized="evidence-all">All events</button></header>
        <canvas class="specialized-analyzer-evidence-canvas" aria-label="Analyzer event-aligned evidence graph"></canvas>
      </section>
      <section class="specialized-analyzer-events">
        <header><strong data-specialized="events-title">Events</strong><span data-specialized="events-count">0</span></header>
        <div class="specialized-analyzer-table-wrap">
          <table class="specialized-analyzer-table"><thead></thead><tbody></tbody></table>
        </div>
      </section>
    </div>
  `;

  const controls = root.querySelector<HTMLElement>('.specialized-analyzer-controls');
  const guidance = root.querySelector<HTMLElement>('.specialized-analyzer-guidance');
  const optionsGrid = root.querySelector<HTMLElement>('.specialized-analyzer-options-grid');
  const empty = root.querySelector<HTMLElement>('.specialized-analyzer-empty');
  const content = root.querySelector<HTMLElement>('.specialized-analyzer-content');
  const summary = root.querySelector<HTMLElement>('.specialized-analyzer-summary');
  const mapSection = root.querySelector<HTMLElement>('.specialized-analyzer-map-section');
  const mapHead = root.querySelector<HTMLTableSectionElement>('.specialized-analyzer-map-table thead');
  const mapBody = root.querySelector<HTMLTableSectionElement>('.specialized-analyzer-map-table tbody');
  const evidence = root.querySelector<HTMLElement>('.specialized-analyzer-evidence');
  const evidenceCanvas = root.querySelector<HTMLCanvasElement>('.specialized-analyzer-evidence-canvas');
  const evidenceAll = root.querySelector<HTMLButtonElement>('[data-specialized="evidence-all"]');
  const tableHead = root.querySelector<HTMLTableSectionElement>('.specialized-analyzer-events:not(.specialized-analyzer-map-section) .specialized-analyzer-table thead');
  const tableBody = root.querySelector<HTMLTableSectionElement>('.specialized-analyzer-events:not(.specialized-analyzer-map-section) .specialized-analyzer-table tbody');
  if (!controls || !guidance || !optionsGrid || !empty || !content || !summary || !mapSection || !mapHead || !mapBody || !evidence || !evidenceCanvas || !evidenceAll || !tableHead || !tableBody) throw new Error('Specialized Analyzer suite structure is incomplete.');

  const field = (name: string): HTMLElement => {
    const node = root.querySelector<HTMLElement>(`[data-specialized="${name}"]`);
    if (!node) throw new Error(`Specialized Analyzer field missing: ${name}`);
    return node;
  };

  const roleSelect = (key: string): HTMLSelectElement | undefined =>
    controls.querySelector<HTMLSelectElement>(`select[data-role="${key}"]`) ?? undefined;

  const optionInput = (key: string): HTMLInputElement | undefined =>
    optionsGrid.querySelector<HTMLInputElement>(`input[data-option="${key}"]`) ?? undefined;

  function optionNumber(key: string): number | undefined;
  function optionNumber(key: string, fallback: number): number;
  function optionNumber(key: string, fallback?: number): number | undefined {
    const input = optionInput(key);
    if (!input || input.value.trim() === '') return fallback;
    const value = Number(input.value);
    return Number.isFinite(value) ? value : fallback;
  }

  const mixtureScale = (trace: LoggerAnalysisTraceContext | undefined): MixtureScale => {
    if (!trace) return 'unknown';
    const identity = `${trace.channel.sourceName} ${trace.channel.displayName}`.toLowerCase();
    if (identity.includes('lambda')) return 'lambda';
    if (/\bafr\b|air.?fuel/.test(identity)) return 'afr';
    return 'unknown';
  };

  const currentIdleSystem = (): IdleSystem => {
    const value = controls.querySelector<HTMLSelectElement>('select[data-role="idle-system"]')?.value as IdleSystem | undefined;
    return IDLE_SYSTEMS.some((entry) => entry.value === value) ? value! : 'combined';
  };

  const idleRoleRelevant = (role: RoleSpec, system: IdleSystem): boolean =>
    !role.systems?.length || system === 'combined' || role.systems.includes(system);

  const updateIdleGuidance = (): void => {
    if (domain === 'fueling') {
      guidance.hidden = false;
      field('guidance-title').textContent = 'State-aware mixture evidence + observed response delay';
      field('guidance-text').textContent = 'DFCO and nonzero fuel-cut codes are excluded from both calibration and delay evidence because they intentionally remove fuel. TPS AE and TPS Decel are excluded from steady VE evidence but remain usable for transient delay analysis. The map then applies RPM/load settling. Lambda-first, scale-aware mixture thresholds remain the default.';
      return;
    }
    if (domain !== 'idle') { guidance.hidden = true; return; }
    guidance.hidden = false;
    const system = currentIdleSystem();
    const systemInfo = IDLE_SYSTEMS.find((entry) => entry.value === system) ?? IDLE_SYSTEMS[0]!;
    const sag = optionNumber('sag', 100);
    const settled = optionNumber('settled', 40);
    field('guidance-title').textContent = `What Analyze does · ${systemInfo.label}`;
    const biasNote = system === 'combined' || system === 'dc-valve'
      ? ' DC Bias is a calibration curve; in DC Idle mode the firmware exposes its evaluated runtime feed-forward through etbFeedForward.'
      : '';
    field('guidance-text').textContent = `${systemInfo.description} A sag starts when RPM is at least ${sag} RPM below Idle target; recovery ends when RPM returns inside ±${settled} RPM of target.${biasNote}`;
  };

  const selectedScope = () => {
    const scope = controls.querySelector<HTMLSelectElement>('select[data-role="scope"]');
    return scope ? selectedAnalyzerScope(scope, context) : undefined;
  };

  const renderSummary = (items: readonly [string, string][]): void => {
    summary.replaceChildren(...items.map(([label, value]) => {
      const div = document.createElement('div');
      const caption = document.createElement('span');
      caption.textContent = label;
      const strong = document.createElement('strong');
      strong.textContent = value;
      div.append(caption, strong);
      return div;
    }));
    if (domain === 'fueling') ensureFuelingAnalyzerHelp(root);
  };

  let restoreAllEvidence: (() => void) | undefined;

  const finiteMean = (values: readonly (number | undefined)[]): number | undefined => {
    const finite = values.filter((value): value is number => value !== undefined && Number.isFinite(value));
    return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : undefined;
  };

  const finiteMedian = (values: readonly (number | undefined)[]): number | undefined => {
    const finite = values.filter((value): value is number => value !== undefined && Number.isFinite(value)).sort((a, b) => a - b);
    if (!finite.length) return undefined;
    const middle = Math.floor(finite.length / 2);
    return finite.length % 2 ? finite[middle] : ((finite[middle - 1] ?? 0) + (finite[middle] ?? 0)) / 2;
  };

  const showAlignedEvidence = (
    title: string,
    series: readonly AnalyzerEvidenceSeries[],
    events: readonly { startTimeMs: number; endTimeMs: number }[],
    beforeMs: number,
    afterMs: number,
  ): void => {
    evidence.hidden = events.length === 0 || series.length === 0;
    if (evidence.hidden) { restoreAllEvidence = undefined; return; }
    field('evidence-title').textContent = title;
    field('evidence-note').textContent = `${events.length.toLocaleString()} event${events.length === 1 ? '' : 's'} · median + 10–90% envelope · t=0 onset`;
    const renderAll = (): void => renderAlignedAnalyzerEvidence(evidenceCanvas, series, events, beforeMs, afterMs);
    restoreAllEvidence = renderAll;
    renderAll();
  };

  evidenceAll.addEventListener('click', () => restoreAllEvidence?.());

  interface EvidenceNavigation {
    readonly sampleIndices: readonly number[];
    readonly timeMs: readonly number[];
    readonly label: string;
  }

  const renderTable = (
    title: string,
    headers: readonly string[],
    rows: readonly (readonly string[])[],
    navigation: readonly EvidenceNavigation[] = [],
    onSelect?: (index: number) => void,
  ): void => {
    field('events-title').textContent = title;
    field('events-count').textContent = rows.length.toLocaleString();
    const headerRow = document.createElement('tr');
    for (const header of headers) {
      const th = document.createElement('th');
      th.textContent = header;
      headerRow.append(th);
    }
    tableHead.replaceChildren(headerRow);
    tableBody.replaceChildren(...rows.slice(0, 200).map((values, index) => {
      const tr = document.createElement('tr');
      for (const value of values) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.append(td);
      }
      const target = navigation[index];
      if (target) {
        tr.classList.add('specialized-analyzer-event-row--navigable');
        tr.tabIndex = 0;
        tr.title = context.openSamplesInLogger ? 'Click to inspect · double-click or Enter to open in Logger' : 'Click to inspect';
        const select = (): void => {
          tableBody.querySelectorAll('tr').forEach((row) => row.classList.remove('specialized-analyzer-event-row--selected'));
          tr.classList.add('specialized-analyzer-event-row--selected');
          onSelect?.(index);
        };
        const open = (): void => context.openSamplesInLogger?.(target);
        tr.addEventListener('click', select);
        if (context.openSamplesInLogger) tr.addEventListener('dblclick', open);
        tr.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' && context.openSamplesInLogger) { event.preventDefault(); open(); }
          else if (event.key === ' ') { event.preventDefault(); select(); }
        });
      }
      return tr;
    }));
  };

  const renderMapTable = (headers: readonly string[], rows: readonly (readonly string[])[]): void => {
    mapSection.hidden = false;
    field('map-count').textContent = rows.length.toLocaleString();
    const headerRow = document.createElement('tr');
    for (const header of headers) {
      const th = document.createElement('th');
      th.textContent = header;
      headerRow.append(th);
    }
    mapHead.replaceChildren(headerRow);
    if (!rows.length) {
      const row = document.createElement('tr');
      row.dataset.analyzerEmptyState = 'true';
      const cell = document.createElement('td');
      cell.colSpan = headers.length;
      cell.textContent = 'No steady operating points passed the current scope, fuel-state/transient context, settling and minimum-sample rules.';
      row.append(cell);
      mapBody.replaceChildren(row);
      return;
    }
    mapBody.replaceChildren(...rows.slice(0, 300).map((values) => {
      const tr = document.createElement('tr');
      for (const value of values) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.append(td);
      }
      return tr;
    }));
  };

  const eventNavigation = (
    events: readonly { startSampleIndex: number; endSampleIndex: number; startTimeMs: number; endTimeMs: number }[],
    label: string,
  ): readonly EvidenceNavigation[] => events.map((event, index) => ({
    sampleIndices: event.startSampleIndex === event.endSampleIndex
      ? [event.startSampleIndex]
      : [event.startSampleIndex, event.endSampleIndex],
    timeMs: event.startTimeMs === event.endTimeMs
      ? [event.startTimeMs]
      : [event.startTimeMs, event.endTimeMs],
    label: `${label} ${index + 1}`,
  }));

  const scopeForPrimary = (primary: LoggerAnalysisTraceContext, selected: readonly LoggerAnalysisTraceContext[]) => {
    const scope = selectedScope();
    if (!scope) return undefined;
    const { startMs, endMs } = analyzerScopeBounds(scope);
    const channels = new Map([[primary.channel.id, { range: primary.range, complete: primary.complete }]]);
    const qualified = qualifyNumericSamples({
      referenceChannelId: primary.channel.id,
      channels,
      conditions: [],
      ...(startMs !== undefined && endMs !== undefined ? { timeRange: { startMs, endMs } } : {}),
    });
    const complete = qualified.complete && selected.every((trace) => {
      if (startMs === undefined || endMs === undefined) return trace.complete;
      return trace.complete || numericRangeCoversTime(trace.range, startMs, endMs);
    });
    return { scope, startMs, endMs, sampleIndices: qualified.eligibleSampleIndices, complete };
  };

  const analyzeCurrent = async (): Promise<void> => {
    const generation = ++analysisGeneration;
    const spec = SPECS[domain];
    const selected = new Map<string, string>();
    const idleSystem = domain === 'idle' ? currentIdleSystem() : 'combined';
    for (const role of spec.roles) {
      if (domain === 'idle' && !idleRoleRelevant(role, idleSystem)) continue;
      const id = roleSelect(role.key)?.value;
      if (id) selected.set(role.key, id);
      if (role.required && !id) {
        empty.hidden = false; content.hidden = true;
        const strong = empty.querySelector('strong');
        if (strong) strong.textContent = `Select ${role.label} before analyzing ${domain === 'idle' ? 'idle events' : 'this analyzer'}.`;
        return;
      }
    }
    const scope = selectedScope();
    if (!scope) { empty.hidden = false; content.hidden = true; return; }
    const { startMs, endMs } = analyzerScopeBounds(scope);
    const loaded = await context.loadTraces([...selected.values()], startMs, endMs);
    if (generation !== analysisGeneration) return;
    const byId = new Map(loaded.map((trace) => [trace.channel.id, trace]));
    const traces = new Map<string, LoggerAnalysisTraceContext>();
    for (const [key, id] of selected) {
      const trace = byId.get(id);
      if (trace) traces.set(key, trace);
    }
    const primaryKey = spec.roles.find((role) => role.required)?.key ?? '';
    const primary = traces.get(primaryKey);
    if (!primary) { empty.hidden = false; content.hidden = true; return; }
    const scoped = scopeForPrimary(primary, [...traces.values()]);
    if (!scoped) {
      empty.hidden = false;
      content.hidden = true;
      return;
    }

    try {
      mapSection.hidden = true;
      mapHead.replaceChildren();
      mapBody.replaceChildren();
      evidence.hidden = true;
      restoreAllEvidence = undefined;
      if (domain === 'idle') {
        const rpm = traces.get('rpm')!;
        const target = traces.get('target');
        const basePosition = traces.get('basePosition');
        const closedLoop = traces.get('closedLoop');
        const finalPosition = traces.get('finalPosition');
        const p = traces.get('p');
        const i = traces.get('i');
        const d = traces.get('d');
        const dcTarget = traces.get('dcTarget');
        const dcPosition = traces.get('dcPosition');
        const dcBiasOutput = traces.get('dcBiasOutput');
        const dcP = traces.get('dcP');
        const dcI = traces.get('dcI');
        const dcD = traces.get('dcD');
        const dcOutput = traces.get('dcOutput');
        const valve = traces.get('valve');
        const etbTarget = traces.get('etbTarget');
        const etbPosition = traces.get('etbPosition');
        const etbContribution = traces.get('etbContribution');
        const ignitionAdvance = traces.get('ignitionAdvance');
        const ignitionCorrection = traces.get('ignitionCorrection');
        const result = analyzeIdle({
          rpm: rpm.range,
          ...(target ? { target: target.range } : {}),
          ...(valve ? { valveDuty: valve.range } : {}),
        }, { sampleIndices: scoped.sampleIndices, complete: scoped.complete, sagThresholdRpm: optionNumber('sag', 100), settledBandRpm: optionNumber('settled', 40) });
        const diagnostics = analyzeIdleControlDiagnostics({
          sampleIndices: scoped.sampleIndices,
          ...(basePosition ? { basePosition: basePosition.range } : {}),
          ...(closedLoop ? { closedLoop: closedLoop.range } : {}),
          ...(finalPosition ? { finalPosition: finalPosition.range } : {}),
          ...(p ? { pTerm: p.range } : {}),
          ...(i ? { iTerm: i.range } : {}),
          ...(d ? { dTerm: d.range } : {}),
          ...(dcTarget ? { dcTarget: dcTarget.range } : {}),
          ...(dcPosition ? { dcPosition: dcPosition.range } : {}),
          ...(dcBiasOutput ? { dcBias: dcBiasOutput.range } : {}),
          ...(dcP ? { dcPTerm: dcP.range } : {}),
          ...(dcI ? { dcITerm: dcI.range } : {}),
          ...(dcD ? { dcDTerm: dcD.range } : {}),
          ...(dcOutput ? { dcOutput: dcOutput.range } : {}),
        });
        const idleSeries: AnalyzerEvidenceSeries[] = [
          { label: 'RPM', range: rpm.range },
          ...(target ? [{ label: 'Target', range: target.range }] : []),
          ...(basePosition ? [{ label: 'Base idle position', range: basePosition.range }] : []),
          ...(closedLoop ? [{ label: 'Idle closed-loop correction', range: closedLoop.range }] : []),
          ...(finalPosition ? [{ label: 'Final idle position', range: finalPosition.range }] : []),
          ...(p ? [{ label: 'RPM-control P term', range: p.range }] : []),
          ...(i ? [{ label: 'RPM-control I term', range: i.range }] : []),
          ...(d ? [{ label: 'RPM-control D term', range: d.range }] : []),
          ...(dcTarget ? [{ label: 'DC valve target', range: dcTarget.range }] : []),
          ...(dcPosition ? [{ label: 'DC valve position', range: dcPosition.range }] : []),
          ...(dcBiasOutput ? [{ label: 'DC Bias / feed-forward', range: dcBiasOutput.range }] : []),
          ...(dcP ? [{ label: 'DC position P term', range: dcP.range }] : []),
          ...(dcI ? [{ label: 'DC position I term', range: dcI.range }] : []),
          ...(dcD ? [{ label: 'DC position D term', range: dcD.range }] : []),
          ...(dcOutput ? [{ label: 'DC position output', range: dcOutput.range }] : []),
          ...(valve ? [{ label: 'IAC valve duty', range: valve.range }] : []),
          ...(etbTarget ? [{ label: 'ETB target', range: etbTarget.range }] : []),
          ...(etbPosition ? [{ label: 'ETB position', range: etbPosition.range }] : []),
          ...(etbContribution ? [{ label: 'ETB idle contribution', range: etbContribution.range }] : []),
          ...(ignitionAdvance ? [{ label: 'Ignition advance', range: ignitionAdvance.range }] : []),
          ...(ignitionCorrection ? [{ label: 'Idle ignition correction', range: ignitionCorrection.range }] : []),
        ];
        const idleAfterMs = Math.min(4000, Math.max(1200, ...result.sagEvents.map((event) => event.durationMs + (event.recoveryMs ?? 0) + 300)));
        showAlignedEvidence('Idle sag / recovery · aligned evidence', idleSeries, result.sagEvents, 500, idleAfterMs);
        renderSummary([
          ['Idle system', IDLE_SYSTEMS.find((entry) => entry.value === idleSystem)?.label ?? 'Combined'],
          ['Scope', scoped.scope.label], ['Coverage', result.complete ? 'Complete' : 'Partial decoded'],
          ['RPM mean', numberText(result.rpm.mean)], ['Target mean', numberText(result.target?.mean)],
          ['RPM error MAE / RMSE', `${numberText(result.tracking?.meanAbsoluteError)} / ${numberText(result.tracking?.rmse)}`],
          ['Worst sag', numberText(result.sagEvents.length ? Math.min(...result.sagEvents.map((event) => event.minimumErrorRpm)) : undefined)],
          ['Median recovery', result.sagEvents.length ? `${numberText(finiteMedian(result.sagEvents.map((event) => event.recoveryMs)), 0)} ms` : '—'],
          ['Base / CL / final position', `${numberText(diagnostics.basePosition?.mean)} / ${numberText(diagnostics.closedLoop?.mean)} / ${numberText(diagnostics.finalPosition?.mean)}`],
          ['CL effort |mean| / RMS', `${numberText(diagnostics.closedLoop?.meanAbsolute)} / ${numberText(diagnostics.closedLoop?.rootMeanSquare)}`],
          ['RPM PID |P| / |I| / |D|', `${numberText(diagnostics.pTerm?.meanAbsolute)} / ${numberText(diagnostics.iTerm?.meanAbsolute)} / ${numberText(diagnostics.dTerm?.meanAbsolute)}`],
          ['RPM PID RMS P / I / D', `${numberText(diagnostics.pTerm?.rootMeanSquare)} / ${numberText(diagnostics.iTerm?.rootMeanSquare)} / ${numberText(diagnostics.dTerm?.rootMeanSquare)}`],
          ['RPM I mean', numberText(diagnostics.iTerm?.mean)],
          ['DC target / position mean', `${numberText(diagnostics.dcTarget?.mean)} / ${numberText(diagnostics.dcPosition?.mean)}`],
          ['DC position MAE / RMSE', `${numberText(diagnostics.dcTracking?.meanAbsoluteError)} / ${numberText(diagnostics.dcTracking?.rmse)}`],
          ['DC position error − / +', `${numberText(diagnostics.dcTracking?.maxNegativeError)} / ${numberText(diagnostics.dcTracking?.maxPositiveError)}`],
          ['DC Bias mean', numberText(diagnostics.dcBias?.mean)],
          ['DC PID |P| / |I| / |D|', `${numberText(diagnostics.dcPTerm?.meanAbsolute)} / ${numberText(diagnostics.dcITerm?.meanAbsolute)} / ${numberText(diagnostics.dcDTerm?.meanAbsolute)}`],
          ['DC I mean', numberText(diagnostics.dcITerm?.mean)],
          ['DC output mean / RMS', `${numberText(diagnostics.dcOutput?.mean)} / ${numberText(diagnostics.dcOutput?.rootMeanSquare)}`],
          ['IAC valve mean', numberText(result.valveDuty?.mean)],
          ['ETB target / position', `${numberText(etbTarget ? aggregateNumericSamples(etbTarget.range, { sampleIndices: scoped.sampleIndices }).mean : undefined)} / ${numberText(etbPosition ? aggregateNumericSamples(etbPosition.range, { sampleIndices: scoped.sampleIndices }).mean : undefined)}`],
          ['ETB contribution', numberText(etbContribution ? aggregateNumericSamples(etbContribution.range, { sampleIndices: scoped.sampleIndices }).mean : undefined)],
          ['Ign advance / correction', `${numberText(ignitionAdvance ? aggregateNumericSamples(ignitionAdvance.range, { sampleIndices: scoped.sampleIndices }).mean : undefined)} / ${numberText(ignitionCorrection ? aggregateNumericSamples(ignitionCorrection.range, { sampleIndices: scoped.sampleIndices }).mean : undefined)}`],
          ['Sag events', String(result.sagEvents.length)], ['Input samples', result.rpm.inputSampleCount.toLocaleString()],
        ]);
        renderTable('Sag / recovery events', ['#', 'Start', 'End', 'Duration', 'Min error RPM', 'Recovery'], result.sagEvents.map((event, index) => [String(index + 1), timeText(event.startTimeMs), timeText(event.endTimeMs), `${event.durationMs.toFixed(0)} ms`, numberText(event.minimumErrorRpm), event.recoveryMs === undefined ? '—' : `${event.recoveryMs.toFixed(0)} ms`]), eventNavigation(result.sagEvents, 'Idle sag'), (index) => {
          const event = result.sagEvents[index];
          if (event) { field('evidence-note').textContent = `Event ${index + 1} · ${event.minimumErrorRpm.toFixed(0)} RPM minimum error · t=0 onset`; renderAlignedAnalyzerEvidence(evidenceCanvas, idleSeries, [event], 500, idleAfterMs); }
        });
      } else if (domain === 'ae-map') {
        const tps = traces.get('tps')!;
        const map = traces.get('map');
        const predicted = traces.get('predictedMap');
        const afr = traces.get('afr');
        const result = analyzeAeMapPredict({ tps: tps.range, ...(map ? { map: map.range } : {}), ...(predicted ? { predictedMap: predicted.range } : {}), ...(afr ? { afr: afr.range } : {}) }, { sampleIndices: scoped.sampleIndices, complete: scoped.complete, tpsDeltaThreshold: optionNumber('tpsThreshold', 2), eventWindowMs: optionNumber('window', 500) });
        const tipIns = result.events.filter((event) => event.direction === 'tip-in').length;
        const transientSeries: AnalyzerEvidenceSeries[] = [
          { label: 'TPS', range: tps.range },
          ...(map ? [{ label: 'MAP', range: map.range }] : []),
          ...(predicted ? [{ label: 'Predicted MAP', range: predicted.range }] : []),
          ...(afr ? [{ label: 'Mixture', range: afr.range }] : []),
        ];
        const eventWindow = optionNumber('window', 500);
        showAlignedEvidence('AE / MAP Predict · aligned transients', transientSeries, result.events, 200, Math.max(300, eventWindow));
        renderSummary([
          ['Scope', scoped.scope.label], ['Coverage', result.complete ? 'Complete' : 'Partial decoded'],
          ['Events', String(result.events.length)], ['Tip-in / decel', `${tipIns} / ${result.events.length - tipIns}`],
          ['TPS mean', numberText(result.tps.mean)], ['MAP mean', numberText(result.map?.mean)],
          ['Predict error mean', numberText(finiteMean(result.events.map((event) => event.predictionErrorAtEnd)))],
          ['Predict error MAE', numberText(finiteMean(result.events.map((event) => event.predictionErrorAtEnd === undefined ? undefined : Math.abs(event.predictionErrorAtEnd))))],
          ['Peak lean excursion', numberText(result.events.length ? Math.max(...result.events.map((event) => event.afrLeanExcursion ?? 0)) : undefined)],
          ['Peak rich excursion', numberText(result.events.length ? Math.min(...result.events.map((event) => event.afrRichExcursion ?? 0)) : undefined)],
          ['Predicted MAP mean', numberText(result.predictedMap?.mean)], ['Mixture mean', numberText(result.afr?.mean)],
        ]);
        renderTable('Transient events', ['#', 'Type', 'Start', 'Duration', 'TPS Δ', 'MAP Δ', 'Predict error', 'Lean excursion', 'Rich excursion'], result.events.map((event, index) => [String(index + 1), event.direction, timeText(event.startTimeMs), `${event.durationMs.toFixed(0)} ms`, numberText(event.tpsDelta), numberText(event.mapDelta), numberText(event.predictionErrorAtEnd), numberText(event.afrLeanExcursion), numberText(event.afrRichExcursion)]), eventNavigation(result.events, 'AE / MAP transient'), (index) => {
          const event = result.events[index];
          if (event) { field('evidence-note').textContent = `Event ${index + 1} · ${event.direction} · TPS Δ ${numberText(event.tpsDelta)} · t=0 onset`; renderAlignedAnalyzerEvidence(evidenceCanvas, transientSeries, [event], 200, Math.max(300, eventWindow)); }
        });
      } else if (domain === 'fueling') {
        const actual = traces.get('actual')!;
        const target = traces.get('target');
        const ve = traces.get('ve');
        const fuelCommand = traces.get('fuelCommand');
        const rpm = traces.get('rpm');
        const load = traces.get('load');
        const dfco = traces.get('dfco');
        const fuelCutReason = traces.get('fuelCutReason');
        const aeActive = traces.get('aeActive');
        const decelActive = traces.get('decelActive');
        const totalCorrection = traces.get('totalCorrection');
        const stft = traces.get('stft');
        const ltft = traces.get('ltft');
        const actualScale = mixtureScale(actual);
        const targetScale = mixtureScale(target);
        if (target && actualScale !== 'unknown' && targetScale !== 'unknown' && actualScale !== targetScale) {
          throw new Error('Actual and target mixture channels use different scales. Select Lambda + target lambda, or matching AFR channels.');
        }
        const fuelingContext = qualifyFuelingContext({
          reference: actual.range,
          ...(dfco ? { dfcoActive: dfco.range } : {}),
          ...(fuelCutReason ? { fuelCutReason: fuelCutReason.range } : {}),
          ...(aeActive ? { aeActive: aeActive.range } : {}),
          ...(decelActive ? { decelActive: decelActive.range } : {}),
        }, scoped.sampleIndices);
        const calibrationIndices = fuelingContext.calibrationEligibleSampleIndices;
        const delayIndices = fuelingContext.delayEligibleSampleIndices;
        const deadband = optionNumber('deadband', actualScale === 'lambda' ? 0.015 : 0.2);
        const result = analyzeFueling({ actualAfr: actual.range, ...(target ? { targetAfr: target.range } : {}), ...(ve ? { ve: ve.range } : {}) }, { sampleIndices: calibrationIndices, complete: scoped.complete, errorDeadband: deadband });
        const operatingMap = target && rpm && load ? buildFuelingOperatingMap({
          actualAfr: actual.range,
          targetAfr: target.range,
          rpm: rpm.range,
          load: load.range,
        }, {
          rpmBinSize: optionNumber('mapRpmBin', 250),
          loadBinSize: optionNumber('mapLoadBin', 10),
          minimumSamplesPerBin: optionNumber('mapMinSamples', 10),
          errorDeadband: deadband,
          maxRpmRatePerSecond: optionNumber('mapMaxRpmRate', 500),
          maxLoadRatePerSecond: optionNumber('mapMaxLoadRate', 25),
          minimumStableDurationMs: optionNumber('mapSettleMs', 300),
        }, calibrationIndices) : undefined;
        if (operatingMap) {
          renderMapTable(
            ['RPM bin', 'Load bin', 'Samples', 'RPM mean', 'Load mean', 'Actual mixture', 'Target mixture', 'Error mean', 'Error median', 'P10', 'P90', 'MAE', 'SD', 'Lean / rich / band', 'Bias'],
            operatingMap.operatingPoints.map((point) => [
              `${numberText(point.rpmStart, 0)}–${numberText(point.rpmEnd, 0)}`,
              `${numberText(point.loadStart)}–${numberText(point.loadEnd)}`,
              point.sampleCount.toLocaleString(),
              numberText(point.rpmMean, 0),
              numberText(point.loadMean),
              numberText(point.actualAfrMean),
              numberText(point.targetAfrMean),
              `${point.errorMean > 0 ? '+' : ''}${numberText(point.errorMean)}`,
              `${point.errorMedian > 0 ? '+' : ''}${numberText(point.errorMedian)}`,
              `${point.errorP10 > 0 ? '+' : ''}${numberText(point.errorP10)}`,
              `${point.errorP90 > 0 ? '+' : ''}${numberText(point.errorP90)}`,
              numberText(point.errorMeanAbsolute),
              numberText(point.errorStdDev),
              `${point.leanSampleCount} / ${point.richSampleCount} / ${point.withinDeadbandSampleCount}`,
              point.bias === 'within-deadband' ? 'Within deadband' : point.bias === 'lean' ? 'Lean' : point.bias === 'rich' ? 'Rich' : 'Balanced',
            ]),
          );
        }
        const delayWindow = optionNumber('delayWindow', 1200);
        const delay = fuelCommand ? analyzeAfrDelay({
          actualAfr: actual.range,
          fuelCommand: fuelCommand.range,
          ...(rpm ? { rpm: rpm.range } : {}),
          ...(load ? { load: load.range } : {}),
        }, {
          commandDeltaThreshold: optionNumber('delayCommandDelta', 0.5),
          afrResponseThreshold: optionNumber('delayAfrDelta', actualScale === 'lambda' ? 0.010 : 0.15),
          searchWindowMs: delayWindow,
          minimumEventSpacingMs: optionNumber('delaySpacing', 250),
          responsePolarity: 'inverse',
        }, delayIndices) : undefined;
        const correction = totalCorrection ? aggregateNumericSamples(totalCorrection.range, { sampleIndices: calibrationIndices }) : undefined;
        const stftStats = stft ? aggregateNumericSamples(stft.range, { sampleIndices: calibrationIndices }) : undefined;
        const ltftStats = ltft ? aggregateNumericSamples(ltft.range, { sampleIndices: calibrationIndices }) : undefined;
        const delaySeries: AnalyzerEvidenceSeries[] = fuelCommand ? [
          { label: 'Fuel command / injector PW', range: fuelCommand.range },
          { label: 'Actual mixture', range: actual.range },
          ...(target ? [{ label: 'Target mixture', range: target.range }] : []),
          ...(rpm ? [{ label: 'RPM', range: rpm.range }] : []),
          ...(load ? [{ label: 'VE table load', range: load.range }] : []),
          ...(aeActive ? [{ label: 'TPS AE active', range: aeActive.range }] : []),
          ...(decelActive ? [{ label: 'TPS Decel active', range: decelActive.range }] : []),
        ] : [];
        const delayEvidenceEvents = delay?.events.map((event) => ({ startTimeMs: event.commandTimeMs, endTimeMs: event.responseTimeMs })) ?? [];
        showAlignedEvidence('Fueling · observed mixture response-delay evidence', delaySeries, delayEvidenceEvents, 200, delayWindow);
        const hasCutContext = Boolean(dfco || fuelCutReason || aeActive || decelActive);
        const dfcoStatus = !dfco
          ? 'Not available'
          : fuelingContext.dfcoActiveSampleCount > 0
            ? `Active · ${fuelingContext.dfcoActiveSampleCount.toLocaleString()} samples (${percentageText(fuelingContext.dfcoActiveSampleCount, fuelingContext.inputSampleCount)})`
            : 'Not active in scope';
        const otherCuts = !fuelCutReason
          ? 'Not available'
          : fuelingContext.fuelCutSampleCount > 0
            ? `${fuelingContext.fuelCutSampleCount.toLocaleString()} samples (${percentageText(fuelingContext.fuelCutSampleCount, fuelingContext.inputSampleCount)})`
            : 'None in scope';
        renderSummary([
          ['Scope', scoped.scope.label], ['Coverage', result.complete ? 'Complete' : 'Partial decoded'],
          ['Mixture scale', actualScale === 'lambda' ? 'Lambda' : actualScale === 'afr' ? 'AFR' : 'Unknown / selected units'],
          ['Calibration eligible / scoped', `${calibrationIndices.length.toLocaleString()} / ${fuelingContext.inputSampleCount.toLocaleString()}`],
          ['Delay eligible / scoped', `${delayIndices.length.toLocaleString()} / ${fuelingContext.inputSampleCount.toLocaleString()}`],
          ['DFCO status', dfcoStatus],
          ['Other fuel cuts', otherCuts],
          ['Fuel cut reasons', fuelCutReason ? fuelCutReasonSummary(fuelingContext.fuelCutReasonCounts) : 'Not available'],
          ['AE / decel excluded', aeActive || decelActive ? `${fuelingContext.aeActiveSampleCount.toLocaleString()} / ${fuelingContext.decelActiveSampleCount.toLocaleString()}` : 'Not available'],
          ['Context invalid / unavailable', hasCutContext ? `${fuelingContext.invalidContextSampleCount.toLocaleString()} / ${fuelingContext.unavailableContextSampleCount.toLocaleString()}` : 'No context channels selected'],
          ['Actual mixture mean', numberText(result.actual.mean)], ['Target mixture mean', numberText(result.target?.mean)],
          ['Mean error', numberText(result.tracking?.meanError)], ['MAE', numberText(result.tracking?.meanAbsoluteError)],
          ['Max lean error', numberText(result.tracking?.maxPositiveError)], ['Max rich error', numberText(result.tracking?.maxNegativeError)],
          ['Lean samples', result.leanSampleCount.toLocaleString()], ['Rich samples', result.richSampleCount.toLocaleString()],
          ['Current VE mean', numberText(result.ve?.mean)], ['Valid mixture samples', result.actual.validSampleCount.toLocaleString()],
          ['Total fuel correction mean', totalCorrection ? numberText(correction?.mean) : 'Not available'],
          ['STFT Bank 1 mean', stft ? numberText(stftStats?.mean) : 'Not available'],
          ['LTFT Bank 1 mean', ltft ? numberText(ltftStats?.mean) : 'Not available'],
          ['Steady map bins', operatingMap ? operatingMap.operatingPoints.length.toLocaleString() : 'Select target / RPM / load'],
          ['Steady eligible / input', operatingMap ? `${operatingMap.stableEligibleSampleCount.toLocaleString()} / ${operatingMap.inputSampleCount.toLocaleString()}` : '—'],
          ['Transient rejected', operatingMap ? operatingMap.transientRejectedSampleCount.toLocaleString() : '—'],
          ['Map invalid / unavailable', operatingMap ? `${operatingMap.invalidSampleCount.toLocaleString()} / ${operatingMap.unavailableSampleCount.toLocaleString()}` : '—'],
          ['Observed mixture delay median', delay?.onsetDelay ? `${numberText(delay.onsetDelay.medianMs, 0)} ms` : fuelCommand ? 'No usable events' : 'Select fuel command'],
          ['Observed delay P10–P90', delay?.onsetDelay ? `${numberText(delay.onsetDelay.p10Ms, 0)}–${numberText(delay.onsetDelay.p90Ms, 0)} ms` : '—'],
          ['Delay median T50 / T90', delay ? `${numberText(delay.medianT50Ms, 0)} / ${numberText(delay.medianT90Ms, 0)} ms` : '—'],
          ['Delay evidence strength', delay?.evidenceStrength ?? 'Not evaluated'],
          ['Delay candidates / usable', delay ? `${delay.candidateEventCount.toLocaleString()} / ${delay.usableEventCount.toLocaleString()}` : '—'],
          ['Delay rejected no-response / overlap / gap', delay ? `${delay.rejectedNoResponseCount} / ${delay.rejectedOverlapCount} / ${delay.rejectedGapCount}` : '—'],
        ]);
        if (delay && delay.events.length > 0) {
          const navigation: EvidenceNavigation[] = delay.events.map((event, index) => ({
            sampleIndices: event.commandSampleIndex === event.responseSampleIndex ? [event.commandSampleIndex] : [event.commandSampleIndex, event.responseSampleIndex],
            timeMs: event.commandTimeMs === event.responseTimeMs ? [event.commandTimeMs] : [event.commandTimeMs, event.responseTimeMs],
            label: `Mixture delay event ${index + 1}`,
          }));
          renderTable('Mixture response-delay events', ['#', 'Command time', 'Onset delay', 'Command Δ', 'Mixture Δ @ onset', 'Peak mixture Δ', 'Peak delay', 'T50', 'T90', 'RPM', 'Load'], delay.events.map((event, index) => [
            String(index + 1),
            timeText(event.commandTimeMs),
            `${event.onsetDelayMs.toFixed(0)} ms`,
            numberText(event.commandDelta),
            numberText(event.responseDeltaAfr),
            numberText(event.peakResponseDeltaAfr),
            `${event.peakResponseDelayMs.toFixed(0)} ms`,
            event.t50Ms === undefined ? '—' : `${event.t50Ms.toFixed(0)} ms`,
            event.t90Ms === undefined ? '—' : `${event.t90Ms.toFixed(0)} ms`,
            numberText(event.rpm, 0),
            numberText(event.load),
          ]), navigation, (index) => {
            const event = delay.events[index];
            if (!event) return;
            field('evidence-note').textContent = `Event ${index + 1} · onset ${event.onsetDelayMs.toFixed(0)} ms · command Δ ${numberText(event.commandDelta)} · t=0 command change`;
            renderAlignedAnalyzerEvidence(evidenceCanvas, delaySeries, [{ startTimeMs: event.commandTimeMs, endTimeMs: event.responseTimeMs }], 200, delayWindow);
          });
        } else if (delay) {
          renderTable('Mixture delay evidence', ['Metric', 'Value'], [
            ['Candidate command transitions', delay.candidateEventCount.toLocaleString()],
            ['Usable mixture responses', delay.usableEventCount.toLocaleString()],
            ['Rejected · no response', delay.rejectedNoResponseCount.toLocaleString()],
            ['Rejected · overlapping command', delay.rejectedOverlapCount.toLocaleString()],
            ['Rejected · source/qualification gap', delay.rejectedGapCount.toLocaleString()],
            ['Hint', delay.candidateEventCount === 0 ? 'Choose a command with clear changes or lower the command Δ threshold.' : 'No isolated mixture response passed the current timing/response thresholds.'],
          ]);
        } else {
          renderTable('Fueling evidence', ['Metric', 'Value'], [
            ['Invalid mixture samples', result.actual.invalidSampleCount.toLocaleString()],
            ['Unavailable mixture samples', result.actual.unavailableSampleCount.toLocaleString()],
            ['Tracking invalid', (result.tracking?.invalidSampleCount ?? 0).toLocaleString()],
            ['Tracking unavailable', (result.tracking?.unavailableSampleCount ?? 0).toLocaleString()],
            ['Mixture delay', 'Select Fuel command / injector PW to estimate observed response delay.'],
          ]);
        }
      } else if (domain === 'ignition') {
        const advance = traces.get('advance')!;
        const retard = traces.get('retard');
        const knock = traces.get('knock');
        const result = analyzeIgnition({ advance: advance.range, ...(retard ? { retard: retard.range } : {}), ...(knock ? { knock: knock.range } : {}) }, { sampleIndices: scoped.sampleIndices, complete: scoped.complete, knockThreshold: optionNumber('knockThreshold', 0) });
        renderSummary([
          ['Scope', scoped.scope.label], ['Coverage', result.complete ? 'Complete' : 'Partial decoded'],
          ['Advance mean', numberText(result.advance.mean)], ['Advance min / max', `${numberText(result.advance.min)} / ${numberText(result.advance.max)}`],
          ['Retard mean', numberText(result.retard?.mean)], ['Knock mean / max', `${numberText(result.knock?.mean)} / ${numberText(result.knock?.max)}`],
          ['Knock events', String(result.knockEvents.length)], ['Valid advance', result.advance.validSampleCount.toLocaleString()],
        ]);
        renderTable('Knock events', ['#', 'Start', 'End', 'Duration', 'Peak knock', 'Advance @ peak', 'Retard @ peak'], result.knockEvents.map((event, index) => [String(index + 1), timeText(event.startTimeMs), timeText(event.endTimeMs), `${event.durationMs.toFixed(0)} ms`, numberText(event.peakKnock), numberText(event.advanceAtPeak), numberText(event.retardAtPeak)]), eventNavigation(result.knockEvents, 'Knock event'));
      } else if (domain === 'fuel-injector') {
        const reference = traces.get('reference')!;
        const fuelPressure = traces.get('fuelPressure');
        const railDiff = traces.get('railDiff');
        const pw = traces.get('pw');
        const duty = traces.get('duty');
        const deadtime = traces.get('deadtime');
        const lowPressure = optionNumber('lowPressure');
        const result = analyzeFuelPressureInjector({ reference: reference.range, ...(fuelPressure ? { fuelPressure: fuelPressure.range } : {}), ...(railDiff ? { railDifferential: railDiff.range } : {}), ...(pw ? { injectorPulseWidth: pw.range } : {}), ...(duty ? { injectorDuty: duty.range } : {}), ...(deadtime ? { injectorDeadtime: deadtime.range } : {}) }, { sampleIndices: scoped.sampleIndices, complete: scoped.complete, ...(lowPressure !== undefined ? { lowPressureThreshold: lowPressure } : {}), highDutyThreshold: optionNumber('highDuty', 90) });
        renderSummary([
          ['Scope', scoped.scope.label], ['Coverage', result.complete ? 'Complete' : 'Partial decoded'],
          ['Fuel pressure mean', numberText(result.fuelPressure?.mean)], ['Rail diff mean / min', `${numberText(result.railDifferential?.mean)} / ${numberText(result.railDifferential?.min)}`],
          ['Injector PW mean', numberText(result.injectorPulseWidth?.mean)], ['Injector duty mean / max', `${numberText(result.injectorDuty?.mean)} / ${numberText(result.injectorDuty?.max)}`],
          ['Deadtime mean', numberText(result.injectorDeadtime?.mean)], ['Low pressure events', String(result.lowPressureEvents.length)],
          ['High duty events', String(result.highDutyEvents.length)],
        ]);
        const pressureEvents = [
          ...result.lowPressureEvents.map((event) => ({ type: 'Low pressure', event })),
          ...result.highDutyEvents.map((event) => ({ type: 'High duty', event })),
        ];
        const rows = pressureEvents.map(({ type, event }, index) => [String(index + 1), type, timeText(event.startTimeMs), timeText(event.endTimeMs), `${event.durationMs.toFixed(0)} ms`, numberText(event.extremeValue)]);
        renderTable(
          'Pressure / injector threshold events',
          ['#', 'Type', 'Start', 'End', 'Duration', 'Extreme'],
          rows,
          eventNavigation(pressureEvents.map(({ event }) => event), 'Fuel / injector event'),
        );
      } else {
        const reference = traces.get('reference')!;
        const syncState = traces.get('syncState');
        const triggerError = traces.get('triggerError');
        const lossCounter = traces.get('lossCounter');
        const rpm = traces.get('rpm');
        const result = analyzeTriggerSync({ reference: reference.range, ...(syncState ? { syncState: syncState.range } : {}), ...(triggerError ? { triggerError: triggerError.range } : {}), ...(lossCounter ? { syncLossCounter: lossCounter.range } : {}), ...(rpm ? { rpm: rpm.range } : {}) }, { sampleIndices: scoped.sampleIndices, complete: scoped.complete, syncedMinimum: optionNumber('syncedMinimum', 1), triggerErrorThreshold: optionNumber('errorThreshold', 0) });
        renderSummary([
          ['Scope', scoped.scope.label], ['Coverage', result.complete ? 'Complete' : 'Partial decoded'],
          ['Events', String(result.events.length)], ['Sync state mean', numberText(result.syncState?.mean)],
          ['Trigger error max', numberText(result.triggerError?.max)], ['Loss counter max', numberText(result.syncLossCounter?.max)],
          ['RPM mean / max', `${numberText(result.rpm?.mean)} / ${numberText(result.rpm?.max)}`],
        ]);
        renderTable('Sync / trigger events', ['#', 'Reason', 'Start', 'End', 'Duration', 'Peak error', 'Loss Δ'], result.events.map((event, index) => [String(index + 1), event.reason, timeText(event.startTimeMs), timeText(event.endTimeMs), `${event.durationMs.toFixed(0)} ms`, numberText(event.peakError), numberText(event.lossCountDelta)]), eventNavigation(result.events, 'Trigger / sync event'));
      }
      empty.hidden = true;
      content.hidden = false;
    } catch (error) {
      empty.hidden = false;
      content.hidden = true;
      const strong = empty.querySelector('strong');
      if (strong) strong.textContent = error instanceof Error ? error.message : 'Analyzer configuration is invalid.';
    }
  };

  const rebuild = (): void => {
    const spec = SPECS[domain];
    field('title').textContent = `${spec.title} · Experimental`;
    field('description').textContent = spec.description;
    controls.replaceChildren();
    if (domain === 'idle') {
      const systemLabel = document.createElement('label');
      const systemCaption = document.createElement('span');
      systemCaption.textContent = 'Idle system';
      const systemSelect = document.createElement('select');
      systemSelect.dataset.role = 'idle-system';
      for (const entry of IDLE_SYSTEMS) systemSelect.add(new Option(entry.label, entry.value));
      const rememberedSystem = rememberedSelections.get('idle:system');
      systemSelect.value = rememberedSystem === 'dc-idle' ? 'rpm-control' : rememberedSystem ?? 'combined';
      systemSelect.addEventListener('change', () => { rememberedSelections.set('idle:system', systemSelect.value); rebuild(); });
      systemLabel.append(systemCaption, systemSelect);
      controls.append(systemLabel);
    }
    const idleSystem = domain === 'idle' ? currentIdleSystem() : 'combined';
    for (const role of spec.roles) {
      if (domain === 'idle' && !idleRoleRelevant(role, idleSystem)) continue;
      const label = document.createElement('label');
      const span = document.createElement('span');
      span.textContent = role.group ? `${role.label} · ${role.group}` : role.label;
      const select = document.createElement('select');
      select.dataset.role = role.key;
      select.add(new Option(role.required ? '(select channel)' : '(none)', ''));
      for (const channel of context.channels) select.add(new Option(channel.displayName || channel.sourceName, channel.id));
      const remembered = rememberedSelections.get(`${domain}:${role.key}`);
      if (remembered && [...select.options].some((option) => option.value === remembered)) {
        select.value = remembered;
      } else {
        const suggested = suggestAnalyzerChannel(domain, role.key, context.channels);
        if (suggested) {
          select.value = suggested.id;
          select.dataset.autoSelected = 'true';
          select.title = `Auto-selected ${suggested.displayName || suggested.sourceName}; choose another channel to override.`;
        }
      }
      select.addEventListener('change', () => {
        delete select.dataset.autoSelected;
        select.removeAttribute('title');
        rememberedSelections.set(`${domain}:${role.key}`, select.value);
        void analyzeCurrent();
      });
      label.append(span, select);
      controls.append(label);
    }
    const scopeLabel = document.createElement('label');
    const scopeCaption = document.createElement('span');
    scopeCaption.textContent = 'Scope';
    const scopeSelect = document.createElement('select');
    scopeSelect.dataset.role = 'scope';
    const rememberedScope = rememberedSelections.get(`${domain}:scope`) ?? 'full';
    populateAnalyzerScopeSelect(scopeSelect, context, rememberedScope);
    scopeSelect.addEventListener('change', () => { rememberedSelections.set(`${domain}:scope`, scopeSelect.value); void analyzeCurrent(); });
    scopeLabel.append(scopeCaption, scopeSelect);
    controls.append(scopeLabel);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Analyze';
    button.addEventListener('click', () => { void analyzeCurrent(); });
    controls.append(button);

    optionsGrid.replaceChildren();
    for (const option of spec.options) {
      const label = document.createElement('label');
      const span = document.createElement('span');
      span.textContent = option.label;
      const input = document.createElement('input');
      input.type = 'number';
      input.dataset.option = option.key;
      if (option.value !== undefined) input.value = option.value;
      if (option.placeholder) input.placeholder = option.placeholder;
      input.step = option.step ?? 'any';
      input.addEventListener('change', () => { updateIdleGuidance(); void analyzeCurrent(); });
      label.append(span, input);
      optionsGrid.append(label);
    }
    updateIdleGuidance();
    if (domain === 'fueling') ensureFuelingAnalyzerHelp(root);
    void analyzeCurrent();
  };

  return {
    element: root,
    setContext(nextContext) { context = nextContext; rebuild(); },
    setDomain(nextDomain) { domain = nextDomain; rebuild(); },
    refresh: () => { void analyzeCurrent(); },
  };
}
