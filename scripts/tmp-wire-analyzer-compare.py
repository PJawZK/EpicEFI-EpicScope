from pathlib import Path

logger = Path('apps/web/src/pages/logger-page.ts')
text = logger.read_text(encoding='utf-8')
old = """export interface LoggerAnalysisContext {\n  readonly traces: readonly LoggerAnalysisTraceContext[];\n  readonly aTimeMs: number | undefined;\n  readonly bTimeMs: number | undefined;\n}"""
new = """export interface LoggerAnalysisContext {\n  readonly traces: readonly LoggerAnalysisTraceContext[];\n  readonly aTimeMs: number | undefined;\n  readonly bTimeMs: number | undefined;\n  readonly savedRanges: readonly import('../state/workspace-state').SavedTimelineRangeState[];\n}"""
if old not in text:
    raise SystemExit('LoggerAnalysisContext anchor not found')
text = text.replace(old, new, 1)
old = """    return {\n      traces,\n      aTimeMs: analysisStartMs,\n      bTimeMs: analysisEndMs,\n    };"""
new = """    return {\n      traces,\n      aTimeMs: analysisStartMs,\n      bTimeMs: analysisEndMs,\n      savedRanges: timeline.getWorkspaceState().savedRanges.map((range) => ({ ...range })),\n    };"""
if old not in text:
    raise SystemExit('getAnalysisContext return anchor not found')
logger.write_text(text.replace(old, new, 1), encoding='utf-8')

shell = Path('apps/web/src/app/app-shell.ts')
text = shell.read_text(encoding='utf-8')
old = """import { createLoggerPage } from '../pages/logger-page';\nimport { createHistogramPage } from '../pages/histogram-page';"""
new = """import { createLoggerPage } from '../pages/logger-page';\nimport { createAnalyzerPage } from '../pages/analyzer-page';\nimport { createHistogramPage } from '../pages/histogram-page';"""
if old not in text:
    raise SystemExit('page import anchor not found')
text = text.replace(old, new, 1)
old = """  const loggerPage = createLoggerPage();\n  const histogramPage = createHistogramPage();"""
new = """  const loggerPage = createLoggerPage();\n  const analyzerPage = createAnalyzerPage();\n  const histogramPage = createHistogramPage();"""
if old not in text:
    raise SystemExit('page create anchor not found')
text = text.replace(old, new, 1)
old = """          <button type=\"button\" class=\"global-module-choice\" role=\"menuitem\" aria-disabled=\"true\" disabled>\n            <span>\n              <strong>Analyzer</strong>\n              <small>Range and channel analysis</small>\n            </span>\n            <span class=\"module-state\">Planned</span>\n          </button>"""
new = """          <button type=\"button\" class=\"global-module-choice\" data-epicscope-mode=\"analyzer\" role=\"menuitem\" aria-current=\"false\">\n            <span>\n              <strong>Analyzer</strong>\n              <small>Range comparison and channel analysis</small>\n            </span>\n            <span class=\"module-state\">Available</span>\n          </button>"""
if old not in text:
    raise SystemExit('Analyzer menu anchor not found')
text = text.replace(old, new, 1)
old = """  type EpicScopeMode = 'logger' | 'histogram';\n  let activeMode: EpicScopeMode = 'logger';\n  const setEpicScopeMode = (mode: EpicScopeMode): void => {\n    activeMode = mode;\n    const loggerActive = mode === 'logger';\n    loggerPage.element.hidden = !loggerActive;\n    histogramPage.element.hidden = loggerActive;\n    graphSelectorSlot.hidden = !loggerActive;\n    loggerToolsSlot.hidden = !loggerActive;\n    undoButton.hidden = !loggerActive;\n    redoButton.hidden = !loggerActive;\n    modeChip.textContent = loggerActive ? 'RECORDED' : 'HISTOGRAM';"""
new = """  type EpicScopeMode = 'logger' | 'analyzer' | 'histogram';\n  let activeMode: EpicScopeMode = 'logger';\n  const setEpicScopeMode = (mode: EpicScopeMode): void => {\n    activeMode = mode;\n    const loggerActive = mode === 'logger';\n    const analyzerActive = mode === 'analyzer';\n    const histogramActive = mode === 'histogram';\n    loggerPage.element.hidden = !loggerActive;\n    analyzerPage.element.hidden = !analyzerActive;\n    histogramPage.element.hidden = !histogramActive;\n    graphSelectorSlot.hidden = !loggerActive;\n    loggerToolsSlot.hidden = !loggerActive;\n    undoButton.hidden = !loggerActive;\n    redoButton.hidden = !loggerActive;\n    modeChip.textContent = loggerActive ? 'RECORDED' : analyzerActive ? 'ANALYZER' : 'HISTOGRAM';"""
if old not in text:
    raise SystemExit('mode block anchor not found')
text = text.replace(old, new, 1)
old = """    if (!loggerActive) {\n      histogramPage.setContext(loggerPage.getAnalysisContext());\n      histogramPage.refresh();\n    }\n    closeBrandMenu();"""
new = """    if (analyzerActive) {\n      analyzerPage.setContext(loggerPage.getAnalysisContext());\n      analyzerPage.refresh();\n    } else if (histogramActive) {\n      histogramPage.setContext(loggerPage.getAnalysisContext());\n      histogramPage.refresh();\n    }\n    closeBrandMenu();"""
if old not in text:
    raise SystemExit('mode refresh anchor not found')
text = text.replace(old, new, 1)
old = """    if (mode === 'logger' || mode === 'histogram') setEpicScopeMode(mode);"""
new = """    if (mode === 'logger' || mode === 'analyzer' || mode === 'histogram') setEpicScopeMode(mode);"""
if old not in text:
    raise SystemExit('mode handler anchor not found')
text = text.replace(old, new, 1)
old = """  app.append(header, loggerPage.element, histogramPage.element, footer, fileInput, iniInput, bugReportDialog);"""
new = """  app.append(header, loggerPage.element, analyzerPage.element, histogramPage.element, footer, fileInput, iniInput, bugReportDialog);"""
if old not in text:
    raise SystemExit('app append anchor not found')
shell.write_text(text.replace(old, new, 1), encoding='utf-8')
