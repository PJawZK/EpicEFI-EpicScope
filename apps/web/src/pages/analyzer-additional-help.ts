import {
  addInlineHelpButton,
  matchingInlineHelp,
  showInlineHelpPopover,
  type InlineHelpEntry,
  type InlineHelpMatcher,
} from '../components/inline-help';

const COMMON_CONTROL_HELP: readonly InlineHelpMatcher[] = [
  [/^Scope$/i, { title: 'Scope', text: 'Chooses the portion of the log analyzed. Use Full Log for the complete source, Current A/B for the active Logger selection, or a Saved Range for a named interval. Compare like-for-like scopes when judging changes.' }],
  [/^Qualification$/i, { title: 'Qualification', text: 'Applies a saved sample filter before analysis. Rejected, invalid and unavailable samples remain accounted for separately so qualification does not silently erase provenance.' }],
];

const DOMAIN_CONTROL_HELP: Readonly<Record<string, readonly InlineHelpMatcher[]>> = {
  'AE / MAP Predict': [
    [/^TPS$/i, { title: 'TPS', text: 'Throttle position is the transient trigger. EpicScope detects sufficiently large TPS changes, then inspects MAP prediction and mixture behavior around those events.' }],
    [/^Measured MAP$/i, { title: 'Measured MAP', text: 'Actual manifold pressure used to judge the physical response to the throttle transient and to calculate prediction error when Predicted MAP is available.' }],
    [/^Predicted MAP$/i, { title: 'Predicted MAP', text: 'ECU-estimated manifold pressure used during transient fueling. Prediction error compares this estimate with measured MAP; the analyzer treats the difference as evidence, not an automatic tuning correction.' }],
    [/^Mixture/i, { title: 'Mixture', text: 'Measured lambda/AFR context around the transient. Lambda is preferred when available because it is fuel-independent. Lean/rich excursion is reported relative to the event starting value.' }],
    [/^TPS delta threshold$/i, { title: 'TPS delta threshold', text: 'Minimum TPS change required to form a transient event. Raise it to focus on stronger pedal movements; lower it to include smaller transitions.' }],
    [/^Event window ms$/i, { title: 'Event window', text: 'Amount of time after the TPS transition used to inspect MAP prediction and mixture response. It changes the observation window, not the logged data.' }],
  ],
  Ignition: [
    [/^Ignition advance$/i, { title: 'Ignition advance', text: 'Actual spark advance used as the primary ignition evidence. Interpret timing together with RPM/load and knock/retard context rather than as a standalone good/bad value.' }],
    [/^Retard$/i, { title: 'Retard', text: 'Optional ignition-retard evidence. A nonzero value shows timing has been pulled relative to the underlying request, but the channel meaning still depends on the ECU definition.' }],
    [/^Knock signal$/i, { title: 'Knock signal', text: 'Optional knock-oriented signal used to group threshold-crossing events. It is evidence from the selected channel; EpicScope does not assume every excursion is confirmed combustion knock.' }],
    [/^Knock threshold$/i, { title: 'Knock threshold', text: 'Threshold above which the selected knock signal is grouped into knock-oriented events. Choose a value meaningful for that channel and sensor scaling.' }],
  ],
  'Fuel Pressure / Injector': [
    [/^Reference sample grid$/i, { title: 'Reference sample grid', text: 'Channel whose sample/time grid anchors the analysis. Other selected channels are aligned against this reference so event counts and statistics use one consistent sample index.' }],
    [/^Fuel pressure$/i, { title: 'Fuel pressure', text: 'Measured fuel pressure. Absolute rail pressure can be useful context, but on manifold-referenced systems rail differential is usually more directly related to injector flow.' }],
    [/^Rail differential$/i, { title: 'Rail differential', text: 'Fuel pressure minus the relevant manifold/reference pressure. Stable differential pressure is what keeps injector flow predictable across changing engine load.' }],
    [/^Injector PW$/i, { title: 'Injector pulse width', text: 'Commanded/scheduled injector on-time. Use it as delivered-fuel command context together with duty cycle, deadtime and fuel pressure.' }],
    [/^Injector duty$/i, { title: 'Injector duty', text: 'Percentage of available cycle time consumed by injection. High duty reduces headroom and can make additional commanded fuel impossible to deliver as intended.' }],
    [/^Injector deadtime$/i, { title: 'Injector deadtime', text: 'Estimated non-flowing opening/closing delay included in injector scheduling. It is especially important at short pulse widths and changing battery voltage.' }],
    [/^Low differential threshold$/i, { title: 'Low differential threshold', text: 'Optional rail-differential limit used to flag low-pressure events. Leave it blank when no meaningful pressure threshold has been established for the selected channel.' }],
    [/^High duty threshold$/i, { title: 'High duty threshold', text: 'Injector-duty level used to flag reduced-headroom events. The default is a warning threshold, not a universal safe maximum for every injector/strategy.' }],
  ],
  'Trigger / Sync': [
    [/^Reference sample grid$/i, { title: 'Reference sample grid', text: 'Channel whose timestamps/sample indices anchor sync analysis. The selected sync/error/counter channels are evaluated on this common evidence grid.' }],
    [/^Sync state$/i, { title: 'Sync state', text: 'ECU synchronization state. Values below the configured Synced minimum are treated as sync-loss/dropout evidence.' }],
    [/^Trigger error$/i, { title: 'Trigger error', text: 'Trigger-quality/error signal where available. Excursions beyond the configured threshold are grouped into events so brief and repeated problems can be inspected in Logger.' }],
    [/^Sync loss counter$/i, { title: 'Sync loss counter', text: 'Cumulative ECU counter for synchronization-loss occurrences. Increments are turned into discrete events even if the underlying dropout was brief.' }],
    [/^RPM$/i, { title: 'RPM', text: 'Engine speed context for trigger/sync events. It helps show whether problems cluster around cranking, idle, a particular RPM band or high-speed operation.' }],
    [/^Synced minimum$/i, { title: 'Synced minimum', text: 'Lowest Sync state value considered synchronized. Samples below this value are reported as sync-state dropout evidence.' }],
    [/^Trigger error threshold$/i, { title: 'Trigger error threshold', text: 'Absolute trigger-error magnitude required to form an event. Raise it to ignore small/noisy excursions; lower it to inspect subtler deviations.' }],
  ],
};

