from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


def sub_once(text: str, pattern: str, repl: str, label: str) -> str:
    text2, count = re.subn(pattern, repl, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 regex match, found {count}")
    return text2

# Semantic roles: binary fan state, instant MAP, and prefer the actual wall-film mass correction.
path = Path('apps/web/src/state/semantic-channel-roles.ts')
text = path.read_text()
text = replace_once(text, "  | 'cooling.fanCommand'\n", "  | 'cooling.fanCommand'\n  | 'cooling.fanActive'\n", 'fan active union')
text = replace_once(text, "  | 'transient.effectiveMap'\n", "  | 'transient.effectiveMap'\n  | 'transient.instantMap'\n", 'instant map union')
fan_block = """  'cooling.fanCommand': {
    id: 'cooling.fanCommand',
    displayName: 'Fan Command',
    aliases: ['fan1Pwm', 'fan1m_state', 'Fan Command', 'Cooling Fan Duty', 'Radiator Fan Duty', 'Fan Duty'],
    include: [/fan.*(?:pwm|duty|command|state|on)/i],
    exclude: [/fan\\s*2/i, /frequency/i, /min/i, /max/i, /threshold/i, /temperature/i, /button/i, /broken/i, /inhibit/i],
  },
"""
fan_replacement = fan_block + """  'cooling.fanActive': {
    id: 'cooling.fanActive',
    displayName: 'Fan Active',
    aliases: ['fan1m_state', 'Fan Active', 'Fan 1 Active', 'Cooling Fan Active', 'Radiator Fan Active'],
    include: [/^fan1m_state$/i, /(?:cooling|radiator|fan\\s*1).*fan?.*(?:active|state|on)/i, /fan.*(?:active|state|on)/i],
    exclude: [/fan\\s*2/i, /pwm/i, /duty/i, /frequency/i, /enable/i, /enabled/i, /temperature/i, /threshold/i, /button/i, /broken/i, /inhibit/i, /trans/i],
  },
"""
text = replace_once(text, fan_block, fan_replacement, 'fan active role')
# Insert Instant MAP beside the existing EpicEFI MAP-prediction roles.
text = sub_once(
    text,
    r"(  'transient\.predictedMap': \{[^\n]+\n)",
    r"\1  'transient.instantMap': { id: 'transient.instantMap', displayName: 'Instant MAP', aliases: ['instantMAPValue', 'Instant MAP', 'Raw MAP Instant'], include: [/^instant.*map(?:.*value)?$/i], exclude: [/config/i, /table/i, /target/i, /error/i] },\n",
    'instant map role',
)
# Make the mass-domain wall correction win over the separate wall-wetting injection-time channel.
text = sub_once(
    text,
    r"  'transient\.wallFuelCorrection': \{\n    id: 'transient\.wallFuelCorrection',\n    displayName: 'Wall Fuel Correction',\n    aliases: \[[^\n]+\],\n    include: \[[^\n]+\],\n    exclude: \[[^\n]+\],\n  \},",
    """  'transient.wallFuelCorrection': {
    id: 'transient.wallFuelCorrection',
    displayName: 'Wall Fuel Correction',
    aliases: ['wallFuelCorrectionValue', 'Fuel: wall correction', 'Wall Fuel Correction', 'Wall Wetting Correction', 'wallFuelCorrection'],
    include: [/wall.*fuel.*correction/i, /wall.*wetting.*correction/i, /fuel.*wall.*correction/i],
    exclude: [/table/i, /tau/i, /beta/i, /amount/i],
  },""",
    'wall correction role',
)
path.write_text(text)

# Workspace content changes.
path = Path('apps/web/src/state/built-in-workspace-templates.ts')
text = path.read_text()
text = sub_once(text, r"export const BOOST_DUAL_WORKSPACE: StarterWorkspaceTemplate = \{.*?\n\};\n\nexport const FUEL_DUAL_WORKSPACE", """export const BOOST_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'boost-dual',
  name: 'Boost',
  description: 'Dual-pane boost response and engine-state overview without requiring closed-loop boost control or extra pressure sensors.',
  layout: 'dual',
  panes: [
    {
      id: 'pane-1',
      roles: [
        { roleId: 'engine.rpm', requirement: 'required' },
        { roleId: 'engine.map', requirement: 'required' },
        { roleId: 'engine.throttle.position', requirement: 'preferred' },
        { roleId: 'temperature.intakeAir', requirement: 'preferred' },
      ],
    },
    {
      id: 'pane-2',
      roles: [
        { roleId: 'ignition.advance', requirement: 'preferred' },
        { roleId: 'fuel.injectorPulseWidth', requirement: 'preferred' },
        { roleId: 'fuel.injectorDuty', requirement: 'preferred' },
        { roleId: 'electrical.batteryVoltage', requirement: 'optional' },
      ],
    },
  ],
};

export const FUEL_DUAL_WORKSPACE""", 'boost workspace')
text = sub_once(text, r"export const IGNITION_DUAL_WORKSPACE: StarterWorkspaceTemplate = \{.*?\n\};\n\nexport const COOLING_DUAL_WORKSPACE", """export const IGNITION_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'ignition-dual',
  name: 'Ignition',
  description: 'Dual-pane spark timing, coil-charge and engine-condition overview without requiring knock hardware.',
  layout: 'dual',
  panes: [
    {
      id: 'pane-1',
      roles: [
        { roleId: 'engine.rpm', requirement: 'required' },
        { roleId: 'engine.map', requirement: 'required' },
        { roleId: 'engine.throttle.position', requirement: 'preferred' },
        { roleId: 'ignition.advance', requirement: 'preferred' },
      ],
    },
    {
      id: 'pane-2',
      roles: [
        { roleId: 'ignition.dwell', requirement: 'preferred' },
        { roleId: 'electrical.batteryVoltage', requirement: 'preferred' },
        { roleId: 'temperature.intakeAir', requirement: 'optional' },
        { roleId: 'temperature.coolant', requirement: 'optional' },
      ],
    },
  ],
};

export const COOLING_DUAL_WORKSPACE""", 'ignition workspace')
# Cooling uses binary fan state and includes coolant pressure when available.
text = replace_once(text, "        { roleId: 'cooling.fanCommand', requirement: 'optional' },\n        { roleId: 'temperature.oil', requirement: 'optional' },\n        { roleId: 'engine.oilPressure', requirement: 'optional' },\n        { roleId: 'electrical.batteryVoltage', requirement: 'optional' },", "        { roleId: 'cooling.fanActive', requirement: 'optional' },\n        { roleId: 'temperature.oil', requirement: 'optional' },\n        { roleId: 'engine.oilPressure', requirement: 'optional' },\n        { roleId: 'cooling.coolantPressure', requirement: 'optional' },\n        { roleId: 'electrical.batteryVoltage', requirement: 'optional' },", 'cooling pane')
# Generic AE keeps its existing story but gains commanded mixture context.
text = replace_once(text, "        { roleId: 'fuel.lambda', requirement: 'preferred' },\n        { roleId: 'fuel.injectorPulseWidth', requirement: 'preferred' },\n        { roleId: 'transient.aeFuel', requirement: 'optional' },", "        { roleId: 'fuel.lambda', requirement: 'preferred' },\n        { roleId: 'fuel.lambdaTarget', requirement: 'optional' },\n        { roleId: 'fuel.injectorPulseWidth', requirement: 'preferred' },\n        { roleId: 'transient.aeFuel', requirement: 'optional' },", 'AE lambda target')
# Startup gets the actual resulting injector pulse width.
text = replace_once(text, "      { roleId: 'startup.warmupCorrection', requirement: 'preferred' },\n      { roleId: 'fuel.lambda', requirement: 'preferred' },\n      { roleId: 'idle.target', requirement: 'optional' },", "      { roleId: 'startup.warmupCorrection', requirement: 'preferred' },\n      { roleId: 'fuel.injectorPulseWidth', requirement: 'preferred' },\n      { roleId: 'fuel.lambda', requirement: 'preferred' },\n      { roleId: 'idle.target', requirement: 'optional' },", 'startup pulse width')
# Electrical gets binary fan state as a real load event rather than PWM-only duty.
text = replace_once(text, "      { roleId: 'fuel.pumpCommand', requirement: 'optional' },\n      { roleId: 'electrical.alternatorDuty', requirement: 'optional' },", "      { roleId: 'fuel.pumpCommand', requirement: 'optional' },\n      { roleId: 'cooling.fanActive', requirement: 'optional' },\n      { roleId: 'electrical.alternatorDuty', requirement: 'optional' },", 'electrical fan state')
# EpicEFI MAP/WW: remove generic AE trigger/state emphasis; compare the MAP signals directly and show wall-film mass/correction + fueling outcome.
text = sub_once(text, r"export const EPICEFI_MAP_PREDICT_WALL_WETTING_DUAL_WORKSPACE: StarterWorkspaceTemplate = \{.*?\n\};\n\nexport const EPICEFI_FUEL_RAIL_DIAGNOSTICS_DUAL_WORKSPACE", """export const EPICEFI_MAP_PREDICT_WALL_WETTING_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'epicefi-map-predict-wall-wetting-dual',
  name: 'EpicEFI · MAP Predict + Wall Wetting',
  description: 'EpicEFI live-MAP prediction and wall-film mass/correction diagnostics.',
  tier: 'epicefi',
  availability: {
    allOfRoleIds: [
      'transient.instantMap',
      'transient.predictedMap',
      'transient.effectiveMap',
      'transient.wallFuelAmount',
      'transient.wallFuelCorrection',
    ],
  },
  layout: 'dual',
  panes: [
    { id: 'pane-1', roles: [
      { roleId: 'engine.rpm', requirement: 'required' },
      { roleId: 'engine.throttle.position', requirement: 'preferred' },
      { roleId: 'engine.map', requirement: 'required' },
      { roleId: 'transient.instantMap', requirement: 'required' },
      { roleId: 'transient.predictedMap', requirement: 'required' },
      { roleId: 'transient.effectiveMap', requirement: 'required' },
    ] },
    { id: 'pane-2', roles: [
      { roleId: 'transient.wallFuelAmount', requirement: 'required' },
      { roleId: 'transient.wallFuelCorrection', requirement: 'required' },
      { roleId: 'fuel.injectorPulseWidth', requirement: 'preferred' },
      { roleId: 'fuel.lambda', requirement: 'preferred' },
      { roleId: 'fuel.lambdaTarget', requirement: 'optional' },
      { roleId: 'temperature.coolant', requirement: 'optional' },
    ] },
  ],
};

export const EPICEFI_FUEL_RAIL_DIAGNOSTICS_DUAL_WORKSPACE""", 'MAP WW workspace')
path.write_text(text)

# Update built-in workspace tests for the revised generic content.
path = Path('tests/web/built-in-workspace-templates.test.ts')
text = path.read_text()
text = sub_once(text, r"  it\('defines Boost as a portable two-pane starter'.*?\n  \}\);\n\n  it\('resolves Boost onto canonical EpicEFI INI identities'.*?\n  \}\);", """  it('defines Boost as a portable two-pane starter without closed-loop boost or extra-sensor assumptions', () => {
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
  });""", 'boost tests')
text = sub_once(text, r"  it\('resolves Ignition onto canonical EpicEFI INI identities'.*?\n  \}\);", """  it('resolves Ignition without requiring knock hardware', () => {
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
  });""", 'ignition test')
text = sub_once(text, r"  it\('resolves Cooling onto canonical EpicEFI INI identities'.*?\n  \}\);", """  it('resolves Cooling with binary fan state and optional coolant pressure', () => {
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
  });""", 'cooling test')
# Update Transient/AE resolver expectation for optional lambda target and mass-domain wall correction.
text = replace_once(text, "      channel('ini:lambdaValue', 'lambdaValue', 'Lambda'),\n      channel('ini:actualLastInjection', 'actualLastInjection', 'Fuel: Last inj pulse width'),", "      channel('ini:lambdaValue', 'lambdaValue', 'Lambda'),\n      channel('ini:targetLambda', 'targetLambda', 'Fuel: target lambda'),\n      channel('ini:actualLastInjection', 'actualLastInjection', 'Fuel: Last inj pulse width'),", 'AE test target channel')
text = replace_once(text, "      channel('ini:wallFuelCorrection', 'wallFuelCorrection', 'AE: wall correction extra'),", "      channel('ini:wallFuelCorrectionValue', 'wallFuelCorrectionValue', 'Fuel: wall correction'),", 'AE wall correction test channel')
text = replace_once(text, "      'ini:effectiveMap', 'ini:lambdaValue', 'ini:actualLastInjection', 'ini:tpsAccelFuel', 'ini:wallFuelCorrection',", "      'ini:effectiveMap', 'ini:lambdaValue', 'ini:targetLambda', 'ini:actualLastInjection', 'ini:tpsAccelFuel', 'ini:wallFuelCorrectionValue',", 'AE expected channels')
path.write_text(text)

# Rewrite the focused EpicEFI MAP/WW tests around the real model channels.
path = Path('tests/web/epicefi-capability-starters.test.ts')
path.write_text("""import { describe, expect, it } from 'vitest';
import type { ChannelDefinition } from '../../core/log-model/log-types';
import { EPICEFI_MAP_PREDICT_WALL_WETTING_DUAL_WORKSPACE, availableStarterWorkspaceTemplates, resolveStarterWorkspaceTemplate, starterWorkspaceAvailable } from '../../apps/web/src/state/built-in-workspace-templates';
import { resolveSemanticChannelRole } from '../../apps/web/src/state/semantic-channel-roles';
function channel(id: string, sourceName = id, displayName = sourceName): ChannelDefinition { return { id, sourceName, displayName, valueType: 'number' }; }
const capabilityChannels = [
  channel('ini:RPMValue','RPMValue','RPM'), channel('ini:TPSValue','TPSValue','TPS'), channel('ini:MAPValue','MAPValue','MAP'),
  channel('ini:instantMAPValue','instantMAPValue','Instant MAP'), channel('ini:fallbackMap','fallbackMap','fallbackMap'), channel('ini:effectiveMap','effectiveMap','Effective MAP'),
  channel('ini:wallFuelAmount','wallFuelAmount','Fuel: wall amount'), channel('ini:wallFuelCorrectionValue','wallFuelCorrectionValue','Fuel: wall correction'),
  channel('ini:wallFuelCorrection','wallFuelCorrection','fuel wallwetting injection time'),
  channel('ini:actualLastInjection','actualLastInjection','Fuel: Last inj pulse width'), channel('ini:lambdaValue','lambdaValue','Lambda'), channel('ini:targetLambda','targetLambda','Fuel: target lambda'), channel('ini:coolant','coolant','Coolant temp'),
];
describe('capability-gated EpicEFI starters', () => {
  it('keeps generic starters available while hiding EpicEFI-specific starters without capabilities', () => {
    const names=availableStarterWorkspaceTemplates([]).map((t)=>t.name); expect(names).toContain('General'); expect(names).toContain('Vehicle / Driveline'); expect(names).not.toContain('EpicEFI · MAP Predict + Wall Wetting');
  });
  it('offers MAP Predict + Wall Wetting only when its full model telemetry bundle resolves', () => {
    expect(starterWorkspaceAvailable(EPICEFI_MAP_PREDICT_WALL_WETTING_DUAL_WORKSPACE, capabilityChannels)).toBe(true);
    expect(availableStarterWorkspaceTemplates(capabilityChannels).map((t)=>t.name)).toContain('EpicEFI · MAP Predict + Wall Wetting');
    expect(starterWorkspaceAvailable(EPICEFI_MAP_PREDICT_WALL_WETTING_DUAL_WORKSPACE, capabilityChannels.filter((c)=>c.sourceName!=='instantMAPValue'))).toBe(false);
  });
  it('compares live, instant, predicted and effective MAP and uses the mass-domain wall correction', () => {
    const r=resolveStarterWorkspaceTemplate(EPICEFI_MAP_PREDICT_WALL_WETTING_DUAL_WORKSPACE, capabilityChannels);
    expect(r.panes[0]?.channelIds).toEqual(['ini:RPMValue','ini:TPSValue','ini:MAPValue','ini:instantMAPValue','ini:fallbackMap','ini:effectiveMap']);
    expect(r.panes[1]?.channelIds).toEqual(['ini:wallFuelAmount','ini:wallFuelCorrectionValue','ini:actualLastInjection','ini:lambdaValue','ini:targetLambda','ini:coolant']);
    expect(r.unresolvedRequiredRoleIds).toEqual([]);
    expect(resolveSemanticChannelRole('transient.wallFuelCorrection', capabilityChannels).channel?.id).toBe('ini:wallFuelCorrectionValue');
  });
  it('does not mistake MAP prediction or wall-wetting configuration for runtime capability', () => {
    const configOnly=[channel('mapPredictionBlendDuration','mapPredictionBlendDuration','Predictive MAP Blend Duration'),channel('useMapEstimateDuringTransient','useMapEstimateDuringTransient','Use MAP estimate during transient'),channel('wwaeTau','wwaeTau','Wall wetting tau'),channel('wwaeBeta','wwaeBeta','Wall wetting beta')];
    expect(resolveSemanticChannelRole('transient.instantMap',configOnly).channel).toBeUndefined();
    expect(resolveSemanticChannelRole('transient.predictedMap',configOnly).channel).toBeUndefined();
    expect(resolveSemanticChannelRole('transient.wallFuelAmount',configOnly).channel).toBeUndefined();
    expect(starterWorkspaceAvailable(EPICEFI_MAP_PREDICT_WALL_WETTING_DUAL_WORKSPACE,configOnly)).toBe(false);
  });
});
""")

# Add focused semantic regression coverage without deleting the old fan-command role.
path = Path('tests/web/semantic-channel-roles.test.ts')
text = path.read_text()
insert_before = "describe('semantic channel roles'"
# Existing file already has a describe; insert tests just before the final closing of that describe.
needle = "\n});\n"
idx = text.rfind(needle)
if idx < 0:
    raise SystemExit('semantic tests: final describe close not found')
extra = """

  it('resolves binary cooling fan activity independently from PWM fan command', () => {
    const channels = [
      channel('fan1m_state', 'fan1m_state', 'Fan 1 state'),
      channel('fan1Pwm', 'fan1Pwm', 'Fan 1 PWM'),
      channel('enableFan1', 'enableFan1', 'Enable Fan 1'),
    ];
    expect(resolveSemanticChannelRole('cooling.fanActive', channels).channel?.id).toBe('fan1m_state');
    expect(resolveSemanticChannelRole('cooling.fanCommand', channels).channel?.id).toBe('fan1Pwm');
  });

  it('resolves Instant MAP and prefers wallFuelCorrectionValue over injection-time telemetry', () => {
    const channels = [
      channel('instantMAPValue', 'instantMAPValue', 'Instant MAP'),
      channel('wallFuelCorrectionValue', 'wallFuelCorrectionValue', 'Fuel: wall correction'),
      channel('wallFuelCorrection', 'wallFuelCorrection', 'fuel wallwetting injection time'),
    ];
    expect(resolveSemanticChannelRole('transient.instantMap', channels).channel?.id).toBe('instantMAPValue');
    expect(resolveSemanticChannelRole('transient.wallFuelCorrection', channels).channel?.id).toBe('wallFuelCorrectionValue');
  });
"""
text = text[:idx] + extra + text[idx:]
path.write_text(text)

# Documentation: record the deliberate generic constraints and specialized MAP/WW focus.
path = Path('docs/PREPOPULATED_WORKSPACES.md')
text = path.read_text()
text += """\n\n## Channel-selection audit (2026-10-13)\n\nGeneric starters deliberately avoid optional controller strategies and uncommon hardware where a broadly available engine-state channel is more useful. In particular, generic **Boost** does not assume closed-loop boost control, wastegate command telemetry or EMAP; generic **Ignition** does not assume knock hardware; and **Cooling** uses binary fan-active state rather than requiring PWM fan control.\n\nThe EpicEFI **MAP Predict + Wall Wetting** starter is intentionally model-focused: live MAP, instant MAP, predicted/fallback MAP and effective MAP are compared directly, while wall-film amount and the mass-domain `wallFuelCorrectionValue` are paired with injector pulse width and mixture context. Generic TPS-AE trigger channels and simple prediction on/off state are not the focus of that specialized workspace.\n"""
path.write_text(text)
