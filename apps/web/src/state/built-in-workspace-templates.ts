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
  readonly description?: string;
  readonly developmentOnly?: boolean;
}

export type StarterWorkspaceRoleSlot = BuiltInWorkspaceRoleSlot;
export type StarterWorkspacePaneTemplate = BuiltInWorkspacePaneTemplate;
export type StarterWorkspaceTemplate = BuiltInWorkspaceTemplate;

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

export type ResolvedStarterWorkspace = ResolvedBuiltInWorkspace;

/**
 * First production starter template. The legacy template id is retained only as internal
 * compatibility data for already-persisted validation state. Applying this template creates an
 * ordinary user-owned workspace; the template does not own or refresh that workspace afterward.
 */
export const GENERAL_SINGLE_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'single-resolver-test',
  name: 'General',
  description: 'Single-pane engine overview.',
  layout: 'single',
  panes: [{
    id: 'pane-1',
    roles: [
      { roleId: 'engine.rpm', requirement: 'required' },
      { roleId: 'engine.map', requirement: 'required' },
      { roleId: 'engine.throttle.position', requirement: 'preferred' },
      { roleId: 'temperature.coolant', requirement: 'preferred' },
      { roleId: 'temperature.intakeAir', requirement: 'optional' },
      { roleId: 'electrical.batteryVoltage', requirement: 'optional' },
      { roleId: 'fuel.lambda', requirement: 'optional' },
      { roleId: 'ignition.advance', requirement: 'optional' },
    ],
  }],
};

/**
 * First multi-pane starter. It deliberately uses generic idle-control semantics so the workspace
 * remains portable across DC valve, IAC and ETB implementations. ECU-specific controller detail
 * belongs in the Idle analyzer rather than in this starter definition.
 */
export const IDLE_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'idle-dual',
  name: 'Idle',
  description: 'Dual-pane idle speed and actuator overview.',
  layout: 'dual',
  panes: [
    {
      id: 'pane-1',
      roles: [
        { roleId: 'engine.rpm', requirement: 'required' },
        { roleId: 'idle.target', requirement: 'required' },
        { roleId: 'engine.map', requirement: 'preferred' },
        { roleId: 'engine.throttle.position', requirement: 'preferred' },
      ],
    },
    {
      id: 'pane-2',
      roles: [
        { roleId: 'idle.airCommand', requirement: 'preferred' },
        { roleId: 'ignition.advance', requirement: 'preferred' },
        { roleId: 'temperature.coolant', requirement: 'preferred' },
        { roleId: 'fuel.lambda', requirement: 'optional' },
      ],
    },
  ],
};

export const BOOST_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'boost-dual',
  name: 'Boost',
  description: 'Dual-pane boost response and control overview.',
  layout: 'dual',
  panes: [
    {
      id: 'pane-1',
      roles: [
        { roleId: 'engine.rpm', requirement: 'required' },
        { roleId: 'engine.map', requirement: 'required' },
        { roleId: 'engine.throttle.position', requirement: 'preferred' },
        { roleId: 'boost.target', requirement: 'optional' },
      ],
    },
    {
      id: 'pane-2',
      roles: [
        { roleId: 'boost.wastegateCommand', requirement: 'preferred' },
        { roleId: 'boost.error', requirement: 'optional' },
        { roleId: 'temperature.intakeAir', requirement: 'optional' },
        { roleId: 'exhaust.emap', requirement: 'optional' },
      ],
    },
  ],
};

export const FUEL_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'fuel-dual',
  name: 'Fuel',
  description: 'Dual-pane mixture and injector overview.',
  layout: 'dual',
  panes: [
    {
      id: 'pane-1',
      roles: [
        { roleId: 'engine.rpm', requirement: 'required' },
        { roleId: 'engine.map', requirement: 'required' },
        { roleId: 'fuel.lambda', requirement: 'preferred' },
        { roleId: 'fuel.lambdaTarget', requirement: 'preferred' },
      ],
    },
    {
      id: 'pane-2',
      roles: [
        { roleId: 'fuel.injectorPulseWidth', requirement: 'preferred' },
        { roleId: 'fuel.injectorDuty', requirement: 'preferred' },
        { roleId: 'fuel.pressure', requirement: 'optional' },
        { roleId: 'fuel.totalCorrection', requirement: 'optional' },
      ],
    },
  ],
};

export const IGNITION_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'ignition-dual',
  name: 'Ignition',
  description: 'Dual-pane spark timing and knock overview.',
  layout: 'dual',
  panes: [
    {
      id: 'pane-1',
      roles: [
        { roleId: 'engine.rpm', requirement: 'required' },
        { roleId: 'engine.map', requirement: 'required' },
        { roleId: 'ignition.advance', requirement: 'preferred' },
        { roleId: 'ignition.knockRetard', requirement: 'optional' },
      ],
    },
    {
      id: 'pane-2',
      roles: [
        { roleId: 'ignition.dwell', requirement: 'preferred' },
        { roleId: 'ignition.knockLevel', requirement: 'optional' },
        { roleId: 'fuel.lambda', requirement: 'optional' },
        { roleId: 'temperature.intakeAir', requirement: 'optional' },
      ],
    },
  ],
};

export const COOLING_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'cooling-dual',
  name: 'Cooling',
  description: 'Dual-pane thermal state and cooling-system overview.',
  layout: 'dual',
  panes: [
    {
      id: 'pane-1',
      roles: [
        { roleId: 'temperature.coolant', requirement: 'required' },
        { roleId: 'temperature.intakeAir', requirement: 'preferred' },
        { roleId: 'engine.rpm', requirement: 'preferred' },
        { roleId: 'vehicle.speed', requirement: 'optional' },
      ],
    },
    {
      id: 'pane-2',
      roles: [
        { roleId: 'cooling.fanCommand', requirement: 'optional' },
        { roleId: 'temperature.oil', requirement: 'optional' },
        { roleId: 'engine.oilPressure', requirement: 'optional' },
        { roleId: 'electrical.batteryVoltage', requirement: 'optional' },
      ],
    },
  ],
};

export const STARTER_WORKSPACE_TEMPLATES: readonly StarterWorkspaceTemplate[] = Object.freeze([
  GENERAL_SINGLE_WORKSPACE,
  IDLE_DUAL_WORKSPACE,
  BOOST_DUAL_WORKSPACE,
  FUEL_DUAL_WORKSPACE,
  IGNITION_DUAL_WORKSPACE,
  COOLING_DUAL_WORKSPACE,
]);

export function starterWorkspaceTemplate(id: string): StarterWorkspaceTemplate | undefined {
  return STARTER_WORKSPACE_TEMPLATES.find((template) => template.id === id);
}

/** Compatibility export while Logger/tests still refer to the validation-era symbol name. */
export const SINGLE_RESOLVER_TEST_WORKSPACE = GENERAL_SINGLE_WORKSPACE;

export function resolveStarterWorkspaceTemplate(
  template: StarterWorkspaceTemplate,
  channels: readonly ChannelDefinition[],
  options: SemanticChannelResolveOptions = {},
): ResolvedStarterWorkspace {
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

/** Compatibility alias; new code should use starter-template terminology. */
export const resolveBuiltInWorkspaceTemplate = resolveStarterWorkspaceTemplate;
