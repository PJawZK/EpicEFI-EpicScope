const BOOST_SORT_TABLES = ['.boost-operating-table', '.boost-open-spool-table'] as const;

interface SortState {
  columnIndex: number;
  direction: 'ascending' | 'descending';
}

const sortStates = new WeakMap<HTMLTableElement, SortState>();
let applyingEnhancements = false;

function targetTable(element: Element | null): HTMLTableElement | undefined {
  if (!(element instanceof HTMLTableElement)) return undefined;
  return BOOST_SORT_TABLES.some((selector) => element.matches(selector)) ? element : undefined;
}

function numericSortValue(text: string): number | undefined {
  const normalized = text.replace(/,/g, '').replace(/−/g, '-').trim();
  const match = normalized.match(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)/);
  if (!match) return undefined;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : undefined;
}

function compareCellText(leftText: string, rightText: string): number {
  const leftNumber = numericSortValue(leftText);
  const rightNumber = numericSortValue(rightText);
  if (leftNumber !== undefined && rightNumber !== undefined) return leftNumber - rightNumber;
  if (leftNumber !== undefined) return -1;
  if (rightNumber !== undefined) return 1;
  return leftText.localeCompare(rightText, undefined, { numeric: true, sensitivity: 'base' });
}

function applySort(table: HTMLTableElement): void {
  const state = sortStates.get(table);
  const body = table.tBodies[0];
  if (!state || !body) return;
  const rows = [...body.rows].filter((row) => row.dataset.boostEmptyState !== 'true');
  if (rows.length < 2) return;
  const direction = state.direction === 'ascending' ? 1 : -1;
  rows.sort((left, right) => {
    const leftText = left.cells[state.columnIndex]?.textContent?.trim() ?? '';
    const rightText = right.cells[state.columnIndex]?.textContent?.trim() ?? '';
    return compareCellText(leftText, rightText) * direction;
  });
  for (const row of rows) body.append(row);
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
  table.classList.add('boost-sortable-table');
  for (const header of table.querySelectorAll<HTMLTableCellElement>('thead th')) {
    header.tabIndex = 0;
    header.setAttribute('role', 'button');
    header.title = 'Sort low to high / high to low';
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
  row.cells[0]!.textContent = message;
}

function apply(root: HTMLElement): void {
  if (applyingEnhancements) return;
  applyingEnhancements = true;
  try {
    for (const selector of BOOST_SORT_TABLES) {
      const table = root.querySelector<HTMLTableElement>(selector);
      if (table) prepareSortableTable(table);
    }
    openSpoolFeedback(root);
  } finally {
    applyingEnhancements = false;
  }
}

export function installBoostTableEnhancements(root: HTMLElement): void {
  apply(root);

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const header = target.closest<HTMLTableCellElement>('.boost-sortable-table thead th');
    if (header) sortByHeader(header);
  });

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const header = target.closest<HTMLTableCellElement>('.boost-sortable-table thead th');
    if (!header) return;
    event.preventDefault();
    sortByHeader(header);
  });

  const observer = new MutationObserver(() => apply(root));
  observer.observe(root, { childList: true, subtree: true, characterData: true });
}
