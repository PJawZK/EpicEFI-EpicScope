const SORTABLE_TABLES = [
  '.boost-operating-table',
  '.boost-open-spool-table',
  '.specialized-analyzer-map-table',
  '.specialized-analyzer-events:not(.specialized-analyzer-map-section) .specialized-analyzer-table',
] as const;

interface SortState {
  columnIndex: number;
  direction: 'ascending' | 'descending';
}

const sortStates = new WeakMap<HTMLTableElement, SortState>();

function targetTable(element: Element | null): HTMLTableElement | undefined {
  if (!(element instanceof HTMLTableElement)) return undefined;
  return SORTABLE_TABLES.some((selector) => element.matches(selector)) ? element : undefined;
}

function numericSortValue(text: string): number | undefined {
  const normalized = text.replace(/,/g, '').replace(/−/g, '-').trim();
  const match = normalized.match(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)/);
  if (!match) return undefined;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : undefined;
}

function evidenceSortValue(text: string): number | undefined {
  const normalized = text.trim().toLowerCase();
  if (normalized === 'weak') return 1;
  if (normalized === 'moderate') return 2;
  if (normalized === 'strong') return 3;
  return undefined;
}

function compareCellText(leftText: string, rightText: string): number {
  const leftEvidence = evidenceSortValue(leftText);
  const rightEvidence = evidenceSortValue(rightText);
  if (leftEvidence !== undefined && rightEvidence !== undefined) return leftEvidence - rightEvidence;
  const leftNumber = numericSortValue(leftText);
  const rightNumber = numericSortValue(rightText);
  if (leftNumber !== undefined && rightNumber !== undefined) return leftNumber - rightNumber;
  if (leftNumber !== undefined) return -1;
  if (rightNumber !== undefined) return 1;
  return leftText.localeCompare(rightText, undefined, { numeric: true, sensitivity: 'base' });
}

function isEmptyStateRow(row: HTMLTableRowElement): boolean {
  return row.dataset.boostEmptyState === 'true' || row.dataset.analyzerEmptyState === 'true';
}

function applySort(table: HTMLTableElement): void {
  const state = sortStates.get(table);
  const body = table.tBodies[0];
  if (!state || !body) return;
  const rows = [...body.rows].filter((row) => !isEmptyStateRow(row));
  if (rows.length < 2) return;
  const direction = state.direction === 'ascending' ? 1 : -1;
  const sorted = [...rows].sort((left, right) => {
    const leftText = left.cells[state.columnIndex]?.textContent?.trim() ?? '';
    const rightText = right.cells[state.columnIndex]?.textContent?.trim() ?? '';
    return compareCellText(leftText, rightText) * direction;
  });
  if (sorted.every((row, index) => row === rows[index])) return;
  for (const row of sorted) body.append(row);
}

function updateHeaderState(table: HTMLTableElement): void {
  const state = sortStates.get(table);
  const headers = [...table.querySelectorAll<HTMLTableCellElement>('thead th')];
  headers.forEach((header, index) => {
    header.setAttribute('aria-sort', state?.columnIndex === index ? state.direction : 'none');
  });
}

function sortByHeader(header: HTMLTableCellElement): void {
  const table = targetTable(header.closest('table'));
  if (!table) return;
  const headers = [...table.querySelectorAll<HTMLTableCellElement>('thead th')];
  const columnIndex = headers.indexOf(header);
  if (columnIndex < 0) return;
  const previous = sortStates.get(table);
  const direction = previous?.columnIndex === columnIndex && previous.direction === 'ascending' ? 'descending' : 'ascending';
  sortStates.set(table, { columnIndex, direction });
  updateHeaderState(table);
  applySort(table);
}

function prepareSortableTable(table: HTMLTableElement): void {
  table.classList.add('boost-sortable-table', 'analyzer-sortable-table');
  for (const header of table.querySelectorAll<HTMLTableCellElement>('thead th')) {
    header.tabIndex = 0;
    header.title = 'Sort ascending / descending';
  }
  updateHeaderState(table);
  applySort(table);
}

