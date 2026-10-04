from pathlib import Path

p = Path('apps/web/src/app/app-shell.ts')
s = p.read_text()
anchor = "import { createPerformanceDiagnostics } from '../components/performance-diagnostics';\n"
if anchor not in s:
    raise SystemExit('performance diagnostics import anchor missing')
s = s.replace(anchor, anchor + "import { evaluateBugReportHealth } from '../components/bug-report-health';\n", 1)
old = """    const snapshot = loggerPage.getRuntimeDiagnosticSnapshot();\n    const workspaceState = loggerPage.getWorkspaceState();\n    const issues: string[] = [];\n    const warnings: string[] = [];\n\n    if (currentRawLog && !snapshot.hasChannelDataSource) {\n      issues.push('Log is loaded but Logger has no channel data source.');\n    }\n    if (currentRawLog && snapshot.channelDefinitionCount === 0) {\n      issues.push('Log is loaded but Logger has zero channel definitions.');\n    }\n    if (\n      snapshot.renderableAssignedChannelCount > 0\n      && snapshot.activeTraceCount < snapshot.renderableAssignedChannelCount\n    ) {\n      issues.push(\n        `${snapshot.renderableAssignedChannelCount - snapshot.activeTraceCount} of `\n        + `${snapshot.renderableAssignedChannelCount} renderable channels assigned to visible panes are not active.`,\n      );\n    }\n    if (snapshot.unavailableAssignedChannelCount > 0) {\n      warnings.push(\n        `${snapshot.unavailableAssignedChannelCount} assigned visible-pane channel(s) are unavailable in the current log.`,\n      );\n    }\n    if (snapshot.activeTraceCount > snapshot.renderableAssignedChannelCount) {\n      warnings.push('Active trace count exceeds renderable assigned visible-channel count.');\n    }\n    if (runtimeErrors.length > 0) {\n      issues.push(`${runtimeErrors.length} runtime error/unhandled rejection event(s) captured.`);\n    }\n    if (currentRawLog && activeIniCatalog && !activeIniBinding) {\n      warnings.push('INI catalog and log are loaded but no current INI/MLG binding is recorded.');\n    }\n\n"""
new = """    const snapshot = loggerPage.getRuntimeDiagnosticSnapshot();\n    const workspaceState = loggerPage.getWorkspaceState();\n    const { issues, warnings } = evaluateBugReportHealth(snapshot, {\n      logLoaded: currentRawLog !== undefined,\n      iniLoaded: activeIniCatalog !== undefined,\n      bindingActive: activeIniBinding !== undefined,\n      runtimeErrorCount: runtimeErrors.length,\n    });\n\n"""
if old not in s:
    raise SystemExit('bug report health block not found')
p.write_text(s.replace(old, new, 1))
