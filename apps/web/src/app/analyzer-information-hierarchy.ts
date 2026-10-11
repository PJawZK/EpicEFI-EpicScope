const SPECIALIZED_PRIMARY: Readonly<Record<string, readonly string[]>> = {
  Idle: ['RPM mean', 'Target mean', 'RPM error MAE / RMSE', 'Worst sag', 'Median recovery', 'Sag events'],
  'AE / MAP Predict': ['Events', 'Tip-in / decel', 'Predict error MAE', 'Peak lean excursion', 'Peak rich excursion'],
  Fueling: ['Mean error', 'MAE', 'DFCO status', 'Window-stable coverage', 'Observed mixture delay median', 'Delay evidence strength'],
  Ignition: ['Advance mean', 'Retard mean', 'Knock mean / max', 'Knock events'],
  'Fuel Pressure / Injector': ['Rail diff mean / min', 'Injector duty mean / max', 'Low pressure events', 'High duty events'],
  'Trigger / Sync': ['Events', 'Trigger error max', 'Loss counter max', 'RPM mean / max'],
};

const BOOST_PRIMARY = new Set([
  'Measured mean',
  'Measured max',
  'Peak RPM',
  'Mean error',
  'Target attainment',
  'Upper duty mean',
  'Lower duty mean',
]);

interface TableDisclosureSpec {
  readonly selector: string;
  readonly primaryHeaders: ReadonlySet<string>;
}

const TABLE_DISCLOSURES: readonly TableDisclosureSpec[] = [
  {
    selector: '.specialized-analyzer-map-table',
    primaryHeaders: new Set(['RPM bin', 'Load bin', 'Samples', 'Stable samples', 'Actual mixture', 'Target mixture', 'Error mean', 'Evidence', 'Bias']),
  },
  {
    selector: '.boost-operating-table',
    primaryHeaders: new Set(['RPM bin', 'TPS/load bin', 'Samples', 'Pressure mean', 'Evidence', 'Assessment', 'Upper duty mean', 'Lower duty mean']),
  },
  {
    selector: '.boost-comparison-table',
    primaryHeaders: new Set(['RPM bin', 'TPS/load bin', 'Primary N', 'Compare N', 'Δ pressure', 'Δ upper duty', 'Δ lower duty', 'Observed result']),
  },
  {
    selector: '.boost-open-spool-table',
    primaryHeaders: new Set(['#', 'Duration', 'T50', 'T90', 'Start P', 'End P', 'Start RPM', 'End RPM']),
  },
  {
    selector: '.boost-spool-table',
    primaryHeaders: new Set(['#', 'Duration', 'T50', 'T90', 'Start P', 'End P', 'Target', 'Start RPM', 'End RPM']),
  },
  {
    selector: '.boost-steady-table',
    primaryHeaders: new Set(['#', 'Duration', 'Samples', 'Target mean', 'Measured mean', 'Mean error', 'Overshoot', 'Undershoot']),
  },
];

function ownText(host: HTMLElement | null): string {
  if (!host) return '';
  const node = [...host.childNodes].find((candidate) => candidate.nodeType === Node.TEXT_NODE);
  return node?.textContent?.trim() ?? host.textContent?.trim() ?? '';
}

function setDatasetValue(element: HTMLElement, key: string, value: string | undefined): void {
  if (value === undefined) {
    if (element.dataset[key] !== undefined) delete element.dataset[key];
    return;
  }
  if (element.dataset[key] !== value) element.dataset[key] = value;
}

function setButtonState(button: HTMLButtonElement, expanded: boolean, openText: string, closedText: string): void {
  const nextText = expanded ? openText : closedText;
  if (button.getAttribute('aria-expanded') !== String(expanded)) button.setAttribute('aria-expanded', String(expanded));
  if (button.textContent !== nextText) button.textContent = nextText;
}

function ensureSummaryToggle(
  view: HTMLElement,
  summary: HTMLElement,
  key: string,
  primaryLabels: ReadonlySet<string>,
): void {
  if (view.dataset.analyzerHierarchyKey !== key) {
    view.dataset.analyzerHierarchyKey = key;
    view.classList.remove('analyzer-summary-expanded');
  }

  let secondaryCount = 0;
  for (const card of summary.querySelectorAll<HTMLElement>(':scope > div')) {
    const label = ownText(card.querySelector<HTMLElement>(':scope > span'));
    const secondary = !primaryLabels.has(label);
    setDatasetValue(card, 'analyzerSecondarySummary', secondary ? 'true' : undefined);
    if (secondary) secondaryCount += 1;
  }

  let button = summary.parentElement?.querySelector<HTMLButtonElement>(':scope > .analyzer-summary-toggle');
  if (secondaryCount === 0) {
    button?.remove();
    view.classList.remove('analyzer-summary-expanded');
    return;
  }
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'analyzer-summary-toggle';
    button.addEventListener('click', () => {
      const expanded = !view.classList.contains('analyzer-summary-expanded');
      view.classList.toggle('analyzer-summary-expanded', expanded);
      setButtonState(button!, expanded, 'Less details', 'More details');
    });
    summary.insertAdjacentElement('afterend', button);
  }
  button.hidden = false;
  setButtonState(button, view.classList.contains('analyzer-summary-expanded'), 'Less details', 'More details');
}