const DOMAIN_SUMMARY_HELP: Readonly<Record<string, Readonly<Record<string, InlineHelpEntry>>>> = {
  'AE / MAP Predict': {
    Scope: { title: 'Scope', text: 'The analyzed log interval.' },
    Coverage: { title: 'Coverage', text: 'Complete means all selected decoded traces cover the scope. Partial decoded means at least one selected trace does not fully cover it.' },
    Events: { title: 'Transient events', text: 'Number of qualifying TPS transitions found in the scope using the configured TPS delta threshold.' },
    'Tip-in / decel': { title: 'Tip-in / decel', text: 'Count of positive-TPS and negative-TPS transient events. This separates acceleration-like and deceleration-like evidence rather than mixing them into one count.' },
    'TPS mean': { title: 'TPS mean', text: 'Average throttle position across the analyzed samples. It is operating context, not transient quality by itself.' },
    'MAP mean': { title: 'MAP mean', text: 'Average measured manifold pressure across the analyzed scope.' },
    'Predict error mean': { title: 'Prediction error mean', text: 'Average Predicted MAP minus/versus measured MAP error as defined by the analyzer event calculation. Signed errors can cancel, so use MAE as the stronger magnitude summary.' },
    'Predict error MAE': { title: 'Prediction error MAE', text: 'Average absolute MAP-prediction error at event end. Lower means the estimate generally finishes closer to measured MAP; sign cannot cancel.' },
    'Peak lean excursion': { title: 'Peak lean excursion', text: 'Largest lean-side mixture movement observed across the detected transient events, relative to each event starting mixture.' },
    'Peak rich excursion': { title: 'Peak rich excursion', text: 'Largest rich-side mixture movement observed across the detected transient events, relative to each event starting mixture.' },
    'Predicted MAP mean': { title: 'Predicted MAP mean', text: 'Average predicted manifold pressure across the selected scope. Use it only as context; prediction error around transients is more informative.' },
    'Mixture mean': { title: 'Mixture mean', text: 'Average selected lambda/AFR value over the scope. A mean can hide transient lean/rich spikes, so inspect event excursions too.' },
  },
  Ignition: {
    Scope: { title: 'Scope', text: 'The analyzed log interval.' },
    Coverage: { title: 'Coverage', text: 'Complete means the selected ignition evidence covers the scope; Partial decoded means at least one trace has incomplete coverage.' },
    'Advance mean': { title: 'Advance mean', text: 'Average ignition advance over the selected scope. It is operating context and can hide large timing changes, so pair it with extrema and event evidence.' },
    'Advance min / max': { title: 'Advance minimum / maximum', text: 'Lowest and highest valid ignition-advance values in the scope. Large spread can be normal across changing RPM/load, so use event context before interpreting it.' },
    'Retard mean': { title: 'Retard mean', text: 'Average selected retard signal. Persistent nonzero retard can be meaningful, but the channel definition must be understood before assigning a cause.' },
    'Knock mean / max': { title: 'Knock mean / maximum', text: 'Average and peak selected knock-signal values. Peak alone does not prove knock; use the threshold events and surrounding timing/load context.' },
    'Knock events': { title: 'Knock-oriented events', text: 'Grouped periods where the selected knock signal exceeded the configured threshold. They are inspectable evidence rather than automatic knock diagnoses.' },
    'Valid advance': { title: 'Valid advance samples', text: 'Number of usable ignition-advance samples included in the aggregation.' },
  },
  'Fuel Pressure / Injector': {
    Scope: { title: 'Scope', text: 'The analyzed log interval.' },
    Coverage: { title: 'Coverage', text: 'Complete means the selected fuel/injector traces cover the scope; Partial decoded means at least one does not.' },
    'Fuel pressure mean': { title: 'Fuel pressure mean', text: 'Average absolute fuel pressure over the selected scope.' },
    'Rail diff mean / min': { title: 'Rail differential mean / minimum', text: 'Average and lowest differential fuel pressure. The minimum is especially useful for spotting pressure sag under injector demand.' },
    'Injector PW mean': { title: 'Injector PW mean', text: 'Average injector pulse width over the selected scope.' },
    'Injector duty mean / max': { title: 'Injector duty mean / maximum', text: 'Average injector duty plus the highest observed duty. Maximum duty indicates the least remaining injector-time headroom.' },
    'Deadtime mean': { title: 'Deadtime mean', text: 'Average selected injector deadtime over the scope. Use it as scheduling context rather than a direct performance score.' },
    'Low pressure events': { title: 'Low-pressure events', text: 'Grouped periods where rail differential fell below the configured low-pressure threshold.' },
    'High duty events': { title: 'High-duty events', text: 'Grouped periods where injector duty exceeded the configured high-duty threshold.' },
  },
  'Trigger / Sync': {
    Scope: { title: 'Scope', text: 'The analyzed log interval.' },
    Coverage: { title: 'Coverage', text: 'Complete means the selected trigger/sync traces cover the scope; Partial decoded means at least one does not.' },
    Events: { title: 'Trigger / sync events', text: 'Combined count of sync-state dropouts, trigger-error threshold events and sync-loss-counter increments.' },
    'Sync state mean': { title: 'Sync state mean', text: 'Average numerical sync-state value. This is secondary context; discrete dropout events are usually more meaningful than the mean.' },
    'Trigger error max': { title: 'Trigger error maximum', text: 'Highest valid selected trigger-error value in the scope.' },
    'Loss counter max': { title: 'Sync loss counter maximum', text: 'Highest observed cumulative sync-loss counter value. Counter increments are also emitted as discrete events.' },
    'RPM mean / max': { title: 'RPM mean / maximum', text: 'Average and maximum engine speed in the selected scope, used as context for where trigger/sync evidence occurred.' },
  },
};

