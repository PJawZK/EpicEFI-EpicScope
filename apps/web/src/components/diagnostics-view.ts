import { filterRecords, operationRows, RECORD_FILTERS, type DiagnosticsCapture, type RecordFilters, type OperationRow } from '../observability/diagnostics';
import { buildPreviousSessionReport } from '../observability/reports/previous-session-report';
const PAGE_SIZE = 200;
const lenses = ['Health', 'Timeline', 'Operations', 'Anomalies', 'Performance', 'Parser', 'Resources', 'Errors', 'Previous session', 'Export report'] as const;
export function createDiagnosticsView(refresh: () => void, onLensChange: (lens: string) => void) {
  const element = document.createElement('section'); element.className = 'diagnostics-view';
  const toolbar = document.createElement('div'); toolbar.className = 'diagnostics-toolbar';
  const select = document.createElement('select'); select.setAttribute('aria-label', 'Diagnostics view');
  for (const lens of lenses) select.add(new Option(lens, lens));
  const refreshButton = document.createElement('button'); refreshButton.type = 'button'; refreshButton.textContent = 'Refresh snapshot'; refreshButton.addEventListener('click', refresh);
  const stamp = document.createElement('small'); toolbar.append(select, refreshButton, stamp);
  const filters = document.createElement('details'); filters.className = 'diagnostics-filters'; const summary = document.createElement('summary'); summary.textContent = 'Filter captured records (exact values; search matches name, reason, operation or anomaly code)'; filters.append(summary);
  const inputs = new Map<string, HTMLInputElement>();
  for (const field of RECORD_FILTERS) {
    const label = document.createElement('label'); label.textContent = field;
    const input = document.createElement('input'); input.type = 'text'; input.setAttribute('aria-label', `Diagnostics ${field}`); input.addEventListener('change', () => { page = 0; render(); });
    inputs.set(field, input); label.append(input); filters.append(label);
  }
  const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'Clear filters'; reset.addEventListener('click', () => { for (const input of inputs.values()) input.value = ''; page = 0; render(); }); filters.append(reset);
  const status = document.createElement('div'); status.className = 'diagnostics-page-status'; status.setAttribute('role', 'status');
  const content = document.createElement('div'); content.className = 'diagnostics-content';
  const pager = document.createElement('div'); pager.className = 'diagnostics-pager';
  const back = document.createElement('button'), next = document.createElement('button'); back.type = next.type = 'button'; back.textContent = 'Previous page'; next.textContent = 'Next page';
  back.addEventListener('click', () => { page--; render(); }); next.addEventListener('click', () => { page++; render(); }); pager.append(back, next);
  element.append(toolbar, filters, status, content, pager);
  let capture: DiagnosticsCapture | undefined, page = 0, operations: readonly OperationRow[] | undefined;
  const text = (value: string) => { const pre = document.createElement('pre'); pre.textContent = value; content.replaceChildren(pre); };
  function render() {
    if (!capture) return;
    element.dataset.lens = select.value;
    const lens = select.value, paged = ['Timeline', 'Operations', 'Anomalies', 'Errors'].includes(lens);
    filters.hidden = !paged; pager.hidden = !paged;
    stamp.textContent = `Captured ${capture.capturedAt} · ${capture.records.length} records`;
    status.textContent = `Retained evidence; evicted=${capture.retention.evicted}, rejected=${capture.retention.rejected}, coalesced=${capture.retention.coalesced}. Refresh to include later events.`;
    if (!paged) {
      if (lens === 'Health') text([`Session ${capture.sessionId}`, `${capture.health.issues.length} current issues / ${capture.health.warnings.length} warnings`, ...capture.health.issues, ...capture.health.warnings, 'Historical anomalies are separate from current health. Retained evidence is incomplete when pressure/loss is reported.'].join('\n'));
      if (lens === 'Performance') text(capture.performanceReport);
      if (lens === 'Parser') text(capture.parserReport);
      if (lens === 'Resources') text(JSON.stringify(capture.resources, null, 2));
      if (lens === 'Previous session') text(buildPreviousSessionReport(capture.persistence));
      if (lens === 'Export report') text('The complete captured report is below. Copy/text/ZIP export includes the full snapshot regardless of filters or pagination. Local diagnostics can include filenames, environment details, messages and stacks.');
      onLensChange(lens);
      return;
    }
    const values: RecordFilters = {}; for (const [key, input] of inputs) if (input.value) values[key as keyof RecordFilters] = input.value;
    const records = filterRecords(capture.records, values);
    const selected = lens === 'Errors' ? records.filter(r => r.name === 'runtime.error' || r.name === 'runtime.unhandledrejection') : lens === 'Anomalies' ? records.filter(r => r.name === 'anomaly.detected') : records;
    let lines: string[];
    let total: number;
    if (lens === 'Operations') {
      operations ??= operationRows(capture.records);
      const ids = new Set(selected.map(r => r.operationId));
      const rows = operations.filter(r => ids.has(r.id)); total = rows.length;
      page = Math.max(0, Math.min(page, Math.ceil(total / PAGE_SIZE) - 1));
      lines = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(r => `${'  '.repeat(Math.min(r.depth, 8))}${r.id} | parent=${r.parentId ?? 'root'} | ${r.name} | ${r.outcome}${r.durationMs === undefined ? '' : ` | elapsed=${r.durationMs}ms (not CPU)`}${r.missingStart ? ' | start not retained' : ''}${r.orphan ? ' | parent not retained' : ''}${r.cycle ? ' | cyclic relationship evidence' : ''} | stale=${r.staleCompletions}`);
    } else {
      total = selected.length; page = Math.max(0, Math.min(page, Math.ceil(total / PAGE_SIZE) - 1));
      lines = selected.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(r => `${r.sequence} | ${r.monotonicTime.toFixed(1)}ms | ${r.name} | ${r.component} | ${r.origin} | ${r.severity ?? 'info'}${r.operationId ? ` | op=${r.operationId}` : ''}${r.outcome ? ` | ${r.outcome}` : ''}${r.reason ? ` | ${r.reason}` : ''} | ${JSON.stringify(r.metadata)}`);
    }
    const list = document.createElement('ol'); list.className = 'diagnostics-records'; list.start = page * PAGE_SIZE + 1;
    for (const line of lines) { const li = document.createElement('li'); li.textContent = line; list.append(li); }
    content.replaceChildren(list); status.textContent += ` Showing ${total ? page * PAGE_SIZE + 1 : 0}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total} matches; page ${page + 1}/${Math.max(1, Math.ceil(total / PAGE_SIZE))}.`;
    back.disabled = page === 0; next.disabled = (page + 1) * PAGE_SIZE >= total;
    onLensChange(lens);
  }
  select.addEventListener('change', () => { page = 0; render(); });
  return { element, showLens(lens: typeof lenses[number]) { select.value = lens; page = 0; render(); }, getCapture: () => capture, setCapture(value: DiagnosticsCapture) { capture = value; operations = undefined; page = 0; render(); } };
}
