import { createTimelineShell } from '../components/timeline-shell';
import { createInspectorPanel } from '../panels/inspector-panel';

export interface LoggerPageController {
  readonly element: HTMLElement;
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
      </div>
    </article>
  `;

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

  return { element: page };
}
