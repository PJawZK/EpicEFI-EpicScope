from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)

# 1. Expose the portable generic starter set explicitly.
path = Path('apps/web/src/state/built-in-workspace-templates.ts')
text = path.read_text()
anchor = """export const STARTER_WORKSPACE_TEMPLATES: readonly StarterWorkspaceTemplate[] = Object.freeze([\n  GENERAL_SINGLE_WORKSPACE,\n  IDLE_DUAL_WORKSPACE,\n  BOOST_DUAL_WORKSPACE,\n  FUEL_DUAL_WORKSPACE,\n  IGNITION_DUAL_WORKSPACE,\n  COOLING_DUAL_WORKSPACE,\n  TRANSIENT_AE_DUAL_WORKSPACE,\n  FUEL_SYSTEM_DUAL_WORKSPACE,\n  TRIGGER_SYNC_DUAL_WORKSPACE,\n  STARTUP_WARMUP_DUAL_WORKSPACE,\n  ELECTRICAL_DUAL_WORKSPACE,\n  VEHICLE_DRIVELINE_DUAL_WORKSPACE,\n  EPICEFI_MAP_PREDICT_WALL_WETTING_DUAL_WORKSPACE,\n  EPICEFI_FUEL_RAIL_DIAGNOSTICS_DUAL_WORKSPACE,\n  EPICEFI_ETB_CONTROL_DUAL_WORKSPACE,\n  EPICEFI_DUAL_CHAMBER_BOOST_DUAL_WORKSPACE,\n  EPICEFI_TRIGGER_SYNC_DETAILED_DUAL_WORKSPACE,\n  EPICEFI_INJECTOR_IGNITION_TIMING_DUAL_WORKSPACE,\n  EPICEFI_ENGINE_PROTECTION_DUAL_WORKSPACE,\n  EPICEFI_VVT_CONTROL_DUAL_WORKSPACE,\n  EPICEFI_ANTI_LAG_DUAL_WORKSPACE,\n  EPICEFI_LAUNCH_CONTROL_DUAL_WORKSPACE,\n  EPICEFI_TRACTION_CONTROL_DUAL_WORKSPACE,\n  EPICEFI_TRANSMISSION_CONTROL_DUAL_WORKSPACE,\n]);\n"""
replacement = anchor + """\n/** Portable starter set used only to seed a brand-new Logger workspace collection. */\nexport const GENERIC_STARTER_WORKSPACE_TEMPLATES: readonly StarterWorkspaceTemplate[] = Object.freeze(\n  STARTER_WORKSPACE_TEMPLATES.filter((template) => template.tier !== 'epicefi' && !template.developmentOnly),\n);\n"""
text = replace_once(text, anchor, replacement, 'generic starter export')
path.write_text(text)

