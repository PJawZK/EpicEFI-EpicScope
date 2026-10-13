import { addInlineHelpButton, showInlineHelpPopover, type InlineHelpEntry } from '../components/inline-help';

export interface FuelInjectorPresentationInput {
  readonly injectorDutyMax?: number;
  readonly highDutyThreshold: number;
  readonly highDutyEvents: number;
  readonly lowPressureThreshold?: number;
  readonly lowPressureEvents: number;
  readonly railDifferentialSelected: boolean;
  readonly railDifferentialLooksLikeMap: boolean;
}

export interface FuelInjectorPresentationDecision {
  readonly capacity: string;
  readonly headroom: string;
  readonly pressure: string;
  readonly review: string;
}

const HELP: Readonly<Record<'capacity' | 'headroom' | 'pressure' | 'review', InlineHelpEntry>> = {
  capacity: {
    title: 'Injector capacity evidence',
    text: 'Classifies the observed maximum injector duty against the selected high-duty threshold and 100% scheduling limit. It describes logged headroom only; it does not predict injector flow capacity outside the analyzed scope.',
  },
  headroom: {
    title: 'Minimum duty headroom',
    text: '100% minus the highest observed injector duty. Negative values are kept visible when logged duty exceeds 100% so requested/scheduled saturation evidence is not hidden.',
  },
  pressure: {
    title: 'Differential-pressure evidence',
    text: 'Summarizes whether a true rail-differential channel and optional low-pressure threshold provide usable pressure evidence. MAP/manifold pressure is load/reference context, not rail differential by itself.',
  },
  review: {
    title: 'Areas to review',
    text: 'Counts threshold-derived low-differential and high-duty events in the current scope. These are observational evidence anchors for Logger inspection, not automatic diagnoses of pump, regulator or injector faults.',
  },
};

function formatNumber(value: number, precision = 1): string {
  return value.toFixed(precision).replace(/\.0+$/, '');
}

export function describeFuelInjectorPresentation(input: FuelInjectorPresentationInput): FuelInjectorPresentationDecision {
  const dutyMax = input.injectorDutyMax;
  let capacity = 'Injector duty not selected';
  let headroom = '—';
  if (dutyMax !== undefined && Number.isFinite(dutyMax)) {
    const remaining = 100 - dutyMax;
    headroom = `${remaining >= 0 ? '' : '−'}${formatNumber(Math.abs(remaining))}%`;
    if (dutyMax >= 100) capacity = `Saturation observed · ${formatNumber(dutyMax)}% max`;
    else if (dutyMax > input.highDutyThreshold) capacity = `Reduced headroom · ${formatNumber(dutyMax)}% max`;
    else capacity = `No high-duty evidence · ${formatNumber(dutyMax)}% max`;
  }

  let pressure: string;
  if (input.railDifferentialLooksLikeMap) pressure = 'Mapping needs review · MAP is not rail differential';
  else if (!input.railDifferentialSelected) pressure = 'No rail-differential channel selected';
  else if (input.lowPressureThreshold === undefined) pressure = 'Differential selected · no low-pressure limit set';
  else if (input.lowPressureEvents > 0) pressure = `${input.lowPressureEvents} event${input.lowPressureEvents === 1 ? '' : 's'} below ${formatNumber(input.lowPressureThreshold)} `;
  else pressure = `No event below ${formatNumber(input.lowPressureThreshold)}`;

  const totalEvents = input.lowPressureEvents + input.highDutyEvents;
  const review = totalEvents > 0
    ? `${totalEvents} threshold event${totalEvents === 1 ? '' : 's'} to inspect`
    : 'No threshold review events in this scope';

  return { capacity, headroom, pressure: pressure.trim(), review };
}

function ownText(element: Element | null): string {
  if (!element) return '';
  return [...element.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? '')
    .join(' ')
    .trim();
}

function summaryValue(summary: HTMLElement, label: string): string | undefined {
  for (const card of summary.querySelectorAll<HTMLElement>(':scope > div')) {
    if (ownText(card.querySelector('span')) !== label) continue;
    return card.querySelector('strong')?.textContent?.trim();
  }
  return undefined;
}

function parseLastNumber(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const matches = text.match(/[-+]?\d+(?:\.\d+)?/g);
  if (!matches?.length) return undefined;
  const value = Number(matches[matches.length - 1]);
  return Number.isFinite(value) ? value : undefined;
}

function parseCount(text: string | undefined): number {
  const value = parseLastNumber(text);
  return value === undefined ? 0 : Math.max(0, Math.trunc(value));
}

