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

export interface StarterWorkspaceAvailability {
  /** Every listed semantic capability must resolve before this starter is offered. */
  readonly allOfRoleIds: readonly SemanticChannelRoleId[];
}

export interface BuiltInWorkspaceTemplate {
  readonly id: string;
  readonly name: string;
  readonly layout: GraphWorkspaceLayout;
  readonly panes: readonly BuiltInWorkspacePaneTemplate[];
  readonly description?: string;
  readonly tier?: 'generic' | 'epicefi';
  readonly availability?: StarterWorkspaceAvailability;
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

export const TRANSIENT_AE_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'transient-ae-dual',
  name: 'Transient / AE',
  description: 'Dual-pane throttle transient, MAP response and enrichment overview.',
  layout: 'dual',
  panes: [
    {
      id: 'pane-1',
      roles: [
        { roleId: 'engine.rpm', requirement: 'required' },
        { roleId: 'engine.throttle.position', requirement: 'required' },
        { roleId: 'transient.tpsDelta', requirement: 'preferred' },
        { roleId: 'engine.map', requirement: 'preferred' },
      ],
    },
    {
      id: 'pane-2',
      roles: [
        { roleId: 'transient.effectiveMap', requirement: 'preferred' },
        { roleId: 'fuel.lambda', requirement: 'preferred' },
        { roleId: 'fuel.injectorPulseWidth', requirement: 'preferred' },
        { roleId: 'transient.aeFuel', requirement: 'optional' },
        { roleId: 'transient.wallFuelCorrection', requirement: 'optional' },
      ],
    },
  ],
};

export const FUEL_SYSTEM_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'fuel-system-dual',
  name: 'Fuel System',
  description: 'Dual-pane fuel delivery, injector loading and pump-state overview.',
  layout: 'dual',
  panes: [
    {
      id: 'pane-1',
      roles: [
        { roleId: 'engine.rpm', requirement: 'required' },
        { roleId: 'fuel.pressure', requirement: 'required' },
        { roleId: 'engine.map', requirement: 'preferred' },
        { roleId: 'engine.throttle.position', requirement: 'preferred' },
      ],
    },
    {
      id: 'pane-2',
      roles: [
        { roleId: 'fuel.pressureDelta', requirement: 'preferred' },
        { roleId: 'fuel.injectorPulseWidth', requirement: 'preferred' },
        { roleId: 'fuel.injectorDuty', requirement: 'optional' },
        { roleId: 'fuel.pumpCommand', requirement: 'optional' },
        { roleId: 'electrical.batteryVoltage', requirement: 'optional' },
        { roleId: 'fuel.lambda', requirement: 'optional' },
      ],
    },
  ],
};

export const TRIGGER_SYNC_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'trigger-sync-dual', name: 'Trigger / Sync', description: 'Dual-pane crank/cam synchronization and trigger health overview.', layout: 'dual',
  panes: [
    { id: 'pane-1', roles: [
      { roleId: 'engine.rpm', requirement: 'required' },
      { roleId: 'trigger.syncState', requirement: 'required' },
      { roleId: 'trigger.phaseSynchronized', requirement: 'preferred' },
      { roleId: 'trigger.errorActive', requirement: 'preferred' },
    ] },
    { id: 'pane-2', roles: [
      { roleId: 'trigger.errorCount', requirement: 'preferred' },
      { roleId: 'trigger.resyncCount', requirement: 'optional' },
      { roleId: 'trigger.enginePhase', requirement: 'optional' },
      { roleId: 'electrical.batteryVoltage', requirement: 'optional' },
    ] },
  ],
};

