import type { LogSourceIdentity } from '../../../../core/log-model/log-types';
import {
  parseVersionedArtifact,
  serializeVersionedArtifact,
  type VersionedArtifactEnvelope,
} from '../../../../core/persistence/versioned-artifact';
import type {
  GraphWorkspaceSnapshot,
  InspectorWorkspaceState,
  LoggerWorkspaceState,
  TimelineWorkspaceState,
  WebSettingsState,
  WebWorkspaceState,
} from './workspace-state';

export const WEB_WORKSPACE_SCHEMA = 'epicscope.web-workspace';
export const WEB_WORKSPACE_VERSION = 1;
export const MAX_WEB_WORKSPACE_ARTIFACT_LENGTH = 2_000_000;

export interface PersistedWebWorkspacePayload {
  readonly sourceId: string;
  readonly sourceDisplayName: string;
  readonly workspace: WebWorkspaceState;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isStringArray = (value: unknown, maxLength: number): value is readonly string[] =>
  Array.isArray(value)
  && value.length <= maxLength
  && value.every((item) => typeof item === 'string' && item.length <= 512);

const isViewport = (value: unknown): boolean => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const viewport = value as Record<string, unknown>;
  return [
    viewport.fullStartMs,
    viewport.fullEndMs,
    viewport.visibleStartMs,
    viewport.visibleEndMs,
  ].every(isFiniteNumber);
};

const isGraphWorkspace = (value: unknown): value is GraphWorkspaceSnapshot => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const workspace = value as Record<string, unknown>;
  const validLayout = workspace.layout === undefined
    || workspace.layout === 'single'
    || workspace.layout === 'grid4'
    || workspace.layout === 'grid5'
    || workspace.layout === 'grid6'
    || workspace.layout === 'freeform';
  const validPanes = workspace.panes === undefined
    || (
      Array.isArray(workspace.panes)
      && workspace.panes.length >= 1
      && workspace.panes.length <= 6
      && workspace.panes.every((pane) => {
        if (!pane || typeof pane !== 'object' || Array.isArray(pane)) return false;
        const candidate = pane as Record<string, unknown>;
        return (
          typeof candidate.id === 'string'
          && candidate.id.length <= 128
          && isStringArray(candidate.channelIds, 8)
        );
      })
    );
  const validGeometry = workspace.paneGeometry === undefined
    || (
      !!workspace.paneGeometry
      && typeof workspace.paneGeometry === 'object'
      && !Array.isArray(workspace.paneGeometry)
      && Object.keys(workspace.paneGeometry as Record<string, unknown>).length <= 6
      && Object.entries(workspace.paneGeometry as Record<string, unknown>).every(([key, geometry]) => {
        if (key.length > 128 || !geometry || typeof geometry !== 'object' || Array.isArray(geometry)) return false;
        const candidate = geometry as Record<string, unknown>;
        return [candidate.x, candidate.y, candidate.width, candidate.height].every(isFiniteNumber)
          && (candidate.x as number) >= 0
          && (candidate.y as number) >= 0
          && (candidate.width as number) > 0
          && (candidate.height as number) > 0
          && (candidate.x as number) <= 1
          && (candidate.y as number) <= 1
          && (candidate.width as number) <= 1
          && (candidate.height as number) <= 1;
      })
    );
  const validMinimized = workspace.minimizedPaneIds === undefined
    || isStringArray(workspace.minimizedPaneIds, 6);
  const validMaximized = workspace.maximizedPaneId === undefined
    || (typeof workspace.maximizedPaneId === 'string' && workspace.maximizedPaneId.length <= 128);
  const validArrange = workspace.freeformArrange === undefined
    || workspace.freeformArrange === 'mosaic'
    || workspace.freeformArrange === 'columns'
    || workspace.freeformArrange === 'rows'
    || workspace.freeformArrange === 'cascade';

  return (
    typeof workspace.id === 'string'
    && workspace.id.length <= 128
    && typeof workspace.name === 'string'
    && workspace.name.length <= 256
    && isStringArray(workspace.channelIds, 8)
    && validLayout
    && (
      workspace.activePaneId === undefined
      || (typeof workspace.activePaneId === 'string' && workspace.activePaneId.length <= 128)
    )
    && validPanes
    && validGeometry
    && validMinimized
    && validMaximized
    && validArrange
    && (workspace.viewport === undefined || isViewport(workspace.viewport))
    && isFiniteNumber(workspace.cursorTimeMs)
    && Array.isArray(workspace.viewHistory)
    && workspace.viewHistory.length <= 40
    && workspace.viewHistory.every(isViewport)
    && Number.isInteger(workspace.viewHistoryIndex)
    && (
      workspace.viewHistory.length === 0
        ? workspace.viewHistoryIndex === -1
        : (workspace.viewHistoryIndex as number) >= 0
          && (workspace.viewHistoryIndex as number) < workspace.viewHistory.length
    )
  );
};

