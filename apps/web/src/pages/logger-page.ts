import type {
  ChannelDefinition,
  ImportedLogSummary,
  NumericChannelDataSource,
  LogMarker,
  ParserDiagnostic,
  ParserDiagnosticSeverity,
} from '../../../../core/log-model/log-types';
import {
  centerViewportOn,
  createFullViewport,
  fitViewport,
  followCursor,
  panViewport,
  resizeViewport,
  viewportEquals,
  zoomViewport,
  type TimelineViewport,
} from '../../../../core/timeline/viewport-state';
import {
  createGraphViewport,
  type GraphChannelPerformance,
} from '../components/graph-viewport';
import { createTimelineShell, type TimelineViewportIntent } from '../components/timeline-shell';
import { createInspectorPanel } from '../panels/inspector-panel';
import { createChannelValueSearchPanel } from '../panels/channel-value-search-panel';

export interface LoggerChannelPerformance extends GraphChannelPerformance {
  readonly channelName: string;
}

export interface LoggerPageController {
  readonly element: HTMLElement;
  readonly graphSelector: HTMLElement;
  readonly headerTools: HTMLElement;
  readonly diagnosticsControl: HTMLElement;
  setLog(
    summary: ImportedLogSummary,
    recordCount: number,
    channelData: NumericChannelDataSource,
  ): void;
  setImportError(message: string): void;
  setDiagnostics(diagnostics: readonly ParserDiagnostic[]): void;
  refreshValidity(): void;
  onChannelPerformance(listener: (performance: LoggerChannelPerformance) => void): void;
}

interface DiagnosticsIndicatorController {
  readonly element: HTMLElement;
  setDiagnostics(diagnostics: readonly ParserDiagnostic[]): void;
  clear(): void;
}

function severityRank(severity: ParserDiagnosticSeverity): number {
  if (severity === 'error') return 3;
  if (severity === 'warning') return 2;
  return 1;
}

function createDiagnosticsIndicator(): DiagnosticsIndicatorController {
  const root = document.createElement('div');
  root.className = 'parser-indicator-wrap';
  root.innerHTML = `
    <button type="button" class="parser-indicator parser-indicator--good" aria-haspopup="dialog" aria-expanded="false" title="No parser diagnostics">
      <span class="parser-indicator-light" aria-hidden="true"></span>
      <span class="parser-indicator-count" hidden></span>
      <span class="sr-only">Parser diagnostics</span>
    </button>
    <div class="parser-diagnostic-popover" role="dialog" aria-label="Parser diagnostics" hidden></div>
  `;

  const button = root.querySelector<HTMLButtonElement>('.parser-indicator');
  const count = root.querySelector<HTMLElement>('.parser-indicator-count');
  const popover = root.querySelector<HTMLElement>('.parser-diagnostic-popover');
  if (!button || !count || !popover) {
    throw new Error('Parser diagnostics indicator structure is incomplete.');
  }

  const close = (): void => {
    popover.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  };

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const nextOpen = popover.hidden;
    popover.hidden = !nextOpen;
    button.setAttribute('aria-expanded', String(nextOpen));
  });
  popover.addEventListener('click', (event) => event.stopPropagation());
  document.addEventListener('click', close);

  const setDiagnostics = (diagnostics: readonly ParserDiagnostic[]): void => {
    const grouped = new Map<string, { count: number; severity: ParserDiagnosticSeverity; message: string }>();
    let worst: ParserDiagnosticSeverity | 'good' = 'good';

    for (const diagnostic of diagnostics) {
      if (worst === 'good' || severityRank(diagnostic.severity) > severityRank(worst)) {
        worst = diagnostic.severity;
      }
      const existing = grouped.get(diagnostic.code);
      if (existing) {
        existing.count += 1;
        if (severityRank(diagnostic.severity) > severityRank(existing.severity)) {
          existing.severity = diagnostic.severity;
        }
      } else {
        grouped.set(diagnostic.code, {
          count: 1,
          severity: diagnostic.severity,
          message: diagnostic.message,
        });
      }
    }

    button.classList.remove(
      'parser-indicator--good',
      'parser-indicator--info',
      'parser-indicator--warning',
      'parser-indicator--error',
    );
    button.classList.add(`parser-indicator--${worst}`);

    if (diagnostics.length === 0) {
      count.hidden = true;
      count.textContent = '';
      button.title = 'No parser diagnostics';
      popover.innerHTML = '<div class="parser-popover-empty">No parser diagnostics.</div>';
      close();
      return;
    }

    count.hidden = false;
    count.textContent = diagnostics.length.toLocaleString();
    button.title = `${diagnostics.length.toLocaleString()} parser diagnostic${diagnostics.length === 1 ? '' : 's'}`;

    const heading = document.createElement('div');
    heading.className = 'parser-popover-heading';
    heading.innerHTML = `
      <strong>Parser diagnostics</strong>
      <span>${diagnostics.length.toLocaleString()} total</span>
    `;

    const groups = document.createElement('div');
    groups.className = 'parser-popover-groups';
    for (const [code, item] of grouped) {
      const row = document.createElement('div');
      row.className = `parser-popover-group parser-popover-group--${item.severity}`;
      row.innerHTML = `
        <span class="parser-popover-severity" aria-hidden="true"></span>
        <strong>${code}</strong>
        <span>${item.count.toLocaleString()}</span>
      `;
      row.title = item.message;
      groups.append(row);
    }

    const occurrences = document.createElement('div');
    occurrences.className = 'parser-popover-occurrences';
    const occurrenceHeading = document.createElement('strong');
    occurrenceHeading.textContent = 'First occurrences';
    occurrences.append(occurrenceHeading);

    const list = document.createElement('ol');
    for (const diagnostic of diagnostics.slice(0, 40)) {
      const item = document.createElement('li');
      const offset = diagnostic.offset === undefined
        ? ''
        : ` · byte ${diagnostic.offset.toLocaleString()}`;
      item.textContent = `${diagnostic.code}${offset} — ${diagnostic.message}`;
      list.append(item);
    }
    occurrences.append(list);

    popover.replaceChildren(heading, groups, occurrences);
  };

  const clear = (): void => setDiagnostics([]);
  clear();
  return { element: root, setDiagnostics, clear };
}