# 2. Seed a fresh install with all portable generic workspaces, but never re-seed restored state.
path = Path('apps/web/src/pages/logger-page.ts')
text = path.read_text()
text = replace_once(
    text,
    """  availableStarterWorkspaceTemplates,\n  resolveStarterWorkspaceTemplate,\n  starterWorkspaceTemplate,\n  SINGLE_RESOLVER_TEST_WORKSPACE,\n""",
    """  availableStarterWorkspaceTemplates,\n  GENERIC_STARTER_WORKSPACE_TEMPLATES,\n  resolveStarterWorkspaceTemplate,\n  starterWorkspaceTemplate,\n  SINGLE_RESOLVER_TEST_WORKSPACE,\n""",
    'logger starter import',
)
old_materializer = """  const materializeInitialStarterWorkspace = (\n    channels: readonly ChannelDefinition[],\n    refreshSelector = true,\n  ): void => {\n    if (starterWorkspaceMaterialized || channels.length === 0) return;\n    const workspace = workspaces.find((candidate) => candidate.id === SINGLE_RESOLVER_RUNTIME_ID);\n    if (!workspace) return;\n\n    const resolution = resolveStarterWorkspaceTemplate(SINGLE_RESOLVER_TEST_WORKSPACE, channels);\n    const panes = createEmptyPaneStates();\n    for (const resolvedPane of resolution.panes) {\n      const pane = panes.find((candidate) => candidate.id === resolvedPane.id);\n      if (pane) pane.channelIds = [...resolvedPane.channelIds];\n    }\n    workspace.name = SINGLE_RESOLVER_TEST_WORKSPACE.name;\n    workspace.layout = SINGLE_RESOLVER_TEST_WORKSPACE.layout;\n    workspace.panes = panes;\n    if (!workspace.panes.some((pane) => pane.id === workspace.activePaneId)) {\n      workspace.activePaneId = workspace.panes[0]?.id ?? 'pane-1';\n    }\n    starterWorkspaceMaterialized = true;\n    if (refreshSelector) refreshWorkspaceSelector();\n  };\n"""
new_materializer = """  const materializeInitialStarterWorkspace = (\n    channels: readonly ChannelDefinition[],\n    refreshSelector = true,\n  ): void => {\n    if (starterWorkspaceMaterialized || channels.length === 0) return;\n\n    const seed = activeWorkspace();\n    const seededViewport = seed?.viewport ? { ...seed.viewport } : undefined;\n    const seededHistory = seed?.viewHistory.map((item) => ({ ...item })) ?? [];\n    const seededHistoryIndex = seed?.viewHistoryIndex ?? -1;\n    const seededCursorTimeMs = seed?.cursorTimeMs ?? timeline.getCursorTime();\n\n    workspaces = GENERIC_STARTER_WORKSPACE_TEMPLATES.map((template, index) => {\n      const workspace = createInitialWorkspace(`graph-${index + 1}`, template.name, template.layout);\n      const resolution = resolveStarterWorkspaceTemplate(template, channels);\n      for (const resolvedPane of resolution.panes) {\n        const pane = workspace.panes.find((candidate) => candidate.id === resolvedPane.id);\n        if (pane) pane.channelIds = [...resolvedPane.channelIds];\n      }\n      workspace.viewport = seededViewport ? { ...seededViewport } : undefined;\n      workspace.cursorTimeMs = seededCursorTimeMs;\n      workspace.viewHistory = seededHistory.map((item) => ({ ...item }));\n      workspace.viewHistoryIndex = seededHistoryIndex;\n      return workspace;\n    });\n\n    workspaceCounter = Math.max(workspaceCounter, workspaces.length);\n    activeWorkspaceId = workspaces[0]?.id ?? '';\n    starterWorkspaceMaterialized = true;\n    if (refreshSelector) refreshWorkspaceSelector();\n  };\n"""
text = replace_once(text, old_materializer, new_materializer, 'fresh generic materializer')
text = replace_once(
    text,
    "runtime.graph.setDisplayMode(workspace.layout === 'single' ? 'stacked' : 'overlay');",
    "runtime.graph.setDisplayMode('overlay');",
    'single graph display mode',
)
path.write_text(text)

# 3. Add regression coverage for the exact portable seed catalog.
path = Path('tests/web/built-in-workspace-templates.test.ts')
text = path.read_text()
text = replace_once(
    text,
    """  FUEL_SYSTEM_DUAL_WORKSPACE,\n  GENERAL_SINGLE_WORKSPACE,\n""",
    """  FUEL_SYSTEM_DUAL_WORKSPACE,\n  GENERAL_SINGLE_WORKSPACE,\n  GENERIC_STARTER_WORKSPACE_TEMPLATES,\n""",
    'generic starter test import',
)
marker = """  it('defines General as one pane with the agreed overview roles', () => {\n"""
new_test = """  it('exposes exactly the portable generic starters used to seed a fresh install', () => {\n    expect(GENERIC_STARTER_WORKSPACE_TEMPLATES.map((template) => template.name)).toEqual([\n      'General', 'Idle', 'Boost', 'Fuel', 'Ignition', 'Cooling', 'Transient / AE', 'Fuel System',\n      'Trigger / Sync', 'Startup / Warmup', 'Electrical', 'Vehicle / Driveline',\n    ]);\n    expect(GENERIC_STARTER_WORKSPACE_TEMPLATES.every((template) => template.tier !== 'epicefi')).toBe(true);\n  });\n\n""" + marker
text = replace_once(text, marker, new_test, 'generic starter seed test')
path.write_text(text)

# 4. Document fresh-install behavior and the single-pane presentation rule.
path = Path('docs/PREPOPULATED_WORKSPACES.md')
text = path.read_text()
anchor = """The planned generic starter catalog is now complete.\n"""
addition = """The planned generic starter catalog is now complete.\n\nOn a brand-new EpicScope workspace state, the full generic starter set is materialized automatically as ordinary editable `graph-*` workspaces as soon as the first channel schema/catalog is available. Existing/restored workspace state is never re-seeded, so deleting or customizing those defaults remains a user-owned choice. ECU-specific starters are not auto-created.\n\nThe **Single** layout uses the normal overlay readout presentation (channel names plus NOW / MIN / MAX context), matching the information model used by multi-pane graphs. The legacy stacked-lane canvas labels are not used for the Single starter view.\n"""
text = replace_once(text, anchor, addition, 'fresh install docs')
path.write_text(text)