export const STARTUP_WARMUP_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'startup-warmup-dual', name: 'Startup / Warmup', description: 'Dual-pane cranking, after-start and warmup fueling overview.', layout: 'dual',
  panes: [
    { id: 'pane-1', roles: [
      { roleId: 'engine.rpm', requirement: 'required' },
      { roleId: 'temperature.coolant', requirement: 'required' },
      { roleId: 'temperature.intakeAir', requirement: 'preferred' },
      { roleId: 'electrical.batteryVoltage', requirement: 'preferred' },
      { roleId: 'startup.engineCycles', requirement: 'optional' },
    ] },
    { id: 'pane-2', roles: [
      { roleId: 'startup.crankingFuel', requirement: 'preferred' },
      { roleId: 'startup.afterStartCorrection', requirement: 'preferred' },
      { roleId: 'startup.warmupCorrection', requirement: 'preferred' },
      { roleId: 'fuel.lambda', requirement: 'preferred' },
      { roleId: 'idle.target', requirement: 'optional' },
    ] },
  ],
};

export const ELECTRICAL_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'electrical-dual', name: 'Electrical', description: 'Dual-pane charging, electrical load and sensor-supply overview.', layout: 'dual',
  panes: [
    { id: 'pane-1', roles: [
      { roleId: 'electrical.batteryVoltage', requirement: 'required' },
      { roleId: 'engine.rpm', requirement: 'required' },
      { roleId: 'fuel.injectorPulseWidth', requirement: 'preferred' },
      { roleId: 'ignition.dwell', requirement: 'preferred' },
    ] },
    { id: 'pane-2', roles: [
      { roleId: 'fuel.injectorDuty', requirement: 'preferred' },
      { roleId: 'fuel.pumpCommand', requirement: 'optional' },
      { roleId: 'electrical.alternatorDuty', requirement: 'optional' },
      { roleId: 'electrical.sensorSupplyVoltage', requirement: 'optional' },
      { roleId: 'electrical.sensorSupplyFault', requirement: 'optional' },
    ] },
  ],
};

export const VEHICLE_DRIVELINE_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'vehicle-driveline-dual', name: 'Vehicle / Driveline', description: 'Dual-pane road speed, driver inputs and driveline-state overview.', layout: 'dual',
  panes: [
    { id: 'pane-1', roles: [
      { roleId: 'engine.rpm', requirement: 'required' },
      { roleId: 'vehicle.speed', requirement: 'required' },
      { roleId: 'engine.throttle.position', requirement: 'preferred' },
      { roleId: 'engine.map', requirement: 'preferred' },
      { roleId: 'vehicle.gear', requirement: 'preferred' },
    ] },
    { id: 'pane-2', roles: [
      { roleId: 'vehicle.clutchState', requirement: 'optional' },
      { roleId: 'vehicle.brakeState', requirement: 'optional' },
      { roleId: 'vehicle.wheelSpeedFrontLeft', requirement: 'optional' },
      { roleId: 'vehicle.wheelSpeedFrontRight', requirement: 'optional' },
      { roleId: 'vehicle.wheelSpeedRearLeft', requirement: 'optional' },
      { roleId: 'vehicle.wheelSpeedRearRight', requirement: 'optional' },
      { roleId: 'vehicle.longitudinalAcceleration', requirement: 'optional' },
    ] },
  ],
};

export const EPICEFI_MAP_PREDICT_WALL_WETTING_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'epicefi-map-predict-wall-wetting-dual',
  name: 'EpicEFI · MAP Predict + Wall Wetting',
  description: 'EpicEFI predictive-MAP and intake-wall fuel model diagnostics.',
  tier: 'epicefi',
  availability: {
    allOfRoleIds: [
      'transient.predictedMap',
      'transient.effectiveMap',
      'transient.mapPredictionActive',
      'transient.wallFuelAmount',
      'transient.wallFuelCorrection',
    ],
  },
  layout: 'dual',
  panes: [
    { id: 'pane-1', roles: [
      { roleId: 'engine.rpm', requirement: 'required' },
      { roleId: 'engine.throttle.position', requirement: 'required' },
      { roleId: 'transient.tpsDelta', requirement: 'preferred' },
      { roleId: 'engine.map', requirement: 'required' },
      { roleId: 'transient.predictedMap', requirement: 'required' },
      { roleId: 'transient.effectiveMap', requirement: 'required' },
      { roleId: 'transient.mapPredictionActive', requirement: 'required' },
    ] },
    { id: 'pane-2', roles: [
      { roleId: 'fuel.lambda', requirement: 'preferred' },
      { roleId: 'fuel.injectorPulseWidth', requirement: 'preferred' },
      { roleId: 'transient.aeFuel', requirement: 'preferred' },
      { roleId: 'transient.wallFuelAmount', requirement: 'required' },
      { roleId: 'transient.wallFuelCorrection', requirement: 'required' },
    ] },
  ],
};

