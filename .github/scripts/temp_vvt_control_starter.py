from pathlib import Path

# Semantic roles
p = Path('apps/web/src/state/semantic-channel-roles.ts')
s = p.read_text()
anchor = "  | 'cooling.coolantPressure';"
assert anchor in s
s = s.replace(anchor, """  | 'vvt.primary.actual'
  | 'vvt.primary.target'
  | 'vvt.primary.output'
  | 'vvt.primary.error'
  | 'vvt.primary.pControl'
  | 'vvt.primary.iControl'
  | 'vvt.primary.dControl'
  | 'cooling.coolantPressure';""", 1)

anchor = "  'cooling.coolantPressure': { id: 'cooling.coolantPressure', displayName: 'Coolant Pressure', aliases: ['coolantPressure', 'Coolant Pressure'], include: [/^coolant.*pressure$/i], exclude: [/raw/i, /minimum/i, /maximum/i, /limit/i, /sensor.*config/i] },"
assert anchor in s
roles = """  'vvt.primary.actual': { id: 'vvt.primary.actual', displayName: 'VVT 1 Actual', aliases: ['vvtPositionB1I', 'VVT 1 in actual', 'VVT 1 Actual', 'Bank 1 Intake VVT Actual'], include: [/^vvt.*(?:1|bank\\s*1).*intake.*actual$/i, /^vvt.*position.*b1i$/i], exclude: [/target/i, /table/i, /channel/i, /config/i] },
  'vvt.primary.target': { id: 'vvt.primary.target', displayName: 'VVT 1 Target', aliases: ['vvtTargets1', 'VVT 1 in target', 'VVT 1 Target', 'Bank 1 Intake VVT Target'], include: [/^vvt.*(?:target|targets).*1$/i, /^vvt.*(?:1|bank\\s*1).*intake.*target$/i], exclude: [/table/i, /blend/i, /config/i] },
  'vvt.primary.output': { id: 'vvt.primary.output', displayName: 'VVT 1 Output', aliases: ['vvtStatus1_output', 'VVT 1 Output'], include: [/^vvt.*status.*1.*output$/i, /^vvt.*1.*output$/i], exclude: [/table/i, /pin/i, /channel/i, /config/i] },
  'vvt.primary.error': { id: 'vvt.primary.error', displayName: 'VVT 1 Error', aliases: ['vvtStatus1_error', 'VVT 1 Error'], include: [/^vvt.*status.*1.*error$/i, /^vvt.*1.*error$/i], exclude: [/counter/i, /code/i, /config/i] },
  'vvt.primary.pControl': { id: 'vvt.primary.pControl', displayName: 'VVT 1 P', aliases: ['vvtStatus1_pTerm', 'VVT 1 P Term'], include: [/^vvt.*status.*1.*p.*term$/i], exclude: [/config/i] },
  'vvt.primary.iControl': { id: 'vvt.primary.iControl', displayName: 'VVT 1 I', aliases: ['vvtStatus1_iTerm', 'VVT 1 I Term'], include: [/^vvt.*status.*1.*i.*term$/i], exclude: [/config/i] },
  'vvt.primary.dControl': { id: 'vvt.primary.dControl', displayName: 'VVT 1 D', aliases: ['vvtStatus1_dTerm', 'VVT 1 D Term'], include: [/^vvt.*status.*1.*d.*term$/i], exclude: [/config/i] },
"""
s = s.replace(anchor, roles + anchor, 1)
p.write_text(s)

# Starter template and catalog
p = Path('apps/web/src/state/built-in-workspace-templates.ts')
s = p.read_text()
anchor = 'export const STARTER_WORKSPACE_TEMPLATES: readonly StarterWorkspaceTemplate[] = Object.freeze(['
assert anchor in s
vvt = """export const EPICEFI_VVT_CONTROL_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'epicefi-vvt-control-dual',
  name: 'EpicEFI · VVT Control',
  description: 'EpicEFI primary bank-1 intake VVT target, position and controller diagnostics.',
  tier: 'epicefi',
  availability: { allOfRoleIds: ['vvt.primary.actual', 'vvt.primary.target', 'vvt.primary.output', 'vvt.primary.error'] },
  layout: 'dual',
  panes: [
    { id: 'pane-1', roles: [
      { roleId: 'engine.rpm', requirement: 'required' },
      { roleId: 'vvt.primary.actual', requirement: 'required' },
      { roleId: 'vvt.primary.target', requirement: 'required' },
      { roleId: 'vvt.primary.error', requirement: 'required' },
      { roleId: 'engine.map', requirement: 'preferred' },
    ] },
    { id: 'pane-2', roles: [
      { roleId: 'vvt.primary.output', requirement: 'required' },
      { roleId: 'vvt.primary.pControl', requirement: 'preferred' },
      { roleId: 'vvt.primary.iControl', requirement: 'preferred' },
      { roleId: 'vvt.primary.dControl', requirement: 'optional' },
      { roleId: 'electrical.batteryVoltage', requirement: 'optional' },
    ] },
  ],
};

"""
s = s.replace(anchor, vvt + anchor, 1)
anchor = "  EPICEFI_ENGINE_PROTECTION_DUAL_WORKSPACE,\n]);"
assert anchor in s
s = s.replace(anchor, "  EPICEFI_ENGINE_PROTECTION_DUAL_WORKSPACE,\n  EPICEFI_VVT_CONTROL_DUAL_WORKSPACE,\n]);", 1)
p.write_text(s)