const COMPARE_CONTROL_HELP: readonly InlineHelpMatcher[] = [
  [/^Channel$/i, { title: 'Channel', text: 'Log channel compared between the two selected scopes. Both sides use the same channel so the statistics and deltas are directly comparable.' }],
  [/^Left scope$/i, { title: 'Left scope', text: 'Baseline comparison interval. The final delta convention is Right minus Left.' }],
  [/^Right scope$/i, { title: 'Right scope', text: 'Comparison interval. The final delta convention is Right minus Left, so positive deltas mean the right-side statistic is higher.' }],
  ...COMMON_CONTROL_HELP,
];

const COMPARE_EVIDENCE_HELP: Readonly<Record<string, InlineHelpEntry>> = {
  Input: { title: 'Input samples', text: 'Samples present in the selected scope before qualification conditions are applied.' },
  Eligible: { title: 'Eligible samples', text: 'Samples that passed the selected qualification filter and are available for comparison statistics.' },
  Rejected: { title: 'Rejected samples', text: 'Samples rejected because they failed one or more qualification conditions.' },
  Invalid: { title: 'Invalid samples', text: 'Samples where required values existed but were invalid/non-finite for qualification or analysis.' },
  Unavailable: { title: 'Unavailable samples', text: 'Samples where required qualification evidence was not available. They are not silently treated as passing.' },
  Coverage: { title: 'Coverage', text: 'Complete means all required decoded evidence covers the selected scope. Partial decoded means some evidence is missing.' },
};