const isTimelineState = (value: unknown): value is TimelineWorkspaceState => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  return (
    typeof state.expanded === 'boolean'
    && Array.isArray(state.userMarkers)
    && state.userMarkers.length <= 5_000
    && state.userMarkers.every((marker) => {
      if (!marker || typeof marker !== 'object' || Array.isArray(marker)) return false;
      const candidate = marker as Record<string, unknown>;
      return isFiniteNumber(candidate.timeMs)
        && typeof candidate.label === 'string'
        && candidate.label.length <= 512;
    })
    && (state.aTimeMs === undefined || isFiniteNumber(state.aTimeMs))
    && (state.bTimeMs === undefined || isFiniteNumber(state.bTimeMs))
    && Array.isArray(state.savedRanges)
    && state.savedRanges.length <= 1_000
    && state.savedRanges.every((range) => {
      if (!range || typeof range !== 'object' || Array.isArray(range)) return false;
      const candidate = range as Record<string, unknown>;
      return typeof candidate.label === 'string'
        && candidate.label.length <= 512
        && isFiniteNumber(candidate.startMs)
        && isFiniteNumber(candidate.endMs);
    })
  );
};

const isInspectorState = (value: unknown): value is InspectorWorkspaceState => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  return (
    typeof state.visible === 'boolean'
    && isStringArray(state.favoriteChannelIds, 10_000)
    && isStringArray(state.recentChannelIds, 32)
    && typeof state.searchQuery === 'string'
    && state.searchQuery.length <= 1_024
    && typeof state.selectedGroup === 'string'
    && state.selectedGroup.length <= 512
    && typeof state.visibilityFilter === 'string'
    && state.visibilityFilter.length <= 64
    && (state.sortKey === 'name' || state.sortKey === 'group' || state.sortKey === 'value')
    && typeof state.sortAscending === 'boolean'
  );
};

const isLoggerState = (value: unknown): value is LoggerWorkspaceState => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  return (
    typeof state.activeWorkspaceId === 'string'
    && state.activeWorkspaceId.length <= 128
    && Array.isArray(state.workspaces)
    && state.workspaces.length >= 1
    && state.workspaces.length <= 64
    && state.workspaces.every(isGraphWorkspace)
    && isTimelineState(state.timeline)
    && isInspectorState(state.inspector)
  );
};

const isSettingsState = (value: unknown): value is WebSettingsState => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  return (
    isFiniteNumber(state.playbackSpeed)
    && (state.playbackSpeed as number) >= 0.1
    && (state.playbackSpeed as number) <= 8
    && typeof state.highZoomSamplePointsVisible === 'boolean'
    && typeof state.timelineOverviewTracesVisible === 'boolean'
    && typeof state.performanceDiagnosticsVisible === 'boolean'
  );
};

export const isWebWorkspaceState = (value: unknown): value is WebWorkspaceState => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  return isLoggerState(state.logger) && isSettingsState(state.settings);
};

const isPersistedPayload = (value: unknown): value is PersistedWebWorkspacePayload => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.sourceId === 'string'
    && payload.sourceId.length <= 1_024
    && typeof payload.sourceDisplayName === 'string'
    && payload.sourceDisplayName.length <= 1_024
    && isWebWorkspaceState(payload.workspace)
  );
};

export function serializeWebWorkspace(
  source: LogSourceIdentity,
  workspace: WebWorkspaceState,
): string {
  return serializeVersionedArtifact(
    WEB_WORKSPACE_SCHEMA,
    WEB_WORKSPACE_VERSION,
    {
      sourceId: source.id,
      sourceDisplayName: source.displayName,
      workspace,
    } satisfies PersistedWebWorkspacePayload,
  );
}

export function parseWebWorkspace(
  serialized: string,
): VersionedArtifactEnvelope<PersistedWebWorkspacePayload> {
  return parseVersionedArtifact(serialized, {
    schema: WEB_WORKSPACE_SCHEMA,
    version: WEB_WORKSPACE_VERSION,
    validatePayload: isPersistedPayload,
    maxSerializedLength: MAX_WEB_WORKSPACE_ARTIFACT_LENGTH,
  });
}
