import { describe, expect, it } from 'vitest';
import type { ChannelDefinition } from '../../core/log-model/log-types';
import {
  EPICEFI_ENGINE_PROTECTION_DUAL_WORKSPACE,
  EPICEFI_INJECTOR_IGNITION_TIMING_DUAL_WORKSPACE,
  resolveStarterWorkspaceTemplate,
  starterWorkspaceAvailable,
} from '../../apps/web/src/state/built-in-workspace-templates';
import { resolveSemanticChannelRole } from '../../apps/web/src/state/semantic-channel-roles';

const c = (id: string, displayName = id): ChannelDefinition => ({
  id: `ini:${id}`, sourceName: id, displayName, valueType: 'number',
});

const timing = [
  c('RPMValue', 'RPM'), c('injectionOffset', 'Fuel: Injection timing SOI'),
  c('actualLastInjection', 'Fuel: Last inj pulse width'), c('injectorDutyCycle', 'Fuel: injector duty cycle'),
  c('lambdaValue', 'Lambda'), c('ignitionTableAdvance', 'Ignition: Raw table advance'),
  c('baseIgnitionAdvance', 'Timing: base ignition'), c('correctedIgnitionAdvance', 'Timing: ignition'),
  c('ignitionCorrections', 'Ignition: Corrections SUM'), c('sparkDwell', 'Ignition: coil charge time'),
  c('m_knockRetard', 'Knock retard'),
];

const protection = [
  c('RPMValue', 'RPM'), c('rev_limit', 'Current Rev Limit'), c('coolant', 'Coolant temp'),
  c('oilPressure', 'Oil Pressure'), c('lowFuelPressure', 'Fuel pressure'), c('coolantPressure', 'Coolant Pressure'),
  c('VBatt', 'Battery'), c('stopEngineCode'), c('fuelCutReason', 'Fuel: Cut Code'),
  c('sparkCutReason', 'Ign: Cut Code'), c('totalFuelCut'), c('totalSparkCut'),
  c('hasCriticalError', 'Error: Active'), c('isWarnNow', 'Warning: Active'),
];

describe('EpicEFI injector/ignition timing and engine-protection starters', () => {
  it('gates and resolves injector + ignition timing from live timing attribution telemetry', () => {
    expect(starterWorkspaceAvailable(EPICEFI_INJECTOR_IGNITION_TIMING_DUAL_WORKSPACE, timing)).toBe(true);
    expect(starterWorkspaceAvailable(EPICEFI_INJECTOR_IGNITION_TIMING_DUAL_WORKSPACE, timing.filter((x) => x.sourceName !== 'injectionOffset'))).toBe(false);
    const r = resolveStarterWorkspaceTemplate(EPICEFI_INJECTOR_IGNITION_TIMING_DUAL_WORKSPACE, timing);
    expect(r.panes[0]?.channelIds).toEqual(['ini:RPMValue', 'ini:injectionOffset', 'ini:actualLastInjection', 'ini:injectorDutyCycle', 'ini:lambdaValue']);
    expect(r.panes[1]?.channelIds).toEqual(['ini:ignitionTableAdvance', 'ini:baseIgnitionAdvance', 'ini:correctedIgnitionAdvance', 'ini:ignitionCorrections', 'ini:sparkDwell', 'ini:m_knockRetard']);
    expect(r.unresolvedRequiredRoleIds).toEqual([]);
  });

  it('gates and resolves engine protection from live stop/cut/limit telemetry', () => {
    expect(starterWorkspaceAvailable(EPICEFI_ENGINE_PROTECTION_DUAL_WORKSPACE, protection)).toBe(true);
    expect(starterWorkspaceAvailable(EPICEFI_ENGINE_PROTECTION_DUAL_WORKSPACE, protection.filter((x) => x.sourceName !== 'fuelCutReason'))).toBe(false);
    const r = resolveStarterWorkspaceTemplate(EPICEFI_ENGINE_PROTECTION_DUAL_WORKSPACE, protection);
    expect(r.panes[0]?.channelIds).toEqual(['ini:RPMValue', 'ini:rev_limit', 'ini:coolant', 'ini:oilPressure', 'ini:lowFuelPressure', 'ini:coolantPressure', 'ini:VBatt']);
    expect(r.panes[1]?.channelIds).toEqual(['ini:stopEngineCode', 'ini:fuelCutReason', 'ini:sparkCutReason', 'ini:totalFuelCut', 'ini:totalSparkCut', 'ini:hasCriticalError', 'ini:isWarnNow']);
    expect(r.unresolvedRequiredRoleIds).toEqual([]);
  });

  it('rejects tune/configuration lookalikes as runtime capability evidence', () => {
    expect(resolveSemanticChannelRole('fuel.injectionTiming', [
      c('injectionTimingMode', 'Injection timing mode'), c('injectionPhase', 'Injection Phase table'), c('injAdvAssistStartDeg', 'Injector advance assist start'),
    ]).channel).toBeUndefined();
    expect(resolveSemanticChannelRole('protection.currentRevLimit', [
      c('rpmHardLimit', 'Hard RPM limit'), c('rpmSoftLimitWindowSize', 'RPM soft limit window'),
    ]).channel).toBeUndefined();
    expect(resolveSemanticChannelRole('protection.fuelCutReason', [
      c('cutFuelOnHardLimit', 'Cut fuel on hard limit'), c('enableOilPressureProtect', 'Low oil pressure protection'),
    ]).channel).toBeUndefined();
  });
});
