import type {
  ChannelDefinition,
  ImportedLogSummary,
  NumericChannelDataSource,
  NumericChannelRange,
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
import {
  normalizeWorkspaceChannelIds,
  renderableWorkspaceChannelIds,
} from '../state/workspace-channel-identity';
import type {
  GraphPaneGeometry,
  GraphPaneSnapshot,
  GraphWorkspaceLayout,
  GraphWorkspaceSnapshot,
  LoggerWorkspaceState,
} from '../state/workspace-state';
import {
  GRAPH_PANE_IDS,
  createEmptyPaneStates,
  freeformArrangement,
  normalizePaneStates,
  paneCountForLayout,
  type FreeformArrange,
  type GraphPaneState,
} from '../state/logger-pane-layout';

const MAX_ACTIVE_WEB_TRACES = 8;


export interface LoggerChannelPerformance extends GraphChannelPerformance {
  readonly channelName: string;
}

export interface LoggerUiPopulationPerformance {
  readonly totalMs: number;
  readonly workspaceMs: number;
  readonly channelModelMs: number;
  readonly inspectorMs: number;
  readonly timelineMs: number;
  readonly graphSetupMs: number;
  readonly layoutMs: number;
  readonly valueSearchMs: number;
  readonly viewportMs: number;
  readonly diagnosticsMs: number;
}

export interface LoggerWorkspaceRestorePerformance {
  readonly totalMs: number;
  readonly prepareMs: number;
  readonly prepareStateMs: number;
  readonly prepareClearMs: number;
  readonly prepareLayoutMs: number;
  readonly prepareViewportMs: number;
  readonly preparePaneRequestsMs: number;
  readonly prepareBatchPlanMs: number;
  readonly sharedBatchMs: number;
  readonly activationMs: number;
  readonly activationGraphTotalMs: number;
  readonly activationChannelLookupMs: number;
  readonly activationStatisticsScaleMs: number;
  readonly activationTraceRegistrationMs: number;
  readonly activationReadoutMs: number;
  readonly activationCursorMs: number;
  readonly activationDrawMs: number;
  readonly activationEnvelopeMs: number;
  readonly activationDrawSetupMs: number;
  readonly activationDrawTraceMs: number;
  readonly activationDrawOverlayMs: number;
  readonly finalSyncMs: number;
  readonly finalSyncResolveMs: number;
  readonly finalSyncAssignedNormalizeMs: number;
  readonly finalSyncInspectorActiveMs: number;
  readonly finalSyncInspectorQueuedMs: number;
  readonly finalSyncValueSearchMs: number;
  readonly finalSyncAssignedSyncMs: number;
  readonly finalSyncOverviewMs: number;
  readonly visiblePaneCount: number;
  readonly assignedChannelCount: number;
  readonly requestedChannelCount: number;
  readonly uniqueRequestedChannelCount: number;
  readonly cacheHit: boolean;
  readonly physicalReadCount: number;
  readonly physicalBytesRead: number;
  readonly physicalReadMs: number;
}

export interface LoggerRuntimeDiagnosticSnapshot {
  readonly hasChannelDataSource: boolean;
  readonly channelDefinitionCount: number;
  readonly catalogChannelCount: number;
  readonly unavailableChannelCount: number;
  readonly aliasCount: number;
  readonly activeWorkspaceId: string;
  readonly workspaceCount: number;
  readonly restoringWorkspaceState: boolean;
  readonly visiblePaneCount: number;
  readonly assignedChannelCount: number;
  readonly renderableAssignedChannelCount: number;
  readonly unavailableAssignedChannelCount: number;
  readonly activeTraceCount: number;
  readonly panes: readonly {
    readonly id: string;
    readonly visible: boolean;
    readonly assignedChannelIds: readonly string[];
    readonly renderableAssignedChannelIds: readonly string[];
    readonly unavailableAssignedChannelIds: readonly string[];
    readonly activeChannelIds: readonly string[];
  }[];
}

export interface LoggerPageController {
  readonly element: HTMLElement;
  readonly graphSelector: HTMLElement;
  readonly headerTools: HTMLElement;
  readonly keyboardShortcutsControl: HTMLElement;
  readonly diagnosticsControl: HTMLElement;
  setLog(
    summary: ImportedLogSummary,
    recordCount: number,
    channelData: NumericChannelDataSource,
    options?: {
      readonly unavailableChannelIds?: readonly string[];
      readonly channelIdAliases?: ReadonlyMap<string, string>;
    },
  ): LoggerUiPopulationPerformance;
  setChannelCatalog(channels: readonly ChannelDefinition[], sourceName: string): void;
  clearChannelCatalog(): void;
  setImportError(message: string): void;
  setDiagnostics(diagnostics: readonly ParserDiagnostic[]): void;
  refreshValidity(): void;
  setPlaybackSpeed(speed: number): void;
  setHighZoomSamplePointsVisible(visible: boolean): void;
  setTimelineOverviewTracesVisible(visible: boolean): void;
  onChannelPerformance(listener: (performance: LoggerChannelPerformance) => void): void;
  onWorkspaceRestorePerformance(
    listener: (performance: LoggerWorkspaceRestorePerformance) => void,
  ): void;
  onWorkspaceMutation(listener: () => void): void;
  getWorkspaceState(): LoggerWorkspaceState;
  getRuntimeDiagnosticSnapshot(): LoggerRuntimeDiagnosticSnapshot;
  restoreWorkspaceState(state: LoggerWorkspaceState): Promise<void>;
  restoreActiveWorkspace(): Promise<void>;
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

interface SourceIntegritySummary {
  readonly recoveredRetryArtifacts: number;
  readonly validRetryLikeRuns: number;
  readonly unrecoveredCrcRecords: number;
  readonly counterAnomalies: number;
  readonly groupedUnresolvedEvents: number;
}

function unresolvedParserDiagnostics(
  diagnostics: readonly ParserDiagnostic[],
): ParserDiagnostic[] {
  return diagnostics.filter((diagnostic) =>
    (diagnostic.severity === 'warning' || diagnostic.severity === 'error')
    && diagnostic.code !== 'mlg-retry-recovery-summary'
    && diagnostic.code !== 'mlg-counter-pattern-summary'
  );
}

function integerGcd(left: number, right: number): number {
  let a = Math.abs(Math.trunc(left));
  let b = Math.abs(Math.trunc(right));
  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
}

function estimateMlgRecordStride(diagnostics: readonly ParserDiagnostic[]): number | undefined {
  const crcOffsets = diagnostics
    .filter((diagnostic) =>
      (diagnostic.code === 'mlg-crc-mismatch' || diagnostic.code === 'mlg-crc-retry-recovered')
      && diagnostic.offset !== undefined
    )
    .map((diagnostic) => diagnostic.offset!)
    .sort((left, right) => left - right);
  if (crcOffsets.length < 2) return undefined;

  let stride = 0;
  for (let index = 1; index < crcOffsets.length; index += 1) {
    const difference = crcOffsets[index]! - crcOffsets[index - 1]!;
    if (difference <= 0) continue;
    stride = stride === 0 ? difference : integerGcd(stride, difference);
    if (stride === 1) return undefined;
  }
  return stride >= 8 && stride <= 1_000_000 ? stride : undefined;
}

function groupedUnresolvedMlgEventCount(diagnostics: readonly ParserDiagnostic[]): number {
  const unresolved = diagnostics
    .filter((diagnostic) =>
      (diagnostic.code === 'mlg-crc-mismatch' || diagnostic.code === 'mlg-counter-discontinuity')
      && diagnostic.offset !== undefined
    )
    .sort((left, right) => left.offset! - right.offset!);
  if (unresolved.length === 0) return 0;

  const stride = estimateMlgRecordStride(diagnostics);
  if (!stride) return unresolved.length;
  const adjacency = stride + 8;
  let groups = 1;
  let previousOffset = unresolved[0]!.offset!;
  for (const diagnostic of unresolved.slice(1)) {
    const offset = diagnostic.offset!;
    if (offset - previousOffset > adjacency) groups += 1;
    previousOffset = offset;
  }
  return groups;
}

function summarizeSourceIntegrity(diagnostics: readonly ParserDiagnostic[]): SourceIntegritySummary {
  const count = (code: string): number => diagnostics.filter((item) => item.code === code).length;
  return {
    recoveredRetryArtifacts: count('mlg-crc-retry-recovered'),
    validRetryLikeRuns: count('mlg-counter-retry-pattern'),
    unrecoveredCrcRecords: count('mlg-crc-mismatch'),
    counterAnomalies: count('mlg-counter-discontinuity'),
    groupedUnresolvedEvents: groupedUnresolvedMlgEventCount(diagnostics),
  };
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

  const buildDiagnosticsReport = (
    diagnostics: readonly ParserDiagnostic[],
    grouped: ReadonlyMap<string, { count: number; severity: ParserDiagnosticSeverity; message: string }>,
  ): string => {
    const sourceIntegrity = summarizeSourceIntegrity(diagnostics);
    const unresolved = unresolvedParserDiagnostics(diagnostics);
    const lines = [
      'EpicScope parser diagnostics',
      '',
      `Total: ${diagnostics.length.toLocaleString()}`,
      `Unresolved: ${unresolved.length.toLocaleString()}`,
      '',
      '[Source integrity]',
      `Recovered retry artifacts: ${sourceIntegrity.recoveredRetryArtifacts.toLocaleString()}`,
      `Valid retry-like runs: ${sourceIntegrity.validRetryLikeRuns.toLocaleString()}`,
      `Unrecovered CRC records: ${sourceIntegrity.unrecoveredCrcRecords.toLocaleString()}`,
      `Counter anomalies: ${sourceIntegrity.counterAnomalies.toLocaleString()}`,
      `Grouped unresolved MLG events: ${sourceIntegrity.groupedUnresolvedEvents.toLocaleString()}`,
      '',
      '[Groups]',
    ];

    for (const [code, item] of grouped) {
      lines.push(
        `${item.severity.toUpperCase()} | ${code} | ${item.count.toLocaleString()}`,
      );
    }

    lines.push('', '[Unresolved diagnostics]');
    unresolved.forEach((diagnostic, index) => {
      const offset = diagnostic.offset === undefined
        ? 'byte —'
        : `byte ${diagnostic.offset.toLocaleString()}`;
      lines.push(
        `${index + 1}. ${diagnostic.severity.toUpperCase()} | ${diagnostic.code} | ${offset} | ${diagnostic.message}`,
      );
    });

    lines.push('', '[All diagnostics]');
    diagnostics.forEach((diagnostic, index) => {
      const offset = diagnostic.offset === undefined
        ? 'byte —'
        : `byte ${diagnostic.offset.toLocaleString()}`;
      lines.push(
        `${index + 1}. ${diagnostic.severity.toUpperCase()} | ${diagnostic.code} | ${offset} | ${diagnostic.message}`,
      );
    });

    return lines.join('\n');
  };

  const copyText = async (value: string): Promise<void> => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textArea = document.createElement('textarea');
    textArea.value = value;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.append(textArea);
    textArea.focus();
    textArea.select();
    const copied = document.execCommand('copy');
    textArea.remove();
    if (!copied) throw new Error('Clipboard copy was not available.');
  };

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

    const unresolved = unresolvedParserDiagnostics(diagnostics);
    const sourceIntegrity = summarizeSourceIntegrity(diagnostics);
    count.hidden = false;
    count.textContent = (unresolved.length > 0 ? unresolved.length : diagnostics.length).toLocaleString();
    button.title = `${unresolved.length.toLocaleString()} unresolved · ${diagnostics.length.toLocaleString()} total parser diagnostics`;

    const heading = document.createElement('div');
    heading.className = 'parser-popover-heading';

    const headingTitle = document.createElement('strong');
    headingTitle.textContent = 'Parser diagnostics';

    const headingActions = document.createElement('div');
    headingActions.className = 'parser-popover-heading-actions';

    const headingCount = document.createElement('span');
    headingCount.textContent = `${unresolved.length.toLocaleString()} unresolved · ${diagnostics.length.toLocaleString()} total`;

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'parser-copy-report';
    copyButton.textContent = 'Copy report';
    copyButton.title = 'Copy complete parser diagnostics report';

    headingActions.append(headingCount, copyButton);
    heading.append(headingTitle, headingActions);

    const sourceSummary = document.createElement('div');
    sourceSummary.className = 'parser-popover-groups';
    const sourceRows: readonly [string, number, ParserDiagnosticSeverity][] = [
      ['Recovered retry artifacts', sourceIntegrity.recoveredRetryArtifacts, 'info'],
      ['Valid retry-like runs', sourceIntegrity.validRetryLikeRuns, 'info'],
      ['Unrecovered CRC records', sourceIntegrity.unrecoveredCrcRecords, 'warning'],
      ['Counter anomalies', sourceIntegrity.counterAnomalies, 'warning'],
      ['Grouped unresolved MLG events', sourceIntegrity.groupedUnresolvedEvents, sourceIntegrity.groupedUnresolvedEvents > 0 ? 'warning' : 'info'],
    ];
    for (const [label, value, severity] of sourceRows) {
      const row = document.createElement('div');
      row.className = `parser-popover-group parser-popover-group--${severity}`;
      row.innerHTML = `
        <span class="parser-popover-severity" aria-hidden="true"></span>
        <strong>${label}</strong>
        <span>${value.toLocaleString()}</span>
      `;
      sourceSummary.append(row);
    }

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
    occurrenceHeading.textContent = 'Unresolved occurrences';
    occurrences.append(occurrenceHeading);

    const list = document.createElement('ol');
    for (const diagnostic of unresolved.slice(0, 40)) {
      const item = document.createElement('li');
      const offset = diagnostic.offset === undefined
        ? ''
        : ` · byte ${diagnostic.offset.toLocaleString()}`;
      item.textContent = `${diagnostic.code}${offset} — ${diagnostic.message}`;
      list.append(item);
    }
    if (unresolved.length === 0) {
      const clean = document.createElement('div');
      clean.className = 'parser-popover-empty';
      clean.textContent = 'No unresolved parser diagnostics.';
      occurrences.append(clean);
    } else {
      occurrences.append(list);
    }

    copyButton.addEventListener('click', () => {
      const report = buildDiagnosticsReport(diagnostics, grouped);
      const previousLabel = copyButton.textContent ?? 'Copy report';
      copyButton.disabled = true;
      void copyText(report)
        .then(() => {
          copyButton.textContent = 'Copied';
        })
        .catch(() => {
          copyButton.textContent = 'Copy failed';
        })
        .finally(() => {
          window.setTimeout(() => {
            copyButton.textContent = previousLabel;
            copyButton.disabled = false;
          }, 1200);
        });
    });

    popover.replaceChildren(heading, sourceSummary, groups, occurrences);
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
  layout: GraphWorkspaceLayout;
  activePaneId: string;
  panes: GraphPaneState[];
  paneGeometry: Record<string, GraphPaneGeometry>;
  minimizedPaneIds: string[];
  maximizedPaneId: string | undefined;
  freeformArrange: FreeformArrange;
  viewport: TimelineViewport | undefined;
  cursorTimeMs: number;
  viewHistory: TimelineViewport[];
  viewHistoryIndex: number;
  lastHistoryMutationMs: number;
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
  const diagnostics = createDiagnosticsIndicator();
  const valueSearch = createChannelValueSearchPanel();
  const graphSelector = createGraphSelector();
  let viewport: TimelineViewport | undefined;
  let previousCursorTimeMs = 0;
  let workspaceCounter = 1;
  let workspaceGeneration = 0;
  let activeWorkspaceId = 'general';
  let workspaces: GraphWorkspaceState[] = [{
    id: 'general',
    name: 'General',
    layout: 'single',
    activePaneId: 'pane-1',
    panes: createEmptyPaneStates(),
    paneGeometry: freeformArrangement('mosaic'),
    minimizedPaneIds: [],
    maximizedPaneId: undefined,
    freeformArrange: 'mosaic',
    viewport: undefined,
    cursorTimeMs: 0,
    viewHistory: [],
    viewHistoryIndex: -1,
    lastHistoryMutationMs: 0,
  }];
  let channelDefinitions = new Map<string, ChannelDefinition>();
  let catalogChannelDefinitions = new Map<string, ChannelDefinition>();
  let catalogSourceName = '';
  let channelIdAliases = new Map<string, string>();
  const unavailableChannelIds = new Set<string>();
  let channelDataSource: NumericChannelDataSource | undefined;
  let logMarkers: readonly LogMarker[] = [];
  let channelPerformanceListener: ((performance: LoggerChannelPerformance) => void) | undefined;
  let workspaceRestorePerformanceListener:
    ((performance: LoggerWorkspaceRestorePerformance) => void) | undefined;
  let workspaceMutationListener: (() => void) | undefined;
  let restoringWorkspaceState = false;

  const emitWorkspaceMutation = (): void => {
    if (!restoringWorkspaceState) workspaceMutationListener?.();
  };

  const headerTools = document.createElement('div');
  headerTools.className = 'logger-header-tools';

  const layoutSelect = document.createElement('select');
  layoutSelect.className = 'graph-layout-select';
  layoutSelect.title = 'Graph workspace layout';
  layoutSelect.setAttribute('aria-label', 'Graph workspace layout');
  layoutSelect.innerHTML = `
    <option value="single">Single graph</option>
    <option value="grid4">2 × 2 · 4 graphs</option>
    <option value="grid5">2 × 3 · 5 graphs</option>
    <option value="grid6">3 × 2 · 6 graphs</option>
    <option value="freeform">Freeform · 5 graphs</option>
  `;

  const arrangeSelect = document.createElement('select');
  arrangeSelect.className = 'graph-arrange-select';
  arrangeSelect.title = 'Arrange freeform graph windows';
  arrangeSelect.setAttribute('aria-label', 'Arrange freeform graph windows');
  arrangeSelect.innerHTML = `
    <option value="mosaic">Mosaic</option>
    <option value="columns">Columns</option>
    <option value="rows">Rows</option>
    <option value="cascade">Cascade</option>
    <option value="custom" disabled>Custom</option>
  `;
  arrangeSelect.hidden = true;

  const clearPaneButton = document.createElement('button');
  clearPaneButton.type = 'button';
  clearPaneButton.className = 'graph-pane-action';
  clearPaneButton.textContent = 'Clear pane';
  clearPaneButton.title = 'Remove all channels from the active graph pane';

  const resetLayoutButton = document.createElement('button');
  resetLayoutButton.type = 'button';
  resetLayoutButton.className = 'graph-pane-action';
  resetLayoutButton.textContent = 'Reset layout';
  resetLayoutButton.title = 'Reset this workspace layout and freeform window positions';

  const shortcutWrap = document.createElement('div');
  shortcutWrap.className = 'logger-shortcut-wrap';

  const shortcutButton = document.createElement('button');
  shortcutButton.type = 'button';
  shortcutButton.className = 'logger-shortcut-button';
  shortcutButton.textContent = '⌨';
  shortcutButton.title = 'Keyboard shortcuts';
  shortcutButton.setAttribute('aria-label', 'Keyboard shortcuts');
  shortcutButton.setAttribute('aria-expanded', 'false');

  const shortcutPopover = document.createElement('div');
  shortcutPopover.className = 'logger-shortcut-popover';
  shortcutPopover.hidden = true;
  shortcutPopover.innerHTML = `
    <div class="logger-shortcut-head">
      <strong>Logger keyboard shortcuts</strong>
      <small>Active when focus is not inside a control.</small>
    </div>
    <div class="logger-shortcut-list">
      <span><kbd>Space</kbd><em>Play / pause</em></span>
      <span><kbd>← / →</kbd><em>Step cursor</em></span>
      <span><kbd>A</kbd><em>Set analysis point A</em></span>
      <span><kbd>B</kbd><em>Set analysis point B</em></span>
      <span><kbd>F</kbd><em>Fit full recording</em></span>
      <span><kbd>M</kbd><em>Add marker at cursor</em></span>
      <span><kbd>S</kbd><em>Active pane channel statistics</em></span>
      <span><kbd>?</kbd><em>Show / hide this list</em></span>
    </div>
  `;

  shortcutWrap.append(shortcutButton, shortcutPopover);

  const compareButton = document.createElement('button');
  compareButton.type = 'button';
  compareButton.disabled = true;
  compareButton.textContent = 'Compare';
  headerTools.append(
    valueSearch.element,
    layoutSelect,
    arrangeSelect,
    clearPaneButton,
    resetLayoutButton,
    compareButton,
  );

  const setShortcutPopoverOpen = (open: boolean): void => {
    shortcutPopover.hidden = !open;
    shortcutButton.setAttribute('aria-expanded', String(open));
  };

  shortcutButton.addEventListener('click', (event) => {
    event.stopPropagation();
    setShortcutPopoverOpen(Boolean(shortcutPopover.hidden));
  });
  shortcutPopover.addEventListener('click', (event) => event.stopPropagation());
  document.addEventListener('click', () => setShortcutPopoverOpen(false));

  const page = document.createElement('section');
  page.className = 'logger-page';
  page.setAttribute('aria-label', 'Logger and analyzer workspace');

  const workspaceRow = document.createElement('div');
  workspaceRow.className = 'workspace-row';

  const graphHost = document.createElement('main');
  graphHost.className = 'graph-workspace graph-workspace--single';

  const paneRuntimes = GRAPH_PANE_IDS.map((id, index) => {
    const graph = createGraphViewport();
    const windowElement = document.createElement('article');
    windowElement.className = 'graph-window';
    windowElement.dataset.paneId = id;

    const header = document.createElement('header');
    header.className = 'graph-pane-header';
    const title = document.createElement('strong');
    title.textContent = `Graph ${index + 1}`;
    const state = document.createElement('span');
    state.className = 'graph-pane-state';
    state.textContent = index === 0 ? 'ACTIVE' : '';

    const dragGrip = document.createElement('span');
    dragGrip.className = 'graph-pane-drag-grip';
    dragGrip.setAttribute('aria-hidden', 'true');

    const controls = document.createElement('span');
    controls.className = 'graph-pane-window-controls';

    const minimizeButton = document.createElement('button');
    minimizeButton.type = 'button';
    minimizeButton.className = 'graph-pane-window-button graph-pane-minimize';
    minimizeButton.textContent = '–';
    minimizeButton.title = 'Minimize graph window';

    const maximizeButton = document.createElement('button');
    maximizeButton.type = 'button';
    maximizeButton.className = 'graph-pane-window-button graph-pane-maximize';
    maximizeButton.textContent = '□';
    maximizeButton.title = 'Maximize graph window';

    controls.append(minimizeButton, maximizeButton);
    header.append(title, state, dragGrip, controls);

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'graph-pane-resize-handle';
    resizeHandle.title = 'Resize graph window';

    windowElement.append(header, graph.element, resizeHandle);
    graphHost.append(windowElement);

    return {
      id,
      graph,
      windowElement,
      stateElement: state,
      dragGrip,
      headerElement: header,
      minimizeButton,
      maximizeButton,
      resizeHandle,
      activeChannelIds: new Set<string>(),
    };
  });

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

  const activePaneState = (): GraphPaneState | undefined => {
    const workspace = activeWorkspace();
    if (!workspace) return undefined;
    return workspace.panes.find((pane) => pane.id === workspace.activePaneId) ?? workspace.panes[0];
  };

  const activePaneRuntime = () => {
    const pane = activePaneState();
    return paneRuntimes.find((runtime) => runtime.id === pane?.id) ?? paneRuntimes[0];
  };

  const refreshWorkspaceSelector = (): void => {
    graphSelector.setWorkspaces(
      workspaces.map(({ id, name }) => ({ id, name })),
      activeWorkspaceId,
    );
  };

  const channelIdentityOptions = () => ({
    knownChannelIds: new Set(channelDefinitions.keys()),
    aliases: channelIdAliases,
    iniCatalogActive: catalogChannelDefinitions.size > 0,
    limit: MAX_ACTIVE_WEB_TRACES,
  });

  const normalizePersistentChannelIds = (
    channelIds: readonly string[],
  ): string[] => normalizeWorkspaceChannelIds(channelIds, channelIdentityOptions());

  const renderablePersistentChannelIds = (
    channelIds: readonly string[],
  ): string[] => renderableWorkspaceChannelIds(channelIds, channelIdentityOptions());

  const syncPaneAssignedChannels = (
    runtime: (typeof paneRuntimes)[number],
    pane: GraphPaneState | undefined,
  ): void => {
    const assigned = renderablePersistentChannelIds(pane?.channelIds ?? [])
      .flatMap((id) => {
        const channel = channelDefinitions.get(id);
        return channel ? [channel] : [];
      })
      .slice(0, MAX_ACTIVE_WEB_TRACES);
    runtime.graph.setAssignedChannels(assigned);
  };

  interface ActivePaneSyncPerformance {
    readonly resolveMs: number;
    readonly assignedNormalizeMs: number;
    readonly inspectorActiveMs: number;
    readonly inspectorQueuedMs: number;
    readonly valueSearchMs: number;
    readonly assignedSyncMs: number;
    readonly overviewMs: number;
    readonly totalMs: number;
  }

  const syncActivePaneContext = (
    options: { readonly syncAssignedChannels?: boolean } = {},
  ): ActivePaneSyncPerformance => {
    const now = (): number => globalThis.performance?.now() ?? Date.now();
    const started = now();
    let stageStarted = started;
    const runtime = activePaneRuntime();
    const pane = activePaneState();
    const resolveMs = now() - stageStarted;

    stageStarted = now();
    const assignedIds = renderablePersistentChannelIds(pane?.channelIds ?? []);
    const assignedNormalizeMs = now() - stageStarted;

    stageStarted = now();
    inspector.setActiveChannels(assignedIds);
    const inspectorActiveMs = now() - stageStarted;

    stageStarted = now();
    inspector.setQueuedChannels([]);
    const inspectorQueuedMs = now() - stageStarted;

    stageStarted = now();
    valueSearch.setActiveChannels(
      runtime
        ? [...runtime.activeChannelIds].flatMap((id) => {
            const channel = channelDefinitions.get(id);
            return channel ? [channel] : [];
          })
        : [],
    );
    const valueSearchMs = now() - stageStarted;

    stageStarted = now();
    if (runtime && options.syncAssignedChannels !== false) syncPaneAssignedChannels(runtime, pane);
    const assignedSyncMs = now() - stageStarted;

    stageStarted = now();
    timeline.setOverviewContent(runtime?.graph.getOverviewTraces() ?? [], logMarkers);
    const overviewMs = now() - stageStarted;

    return {
      resolveMs, assignedNormalizeMs, inspectorActiveMs, inspectorQueuedMs,
      valueSearchMs, assignedSyncMs, overviewMs, totalMs: now() - started,
    };
  };

  const renderGraphLayout = (): void => {
    const workspace = activeWorkspace();
    if (!workspace) return;

    const visibleCount = paneCountForLayout(workspace.layout);
    const activeIndex = workspace.panes.findIndex((pane) => pane.id === workspace.activePaneId);
    if (activeIndex < 0 || activeIndex >= visibleCount) {
      workspace.activePaneId = workspace.panes[0]?.id ?? 'pane-1';
    }

    layoutSelect.value = workspace.layout;
    arrangeSelect.hidden = workspace.layout !== 'freeform';
    arrangeSelect.value = workspace.freeformArrange;
    graphHost.className = `graph-workspace graph-workspace--${workspace.layout}`;

    paneRuntimes.forEach((runtime) => {
      runtime.graph.setDisplayMode(workspace.layout === 'single' ? 'stacked' : 'overlay');
    });

    paneRuntimes.forEach((runtime, index) => {
      const inLayout = index < visibleCount;
      const maximized = workspace.maximizedPaneId === runtime.id;
      const hiddenByMaximize = workspace.maximizedPaneId !== undefined && !maximized;
      const visible = inLayout && !hiddenByMaximize;
      const active = runtime.id === workspace.activePaneId;
      const minimized = workspace.layout === 'freeform'
        && workspace.minimizedPaneIds.includes(runtime.id)
        && !maximized;

      runtime.windowElement.hidden = !visible;
      runtime.windowElement.classList.toggle('graph-window--active', active);
      runtime.windowElement.classList.toggle('graph-window--minimized', minimized);
      runtime.windowElement.classList.toggle('graph-window--maximized', maximized);
      runtime.stateElement.textContent = active ? 'ACTIVE' : '';
      runtime.dragGrip.hidden = workspace.layout !== 'freeform';
      runtime.minimizeButton.hidden = workspace.layout !== 'freeform';
      runtime.maximizeButton.hidden = workspace.layout !== 'freeform';
      runtime.resizeHandle.hidden = workspace.layout !== 'freeform' || minimized || maximized;
      syncPaneAssignedChannels(runtime, workspace.panes[index]);
      runtime.minimizeButton.textContent = minimized ? '↥' : '–';
      runtime.minimizeButton.title = minimized ? 'Restore graph window' : 'Minimize graph window';
      runtime.maximizeButton.textContent = maximized ? '↙' : '□';
      runtime.maximizeButton.title = maximized ? 'Restore graph window' : 'Maximize graph window';

      if (workspace.layout === 'freeform') {
        const geometry = workspace.paneGeometry[runtime.id] ?? freeformArrangement('mosaic')[runtime.id]!;
        if (maximized) {
          runtime.windowElement.style.left = '0';
          runtime.windowElement.style.top = '0';
          runtime.windowElement.style.width = '100%';
          runtime.windowElement.style.height = '100%';
        } else {
          runtime.windowElement.style.left = `${geometry.x * 100}%`;
          runtime.windowElement.style.top = `${geometry.y * 100}%`;
          runtime.windowElement.style.width = `${geometry.width * 100}%`;
          runtime.windowElement.style.height = `${geometry.height * 100}%`;
        }
      } else {
        runtime.windowElement.style.removeProperty('left');
        runtime.windowElement.style.removeProperty('top');
        runtime.windowElement.style.removeProperty('width');
        runtime.windowElement.style.removeProperty('height');
      }
    });
  };

  const refreshViewHistoryState = (): void => {
    const workspace = activeWorkspace();
    timeline.setViewHistoryState(
      Boolean(workspace && workspace.viewHistoryIndex > 0),
      Boolean(workspace && workspace.viewHistoryIndex >= 0 && workspace.viewHistoryIndex < workspace.viewHistory.length - 1),
    );
  };

  const recordViewportHistory = (nextViewport: TimelineViewport, coalesce = false): void => {
    const workspace = activeWorkspace();
    if (!workspace) return;
    const now = globalThis.performance?.now() ?? Date.now();
    const current = workspace.viewHistory[workspace.viewHistoryIndex];
    if (current && viewportEquals(current, nextViewport)) {
      refreshViewHistoryState();
      return;
    }

    if (
      coalesce
      && workspace.viewHistoryIndex > 0
      && now - workspace.lastHistoryMutationMs < 300
    ) {
      workspace.viewHistory[workspace.viewHistoryIndex] = { ...nextViewport };
    } else {
      workspace.viewHistory = workspace.viewHistory.slice(0, workspace.viewHistoryIndex + 1);
      workspace.viewHistory.push({ ...nextViewport });
      if (workspace.viewHistory.length > 40) workspace.viewHistory.shift();
      workspace.viewHistoryIndex = workspace.viewHistory.length - 1;
    }
    workspace.lastHistoryMutationMs = now;
    refreshViewHistoryState();
  };

  const saveCurrentWorkspace = (): void => {
    const workspace = activeWorkspace();
    if (!workspace) return;
    // Pane channelIds are persistent assignments, not a mirror of currently
    // decoded traces. Keep them intact when no log data is bound.
    workspace.viewport = viewport ? { ...viewport } : undefined;
    workspace.cursorTimeMs = timeline.getCursorTime();
  };

  const syncViewport = (
    nextViewport: TimelineViewport | undefined,
    historyMode: 'none' | 'record' | 'coalesce' = 'none',
  ): void => {
    viewport = nextViewport;
    timeline.setViewport(nextViewport);
    paneRuntimes.forEach((runtime) => runtime.graph.setViewport(nextViewport));
    const workspace = activeWorkspace();
    if (workspace) workspace.viewport = nextViewport ? { ...nextViewport } : undefined;
    if (nextViewport && historyMode !== 'none') {
      recordViewportHistory(nextViewport, historyMode === 'coalesce');
    } else {
      refreshViewHistoryState();
    }
  };

  const setCursorWithoutFollow = (timeMs: number): void => {
    previousCursorTimeMs = timeMs;
    timeline.setCursorTime(timeMs);
    paneRuntimes.forEach((runtime) => runtime.graph.setCursorTime(timeMs));
    const workspace = activeWorkspace();
    if (workspace) workspace.cursorTimeMs = timeMs;
  };

  const centerCursorInViewport = (targetViewport: TimelineViewport): void => {
    setCursorWithoutFollow((targetViewport.visibleStartMs + targetViewport.visibleEndMs) / 2);
  };

  const applyViewportIntent = (intent: TimelineViewportIntent): void => {
    if (!viewport) return;
    const workspace = activeWorkspace();

    if (intent.type === 'history-back' || intent.type === 'history-forward') {
      if (!workspace) return;
      const delta = intent.type === 'history-back' ? -1 : 1;
      const nextIndex = workspace.viewHistoryIndex + delta;
      const historical = workspace.viewHistory[nextIndex];
      if (!historical) return;
      workspace.viewHistoryIndex = nextIndex;
      workspace.lastHistoryMutationMs = 0;
      syncViewport({ ...historical }, 'none');
      centerCursorInViewport(historical);
      refreshViewHistoryState();
      return;
    }

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

    if (!viewportEquals(viewport, next)) {
      const historyMode = intent.type === 'pan' || intent.type === 'resize' ? 'coalesce' : 'record';
      syncViewport(next, historyMode);
    }
    if (intent.type !== 'fit' && intent.centerCursor) centerCursorInViewport(next);
  };

  const setActivePane = (paneId: string, emit = true): void => {
    const workspace = activeWorkspace();
    if (!workspace) return;
    const visibleCount = paneCountForLayout(workspace.layout);
    const paneIndex = workspace.panes.findIndex((pane) => pane.id === paneId);
    if (paneIndex < 0 || paneIndex >= visibleCount || workspace.activePaneId === paneId) return;
    workspace.activePaneId = paneId;
    renderGraphLayout();
    syncActivePaneContext();
    if (emit) emitWorkspaceMutation();
  };

  paneRuntimes.forEach((runtime) => {
    runtime.windowElement.addEventListener('pointerdown', () => setActivePane(runtime.id));
  });

  layoutSelect.addEventListener('change', () => {
    const workspace = activeWorkspace();
    if (!workspace) return;
    workspace.layout = layoutSelect.value as GraphWorkspaceLayout;
    const visibleCount = paneCountForLayout(workspace.layout);
    const activeIndex = workspace.panes.findIndex((pane) => pane.id === workspace.activePaneId);
    if (activeIndex < 0 || activeIndex >= visibleCount) workspace.activePaneId = 'pane-1';
    renderGraphLayout();
    syncActivePaneContext();
    emitWorkspaceMutation();
  });

  arrangeSelect.addEventListener('change', () => {
    const workspace = activeWorkspace();
    if (!workspace) return;
    workspace.layout = 'freeform';
    workspace.freeformArrange = arrangeSelect.value as FreeformArrange;
    workspace.paneGeometry = freeformArrangement(workspace.freeformArrange);
    workspace.minimizedPaneIds = [];
    workspace.maximizedPaneId = undefined;
    renderGraphLayout();
    syncActivePaneContext();
    emitWorkspaceMutation();
  });

  clearPaneButton.addEventListener('click', () => {
    const workspace = activeWorkspace();
    const pane = activePaneState();
    const runtime = activePaneRuntime();
    if (!workspace || !pane || !runtime) return;
    runtime.graph.clearChannels();
    runtime.activeChannelIds.clear();
    pane.channelIds = [];
    syncActivePaneContext();
    emitWorkspaceMutation();
  });

  resetLayoutButton.addEventListener('click', () => {
    const workspace = activeWorkspace();
    if (!workspace) return;
    workspace.layout = 'single';
    workspace.activePaneId = 'pane-1';
    workspace.paneGeometry = freeformArrangement('mosaic');
    workspace.minimizedPaneIds = [];
    workspace.maximizedPaneId = undefined;
    workspace.freeformArrange = 'mosaic';
    renderGraphLayout();
    syncActivePaneContext();
    emitWorkspaceMutation();
  });

  const snapWithin = (
    value: number,
    candidates: readonly number[],
    threshold = 10,
  ): number => {
    let best = value;
    let bestDistance = threshold + 1;
    for (const candidate of candidates) {
      const distance = Math.abs(value - candidate);
      if (distance <= threshold && distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
    return best;
  };

  paneRuntimes.forEach((runtime) => {
    runtime.minimizeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const workspace = activeWorkspace();
      if (!workspace || workspace.layout !== 'freeform') return;
      setActivePane(runtime.id, false);
      if (workspace.minimizedPaneIds.includes(runtime.id)) {
        workspace.minimizedPaneIds = workspace.minimizedPaneIds.filter((id) => id !== runtime.id);
      } else {
        workspace.minimizedPaneIds = [...workspace.minimizedPaneIds, runtime.id];
        if (workspace.maximizedPaneId === runtime.id) workspace.maximizedPaneId = undefined;
      }
      renderGraphLayout();
      emitWorkspaceMutation();
    });

    runtime.maximizeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const workspace = activeWorkspace();
      if (!workspace || workspace.layout !== 'freeform') return;
      setActivePane(runtime.id, false);
      workspace.minimizedPaneIds = workspace.minimizedPaneIds.filter((id) => id !== runtime.id);
      workspace.maximizedPaneId = workspace.maximizedPaneId === runtime.id ? undefined : runtime.id;
      renderGraphLayout();
      emitWorkspaceMutation();
    });

    let drag:
      | {
          pointerId: number;
          startX: number;
          startY: number;
          startLeft: number;
          startTop: number;
          width: number;
          height: number;
        }
      | undefined;

    runtime.headerElement.addEventListener('pointerdown', (event) => {
      const workspace = activeWorkspace();
      if (
        workspace?.layout !== 'freeform'
        || workspace.maximizedPaneId
        || workspace.minimizedPaneIds.includes(runtime.id)
        || (event.target instanceof Element && event.target.closest('.graph-pane-window-button'))
      ) return;

      const hostRect = graphHost.getBoundingClientRect();
      const rect = runtime.windowElement.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: rect.left - hostRect.left,
        startTop: rect.top - hostRect.top,
        width: rect.width,
        height: rect.height,
      };
      runtime.headerElement.setPointerCapture(event.pointerId);
      setActivePane(runtime.id, false);
      workspace.freeformArrange = 'custom';
      arrangeSelect.value = 'custom';
      event.preventDefault();
    });

    runtime.headerElement.addEventListener('pointermove', (event) => {
      const workspace = activeWorkspace();
      if (!drag || event.pointerId !== drag.pointerId || workspace?.layout !== 'freeform') return;

      const hostRect = graphHost.getBoundingClientRect();
      const hostWidth = Math.max(1, hostRect.width);
      const hostHeight = Math.max(1, hostRect.height);
      let left = Math.max(0, Math.min(hostWidth - drag.width, drag.startLeft + event.clientX - drag.startX));
      let top = Math.max(0, Math.min(hostHeight - drag.height, drag.startTop + event.clientY - drag.startY));

      const xCandidates = [0, hostWidth - drag.width];
      const yCandidates = [0, hostHeight - drag.height];
      for (const other of paneRuntimes) {
        if (other.id === runtime.id || other.windowElement.hidden) continue;
        const otherRect = other.windowElement.getBoundingClientRect();
        const otherLeft = otherRect.left - hostRect.left;
        const otherTop = otherRect.top - hostRect.top;
        xCandidates.push(otherLeft, otherLeft + otherRect.width, otherLeft - drag.width, otherLeft + otherRect.width - drag.width);
        yCandidates.push(otherTop, otherTop + otherRect.height, otherTop - drag.height, otherTop + otherRect.height - drag.height);
      }
      left = snapWithin(left, xCandidates);
      top = snapWithin(top, yCandidates);

      workspace.paneGeometry[runtime.id] = {
        x: left / hostWidth,
        y: top / hostHeight,
        width: drag.width / hostWidth,
        height: drag.height / hostHeight,
      };
      runtime.windowElement.style.left = `${left}px`;
      runtime.windowElement.style.top = `${top}px`;
      runtime.windowElement.style.width = `${drag.width}px`;
      runtime.windowElement.style.height = `${drag.height}px`;
    });

    const endDrag = (event: PointerEvent): void => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag = undefined;
      emitWorkspaceMutation();
    };
    runtime.headerElement.addEventListener('pointerup', endDrag);
    runtime.headerElement.addEventListener('pointercancel', endDrag);

    let resizeDrag:
      | {
          pointerId: number;
          startX: number;
          startY: number;
          startWidth: number;
          startHeight: number;
          left: number;
          top: number;
        }
      | undefined;

    runtime.resizeHandle.addEventListener('pointerdown', (event) => {
      const workspace = activeWorkspace();
      if (workspace?.layout !== 'freeform' || workspace.maximizedPaneId) return;
      const hostRect = graphHost.getBoundingClientRect();
      const rect = runtime.windowElement.getBoundingClientRect();
      workspace.freeformArrange = 'custom';
      arrangeSelect.value = 'custom';
      resizeDrag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: rect.width,
        startHeight: rect.height,
        left: rect.left - hostRect.left,
        top: rect.top - hostRect.top,
      };
      runtime.resizeHandle.setPointerCapture(event.pointerId);
      setActivePane(runtime.id, false);
      event.preventDefault();
      event.stopPropagation();
    });

    runtime.resizeHandle.addEventListener('pointermove', (event) => {
      const workspace = activeWorkspace();
      if (!resizeDrag || event.pointerId !== resizeDrag.pointerId || workspace?.layout !== 'freeform') return;

      const hostRect = graphHost.getBoundingClientRect();
      const hostWidth = Math.max(1, hostRect.width);
      const hostHeight = Math.max(1, hostRect.height);
      let width = Math.max(190, Math.min(hostWidth - resizeDrag.left, resizeDrag.startWidth + event.clientX - resizeDrag.startX));
      let height = Math.max(120, Math.min(hostHeight - resizeDrag.top, resizeDrag.startHeight + event.clientY - resizeDrag.startY));

      const rightCandidates = [hostWidth];
      const bottomCandidates = [hostHeight];
      for (const other of paneRuntimes) {
        if (other.id === runtime.id || other.windowElement.hidden) continue;
        const otherRect = other.windowElement.getBoundingClientRect();
        rightCandidates.push(otherRect.left - hostRect.left, otherRect.right - hostRect.left);
        bottomCandidates.push(otherRect.top - hostRect.top, otherRect.bottom - hostRect.top);
      }
      width = snapWithin(resizeDrag.left + width, rightCandidates) - resizeDrag.left;
      height = snapWithin(resizeDrag.top + height, bottomCandidates) - resizeDrag.top;
      width = Math.max(190, Math.min(hostWidth - resizeDrag.left, width));
      height = Math.max(120, Math.min(hostHeight - resizeDrag.top, height));

      workspace.paneGeometry[runtime.id] = {
        x: resizeDrag.left / hostWidth,
        y: resizeDrag.top / hostHeight,
        width: width / hostWidth,
        height: height / hostHeight,
      };
      runtime.windowElement.style.width = `${width}px`;
      runtime.windowElement.style.height = `${height}px`;
    });

    const endResize = (event: PointerEvent): void => {
      if (!resizeDrag || event.pointerId !== resizeDrag.pointerId) return;
      resizeDrag = undefined;
      emitWorkspaceMutation();
    };
    runtime.resizeHandle.addEventListener('pointerup', endResize);
    runtime.resizeHandle.addEventListener('pointercancel', endResize);
  });

  const restoreWorkspace = async (workspaceId: string, force = false): Promise<void> => {
    const now = (): number => globalThis.performance?.now() ?? Date.now();
    const restoreStarted = now();
    const target = workspaces.find((workspace) => workspace.id === workspaceId);
    if (!target || (target.id === activeWorkspaceId && !force)) {
      renderGraphLayout();
      syncActivePaneContext();
      return;
    }

    if (!force) saveCurrentWorkspace();
    const prepareStarted = now();
    let prepareStageStarted = prepareStarted;
    const generation = ++workspaceGeneration;
    activeWorkspaceId = target.id;
    refreshWorkspaceSelector();
    refreshViewHistoryState();
    const prepareStateMs = now() - prepareStageStarted;

    prepareStageStarted = now();
    paneRuntimes.forEach((runtime) => {
      runtime.graph.clearChannels({ render: false });
      runtime.activeChannelIds.clear();
    });
    inspector.setActiveChannels([]);
    inspector.setQueuedChannels([]);
    valueSearch.setActiveChannels([]);
    timeline.setOverviewContent([], logMarkers);
    const prepareClearMs = now() - prepareStageStarted;

    prepareStageStarted = now();
    renderGraphLayout();
    const prepareLayoutMs = now() - prepareStageStarted;

    prepareStageStarted = now();
    if (target.viewport) syncViewport({ ...target.viewport });
    setCursorWithoutFollow(target.cursorTimeMs);
    const prepareViewportMs = now() - prepareStageStarted;

    prepareStageStarted = now();
    const visibleCount = paneCountForLayout(target.layout);
    const paneRequests = paneRuntimes.slice(0, visibleCount).map((runtime, index) => {
      const pane = target.panes[index];
      const normalizedIds = pane
        ? normalizePersistentChannelIds(pane.channelIds)
        : [];
      const assignedIds = renderablePersistentChannelIds(normalizedIds);
      if (pane && channelIdAliases.size > 0) pane.channelIds = [...assignedIds];
      const requestedIds = channelDataSource
        ? assignedIds.filter(
            (channelId) =>
              channelDefinitions.has(channelId)
              && !unavailableChannelIds.has(channelId),
          )
        : [];
      return { runtime, pane, assignedIds, requestedIds };
    });

    const preparePaneRequestsMs = now() - prepareStageStarted;

    prepareStageStarted = now();
    const uniqueRequestedIds = [...new Set(paneRequests.flatMap((request) => request.requestedIds))];
    const batchRequestedIds = uniqueRequestedIds;
    const prepareBatchPlanMs = now() - prepareStageStarted;
    const prepareMs = now() - prepareStarted;
    let sharedBatchMs = 0;
    let sharedBatchCacheHit = true;
    let sharedBatchRanges: ReadonlyMap<string, NumericChannelRange> | undefined;
    let sharedPhysicalReadCount = 0;
    let sharedPhysicalBytesRead = 0;
    let sharedPhysicalReadMs = 0;
    if (
      visibleCount > 1
      && uniqueRequestedIds.length > 0
      && channelDataSource?.readChannelsRange
    ) {
      const batchStarted = globalThis.performance?.now() ?? Date.now();
      const batch = await channelDataSource.readChannelsRange(
        batchRequestedIds,
        0,
        channelDataSource.sampleCount,
      );
      const batchElapsed = (globalThis.performance?.now() ?? Date.now()) - batchStarted;
      sharedBatchMs = batchElapsed;
      sharedBatchRanges = batch.ranges;
      sharedBatchCacheHit =
        batch.performance.cacheHitChannelIds.length === batchRequestedIds.length;
      sharedPhysicalReadCount = batch.performance.physicalReadCount;
      sharedPhysicalBytesRead = batch.performance.physicalBytesRead;
      sharedPhysicalReadMs = batch.performance.physicalReadMs;
      if (generation !== workspaceGeneration || activeWorkspaceId !== target.id) return;

      channelPerformanceListener?.({
        channelId: '__multi-pane-restore__',
        channelName: `Multi-pane restore (${uniqueRequestedIds.length} channels)`,
        phase: 'full',
        startSampleIndex: 0,
        requestedSampleCount: channelDataSource.sampleCount,
        totalMs: batchElapsed,
        readDecodeMs: batchElapsed,
        scaleMs: 0,
        renderMs: 0,
        sampleCount: channelDataSource.sampleCount,
        batchSize: batchRequestedIds.length,
        cacheHit: batch.performance.cacheHitChannelIds.length === batchRequestedIds.length,
        physicalReadCount: batch.performance.physicalReadCount,
        physicalBytesRead: batch.performance.physicalBytesRead,
        physicalReadMs: batch.performance.physicalReadMs,
      });
    }

    const activationStarted = now();
    let activationGraphTotalMs = 0;
    let activationChannelLookupMs = 0;
    let activationStatisticsScaleMs = 0;
    let activationTraceRegistrationMs = 0;
    let activationReadoutMs = 0;
    let activationCursorMs = 0;
    let activationDrawMs = 0;
    let activationEnvelopeMs = 0;
    let activationDrawSetupMs = 0;
    let activationDrawTraceMs = 0;
    let activationDrawOverlayMs = 0;
    const loads = paneRequests.map(async ({ runtime, pane, assignedIds, requestedIds }) => {
      if (!pane || requestedIds.length === 0) return;

      if (sharedBatchRanges) {
        const preloaded = new Map<string, NumericChannelRange>();
        for (const channelId of requestedIds) {
          const range = sharedBatchRanges.get(channelId);
          if (range) preloaded.set(channelId, range);
        }

        if (preloaded.size === requestedIds.length) {
          const activation = runtime.graph.activatePreloadedChannels(preloaded);
          const graphPerformance = activation.performance;
          activationGraphTotalMs += graphPerformance.totalMs;
          activationChannelLookupMs += graphPerformance.channelLookupMs;
          activationStatisticsScaleMs += graphPerformance.statisticsScaleMs;
          activationTraceRegistrationMs += graphPerformance.traceRegistrationMs;
          activationReadoutMs += graphPerformance.readoutMs;
          activationCursorMs += graphPerformance.cursorMs;
          activationDrawMs += graphPerformance.drawMs;
          activationEnvelopeMs += graphPerformance.envelopeMs;
          activationDrawSetupMs += graphPerformance.drawSetupMs;
          activationDrawTraceMs += graphPerformance.drawTraceMs;
          activationDrawOverlayMs += graphPerformance.drawOverlayMs;
          runtime.activeChannelIds.clear();
          activation.activatedChannelIds.forEach((channelId) => runtime.activeChannelIds.add(channelId));
          pane.channelIds = [...assignedIds];
          return;
        }
      }

      const activations = requestedIds.map((channelId) => runtime.graph.toggleChannel(channelId));
      runtime.graph.loadPendingChannels();
      const results = await Promise.all(activations);
      if (generation !== workspaceGeneration || activeWorkspaceId !== target.id) return;

      runtime.activeChannelIds.clear();
      requestedIds.forEach((channelId, resultIndex) => {
        if (results[resultIndex]) runtime.activeChannelIds.add(channelId);
      });
      pane.channelIds = [...assignedIds];
    });

    await Promise.all(loads);
    const activationMs = now() - activationStarted;
    if (generation !== workspaceGeneration || activeWorkspaceId !== target.id) return;
    const finalSyncStarted = now();
    const finalSyncPerformance = syncActivePaneContext({ syncAssignedChannels: false });
    const finalSyncMs = now() - finalSyncStarted;
    workspaceRestorePerformanceListener?.({
      totalMs: now() - restoreStarted,
      prepareMs,
      prepareStateMs,
      prepareClearMs,
      prepareLayoutMs,
      prepareViewportMs,
      preparePaneRequestsMs,
      prepareBatchPlanMs,
      sharedBatchMs,
      activationMs,
      activationGraphTotalMs,
      activationChannelLookupMs,
      activationStatisticsScaleMs,
      activationTraceRegistrationMs,
      activationReadoutMs,
      activationCursorMs,
      activationDrawMs,
      activationEnvelopeMs,
      activationDrawSetupMs,
      activationDrawTraceMs,
      activationDrawOverlayMs,
      finalSyncMs,
      finalSyncResolveMs: finalSyncPerformance.resolveMs,
      finalSyncAssignedNormalizeMs: finalSyncPerformance.assignedNormalizeMs,
      finalSyncInspectorActiveMs: finalSyncPerformance.inspectorActiveMs,
      finalSyncInspectorQueuedMs: finalSyncPerformance.inspectorQueuedMs,
      finalSyncValueSearchMs: finalSyncPerformance.valueSearchMs,
      finalSyncAssignedSyncMs: finalSyncPerformance.assignedSyncMs,
      finalSyncOverviewMs: finalSyncPerformance.overviewMs,
      visiblePaneCount: visibleCount,
      assignedChannelCount: paneRequests.reduce(
        (sum, request) => sum + request.assignedIds.length,
        0,
      ),
      requestedChannelCount: paneRequests.reduce(
        (sum, request) => sum + request.requestedIds.length,
        0,
      ),
      uniqueRequestedChannelCount: uniqueRequestedIds.length,
      cacheHit: sharedBatchCacheHit,
      physicalReadCount: sharedPhysicalReadCount,
      physicalBytesRead: sharedPhysicalBytesRead,
      physicalReadMs: sharedPhysicalReadMs,
    });
  };

  inspector.onChannelToggled((channelId) => {
    const runtime = activePaneRuntime();
    const pane = activePaneState();
    if (!runtime || !pane || !channelDefinitions.has(channelId)) return;

    const currentAssignedIds = renderablePersistentChannelIds(pane.channelIds);
    if (currentAssignedIds.length !== pane.channelIds.length) {
      pane.channelIds = [...currentAssignedIds];
    }

    if (pane.channelIds.includes(channelId)) {
      pane.channelIds = pane.channelIds.filter((id) => id !== channelId);
      syncPaneAssignedChannels(runtime, pane);
      if (runtime.activeChannelIds.has(channelId)) {
        void runtime.graph.toggleChannel(channelId).then(() => {
          runtime.activeChannelIds.delete(channelId);
          syncActivePaneContext();
        });
      } else {
        syncActivePaneContext();
      }
      emitWorkspaceMutation();
      return;
    }

    if (pane.channelIds.length >= MAX_ACTIVE_WEB_TRACES) return;
    pane.channelIds = [...pane.channelIds, channelId];
    syncPaneAssignedChannels(runtime, pane);
    syncActivePaneContext();
    emitWorkspaceMutation();

    if (!channelDataSource || unavailableChannelIds.has(channelId)) return;
    void runtime.graph.toggleChannel(channelId).then((active) => {
      if (active) runtime.activeChannelIds.add(channelId);
      syncActivePaneContext();
    });
  });

  inspector.onLoadSelected(() => {
    activePaneRuntime()?.graph.loadPendingChannels();
  });

  inspector.onAddFiltered((channelIds) => {
    const runtime = activePaneRuntime();
    const pane = activePaneState();
    if (!runtime || !pane) return;

    const currentAssignedIds = renderablePersistentChannelIds(pane.channelIds);
    if (currentAssignedIds.length !== pane.channelIds.length) {
      pane.channelIds = [...currentAssignedIds];
    }

    const remaining = Math.max(0, MAX_ACTIVE_WEB_TRACES - pane.channelIds.length);
    const assignedIds = channelIds
      .filter((channelId) => channelDefinitions.has(channelId) && !pane.channelIds.includes(channelId))
      .slice(0, remaining);
    if (assignedIds.length === 0) return;

    pane.channelIds = [...pane.channelIds, ...assignedIds];
    syncPaneAssignedChannels(runtime, pane);
    syncActivePaneContext();
    emitWorkspaceMutation();

    if (!channelDataSource) return;
    const requestedIds = assignedIds.filter((channelId) => !unavailableChannelIds.has(channelId));
    if (requestedIds.length === 0) return;
    const activations = requestedIds.map((channelId) => runtime.graph.toggleChannel(channelId));
    runtime.graph.loadPendingChannels();
    void Promise.all(activations).then((results) => {
      requestedIds.forEach((channelId, index) => {
        if (results[index]) runtime.activeChannelIds.add(channelId);
      });
      syncActivePaneContext();
    });
  });

  inspector.onChannelDetailsRequested((channelId) => {
    const channel = channelDefinitions.get(channelId);
    const statistics = activePaneRuntime()?.graph.getChannelStatistics(channelId);
    if (!channel || !statistics) {
      inspector.setChannelStatistics(undefined);
      return;
    }
    inspector.setChannelStatistics({
      channelId,
      title: channel.displayName || channel.sourceName,
      unit: channel.unit,
      category: channel.category,
      current: statistics.current,
      full: statistics.full,
      visible: statistics.visible,
    });
  });

  paneRuntimes.forEach((runtime) => {
    runtime.graph.onPendingChannelsChanged((channelIds) => {
      if (runtime.id === activeWorkspace()?.activePaneId) {
        inspector.setQueuedChannels(channelIds);
      }
    });

    runtime.graph.onChannelPerformance((performance) => {
      const channel = channelDefinitions.get(performance.channelId);
      channelPerformanceListener?.({
        ...performance,
        channelName: channel?.sourceName ?? performance.channelId,
      });
      if (runtime.id === activeWorkspace()?.activePaneId) {
        timeline.setOverviewContent(runtime.graph.getOverviewTraces(), logMarkers);
      }
    });

    runtime.graph.onCursorValues((values) => {
      if (runtime.id !== activeWorkspace()?.activePaneId) return;
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

    runtime.graph.onZoom((factor, anchorMs) => applyViewportIntent({ type: 'zoom', factor, anchorMs }));
    runtime.graph.onPan((deltaMs) => applyViewportIntent({ type: 'pan', deltaMs }));
  });

  timeline.onCursorChange((timeMs) => {
    if (viewport) {
      const nextViewport = followCursor(viewport, previousCursorTimeMs, timeMs);
      if (!viewportEquals(viewport, nextViewport)) syncViewport(nextViewport);
    }
    previousCursorTimeMs = timeMs;
    paneRuntimes.forEach((runtime) => runtime.graph.setCursorTime(timeMs));
    const workspace = activeWorkspace();
    if (workspace) workspace.cursorTimeMs = timeMs;
  });
  timeline.onViewportIntent(applyViewportIntent);
  timeline.onAnnotationChange(({ aTimeMs, bTimeMs }) => {
    paneRuntimes.forEach((runtime) => runtime.graph.setAnalysisRange(aTimeMs, bTimeMs));
  });

  valueSearch.onJump((timeMs) => {
    if (viewport) {
      const centered = centerViewportOn(viewport, timeMs);
      if (!viewportEquals(viewport, centered)) syncViewport(centered);
    }
    setCursorWithoutFollow(timeMs);
  });

  const showActivePaneStatistics = (): void => {
    const runtime = activePaneRuntime();
    const channelId = runtime?.activeChannelIds.values().next().value as string | undefined;
    if (!runtime || !channelId) return;
    const channel = channelDefinitions.get(channelId);
    const statistics = runtime.graph.getChannelStatistics(channelId);
    if (!channel || !statistics) return;
    inspector.setChannelStatistics({
      channelId,
      title: channel.displayName || channel.sourceName,
      unit: channel.unit,
      category: channel.category,
      current: statistics.current,
      full: statistics.full,
      visible: statistics.visible,
    });
  };

  const shortcutTargetIsInteractive = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest('input, textarea, select, button, [contenteditable="true"], [role="dialog"]'),
    );
  };

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !shortcutPopover.hidden) {
      setShortcutPopoverOpen(false);
      return;
    }
    if (shortcutTargetIsInteractive(event.target)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const key = event.key.toLowerCase();
    if (event.repeat && key !== 'arrowleft' && key !== 'arrowright') return;

    let handled = true;
    switch (key) {
      case ' ':
      case 'spacebar':
        timeline.togglePlayback();
        break;
      case 'arrowleft':
        timeline.stepCursor(-1);
        break;
      case 'arrowright':
        timeline.stepCursor(1);
        break;
      case 'a':
        if (event.shiftKey) { handled = false; break; }
        timeline.setAnalysisBoundary('a');
        break;
      case 'b':
        if (event.shiftKey) { handled = false; break; }
        timeline.setAnalysisBoundary('b');
        break;
      case 'f':
        if (event.shiftKey) { handled = false; break; }
        applyViewportIntent({ type: 'fit' });
        break;
      case 'm':
        if (event.shiftKey) { handled = false; break; }
        timeline.addUserMarker();
        break;
      case 's':
        if (event.shiftKey) { handled = false; break; }
        showActivePaneStatistics();
        break;
      case '?':
        setShortcutPopoverOpen(Boolean(shortcutPopover.hidden));
        break;
      default:
        handled = false;
    }

    if (handled) event.preventDefault();
  });

  timeline.onWorkspaceMutation(emitWorkspaceMutation);
  inspector.onWorkspaceMutation(emitWorkspaceMutation);

  graphSelector.onSelect((workspaceId) => {
    void restoreWorkspace(workspaceId);
  });

  graphSelector.onCreate(() => {
    saveCurrentWorkspace();
    workspaceCounter += 1;
    const workspace: GraphWorkspaceState = {
      id: `graph-${workspaceCounter}`,
      name: `Graph ${workspaceCounter}`,
      layout: 'single',
      activePaneId: 'pane-1',
      panes: createEmptyPaneStates(),
      paneGeometry: freeformArrangement('mosaic'),
      minimizedPaneIds: [],
      maximizedPaneId: undefined,
      freeformArrange: 'mosaic',
      viewport: viewport ? { ...viewport } : undefined,
      cursorTimeMs: timeline.getCursorTime(),
      viewHistory: viewport ? [{ ...viewport }] : [],
      viewHistoryIndex: viewport ? 0 : -1,
      lastHistoryMutationMs: 0,
    };
    workspaces.push(workspace);
    void restoreWorkspace(workspace.id).then(emitWorkspaceMutation);
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
    emitWorkspaceMutation();
  });

  graphSelector.onDuplicate(() => {
    const source = activeWorkspace();
    if (!source) return;
    saveCurrentWorkspace();
    workspaceCounter += 1;
    const duplicate: GraphWorkspaceState = {
      id: `graph-${workspaceCounter}`,
      name: `${source.name} copy`,
      layout: source.layout,
      activePaneId: source.activePaneId,
      panes: source.panes.map((pane) => ({ id: pane.id, channelIds: [...pane.channelIds] })),
      paneGeometry: structuredClone(source.paneGeometry),
      minimizedPaneIds: [...source.minimizedPaneIds],
      maximizedPaneId: source.maximizedPaneId,
      freeformArrange: source.freeformArrange,
      viewport: source.viewport ? { ...source.viewport } : undefined,
      cursorTimeMs: source.cursorTimeMs,
      viewHistory: source.viewHistory.map((item) => ({ ...item })),
      viewHistoryIndex: source.viewHistoryIndex,
      lastHistoryMutationMs: 0,
    };
    workspaces.push(duplicate);
    void restoreWorkspace(duplicate.id).then(emitWorkspaceMutation);
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
    void restoreWorkspace(next.id).then(emitWorkspaceMutation);
  });

  timelineWrap.append(timeline.element, timelineToggle);
  page.append(workspaceRow, timelineWrap);

  const setChannelCatalog = (
    channels: readonly ChannelDefinition[],
    sourceName: string,
  ): void => {
    catalogChannelDefinitions = new Map(channels.map((channel) => [channel.id, channel]));
    catalogSourceName = sourceName;

    if (!channelDataSource) {
      channelDefinitions = new Map(catalogChannelDefinitions);
      unavailableChannelIds.clear();
      for (const channel of channels) unavailableChannelIds.add(channel.id);
      inspector.setCatalogChannels(channels, sourceName);
      paneRuntimes.forEach((runtime, index) => {
        syncPaneAssignedChannels(runtime, activeWorkspace()?.panes[index]);
      });
      renderGraphLayout();
      syncActivePaneContext();
    }
  };

  const clearChannelCatalog = (): void => {
    catalogChannelDefinitions.clear();
    catalogSourceName = '';
    if (!channelDataSource) {
      channelDefinitions.clear();
      unavailableChannelIds.clear();
      inspector.setChannels([], 'No source channels');
      paneRuntimes.forEach((runtime, index) => {
        syncPaneAssignedChannels(runtime, activeWorkspace()?.panes[index]);
      });
      renderGraphLayout();
      syncActivePaneContext();
    }
  };

  const setLog = (
    summary: ImportedLogSummary,
    recordCount: number,
    channelData: NumericChannelDataSource,
    options: {
      readonly unavailableChannelIds?: readonly string[];
      readonly channelIdAliases?: ReadonlyMap<string, string>;
    } = {},
  ): LoggerUiPopulationPerformance => {
    const now = (): number => globalThis.performance?.now() ?? Date.now();
    const totalStarted = now();
    const workspaceStarted = now();
    workspaceGeneration += 1;
    const fullViewport = summary.timeRange
      ? createFullViewport(summary.timeRange.startMs, summary.timeRange.endMs)
      : undefined;
    const cursorStart = summary.timeRange?.startMs ?? 0;
    workspaces = workspaces.map((workspace) => ({
      ...workspace,
      viewport: fullViewport ? { ...fullViewport } : undefined,
      cursorTimeMs: cursorStart,
      viewHistory: fullViewport ? [{ ...fullViewport }] : [],
      viewHistoryIndex: fullViewport ? 0 : -1,
      lastHistoryMutationMs: 0,
    }));
    if (!workspaces.some((workspace) => workspace.id === activeWorkspaceId)) {
      activeWorkspaceId = workspaces[0]?.id ?? 'general';
    }
    refreshWorkspaceSelector();
    graphSelector.setEnabled(Boolean(summary.timeRange));
    paneRuntimes.forEach((runtime) => runtime.activeChannelIds.clear());
    const workspaceMs = now() - workspaceStarted;

    const channelModelStarted = now();
    channelDefinitions = new Map(summary.channels.map((channel) => [channel.id, channel]));
    channelIdAliases = new Map(options.channelIdAliases ?? []);
    unavailableChannelIds.clear();
    for (const channelId of options.unavailableChannelIds ?? []) unavailableChannelIds.add(channelId);
    channelDataSource = channelData;
    logMarkers = summary.markers;
    const channelModelMs = now() - channelModelStarted;

    const inspectorStarted = now();
    inspector.setChannels(
      summary.channels,
      summary.source.displayName,
      options.unavailableChannelIds ?? [],
    );
    const inspectorMs = now() - inspectorStarted;

    const timelineStarted = now();
    timeline.setTimeRange(summary.timeRange, recordCount);
    timeline.setOverviewContent([], logMarkers);
    const timelineMs = now() - timelineStarted;

    const graphSetupStarted = now();
    paneRuntimes.forEach((runtime, index) => {
      runtime.graph.setLog(summary.channels, channelData, summary.timeRange);
      syncPaneAssignedChannels(runtime, activeWorkspace()?.panes[index]);
    });
    const graphSetupMs = now() - graphSetupStarted;

    const layoutStarted = now();
    renderGraphLayout();
    const layoutMs = now() - layoutStarted;

    const valueSearchStarted = now();
    valueSearch.setLog(channelData);
    valueSearch.setActiveChannels([]);
    const valueSearchMs = now() - valueSearchStarted;

    const viewportStarted = now();
    if (summary.timeRange) {
      previousCursorTimeMs = summary.timeRange.startMs;
      syncViewport(createFullViewport(summary.timeRange.startMs, summary.timeRange.endMs));
    } else {
      previousCursorTimeMs = 0;
      syncViewport(undefined);
    }
    const viewportMs = now() - viewportStarted;

    const diagnosticsStarted = now();
    diagnostics.setDiagnostics(summary.diagnostics);
    const diagnosticsMs = now() - diagnosticsStarted;

    const performance: LoggerUiPopulationPerformance = {
      totalMs: now() - totalStarted,
      workspaceMs,
      channelModelMs,
      inspectorMs,
      timelineMs,
      graphSetupMs,
      layoutMs,
      valueSearchMs,
      viewportMs,
      diagnosticsMs,
    };

    return performance;
  };

  const setImportError = (message: string): void => {
    workspaceGeneration += 1;
    workspaces = workspaces.map((workspace) => ({
      ...workspace,
      viewport: undefined,
      cursorTimeMs: 0,
      viewHistory: [],
      viewHistoryIndex: -1,
      lastHistoryMutationMs: 0,
    }));
    refreshWorkspaceSelector();
    graphSelector.setEnabled(false);
    paneRuntimes.forEach((runtime) => runtime.activeChannelIds.clear());
    channelDefinitions.clear();
    channelIdAliases.clear();
    unavailableChannelIds.clear();
    channelDataSource = undefined;
    logMarkers = [];
    if (catalogChannelDefinitions.size > 0) {
      channelDefinitions = new Map(catalogChannelDefinitions);
      inspector.setCatalogChannels([...catalogChannelDefinitions.values()], catalogSourceName || 'INI');
    } else {
      inspector.setError(message);
    }
    timeline.setTimeRange(undefined, 0);
    syncViewport(undefined);
    paneRuntimes.forEach((runtime) => runtime.graph.clear());
    renderGraphLayout();
    valueSearch.clear();
    diagnostics.setDiagnostics([{
      code: 'import-failed',
      severity: 'error',
      message,
      recoverable: false,
    }]);
  };

  const getWorkspaceState = (): LoggerWorkspaceState => ({
    activeWorkspaceId,
    workspaces: workspaces.map((workspace): GraphWorkspaceSnapshot => {
      const activePane = workspace.panes.find((pane) => pane.id === workspace.activePaneId) ?? workspace.panes[0];
      return {
      id: workspace.id,
      name: workspace.name,
      channelIds: [...(activePane?.channelIds ?? [])],
      layout: workspace.layout,
      activePaneId: workspace.activePaneId,
      panes: workspace.panes.map((pane): GraphPaneSnapshot => ({
        id: pane.id,
        channelIds: [...pane.channelIds],
      })),
      paneGeometry: structuredClone(workspace.paneGeometry),
      minimizedPaneIds: [...workspace.minimizedPaneIds],
      maximizedPaneId: workspace.maximizedPaneId,
      freeformArrange: workspace.freeformArrange,
      viewport: workspace.viewport ? { ...workspace.viewport } : undefined,
      cursorTimeMs: workspace.cursorTimeMs,
      viewHistory: workspace.viewHistory.map((item) => ({ ...item })),
      viewHistoryIndex: workspace.viewHistoryIndex,
      };
    }),
    timeline: timeline.getWorkspaceState(),
    inspector: inspector.getWorkspaceState(),
  });

  const restoreWorkspaceState = async (state: LoggerWorkspaceState): Promise<void> => {
    restoringWorkspaceState = true;
    workspaceGeneration += 1;
    try {
      workspaces = state.workspaces.map((workspace) => {
        const layout = workspace.layout ?? 'single';
        const panes = normalizePaneStates(workspace.panes, workspace.channelIds).map((pane) => ({
          ...pane,
          channelIds: normalizePersistentChannelIds(pane.channelIds),
        }));
        const visibleIds = panes.slice(0, paneCountForLayout(layout)).map((pane) => pane.id);
        const activePaneId = workspace.activePaneId && visibleIds.includes(workspace.activePaneId)
          ? workspace.activePaneId
          : panes[0]!.id;
        return {
        id: workspace.id,
        name: workspace.name,
        layout,
        activePaneId,
        panes,
        paneGeometry: workspace.paneGeometry
          ? structuredClone(workspace.paneGeometry)
          : freeformArrangement('mosaic'),
        minimizedPaneIds: [...(workspace.minimizedPaneIds ?? [])].filter((id) => GRAPH_PANE_IDS.includes(id as typeof GRAPH_PANE_IDS[number])),
        maximizedPaneId: workspace.maximizedPaneId,
        freeformArrange: workspace.freeformArrange ?? 'mosaic',
        viewport: workspace.viewport ? { ...workspace.viewport } : undefined,
        cursorTimeMs: workspace.cursorTimeMs,
        viewHistory: workspace.viewHistory.map((item) => ({ ...item })),
        viewHistoryIndex: Math.min(
          Math.max(-1, workspace.viewHistoryIndex),
          workspace.viewHistory.length - 1,
        ),
        lastHistoryMutationMs: 0,
        };
      });
      if (workspaces.length === 0) {
        workspaces = [{
          id: 'general',
          name: 'General',
          layout: 'single',
          activePaneId: 'pane-1',
          panes: createEmptyPaneStates(),
          paneGeometry: freeformArrangement('mosaic'),
          minimizedPaneIds: [],
          maximizedPaneId: undefined,
          freeformArrange: 'mosaic',
          viewport: viewport ? { ...viewport } : undefined,
          cursorTimeMs: timeline.getCursorTime(),
          viewHistory: viewport ? [{ ...viewport }] : [],
          viewHistoryIndex: viewport ? 0 : -1,
          lastHistoryMutationMs: 0,
        }];
      }

      workspaceCounter = Math.max(
        1,
        ...workspaces.map((workspace) => {
          const match = workspace.id.match(/^graph-(\d+)$/);
          return match ? Number(match[1]) : 1;
        }),
      );

      inspector.restoreWorkspaceState(state.inspector);
      workspaceRow.classList.toggle('workspace-row--inspector-hidden', !state.inspector.visible);
      sensorToggle.textContent = state.inspector.visible ? 'Hide sensors' : 'Show sensors';
      sensorToggle.title = state.inspector.visible ? 'Hide Full Sensor List' : 'Show Full Sensor List';
      sensorToggle.setAttribute('aria-expanded', String(state.inspector.visible));

      timeline.restoreWorkspaceState(state.timeline);
      timelineWrap.classList.toggle('timeline-wrap--compact', !state.timeline.expanded);
      timelineToggle.textContent = state.timeline.expanded ? 'Hide controls' : 'Show controls';
      timelineToggle.title = state.timeline.expanded ? 'Collapse Timeline controls' : 'Expand Timeline controls';
      timelineToggle.setAttribute('aria-expanded', String(state.timeline.expanded));

      const targetId = workspaces.some((workspace) => workspace.id === state.activeWorkspaceId)
        ? state.activeWorkspaceId
        : workspaces[0]!.id;
      activeWorkspaceId = '';
      refreshWorkspaceSelector();
      await restoreWorkspace(targetId);
      refreshWorkspaceSelector();
      refreshViewHistoryState();
    } finally {
      restoringWorkspaceState = false;
    }
  };

  const getRuntimeDiagnosticSnapshot = (): LoggerRuntimeDiagnosticSnapshot => {
    const workspace = activeWorkspace();
    const visiblePaneCount = workspace ? paneCountForLayout(workspace.layout) : 0;
    const visiblePaneIds = new Set(
      workspace?.panes.slice(0, visiblePaneCount).map((pane) => pane.id) ?? [],
    );
    const panes = paneRuntimes.map((runtime) => {
      const pane = workspace?.panes.find((candidate) => candidate.id === runtime.id);
      const assignedChannelIds = [...(pane?.channelIds ?? [])];
      const renderableAssignedChannelIds = renderablePersistentChannelIds(assignedChannelIds)
        .filter((channelId) =>
          channelDefinitions.has(channelId) && !unavailableChannelIds.has(channelId)
        );
      const renderableSet = new Set(renderableAssignedChannelIds);
      return {
        id: runtime.id,
        visible: visiblePaneIds.has(runtime.id),
        assignedChannelIds,
        renderableAssignedChannelIds,
        unavailableAssignedChannelIds: assignedChannelIds.filter((channelId) => !renderableSet.has(channelId)),
        activeChannelIds: [...runtime.activeChannelIds],
      };
    });

    return {
      hasChannelDataSource: channelDataSource !== undefined,
      channelDefinitionCount: channelDefinitions.size,
      catalogChannelCount: catalogChannelDefinitions.size,
      unavailableChannelCount: unavailableChannelIds.size,
      aliasCount: channelIdAliases.size,
      activeWorkspaceId,
      workspaceCount: workspaces.length,
      restoringWorkspaceState,
      visiblePaneCount,
      assignedChannelCount: panes
        .filter((pane) => pane.visible)
        .reduce((sum, pane) => sum + pane.assignedChannelIds.length, 0),
      renderableAssignedChannelCount: panes
        .filter((pane) => pane.visible)
        .reduce((sum, pane) => sum + pane.renderableAssignedChannelIds.length, 0),
      unavailableAssignedChannelCount: panes
        .filter((pane) => pane.visible)
        .reduce((sum, pane) => sum + pane.unavailableAssignedChannelIds.length, 0),
      activeTraceCount: panes
        .filter((pane) => pane.visible)
        .reduce((sum, pane) => sum + pane.activeChannelIds.length, 0),
      panes,
    };
  };

  refreshWorkspaceSelector();
  graphSelector.setEnabled(false);
  renderGraphLayout();
  refreshViewHistoryState();

  return {
    element: page,
    graphSelector: graphSelector.element,
    headerTools,
    keyboardShortcutsControl: shortcutWrap,
    diagnosticsControl: diagnostics.element,
    setLog,
    setChannelCatalog,
    clearChannelCatalog,
    setImportError,
    setDiagnostics: (nextDiagnostics) => { diagnostics.setDiagnostics(nextDiagnostics); },
    refreshValidity: () => {
      paneRuntimes.forEach((runtime) => runtime.graph.refreshValidity());
      timeline.refreshValidity();
      timeline.refreshOverview();
    },
    setPlaybackSpeed: (speed) => { timeline.setPlaybackSpeed(speed); },
    setHighZoomSamplePointsVisible: (visible) => {
      paneRuntimes.forEach((runtime) => runtime.graph.setHighZoomSamplePointsVisible(visible));
    },
    setTimelineOverviewTracesVisible: (visible) => { timeline.setOverviewTracesVisible(visible); },
    onChannelPerformance: (listener) => { channelPerformanceListener = listener; },
    onWorkspaceRestorePerformance: (listener) => {
      workspaceRestorePerformanceListener = listener;
    },
    onWorkspaceMutation: (listener) => { workspaceMutationListener = listener; },
    getWorkspaceState,
    getRuntimeDiagnosticSnapshot,
    restoreWorkspaceState,
    restoreActiveWorkspace: async () => {
      const workspaceId = activeWorkspaceId;
      if (workspaceId) await restoreWorkspace(workspaceId, true);
    },
  };
}