interface GraphWorkspaceSummary {
  readonly id: string;
  name: string;
}

interface GraphWorkspaceState extends GraphWorkspaceSummary {
  channelIds: string[];
  viewport: TimelineViewport | undefined;
  cursorTimeMs: number;
}

interface GraphSelectorController {
  readonly element: HTMLElement;
  setWorkspaces(workspaces: readonly GraphWorkspaceSummary[], activeId: string): void;
  setEnabled(enabled: boolean): void;
  onSelect(listener: (workspaceId: string) => void): void;
  onCreate(listener: () => void): void;
  onRename(listener: () => void): void;
  onDuplicate(listener: () => void): void;
  onDelete(listener: () => void): void;
}

function createGraphSelector(): GraphSelectorController {
  let workspaces: readonly GraphWorkspaceSummary[] = [{ id: 'general', name: 'General' }];
  let activeId = 'general';
  let enabled = false;
  let selectListener: ((workspaceId: string) => void) | undefined;
  let createListener: (() => void) | undefined;
  let renameListener: (() => void) | undefined;
  let duplicateListener: (() => void) | undefined;
  let deleteListener: (() => void) | undefined;

  const root = document.createElement('div');
  root.className = 'graph-selector-wrap';
  root.innerHTML = `
    <button type="button" class="graph-selector-button" aria-haspopup="menu" aria-expanded="false">
      <span>General</span>
      <span class="graph-selector-chevron" aria-hidden="true"></span>
    </button>
    <div class="graph-selector-menu" role="menu" hidden>
      <div class="graph-selector-list"></div>
      <div class="graph-selector-actions">
        <button type="button" data-workspace-action="new">＋ New graph</button>
        <button type="button" data-workspace-action="rename">Rename</button>
        <button type="button" data-workspace-action="duplicate">Duplicate</button>
        <button type="button" data-workspace-action="delete">Delete</button>
      </div>
    </div>
  `;

  const button = root.querySelector<HTMLButtonElement>('.graph-selector-button');
  const buttonLabel = button?.querySelector<HTMLElement>('span');
  const menu = root.querySelector<HTMLElement>('.graph-selector-menu');
  const list = root.querySelector<HTMLElement>('.graph-selector-list');
  const actionButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-workspace-action]')];
  if (!button || !buttonLabel || !menu || !list) throw new Error('Graph selector structure is incomplete.');

  const close = (): void => {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  };

  const render = (): void => {
    const active = workspaces.find((workspace) => workspace.id === activeId) ?? workspaces[0];
    buttonLabel.textContent = active?.name ?? 'General';
    button.disabled = !enabled;

    const fragment = document.createDocumentFragment();
    for (const workspace of workspaces) {
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = 'graph-selector-choice';
      choice.classList.toggle('graph-selector-choice--active', workspace.id === activeId);
      choice.setAttribute('role', 'menuitem');
      choice.setAttribute('aria-current', workspace.id === activeId ? 'page' : 'false');
      choice.dataset.workspaceId = workspace.id;

      const label = document.createElement('span');
      label.textContent = workspace.name;
      const detail = document.createElement('small');
      detail.textContent = workspace.id === activeId ? 'Current graph workspace' : 'Switch workspace';
      choice.append(label, detail);
      fragment.append(choice);
    }
    list.replaceChildren(fragment);

    for (const actionButton of actionButtons) {
      const action = actionButton.dataset.workspaceAction;
      actionButton.disabled = !enabled || (action === 'delete' && workspaces.length <= 1);
    }
  };

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (button.disabled) return;
    const nextOpen = menu.hidden;
    menu.hidden = !nextOpen;
    button.setAttribute('aria-expanded', String(nextOpen));
  });
  menu.addEventListener('click', (event) => {
    event.stopPropagation();
    const target = event.target;
    if (!(target instanceof Element)) return;
    const choice = target.closest<HTMLButtonElement>('[data-workspace-id]');
    if (choice?.dataset.workspaceId) {
      close();
      selectListener?.(choice.dataset.workspaceId);
      return;
    }
    const actionButton = target.closest<HTMLButtonElement>('[data-workspace-action]');
    if (!actionButton || actionButton.disabled) return;
    close();
    switch (actionButton.dataset.workspaceAction) {
      case 'new': createListener?.(); break;
      case 'rename': renameListener?.(); break;
      case 'duplicate': duplicateListener?.(); break;
      case 'delete': deleteListener?.(); break;
    }
  });
  document.addEventListener('click', close);

  render();
  return {
    element: root,
    setWorkspaces: (nextWorkspaces, nextActiveId) => {
      workspaces = nextWorkspaces;
      activeId = nextActiveId;
      render();
    },
    setEnabled: (nextEnabled) => {
      enabled = nextEnabled;
      if (!enabled) close();
      render();
    },
    onSelect: (listener) => { selectListener = listener; },
    onCreate: (listener) => { createListener = listener; },
    onRename: (listener) => { renameListener = listener; },
    onDuplicate: (listener) => { duplicateListener = listener; },
    onDelete: (listener) => { deleteListener = listener; },
  };
}

