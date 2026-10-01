import type {
  ImportedLogSummary,
  ParserDiagnostic,
} from '../../../../core/log-model/log-types';
import { createTimelineShell } from '../components/timeline-shell';
import { createInspectorPanel } from '../panels/inspector-panel';

export interface LoggerPageController {
  readonly element: HTMLElement;
  setLog(summary: ImportedLogSummary, recordCount: number, formatVersion: number): void;
  setImportError(message: string): void;
}

function createDiagnosticsSummary(diagnostics: readonly ParserDiagnostic[]): HTMLElement {
  const details = document.createElement('details');
  details.className = 'parser-diagnostics';

  if (diagnostics.length === 0) {
    details.hidden = true;
    return details;
  }

  const grouped = new Map<string, { count: number; severity: string; message: string }>();
  for (const diagnostic of diagnostics) {
    const existing = grouped.get(diagnostic.code);
    if (existing) {
      existing.count += 1;
      continue;
    }
    grouped.set(diagnostic.code, {
      count: 1,
      severity: diagnostic.severity,
      message: diagnostic.message,
    });
  }

  const summary = document.createElement('summary');
  summary.textContent = `Parser diagnostics · ${diagnostics.length.toLocaleString()} warning${diagnostics.length === 1 ? '' : 's'}`;
  details.append(summary);

  const content = document.createElement('div');
  content.className = 'parser-diagnostics-content';

  const groups = document.createElement('div');
  groups.className = 'parser-diagnostic-groups';
  for (const [code, item] of grouped) {
    const row = document.createElement('div');
    row.className = 'parser-diagnostic-group';
    row.innerHTML = `
      <strong>${code}</strong>
      <span>${item.count.toLocaleString()}</span>
      <small>${item.severity}</small>
    `;
    row.title = item.message;
    groups.append(row);
  }

  const firstOccurrences = document.createElement('div');
  firstOccurrences.className = 'parser-diagnostic-occurrences';
  const heading = document.createElement('strong');
  heading.textContent = 'First occurrences';
  firstOccurrences.append(heading);

  const list = document.createElement('ol');
  for (const diagnostic of diagnostics.slice(0, 8)) {
    const item = document.createElement('li');
    const offset = diagnostic.offset === undefined
      ? ''
      : ` · byte ${diagnostic.offset.toLocaleString()}`;
    item.textContent = `${diagnostic.code}${offset} — ${diagnostic.message}`;
    list.append(item);
  }
  firstOccurrences.append(list);

  content.append(groups, firstOccurrences);
  details.append(content);
  return details;
}

