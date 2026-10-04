from pathlib import Path

logger = Path('apps/web/src/pages/logger-page.ts')
text = logger.read_text(encoding='utf-8')

old = """export interface LoggerPageController {
  readonly element: HTMLElement;"""
new = """export interface LoggerAnalysisTraceContext {
  readonly channel: ChannelDefinition;
  readonly range: NumericChannelRange;
  readonly complete: boolean;
  readonly color: string;
}

export interface LoggerAnalysisContext {
  readonly traces: readonly LoggerAnalysisTraceContext[];
  readonly aTimeMs: number | undefined;
  readonly bTimeMs: number | undefined;
}

export interface LoggerPageController {
  readonly element: HTMLElement;"""
if old not in text:
    raise SystemExit('logger analysis interface anchor not found')
text = text.replace(old, new, 1)

old = """  getWorkspaceState(): LoggerWorkspaceState;
  getRuntimeDiagnosticSnapshot(): LoggerRuntimeDiagnosticSnapshot;
  restoreWorkspaceState(state: LoggerWorkspaceState): Promise<void>;"""
new = """  getWorkspaceState(): LoggerWorkspaceState;
  getRuntimeDiagnosticSnapshot(): LoggerRuntimeDiagnosticSnapshot;
  getAnalysisContext(): LoggerAnalysisContext;
  restoreWorkspaceState(state: LoggerWorkspaceState): Promise<void>;"""
if old not in text:
    raise SystemExit('logger controller analysis anchor not found')
text = text.replace(old, new, 1)

old = """  const getRuntimeDiagnosticSnapshot = (): LoggerRuntimeDiagnosticSnapshot => {
    const workspace = activeWorkspace();"""
new = """  const getAnalysisContext = (): LoggerAnalysisContext => {
    const runtime = activePaneRuntime();
    const traces = runtime
      ? runtime.graph.getOverviewTraces().flatMap((trace) => {
          const channel = channelDefinitions.get(trace.channelId);
          if (!channel) return [];
          const statistics = runtime.graph.getChannelStatistics(trace.channelId);
          return [{
            channel,
            range: trace.range,
            complete: statistics?.full.complete ?? false,
            color: trace.color,
          }];
        })
      : [];
    return {
      traces,
      aTimeMs: analysisStartMs,
      bTimeMs: analysisEndMs,
    };
  };

  const getRuntimeDiagnosticSnapshot = (): LoggerRuntimeDiagnosticSnapshot => {
    const workspace = activeWorkspace();"""
if old not in text:
    raise SystemExit('logger get analysis anchor not found')
text = text.replace(old, new, 1)

old = """    getWorkspaceState,
    getRuntimeDiagnosticSnapshot,
    restoreWorkspaceState,"""
new = """    getWorkspaceState,
    getRuntimeDiagnosticSnapshot,
    getAnalysisContext,
    restoreWorkspaceState,"""
if old not in text:
    raise SystemExit('logger return analysis anchor not found')
text = text.replace(old, new, 1)
logger.write_text(text, encoding='utf-8')

app = Path('apps/web/src/app/app-shell.ts')
text = app.read_text(encoding='utf-8')

old = """import { createLoggerPage } from '../pages/logger-page';
import { createPerformanceDiagnostics } from '../components/performance-diagnostics';"""
new = """import { createLoggerPage } from '../pages/logger-page';
import { createHistogramPage } from '../pages/histogram-page';
import { createPerformanceDiagnostics } from '../components/performance-diagnostics';"""
if old not in text:
    raise SystemExit('app histogram import anchor not found')
text = text.replace(old, new, 1)

old = """  const loggerPage = createLoggerPage();
  const performanceDiagnostics = createPerformanceDiagnostics();"""
new = """  const loggerPage = createLoggerPage();
  const histogramPage = createHistogramPage();
  const performanceDiagnostics = createPerformanceDiagnostics();"""
if old not in text:
    raise SystemExit('app histogram create anchor not found')
text = text.replace(old, new, 1)

old = """          <button type=\"button\" class=\"global-module-choice global-module-choice--active\" role=\"menuitem\" aria-current=\"page\">
            <span>
              <strong>Logger</strong>
              <small>Recorded log viewing and navigation</small>
            </span>
            <span class=\"module-state\">Active</span>
          </button>"""
new = """          <button type=\"button\" class=\"global-module-choice global-module-choice--active\" data-epicscope-mode=\"logger\" role=\"menuitem\" aria-current=\"page\">
            <span>
              <strong>Logger</strong>
              <small>Recorded log viewing and navigation</small>
            </span>
            <span class=\"module-state\">Active</span>
          </button>"""
if old not in text:
    raise SystemExit('logger mode button anchor not found')
text = text.replace(old, new, 1)

old = """          <button type=\"button\" class=\"global-module-choice\" role=\"menuitem\" aria-disabled=\"true\" disabled>
            <span>
              <strong>Histogram</strong>
              <small>Distribution and binned analysis</small>
            </span>
            <span class=\"module-state\">Planned</span>
          </button>"""
