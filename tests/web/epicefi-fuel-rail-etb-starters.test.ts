import { describe, expect, it } from 'vitest';
import type { ChannelDefinition } from '../../core/log-model/log-types';
import {
  EPICEFI_ETB_CONTROL_DUAL_WORKSPACE,
  EPICEFI_FUEL_RAIL_DIAGNOSTICS_DUAL_WORKSPACE,
  availableStarterWorkspaceTemplates,
  resolveStarterWorkspaceTemplate,
  starterWorkspaceAvailable,
} from '../../apps/web/src/state/built-in-workspace-templates';
import { resolveSemanticChannelRole } from '../../apps/web/src/state/semantic-channel-roles';

function channel(id: string, sourceName = id, displayName = sourceName): ChannelDefinition { return { id, sourceName, displayName, valueType: 'number' }; }

const fuelRailChannels = [
  channel('ini:RPMValue','RPMValue','RPM'), channel('ini:highFuelPressure','highFuelPressure','Fuel pressure (high)'), channel('ini:m_pressureTarget_kPa','m_pressureTarget_kPa','GDI: target pressure'),
  channel('ini:pressureDelta','pressureDelta','Fuel: Injector pressure delta'), channel('ini:actualLastInjection','actualLastInjection','Fuel: Last inj pulse width'), channel('ini:lambdaValue','lambdaValue','Lambda'),
  channel('ini:isHpfpActive','isHpfpActive','GDI: HPFP Active'), channel('ini:HpfpValveState','HpfpValveState','GDI: HPFP Valve state'), channel('ini:hpfp_p_control_percent','hpfp_p_control_percent','hpfp_p_control_percent'), channel('ini:hpfp_i_control_percent','hpfp_i_control_percent','hpfp_i_control_percent'), channel('ini:VBatt','VBatt','Battery Voltage'),
];

const etbChannels = [
  channel('ini:RPMValue','RPMValue','RPM'), channel('ini:throttlePedalPosition','throttlePedalPosition','Throttle pedal position'), channel('ini:etb1m_adjustedTarget','etb1m_adjustedTarget','ETB: position target'),
  channel('ini:TPSValue','TPSValue','TPS'), channel('ini:etbStatus_error','etbStatus_error','ETB: position error'), channel('ini:etb1DutyCycle','etb1DutyCycle','ETB: Duty'), channel('ini:etb1etbFeedForward','etb1etbFeedForward','ETB Feed Forward'), channel('ini:etb1jamDetected','etb1jamDetected','ETB Jam Detected'), channel('ini:VBatt','VBatt','Battery Voltage'),
];

describe('EpicEFI Fuel Rail Diagnostics and ETB Control starters', () => {
  it('gates Fuel Rail Diagnostics on the defining HPFP runtime bundle', () => {
    expect(starterWorkspaceAvailable(EPICEFI_FUEL_RAIL_DIAGNOSTICS_DUAL_WORKSPACE, fuelRailChannels)).toBe(true);
    expect(starterWorkspaceAvailable(EPICEFI_FUEL_RAIL_DIAGNOSTICS_DUAL_WORKSPACE, fuelRailChannels.filter((c)=>c.sourceName!=='HpfpValveState'))).toBe(false);
  });
  it('resolves Fuel Rail Diagnostics onto canonical EpicEFI runtime identities', () => {
    const r=resolveStarterWorkspaceTemplate(EPICEFI_FUEL_RAIL_DIAGNOSTICS_DUAL_WORKSPACE, fuelRailChannels);
    expect(r.panes[0]?.channelIds).toEqual(['ini:RPMValue','ini:highFuelPressure','ini:m_pressureTarget_kPa','ini:pressureDelta','ini:actualLastInjection','ini:lambdaValue']);
    expect(r.panes[1]?.channelIds).toEqual(['ini:isHpfpActive','ini:HpfpValveState','ini:hpfp_p_control_percent','ini:hpfp_i_control_percent','ini:VBatt']);
    expect(r.unresolvedRequiredRoleIds).toEqual([]);
  });
  it('gates ETB Control on demand, target, tracking and motor-control telemetry', () => {
    expect(starterWorkspaceAvailable(EPICEFI_ETB_CONTROL_DUAL_WORKSPACE, etbChannels)).toBe(true);
    expect(starterWorkspaceAvailable(EPICEFI_ETB_CONTROL_DUAL_WORKSPACE, etbChannels.filter((c)=>c.sourceName!=='etb1etbFeedForward'))).toBe(false);
  });
  it('resolves ETB Control onto canonical EpicEFI runtime identities', () => {
    const r=resolveStarterWorkspaceTemplate(EPICEFI_ETB_CONTROL_DUAL_WORKSPACE, etbChannels);
    expect(r.panes[0]?.channelIds).toEqual(['ini:RPMValue','ini:throttlePedalPosition','ini:etb1m_adjustedTarget','ini:TPSValue','ini:etbStatus_error']);
    expect(r.panes[1]?.channelIds).toEqual(['ini:etb1DutyCycle','ini:etb1etbFeedForward','ini:etb1jamDetected','ini:VBatt']);
    expect(r.unresolvedRequiredRoleIds).toEqual([]);
  });
  it('does not confuse HPFP/ETB configuration values with runtime capability channels', () => {
    const configOnly=[channel('hpfpTarget','hpfpTarget','HPFP target table'),channel('hpfpPidP','hpfpPidP','HPFP PID P'),channel('etbTestDuty','etbTestDuty','ETB test duty'),channel('etbJamDetectThreshold','etbJamDetectThreshold','Jam detection error max'),channel('etbBiasValues','etbBiasValues','ETB bias curve')];
    expect(resolveSemanticChannelRole('fuel.highPressureTarget',configOnly).channel).toBeUndefined();
    expect(resolveSemanticChannelRole('fuel.hpfpPControl',configOnly).channel).toBeUndefined();
    expect(resolveSemanticChannelRole('etb.duty',configOnly).channel).toBeUndefined();
    expect(resolveSemanticChannelRole('etb.error',configOnly).channel).toBeUndefined();
    expect(resolveSemanticChannelRole('etb.feedForward',configOnly).channel).toBeUndefined();
  });
  it('exposes both specialized starters when the active schema contains both capability bundles', () => {
    const names=availableStarterWorkspaceTemplates([...fuelRailChannels,...etbChannels]).map((t)=>t.name);
    expect(names).toContain('EpicEFI · Fuel Rail Diagnostics');
    expect(names).toContain('EpicEFI · ETB Control');
  });
});
