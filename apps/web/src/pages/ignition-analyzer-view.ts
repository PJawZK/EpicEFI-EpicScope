import { analyzeIgnitionBehavior, type IgnitionCorrectionEvent, type IgnitionTimingStepEvent } from '../../../../core/analysis/ignition-behavior-analyzer';
import {
  analyzeIgnitionReviewRegions,
  type IgnitionReviewArea,
  type IgnitionReviewReason,
  type IgnitionReviewRegionResult,
} from '../../../../core/analysis/ignition-review-regions';
import {
  analyzeIgnitionTuneAttribution,
  type IgnitionTuneAreaAttribution,
} from '../../../../core/analysis/ignition-tune-attribution';
import { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import type { ChannelDefinition } from '../../../../core/log-model/log-types';
import type { TuneModel } from '../../../../core/tune/tune-model';
import { addInlineHelpButton, showInlineHelpPopover, type InlineHelpEntry } from '../components/inline-help';
import type { LoggerAnalysisContext, LoggerAnalysisTraceContext } from './logger-page';
import { analyzerScopeBounds, populateAnalyzerScopeSelect, selectedAnalyzerScope } from './analyzer-scope';
import { renderAlignedAnalyzerEvidence, type AnalyzerEvidenceSeries } from './analyzer-event-evidence';
import { createIgnitionTuneSetup } from './ignition-tune-setup';

export interface IgnitionAnalyzerController {
  readonly element: HTMLElement;
  setContext(context: LoggerAnalysisContext): void;
  setTuneModel(model: TuneModel | undefined, sourceName?: string): void;
  refresh(): void;
}

type RoleKey = 'advance' | 'retard' | 'dwell' | 'rpm' | 'load';
type OptionKey =
  | 'timingStepThreshold'
  | 'correctionThreshold'
  | 'maxGapMs'
  | 'reviewRpmBin'
  | 'reviewFocusMinRpm'
  | 'reviewLoadBin'
  | 'reviewMinSamples'
  | 'reviewStableMs'
  | 'reviewMaxRpmRate'
  | 'reviewMaxLoadRate';

interface RoleSpec {
  readonly key: RoleKey;
  readonly label: string;
  readonly required?: boolean;
  readonly help: InlineHelpEntry;
}

interface OptionSpec {
  readonly key: OptionKey;
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
    help: { title: 'RPM', text: 'Optional engine-speed context attached to timing-step and correction events. RPM plus Load / MAP also enable stable-context Areas to review.' },
  },
  {
    key: 'load',
    label: 'Load / MAP',
    help: { title: 'Load / MAP', text: 'Optional engine-load or manifold-pressure context attached to ignition events. RPM plus this channel enable stable-context Areas to review; select the load channel that best represents the active ignition strategy.' },
  },
];