export function createLoggerPage(): LoggerPageController {
  const inspector = createInspectorPanel();
  const timeline = createTimelineShell();
  const graph = createGraphViewport();
  const diagnostics = createDiagnosticsIndicator();
  const valueSearch = createChannelValueSearchPanel();
  const graphSelector = createGraphSelector();
  let viewport: TimelineViewport | undefined;
  let previousCursorTimeMs = 0;
  const activeChannelIds = new Set<string>();
  let workspaceCounter = 1;
  let workspaceGeneration = 0;
  let activeWorkspaceId = 'general';
  let workspaces: GraphWorkspaceState[] = [{
    id: 'general',
    name: 'General',
    channelIds: [],
    viewport: undefined,
    cursorTimeMs: 0,
  }];
  let channelDefinitions = new Map<string, ChannelDefinition>();
  let logMarkers: readonly LogMarker[] = [];
  let channelPerformanceListener: ((performance: LoggerChannelPerformance) => void) | undefined;

  const headerTools = document.createElement('div');
  headerTools.className = 'logger-header-tools';
  const compareButton = document.createElement('button');
  compareButton.type = 'button';
  compareButton.disabled = true;
  compareButton.textContent = 'Compare Run B';
  headerTools.append(valueSearch.element, compareButton);

  const page = document.createElement('section');
  page.className = 'logger-page';
  page.setAttribute('aria-label', 'Logger and analyzer workspace');

  const workspaceRow = document.createElement('div');
  workspaceRow.className = 'workspace-row';

  const graphHost = document.createElement('main');
  graphHost.className = 'graph-workspace';
  const graphWindow = document.createElement('article');
  graphWindow.className = 'graph-window graph-window--active';
  graphWindow.append(graph.element);
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

  const activeWorkspace = (): GraphWorkspaceState | undefined =>
    workspaces.find((workspace) => workspace.id === activeWorkspaceId);

  const refreshWorkspaceSelector = (): void => {
    graphSelector.setWorkspaces(
      workspaces.map(({ id, name }) => ({ id, name })),
      activeWorkspaceId,
    );
  };

  const saveCurrentWorkspace = (): void => {
    const workspace = activeWorkspace();
    if (!workspace) return;
    workspace.channelIds = [...activeChannelIds];
    workspace.viewport = viewport ? { ...viewport } : undefined;
    workspace.cursorTimeMs = timeline.getCursorTime();
  };

  const syncViewport = (nextViewport: TimelineViewport | undefined): void => {
    viewport = nextViewport;
    timeline.setViewport(nextViewport);
    graph.setViewport(nextViewport);
    const workspace = activeWorkspace();
    if (workspace) workspace.viewport = nextViewport ? { ...nextViewport } : undefined;
  };

  const setCursorWithoutFollow = (timeMs: number): void => {
    previousCursorTimeMs = timeMs;
    timeline.setCursorTime(timeMs);
    graph.setCursorTime(timeMs);
    const workspace = activeWorkspace();
    if (workspace) workspace.cursorTimeMs = timeMs;
  };

  const centerCursorInViewport = (targetViewport: TimelineViewport): void => {
    setCursorWithoutFollow((targetViewport.visibleStartMs + targetViewport.visibleEndMs) / 2);
  };

  const applyViewportIntent = (intent: TimelineViewportIntent): void => {
    if (!viewport) return;
    let next = viewport;
    if (intent.type === 'fit') next = fitViewport(viewport);
    if (intent.type === 'zoom') {
      next = zoomViewport(viewport, intent.factor, intent.anchorMs);
      if (intent.centerCursor) next = centerViewportOn(next, intent.anchorMs);
    }
    if (intent.type === 'pan') next = panViewport(viewport, intent.deltaMs);
    if (intent.type === 'resize') next = resizeViewport(viewport, intent.edge, intent.edgeTimeMs);
    if (intent.type === 'range') {
      const startMs = Math.max(viewport.fullStartMs, Math.min(intent.startMs, intent.endMs));
      const endMs = Math.min(viewport.fullEndMs, Math.max(intent.startMs, intent.endMs));
      const fullSpan = Math.max(1, viewport.fullEndMs - viewport.fullStartMs);
      const requestedSpan = Math.max(1, endMs - startMs);
      const midpoint = (startMs + endMs) / 2;
      next = centerViewportOn(
        zoomViewport(fitViewport(viewport), requestedSpan / fullSpan, midpoint),
        midpoint,
      );
    }

    if (!viewportEquals(viewport, next)) syncViewport(next);
    if (intent.type !== 'fit' && intent.centerCursor) centerCursorInViewport(next);
  };

  const restoreWorkspace = async (workspaceId: string): Promise<void> => {
    const target = workspaces.find((workspace) => workspace.id === workspaceId);
    if (!target || target.id === activeWorkspaceId) return;

    saveCurrentWorkspace();
    const generation = ++workspaceGeneration;
    activeWorkspaceId = target.id;
    refreshWorkspaceSelector();

    graph.clearChannels();
    activeChannelIds.clear();
    inspector.setActiveChannels([]);
    inspector.setQueuedChannels([]);
    valueSearch.setActiveChannels([]);
    timeline.setOverviewContent([], logMarkers);

    if (target.viewport) syncViewport({ ...target.viewport });
    setCursorWithoutFollow(target.cursorTimeMs);

    const requestedIds = target.channelIds.filter((channelId) => channelDefinitions.has(channelId));
    if (requestedIds.length === 0) return;

    const activations = requestedIds.map((channelId) => graph.toggleChannel(channelId));
    graph.loadPendingChannels();
    const results = await Promise.all(activations);
    if (generation !== workspaceGeneration || activeWorkspaceId !== target.id) return;

    activeChannelIds.clear();
    requestedIds.forEach((channelId, index) => {
      if (results[index]) activeChannelIds.add(channelId);
    });
    target.channelIds = [...activeChannelIds];
    const activeIds = [...activeChannelIds];
    inspector.setActiveChannels(activeIds);
    valueSearch.setActiveChannels(
      activeIds.flatMap((id) => {
        const channel = channelDefinitions.get(id);
        return channel ? [channel] : [];
      }),
    );
    timeline.setOverviewContent(graph.getOverviewTraces(), logMarkers);
  };

  inspector.onChannelToggled((channelId) => {
    void graph.toggleChannel(channelId).then((active) => {
      if (active) activeChannelIds.add(channelId);
      else activeChannelIds.delete(channelId);
      const workspace = activeWorkspace();
      if (workspace) workspace.channelIds = [...activeChannelIds];
      const activeIds = [...activeChannelIds];
      inspector.setActiveChannels(activeIds);
      valueSearch.setActiveChannels(
        activeIds.flatMap((id) => {
          const channel = channelDefinitions.get(id);
          return channel ? [channel] : [];
        }),
      );
      timeline.setOverviewContent(graph.getOverviewTraces(), logMarkers);
    });
  });

  inspector.onLoadSelected(() => {
    graph.loadPendingChannels();
  });

  graph.onPendingChannelsChanged((channelIds) => {
    inspector.setQueuedChannels(channelIds);
  });

  graph.onChannelPerformance((performance) => {
    const channel = channelDefinitions.get(performance.channelId);
    channelPerformanceListener?.({
      ...performance,
      channelName: channel?.sourceName ?? performance.channelId,
    });
  });

  graph.onCursorValues((values) => {
    const displayValues = values.flatMap((item) => {
      const channel = channelDefinitions.get(item.channelId);
      if (!channel) return [];
      if (item.value === undefined || !Number.isFinite(item.value)) {
        return [{ channelId: item.channelId, value: '—' }];
      }
      const precision = Math.min(6, Math.max(0, channel.precision ?? 2));
      const unit = channel.unit ? ` ${channel.unit}` : '';
      return [{ channelId: item.channelId, value: `${item.value.toFixed(precision)}${unit}` }];
    });
    inspector.setChannelValues(displayValues);
  });

  timeline.onCursorChange((timeMs) => {
    if (viewport) {
      const nextViewport = followCursor(viewport, previousCursorTimeMs, timeMs);
      if (!viewportEquals(viewport, nextViewport)) syncViewport(nextViewport);
    }
    previousCursorTimeMs = timeMs;
    graph.setCursorTime(timeMs);
    const workspace = activeWorkspace();
    if (workspace) workspace.cursorTimeMs = timeMs;
  });
  timeline.onViewportIntent(applyViewportIntent);
  graph.onZoom((factor, anchorMs) => applyViewportIntent({ type: 'zoom', factor, anchorMs }));
  graph.onPan((deltaMs) => applyViewportIntent({ type: 'pan', deltaMs }));

  valueSearch.onJump((timeMs) => {
    if (viewport) {
      const centered = centerViewportOn(viewport, timeMs);
      if (!viewportEquals(viewport, centered)) syncViewport(centered);
    }
    setCursorWithoutFollow(timeMs);
  });

  graphSelector.onSelect((workspaceId) => {
    void restoreWorkspace(workspaceId);
  });

  graphSelector.onCreate(() => {
    saveCurrentWorkspace();
    workspaceCounter += 1;
    const workspace: GraphWorkspaceState = {
      id: `graph-${workspaceCounter}`,
      name: `Graph ${workspaceCounter}`,
      channelIds: [],
      viewport: viewport ? { ...viewport } : undefined,
      cursorTimeMs: timeline.getCursorTime(),
    };
    workspaces.push(workspace);
    void restoreWorkspace(workspace.id);
  });

  graphSelector.onRename(() => {
    const workspace = activeWorkspace();
    if (!workspace) return;
    const entered = window.prompt('Graph workspace name', workspace.name);
    if (entered === null) return;
    const name = entered.trim();
    if (!name) return;
    workspace.name = name;
    refreshWorkspaceSelector();
  });

  graphSelector.onDuplicate(() => {
    const source = activeWorkspace();
    if (!source) return;
    saveCurrentWorkspace();
    workspaceCounter += 1;
    const duplicate: GraphWorkspaceState = {
      id: `graph-${workspaceCounter}`,
      name: `${source.name} copy`,
      channelIds: [...source.channelIds],
      viewport: source.viewport ? { ...source.viewport } : undefined,
      cursorTimeMs: source.cursorTimeMs,
    };
    workspaces.push(duplicate);
    void restoreWorkspace(duplicate.id);
  });

  graphSelector.onDelete(() => {
    if (workspaces.length <= 1) return;
    const deletedIndex = workspaces.findIndex((workspace) => workspace.id === activeWorkspaceId);
    if (deletedIndex < 0) return;
    const nextIndex = Math.max(0, deletedIndex - 1);
    workspaces.splice(deletedIndex, 1);
    const next = workspaces[Math.min(nextIndex, workspaces.length - 1)];
    if (!next) return;
    activeWorkspaceId = '';
    void restoreWorkspace(next.id);
  });

  timelineWrap.append(timeline.element, timelineToggle);
  page.append(workspaceRow, timelineWrap);

  const setLog = (
    summary: ImportedLogSummary,
    recordCount: number,
    channelData: NumericChannelDataSource,
  ): void => {
    workspaceGeneration += 1;
    workspaceCounter = 1;
    activeWorkspaceId = 'general';
    workspaces = [{
      id: 'general',
      name: 'General',
      channelIds: [],
      viewport: summary.timeRange
        ? createFullViewport(summary.timeRange.startMs, summary.timeRange.endMs)
        : undefined,
      cursorTimeMs: summary.timeRange?.startMs ?? 0,
    }];
    refreshWorkspaceSelector();
    graphSelector.setEnabled(Boolean(summary.timeRange));
    activeChannelIds.clear();
    channelDefinitions = new Map(summary.channels.map((channel) => [channel.id, channel]));
    logMarkers = summary.markers;
    inspector.setChannels(summary.channels, summary.source.displayName);
    timeline.setTimeRange(summary.timeRange, recordCount);
    timeline.setOverviewContent([], logMarkers);
    graph.setLog(summary.channels, channelData, summary.timeRange);
    valueSearch.setLog(channelData);
    valueSearch.setActiveChannels([]);
    if (summary.timeRange) {
      previousCursorTimeMs = summary.timeRange.startMs;
      syncViewport(createFullViewport(summary.timeRange.startMs, summary.timeRange.endMs));
    } else {
      previousCursorTimeMs = 0;
      syncViewport(undefined);
    }
    diagnostics.setDiagnostics(summary.diagnostics);
  };

  const setImportError = (message: string): void => {
    workspaceGeneration += 1;
    workspaceCounter = 1;
    activeWorkspaceId = 'general';
    workspaces = [{
      id: 'general',
      name: 'General',
      channelIds: [],
      viewport: undefined,
      cursorTimeMs: 0,
    }];
    refreshWorkspaceSelector();
    graphSelector.setEnabled(false);
    activeChannelIds.clear();
    channelDefinitions.clear();
    logMarkers = [];
    inspector.setError(message);
    timeline.setTimeRange(undefined, 0);
    syncViewport(undefined);
    graph.clear();
    valueSearch.clear();
    diagnostics.setDiagnostics([{
      code: 'import-failed',
      severity: 'error',
      message,
      recoverable: false,
    }]);
  };

  refreshWorkspaceSelector();
  graphSelector.setEnabled(false);

  return {
    element: page,
    graphSelector: graphSelector.element,
    headerTools,
    diagnosticsControl: diagnostics.element,
    setLog,
    setImportError,
    setDiagnostics: (nextDiagnostics) => { diagnostics.setDiagnostics(nextDiagnostics); },
    refreshValidity: () => { graph.refreshValidity(); timeline.refreshOverview(); },
    onChannelPerformance: (listener) => { channelPerformanceListener = listener; },
  };
}
