import { analyzeIgnitionBehavior, type IgnitionCorrectionEvent, type IgnitionTimingStepEvent } from '../../../../core/analysis/ignition-behavior-analyzer';
import { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import type { ChannelDefinition } from '../../../../core/log-model/log-types';
import { addInlineHelpButton, showInlineHelpPopover, type InlineHelpEntry } from '../components/inline-help';
import type { LoggerAnalysisContext, LoggerAnalysisTraceContext } from './logger-page';
import { analyzerScopeBounds, populateAnalyzerScopeSelect, selectedAnalyzerScope } from './analyzer-scope';
import { renderAlignedAnalyzerEvidence, type AnalyzerEvidenceSeries } from './analyzer-event-evidence';

export interface IgnitionAnalyzerController {
  readonly element: HTMLElement;
  setContext(context: LoggerAnalysisContext): void;
  refresh(): void;
}

type RoleKey = 'advance' | 'retard' | 'dwell' | 'rpm' | 'load';

interface RoleSpec {
  readonly key: RoleKey;
  readonly label: string;
  readonly required?: boolean;
  readonly help: InlineHelpEntry;
}

interface OptionSpec {
  readonly key: 'timingStepThreshold' | 'correctionThreshold' | 'maxGapMs';
  readonly label: string;
  readonly value: string;
  readonly step: string;
  readonly help: InlineHelpEntry;
}

const ROLES: readonly RoleSpec[] = [
  {
    key: 'advance',
    label: 'Ignition advance',
    required: true,
    help: { title: 'Ignition advance', text: 'Primary timing trace. EpicScope summarizes its range and adjacent-sample changes, but does not decide whether the timing value is safe or optimal.' },
  },
  {
    key: 'retard',
    label: 'Retard / correction',
    help: { title: 'Retard / correction', text: 'Optional ECU timing-correction channel. Nonzero activity is grouped for inspection without assigning a cause. The selected channel definition remains authoritative.' },
  },
  {
    key: 'dwell',
    label: 'Ignition dwell',
    help: { title: 'Ignition dwell', text: 'Optional coil dwell/on-time context. EpicScope reports its observed range and values around timing events. Zero or negative values are counted for inspection, not automatically classified as a fault.' },
  },
  {
    key: 'rpm',
    label: 'RPM',
    help: { title: 'RPM', text: 'Optional engine-speed context attached to timing-step and correction events. It helps show where an observed timing change occurred.' },
  },
  {
    key: 'load',
    label: 'Load / MAP',
    help: { title: 'Load / MAP', text: 'Optional engine-load or manifold-pressure context attached to ignition events. Select the load channel that best represents the active ignition strategy.' },
  },
];

const OPTIONS: readonly OptionSpec[] = [
  {
    key: 'timingStepThreshold',
    label: 'Large timing step threshold',
    value: '5',
    step: '0.1',
    help: { title: 'Large timing step threshold', text: 'Minimum absolute adjacent-sample ignition-advance change reported as a timing-step event. It is a visibility threshold, not a safe/unsafe limit.' },
  },
  {
    key: 'correctionThreshold',
    label: 'Correction activity threshold',
    value: '0.5',
    step: '0.1',
    help: { title: 'Correction activity threshold', text: 'Minimum absolute Retard / correction magnitude grouped as ECU correction activity. Use a value appropriate for the selected channel resolution and units.' },
  },
  {
    key: 'maxGapMs',
    label: 'Max transition gap ms',
    value: '100',
    step: '10',
    help: { title: 'Maximum transition gap', text: 'Adjacent timing samples separated by more than this time are not compared. This prevents log gaps or sparse decoding from looking like sudden ignition changes.' },
  },
];

const SUMMARY_HELP: Readonly<Record<string, InlineHelpEntry>> = {
  'Advance mean': { title: 'Advance mean', text: 'Average selected ignition advance. Use it as scope context; it can hide large movement across RPM/load.' },
  'Advance min / max': { title: 'Advance minimum / maximum', text: 'Observed ignition-advance range. A wide range can be normal when operating conditions change, so inspect event context rather than treating spread as a fault.' },
  'Advance step P95 / max': { title: 'Advance step P95 / maximum', text: '95th-percentile and largest absolute adjacent-sample ignition-advance changes after source gaps are excluded. This describes timing movement; it does not diagnose combustion.' },
  'Large timing steps': { title: 'Large timing steps', text: 'Number of adjacent advance changes at or above the configured timing-step threshold.' },
  'Correction events': { title: 'Correction events', text: 'Grouped periods where the selected Retard / correction channel exceeds the configured absolute activity threshold. No cause is inferred.' },
  'Dwell mean / range': { title: 'Dwell mean / range', text: 'Average plus minimum/maximum selected dwell. It is observational coil-command context, not a universal dwell recommendation.' },
};

const EVIDENCE_LIMIT = 80;

function numberText(value: number | undefined, precision = 3): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  return value.toFixed(precision).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function signedNumber(value: number | undefined): string {
  if (value === undefined) return '—';
  return `${value > 0 ? '+' : ''}${numberText(value)}`;
}

function timeText(ms: number | undefined): string {
  return ms === undefined || !Number.isFinite(ms) ? '—' : `${(ms / 1000).toFixed(3)} s`;
}

function valueWithUnit(value: number | undefined, unit: string | undefined): string {
  const text = numberText(value);
  return text === '—' || !unit ? text : `${text} ${unit}`;
}

function rangeWithUnit(min: number | undefined, max: number | undefined, unit: string | undefined): string {
  if (min === undefined || max === undefined) return '—';
  const suffix = unit ? ` ${unit}` : '';
  return `${numberText(min)} / ${numberText(max)}${suffix}`;
}

function normalizedIdentity(channel: ChannelDefinition): string {
  return `${channel.id} ${channel.sourceName} ${channel.displayName}`.replace(/[_:./\\-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function localSuggestion(key: RoleKey, channels: readonly ChannelDefinition[]): ChannelDefinition | undefined {
  const patterns: Readonly<Record<RoleKey, readonly RegExp[]>> = {
    advance: [/ignition.*advance/i, /spark.*advance/i, /ign.*adv/i],
    retard: [/ignition.*retard/i, /spark.*retard/i, /timing.*correction/i, /ignition.*correction/i, /(^|\b)retard(\b|$)/i],
    dwell: [/ignition.*dwell/i, /spark.*dwell/i, /coil.*dwell/i, /(^|\b)dwell(\b|$)/i],
    rpm: [/^rpm(value)?$/i, /(^|\b)rpm(\b|$)/i],
    load: [/^map(value)?$/i, /manifold.*pressure/i, /ignition.*load/i, /engine.*load/i, /ve.*table.*y.*axis/i],
  };
  const exact: Readonly<Partial<Record<RoleKey, readonly string[]>>> = {
    rpm: ['ini:RPMValue', 'RPMValue'],
    load: ['ini:MAPValue', 'MAPValue', 'ini:veTableYAxis', 'veTableYAxis'],
  };
  let best: ChannelDefinition | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const channel of channels) {
    const identities = [channel.id, channel.sourceName, channel.displayName].map((value) => value.toLowerCase());
    const exactIndex = exact[key]?.findIndex((value) => identities.includes(value.toLowerCase())) ?? -1;
    let score = exactIndex >= 0 ? 1000 - exactIndex : Number.NEGATIVE_INFINITY;
    if (exactIndex < 0) {
      const identity = normalizedIdentity(channel);
      patterns[key].forEach((pattern, index) => {
        pattern.lastIndex = 0;
        if (pattern.test(identity)) score = Math.max(score, 100 - index * 12);
      });
      if (key === 'retard' && /knock/i.test(identity)) score = Number.NEGATIVE_INFINITY;
      if (key === 'dwell' && /table|target|crank|axis|bin/i.test(identity)) score = Number.NEGATIVE_INFINITY;
      if (key === 'load' && /target|predict|estimate/i.test(identity)) score = Number.NEGATIVE_INFINITY;
    }
    if (score > bestScore) { best = channel; bestScore = score; }
  }
  return Number.isFinite(bestScore) ? best : undefined;
}

type CombinedEvent =
  | { readonly kind: 'Timing step'; readonly event: IgnitionTimingStepEvent }
  | { readonly kind: 'Correction'; readonly event: IgnitionCorrectionEvent };

export function createIgnitionAnalyzerView(): IgnitionAnalyzerController {
  let context: LoggerAnalysisContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };
  let analysisGeneration = 0;
  const rememberedSelections = new Map<string, string>();

  const root = document.createElement('section');
  root.className = 'specialized-analyzer-view ignition-behavior-analyzer-view';
  root.hidden = true;
  root.innerHTML = `
    <div class="specialized-analyzer-banner">
      <div><strong data-specialized="title">Ignition behavior · Experimental</strong><span>Advance movement, dwell and ECU correction context without knock inference.</span></div>
      <span class="specialized-analyzer-badge">EXP</span>
    </div>
    <div class="specialized-analyzer-controls"></div>
    <div class="specialized-analyzer-guidance">
      <strong>Observational ignition evidence</strong>
      <span data-ignition="guidance"></span>
    </div>
    <details class="specialized-analyzer-options">
      <summary>Analysis thresholds</summary>
      <div class="specialized-analyzer-options-grid"></div>
    </details>
    <div class="specialized-analyzer-empty">
      <strong>Select Ignition advance and a valid scope.</strong>
      <span>Retard/correction, dwell, RPM and load are optional context. This analyzer does not infer knock or timing safety.</span>
    </div>
    <div class="specialized-analyzer-content" hidden>
      <div class="specialized-analyzer-summary"></div>
      <details class="specialized-analyzer-options ignition-behavior-details">
        <summary>More details</summary>
        <div class="specialized-analyzer-table-wrap">
          <table class="specialized-analyzer-table ignition-behavior-details-table"><tbody></tbody></table>
        </div>
      </details>
      <section class="specialized-analyzer-evidence" hidden>
        <header><div><strong data-ignition="evidence-title">Ignition behavior · aligned evidence</strong><span data-ignition="evidence-note"></span></div><button type="button" data-ignition="evidence-all">All events</button></header>
        <canvas class="specialized-analyzer-evidence-canvas" aria-label="Ignition event-aligned evidence graph"></canvas>
      </section>
      <section class="specialized-analyzer-events">
        <header><strong>Observed ignition events</strong><span data-ignition="events-count">0</span></header>
        <div class="specialized-analyzer-table-wrap">
          <table class="specialized-analyzer-table ignition-behavior-events-table"><thead></thead><tbody></tbody></table>
        </div>
      </section>
    </div>
  `;

  const controls = root.querySelector<HTMLElement>('.specialized-analyzer-controls');
  const optionsGrid = root.querySelector<HTMLElement>('.specialized-analyzer-options-grid');
  const empty = root.querySelector<HTMLElement>('.specialized-analyzer-empty');
  const content = root.querySelector<HTMLElement>('.specialized-analyzer-content');
  const summary = root.querySelector<HTMLElement>('.specialized-analyzer-summary');
  const detailsBody = root.querySelector<HTMLTableSectionElement>('.ignition-behavior-details-table tbody');
  const evidence = root.querySelector<HTMLElement>('.specialized-analyzer-evidence');
  const evidenceCanvas = root.querySelector<HTMLCanvasElement>('.specialized-analyzer-evidence-canvas');
  const evidenceAll = root.querySelector<HTMLButtonElement>('[data-ignition="evidence-all"]');
  const eventsHead = root.querySelector<HTMLTableSectionElement>('.ignition-behavior-events-table thead');
  const eventsBody = root.querySelector<HTMLTableSectionElement>('.ignition-behavior-events-table tbody');
  const guidance = root.querySelector<HTMLElement>('[data-ignition="guidance"]');
  const eventsCount = root.querySelector<HTMLElement>('[data-ignition="events-count"]');
  const evidenceNote = root.querySelector<HTMLElement>('[data-ignition="evidence-note"]');
  if (!controls || !optionsGrid || !empty || !content || !summary || !detailsBody || !evidence || !evidenceCanvas || !evidenceAll || !eventsHead || !eventsBody || !guidance || !eventsCount || !evidenceNote) {
    throw new Error('Ignition Analyzer structure is incomplete.');
  }

  const roleSelect = (key: RoleKey): HTMLSelectElement | undefined => controls.querySelector<HTMLSelectElement>(`select[data-role="${key}"]`) ?? undefined;
  const optionInput = (key: OptionSpec['key']): HTMLInputElement | undefined => optionsGrid.querySelector<HTMLInputElement>(`input[data-option="${key}"]`) ?? undefined;
  const optionNumber = (key: OptionSpec['key'], fallback: number): number => {
    const value = Number(optionInput(key)?.value);
    return Number.isFinite(value) ? value : fallback;
  };

  const renderSummary = (items: readonly [string, string][]): void => {
    summary.replaceChildren(...items.map(([label, value]) => {
      const card = document.createElement('div');
      const caption = document.createElement('span');
      caption.textContent = label;
      const help = SUMMARY_HELP[label];
      if (help) addInlineHelpButton(caption, help, showInlineHelpPopover);
      const strong = document.createElement('strong');
      strong.textContent = value;
      card.append(caption, strong);
      return card;
    }));
  };

  const renderDetails = (rows: readonly [string, string][]): void => {
    detailsBody.replaceChildren(...rows.map(([label, value]) => {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.textContent = label;
      const td = document.createElement('td');
      td.textContent = value;
      tr.append(th, td);
      return tr;
    }));
  };

  let restoreAllEvidence: (() => void) | undefined;
  evidenceAll.addEventListener('click', () => restoreAllEvidence?.());

  const renderEvidence = (
    series: readonly AnalyzerEvidenceSeries[],
    events: readonly CombinedEvent[],
  ): void => {
    if (!series.length || !events.length) {
      evidence.hidden = true;
      restoreAllEvidence = undefined;
      return;
    }
    evidence.hidden = false;
    const evidenceEvents = events.slice(0, EVIDENCE_LIMIT).map(({ event }) => ({ startTimeMs: event.startTimeMs, endTimeMs: event.endTimeMs }));
    const renderAll = (): void => {
      evidenceNote.textContent = events.length > EVIDENCE_LIMIT
        ? `First ${EVIDENCE_LIMIT} of ${events.length.toLocaleString()} events · median + 10–90% envelope · t=0 onset`
        : `${events.length.toLocaleString()} event${events.length === 1 ? '' : 's'} · median + 10–90% envelope · t=0 onset`;
      renderAlignedAnalyzerEvidence(evidenceCanvas, series, evidenceEvents, 200, 500);
    };
    restoreAllEvidence = renderAll;
    renderAll();
  };

  const selectEvidenceEvent = (event: CombinedEvent, index: number, series: readonly AnalyzerEvidenceSeries[]): void => {
    const duration = event.event.endTimeMs - event.event.startTimeMs;
    evidence.hidden = false;
    evidenceNote.textContent = `Event ${index + 1} · ${event.kind} · t=0 onset`;
    renderAlignedAnalyzerEvidence(evidenceCanvas, series, [{ startTimeMs: event.event.startTimeMs, endTimeMs: event.event.endTimeMs }], 200, Math.max(400, duration + 250));
  };

  const renderEvents = (events: readonly CombinedEvent[], series: readonly AnalyzerEvidenceSeries[]): void => {
    eventsCount.textContent = events.length.toLocaleString();
    const headers = ['#', 'Type', 'Start', 'Duration', 'Advance Δ', 'Correction', 'Advance', 'Dwell', 'RPM', 'Load'];
    const headerRow = document.createElement('tr');
    for (const label of headers) {
      const th = document.createElement('th');
      th.textContent = label;
      headerRow.append(th);
    }
    eventsHead.replaceChildren(headerRow);
    eventsBody.replaceChildren(...events.slice(0, 200).map((entry, index) => {
      const event = entry.event;
      const isStep = entry.kind === 'Timing step';
      const step = isStep ? event as IgnitionTimingStepEvent : undefined;
      const correction = isStep ? undefined : event as IgnitionCorrectionEvent;
      const values = [
        String(index + 1),
        entry.kind,
        timeText(event.startTimeMs),
        `${event.durationMs.toFixed(0)} ms`,
        step ? signedNumber(step.deltaAdvance) : '—',
        step ? numberText(step.retardOrCorrection) : signedNumber(correction?.peakValue),
        step ? numberText(step.advanceAfter) : numberText(correction?.advanceAtPeak),
        step ? numberText(step.dwell) : numberText(correction?.dwellAtPeak),
        step ? numberText(step.rpm, 0) : numberText(correction?.rpmAtPeak, 0),
        step ? numberText(step.load) : numberText(correction?.loadAtPeak),
      ];
      const tr = document.createElement('tr');
      tr.className = 'specialized-analyzer-event-row--navigable';
      tr.tabIndex = 0;
      tr.title = context.openSamplesInLogger ? 'Click to inspect · double-click or Enter to open in Logger' : 'Click to inspect';
      for (const value of values) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.append(td);
      }
      const select = (): void => {
        eventsBody.querySelectorAll('tr').forEach((row) => row.classList.remove('specialized-analyzer-event-row--selected'));
        tr.classList.add('specialized-analyzer-event-row--selected');
        selectEvidenceEvent(entry, index, series);
      };
      const open = (): void => context.openSamplesInLogger?.({
        sampleIndices: event.startSampleIndex === event.endSampleIndex ? [event.startSampleIndex] : [event.startSampleIndex, event.endSampleIndex],
        timeMs: event.startTimeMs === event.endTimeMs ? [event.startTimeMs] : [event.startTimeMs, event.endTimeMs],
        label: `${entry.kind} ${index + 1}`,
      });
      tr.addEventListener('click', select);
      if (context.openSamplesInLogger) tr.addEventListener('dblclick', open);
      tr.addEventListener('keydown', (keyboardEvent) => {
        if (keyboardEvent.key === 'Enter' && context.openSamplesInLogger) { keyboardEvent.preventDefault(); open(); }
        else if (keyboardEvent.key === ' ') { keyboardEvent.preventDefault(); select(); }
      });
      return tr;
    }));
  };

  const selectedScope = () => {
    const select = controls.querySelector<HTMLSelectElement>('select[data-role="scope"]');
    return select ? selectedAnalyzerScope(select, context) : undefined;
  };

  const scopeForPrimary = (primary: LoggerAnalysisTraceContext, selected: readonly LoggerAnalysisTraceContext[]) => {
    const scope = selectedScope();
    if (!scope) return undefined;
    const { startMs, endMs } = analyzerScopeBounds(scope);
    const qualified = qualifyNumericSamples({
      referenceChannelId: primary.channel.id,
      channels: new Map([[primary.channel.id, { range: primary.range, complete: primary.complete }]]),
      conditions: [],
      ...(startMs !== undefined && endMs !== undefined ? { timeRange: { startMs, endMs } } : {}),
    });
    const complete = qualified.complete && selected.every((trace) => {
      if (startMs === undefined || endMs === undefined) return trace.complete;
      return trace.complete || numericRangeCoversTime(trace.range, startMs, endMs);
    });
    return { scope, startMs, endMs, sampleIndices: qualified.eligibleSampleIndices, complete };
  };

  const updateGuidance = (): void => {
    guidance.textContent = `Large timing steps are adjacent advance changes ≥ ${numberText(optionNumber('timingStepThreshold', 5))}; correction events use |Retard / correction| > ${numberText(optionNumber('correctionThreshold', 0.5))}. Sample pairs separated by more than ${numberText(optionNumber('maxGapMs', 100), 0)} ms are not compared. These are observational filters only—EpicScope does not infer knock, timing safety, or the cause of an ECU correction.`;
  };

  const analyzeCurrent = async (): Promise<void> => {
    const generation = ++analysisGeneration;
    const advanceId = roleSelect('advance')?.value;
    const scope = selectedScope();
    if (!advanceId || !scope) {
      empty.hidden = false;
      content.hidden = true;
      return;
    }
    const selected = new Map<RoleKey, string>();
    for (const role of ROLES) {
      const id = roleSelect(role.key)?.value;
      if (id) selected.set(role.key, id);
    }
    const { startMs, endMs } = analyzerScopeBounds(scope);
    const loaded = await context.loadTraces([...selected.values()], startMs, endMs);
    if (generation !== analysisGeneration) return;
    const byId = new Map(loaded.map((trace) => [trace.channel.id, trace]));
    const traces = new Map<RoleKey, LoggerAnalysisTraceContext>();
    for (const [key, id] of selected) {
      const trace = byId.get(id);
      if (trace) traces.set(key, trace);
    }
    const advance = traces.get('advance');
    if (!advance) { empty.hidden = false; content.hidden = true; return; }
    const scoped = scopeForPrimary(advance, [...traces.values()]);
    if (!scoped) { empty.hidden = false; content.hidden = true; return; }

    try {
      const retard = traces.get('retard');
      const dwell = traces.get('dwell');
      const rpm = traces.get('rpm');
      const load = traces.get('load');
      const result = analyzeIgnitionBehavior({
        advance: advance.range,
        ...(retard ? { retardOrCorrection: retard.range } : {}),
        ...(dwell ? { dwell: dwell.range } : {}),
        ...(rpm ? { rpm: rpm.range } : {}),
        ...(load ? { load: load.range } : {}),
      }, {
        sampleIndices: scoped.sampleIndices,
        complete: scoped.complete,
        timingStepThreshold: optionNumber('timingStepThreshold', 5),
        correctionThreshold: optionNumber('correctionThreshold', 0.5),
        maxTransitionGapMs: optionNumber('maxGapMs', 100),
      });

      const advanceUnit = advance.channel.unit;
      const dwellUnit = dwell?.channel.unit;
      renderSummary([
        ['Advance mean', valueWithUnit(result.advance.mean, advanceUnit)],
        ['Advance min / max', rangeWithUnit(result.advance.min, result.advance.max, advanceUnit)],
        ['Advance step P95 / max', `${valueWithUnit(result.transitions.p95AbsoluteStep, advanceUnit)} / ${valueWithUnit(result.transitions.maxAbsoluteStep, advanceUnit)}`],
        ['Large timing steps', result.timingStepEvents.length.toLocaleString()],
        ['Correction events', retard ? result.correctionEvents.length.toLocaleString() : 'No channel selected'],
        ['Dwell mean / range', dwell ? `${valueWithUnit(result.dwell?.mean, dwellUnit)} · ${rangeWithUnit(result.dwell?.min, result.dwell?.max, dwellUnit)}` : 'No channel selected'],
      ]);

      renderDetails([
        ['Scope', scoped.scope.label],
        ['Coverage', result.complete ? 'Complete' : 'Partial decoded'],
        ['Valid advance / input', `${result.advance.validSampleCount.toLocaleString()} / ${result.advance.inputSampleCount.toLocaleString()}`],
        ['Transitions compared', result.transitions.transitionCount.toLocaleString()],
        ['Mean absolute advance step', valueWithUnit(result.transitions.meanAbsoluteStep, advanceUnit)],
        ['Gap pairs skipped', result.transitions.skippedGapCount.toLocaleString()],
        ['Invalid / unavailable pairs', result.transitions.invalidOrUnavailablePairCount.toLocaleString()],
        ['Retard / correction mean', retard ? valueWithUnit(result.retardOrCorrection?.mean, retard.channel.unit) : 'Not selected'],
        ['Retard / correction min / max', retard ? rangeWithUnit(result.retardOrCorrection?.min, result.retardOrCorrection?.max, retard.channel.unit) : 'Not selected'],
        ['Dwell valid / input', dwell ? `${(result.dwell?.validSampleCount ?? 0).toLocaleString()} / ${(result.dwell?.inputSampleCount ?? 0).toLocaleString()}` : 'Not selected'],
        ['Dwell ≤ 0 samples', dwell ? result.nonPositiveDwellSampleCount.toLocaleString() : 'Not selected'],
        ['RPM mean / max', rpm ? `${numberText(result.rpm?.mean, 0)} / ${numberText(result.rpm?.max, 0)}` : 'Not selected'],
        ['Load mean / max', load ? `${numberText(result.load?.mean)} / ${numberText(result.load?.max)}` : 'Not selected'],
      ]);

      const combinedEvents: CombinedEvent[] = [
        ...result.timingStepEvents.map((event) => ({ kind: 'Timing step' as const, event })),
        ...result.correctionEvents.map((event) => ({ kind: 'Correction' as const, event })),
      ].sort((left, right) => left.event.startTimeMs - right.event.startTimeMs || left.event.endTimeMs - right.event.endTimeMs);
      const series: AnalyzerEvidenceSeries[] = [
        { label: 'Ignition advance', range: advance.range },
        ...(retard ? [{ label: 'Retard / correction', range: retard.range }] : []),
        ...(dwell ? [{ label: 'Ignition dwell', range: dwell.range }] : []),
        ...(rpm ? [{ label: 'RPM', range: rpm.range }] : []),
        ...(load ? [{ label: 'Load / MAP', range: load.range }] : []),
      ];
      renderEvidence(series, combinedEvents);
      renderEvents(combinedEvents, series);
      empty.hidden = true;
      content.hidden = false;
    } catch (error) {
      empty.hidden = false;
      content.hidden = true;
      const strong = empty.querySelector('strong');
      if (strong) strong.textContent = error instanceof Error ? error.message : 'Ignition Analyzer configuration is invalid.';
    }
  };

  const rebuild = (): void => {
    controls.replaceChildren();
    for (const role of ROLES) {
      const label = document.createElement('label');
      const caption = document.createElement('span');
      caption.textContent = role.label;
      addInlineHelpButton(caption, role.help, showInlineHelpPopover);
      const select = document.createElement('select');
      select.dataset.role = role.key;
      select.add(new Option(role.required ? '(select channel)' : '(none)', ''));
      for (const channel of context.channels) select.add(new Option(channel.displayName || channel.sourceName, channel.id));
      const remembered = rememberedSelections.get(role.key);
      if (remembered && [...select.options].some((option) => option.value === remembered)) {
        select.value = remembered;
      } else {
        const suggested = localSuggestion(role.key, context.channels);
        if (suggested) {
          select.value = suggested.id;
          select.dataset.autoSelected = 'true';
          select.title = `Auto-selected ${suggested.displayName || suggested.sourceName}; choose another channel to override.`;
        }
      }
      select.addEventListener('change', () => {
        delete select.dataset.autoSelected;
        select.removeAttribute('title');
        rememberedSelections.set(role.key, select.value);
        void analyzeCurrent();
      });
      label.append(caption, select);
      controls.append(label);
    }

    const scopeLabel = document.createElement('label');
    const scopeCaption = document.createElement('span');
    scopeCaption.textContent = 'Scope';
    addInlineHelpButton(scopeCaption, { title: 'Scope', text: 'Chooses the log interval analyzed: Full Log, Current A/B, or a Saved Range.' }, showInlineHelpPopover);
    const scopeSelect = document.createElement('select');
    scopeSelect.dataset.role = 'scope';
    populateAnalyzerScopeSelect(scopeSelect, context, rememberedSelections.get('scope') ?? 'full');
    scopeSelect.addEventListener('change', () => { rememberedSelections.set('scope', scopeSelect.value); void analyzeCurrent(); });
    scopeLabel.append(scopeCaption, scopeSelect);
    controls.append(scopeLabel);

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Analyze';
    button.addEventListener('click', () => { void analyzeCurrent(); });
    controls.append(button);

    optionsGrid.replaceChildren();
    for (const option of OPTIONS) {
      const label = document.createElement('label');
      const caption = document.createElement('span');
      caption.textContent = option.label;
      addInlineHelpButton(caption, option.help, showInlineHelpPopover);
      const input = document.createElement('input');
      input.type = 'number';
      input.dataset.option = option.key;
      input.value = option.value;
      input.step = option.step;
      input.addEventListener('change', () => { updateGuidance(); void analyzeCurrent(); });
      label.append(caption, input);
      optionsGrid.append(label);
    }
    updateGuidance();
    void analyzeCurrent();
  };

  return {
    element: root,
    setContext(nextContext) { context = nextContext; rebuild(); },
    refresh: () => { void analyzeCurrent(); },
  };
}