function openSpoolFeedback(root: HTMLElement): void {
  const table = root.querySelector<HTMLTableElement>('.boost-open-spool-table');
  const body = table?.tBodies[0];
  if (!table || !body) return;

  const realRows = [...body.rows].filter((row) => row.dataset.boostEmptyState !== 'true');
  if (realRows.length > 0) {
    body.querySelector('[data-boost-empty-state="true"]')?.remove();
    return;
  }

  const enabled = root.querySelector<HTMLInputElement>('.boost-open-spool-enabled');
  const startInput = root.querySelector<HTMLInputElement>('.boost-open-spool-start');
  const endInput = root.querySelector<HTMLInputElement>('.boost-open-spool-end');
  const startPressure = startInput?.value.trim() === '' ? undefined : Number(startInput?.value);
  const endPressure = endInput?.value.trim() === '' ? undefined : Number(endInput?.value);

  let message: string;
  if (!enabled?.checked) {
    message = 'Pressure-rise detection is off. Enable “Detect pressure-rise spool” and enter start/end pressures to search for events.';
  } else if (startPressure === undefined || endPressure === undefined || !Number.isFinite(startPressure) || !Number.isFinite(endPressure)) {
    message = 'Enter finite Open-loop start and end pressures. Both thresholds are required before pressure-rise events can be detected.';
  } else if (endPressure <= startPressure) {
    message = 'Open-loop end pressure must be greater than start pressure.';
  } else {
    message = 'No contiguous qualified start→end pressure rise was found. Qualification or the High-load pull gate can exclude the low-pressure baseline or split the sample stream; try a broader scope/qualification and verify the pressure thresholds match the log.';
  }

  let row = body.querySelector<HTMLTableRowElement>('tr[data-boost-empty-state="true"]');
  if (!row) {
    row = document.createElement('tr');
    row.dataset.boostEmptyState = 'true';
    const cell = document.createElement('td');
    cell.colSpan = table.tHead?.rows[0]?.cells.length ?? 15;
    row.append(cell);
    body.append(row);
  }
  const cell = row.cells[0];
  if (cell && cell.textContent !== message) cell.textContent = message;
}

function ownTextNode(host: HTMLElement): Text | undefined {
  return [...host.childNodes].find((node): node is Text => node.nodeType === Node.TEXT_NODE);
}

function setOwnText(host: HTMLElement, value: string): void {
  const text = ownTextNode(host);
  if (text) text.textContent = value;
  else host.prepend(document.createTextNode(value));
}

function summaryItem(view: HTMLElement, ...labels: string[]): HTMLElement | undefined {
  return [...view.querySelectorAll<HTMLElement>('.specialized-analyzer-summary > div')]
    .find((item) => {
      const text = item.querySelector('span')?.textContent?.trim() ?? '';
      return labels.some((label) => text.startsWith(label));
    });
}

function parseCountPair(text: string): { first: number; second: number } | undefined {
  const matches = [...text.matchAll(/[\d,.]+/g)].map((match) => Number(match[0].replace(/,/g, '')));
  if (matches.length < 2 || !Number.isFinite(matches[0]) || !Number.isFinite(matches[1])) return undefined;
  return { first: matches[0]!, second: matches[1]! };
}

function addFuelingCoverageSummary(view: HTMLElement): void {
  const summary = view.querySelector<HTMLElement>('.specialized-analyzer-summary');
  if (!summary) return;
  const calibration = summaryItem(view, 'Calibration eligible / scoped', 'Context eligible / scoped');
  const stable = summaryItem(view, 'Steady eligible / input', 'Window-stable / context eligible');
  const rejected = summaryItem(view, 'Transient rejected', 'Window rejected');
  const bins = summaryItem(view, 'Steady map bins', 'Steady map bins shown');

  const calibrationLabel = calibration?.querySelector<HTMLElement>('span');
  const stableLabel = stable?.querySelector<HTMLElement>('span');
  const rejectedLabel = rejected?.querySelector<HTMLElement>('span');
  const binsLabel = bins?.querySelector<HTMLElement>('span');
  if (calibrationLabel) setOwnText(calibrationLabel, 'Context eligible / scoped');
  if (stableLabel) setOwnText(stableLabel, 'Window-stable / context eligible');
  if (rejectedLabel) setOwnText(rejectedLabel, 'Window rejected');
  if (binsLabel) setOwnText(binsLabel, 'Steady map bins shown');

  const stableValue = stable?.querySelector<HTMLElement>('strong')?.textContent ?? '';
  const pair = parseCountPair(stableValue);
  let coverage = summary.querySelector<HTMLElement>('[data-fueling-window-coverage="true"]');
  if (!coverage) {
    coverage = document.createElement('div');
    coverage.dataset.fuelingWindowCoverage = 'true';
    const label = document.createElement('span');
    label.textContent = 'Window-stable coverage';
    const strong = document.createElement('strong');
    coverage.append(label, strong);
    if (stable?.nextSibling) summary.insertBefore(coverage, stable.nextSibling);
    else summary.append(coverage);
  }
  const coverageValue = coverage.querySelector<HTMLElement>('strong');
  if (coverageValue) {
    coverageValue.textContent = pair && pair.second > 0 ? `${((pair.first / pair.second) * 100).toFixed(1)}%` : '—';
  }
}

function fuelingEvidenceThreshold(view: HTMLElement): number {
  const input = view.querySelector<HTMLInputElement>('input[data-option="mapMinSamples"]');
  const value = Number(input?.value);
  return Number.isInteger(value) && value >= 1 ? value : 10;
}

function evidenceForSamples(samples: number, threshold: number): 'weak' | 'moderate' | 'strong' {
  if (samples < threshold) return 'weak';
  if (samples < threshold * 3) return 'moderate';
  return 'strong';
}

