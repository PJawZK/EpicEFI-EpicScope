import { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import {
  analyzeAeMapPredict,
  analyzeFueling,
  analyzeFuelPressureInjector,
  analyzeIdle,
  analyzeIgnition,
  analyzeTriggerSync,
} from '../../../../core/analysis/specialized-analyzers';
import type { LoggerAnalysisContext, LoggerAnalysisTraceContext } from './logger-page';

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

interface RoleSpec {
  readonly key: string;
  readonly label: string;
  readonly required?: boolean;
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

const SPECS: Record<SpecializedAnalyzerDomain, DomainSpec> = {
  idle: {
    title: 'Idle',
    description: 'Target/error, valve duty/bias/feed-forward, PID terms and sag/recovery evidence.',
    roles: [
      { key: 'rpm', label: 'RPM', required: true },
      { key: 'target', label: 'Idle target' },
      { key: 'valve', label: 'Idle valve duty' },
      { key: 'bias', label: 'DC bias' },
      { key: 'feedForward', label: 'Feed-forward' },
      { key: 'p', label: 'P term' },
      { key: 'i', label: 'I term' },
      { key: 'd', label: 'D term' },
    ],
    options: [
      { key: 'sag', label: 'Sag threshold RPM', value: '100', step: '1' },
      { key: 'settled', label: 'Settled band RPM', value: '40', step: '1' },
    ],
  },
  'ae-map': {
    title: 'AE / MAP Predict',
    description: 'Tip-in/decel events with MAP response, predicted MAP error and AFR excursion.',
    roles: [
      { key: 'tps', label: 'TPS', required: true },
      { key: 'map', label: 'Measured MAP' },
      { key: 'predictedMap', label: 'Predicted MAP' },
      { key: 'afr', label: 'AFR' },
    ],
    options: [
      { key: 'tpsThreshold', label: 'TPS delta threshold', value: '2', step: '0.1' },
      { key: 'window', label: 'Event window ms', value: '500', step: '10' },
    ],
  },
  fueling: {
    title: 'Fueling',
    description: 'AFR target/actual error, lean/rich evidence and optional VE context.',
    roles: [
      { key: 'actual', label: 'Actual AFR', required: true },
      { key: 'target', label: 'Target AFR' },
      { key: 've', label: 'VE / fuel value' },
    ],
    options: [{ key: 'deadband', label: 'AFR error deadband', value: '0.2', step: '0.05' }],
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

function channelLabel(trace: LoggerAnalysisTraceContext): string {
  return trace.channel.displayName || trace.channel.sourceName;
}

function numberText(value: number | undefined, precision = 3): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  return value.toFixed(precision).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function timeText(ms: number | undefined): string {
  return ms === undefined || !Number.isFinite(ms) ? '—' : `${(ms / 1000).toFixed(3)} s`;
}

export function createSpecializedAnalyzerSuiteView(): SpecializedAnalyzerSuiteController {
  let context: LoggerAnalysisContext = { traces: [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };
  let domain: SpecializedAnalyzerDomain = 'idle';
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
    <details class="specialized-analyzer-options" open>
      <summary>Analysis thresholds</summary>
      <div class="specialized-analyzer-options-grid"></div>
    </details>
    <div class="specialized-analyzer-empty">
      <strong>Select the required active channel and a valid scope.</strong>
      <span>Only already-decoded active Logger traces are used. Optional channels can remain unselected.</span>
    </div>
    <div class="specialized-analyzer-content" hidden>
      <div class="specialized-analyzer-summary"></div>
      <section class="specialized-analyzer-events">
        <header><strong data-specialized="events-title">Events</strong><span data-specialized="events-count">0</span></header>
        <div class="specialized-analyzer-table-wrap">
          <table class="specialized-analyzer-table"><thead></thead><tbody></tbody></table>
        </div>
      </section>
    </div>
  `;

  const controls = root.querySelector<HTMLElement>('.specialized-analyzer-controls');
  const optionsGrid = root.querySelector<HTMLElement>('.specialized-analyzer-options-grid');
  const empty = root.querySelector<HTMLElement>('.specialized-analyzer-empty');
  const content = root.querySelector<HTMLElement>('.specialized-analyzer-content');
  const summary = root.querySelector<HTMLElement>('.specialized-analyzer-summary');
  const tableHead = root.querySelector<HTMLTableSectionElement>('.specialized-analyzer-table thead');
  const tableBody = root.querySelector<HTMLTableSectionElement>('.specialized-analyzer-table tbody');
  if (!controls || !optionsGrid || !empty || !content || !summary || !tableHead || !tableBody) throw new Error('Specialized Analyzer suite structure is incomplete.');

  const field = (name: string): HTMLElement => {
    const node = root.querySelector<HTMLElement>(`[data-specialized="${name}"]`);
    if (!node) throw new Error(`Specialized Analyzer field missing: ${name}`);
    return node;
  };

  const traceFor = (id: string | undefined): LoggerAnalysisTraceContext | undefined =>
    id ? context.traces.find((trace) => trace.channel.id === id) : undefined;

  const roleSelect = (key: string): HTMLSelectElement | undefined =>
    controls.querySelector<HTMLSelectElement>(`select[data-role="${key}"]`) ?? undefined;

  const optionInput = (key: string): HTMLInputElement | undefined =>
    optionsGrid.querySelector<HTMLInputElement>(`input[data-option="${key}"]`) ?? undefined;

  const optionNumber = (key: string, fallback?: number): number | undefined => {
    const input = optionInput(key);
    if (!input || input.value.trim() === '') return fallback;
    const value = Number(input.value);
    return Number.isFinite(value) ? value : fallback;
  };

  const selectedScope = (): { label: string; startMs: number; endMs: number } | undefined => {
    const scope = controls.querySelector<HTMLSelectElement>('select[data-role="scope"]');
    if (!scope) return undefined;
    if (scope.value === 'ab') {
      if (context.aTimeMs === undefined || context.bTimeMs === undefined || context.aTimeMs === context.bTimeMs) return undefined;
      return { label: 'Current A/B', startMs: context.aTimeMs, endMs: context.bTimeMs };
    }
    if (!scope.value.startsWith('saved:')) return undefined;
    const index = Number(scope.value.slice(6));
    const saved = Number.isInteger(index) ? context.savedRanges[index] : undefined;
    return saved ? { label: saved.label, startMs: saved.startMs, endMs: saved.endMs } : undefined;
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
  };

  const renderTable = (title: string, headers: readonly string[], rows: readonly (readonly string[])[]): void => {
    field('events-title').textContent = title;
    field('events-count').textContent = rows.length.toLocaleString();
    const headerRow = document.createElement('tr');
    for (const header of headers) {
      const th = document.createElement('th');
      th.textContent = header;
      headerRow.append(th);
    }
    tableHead.replaceChildren(headerRow);
    tableBody.replaceChildren(...rows.slice(0, 200).map((values) => {
      const tr = document.createElement('tr');
      for (const value of values) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.append(td);
      }
      return tr;
    }));
  };

  const scopeForPrimary = (primary: LoggerAnalysisTraceContext, selected: readonly LoggerAnalysisTraceContext[]) => {
    const scope = selectedScope();
    if (!scope) return undefined;
    const startMs = Math.min(scope.startMs, scope.endMs);
    const endMs = Math.max(scope.startMs, scope.endMs);
    const channels = new Map([[primary.channel.id, { range: primary.range, complete: primary.complete }]]);
    const qualified = qualifyNumericSamples({
      referenceChannelId: primary.channel.id,
      channels,
      conditions: [],
      timeRange: { startMs, endMs },
    });
    const complete = qualified.complete && selected.every((trace) => trace.complete || numericRangeCoversTime(trace.range, startMs, endMs));
    return { scope, startMs, endMs, sampleIndices: qualified.eligibleSampleIndices, complete };
  };

  const analyzeCurrent = (): void => {
    const spec = SPECS[domain];
    const traces = new Map<string, LoggerAnalysisTraceContext>();
    for (const role of spec.roles) {
      const select = roleSelect(role.key);
      const trace = traceFor(select?.value);
      if (trace) traces.set(role.key, trace);
      if (role.required && !trace) {
        empty.hidden = false;
        content.hidden = true;
        return;
      }
    }
    const primary = traces.get(spec.roles.find((role) => role.required)?.key ?? '');
    if (!primary) {
      empty.hidden = false;
      content.hidden = true;
      return;
    }
    const scoped = scopeForPrimary(primary, [...traces.values()]);
    if (!scoped) {
      empty.hidden = false;
      content.hidden = true;
      return;
    }

    try {
      if (domain === 'idle') {
        const rpm = traces.get('rpm')!;
        const target = traces.get('target');
        const valve = traces.get('valve');
        const bias = traces.get('bias');
        const feedForward = traces.get('feedForward');
        const p = traces.get('p');
        const i = traces.get('i');
        const d = traces.get('d');
        const result = analyzeIdle({
          rpm: rpm.range,
          ...(target ? { target: target.range } : {}),
          ...(valve ? { valveDuty: valve.range } : {}),
          ...(bias ? { bias: bias.range } : {}),
          ...(feedForward ? { feedForward: feedForward.range } : {}),
          ...(p ? { pTerm: p.range } : {}),
          ...(i ? { iTerm: i.range } : {}),
          ...(d ? { dTerm: d.range } : {}),
        }, { sampleIndices: scoped.sampleIndices, complete: scoped.complete, sagThresholdRpm: optionNumber('sag', 100), settledBandRpm: optionNumber('settled', 40) });
        renderSummary([
          ['Scope', scoped.scope.label], ['Coverage', result.complete ? 'Complete' : 'Partial decoded'],
          ['RPM mean', numberText(result.rpm.mean)], ['Target mean', numberText(result.target?.mean)],
          ['Mean error', numberText(result.tracking?.meanError)], ['MAE', numberText(result.tracking?.meanAbsoluteError)],
          ['Valve mean', numberText(result.valveDuty?.mean)], ['Bias mean', numberText(result.bias?.mean)],
          ['Feed-forward mean', numberText(result.feedForward?.mean)], ['P / I / D mean', `${numberText(result.pTerm?.mean)} / ${numberText(result.iTerm?.mean)} / ${numberText(result.dTerm?.mean)}`],
          ['Sag events', String(result.sagEvents.length)], ['Input samples', result.rpm.inputSampleCount.toLocaleString()],
        ]);
        renderTable('Sag / recovery events', ['#', 'Start', 'End', 'Duration', 'Min error RPM', 'Recovery'], result.sagEvents.map((event, index) => [String(index + 1), timeText(event.startTimeMs), timeText(event.endTimeMs), `${event.durationMs.toFixed(0)} ms`, numberText(event.minimumErrorRpm), event.recoveryMs === undefined ? '—' : `${event.recoveryMs.toFixed(0)} ms`]));
      } else if (domain === 'ae-map') {
        const tps = traces.get('tps')!;
        const map = traces.get('map');
        const predicted = traces.get('predictedMap');
        const afr = traces.get('afr');
        const result = analyzeAeMapPredict({ tps: tps.range, ...(map ? { map: map.range } : {}), ...(predicted ? { predictedMap: predicted.range } : {}), ...(afr ? { afr: afr.range } : {}) }, { sampleIndices: scoped.sampleIndices, complete: scoped.complete, tpsDeltaThreshold: optionNumber('tpsThreshold', 2), eventWindowMs: optionNumber('window', 500) });
        const tipIns = result.events.filter((event) => event.direction === 'tip-in').length;
        renderSummary([
          ['Scope', scoped.scope.label], ['Coverage', result.complete ? 'Complete' : 'Partial decoded'],
          ['Events', String(result.events.length)], ['Tip-in / decel', `${tipIns} / ${result.events.length - tipIns}`],
          ['TPS mean', numberText(result.tps.mean)], ['MAP mean', numberText(result.map?.mean)],
          ['Predicted MAP mean', numberText(result.predictedMap?.mean)], ['AFR mean', numberText(result.afr?.mean)],
        ]);
        renderTable('Transient events', ['#', 'Type', 'Start', 'Duration', 'TPS Δ', 'MAP Δ', 'Predict error', 'AFR lean', 'AFR rich'], result.events.map((event, index) => [String(index + 1), event.direction, timeText(event.startTimeMs), `${event.durationMs.toFixed(0)} ms`, numberText(event.tpsDelta), numberText(event.mapDelta), numberText(event.predictionErrorAtEnd), numberText(event.afrLeanExcursion), numberText(event.afrRichExcursion)]));
      } else if (domain === 'fueling') {
        const actual = traces.get('actual')!;
        const target = traces.get('target');
        const ve = traces.get('ve');
        const result = analyzeFueling({ actualAfr: actual.range, ...(target ? { targetAfr: target.range } : {}), ...(ve ? { ve: ve.range } : {}) }, { sampleIndices: scoped.sampleIndices, complete: scoped.complete, errorDeadband: optionNumber('deadband', 0.2) });
        renderSummary([
          ['Scope', scoped.scope.label], ['Coverage', result.complete ? 'Complete' : 'Partial decoded'],
          ['Actual AFR mean', numberText(result.actual.mean)], ['Target AFR mean', numberText(result.target?.mean)],
          ['Mean error', numberText(result.tracking?.meanError)], ['MAE', numberText(result.tracking?.meanAbsoluteError)],
          ['Max lean error', numberText(result.tracking?.maxPositiveError)], ['Max rich error', numberText(result.tracking?.maxNegativeError)],
          ['Lean samples', result.leanSampleCount.toLocaleString()], ['Rich samples', result.richSampleCount.toLocaleString()],
          ['VE mean', numberText(result.ve?.mean)], ['Valid AFR samples', result.actual.validSampleCount.toLocaleString()],
        ]);
        renderTable('Fueling evidence', ['Metric', 'Value'], [
          ['Invalid AFR samples', result.actual.invalidSampleCount.toLocaleString()],
          ['Unavailable AFR samples', result.actual.unavailableSampleCount.toLocaleString()],
          ['Tracking invalid', (result.tracking?.invalidSampleCount ?? 0).toLocaleString()],
          ['Tracking unavailable', (result.tracking?.unavailableSampleCount ?? 0).toLocaleString()],
        ]);
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
        renderTable('Knock events', ['#', 'Start', 'End', 'Duration', 'Peak knock', 'Advance @ peak', 'Retard @ peak'], result.knockEvents.map((event, index) => [String(index + 1), timeText(event.startTimeMs), timeText(event.endTimeMs), `${event.durationMs.toFixed(0)} ms`, numberText(event.peakKnock), numberText(event.advanceAtPeak), numberText(event.retardAtPeak)]));
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
        const rows = [
          ...result.lowPressureEvents.map((event, index) => [String(index + 1), 'Low pressure', timeText(event.startTimeMs), timeText(event.endTimeMs), `${event.durationMs.toFixed(0)} ms`, numberText(event.extremeValue)]),
          ...result.highDutyEvents.map((event, index) => [String(index + 1), 'High duty', timeText(event.startTimeMs), timeText(event.endTimeMs), `${event.durationMs.toFixed(0)} ms`, numberText(event.extremeValue)]),
        ];
        renderTable('Pressure / injector threshold events', ['#', 'Type', 'Start', 'End', 'Duration', 'Extreme'], rows);
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
        renderTable('Sync / trigger events', ['#', 'Reason', 'Start', 'End', 'Duration', 'Peak error', 'Loss Δ'], result.events.map((event, index) => [String(index + 1), event.reason, timeText(event.startTimeMs), timeText(event.endTimeMs), `${event.durationMs.toFixed(0)} ms`, numberText(event.peakError), numberText(event.lossCountDelta)]));
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
    for (const role of spec.roles) {
      const label = document.createElement('label');
      const span = document.createElement('span');
      span.textContent = role.label;
      const select = document.createElement('select');
      select.dataset.role = role.key;
      if (!role.required) select.add(new Option('(none)', ''));
      for (const trace of context.traces) select.add(new Option(channelLabel(trace), trace.channel.id));
      const remembered = rememberedSelections.get(`${domain}:${role.key}`);
      if (remembered && [...select.options].some((option) => option.value === remembered)) select.value = remembered;
      else if (role.required && context.traces[0]) select.value = context.traces[0].channel.id;
      select.addEventListener('change', () => { rememberedSelections.set(`${domain}:${role.key}`, select.value); analyzeCurrent(); });
      label.append(span, select);
      controls.append(label);
    }
    const scopeLabel = document.createElement('label');
    const scopeCaption = document.createElement('span');
    scopeCaption.textContent = 'Scope';
    const scopeSelect = document.createElement('select');
    scopeSelect.dataset.role = 'scope';
    if (context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs) scopeSelect.add(new Option('Current A/B', 'ab'));
    context.savedRanges.forEach((saved, index) => scopeSelect.add(new Option(saved.label, `saved:${index}`)));
    const rememberedScope = rememberedSelections.get(`${domain}:scope`);
    if (rememberedScope && [...scopeSelect.options].some((option) => option.value === rememberedScope)) scopeSelect.value = rememberedScope;
    scopeSelect.addEventListener('change', () => { rememberedSelections.set(`${domain}:scope`, scopeSelect.value); analyzeCurrent(); });
    scopeLabel.append(scopeCaption, scopeSelect);
    controls.append(scopeLabel);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Analyze';
    button.addEventListener('click', analyzeCurrent);
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
      input.addEventListener('change', analyzeCurrent);
      label.append(span, input);
      optionsGrid.append(label);
    }
    analyzeCurrent();
  };

  return {
    element: root,
    setContext(nextContext) { context = nextContext; rebuild(); },
    setDomain(nextDomain) { domain = nextDomain; rebuild(); },
    refresh: analyzeCurrent,
  };
}
