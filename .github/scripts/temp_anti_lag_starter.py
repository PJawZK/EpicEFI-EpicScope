from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one anchor, found {count}: {old[:90]!r}')
    p.write_text(text.replace(old, new, 1))

roles_path = 'apps/web/src/state/semantic-channel-roles.ts'
templates_path = 'apps/web/src/state/built-in-workspace-templates.ts'
catalog_test_path = 'tests/web/built-in-workspace-templates.test.ts'
prepop_path = 'docs/PREPOPULATED_WORKSPACES.md'
coverage_path = 'docs/SPECIALIZED_WORKSPACE_COVERAGE.md'

replace_once(
    roles_path,
    "  | 'vvt.primary.dControl'\n  | 'cooling.coolantPressure';",
    "  | 'vvt.primary.dControl'\n"
    "  | 'als.triggered'\n"
    "  | 'als.conditionActive'\n"
    "  | 'als.latchActive'\n"
    "  | 'als.timedOut'\n"
    "  | 'als.timeRemaining'\n"
    "  | 'als.fuelCorrection'\n"
    "  | 'als.timingCorrection'\n"
    "  | 'als.sparkSkip'\n"
    "  | 'als.etbAirAdd'\n"
    "  | 'cooling.coolantPressure';",
)

role_anchor = "  'vvt.primary.dControl': { id: 'vvt.primary.dControl', displayName: 'VVT 1 D', aliases: ['vvtStatus1_dTerm', 'VVT 1 D Term'], include: [/^vvt.*status.*1.*d.*term$/i], exclude: [/config/i] },\n  'cooling.coolantPressure':"
role_insert = "  'vvt.primary.dControl': { id: 'vvt.primary.dControl', displayName: 'VVT 1 D', aliases: ['vvtStatus1_dTerm', 'VVT 1 D Term'], include: [/^vvt.*status.*1.*d.*term$/i], exclude: [/config/i] },\n" \
    "  'als.triggered': { id: 'als.triggered', displayName: 'ALS Triggered', aliases: ['antilagTriggered', 'Antilag triggered', 'Anti-Lag Triggered'], include: [/anti.?lag.*triggered/i, /^antilag.*triggered$/i], exclude: [/enable/i, /button/i, /mode/i, /config/i] },\n" \
    "  'als.conditionActive': { id: 'als.conditionActive', displayName: 'ALS Condition Active', aliases: ['isAntilagCondition', 'ALS Condition Active', 'Anti-Lag Condition Active'], include: [/^is.*antilag.*condition$/i, /(?:als|anti.?lag).*condition.*active/i], exclude: [/min/i, /max/i, /switch/i, /timer/i, /start/i, /end/i, /enable/i, /config/i] },\n" \
    "  'als.latchActive': { id: 'als.latchActive', displayName: 'ALS Latch Active', aliases: ['ALSLatchActive', 'ALS Latch Active'], include: [/als.*latch.*active/i], exclude: [/enable/i, /config/i] },\n" \
    "  'als.timedOut': { id: 'als.timedOut', displayName: 'ALS Timed Out', aliases: ['ALSTimedOut', 'ALS Timed Out'], include: [/als.*timed.*out/i], exclude: [/duration/i, /timeout.*setting/i, /config/i] },\n" \
    "  'als.timeRemaining': { id: 'als.timeRemaining', displayName: 'ALS Time Remaining', aliases: ['ALSTimeRemaining', 'ALS Time Remaining'], include: [/als.*time.*remaining/i], exclude: [/duration/i, /maximum/i, /max/i, /minimum/i, /min/i, /config/i] },\n" \
    "  'als.fuelCorrection': { id: 'als.fuelCorrection', displayName: 'ALS Fuel Correction', aliases: ['fuelALSCorrection', 'ALS Fuel Correction'], include: [/(?:als|anti.?lag).*fuel.*correction/i, /fuel.*als.*correction/i], exclude: [/table/i, /adjustment/i, /bin/i, /axis/i, /config/i] },\n" \
    "  'als.timingCorrection': { id: 'als.timingCorrection', displayName: 'ALS Timing Correction', aliases: ['timingALSCorrection', 'ALS Timing Correction'], include: [/(?:als|anti.?lag).*timing.*correction/i, /timing.*als.*correction/i], exclude: [/table/i, /retard.*table/i, /bin/i, /axis/i, /config/i] },\n" \
    "  'als.sparkSkip': { id: 'als.sparkSkip', displayName: 'ALS Spark Skip', aliases: ['ALSHardSparkSkip', 'ALS Hard Spark Skip', 'ALS Spark Skip'], include: [/als.*(?:hard.*)?spark.*skip/i], exclude: [/table/i, /ratio/i, /setting/i, /bin/i, /axis/i, /config/i] },\n" \
    "  'als.etbAirAdd': { id: 'als.etbAirAdd', displayName: 'ALS ETB Air Add', aliases: ['alsEtbAddValue', 'ALS ETB Air Add'], include: [/als.*etb.*(?:air.*)?add.*value/i, /anti.?lag.*etb.*air.*add/i], exclude: [/table/i, /position/i, /setting/i, /bin/i, /axis/i, /config/i] },\n" \
    "  'cooling.coolantPressure':"
replace_once(roles_path, role_anchor, role_insert)

