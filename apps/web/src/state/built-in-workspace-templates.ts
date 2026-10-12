import type { ChannelDefinition } from '../../../../core/log-model/log-types';
import type { GraphWorkspaceLayout } from './workspace-state';
import {
  resolveSemanticChannelRole,
  semanticChannelRole,
  type SemanticChannelResolution,
  type SemanticChannelResolveOptions,
  type SemanticChannelRoleId,
} from './semantic-channel-roles';

export type WorkspaceRoleRequirement = 'required' | 'preferred' | 'optional';

export interface BuiltInWorkspaceRoleSlot {
  readonly roleId: SemanticChannelRoleId;
  readonly requirement: WorkspaceRoleRequirement;
}

export interface BuiltInWorkspacePaneTemplate {
  readonly id: string;
  readonly roles: readonly BuiltInWorkspaceRoleSlot[];
}

export interface BuiltInWorkspaceTemplate {
  readonly id: string;
  readonly name: string;
  readonly layout: GraphWorkspaceLayout;
  readonly panes: readonly BuiltInWorkspacePaneTemplate[];
  /** Development fixtures are not intended to become permanent user-facing presets. */
  readonly developmentOnly?: boolean;
}

export interface ResolvedWorkspaceRoleSlot extends BuiltInWorkspaceRoleSlot {
  readonly displayName: string;
  readonly resolution: SemanticChannelResolution;
}

export interface ResolvedWorkspacePane {
  readonly id: string;
  readonly roles: readonly ResolvedWorkspaceRoleSlot[];
  readonly channelIds: readonly string[];
}

export interface ResolvedBuiltInWorkspace {
  readonly template: BuiltInWorkspaceTemplate;
  readonly panes: readonly ResolvedWorkspacePane[];
  readonly unresolvedRequiredRoleIds: readonly SemanticChannelRoleId[];
  readonly unresolvedPreferredRoleIds: readonly SemanticChannelRoleId[];
  readonly unresolvedOptionalRoleIds: readonly SemanticChannelRoleId[];
}

/**
 * First implementation fixture for the pre-populated workspace system.
 *
 * It intentionally exercises one required, two preferred and one optional role while keeping
 * geometry trivial. Once the semantic resolver and source transitions are proven in the real UI,
 * this fixture can be hidden/removed and the agreed production workspace catalog can use the same
 * template model.
 */
export const SINGLE_RESOLVER_TEST_WORKSPACE: BuiltInWorkspaceTemplate = Object.freeze({
  id: 'single-resolver-test',
  name: 'Single · Resolver Test',
  layout: 'single',
  developmentOnly: true,
  panes: [{
    id: 'pane-1',
    roles: [
      { roleId: 'engine.rpm', requirement: 'required' },
      { roleId: 'engine.map', requirement: 'preferred' },
      { roleId: 'engine.throttle.position', requirement: 'preferred' },
      { roleId: 'temperature.coolant', requirement: 'optional' },
    ],
  }],
});

export function resolveBuiltInWorkspaceTemplate(
  template: BuiltInWorkspaceTemplate,
  channels: readonly ChannelDefinition[],
  options: SemanticChannelResolveOptions = {},
): ResolvedBuiltInWorkspace {
  const unresolvedRequiredRoleIds: SemanticChannelRoleId[] = [];
  const unresolvedPreferredRoleIds: SemanticChannelRoleId[] = [];
  const unresolvedOptionalRoleIds: SemanticChannelRoleId[] = [];

  const panes = template.panes.map((pane) => {
    const roles = pane.roles.map((slot): ResolvedWorkspaceRoleSlot => {
      const resolution = resolveSemanticChannelRole(slot.roleId, channels, options);
      if (!resolution.channel) {
        if (slot.requirement === 'required') unresolvedRequiredRoleIds.push(slot.roleId);
        else if (slot.requirement === 'preferred') unresolvedPreferredRoleIds.push(slot.roleId);
        else unresolvedOptionalRoleIds.push(slot.roleId);
      }
      return {
        ...slot,
        displayName: semanticChannelRole(slot.roleId).displayName,
        resolution,
      };
    });

    return {
      id: pane.id,
      roles,
      channelIds: roles.flatMap((slot) => slot.resolution.channel ? [slot.resolution.channel.id] : []),
    };
  });

  return {
    template,
    panes,
    unresolvedRequiredRoleIds,
    unresolvedPreferredRoleIds,
    unresolvedOptionalRoleIds,
  };
}