const OPTIONS: readonly OptionSpec[] = [
  {
    key: 'timingStepThreshold',
    label: 'Large timing step threshold',
    value: '5',
    step: '0.1',
    help: { title: 'Large timing step threshold', text: 'Minimum absolute adjacent-sample ignition-advance change reported as a timing-step event. Areas to review and base-table source clues use the same visible threshold. It is not a safe/unsafe limit.' },
  },
  {
    key: 'correctionThreshold',
    label: 'Correction activity threshold',
    value: '0.5',
    step: '0.1',
    help: { title: 'Correction activity threshold', text: 'Minimum absolute Retard / correction magnitude grouped as ECU correction activity. Areas to review surface repeated correction episodes without assigning a cause.' },
  },
  {
    key: 'maxGapMs',
    label: 'Max transition gap ms',
    value: '100',
    step: '10',
    help: { title: 'Maximum transition gap', text: 'Adjacent samples separated by more than this time are not compared or treated as one stable visit. This prevents log gaps or sparse decoding from looking like sudden ignition changes.' },
  },
  {
    key: 'reviewRpmBin',
    label: 'Review RPM bin size',
    value: '250',
    step: '1',
    help: { title: 'Review RPM bin size', text: 'Groups stable-context evidence into RPM regions for Areas to review. Smaller bins are more specific but need more data.' },
  },
  {
    key: 'reviewFocusMinRpm',
    label: 'Review focus minimum RPM',
    value: '1000',
    step: '50',
    help: { title: 'Review focus minimum RPM', text: 'Only affects the ranked Areas to review shortlist. Regions below this RPM remain analyzed and remain in the raw ignition evidence, but are kept out of the shortlist so cranking/start/idle-like contexts do not crowd out higher-RPM regions. Set this to 0 to include all RPM regions. This is a presentation focus, not an ECU-state classifier.' },
  },
  {
    key: 'reviewLoadBin',
    label: 'Review load bin size',
    value: '10',
    step: 'any',
    help: { title: 'Review load bin size', text: 'Groups stable-context evidence along the selected Load / MAP channel. The value uses that channel’s source units.' },
  },
  {
    key: 'reviewMinSamples',
    label: 'Review evidence samples / region',
    value: '10',
    step: '1',
    help: { title: 'Review evidence threshold', text: 'Minimum number of window-stable samples required before a region can appear in Areas to review. Strong evidence additionally requires at least three times this count and repeated visits.' },
  },
  {
    key: 'reviewStableMs',
    label: 'Review stability window ms',
    value: '300',
    step: '10',
    help: { title: 'Review stability window', text: 'Trailing time window used to decide whether RPM and load are stable enough for operating-region comparison. Transient samples remain in the event analysis but do not drive Areas to review.' },
  },
  {
    key: 'reviewMaxRpmRate',
    label: 'Review max RPM trend / s',
    value: '500',
    step: '1',
    help: { title: 'Review maximum RPM trend', text: 'Maximum absolute RPM slope allowed inside the stability window. This is a qualification limit, not an engine-speed recommendation.' },
  },
  {
    key: 'reviewMaxLoadRate',
    label: 'Review max load trend / s',
    value: '25',
    step: 'any',
    help: { title: 'Review maximum load trend', text: 'Maximum absolute selected load-channel slope allowed inside the stability window, in the channel’s source units per second.' },
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

const REVIEW_HELP: InlineHelpEntry = {
  title: 'Areas to review',
  text: 'Ranks repeated ignition behavior inside RPM/load regions after a trailing stability window rejects moving operating conditions. With a mapped MSQ base ignition table, Source clue compares each region’s representative stable evidence with the interpolated base-table advance and selected correction channel. It identifies where the table follows the movement, where correction activity overlaps, or where the selected evidence does not account for the behavior. It does not prove the correct timing value or a combustion cause.',
};

const EVENT_PAGE_SIZE = 200;
const REVIEW_DISPLAY_LIMIT = 6;
const EVIDENCE_EVENT_SERIES_BUDGET = 480;
const EVIDENCE_MIN_EVENTS = 24;
const EVIDENCE_MAX_EVENTS = 160;

function evidenceEventLimit(seriesCount: number): number {
  const budgetLimit = Math.floor(EVIDENCE_EVENT_SERIES_BUDGET / Math.max(1, seriesCount));
  return Math.max(EVIDENCE_MIN_EVENTS, Math.min(EVIDENCE_MAX_EVENTS, budgetLimit));
}

function representativeEvents(events: readonly CombinedEvent[], maximum: number): readonly CombinedEvent[] {
  if (events.length <= maximum) return events;
  if (maximum <= 1) return [events[Math.floor(events.length / 2)]!];
  const selected: CombinedEvent[] = [];
  for (let position = 0; position < maximum; position += 1) {
    const index = Math.round(position * (events.length - 1) / (maximum - 1));
    selected.push(events[index]!);
  }
  return selected;
}

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

function percentageText(value: number): string {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '—';
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

function reviewReasonLabel(reason: IgnitionReviewReason): string {
  if (reason === 'timing-steps') return 'Repeated timing steps';
  if (reason === 'timing-variability') return 'Timing varies on repeated visits';
  if (reason === 'correction-activity') return 'Repeated correction activity';
  return 'Adjacent-region timing difference';
}

function reviewInspection(area: IgnitionReviewArea): string {
  if (area.reasons.includes('correction-activity')) return 'Inspect correction episodes in Logger';
  if (area.reasons.includes('timing-steps')) return 'Inspect timing transition and corresponding ignition-table area';
  if (area.reasons.includes('timing-variability')) return 'Compare repeated visits at the same RPM/load';
  return 'Inspect neighboring ignition-table cells';
}

function reviewSupport(area: IgnitionReviewArea, advanceUnit: string | undefined, correctionUnit: string | undefined): string {
  const details: string[] = [];
  if (area.reasons.includes('timing-steps')) details.push(`${area.timingStepCount} stable steps · max Δ ${valueWithUnit(area.maxTimingStep, advanceUnit)}`);
  if (area.reasons.includes('timing-variability')) details.push(`P10–P90 spread ${valueWithUnit(area.advanceSpread, advanceUnit)}`);
  if (area.reasons.includes('correction-activity')) {
    const peak = area.correctionPeakMagnitude === undefined ? '' : ` · peak ${valueWithUnit(area.correctionPeakMagnitude, correctionUnit)}`;
    details.push(`${area.correctionEpisodeCount} correction episodes${peak}`);
  }
  if (area.reasons.includes('adjacent-transition')) details.push(`Adjacent mean Δ ${valueWithUnit(area.adjacentAdvanceDifference, advanceUnit)}`);
  return details.slice(0, 2).join(' · ');
}

function reviewSourceClue(
  area: IgnitionReviewArea,
  attribution: IgnitionTuneAreaAttribution | undefined,
  timingStepThreshold: number,
  advanceUnit: string | undefined,
): string {
  if (!attribution) return 'No base-table comparison';
  if (attribution.mappedSampleCount === 0) return 'Representative evidence not mapped to base table';
  if (area.reasons.includes('adjacent-transition')
    && attribution.adjacentBaseAdvanceDifference !== undefined
    && attribution.adjacentBaseAdvanceDifference >= timingStepThreshold) {
    return `Base table contains adjacent Δ ${valueWithUnit(attribution.adjacentBaseAdvanceDifference, advanceUnit)}`;
  }
  if (attribution.observedTimingStepCount > 0) {
    if (attribution.baseAlignedTimingStepCount === attribution.observedTimingStepCount) {
      return `Base table follows ${attribution.baseAlignedTimingStepCount}/${attribution.observedTimingStepCount} representative step${attribution.observedTimingStepCount === 1 ? '' : 's'}`;
    }
    if (attribution.baseAlignedTimingStepCount > 0) {
      return `Base table follows ${attribution.baseAlignedTimingStepCount}/${attribution.observedTimingStepCount} steps · ${attribution.residualTimingStepCount} residual`;
    }
  }
  if (attribution.correctionEpisodeCount > 0 || area.reasons.includes('correction-activity')) {
    const residual = attribution.meanResidual === undefined ? '' : ` · final−base ${signedNumber(attribution.meanResidual)}${advanceUnit ? ` ${advanceUnit}` : ''}`;
    return `Correction activity overlaps${residual}`;
  }
  if (attribution.residualSpread !== undefined && attribution.residualSpread >= timingStepThreshold) {
    return `Base table leaves residual spread ${valueWithUnit(attribution.residualSpread, advanceUnit)}`;
  }
  if (attribution.meanResidual !== undefined && Math.abs(attribution.meanResidual) >= timingStepThreshold) {
    return `Final advance differs from base by ${signedNumber(attribution.meanResidual)}${advanceUnit ? ` ${advanceUnit}` : ''} mean`;
  }
  if (area.reasons.includes('timing-variability')
    && attribution.baseLocalSpread !== undefined
    && attribution.baseLocalSpread >= timingStepThreshold) {
    return `Base table varies ${valueWithUnit(attribution.baseLocalSpread, advanceUnit)} inside region`;
  }
  return 'No strong base-table/correction clue in representative evidence';
}

type CombinedEvent =
  | { readonly kind: 'Timing step'; readonly event: IgnitionTimingStepEvent }
  | { readonly kind: 'Correction'; readonly event: IgnitionCorrectionEvent };

export function createIgnitionAnalyzerView(): IgnitionAnalyzerController {
  let context: LoggerAnalysisContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };
  let analysisGeneration = 0;
  const rememberedSelections = new Map<string, string>();
  let analyzeCurrent: () => Promise<void> = async () => {};
  const tuneSetup = createIgnitionTuneSetup(() => { void analyzeCurrent(); });

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
      <summary>Analysis setup & thresholds</summary>
      <div data-ignition="tune-setup"></div>
      <div class="specialized-analyzer-options-grid"></div>
    </details>
    <div class="specialized-analyzer-empty">
      <strong>Select Ignition advance and a valid scope.</strong>
      <span>Retard/correction, dwell, RPM and load are optional context. This analyzer does not infer knock or timing safety.</span>
    </div>
    <div class="specialized-analyzer-content" hidden>
      <div class="specialized-analyzer-summary"></div>
      <section class="specialized-analyzer-events ignition-review-section" hidden>
        <header><div><strong data-ignition="review-title">Areas to review</strong><span data-ignition="review-note"></span></div></header>
        <div class="specialized-analyzer-table-wrap">
          <table class="specialized-analyzer-table ignition-review-table"><thead></thead><tbody></tbody></table>
        </div>
      </section>
      <details class="specialized-analyzer-options ignition-behavior-details">
        <summary>More details</summary>
        <div class="specialized-analyzer-table-wrap">
          <table class="specialized-analyzer-table ignition-behavior-details-table"><tbody></tbody></table>
        </div>
      </details>
      <section class="specialized-analyzer-evidence" hidden>
        <header><div><strong data-ignition="evidence-title">Ignition behavior · aligned evidence</strong><span data-ignition="evidence-note"></span></div><button type="button" data-ignition="evidence-all">Overview</button></header>
        <canvas class="specialized-analyzer-evidence-canvas" aria-label="Ignition event-aligned evidence graph"></canvas>
      </section>
      <section class="specialized-analyzer-events">
        <header>
          <strong>Observed ignition events</strong>
          <span data-ignition="events-count">0</span>
          <div class="ignition-event-pagination">
            <button type="button" data-ignition="events-prev">Previous</button>
            <span data-ignition="events-page">0 events</span>
            <button type="button" data-ignition="events-next">Next</button>
          </div>
        </header>
        <div class="specialized-analyzer-table-wrap">
          <table class="specialized-analyzer-table ignition-behavior-events-table"><thead></thead><tbody></tbody></table>
        </div>
      </section>
    </div>
  `;

  const controls = root.querySelector<HTMLElement>('.specialized-analyzer-controls');
  const optionsGrid = root.querySelector<HTMLElement>('.specialized-analyzer-options-grid');
  const tuneSetupHost = root.querySelector<HTMLElement>('[data-ignition="tune-setup"]');
  const empty = root.querySelector<HTMLElement>('.specialized-analyzer-empty');
  const content = root.querySelector<HTMLElement>('.specialized-analyzer-content');
  const summary = root.querySelector<HTMLElement>('.specialized-analyzer-summary');
  const reviewSection = root.querySelector<HTMLElement>('.ignition-review-section');
  const reviewTitle = root.querySelector<HTMLElement>('[data-ignition="review-title"]');
  const reviewNote = root.querySelector<HTMLElement>('[data-ignition="review-note"]');
  const reviewHead = root.querySelector<HTMLTableSectionElement>('.ignition-review-table thead');
  const reviewBody = root.querySelector<HTMLTableSectionElement>('.ignition-review-table tbody');
  const detailsBody = root.querySelector<HTMLTableSectionElement>('.ignition-behavior-details-table tbody');
  const evidence = root.querySelector<HTMLElement>('.specialized-analyzer-evidence');
  const evidenceCanvas = root.querySelector<HTMLCanvasElement>('.specialized-analyzer-evidence-canvas');
  const evidenceAll = root.querySelector<HTMLButtonElement>('[data-ignition="evidence-all"]');
  const eventsHead = root.querySelector<HTMLTableSectionElement>('.ignition-behavior-events-table thead');
  const eventsBody = root.querySelector<HTMLTableSectionElement>('.ignition-behavior-events-table tbody');
  const guidance = root.querySelector<HTMLElement>('[data-ignition="guidance"]');
  const eventsCount = root.querySelector<HTMLElement>('[data-ignition="events-count"]');
  const eventsPrev = root.querySelector<HTMLButtonElement>('[data-ignition="events-prev"]');
  const eventsNext = root.querySelector<HTMLButtonElement>('[data-ignition="events-next"]');
  const eventsPage = root.querySelector<HTMLElement>('[data-ignition="events-page"]');
  const evidenceNote = root.querySelector<HTMLElement>('[data-ignition="evidence-note"]');
  if (!controls || !optionsGrid || !tuneSetupHost || !empty || !content || !summary || !reviewSection || !reviewTitle || !reviewNote || !reviewHead || !reviewBody || !detailsBody || !evidence || !evidenceCanvas || !evidenceAll || !eventsHead || !eventsBody || !guidance || !eventsCount || !eventsPrev || !eventsNext || !eventsPage || !evidenceNote) {
    throw new Error('Ignition Analyzer structure is incomplete.');
  }
  tuneSetupHost.append(tuneSetup.element);
  addInlineHelpButton(reviewTitle, REVIEW_HELP, showInlineHelpPopover);

  const roleSelect = (key: RoleKey): HTMLSelectElement | undefined => controls.querySelector<HTMLSelectElement>(`select[data-role="${key}"]`) ?? undefined;
  const optionInput = (key: OptionKey): HTMLInputElement | undefined => optionsGrid.querySelector<HTMLInputElement>(`input[data-option="${key}"]`) ?? undefined;
  const optionNumber = (key: OptionKey, fallback: number): number => {
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

  const renderReviewAreas = (
    result: IgnitionReviewRegionResult | undefined,
    advanceUnit: string | undefined,
    loadUnit: string | undefined,
    correctionUnit: string | undefined,
    minimumFocusRpm: number,
    timingStepThreshold: number,
    attributionByArea: ReadonlyMap<IgnitionReviewArea, IgnitionTuneAreaAttribution>,
  ): void => {
    reviewSection.hidden = false;
    const headers = ['Area', 'Finding', 'Evidence', 'Source clue', 'What supports it', 'Inspect next'];
    const headerRow = document.createElement('tr');
    for (const label of headers) {
      const th = document.createElement('th');
      th.textContent = label;
      headerRow.append(th);
    }
    reviewHead.replaceChildren(headerRow);

    if (!result) {
      reviewNote.textContent = 'Select RPM and Load / MAP above to enable stable-context operating-region review.';
      reviewBody.replaceChildren();
      return;
    }

    const stableCoverage = result.validAlignedSampleCount > 0 ? result.stableSampleCount / result.validAlignedSampleCount : 0;
    if (!result.areas.length) {
      reviewNote.textContent = `No repeated stable-context review areas surfaced at the current thresholds · ${result.evaluatedRegionCount.toLocaleString()} supported regions evaluated · ${percentageText(stableCoverage)} stable-context coverage.`;
      reviewBody.replaceChildren();
      return;
    }

    const focusedAreas = result.areas.filter((area) => area.rpmStart >= minimumFocusRpm);
    const lowerRpmAreaCount = result.areas.length - focusedAreas.length;
    if (!focusedAreas.length) {
      const heldBack = lowerRpmAreaCount > 0
        ? ` ${lowerRpmAreaCount.toLocaleString()} lower-RPM review area${lowerRpmAreaCount === 1 ? '' : 's'} remain available by lowering Review focus minimum RPM.`
        : '';
      reviewNote.textContent = `No review areas surfaced at or above ${numberText(minimumFocusRpm, 0)} rpm · ${result.evaluatedRegionCount.toLocaleString()} supported regions evaluated · ${percentageText(stableCoverage)} stable-context coverage.${heldBack}`;
      reviewBody.replaceChildren();
      return;
    }

    const shown = focusedAreas.slice(0, REVIEW_DISPLAY_LIMIT);
    const prefix = focusedAreas.length > shown.length ? `Top ${shown.length} of ${focusedAreas.length}` : `${shown.length}`;
    const heldBack = lowerRpmAreaCount > 0
      ? ` · ${lowerRpmAreaCount.toLocaleString()} lower-RPM area${lowerRpmAreaCount === 1 ? '' : 's'} held back by ≥ ${numberText(minimumFocusRpm, 0)} rpm focus`
      : '';
    const tableNote = attributionByArea.size ? ' · source clues compare representative stable evidence with the mapped base table' : ' · load/map an MSQ base ignition table for source clues';
    reviewNote.textContent = `${prefix} focused region${focusedAreas.length === 1 ? '' : 's'} · ${result.evaluatedRegionCount.toLocaleString()} supported regions evaluated · ${percentageText(stableCoverage)} stable-context coverage${heldBack}${tableNote} · ranked for inspection, not automatic tuning changes.`;
    reviewBody.replaceChildren(...shown.map((area) => {
      const tr = document.createElement('tr');
      tr.className = 'specialized-analyzer-event-row--navigable';
      const loadSuffix = loadUnit ? ` ${loadUnit}` : '';
      const areaText = `${numberText(area.rpmStart, 0)}–${numberText(area.rpmEnd, 0)} rpm · ${numberText(area.loadStart)}–${numberText(area.loadEnd)}${loadSuffix}`;
      const findings = area.reasons.slice(0, 2).map(reviewReasonLabel).join(' · ');
      const evidenceText = `${area.evidenceStrength === 'strong' ? 'Strong' : 'Moderate'} · ${area.stableSampleCount.toLocaleString()} stable · ${area.visitCount.toLocaleString()} visit${area.visitCount === 1 ? '' : 's'}`;
      const sourceClue = reviewSourceClue(area, attributionByArea.get(area), timingStepThreshold, advanceUnit);
      const values = [areaText, findings, evidenceText, sourceClue, reviewSupport(area, advanceUnit, correctionUnit)];
      for (const value of values) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.append(td);
      }
      const actionCell = document.createElement('td');
      const action = document.createElement('button');
      action.type = 'button';
      action.textContent = 'Open Logger';
      action.disabled = !context.openSamplesInLogger;
      action.title = reviewInspection(area);
      const open = (): void => context.openSamplesInLogger?.({
        sampleIndices: area.evidenceStartSampleIndex === area.evidenceEndSampleIndex
          ? [area.evidenceStartSampleIndex]
          : [area.evidenceStartSampleIndex, area.evidenceEndSampleIndex],
        timeMs: area.evidenceStartTimeMs === area.evidenceEndTimeMs
          ? [area.evidenceStartTimeMs]
          : [area.evidenceStartTimeMs, area.evidenceEndTimeMs],
        label: `Ignition review · ${areaText}`,
      });
      action.addEventListener('click', open);
      actionCell.append(action);
      tr.append(actionCell);
      if (context.openSamplesInLogger) tr.addEventListener('dblclick', open);
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
    const displayLimit = evidenceEventLimit(series.length);
    const representative = representativeEvents(events, displayLimit);
    const evidenceEvents = representative.map(({ event }) => ({ startTimeMs: event.startTimeMs, endTimeMs: event.endTimeMs }));
    const renderAll = (): void => {
      evidenceNote.textContent = representative.length < events.length
        ? `Representative ${representative.length.toLocaleString()} of ${events.length.toLocaleString()} events across the full scope · median + 10–90% envelope · t=0 onset`
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

  let currentEvents: readonly CombinedEvent[] = [];
  let currentEventSeries: readonly AnalyzerEvidenceSeries[] = [];
  let currentEventPage = 0;

  const renderEventPage = (): void => {
    const pageCount = Math.max(1, Math.ceil(currentEvents.length / EVENT_PAGE_SIZE));
    currentEventPage = Math.max(0, Math.min(currentEventPage, pageCount - 1));
    const start = currentEventPage * EVENT_PAGE_SIZE;
    const end = Math.min(currentEvents.length, start + EVENT_PAGE_SIZE);
    eventsCount.textContent = currentEvents.length.toLocaleString();
    eventsPage.textContent = currentEvents.length
      ? `${(start + 1).toLocaleString()}–${end.toLocaleString()} of ${currentEvents.length.toLocaleString()}`
      : '0 events';
    eventsPrev.disabled = currentEventPage <= 0;
    eventsNext.disabled = currentEventPage >= pageCount - 1 || currentEvents.length === 0;

    const headers = ['#', 'Type', 'Start', 'Duration', 'Advance Δ', 'Correction', 'Advance', 'Dwell', 'RPM', 'Load'];
    const headerRow = document.createElement('tr');
    for (const label of headers) {
      const th = document.createElement('th');
      th.textContent = label;
      headerRow.append(th);
    }
    eventsHead.replaceChildren(headerRow);

    const pageEvents = currentEvents.slice(start, end);
    eventsBody.replaceChildren(...pageEvents.map((entry, localIndex) => {
      const eventIndex = start + localIndex;
      const event = entry.event;
      const isStep = entry.kind === 'Timing step';
      const step = isStep ? event as IgnitionTimingStepEvent : undefined;
      const correction = isStep ? undefined : event as IgnitionCorrectionEvent;
      const values = [
        String(eventIndex + 1),
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
        selectEvidenceEvent(entry, eventIndex, currentEventSeries);
      };
      const open = (): void => context.openSamplesInLogger?.({
        sampleIndices: event.startSampleIndex === event.endSampleIndex ? [event.startSampleIndex] : [event.endSampleIndex],
        timeMs: event.startTimeMs === event.endTimeMs ? [event.startTimeMs] : [event.startTimeMs, event.endTimeMs],
        label: `${entry.kind} ${eventIndex + 1}`,
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

  eventsPrev.addEventListener('click', () => {
    if (currentEventPage <= 0) return;
    currentEventPage -= 1;
    renderEventPage();
  });
  eventsNext.addEventListener('click', () => {
    if ((currentEventPage + 1) * EVENT_PAGE_SIZE >= currentEvents.length) return;
    currentEventPage += 1;
    renderEventPage();
  });

  const renderEvents = (events: readonly CombinedEvent[], series: readonly AnalyzerEvidenceSeries[]): void => {
    currentEvents = events;
    currentEventSeries = series;
    currentEventPage = 0;
    renderEventPage();
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
    const reviewFocusMinRpm = Math.max(0, optionNumber('reviewFocusMinRpm', 1000));
    guidance.textContent = `Large timing steps are adjacent advance changes ≥ ${numberText(optionNumber('timingStepThreshold', 5))}; correction events use |Retard / correction| > ${numberText(optionNumber('correctionThreshold', 0.5))}. Sample pairs separated by more than ${numberText(optionNumber('maxGapMs', 100), 0)} ms are not compared. With RPM + Load / MAP selected, Areas to review rank repeated behavior after a ${numberText(optionNumber('reviewStableMs', 300), 0)} ms stability window and default the shortlist to regions at or above ${numberText(reviewFocusMinRpm, 0)} rpm. A mapped MSQ base table adds source clues from representative stable evidence. These are observational filters only—EpicScope does not infer knock, timing safety, or the correct ignition value.`;
  };

  analyzeCurrent = async (): Promise<void> => {
    const generation = ++analysisGeneration;
    const advanceId = roleSelect('advance')?.value;
    const scope = selectedScope();
    if (!advanceId || !scope) {
      empty.hidden = false;
      content.hidden = true;
      reviewSection.hidden = true;
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
    if (!advance) { empty.hidden = false; content.hidden = true; reviewSection.hidden = true; return; }
    const scoped = scopeForPrimary(advance, [...traces.values()]);
    if (!scoped) { empty.hidden = false; content.hidden = true; reviewSection.hidden = true; return; }

    try {
      const retard = traces.get('retard');
      const dwell = traces.get('dwell');
      const rpm = traces.get('rpm');
      const load = traces.get('load');
      const timingStepThreshold = optionNumber('timingStepThreshold', 5);
      const correctionThreshold = optionNumber('correctionThreshold', 0.5);
      const maxGapMs = optionNumber('maxGapMs', 100);
      const reviewFocusMinRpm = Math.max(0, optionNumber('reviewFocusMinRpm', 1000));
      const result = analyzeIgnitionBehavior({
        advance: advance.range,
        ...(retard ? { retardOrCorrection: retard.range } : {}),
        ...(dwell ? { dwell: dwell.range } : {}),
        ...(rpm ? { rpm: rpm.range } : {}),
        ...(load ? { load: load.range } : {}),
      }, {
        sampleIndices: scoped.sampleIndices,
        complete: scoped.complete,
        timingStepThreshold,
        correctionThreshold,
        maxTransitionGapMs: maxGapMs,
      });

      const reviewResult = rpm && load
        ? analyzeIgnitionReviewRegions({
          advance: advance.range,
          rpm: rpm.range,
          load: load.range,
          ...(retard ? { correction: retard.range } : {}),
          ...(dwell ? { dwell: dwell.range } : {}),
        }, {
          rpmBinSize: optionNumber('reviewRpmBin', 250),
          loadBinSize: optionNumber('reviewLoadBin', 10),
          minimumSamplesPerRegion: optionNumber('reviewMinSamples', 10),
          minimumStableDurationMs: optionNumber('reviewStableMs', 300),
          maxRpmRatePerSecond: optionNumber('reviewMaxRpmRate', 500),
          maxLoadRatePerSecond: optionNumber('reviewMaxLoadRate', 25),
          timingStepThreshold,
          correctionThreshold,
          maxTransitionGapMs: maxGapMs,
        }, scoped.sampleIndices)
        : undefined;
      const baseTable = rpm && load ? tuneSetup.selectedTable() : undefined;
      const tuneAttribution = reviewResult && baseTable && rpm && load
        ? analyzeIgnitionTuneAttribution(reviewResult.areas, baseTable, {
          advance: advance.range,
          rpm: rpm.range,
          load: load.range,
          ...(retard ? { correction: retard.range } : {}),
        }, {
          timingStepThreshold,
          correctionThreshold,
          maxTransitionGapMs: maxGapMs,
        })
        : undefined;
      const attributionByArea = new Map<IgnitionReviewArea, IgnitionTuneAreaAttribution>(
        tuneAttribution?.areas.map((entry) => [entry.area, entry]) ?? [],
      );
      const focusedReviewAreaCount = reviewResult
        ? reviewResult.areas.filter((area) => area.rpmStart >= reviewFocusMinRpm).length
        : undefined;
      const lowerRpmReviewAreaCount = reviewResult && focusedReviewAreaCount !== undefined
        ? reviewResult.reviewAreaCount - focusedReviewAreaCount
        : undefined;

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
      renderReviewAreas(reviewResult, advanceUnit, load?.channel.unit, retard?.channel.unit, reviewFocusMinRpm, timingStepThreshold, attributionByArea);

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
        ['Review stable / aligned', reviewResult ? `${reviewResult.stableSampleCount.toLocaleString()} / ${reviewResult.validAlignedSampleCount.toLocaleString()}` : 'Requires RPM + Load / MAP'],
        ['Review focus minimum RPM', reviewResult ? `${numberText(reviewFocusMinRpm, 0)} rpm` : 'Requires RPM + Load / MAP'],
        ['Review regions / focused', reviewResult && focusedReviewAreaCount !== undefined ? `${reviewResult.evaluatedRegionCount.toLocaleString()} / ${focusedReviewAreaCount.toLocaleString()}` : 'Requires RPM + Load / MAP'],
        ['Review low-RPM areas held back', lowerRpmReviewAreaCount !== undefined ? lowerRpmReviewAreaCount.toLocaleString() : 'Requires RPM + Load / MAP'],
        ['Base table comparison', tuneSetup.description()],
        ['Base table review areas mapped', tuneAttribution ? `${tuneAttribution.mappedAreaCount.toLocaleString()} / ${tuneAttribution.areaCount.toLocaleString()}` : 'Not active'],
      ]);

      const combinedEvents: CombinedEvent[] = [];
      for (const event of result.timingStepEvents) combinedEvents.push({ kind: 'Timing step', event });
      for (const event of result.correctionEvents) combinedEvents.push({ kind: 'Correction', event });
      combinedEvents.sort((left, right) => left.event.startTimeMs - right.event.startTimeMs || left.event.endTimeMs - right.event.endTimeMs);
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
      reviewSection.hidden = true;
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
    setTuneModel(model, sourceName) { tuneSetup.setTuneModel(model, sourceName); },
    refresh: () => { void analyzeCurrent(); },
  };
}
