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