const TUNE_CONTROL_HELP: readonly InlineHelpMatcher[] = [
  [/^Table$/i, { title: 'Tune table', text: 'MSQ table whose cell values and axes define the calibration grid being correlated with logged data.' }],
  [/^X axis$/i, { title: 'Tune X axis', text: 'MSQ numeric entry used as the selected tune table X-axis breakpoints.' }],
  [/^Y axis$/i, { title: 'Tune Y axis', text: 'MSQ numeric entry used as the selected tune table Y-axis breakpoints.' }],
  [/^X channel$/i, { title: 'Logged X channel', text: 'Log channel mapped to the tune table X axis for each sample.' }],
  [/^Y channel$/i, { title: 'Logged Y channel', text: 'Log channel mapped to the tune table Y axis for each sample.' }],
  [/^Observed$/i, { title: 'Observed channel', text: 'Log value summarized inside each tune-table cell, such as measured mixture, pressure or another response variable.' }],
  [/^Scope$/i, { title: 'Scope', text: 'Logger A/B interval or Saved Range used for tune-table correlation.' }],
  [/^Observed − Tune$/i, { title: 'Observed minus Tune', text: 'When enabled, EpicScope also reports observed value minus interpolated tune-table value for each populated cell. This subtraction is descriptive and only makes physical sense when the two values are compatible quantities.' }],
];

const TUNE_SUMMARY_HELP: Readonly<Record<string, InlineHelpEntry>> = {
  Scope: { title: 'Scope', text: 'The selected log interval correlated with the tune table.' },
  Coverage: { title: 'Coverage', text: 'Complete means all selected log traces cover the requested scope; Partial decoded means at least one does not.' },
  Input: { title: 'Input samples', text: 'Samples presented to tune-table correlation inside the selected scope.' },
  Mapped: { title: 'Mapped samples', text: 'Samples successfully assigned/interpolated into the selected tune-table grid.' },
  Invalid: { title: 'Invalid samples', text: 'Samples rejected because one or more required values were invalid/non-finite.' },
  Unavailable: { title: 'Unavailable samples', text: 'Samples that could not be mapped because required channel data was unavailable.' },
};

const SECTION_HELP: Readonly<Record<string, InlineHelpEntry>> = {
  'Analysis thresholds': { title: 'Analysis thresholds', text: 'Advanced detection/qualification settings for the current analyzer. Defaults are intended as starting points; changing them alters what evidence qualifies, not the source log.' },
  'Steady-state mixture operating points': { title: 'Steady-state mixture operating points', text: 'RPM × load regions containing window-stable fueling evidence. Weak bins remain visible so coverage is not hidden; use Evidence strength before drawing tuning conclusions.' },
  'Transient events': { title: 'Transient events', text: 'Detected AE/MAP Predict events. Select an event row to inspect its aligned evidence and open the corresponding source evidence in Logger.' },
  'Knock events': { title: 'Knock events', text: 'Grouped threshold-crossing knock-signal evidence. Event rows preserve timing and peak context for inspection; they are not automatic combustion-knock diagnoses.' },
  'Fuel / injector events': { title: 'Fuel / injector events', text: 'Threshold-derived low-pressure and high-duty events. Use them to locate where injector demand and pressure/headroom evidence become noteworthy.' },
  'Sync / trigger events': { title: 'Sync / trigger events', text: 'Detected synchronization dropouts, trigger-error excursions and sync-loss-counter increments with timing context.' },
  'Event evidence': { title: 'Event evidence', text: 'Aligned event graph. Events are shifted to a common t=0 so timing/shape can be compared; the plotted aggregate summarizes multiple events rather than replacing the raw Logger traces.' },
};