export const EPICEFI_FUEL_RAIL_DIAGNOSTICS_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'epicefi-fuel-rail-diagnostics-dual',
  name: 'EpicEFI · Fuel Rail Diagnostics',
  description: 'EpicEFI high-pressure fuel rail and HPFP control diagnostics.',
  tier: 'epicefi',
  availability: { allOfRoleIds: ['fuel.highPressure', 'fuel.highPressureTarget', 'fuel.hpfpActive', 'fuel.hpfpValveState'] },
  layout: 'dual',
  panes: [
    { id: 'pane-1', roles: [
      { roleId: 'engine.rpm', requirement: 'required' },
      { roleId: 'fuel.highPressure', requirement: 'required' },
      { roleId: 'fuel.highPressureTarget', requirement: 'required' },
      { roleId: 'fuel.pressureDelta', requirement: 'preferred' },
      { roleId: 'fuel.injectorPulseWidth', requirement: 'preferred' },
      { roleId: 'fuel.lambda', requirement: 'optional' },
    ] },
    { id: 'pane-2', roles: [
      { roleId: 'fuel.hpfpActive', requirement: 'required' },
      { roleId: 'fuel.hpfpValveState', requirement: 'required' },
      { roleId: 'fuel.hpfpPControl', requirement: 'preferred' },
      { roleId: 'fuel.hpfpIControl', requirement: 'preferred' },
      { roleId: 'electrical.batteryVoltage', requirement: 'optional' },
    ] },
  ],
};

export const EPICEFI_ETB_CONTROL_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'epicefi-etb-control-dual',
  name: 'EpicEFI · ETB Control',
  description: 'EpicEFI electronic-throttle demand, tracking and motor-control diagnostics.',
  tier: 'epicefi',
  availability: { allOfRoleIds: ['etb.pedalPosition', 'etb.target', 'engine.throttle.position', 'etb.error', 'etb.duty', 'etb.feedForward'] },
  layout: 'dual',
  panes: [
    { id: 'pane-1', roles: [
      { roleId: 'engine.rpm', requirement: 'preferred' },
      { roleId: 'etb.pedalPosition', requirement: 'required' },
      { roleId: 'etb.target', requirement: 'required' },
      { roleId: 'engine.throttle.position', requirement: 'required' },
      { roleId: 'etb.error', requirement: 'required' },
    ] },
    { id: 'pane-2', roles: [
      { roleId: 'etb.duty', requirement: 'required' },
      { roleId: 'etb.feedForward', requirement: 'required' },
      { roleId: 'etb.jamDetected', requirement: 'optional' },
      { roleId: 'electrical.batteryVoltage', requirement: 'preferred' },
    ] },
  ],
};