new = """          <button type=\"button\" class=\"global-module-choice\" data-epicscope-mode=\"histogram\" role=\"menuitem\" aria-current=\"false\">
            <span>
              <strong>Histogram</strong>
              <small>Distribution and binned analysis</small>
            </span>
            <span class=\"module-state\">Available</span>
          </button>"""
if old not in text:
    raise SystemExit('histogram mode button anchor not found')
text = text.replace(old, new, 1)

old = """  const appStatus = footer.querySelector<HTMLElement>('.app-status');
  const parserStatus = footer.querySelector<HTMLElement>('.parser-status');"""
new = """  const appStatus = footer.querySelector<HTMLElement>('.app-status');
  const parserStatus = footer.querySelector<HTMLElement>('.parser-status');
  const modeChip = header.querySelector<HTMLElement>('.mode-chip');
  const modeChoices = [...header.querySelectorAll<HTMLButtonElement>('[data-epicscope-mode]')];"""
if old not in text:
    raise SystemExit('mode query anchor not found')
text = text.replace(old, new, 1)

old = """  if (!brandButton || !brandMenu || !loadDataButton || !loadDataMenu || !openButton || !loadIniButton || !loadedLog || !appStatus || !parserStatus || !settingsButton || !settingsPopover || !playbackSpeed || !samplePoints || !overviewTraces || !performanceVisible || !undoButton || !redoButton || !unloadIniButton || !iniStatus || !forgetWorkspaceButton || !persistenceStatus || !clearChannelCacheButton || !channelCacheStatus) {"""
new = """  if (!brandButton || !brandMenu || !loadDataButton || !loadDataMenu || !openButton || !loadIniButton || !loadedLog || !appStatus || !parserStatus || !modeChip || !settingsButton || !settingsPopover || !playbackSpeed || !samplePoints || !overviewTraces || !performanceVisible || !undoButton || !redoButton || !unloadIniButton || !iniStatus || !forgetWorkspaceButton || !persistenceStatus || !clearChannelCacheButton || !channelCacheStatus) {"""
if old not in text:
    raise SystemExit('mode structure check anchor not found')
text = text.replace(old, new, 1)

old = """  const closeBrandMenu = (): void => {
    brandMenu.hidden = true;
    brandButton.classList.remove('brand-button--open');
    brandButton.setAttribute('aria-expanded', 'false');
  };
"""
new = """  const closeBrandMenu = (): void => {
    brandMenu.hidden = true;
    brandButton.classList.remove('brand-button--open');
    brandButton.setAttribute('aria-expanded', 'false');
  };

  type EpicScopeMode = 'logger' | 'histogram';
  let activeMode: EpicScopeMode = 'logger';
  const setEpicScopeMode = (mode: EpicScopeMode): void => {
    activeMode = mode;
    const loggerActive = mode === 'logger';
    loggerPage.element.hidden = !loggerActive;
    histogramPage.element.hidden = loggerActive;
    graphSelectorSlot.hidden = !loggerActive;
    loggerToolsSlot.hidden = !loggerActive;
    undoButton.hidden = !loggerActive;
    redoButton.hidden = !loggerActive;
    modeChip.textContent = loggerActive ? 'RECORDED' : 'HISTOGRAM';

    for (const choice of modeChoices) {
      const choiceMode = choice.dataset.epicscopeMode;
      const selected = choiceMode === mode;
      choice.classList.toggle('global-module-choice--active', selected);
      choice.setAttribute('aria-current', selected ? 'page' : 'false');
      const state = choice.querySelector<HTMLElement>('.module-state');
      if (state) state.textContent = selected ? 'Active' : 'Available';
    }

    if (!loggerActive) {
      histogramPage.setContext(loggerPage.getAnalysisContext());
      histogramPage.refresh();
    }
    closeBrandMenu();
  };
"""
if old not in text:
    raise SystemExit('mode setter anchor not found')
text = text.replace(old, new, 1)

old = """  brandMenu.addEventListener('click', (event) => event.stopPropagation());"""
new = """  brandMenu.addEventListener('click', (event) => {
    event.stopPropagation();
    const target = event.target;
    if (!(target instanceof Element)) return;
    const choice = target.closest<HTMLButtonElement>('[data-epicscope-mode]');
    const mode = choice?.dataset.epicscopeMode;
    if (mode === 'logger' || mode === 'histogram') setEpicScopeMode(mode);
  });"""
if old not in text:
    raise SystemExit('brand menu mode anchor not found')
text = text.replace(old, new, 1)

old = """  openButton.addEventListener('click', () => {
    closeLoadDataMenu();
    fileInput.click();
  });"""
new = """  openButton.addEventListener('click', () => {
    closeLoadDataMenu();
    if (activeMode !== 'logger') setEpicScopeMode('logger');
    fileInput.click();
  });"""
if old not in text:
    raise SystemExit('open log mode anchor not found')
text = text.replace(old, new, 1)

old = """  app.append(header, loggerPage.element, footer, fileInput, iniInput, bugReportDialog);"""
new = """  app.append(header, loggerPage.element, histogramPage.element, footer, fileInput, iniInput, bugReportDialog);"""
if old not in text:
    raise SystemExit('app append histogram anchor not found')
text = text.replace(old, new, 1)

app.write_text(text, encoding='utf-8')