template_anchor = "export const STARTER_WORKSPACE_TEMPLATES: readonly StarterWorkspaceTemplate[] = Object.freeze(["
template = "export const EPICEFI_ANTI_LAG_DUAL_WORKSPACE: StarterWorkspaceTemplate = {\n" \
    "  id: 'epicefi-anti-lag-dual',\n" \
    "  name: 'EpicEFI · Anti-Lag',\n" \
    "  description: 'EpicEFI anti-lag latch, timeout and actuator-correction diagnostics.',\n" \
    "  tier: 'epicefi',\n" \
    "  availability: { allOfRoleIds: ['als.conditionActive', 'als.latchActive', 'als.timeRemaining', 'als.fuelCorrection', 'als.timingCorrection'] },\n" \
    "  layout: 'dual',\n" \
    "  panes: [\n" \
    "    { id: 'pane-1', roles: [\n" \
    "      { roleId: 'engine.rpm', requirement: 'required' },\n" \
    "      { roleId: 'engine.map', requirement: 'preferred' },\n" \
    "      { roleId: 'engine.throttle.position', requirement: 'preferred' },\n" \
    "      { roleId: 'als.triggered', requirement: 'optional' },\n" \
    "      { roleId: 'als.conditionActive', requirement: 'required' },\n" \
    "      { roleId: 'als.latchActive', requirement: 'required' },\n" \
    "      { roleId: 'als.timedOut', requirement: 'preferred' },\n" \
    "      { roleId: 'als.timeRemaining', requirement: 'required' },\n" \
    "    ] },\n" \
    "    { id: 'pane-2', roles: [\n" \
    "      { roleId: 'als.fuelCorrection', requirement: 'required' },\n" \
    "      { roleId: 'als.timingCorrection', requirement: 'required' },\n" \
    "      { roleId: 'als.sparkSkip', requirement: 'preferred' },\n" \
    "      { roleId: 'als.etbAirAdd', requirement: 'optional' },\n" \
    "      { roleId: 'ignition.advance', requirement: 'preferred' },\n" \
    "    ] },\n" \
    "  ],\n" \
    "};\n\n"
replace_once(templates_path, template_anchor, template + template_anchor)
replace_once(
    templates_path,
    "  EPICEFI_VVT_CONTROL_DUAL_WORKSPACE,\n]);",
    "  EPICEFI_VVT_CONTROL_DUAL_WORKSPACE,\n  EPICEFI_ANTI_LAG_DUAL_WORKSPACE,\n]);",
)

replace_once(
    catalog_test_path,
    "      'EpicEFI · Injector + Ignition Timing', 'EpicEFI · Engine Protection', 'EpicEFI · VVT Control',\n",
    "      'EpicEFI · Injector + Ignition Timing', 'EpicEFI · Engine Protection', 'EpicEFI · VVT Control',\n      'EpicEFI · Anti-Lag',\n",
)

replace_once(
    prepop_path,
    "- **EpicEFI · VVT Control** — primary bank-1 intake cam target/actual tracking with controller output, error and PID contributions.\n",
    "- **EpicEFI · VVT Control** — primary bank-1 intake cam target/actual tracking with controller output, error and PID contributions;\n- **EpicEFI · Anti-Lag** — ALS latch/timeout state with fuel, ignition, spark-skip and ETB-air intervention diagnostics.\n",
)
replace_once(
    prepop_path,
    "Its current highest-value next candidates are **Anti-Lag**, **Launch Control**, **Traction Control** and **Transmission Control**.",
    "Its current highest-value next candidates are **Launch Control**, **Traction Control** and **Transmission Control**.",
)
replace_once(
    prepop_path,
    "The generic starter catalog is complete and eight capability-gated EpicEFI starters are merged.",
    "The generic starter catalog is complete and nine capability-gated EpicEFI starters are merged.",
)
replace_once(
    prepop_path,
    "1. implement **EpicEFI · Anti-Lag** next;\n2. then consider **Launch Control**, **Traction Control** and **Transmission Control** in that order, re-checking the user-visible gap after each addition;",
    "1. implement **EpicEFI · Launch Control** next;\n2. then consider **Traction Control** and **Transmission Control** in that order, re-checking the user-visible gap after each addition;",
)

replace_once(coverage_path, "Eight EpicEFI-specific starters are already implemented:", "Nine EpicEFI-specific starters are already implemented:")
replace_once(
    coverage_path,
    "- **EpicEFI · VVT Control**\n",
    "- **EpicEFI · VVT Control**\n- **EpicEFI · Anti-Lag**\n",
)
start = Path(coverage_path).read_text()
section_start = start.index('### 1. EpicEFI · Anti-Lag — highest priority')
section_end = start.index('### 2. EpicEFI · Launch Control — high priority')
anti_section = start[section_start:section_end]
start = start[:section_start] + start[section_end:]
start = start.replace('### 2. EpicEFI · Launch Control — high priority', '### 1. EpicEFI · Launch Control — highest priority', 1)
start = start.replace('### 3. EpicEFI · Traction Control — high priority', '### 2. EpicEFI · Traction Control — high priority', 1)
start = start.replace('### 4. EpicEFI · Transmission Control — strong, but lower immediate priority', '### 3. EpicEFI · Transmission Control — strong, but lower immediate priority', 1)
start = start.replace('1. EpicEFI · Anti-Lag\n2. EpicEFI · Launch Control\n3. EpicEFI · Traction Control\n4. EpicEFI · Transmission Control\n5. Staged Injection\n6. Closed-loop Fuel / STFT / LTFT', '1. EpicEFI · Launch Control\n2. EpicEFI · Traction Control\n3. EpicEFI · Transmission Control\n4. Staged Injection\n5. Closed-loop Fuel / STFT / LTFT', 1)
if anti_section not in start:
    pass
Path(coverage_path).write_text(start)

for path in [roles_path, templates_path, catalog_test_path, prepop_path, coverage_path]:
    if 'EpicEFI · Anti-Lag' not in Path(path).read_text() and path != roles_path:
        raise SystemExit(f'{path}: anti-lag marker missing after transform')

print('anti-lag starter transform complete')