export const EPICEFI_DUAL_CHAMBER_BOOST_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'epicefi-dual-chamber-boost-dual', name: 'EpicEFI · Dual Chamber Boost', description: 'EpicEFI upper/lower wastegate solenoid and boost-control diagnostics.', tier: 'epicefi',
  availability: { allOfRoleIds: ['boost.wastegateCommand', 'boost.lowerWastegateCommand', 'boost.openLoopPart', 'boost.closedLoopPart'] }, layout: 'dual',
  panes: [
    { id: 'pane-1', roles: [
      { roleId: 'engine.rpm', requirement: 'required' }, { roleId: 'engine.map', requirement: 'required' }, { roleId: 'boost.target', requirement: 'preferred' }, { roleId: 'boost.wastegateCommand', requirement: 'required' }, { roleId: 'boost.lowerWastegateCommand', requirement: 'required' },
    ] },
    { id: 'pane-2', roles: [
      { roleId: 'boost.openLoopPart', requirement: 'required' }, { roleId: 'boost.closedLoopPart', requirement: 'required' }, { roleId: 'boost.spooledLevel', requirement: 'optional' }, { roleId: 'boost.controlActive', requirement: 'optional' }, { roleId: 'boost.error', requirement: 'optional' },
    ] },
  ],
};

export const EPICEFI_TRIGGER_SYNC_DETAILED_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'epicefi-trigger-sync-detailed-dual', name: 'EpicEFI · Trigger + Sync Detailed', description: 'EpicEFI trigger edge, tooth-angle and cam-sync diagnostics.', tier: 'epicefi',
  availability: { allOfRoleIds: ['trigger.toothAngleError', 'trigger.primaryRiseCount', 'trigger.primaryFallCount', 'trigger.camRiseCount', 'trigger.camFallCount'] }, layout: 'dual',
  panes: [
    { id: 'pane-1', roles: [
      { roleId: 'engine.rpm', requirement: 'required' }, { roleId: 'trigger.syncState', requirement: 'required' }, { roleId: 'trigger.errorActive', requirement: 'preferred' }, { roleId: 'trigger.errorCount', requirement: 'preferred' }, { roleId: 'trigger.resyncCount', requirement: 'preferred' }, { roleId: 'trigger.phaseSynchronized', requirement: 'preferred' },
    ] },
    { id: 'pane-2', roles: [
      { roleId: 'trigger.enginePhase', requirement: 'preferred' }, { roleId: 'trigger.toothAngleError', requirement: 'required' }, { roleId: 'trigger.ignoredToothCount', requirement: 'optional' }, { roleId: 'trigger.primaryRiseCount', requirement: 'required' }, { roleId: 'trigger.primaryFallCount', requirement: 'required' }, { roleId: 'trigger.camRiseCount', requirement: 'required' }, { roleId: 'trigger.camFallCount', requirement: 'required' },
    ] },
  ],
};

export const EPICEFI_INJECTOR_IGNITION_TIMING_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'epicefi-injector-ignition-timing-dual',
  name: 'EpicEFI · Injector + Ignition Timing',
  description: 'EpicEFI injection-event timing and ignition timing-attribution diagnostics.',
  tier: 'epicefi',
  availability: { allOfRoleIds: ['fuel.injectionTiming', 'ignition.tableAdvance', 'ignition.corrections', 'ignition.advance'] },
  layout: 'dual',
  panes: [
    { id: 'pane-1', roles: [
      { roleId: 'engine.rpm', requirement: 'required' },
      { roleId: 'fuel.injectionTiming', requirement: 'required' },
      { roleId: 'fuel.injectorPulseWidth', requirement: 'preferred' },
      { roleId: 'fuel.injectorDuty', requirement: 'optional' },
      { roleId: 'fuel.lambda', requirement: 'optional' },
    ] },
    { id: 'pane-2', roles: [
      { roleId: 'ignition.tableAdvance', requirement: 'required' },
      { roleId: 'ignition.baseAdvance', requirement: 'preferred' },
      { roleId: 'ignition.advance', requirement: 'required' },
      { roleId: 'ignition.corrections', requirement: 'required' },
      { roleId: 'ignition.dwell', requirement: 'optional' },
      { roleId: 'ignition.knockRetard', requirement: 'optional' },
    ] },
  ],
};

