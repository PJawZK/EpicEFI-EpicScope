import type { ChannelDefinition } from '../../../../core/log-model/log-types';
import type { GraphWorkspaceSnapshot } from './workspace-state';
import {
  resolveStarterWorkspaceTemplate,
  type ResolvedStarterWorkspace,
  type StarterWorkspaceTemplate,
} from './built-in-workspace-templates';
import type { SemanticChannelResolveOptions } from './semantic-channel-roles';

/**
 * Historical prefix used by the first protected pre-populated-workspace implementation.
 * Persisted IDs carrying this prefix are compatibility data only and no longer imply protection.
 */
export const LEGACY_BUILT_IN_WORKSPACE_ID_PREFIX = 'built-in:';

export function legacyBuiltInWorkspaceRuntimeId(template: StarterWorkspaceTemplate): string {
  return `${LEGACY_BUILT_IN_WORKSPACE_ID_PREFIX}${template.id}`;
}

export interface MaterializedStarterWorkspace {
  readonly workspace: GraphWorkspaceSnapshot;
  readonly resolution: ResolvedStarterWorkspace;
}

function materializedPaneSnapshots(resolution: ResolvedStarterWorkspace) {
  return resolution.panes.map((pane) => ({
    id: pane.id,
    channelIds: [...pane.channelIds],
  }));
}

/**
 * Resolves a starter template once and returns a normal editable workspace snapshot.
 *
 * The caller owns the workspace identity. No reserved prefix is added and this function does not
 * update, refresh or otherwise retain ownership of an existing workspace after materialization.
 */
export function materializeStarterWorkspace(
  template: StarterWorkspaceTemplate,
  channels: readonly ChannelDefinition[],
  workspaceId: string,
  options: SemanticChannelResolveOptions = {},
  seed?: Partial<GraphWorkspaceSnapshot>,
): MaterializedStarterWorkspace {
  const resolution = resolveStarterWorkspaceTemplate(template, channels, options);
  const panes = materializedPaneSnapshots(resolution);
  const requestedActivePaneId = seed?.activePaneId;
  const activePaneId = requestedActivePaneId && panes.some((pane) => pane.id === requestedActivePaneId)
    ? requestedActivePaneId
    : (panes[0]?.id ?? 'pane-1');
  const activePane = panes.find((pane) => pane.id === activePaneId) ?? panes[0];

  return {
    resolution,
    workspace: {
      id: workspaceId,
      name: seed?.name ?? template.name,
      channelIds: [...(activePane?.channelIds ?? [])],
      layout: template.layout,
      activePaneId,
      panes,
      viewport: seed?.viewport,
      cursorTimeMs: seed?.cursorTimeMs ?? 0,
      viewHistory: seed?.viewHistory ?? [],
      viewHistoryIndex: seed?.viewHistoryIndex ?? -1,
      ...(seed?.paneGeometry ? { paneGeometry: seed.paneGeometry } : {}),
      ...(seed?.minimizedPaneIds ? { minimizedPaneIds: seed.minimizedPaneIds } : {}),
      ...(seed?.maximizedPaneId !== undefined ? { maximizedPaneId: seed.maximizedPaneId } : {}),
      ...(seed?.freeformArrange ? { freeformArrange: seed.freeformArrange } : {}),
    },
  };
}

/** Compatibility aliases for callers/tests during the lifecycle migration. */
export const BUILT_IN_WORKSPACE_ID_PREFIX = LEGACY_BUILT_IN_WORKSPACE_ID_PREFIX;
export const builtInWorkspaceRuntimeId = legacyBuiltInWorkspaceRuntimeId;