function specializeSummary(view: HTMLElement): void {
  const title = view.querySelector<HTMLElement>('[data-specialized="title"]')?.textContent?.split('·')[0]?.trim() ?? '';
  const labels = SPECIALIZED_PRIMARY[title];
  const summary = view.querySelector<HTMLElement>('.specialized-analyzer-summary');
  if (!labels || !summary) return;
  ensureSummaryToggle(view, summary, `specialized:${title}`, new Set(labels));
}

function boostSummary(view: HTMLElement): void {
  const summary = view.querySelector<HTMLElement>('.boost-analyzer-summary');
  if (!summary) return;
  ensureSummaryToggle(view, summary, 'boost', BOOST_PRIMARY);
  const evidence = view.querySelector<HTMLElement>('.boost-evidence:not(.boost-duty-response-summary)');
  if (evidence) setDatasetValue(evidence, 'analyzerSecondarySummary', 'true');
}

function setColumnDisclosure(table: HTMLTableElement, primaryHeaders: ReadonlySet<string>): void {
  const headerRow = table.tHead?.rows[0];
  const body = table.tBodies[0];
  if (!headerRow || !body) return;
  const headers = [...headerRow.cells];
  if (!headers.length) return;

  let secondaryCount = 0;
  headers.forEach((header, index) => {
    const secondary = !primaryHeaders.has(header.textContent?.trim() ?? '');
    setDatasetValue(header, 'analyzerSecondaryColumn', secondary ? 'true' : undefined);
    if (secondary) secondaryCount += 1;
    for (const row of [...body.rows]) {
      const cell = row.cells[index];
      if (cell) setDatasetValue(cell, 'analyzerSecondaryColumn', secondary ? 'true' : undefined);
    }
  });

  const section = table.closest<HTMLElement>('section');
  const header = section?.querySelector<HTMLElement>(':scope > header');
  if (!header) return;
  let button = header.querySelector<HTMLButtonElement>(':scope > .analyzer-columns-toggle');
  if (secondaryCount === 0) {
    button?.remove();
    table.classList.remove('analyzer-columns-expanded');
    return;
  }
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'analyzer-columns-toggle';
    button.addEventListener('click', () => {
      const expanded = !table.classList.contains('analyzer-columns-expanded');
      table.classList.toggle('analyzer-columns-expanded', expanded);
      setButtonState(button!, expanded, 'Fewer columns', 'More columns');
    });
    header.append(button);
  }
  button.hidden = false;
  setButtonState(button, table.classList.contains('analyzer-columns-expanded'), 'Fewer columns', 'More columns');
}

function standardizeInfoIcons(root: HTMLElement): void {
  for (const icon of root.querySelectorAll<HTMLElement>('.epicscope-inline-help, .histogram-table-help > summary, .channel-details')) {
    if (!icon.classList.contains('epicscope-info-icon')) icon.classList.add('epicscope-info-icon');
    if (icon.classList.contains('channel-details')) {
      if (icon.textContent !== 'i') icon.textContent = 'i';
      if (!icon.getAttribute('aria-label')) icon.setAttribute('aria-label', icon.getAttribute('title') ?? 'Channel information');
    }
  }
}

function apply(root: HTMLElement): void {
  standardizeInfoIcons(root);
  for (const view of root.querySelectorAll<HTMLElement>('.specialized-analyzer-view')) specializeSummary(view);
  for (const view of root.querySelectorAll<HTMLElement>('.boost-analyzer-view')) boostSummary(view);
  for (const spec of TABLE_DISCLOSURES) {
    for (const table of root.querySelectorAll<HTMLTableElement>(spec.selector)) setColumnDisclosure(table, spec.primaryHeaders);
  }
}

export function installAnalyzerInformationHierarchy(root: HTMLElement): void {
  apply(root);
  const observe = (observer: MutationObserver): void => observer.observe(root, { childList: true, subtree: true });
  const observer = new MutationObserver(() => {
    observer.disconnect();
    try {
      apply(root);
    } finally {
      observe(observer);
    }
  });
  observe(observer);
}
