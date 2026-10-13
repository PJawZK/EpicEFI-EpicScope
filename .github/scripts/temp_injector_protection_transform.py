from pathlib import Path

# Semantic runtime roles.
p = Path('apps/web/src/state/semantic-channel-roles.ts')
s = p.read_text()
old = "  | 'trigger.camFallCount';"
new = """  | 'trigger.camFallCount'
  | 'fuel.injectionTiming'
  | 'ignition.tableAdvance'
  | 'ignition.baseAdvance'
  | 'ignition.corrections'
  | 'protection.stopEngineCode'
  | 'protection.currentRevLimit'
  | 'protection.fuelCutReason'
  | 'protection.sparkCutReason'
  | 'protection.totalFuelCut'
  | 'protection.totalSparkCut'
  | 'protection.criticalError'
  | 'protection.warningActive'
  | 'cooling.coolantPressure';"""
assert old in s
s = s.replace(old, new, 1)
marker = "\n};\n\nexport const semanticChannelRoles"
assert marker in s
roles = """
  'fuel.injectionTiming': { id: 'fuel.injectionTiming', displayName: 'Injection Timing SOI', aliases: ['injectionOffset', 'Fuel: Injection timing SOI', 'Injection Timing SOI'], include: [/injection.*timing.*soi/i, /^injection.*offset$/i, /start.*of.*injection/i], exclude: [/mode/i, /table/i, /phase.*table/i, /assist/i, /start.*deg/i, /end.*deg/i, /axis/i, /config/i] },
  'ignition.tableAdvance': { id: 'ignition.tableAdvance', displayName: 'Raw Ignition Table Advance', aliases: ['ignitionTableAdvance', 'Ignition: Raw table advance', 'Raw Ignition Table Advance'], include: [/^ignition.*raw.*table.*advance$/i, /^ignitiontableadvance$/i], exclude: [/config/i, /axis/i, /bin/i] },
  'ignition.baseAdvance': { id: 'ignition.baseAdvance', displayName: 'Base Ignition Advance', aliases: ['baseIgnitionAdvance', 'Timing: base ignition', 'Base Ignition Advance'], include: [/^base.*ignition.*advance$/i, /^timing.*base.*ignition$/i], exclude: [/table/i, /config/i, /cranking/i] },
  'ignition.corrections': { id: 'ignition.corrections', displayName: 'Ignition Corrections', aliases: ['ignitionCorrections', 'ignitionAdvanceCorrections', 'Ignition: Corrections SUM', 'Ignition: Advance corrections'], include: [/ignition.*correction/i], exclude: [/table/i, /config/i, /limit/i, /individual/i] },
  'protection.stopEngineCode': { id: 'protection.stopEngineCode', displayName: 'Stop Engine Code', aliases: ['stopEngineCode', 'Stop Engine Code'], include: [/^stop.*engine.*code$/i], exclude: [/config/i, /enable/i] },
  'protection.currentRevLimit': { id: 'protection.currentRevLimit', displayName: 'Current Rev Limit', aliases: ['rev_limit', 'Current Rev Limit'], include: [/^current.*rev.*limit$/i], exclude: [/minimum/i, /maximum/i, /soft/i, /hard/i, /window/i, /table/i, /config/i, /adder/i] },
  'protection.fuelCutReason': { id: 'protection.fuelCutReason', displayName: 'Fuel Cut Reason', aliases: ['fuelCutReason', 'Fuel: Cut Code', 'Fuel Cut Reason'], include: [/^fuel.*cut.*(?:reason|code)$/i], exclude: [/blink/i, /enable/i, /config/i, /hard.*limit/i] },
  'protection.sparkCutReason': { id: 'protection.sparkCutReason', displayName: 'Spark Cut Reason', aliases: ['sparkCutReason', 'Ign: Cut Code', 'Spark Cut Reason'], include: [/(?:spark|ignition|ign).*cut.*(?:reason|code)/i], exclude: [/blink/i, /enable/i, /config/i, /hard.*limit/i] },
  'protection.totalFuelCut': { id: 'protection.totalFuelCut', displayName: 'Total Fuel Cut', aliases: ['totalFuelCut', 'Total Fuel Cut'], include: [/^total.*fuel.*cut$/i], exclude: [/config/i, /enable/i] },
  'protection.totalSparkCut': { id: 'protection.totalSparkCut', displayName: 'Total Spark Cut', aliases: ['totalSparkCut', 'Total Spark Cut'], include: [/^total.*spark.*cut$/i], exclude: [/config/i, /enable/i] },
  'protection.criticalError': { id: 'protection.criticalError', displayName: 'Critical Error', aliases: ['hasCriticalError', 'Error: Active', 'Critical Error'], include: [/critical.*error/i, /^error.*active$/i], exclude: [/code/i, /count/i, /config/i] },
  'protection.warningActive': { id: 'protection.warningActive', displayName: 'Warning Active', aliases: ['isWarnNow', 'Warning: Active', 'Warning Active'], include: [/warning.*active/i, /^is.*warn.*now$/i], exclude: [/counter/i, /code/i, /config/i] },
  'cooling.coolantPressure': { id: 'cooling.coolantPressure', displayName: 'Coolant Pressure', aliases: ['coolantPressure', 'Coolant Pressure'], include: [/^coolant.*pressure$/i], exclude: [/raw/i, /minimum/i, /maximum/i, /limit/i, /sensor.*config/i] },
"""
s = s.replace(marker, roles + marker, 1)
p.write_text(s)

# Specialized workspace definitions.
p = Path('apps/web/src/state/built-in-workspace-templates.ts')
s = p.read_text()
marker = 'export const STARTER_WORKSPACE_TEMPLATES: readonly StarterWorkspaceTemplate[] = Object.freeze(['
assert marker in s
defs = """export const EPICEFI_INJECTOR_IGNITION_TIMING_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
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

"""
s = s.replace(marker, defs + marker, 1)
old = "  EPICEFI_DUAL_CHAMBER_BOOST_DUAL_WORKSPACE,\n  EPICEFI_TRIGGER_SYNC_DETAILED_DUAL_WORKSPACE,\n]);"
new = "  EPICEFI_DUAL_CHAMBER_BOOST_DUAL_WORKSPACE,\n  EPICEFI_TRIGGER_SYNC_DETAILED_DUAL_WORKSPACE,\n  EPICEFI_INJECTOR_IGNITION_TIMING_DUAL_WORKSPACE,\n  EPICEFI_ENGINE_PROTECTION_DUAL_WORKSPACE,\n]);"
assert old in s
p.write_text(s.replace(old, new, 1))

# Keep the deliberate menu-order regression current.
p = Path('tests/web/built-in-workspace-templates.test.ts')
s = p.read_text()
old = "      'EpicEFI · Dual Chamber Boost', 'EpicEFI · Trigger + Sync Detailed',\n"
new = "      'EpicEFI · Dual Chamber Boost', 'EpicEFI · Trigger + Sync Detailed',\n      'EpicEFI · Injector + Ignition Timing', 'EpicEFI · Engine Protection',\n"
assert old in s
p.write_text(s.replace(old, new, 1))

# Focused capability, mapping and negative-lookalike tests.
Path('tests/web/epicefi-injector-ignition-protection-starters.test.ts').write_text("""import { describe, expect, it } from 'vitest';
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
""")