# Existing exact catalog-order test
p = Path('tests/web/built-in-workspace-templates.test.ts')
s = p.read_text()
anchor = "      'EpicEFI · Injector + Ignition Timing', 'EpicEFI · Engine Protection',\n"
assert anchor in s
s = s.replace(anchor, "      'EpicEFI · Injector + Ignition Timing', 'EpicEFI · Engine Protection', 'EpicEFI · VVT Control',\n", 1)
p.write_text(s)

# Coverage docs
p = Path('docs/PREPOPULATED_WORKSPACES.md')
s = p.read_text()
anchor = "- **EpicEFI · Engine Protection** — dynamic rev-limit, cut-reason and protection-state diagnostics.\n"
assert anchor in s
s = s.replace(anchor, anchor + "- **EpicEFI · VVT Control** — primary bank-1 intake cam target/actual tracking with controller output, error and PID contributions.\n", 1)
s = s.replace('seven capability-gated EpicEFI starters are merged', 'eight capability-gated EpicEFI starters are merged')
s = s.replace('Its current highest-value next candidates are **VVT Control**, **Anti-Lag**, **Launch Control**, **Traction Control** and **Transmission Control**.', 'Its current highest-value next candidates are **Anti-Lag**, **Launch Control**, **Traction Control** and **Transmission Control**.')
s = s.replace('1. implement **EpicEFI · VVT Control** first;\n2. then consider **Anti-Lag**, **Launch Control**, **Traction Control** and **Transmission Control** in that order, re-checking the user-visible gap after each addition;', '1. implement **EpicEFI · Anti-Lag** next;\n2. then consider **Launch Control**, **Traction Control** and **Transmission Control** in that order, re-checking the user-visible gap after each addition;')
p.write_text(s)

p = Path('docs/SPECIALIZED_WORKSPACE_COVERAGE.md')
s = p.read_text()
s = s.replace('Seven EpicEFI-specific starters are already implemented:', 'Eight EpicEFI-specific starters are already implemented:')
anchor = '- **EpicEFI · Engine Protection**\n'
assert anchor in s
s = s.replace(anchor, anchor + '- **EpicEFI · VVT Control**\n', 1)
start = s.index('### 1. EpicEFI · VVT Control — highest priority')
end = s.index('### 2. EpicEFI · Anti-Lag — high priority', start)
s = s[:start] + s[end:].replace('### 2. EpicEFI · Anti-Lag — high priority', '### 1. EpicEFI · Anti-Lag — highest priority', 1).replace('### 3. EpicEFI · Launch Control — high priority', '### 2. EpicEFI · Launch Control — high priority', 1).replace('### 4. EpicEFI · Traction Control — high priority', '### 3. EpicEFI · Traction Control — high priority', 1).replace('### 5. EpicEFI · Transmission Control — strong, but lower immediate priority', '### 4. EpicEFI · Transmission Control — strong, but lower immediate priority', 1)
s = s.replace('1. EpicEFI · VVT Control\n2. EpicEFI · Anti-Lag\n3. EpicEFI · Launch Control\n4. EpicEFI · Traction Control\n5. EpicEFI · Transmission Control\n6. Staged Injection\n7. Closed-loop Fuel / STFT / LTFT', '1. EpicEFI · Anti-Lag\n2. EpicEFI · Launch Control\n3. EpicEFI · Traction Control\n4. EpicEFI · Transmission Control\n5. Staged Injection\n6. Closed-loop Fuel / STFT / LTFT')
p.write_text(s)

p = Path('docs/HANDOFF.md')
s = p.read_text()
s = s.replace('seven capability-gated EpicEFI specialized starters are merged', 'eight capability-gated EpicEFI specialized starters are merged')
s = s.replace('The next evidence-ranked candidate is **EpicEFI · VVT Control**; see `docs/SPECIALIZED_WORKSPACE_COVERAGE.md`.', 'The next evidence-ranked candidate is **EpicEFI · Anti-Lag**; see `docs/SPECIALIZED_WORKSPACE_COVERAGE.md`.')
s = s.replace('twelve generic starter templates plus seven capability-gated EpicEFI specialized starters;', 'twelve generic starter templates plus eight capability-gated EpicEFI specialized starters;')
s = s.replace('1. follow `docs/SPECIALIZED_WORKSPACE_COVERAGE.md` and implement **EpicEFI · VVT Control** as the next specialized starter;\n2. keep capability gating based on live runtime bundles and retain negative tests against configuration-only lookalikes;\n3. after VVT, re-evaluate Anti-Lag, Launch Control, Traction Control and Transmission Control in that evidence-ranked order;', '1. follow `docs/SPECIALIZED_WORKSPACE_COVERAGE.md` and implement **EpicEFI · Anti-Lag** as the next specialized starter;\n2. keep capability gating based on live runtime bundles and retain negative tests against configuration-only lookalikes;\n3. after Anti-Lag, re-evaluate Launch Control, Traction Control and Transmission Control in that evidence-ranked order;')
p.write_text(s)
