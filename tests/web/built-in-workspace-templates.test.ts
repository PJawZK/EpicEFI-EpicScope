import { describe, expect, it } from 'vitest';

import type { ChannelDefinition } from '../../core/log-model/log-types';
import {
  BOOST_DUAL_WORKSPACE,
  COOLING_DUAL_WORKSPACE,
  FUEL_DUAL_WORKSPACE,
  FUEL_SYSTEM_DUAL_WORKSPACE,
  GENERAL_SINGLE_WORKSPACE,
  GENERIC_STARTER_WORKSPACE_TEMPLATES,
  IDLE_DUAL_WORKSPACE,
  IGNITION_DUAL_WORKSPACE,
  STARTER_WORKSPACE_TEMPLATES,
  TRANSIENT_AE_DUAL_WORKSPACE,
  resolveStarterWorkspaceTemplate,
  starterWorkspaceTemplate,
} from '../../apps/web/src/state/built-in-workspace-templates';

function channel(id: string, sourceName = id, displayName = sourceName): ChannelDefinition {
  return {
    id,
    sourceName,
    displayName,
    valueType: 'number',
  };
}

describe('starter workspace templates', () => {
  it('exposes the production starter catalog in deliberate menu order', () => {
    expect(STARTER_WORKSPACE_TEMPLATES.map((template) => template.name)).toEqual([
      'General', 'Idle', 'Boost', 'Fuel', 'Ignition', 'Cooling', 'Transient / AE', 'Fuel System',
      'Trigger / Sync', 'Startup / Warmup', 'Electrical', 'Vehicle / Driveline',
      'EpicEFI · MAP Predict + Wall Wetting', 'EpicEFI · Fuel Rail Diagnostics', 'EpicEFI · ETB Control',
      'EpicEFI · Dual Chamber Boost', 'EpicEFI · Trigger + Sync Detailed',
      'EpicEFI · Injector + Ignition Timing', 'EpicEFI · Engine Protection', 'EpicEFI · VVT Control',
      'EpicEFI · Anti-Lag', 'EpicEFI · Launch Control', 'EpicEFI · Traction Control',
      'EpicEFI · Transmission Control',
    ]);
    expect(starterWorkspaceTemplate(BOOST_DUAL_WORKSPACE.id)).toBe(BOOST_DUAL_WORKSPACE);
    expect(starterWorkspaceTemplate(COOLING_DUAL_WORKSPACE.id)).toBe(COOLING_DUAL_WORKSPACE);
    expect(starterWorkspaceTemplate(FUEL_DUAL_WORKSPACE.id)).toBe(FUEL_DUAL_WORKSPACE);
    expect(starterWorkspaceTemplate(GENERAL_SINGLE_WORKSPACE.id)).toBe(GENERAL_SINGLE_WORKSPACE);
    expect(starterWorkspaceTemplate(IDLE_DUAL_WORKSPACE.id)).toBe(IDLE_DUAL_WORKSPACE);
    expect(starterWorkspaceTemplate(IGNITION_DUAL_WORKSPACE.id)).toBe(IGNITION_DUAL_WORKSPACE);
    expect(starterWorkspaceTemplate(TRANSIENT_AE_DUAL_WORKSPACE.id)).toBe(TRANSIENT_AE_DUAL_WORKSPACE);
    expect(starterWorkspaceTemplate(FUEL_SYSTEM_DUAL_WORKSPACE.id)).toBe(FUEL_SYSTEM_DUAL_WORKSPACE);
    expect(starterWorkspaceTemplate('missing')).toBeUndefined();
  });

  it('exposes exactly the portable generic starters used to seed a fresh install', () => {
    expect(GENERIC_STARTER_WORKSPACE_TEMPLATES.map((template) => template.name)).toEqual([
      'General', 'Idle', 'Boost', 'Fuel', 'Ignition', 'Cooling', 'Transient / AE', 'Fuel System',
      'Trigger / Sync', 'Startup / Warmup', 'Electrical', 'Vehicle / Driveline',
    ]);
    expect(GENERIC_STARTER_WORKSPACE_TEMPLATES.every((template) => template.tier !== 'epicefi')).toBe(true);
  });

  it('defines General as one pane with the agreed overview roles', () => {
    expect(GENERAL_SINGLE_WORKSPACE.name).toBe('General');
    expect(GENERAL_SINGLE_WORKSPACE.layout).toBe('single');
    expect(GENERAL_SINGLE_WORKSPACE.panes).toHaveLength(1);
    expect(GENERAL_SINGLE_WORKSPACE.panes[0]?.roles).toEqual([
      { roleId: 'engine.rpm', requirement: 'required' },
      { roleId: 'engine.map', requirement: 'required' },
      { roleId: 'engine.throttle.position', requirement: 'preferred' },
      { roleId: 'temperature.coolant', requirement: 'preferred' },
      { roleId: 'temperature.intakeAir', requirement: 'optional' },
      { roleId: 'electrical.batteryVoltage', requirement: 'optional' },
      { roleId: 'fuel.lambda', requirement: 'optional' },
      { roleId: 'ignition.advance', requirement: 'optional' },
    ]);
  });

  it('defines Idle as a portable two-pane starter', () => {
    expect(IDLE_DUAL_WORKSPACE.name).toBe('Idle');
    expect(IDLE_DUAL_WORKSPACE.layout).toBe('dual');
    expect(IDLE_DUAL_WORKSPACE.panes).toHaveLength(2);
    expect(IDLE_DUAL_WORKSPACE.panes[0]?.roles).toEqual([
      { roleId: 'engine.rpm', requirement: 'required' },
      { roleId: 'idle.target', requirement: 'required' },
      { roleId: 'engine.map', requirement: 'preferred' },
      { roleId: 'engine.throttle.position', requirement: 'preferred' },
    ]);
    expect(IDLE_DUAL_WORKSPACE.panes[1]?.roles).toEqual([
      { roleId: 'idle.airCommand', requirement: 'preferred' },
      { roleId: 'ignition.advance', requirement: 'preferred' },
      { roleId: 'temperature.coolant', requirement: 'preferred' },
      { roleId: 'fuel.lambda', requirement: 'optional' },
    ]);
  });

  it('defines Boost as a portable two-pane starter without closed-loop boost or extra-sensor assumptions', () => {
    expect(BOOST_DUAL_WORKSPACE.name).toBe('Boost');
    expect(BOOST_DUAL_WORKSPACE.layout).toBe('dual');
    expect(BOOST_DUAL_WORKSPACE.panes[0]?.roles).toEqual([
      { roleId: 'engine.rpm', requirement: 'required' },
      { roleId: 'engine.map', requirement: 'required' },
      { roleId: 'engine.throttle.position', requirement: 'preferred' },
      { roleId: 'temperature.intakeAir', requirement: 'preferred' },
    ]);
    expect(BOOST_DUAL_WORKSPACE.panes[1]?.roles).toEqual([
      { roleId: 'ignition.advance', requirement: 'preferred' },
      { roleId: 'fuel.injectorPulseWidth', requirement: 'preferred' },
      { roleId: 'fuel.injectorDuty', requirement: 'preferred' },
      { roleId: 'electrical.batteryVoltage', requirement: 'optional' },
    ]);
  });

  it('resolves Boost onto ordinary EpicEFI engine-state channels', () => {
    const result = resolveStarterWorkspaceTemplate(BOOST_DUAL_WORKSPACE, [
      channel('ini:RPMValue', 'RPMValue', 'RPM'),
      channel('ini:MAPValue', 'MAPValue', 'MAP'),
      channel('ini:TPSValue', 'TPSValue', 'TPS'),
      channel('ini:intake', 'intake', 'Intake air temp'),
      channel('ini:correctedIgnitionAdvance', 'correctedIgnitionAdvance', 'Timing: ignition'),
      channel('ini:actualLastInjection', 'actualLastInjection', 'Fuel: Last inj pulse width'),
      channel('ini:injectorDutyCycle', 'injectorDutyCycle', 'Fuel: injector duty cycle'),
      channel('ini:VBatt', 'VBatt', 'Battery'),
    ]);
    expect(result.panes[0]?.channelIds).toEqual(['ini:RPMValue', 'ini:MAPValue', 'ini:TPSValue', 'ini:intake']);
    expect(result.panes[1]?.channelIds).toEqual(['ini:correctedIgnitionAdvance', 'ini:actualLastInjection', 'ini:injectorDutyCycle', 'ini:VBatt']);
    expect(result.unresolvedRequiredRoleIds).toEqual([]);
  });

  it('resolves Fuel onto canonical EpicEFI INI identities', () => {
    const result = resolveStarterWorkspaceTemplate(FUEL_DUAL_WORKSPACE, [
      channel('ini:RPMValue', 'RPMValue', 'RPM'),
      channel('ini:MAPValue', 'MAPValue', 'MAP'),
      channel('ini:lambdaValue', 'lambdaValue', 'Lambda'),
      channel('ini:targetLambda', 'targetLambda', 'Fuel: target lambda'),
      channel('ini:actualLastInjection', 'actualLastInjection', 'Fuel: Last inj pulse width'),
      channel('ini:injectorDutyCycle', 'injectorDutyCycle', 'Fuel: injector duty cycle'),
      channel('ini:lowFuelPressure', 'lowFuelPressure', 'Fuel pressure'),
      channel('ini:totalFuelCorrection', 'totalFuelCorrection', 'Fuel: Total correction'),
    ]);
    expect(result.panes[0]?.channelIds).toEqual([
      'ini:RPMValue', 'ini:MAPValue', 'ini:lambdaValue', 'ini:targetLambda',
    ]);
    expect(result.panes[1]?.channelIds).toEqual([
      'ini:actualLastInjection', 'ini:injectorDutyCycle', 'ini:lowFuelPressure', 'ini:totalFuelCorrection',
    ]);
  });

  it('resolves Ignition without requiring knock hardware', () => {
    const result = resolveStarterWorkspaceTemplate(IGNITION_DUAL_WORKSPACE, [
      channel('ini:RPMValue', 'RPMValue', 'RPM'),
      channel('ini:MAPValue', 'MAPValue', 'MAP'),
      channel('ini:TPSValue', 'TPSValue', 'TPS'),
      channel('ini:correctedIgnitionAdvance', 'correctedIgnitionAdvance', 'Timing: ignition'),
      channel('ini:sparkDwell', 'sparkDwell', 'Ignition: coil charge time'),
      channel('ini:VBatt', 'VBatt', 'Battery'),
      channel('ini:intake', 'intake', 'Intake air temp'),
      channel('ini:coolant', 'coolant', 'Coolant temp'),
    ]);
    expect(result.panes[0]?.channelIds).toEqual(['ini:RPMValue', 'ini:MAPValue', 'ini:TPSValue', 'ini:correctedIgnitionAdvance']);
    expect(result.panes[1]?.channelIds).toEqual(['ini:sparkDwell', 'ini:VBatt', 'ini:intake', 'ini:coolant']);
  });

  it('resolves Cooling with binary fan state and optional coolant pressure', () => {
    const result = resolveStarterWorkspaceTemplate(COOLING_DUAL_WORKSPACE, [
      channel('ini:coolant', 'coolant', 'Coolant temp'),
      channel('ini:intake', 'intake', 'Intake air temp'),
      channel('ini:RPMValue', 'RPMValue', 'RPM'),
      channel('ini:vehicleSpeedKph', 'vehicleSpeedKph', 'Vehicle speed'),
      channel('ini:fan1m_state', 'fan1m_state', 'Fan 1 state'),
      channel('ini:oilTemp', 'oilTemp', 'Oil Temp'),
      channel('ini:oilPressure', 'oilPressure', 'Oil Pressure'),
      channel('ini:coolantPressure', 'coolantPressure', 'Coolant Pressure'),
      channel('ini:VBatt', 'VBatt', 'Battery'),
    ]);
    expect(result.panes[0]?.channelIds).toEqual(['ini:coolant', 'ini:intake', 'ini:RPMValue', 'ini:vehicleSpeedKph']);
    expect(result.panes[1]?.channelIds).toEqual(['ini:fan1m_state', 'ini:oilTemp', 'ini:oilPressure', 'ini:coolantPressure', 'ini:VBatt']);
  });

  it('resolves Transient / AE onto canonical EpicEFI INI identities', () => {
    const result = resolveStarterWorkspaceTemplate(TRANSIENT_AE_DUAL_WORKSPACE, [
      channel('ini:RPMValue', 'RPMValue', 'RPM'),
      channel('ini:TPSValue', 'TPSValue', 'TPS'),
      channel('ini:deltaTps', 'deltaTps', 'AE: TPS change'),
      channel('ini:MAPValue', 'MAPValue', 'MAP'),
      channel('ini:effectiveMap', 'effectiveMap', 'Effective MAP'),
      channel('ini:lambdaValue', 'lambdaValue', 'Lambda'),
      channel('ini:targetLambda', 'targetLambda', 'Fuel: target lambda'),
      channel('ini:actualLastInjection', 'actualLastInjection', 'Fuel: Last inj pulse width'),
      channel('ini:tpsAccelFuel', 'tpsAccelFuel', 'Fuel: TPS AE add fuel ms'),
      channel('ini:wallFuelCorrectionValue', 'wallFuelCorrectionValue', 'Fuel: wall correction'),
    ]);
    expect(result.panes[0]?.channelIds).toEqual([
      'ini:RPMValue', 'ini:TPSValue', 'ini:deltaTps', 'ini:MAPValue',
    ]);
    expect(result.panes[1]?.channelIds).toEqual([
      'ini:effectiveMap', 'ini:lambdaValue', 'ini:targetLambda', 'ini:actualLastInjection', 'ini:tpsAccelFuel', 'ini:wallFuelCorrectionValue',
    ]);
    expect(result.unresolvedRequiredRoleIds).toEqual([]);
  });

  it('resolves Fuel System onto canonical EpicEFI INI identities', () => {
    const result = resolveStarterWorkspaceTemplate(FUEL_SYSTEM_DUAL_WORKSPACE, [
      channel('ini:RPMValue', 'RPMValue', 'RPM'),
      channel('ini:lowFuelPressure', 'lowFuelPressure', 'Fuel pressure'),
      channel('ini:MAPValue', 'MAPValue', 'MAP'),
      channel('ini:TPSValue', 'TPSValue', 'TPS'),
      channel('ini:pressureDelta', 'pressureDelta', 'Fuel: Injector pressure delta'),
      channel('ini:actualLastInjection', 'actualLastInjection', 'Fuel: Last inj pulse width'),
      channel('ini:injectorDutyCycle', 'injectorDutyCycle', 'Fuel: injector duty cycle'),
      channel('ini:isFuelPumpOn', 'isFuelPumpOn', 'isFuelPumpOn'),
      channel('ini:VBatt', 'VBatt', 'Battery'),
      channel('ini:lambdaValue', 'lambdaValue', 'Lambda'),
    ]);
    expect(result.panes[0]?.channelIds).toEqual([
      'ini:RPMValue', 'ini:lowFuelPressure', 'ini:MAPValue', 'ini:TPSValue',
    ]);
    expect(result.panes[1]?.channelIds).toEqual([
      'ini:pressureDelta', 'ini:actualLastInjection', 'ini:injectorDutyCycle', 'ini:isFuelPumpOn', 'ini:VBatt', 'ini:lambdaValue',
    ]);
    expect(result.unresolvedRequiredRoleIds).toEqual([]);
  });

  it('resolves General onto EpicEFI live Shim channel IDs', () => {
    const result = resolveStarterWorkspaceTemplate(GENERAL_SINGLE_WORKSPACE, [
      channel('RPMValue'),
      channel('MAPValue'),
      channel('TPSValue'),
      channel('coolant'),
      channel('intake'),
      channel('VBatt'),
      channel('lambdaValue'),
      channel('correctedIgnitionAdvance'),
    ]);

    expect(result.panes[0]?.channelIds).toEqual([
      'RPMValue',
      'MAPValue',
      'TPSValue',
      'coolant',
      'intake',
      'VBatt',
      'lambdaValue',
      'correctedIgnitionAdvance',
    ]);
    expect(result.unresolvedRequiredRoleIds).toEqual([]);
    expect(result.unresolvedPreferredRoleIds).toEqual([]);
    expect(result.unresolvedOptionalRoleIds).toEqual([]);
  });

  it('resolves General onto canonical INI identities', () => {
    const result = resolveStarterWorkspaceTemplate(GENERAL_SINGLE_WORKSPACE, [
      channel('ini:RPMValue', 'RPMValue', 'RPM'),
      channel('ini:MAPValue', 'MAPValue', 'MAP'),
      channel('ini:TPSValue', 'TPSValue', 'TPS'),
      channel('ini:coolant', 'coolant', 'Coolant temp'),
      channel('ini:intake', 'intake', 'Intake air temp'),
      channel('ini:VBatt', 'VBatt', 'Battery'),
      channel('ini:lambdaValue', 'lambdaValue', 'Lambda'),
      channel('ini:correctedIgnitionAdvance', 'correctedIgnitionAdvance', 'Timing: ignition'),
    ]);

    expect(result.panes[0]?.channelIds).toEqual([
      'ini:RPMValue',
      'ini:MAPValue',
      'ini:TPSValue',
      'ini:coolant',
      'ini:intake',
      'ini:VBatt',
      'ini:lambdaValue',
      'ini:correctedIgnitionAdvance',
    ]);
  });

  it('resolves Idle into two EpicEFI panes without DC-specific coupling', () => {
    const result = resolveStarterWorkspaceTemplate(IDLE_DUAL_WORKSPACE, [
      channel('RPMValue'),
      channel('idleTarget'),
      channel('MAPValue'),
      channel('TPSValue'),
      channel('currentIdlePosition'),
      channel('correctedIgnitionAdvance'),
      channel('coolant'),
      channel('lambdaValue'),
      channel('dcIdleTarget'),
      channel('IdlePosition'),
    ]);

    expect(result.panes[0]?.channelIds).toEqual([
      'RPMValue',
      'idleTarget',
      'MAPValue',
      'TPSValue',
    ]);
    expect(result.panes[1]?.channelIds).toEqual([
      'currentIdlePosition',
      'correctedIgnitionAdvance',
      'coolant',
      'lambdaValue',
    ]);
    expect(result.unresolvedRequiredRoleIds).toEqual([]);
  });

  it('loads gracefully when preferred and optional roles are missing', () => {
    const result = resolveStarterWorkspaceTemplate(GENERAL_SINGLE_WORKSPACE, [
      channel('RPMValue'),
      channel('MAPValue'),
    ]);

    expect(result.panes[0]?.channelIds).toEqual(['RPMValue', 'MAPValue']);
    expect(result.unresolvedRequiredRoleIds).toEqual([]);
    expect(result.unresolvedPreferredRoleIds).toEqual([
      'engine.throttle.position',
      'temperature.coolant',
    ]);
    expect(result.unresolvedOptionalRoleIds).toEqual([
      'temperature.intakeAir',
      'electrical.batteryVoltage',
      'fuel.lambda',
      'ignition.advance',
    ]);
  });

  it('reports missing required roles without rejecting starter creation', () => {
    const result = resolveStarterWorkspaceTemplate(GENERAL_SINGLE_WORKSPACE, [
      channel('TPSValue'),
      channel('coolant'),
    ]);

    expect(result.panes[0]?.channelIds).toEqual(['TPSValue', 'coolant']);
    expect(result.unresolvedRequiredRoleIds).toEqual(['engine.rpm', 'engine.map']);
  });
});