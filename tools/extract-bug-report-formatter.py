from pathlib import Path

p = Path('apps/web/src/app/app-shell.ts')
s = p.read_text()

anchor = "import { evaluateBugReportHealth } from '../components/bug-report-health';\n"
if anchor not in s:
    raise SystemExit('bug report health import anchor missing')
s = s.replace(
    anchor,
    anchor + "import {\n  buildBugReportText,\n  type BugReportRuntimeErrorEntry,\n} from '../components/bug-report-formatter';\n",
    1,
)

old_type = """  interface RuntimeErrorEntry {\n    readonly time: number;\n    readonly kind: 'error' | 'unhandledrejection';\n    readonly message: string;\n    readonly source?: string;\n    readonly line?: number;\n    readonly column?: number;\n    readonly stack?: string;\n  }\n\n  const runtimeErrors: RuntimeErrorEntry[] = [];\n  const rememberRuntimeError = (entry: RuntimeErrorEntry): void => {\n"""
new_type = """  const runtimeErrors: BugReportRuntimeErrorEntry[] = [];\n  const rememberRuntimeError = (entry: BugReportRuntimeErrorEntry): void => {\n"""
if old_type not in s:
    raise SystemExit('runtime error type block not found')
s = s.replace(old_type, new_type, 1)

start = s.find("  const buildBugReport = (): { readonly text: string; readonly issueCount: number } => {\n")
end = s.find("  const refreshBugReport = (): void => {\n", start)
if start < 0 or end < 0:
    raise SystemExit('buildBugReport block anchors missing')

new_block = """  const buildBugReport = (): { readonly text: string; readonly issueCount: number } => {\n    const snapshot = loggerPage.getRuntimeDiagnosticSnapshot();\n    const workspaceState = loggerPage.getWorkspaceState();\n    const { issues, warnings } = evaluateBugReportHealth(snapshot, {\n      logLoaded: currentRawLog !== undefined,\n      iniLoaded: activeIniCatalog !== undefined,\n      bindingActive: activeIniBinding !== undefined,\n      runtimeErrorCount: runtimeErrors.length,\n    });\n    const source = currentRawLog?.summary.source;\n    const bindingMetrics = activeIniBinding?.metrics;\n\n    return buildBugReportText({\n      snapshot,\n      workspaceState,\n      issues,\n      warnings,\n      source: {\n        logLoaded: currentRawLog !== undefined,\n        ...(source ? {\n          logName: source.displayName,\n          logSizeBytes: source.sizeBytes,\n        } : {}),\n        recordCount: currentRawLog?.recordCount ?? 0,\n        logChannelCount: currentRawLog?.summary.channels.length ?? 0,\n        dataSourceSamples: currentRawLog?.channelData.sampleCount ?? 0,\n        iniLoaded: activeIniCatalog !== undefined,\n        ...(activeIniSourceName ? { iniSourceName: activeIniSourceName } : {}),\n        iniCatalogEntries: activeIniCatalog?.entries.length ?? 0,\n        bindingActive: activeIniBinding !== undefined,\n        ...(bindingMetrics ? {\n          bindingMetrics: {\n            boundChannelCount: bindingMetrics.boundChannelCount,\n            knownNoDataCount: bindingMetrics.knownNoDataCount,\n            logOnlyCount: bindingMetrics.logOnlyCount,\n            ambiguousLogChannelCount: bindingMetrics.ambiguousLogChannelCount,\n          },\n        } : {}),\n      },\n      runtimeErrors,\n      application: {\n        generatedAtIso: new Date().toISOString(),\n        url: location.href,\n        userAgent: navigator.userAgent,\n        viewportWidth: window.innerWidth,\n        viewportHeight: window.innerHeight,\n        devicePixelRatio: window.devicePixelRatio,\n        documentVisibility: document.visibilityState,\n        online: navigator.onLine,\n        ...(navigator.hardwareConcurrency ? { hardwareConcurrency: navigator.hardwareConcurrency } : {}),\n        appStatus: appStatus.textContent ?? '',\n        parserStatus: parserStatus.textContent ?? '',\n        openLogState: openButton.dataset.loadState ?? '—',\n        openLogTitle: openButton.title,\n        loadIniState: loadIniButton.dataset.loadState ?? '—',\n        loadIniTitle: loadIniButton.title,\n      },\n      performanceReport: performanceDiagnostics.reportText(),\n    });\n  };\n\n"""

s = s[:start] + new_block + s[end:]
p.write_text(s)