function enhanceFuelingMap(view: HTMLElement): void {
  const table = view.querySelector<HTMLTableElement>('.specialized-analyzer-map-table');
  if (!table?.tHead || !table.tBodies[0] || table.tHead.rows.length === 0) return;
  const headerRow = table.tHead.rows[0]!;
  const headers = [...headerRow.cells];
  const sampleIndex = headers.findIndex((cell) => cell.textContent?.trim() === 'Samples' || cell.textContent?.trim() === 'Stable samples');
  if (sampleIndex < 0) return;
  const sampleHeader = headers[sampleIndex]!;
  if (sampleHeader.textContent?.trim() !== 'Stable samples') sampleHeader.textContent = 'Stable samples';

  const threshold = fuelingEvidenceThreshold(view);
  let evidenceIndex = [...headerRow.cells].findIndex((cell) => cell.textContent?.trim() === 'Evidence');
  if (evidenceIndex < 0) {
    const evidenceHeader = document.createElement('th');
    evidenceHeader.textContent = 'Evidence';
    headerRow.append(evidenceHeader);
    evidenceIndex = headerRow.cells.length - 1;
  }

  for (const row of [...table.tBodies[0].rows]) {
    if (isEmptyStateRow(row)) {
      if (row.cells.length === 1) row.cells[0]!.colSpan = headerRow.cells.length;
      const cell = row.cells[0];
      if (cell) cell.textContent = 'No RPM/load bin accumulated a window-stable sample with the current context and stability settings. Low-count bins are no longer hidden; if this remains empty, widen the stability limits/window or inspect the context exclusions above.';
      continue;
    }
    const samples = numericSortValue(row.cells[sampleIndex]?.textContent ?? '') ?? 0;
    const evidence = evidenceForSamples(samples, threshold);
    let cell = row.cells[evidenceIndex];
    if (!cell) cell = row.insertCell(evidenceIndex);
    cell.textContent = evidence === 'weak' ? 'Weak' : evidence === 'moderate' ? 'Moderate' : 'Strong';
    cell.dataset.fuelingEvidence = evidence;
    row.dataset.fuelingEvidence = evidence;
    row.title = evidence === 'weak'
      ? `Weak evidence: fewer than ${threshold} window-stable samples. The bin stays visible but should not drive a tuning conclusion by itself.`
      : evidence === 'moderate'
        ? `Moderate evidence: at least ${threshold} window-stable samples.`
        : `Strong evidence: at least ${threshold * 3} window-stable samples.`;
  }

  const minSamplesLabel = view.querySelector<HTMLElement>('input[data-option="mapMinSamples"]')?.closest('label')?.querySelector<HTMLElement>('span');
  const settleLabel = view.querySelector<HTMLElement>('input[data-option="mapSettleMs"]')?.closest('label')?.querySelector<HTMLElement>('span');
  const rpmRateLabel = view.querySelector<HTMLElement>('input[data-option="mapMaxRpmRate"]')?.closest('label')?.querySelector<HTMLElement>('span');
  const loadRateLabel = view.querySelector<HTMLElement>('input[data-option="mapMaxLoadRate"]')?.closest('label')?.querySelector<HTMLElement>('span');
  if (minSamplesLabel) setOwnText(minSamplesLabel, 'Map evidence threshold / bin');
  if (settleLabel) setOwnText(settleLabel, 'Map stability window ms');
  if (rpmRateLabel) setOwnText(rpmRateLabel, 'Window max RPM trend / s');
  if (loadRateLabel) setOwnText(loadRateLabel, 'Window max load trend / s');
}

function fuelingFeedback(root: HTMLElement): void {
  for (const view of root.querySelectorAll<HTMLElement>('.specialized-analyzer-view')) {
    const title = view.querySelector<HTMLElement>('[data-specialized="title"]')?.textContent?.trim() ?? '';
    if (!title.startsWith('Fueling')) continue;
    addFuelingCoverageSummary(view);
    enhanceFuelingMap(view);
  }
}

function apply(root: HTMLElement): void {
  fuelingFeedback(root);
  for (const selector of SORTABLE_TABLES) {
    const table = root.querySelector<HTMLTableElement>(selector);
    if (table) prepareSortableTable(table);
  }
  openSpoolFeedback(root);
}

export function installBoostTableEnhancements(root: HTMLElement): void {
  apply(root);

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const header = target.closest<HTMLTableCellElement>('.analyzer-sortable-table thead th');
    if (header) sortByHeader(header);
  });

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const header = target.closest<HTMLTableCellElement>('.analyzer-sortable-table thead th');
    if (!header) return;
    event.preventDefault();
    sortByHeader(header);
  });

  const observe = (observer: MutationObserver): void => {
    observer.observe(root, { childList: true, subtree: true, characterData: true });
  };
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
