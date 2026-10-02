import type { LogMarker } from '../../../../core/log-model/log-types';
import type { TimelineViewport } from '../../../../core/timeline/viewport-state';

export interface SavedTimelineRangeState {
  readonly label: string;
  readonly startMs: number;
  readonly endMs: number;
}

export interface TimelineWorkspaceState {
  readonly expanded: boolean;
  readonly userMarkers: readonly LogMarker[];
  readonly aTimeMs: number | undefined;
  readonly bTimeMs: number | undefined;
  readonly savedRanges: readonly SavedTimelineRangeState[];
}

export interface InspectorWorkspaceState {
  readonly visible: boolean;
  readonly favoriteChannelIds: readonly string[];
  readonly recentChannelIds: readonly string[];
  readonly searchQuery: string;
  readonly selectedGroup: string;
  readonly visibilityFilter: string;
  readonly sortKey: 'name' | 'group' | 'value';
  readonly sortAscending: boolean;
}

export type GraphWorkspaceLayout = 'single' | 'grid4' | 'grid5' | 'grid6' | 'freeform';

export interface GraphPaneGeometry {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface GraphPaneSnapshot {
  readonly id: string;
  readonly channelIds: readonly string[];
}

export interface GraphWorkspaceSnapshot {
  readonly id: string;
  readonly name: string;
  /** Legacy/single-pane compatibility. Mirrors the active pane channel list. */
  readonly channelIds: readonly string[];
  readonly layout?: GraphWorkspaceLayout;
  readonly activePaneId?: string;
  readonly panes?: readonly GraphPaneSnapshot[];
  readonly paneGeometry?: Readonly<Record<string, GraphPaneGeometry>>;
  readonly minimizedPaneIds?: readonly string[];
  readonly maximizedPaneId?: string;
  readonly freeformArrange?: 'mosaic' | 'columns' | 'rows' | 'cascade';
  readonly viewport: TimelineViewport | undefined;
  readonly cursorTimeMs: number;
  readonly viewHistory: readonly TimelineViewport[];
  readonly viewHistoryIndex: number;
}

export interface LoggerWorkspaceState {
  readonly activeWorkspaceId: string;
  readonly workspaces: readonly GraphWorkspaceSnapshot[];
  readonly timeline: TimelineWorkspaceState;
  readonly inspector: InspectorWorkspaceState;
}

export interface WebSettingsState {
  readonly playbackSpeed: number;
  readonly highZoomSamplePointsVisible: boolean;
  readonly timelineOverviewTracesVisible: boolean;
  readonly performanceDiagnosticsVisible: boolean;
}

export interface WebWorkspaceState {
  readonly logger: LoggerWorkspaceState;
  readonly settings: WebSettingsState;
}

export interface WorkspaceHistory<T> {
  reset(state: T): void;
  push(state: T): void;
  undo(): T | undefined;
  redo(): T | undefined;
  current(): T | undefined;
  canUndo(): boolean;
  canRedo(): boolean;
}

export function createWorkspaceHistory<T>(
  clone: (state: T) => T,
  equals: (left: T, right: T) => boolean,
  limit = 80,
): WorkspaceHistory<T> {
  let entries: T[] = [];
  let index = -1;

  const reset = (state: T): void => {
    entries = [clone(state)];
    index = 0;
  };

  const push = (state: T): void => {
    const current = entries[index];
    if (current !== undefined && equals(current, state)) return;
    entries = entries.slice(0, index + 1);
    entries.push(clone(state));
    if (entries.length > limit) entries.shift();
    index = entries.length - 1;
  };

  const undo = (): T | undefined => {
    if (index <= 0) return undefined;
    index -= 1;
    const state = entries[index];
    return state === undefined ? undefined : clone(state);
  };

  const redo = (): T | undefined => {
    if (index < 0 || index >= entries.length - 1) return undefined;
    index += 1;
    const state = entries[index];
    return state === undefined ? undefined : clone(state);
  };

  return {
    reset,
    push,
    undo,
    redo,
    current: () => {
      const state = entries[index];
      return state === undefined ? undefined : clone(state);
    },
    canUndo: () => index > 0,
    canRedo: () => index >= 0 && index < entries.length - 1,
  };
}
