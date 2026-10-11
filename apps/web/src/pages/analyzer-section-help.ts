import { addInlineHelpButton, showInlineHelpPopover, type InlineHelpEntry } from '../components/inline-help';

const BOOST_SECTION_HELP: Readonly<Record<string, InlineHelpEntry>> = {
  'RPM × TPS/load operating points': {
    title: 'RPM × TPS/load operating points',
    text: 'Groups qualified Open Loop samples into comparable RPM/load regions. Use Evidence and Assessment first, then expand More columns only when you need variation, trends or detailed duty context.',
  },
  'Matched scope comparison': {
    title: 'Matched scope comparison',
    text: 'Compares only RPM/load bins present in both selected scopes using the same bin geometry and qualification. Pressure and duty deltas describe what changed in matched evidence; they do not assume a direction of causality.',
  },
  'Open-loop pressure-rise spool events': {
    title: 'Open-loop pressure-rise spool events',
    text: 'Measured-pressure spool events detected between the configured start and end pressure without requiring Boost Target. T10/T50/T90 describe when the observed pressure rise crossed 10%, 50% and 90% of that configured rise.',
  },
  'Target-relative spool events': {
    title: 'Target-relative spool events',
    text: 'Closed-loop spool events measured relative to Boost Target. These are only meaningful when the selected target channel represents the active controller target.',
  },
  'Closed-loop steady-state windows': {
    title: 'Closed-loop steady-state windows',
    text: 'Periods where commanded target and measured pressure remained sufficiently stable for sustained tracking analysis. Use these separately from spool/transient evidence when judging steady closed-loop error.',
  },
};

const SPECIALIZED_SECTION_HELP: readonly { pattern: RegExp; help: InlineHelpEntry }[] = [
  {
    pattern: /operating points/i,
    help: { title: 'Operating-point evidence', text: 'Groups usable samples into operating regions so the result can be interpreted against where the engine was actually running. Evidence strength matters more than merely having a populated row.' },
  },
  {
    pattern: /response.*delay|delay.*event/i,
    help: { title: 'Observed response-delay events', text: 'Isolated fuel-command changes followed by a measurable mixture response. The timing includes combustion, exhaust transport, sensor/controller response, filtering and logging latency; it is not pure sensor delay.' },
  },
  {
    pattern: /transient/i,
    help: { title: 'Transient events', text: 'Detected short-duration state changes grouped into inspectable events. Select individual rows to compare their timing and source evidence instead of relying only on aggregate counts.' },
  },
  {
    pattern: /knock/i,
    help: { title: 'Knock-oriented events', text: 'Threshold-crossing evidence from the selected knock signal with timing/peak context. Treat these as events to inspect, not automatic confirmation of combustion knock.' },
  },
  {
    pattern: /fuel.*injector/i,
    help: { title: 'Fuel / injector events', text: 'Threshold-derived fuel-pressure and injector-duty events. They highlight where pressure or injector headroom deserves inspection without assigning a cause automatically.' },
  },
  {
    pattern: /sync|trigger/i,
    help: { title: 'Sync / trigger events', text: 'Synchronization dropouts, trigger-error excursions and sync-loss-counter increments grouped with their source timing so they can be inspected in Logger.' },
  },
  {
    pattern: /event evidence|aligned/i,
    help: { title: 'Aligned event evidence', text: 'Multiple events shifted to a common t=0 for timing/shape comparison. The aggregate view complements, rather than replaces, the original Logger traces.' },
  },
];

function ownText(host: HTMLElement): string {
  const textNode = [...host.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
  return textNode?.textContent?.trim() ?? host.textContent?.trim() ?? '';
}

export function ensureAnalyzerSectionHelp(root: HTMLElement): void {
  for (const header of root.querySelectorAll<HTMLElement>('.boost-result-section > header > strong')) {
    const help = BOOST_SECTION_HELP[ownText(header)];
    if (help) addInlineHelpButton(header, help, showInlineHelpPopover);
  }

  for (const header of root.querySelectorAll<HTMLElement>('.specialized-analyzer-events > header > strong, .specialized-analyzer-evidence > header strong')) {
    const text = ownText(header);
    const help = SPECIALIZED_SECTION_HELP.find((entry) => entry.pattern.test(text))?.help;
    if (help) addInlineHelpButton(header, help, showInlineHelpPopover);
  }
}
