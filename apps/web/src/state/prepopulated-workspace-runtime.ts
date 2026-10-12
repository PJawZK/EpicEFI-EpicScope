import type { ChannelDefinition } from '../../../../core/log-model/log-types';
import type {
  GraphWorkspaceSnapshot,
  LoggerWorkspaceState,
} from './workspace-state';
import {
  resolveBuiltInWorkspaceTemplate,
  type BuiltInWorkspaceTemplate,
  type ResolvedBuiltInWorkspace,
} from './built-in-workspace-templates';
import type { SemanticChannelResolveOptions } from './semantic-channel-roles';

export const BUILT_IN_WORKSPACE_ID_PREFIX = 'built-in:';

export interface MaterializedBuiltInWorkspace {
  readonly workspace: GraphWorkspaceSnapshot;
  readonly resolution: ResolvedBuiltInWorkspace;
}

export interface UpsertBuiltInWorkspaceOptions extends SemanticChannelResolveOptions {
  readonly activate?: boolean;
}

export interface UpsertBuiltInWorkspaceResult {
  readonly state: LoggerWorkspaceState;
  readonly materialized: MaterializedBuiltInWorkspace;
  readonly inserted: boolean;
}

export function builtInWorkspaceRuntimeId(template: BuiltInWorkspaceTemplate): string {
  return `${BUILT_IN_WORKSPACE_ID_PREFIX}${template.id}`;
}

function materializedPaneSnapshots(resolution: ResolvedBuiltInWorkspace) {
  return resolution.panes.map((pane) => ({
    id: pane.id,
    channelIds: [...pane.channelIds],
  }));
}

export function materializeBuiltInWorkspace(
  template: BuiltInWorkspaceTemplate,
  channels: readonly ChannelDefinition[],
  options: SemanticChannelResolveOptions = {},
  previous?: GraphWorkspaceSnapshot,
): MaterializedBuiltInWorkspace {
  const resolution = resolveBuiltInWorkspaceTemplate(template, channels, options);
  const panes = materializedPaneSnapshots(resolution);
  const activePaneId = previous?.activePaneId && panes.some((pane) => pane.id === previous.activePaneId)
    ? previous.activePaneId
    : (panes[0]?.id ?? 'pane-1');
  const activePane = panes.find((pane) => pane.id === activePaneId) ?? panes[0];

  return {
    resolution,
    workspace: {
      id: builtInWorkspaceRuntimeId(template),
      name: template.name,
      channelIds: [...(activePane?.channelIds ?? [])],
      layout: template.layout,
      activePaneId,
      panes,
      paneGeometry: previous?.paneGeometry,
      minimizedPaneIds: previous?.minimizedPaneIds,
      maximizedPaneId: previous?.maximizedPaneId,
      freeformArrange: previous?.freeformArrange,
      viewport: previous?.viewport,
      cursorTimeMs: previous?.cursorTimeMs ?? 0,
      viewHistory: previous?.viewHistory ?? [],
      viewHistoryIndex: previous?.viewHistoryIndex ?? -1,
    },
  };
}

/**
 * Inserts or refreshes a built-in workspace using only its reserved runtime ID.
 *
 * User workspaces are never matched by name, so a user-created workspace called
 * "Single · Resolver Test" remains independent from the development fixture.
 */
export function upsertBuiltInWorkspace(
  state: LoggerWorkspaceState,
  template: BuiltInWorkspaceTemplate,
  channels: readonly ChannelDefinition[],
  options: UpsertBuiltInWorkspaceOptions = {},
): UpsertBuiltInWorkspaceResult {
  const runtimeId = builtInWorkspaceRuntimeId(template);
  const existingIndex = state.workspaces.findIndex((workspace) => workspace.id === runtimeId);
  const previous = existingIndex >= 0 ? state.workspaces[existingIndex] : undefined;
  const materialized = materializeBuiltInWorkspace(template, channels, options, previous);

  const workspaces = [...state.workspaces];
  if (existingIndex >= 0) workspaces[existingIndex] = materialized.workspace;
  else workspaces.push(materialized.workspace);

  const activeWorkspaceId = options.activate
    ? runtimeId
    : (state.activeWorkspaceId === runtimeId ? runtimeId : state.activeWorkspaceId);

  return {
    state: {
      ...state,
      activeWorkspaceId,
      workspaces,
    },
    materialized,
    inserted: existingIndex < 0,
  };
}