export const EPICEFI_ENGINE_PROTECTION_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'epicefi-engine-protection-dual',
  name: 'EpicEFI · Engine Protection',
  description: 'EpicEFI dynamic limit, cut-reason and engine-protection diagnostics.',
  tier: 'epicefi',
  availability: { allOfRoleIds: ['protection.stopEngineCode', 'protection.currentRevLimit', 'protection.fuelCutReason', 'protection.sparkCutReason'] },
  layout: 'dual',
  panes: [
    { id: 'pane-1', roles: [
      { roleId: 'engine.rpm', requirement: 'required' },
      { roleId: 'protection.currentRevLimit', requirement: 'required' },
      { roleId: 'temperature.coolant', requirement: 'preferred' },
      { roleId: 'engine.oilPressure', requirement: 'preferred' },
      { roleId: 'fuel.pressure', requirement: 'optional' },
      { roleId: 'cooling.coolantPressure', requirement: 'optional' },
      { roleId: 'electrical.batteryVoltage', requirement: 'optional' },
    ] },
    { id: 'pane-2', roles: [
      { roleId: 'protection.stopEngineCode', requirement: 'required' },
      { roleId: 'protection.fuelCutReason', requirement: 'required' },
      { roleId: 'protection.sparkCutReason', requirement: 'required' },
      { roleId: 'protection.totalFuelCut', requirement: 'preferred' },
      { roleId: 'protection.totalSparkCut', requirement: 'preferred' },
      { roleId: 'protection.criticalError', requirement: 'preferred' },
      { roleId: 'protection.warningActive', requirement: 'optional' },
    ] },
  ],
};

export const STARTER_WORKSPACE_TEMPLATES: readonly StarterWorkspaceTemplate[] = Object.freeze([
  GENERAL_SINGLE_WORKSPACE,
  IDLE_DUAL_WORKSPACE,
  BOOST_DUAL_WORKSPACE,
  FUEL_DUAL_WORKSPACE,
  IGNITION_DUAL_WORKSPACE,
  COOLING_DUAL_WORKSPACE,
  TRANSIENT_AE_DUAL_WORKSPACE,
  FUEL_SYSTEM_DUAL_WORKSPACE,
  TRIGGER_SYNC_DUAL_WORKSPACE,
  STARTUP_WARMUP_DUAL_WORKSPACE,
  ELECTRICAL_DUAL_WORKSPACE,
  VEHICLE_DRIVELINE_DUAL_WORKSPACE,
  EPICEFI_MAP_PREDICT_WALL_WETTING_DUAL_WORKSPACE,
  EPICEFI_FUEL_RAIL_DIAGNOSTICS_DUAL_WORKSPACE,
  EPICEFI_ETB_CONTROL_DUAL_WORKSPACE,
  EPICEFI_DUAL_CHAMBER_BOOST_DUAL_WORKSPACE,
  EPICEFI_TRIGGER_SYNC_DETAILED_DUAL_WORKSPACE,
  EPICEFI_INJECTOR_IGNITION_TIMING_DUAL_WORKSPACE,
  EPICEFI_ENGINE_PROTECTION_DUAL_WORKSPACE,
]);

export function starterWorkspaceAvailable(
  template: StarterWorkspaceTemplate,
  channels: readonly ChannelDefinition[],
  options: SemanticChannelResolveOptions = {},
): boolean {
  const capabilities = template.availability?.allOfRoleIds ?? [];
  return capabilities.every((roleId) => Boolean(resolveSemanticChannelRole(roleId, channels, options).channel));
}

export function availableStarterWorkspaceTemplates(
  channels: readonly ChannelDefinition[],
  options: SemanticChannelResolveOptions = {},
): readonly StarterWorkspaceTemplate[] {
  return STARTER_WORKSPACE_TEMPLATES.filter((template) => starterWorkspaceAvailable(template, channels, options));
}

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