function ownText(host: HTMLElement): string {
  const textNode = [...host.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
  return textNode?.textContent?.trim() ?? host.textContent?.trim() ?? '';
}

function addMatchingHelp(host: HTMLElement, entries: readonly InlineHelpMatcher[]): void {
  const help = matchingInlineHelp(ownText(host), entries);
  if (help) addInlineHelpButton(host, help, showInlineHelpPopover);
}

function specializedTitle(view: HTMLElement): string {
  return view.querySelector<HTMLElement>('[data-specialized="title"]')?.textContent?.split('·')[0]?.trim() ?? '';
}

export function decorateSpecializedHelp(view: HTMLElement, part: 'controls' | 'summary'): void {
  const title = specializedTitle(view);
  const controls = DOMAIN_CONTROL_HELP[title];
  const summaries = DOMAIN_SUMMARY_HELP[title];
  if (controls && part === 'controls') {
    const entries = [...COMMON_CONTROL_HELP, ...controls];
    for (const span of view.querySelectorAll<HTMLElement>('.specialized-analyzer-controls label > span, .specialized-analyzer-options-grid label > span')) addMatchingHelp(span, entries);
  }
  if (summaries && part === 'summary') {
    for (const card of view.querySelectorAll<HTMLElement>('.specialized-analyzer-summary > div')) {
      const label = card.querySelector<HTMLElement>(':scope > span');
      if (!label) continue;
      const help = summaries[ownText(label)];
      if (help) addInlineHelpButton(card, help, showInlineHelpPopover);
    }
  }
  if (part !== 'controls') return;
  const optionsSummary = view.querySelector<HTMLElement>('.specialized-analyzer-options > summary');
  if (optionsSummary) addMatchingHelp(optionsSummary, [[/^Analysis thresholds$/i, SECTION_HELP['Analysis thresholds']!]]);
  const mapTitle = view.querySelector<HTMLElement>('[data-specialized="map-title"]');
  if (mapTitle && !mapTitle.closest<HTMLElement>('section')?.hidden) {
    const help = SECTION_HELP[ownText(mapTitle)];
    if (help) addInlineHelpButton(mapTitle, help, showInlineHelpPopover);
  }
  const eventsTitle = view.querySelector<HTMLElement>('[data-specialized="events-title"]');
  if (eventsTitle) {
    const help = SECTION_HELP[ownText(eventsTitle)];
    if (help) addInlineHelpButton(eventsTitle, help, showInlineHelpPopover);
  }
  const evidenceTitle = view.querySelector<HTMLElement>('[data-specialized="evidence-title"]');
  if (evidenceTitle) addInlineHelpButton(evidenceTitle, SECTION_HELP['Event evidence']!, showInlineHelpPopover);
}

export function decorateCompareHelp(root: HTMLElement): void {
  for (const span of root.querySelectorAll<HTMLElement>('.analyzer-controls label > span')) addMatchingHelp(span, COMPARE_CONTROL_HELP);
  for (const evidence of root.querySelectorAll<HTMLElement>('.analyzer-evidence > div')) {
    const label = evidence.querySelector<HTMLElement>(':scope > span');
    if (!label) continue;
    const help = COMPARE_EVIDENCE_HELP[ownText(label)];
    if (help) addInlineHelpButton(evidence, help, showInlineHelpPopover);
  }
}

export function decorateTuneHelp(root: HTMLElement): void {
  for (const span of root.querySelectorAll<HTMLElement>('.tune-table-controls label > span')) addMatchingHelp(span, TUNE_CONTROL_HELP);
  for (const item of root.querySelectorAll<HTMLElement>('.tune-table-summary > div')) {
    const label = item.querySelector<HTMLElement>(':scope > span');
    if (!label) continue;
    const help = TUNE_SUMMARY_HELP[ownText(label)];
    if (help) addInlineHelpButton(item, help, showInlineHelpPopover);
  }
}