function optionNumber(view: HTMLElement, key: string): number | undefined {
  const value = view.querySelector<HTMLInputElement>(`input[data-option="${key}"]`)?.value.trim();
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function addDecisionCard(host: HTMLElement, label: string, value: string, help: InlineHelpEntry): void {
  const card = document.createElement('div');
  const caption = document.createElement('span');
  caption.textContent = label;
  addInlineHelpButton(caption, help, showInlineHelpPopover);
  const strong = document.createElement('strong');
  strong.textContent = value;
  card.append(caption, strong);
  host.append(card);
}

function cleanup(view: HTMLElement): void {
  view.querySelector('.fuel-injector-decision-summary')?.remove();
  view.querySelector('.fuel-injector-mapping-warning')?.remove();
  view.querySelector('[data-fuel-injector-empty-state="true"]')?.remove();
}

function applyFuelInjectorAnalyzerPresentation(view: HTMLElement): void {
  const title = view.querySelector<HTMLElement>('[data-specialized="title"]')?.textContent?.trim() ?? '';
  if (!title.startsWith('Fuel Pressure / Injector')) {
    cleanup(view);
    return;
  }

  const summary = view.querySelector<HTMLElement>('.specialized-analyzer-summary:not(.fuel-injector-decision-summary)');
  if (!summary) return;
  const dutyMax = parseLastNumber(summaryValue(summary, 'Injector duty mean / max'));
  const lowEvents = parseCount(summaryValue(summary, 'Low pressure events'));
  const highEvents = parseCount(summaryValue(summary, 'High duty events'));
  const highThreshold = optionNumber(view, 'highDuty') ?? 90;
  const lowThreshold = optionNumber(view, 'lowPressure');
  const railSelect = view.querySelector<HTMLSelectElement>('select[data-role="railDiff"]');
  const railSelected = Boolean(railSelect?.value);
  const selectedRailText = railSelect?.selectedOptions[0]?.textContent?.trim() ?? '';
  const looksLikeMap = railSelected
    && /(?:^|\b)map(?:\b|$)|manifold.*pressure/i.test(selectedRailText)
    && !/(?:diff|delta|differential)/i.test(selectedRailText);

  const decision = describeFuelInjectorPresentation({
    ...(dutyMax !== undefined ? { injectorDutyMax: dutyMax } : {}),
    highDutyThreshold: highThreshold,
    highDutyEvents: highEvents,
    ...(lowThreshold !== undefined ? { lowPressureThreshold: lowThreshold } : {}),
    lowPressureEvents: lowEvents,
    railDifferentialSelected: railSelected,
    railDifferentialLooksLikeMap: looksLikeMap,
  });

  let decisionHost = view.querySelector<HTMLElement>('.fuel-injector-decision-summary');
  if (!decisionHost) {
    decisionHost = document.createElement('div');
    decisionHost.className = 'specialized-analyzer-summary fuel-injector-decision-summary';
    summary.before(decisionHost);
  }
  decisionHost.replaceChildren();
  addDecisionCard(decisionHost, 'Injector capacity', decision.capacity, HELP.capacity);
  addDecisionCard(decisionHost, 'Minimum duty headroom', decision.headroom, HELP.headroom);
  addDecisionCard(decisionHost, 'Differential pressure', decision.pressure, HELP.pressure);
  addDecisionCard(decisionHost, 'Areas to review', decision.review, HELP.review);

  let warning = view.querySelector<HTMLElement>('.fuel-injector-mapping-warning');
  if (looksLikeMap) {
    if (!warning) {
      warning = document.createElement('div');
      warning.className = 'specialized-analyzer-guidance fuel-injector-mapping-warning';
      const controls = view.querySelector<HTMLElement>('.specialized-analyzer-controls');
      controls?.after(warning);
    }
    warning.hidden = false;
    warning.innerHTML = '<strong>Rail differential mapping needs review</strong><span></span>';
    const text = warning.querySelector<HTMLElement>('span');
    if (text) text.textContent = `“${selectedRailText}” appears to be MAP/manifold pressure. MAP is useful load/reference context, but it is not differential fuel pressure by itself. Select a true rail differential channel (fuel pressure minus manifold/reference pressure) or leave Rail differential unselected.`;
  } else {
    warning?.remove();
  }

  const totalEvents = lowEvents + highEvents;
  const eventBody = view.querySelector<HTMLTableSectionElement>('.specialized-analyzer-events:not(.specialized-analyzer-map-section) .specialized-analyzer-table tbody');
  if (!eventBody) return;
  const existingEmpty = eventBody.querySelector<HTMLTableRowElement>('[data-fuel-injector-empty-state="true"]');
  if (totalEvents > 0) {
    existingEmpty?.remove();
    return;
  }
  if (eventBody.querySelector('tr:not([data-fuel-injector-empty-state="true"])')) return;
  if (existingEmpty) return;
  const row = document.createElement('tr');
  row.dataset.fuelInjectorEmptyState = 'true';
  const cell = document.createElement('td');
  const headerCount = view.querySelectorAll('.specialized-analyzer-events:not(.specialized-analyzer-map-section) .specialized-analyzer-table thead th').length;
  cell.colSpan = Math.max(1, headerCount);
  cell.textContent = railSelected && !looksLikeMap
    ? 'No low-pressure or high-duty review events were found in this scope at the current thresholds.'
    : 'No injector-duty review events were found. Select a valid rail-differential channel and threshold to add pressure-event evidence.';
  row.append(cell);
  eventBody.append(row);
}

export function ensureFuelInjectorAnalyzerPresentation(root: HTMLElement): void {
  for (const view of root.querySelectorAll<HTMLElement>('.specialized-analyzer-view')) {
    applyFuelInjectorAnalyzerPresentation(view);
  }
}
