import type {
  ImportedLogSummary,
  NumericChannelDataSource,
  ParserDiagnostic,
} from '../../../../core/log-model/log-types';
import { createGraphViewport } from '../components/graph-viewport';
import { createTimelineShell } from '../components/timeline-shell';
import { createInspectorPanel } from '../panels/inspector-panel';

export interface LoggerPageController {
  readonly element: HTMLElement;
  setLog(
    summary: ImportedLogSummary,
    recordCount: number,
    formatVersion: number,
    channelData: NumericChannelDataSource,
  ): void;
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
  const graph = createGraphViewport();

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
  const graphWindow = document.createElement('article');
  graphWindow.className = 'graph-window graph-window--active';
  graphWindow.innerHTML = `
    <header class="graph-window-header">
      <div>
        <span class="eyebrow">Graph workspace</span>
        <strong>General</strong>
      </div>
      <span class="graph-window-state">No source</span>
    </header>
  `;
  const graphState = graphWindow.querySelector<HTMLElement>('.graph-window-state');
  if (!graphState) throw new Error('Logger graph shell structure is incomplete.');
  const diagnosticsHost = document.createElement('div');
  diagnosticsHost.className = 'graph-diagnostics-host';
  graphWindow.append(graph.element, diagnosticsHost);
  graphHost.append(graphWindow);

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

  inspector.onChannelSelected((channelId) => {
    inspector.setSelectedChannel(channelId);
    void graph.selectChannel(channelId);
  });
  timeline.onCursorChange((timeMs) => graph.setCursorTime(timeMs));

  timelineWrap.append(timeline.element, timelineToggle);
  page.append(workspaceBar, workspaceRow, timelineWrap);

  const setLog = (
    summary: ImportedLogSummary,
    recordCount: number,
    formatVersion: number,
    channelData: NumericChannelDataSource,
  ): void => {
    inspector.setChannels(summary.channels, summary.source.displayName);
    timeline.setDuration(summary.timeRange?.durationMs, recordCount);
    graph.setLog(summary.channels, channelData, summary.timeRange);
    graphState.textContent = `MLG v${formatVersion} · ${recordCount.toLocaleString()} records`;
    diagnosticsHost.replaceChildren(createDiagnosticsSummary(summary.diagnostics));
  };

  const setImportError = (message: string): void => {
    inspector.setError(message);
    timeline.setDuration(undefined, 0);
    graph.clear();
    graphState.textContent = 'Import failed';
    diagnosticsHost.replaceChildren();
  };

  return { element: page, setLog, setImportError };
}