export function createLoggerPage(): LoggerPageController {
  const inspector = createInspectorPanel();
  const timeline = createTimelineShell();

  const page = document.createElement('section');
  page.className = 'logger-page';
  page.setAttribute('aria-label', 'Logger and analyzer workspace');

  const workspaceBar = document.createElement('div');
  workspaceBar.className = 'workspace-bar';
  workspaceBar.innerHTML = `
    <div class="workspace-tabs" role="tablist" aria-label="Graph workspaces">
      <button type="button" class="workspace-tab workspace-tab--active" role="tab" aria-selected="true">General</button>
      <button type="button" class="workspace-add" disabled title="Workspace creation follows after session/state contracts">＋</button>
    </div>
    <div class="workspace-context">
      <span class="status-chip">Recorded analysis</span>
      <button type="button" disabled>Compare Run B</button>
    </div>
  `;

  const workspaceRow = document.createElement('div');
  workspaceRow.className = 'workspace-row';

  const graphHost = document.createElement('main');
  graphHost.className = 'graph-workspace';
  graphHost.innerHTML = `
    <article class="graph-window graph-window--active">
      <header class="graph-window-header">
        <div>
          <span class="eyebrow">Graph workspace</span>
          <strong>General</strong>
        </div>
        <span class="graph-window-state">No source</span>
      </header>
      <div class="graph-empty">
        <div class="graph-empty-mark" aria-hidden="true"></div>
        <strong>Open a log to start scoping</strong>
        <p>Graph rendering is intentionally deferred until the normalized log model and large-log viewport requirements are defined.</p>
        <div class="graph-diagnostics-host"></div>
      </div>
    </article>
  `;

  const graphState = graphHost.querySelector<HTMLElement>('.graph-window-state');
  const graphEmptyTitle = graphHost.querySelector<HTMLElement>('.graph-empty > strong');
  const graphEmptyDetail = graphHost.querySelector<HTMLElement>('.graph-empty > p');
  const diagnosticsHost = graphHost.querySelector<HTMLElement>('.graph-diagnostics-host');
  if (!graphState || !graphEmptyTitle || !graphEmptyDetail || !diagnosticsHost) {
    throw new Error('Logger graph shell structure is incomplete.');
  }

  const sensorToggle = document.createElement('button');
  sensorToggle.type = 'button';
  sensorToggle.className = 'edge-toggle edge-toggle--sensor';
  sensorToggle.textContent = 'Hide sensors';
  sensorToggle.title = 'Hide Full Sensor List';

  sensorToggle.addEventListener('click', () => {
    const next = !inspector.isVisible();
    inspector.setVisible(next);
    workspaceRow.classList.toggle('workspace-row--inspector-hidden', !next);
    sensorToggle.textContent = next ? 'Hide sensors' : 'Show sensors';
    sensorToggle.title = next ? 'Hide Full Sensor List' : 'Show Full Sensor List';
    sensorToggle.setAttribute('aria-expanded', String(next));
  });
  sensorToggle.setAttribute('aria-expanded', 'true');

  workspaceRow.append(graphHost, inspector.element, sensorToggle);

  const timelineWrap = document.createElement('div');
  timelineWrap.className = 'timeline-wrap';

  const timelineToggle = document.createElement('button');
  timelineToggle.type = 'button';
  timelineToggle.className = 'edge-toggle edge-toggle--timeline';
  timelineToggle.textContent = 'Hide controls';
  timelineToggle.title = 'Collapse Timeline controls';
  timelineToggle.setAttribute('aria-expanded', 'true');

  timelineToggle.addEventListener('click', () => {
    const next = !timeline.isExpanded();
    timeline.setExpanded(next);
    timelineWrap.classList.toggle('timeline-wrap--compact', !next);
    timelineToggle.textContent = next ? 'Hide controls' : 'Show controls';
    timelineToggle.title = next ? 'Collapse Timeline controls' : 'Expand Timeline controls';
    timelineToggle.setAttribute('aria-expanded', String(next));
  });

  timelineWrap.append(timeline.element, timelineToggle);
  page.append(workspaceBar, workspaceRow, timelineWrap);

  const setLog = (
    summary: ImportedLogSummary,
    recordCount: number,
    formatVersion: number,
  ): void => {
    inspector.setChannels(summary.channels, summary.source.displayName);
    timeline.setDuration(summary.timeRange?.durationMs, recordCount);
    graphState.textContent = `MLG v${formatVersion} · ${recordCount.toLocaleString()} records`;
    graphEmptyTitle.textContent = 'Log indexed successfully';
    graphEmptyDetail.textContent = `${summary.channels.length.toLocaleString()} channels discovered. Graph rendering follows after channel-query and timeline contracts are connected.`;
    diagnosticsHost.replaceChildren(createDiagnosticsSummary(summary.diagnostics));
  };

  const setImportError = (message: string): void => {
    inspector.setError(message);
    timeline.setDuration(undefined, 0);
    graphState.textContent = 'Import failed';
    graphEmptyTitle.textContent = 'Could not open log';
    graphEmptyDetail.textContent = message;
    diagnosticsHost.replaceChildren();
  };

  return { element: page, setLog, setImportError };
}
