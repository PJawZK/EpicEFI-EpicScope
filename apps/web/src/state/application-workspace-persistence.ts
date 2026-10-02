import {
  parseVersionedArtifact,
  serializeVersionedArtifact,
  type VersionedArtifactEnvelope,
} from '../../../../core/persistence/versioned-artifact';
import {
  isWebWorkspaceState,
} from './workspace-persistence';
import type { WebWorkspaceState } from './workspace-state';

export const WEB_APPLICATION_WORKSPACE_SCHEMA = 'epicscope.web-application-workspace';
export const WEB_APPLICATION_WORKSPACE_VERSION = 1;
export const MAX_WEB_APPLICATION_WORKSPACE_ARTIFACT_LENGTH = 2_000_000;

export interface PersistedWebApplicationWorkspacePayload {
  readonly workspace: WebWorkspaceState;
}

export function toApplicationWorkspaceState(
  workspace: WebWorkspaceState,
): WebWorkspaceState {
  return {
    logger: {
      activeWorkspaceId: workspace.logger.activeWorkspaceId,
      workspaces: workspace.logger.workspaces.map((item) => ({
        ...item,
        viewport: undefined,
        cursorTimeMs: 0,
        viewHistory: [],
        viewHistoryIndex: -1,
      })),
      timeline: {
        expanded: workspace.logger.timeline.expanded,
        userMarkers: [],
        aTimeMs: undefined,
        bTimeMs: undefined,
        savedRanges: [],
      },
      inspector: {
        ...workspace.logger.inspector,
        recentChannelIds: [],
      },
    },
    settings: { ...workspace.settings },
  };
}


export function migrateReusableChannelAssignmentsFromLog(
  applicationWorkspace: WebWorkspaceState,
  logWorkspace: WebWorkspaceState,
  sourceToLogicalChannelId: ReadonlyMap<string, string>,
): WebWorkspaceState {
  const logWorkspacesById = new Map(
    logWorkspace.logger.workspaces.map((workspace) => [workspace.id, workspace] as const),
  );

  return {
    ...applicationWorkspace,
    logger: {
      ...applicationWorkspace.logger,
      workspaces: applicationWorkspace.logger.workspaces.map((workspace) => {
        const logSpecific = logWorkspacesById.get(workspace.id);
        if (!logSpecific || !workspace.panes) return workspace;

        const migratedPanes = workspace.panes.map((pane) => {
          if (pane.channelIds.length > 0) return pane;
          const sourcePane = logSpecific.panes?.find((candidate) => candidate.id === pane.id);
          const sourceIds = sourcePane?.channelIds
            ?? (pane.id === logSpecific.activePaneId ? logSpecific.channelIds : []);
          const migrated = sourceIds
            .map((channelId) => sourceToLogicalChannelId.get(channelId) ?? channelId)
            .filter((channelId) => channelId.startsWith('ini:'))
            .filter((channelId, index, values) => values.indexOf(channelId) === index)
            .slice(0, 8);
          return migrated.length > 0
            ? { ...pane, channelIds: migrated }
            : pane;
        });

        const activePane = migratedPanes.find(
          (pane) => pane.id === workspace.activePaneId,
        ) ?? migratedPanes[0];

        return {
          ...workspace,
          panes: migratedPanes,
          channelIds: [...(activePane?.channelIds ?? workspace.channelIds)],
        };
      }),
    },
  };
}

export function mergeLogSpecificWorkspaceState(
  applicationWorkspace: WebWorkspaceState,
  logWorkspace: WebWorkspaceState,
): WebWorkspaceState {
  const logWorkspacesById = new Map(
    logWorkspace.logger.workspaces.map((workspace) => [workspace.id, workspace] as const),
  );

  return {
    logger: {
      activeWorkspaceId: applicationWorkspace.logger.activeWorkspaceId,
      workspaces: applicationWorkspace.logger.workspaces.map((workspace) => {
        const logSpecific = logWorkspacesById.get(workspace.id);
        return {
          ...workspace,
          viewport: logSpecific?.viewport
            ? { ...logSpecific.viewport }
            : workspace.viewport
              ? { ...workspace.viewport }
              : undefined,
          cursorTimeMs: logSpecific?.cursorTimeMs ?? workspace.cursorTimeMs,
          viewHistory: logSpecific
            ? logSpecific.viewHistory.map((item) => ({ ...item }))
            : workspace.viewHistory.map((item) => ({ ...item })),
          viewHistoryIndex: logSpecific?.viewHistoryIndex ?? workspace.viewHistoryIndex,
        };
      }),
      timeline: {
        expanded: applicationWorkspace.logger.timeline.expanded,
        userMarkers: logWorkspace.logger.timeline.userMarkers.map((marker) => ({ ...marker })),
        aTimeMs: logWorkspace.logger.timeline.aTimeMs,
        bTimeMs: logWorkspace.logger.timeline.bTimeMs,
        savedRanges: logWorkspace.logger.timeline.savedRanges.map((range) => ({ ...range })),
      },
      inspector: {
        ...applicationWorkspace.logger.inspector,
        favoriteChannelIds: [...applicationWorkspace.logger.inspector.favoriteChannelIds],
        recentChannelIds: [...applicationWorkspace.logger.inspector.recentChannelIds],
      },
    },
    settings: { ...applicationWorkspace.settings },
  };
}

export function serializeWebApplicationWorkspace(
  workspace: WebWorkspaceState,
): string {
  return serializeVersionedArtifact(
    WEB_APPLICATION_WORKSPACE_SCHEMA,
    WEB_APPLICATION_WORKSPACE_VERSION,
    {
      workspace: toApplicationWorkspaceState(workspace),
    } satisfies PersistedWebApplicationWorkspacePayload,
  );
}

export function parseWebApplicationWorkspace(
  serialized: string,
): VersionedArtifactEnvelope<PersistedWebApplicationWorkspacePayload> {
  return parseVersionedArtifact(serialized, {
    schema: WEB_APPLICATION_WORKSPACE_SCHEMA,
    version: WEB_APPLICATION_WORKSPACE_VERSION,
    validatePayload: (value): value is PersistedWebApplicationWorkspacePayload => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
      const payload = value as Record<string, unknown>;
      return isWebWorkspaceState(payload.workspace);
    },
    maxSerializedLength: MAX_WEB_APPLICATION_WORKSPACE_ARTIFACT_LENGTH,
  });
}
