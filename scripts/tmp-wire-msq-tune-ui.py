from pathlib import Path

analyzer = Path('apps/web/src/pages/analyzer-page.ts')
text = analyzer.read_text(encoding='utf-8')
text = text.replace(
"import type { SavedTimelineRangeState } from '../state/workspace-state';\nimport type { LoggerAnalysisContext, LoggerAnalysisTraceContext } from './logger-page';",
"import type { TuneModel } from '../../../../core/tune/tune-model';\nimport type { SavedTimelineRangeState } from '../state/workspace-state';\nimport type { LoggerAnalysisContext, LoggerAnalysisTraceContext } from './logger-page';\nimport { createTuneTableView } from './tune-table-view';",
1)
text = text.replace(
"  setContext(context: LoggerAnalysisContext): void;\n  refresh(): void;",
"  setContext(context: LoggerAnalysisContext): void;\n  setTuneModel(model: TuneModel | undefined, sourceName?: string): void;\n  refresh(): void;",
1)
text = text.replace(
"  let currentResult: NumericCompareResult | undefined;\n\n  const root = document.createElement('main');",
"  let currentResult: NumericCompareResult | undefined;\n  let currentView: 'compare' | 'tune-table' = 'compare';\n  const tuneTableView = createTuneTableView();\n\n  const root = document.createElement('main');",
1)
text = text.replace(
"      <div class=\"analyzer-controls\">",
"      <div class=\"analyzer-head-actions\">\n        <div class=\"analyzer-view-switch\" role=\"group\" aria-label=\"Analyzer view\">\n          <button type=\"button\" class=\"analyzer-view-choice analyzer-view-choice--active\" data-analyzer-view=\"compare\">Range Compare</button>\n          <button type=\"button\" class=\"analyzer-view-choice\" data-analyzer-view=\"tune-table\">Tune Table</button>\n        </div>\n        <div class=\"analyzer-controls\">",
1)
text = text.replace(
"        <button type=\"button\" class=\"analyzer-refresh\">Refresh</button>\n      </div>\n    </section>",
"        <button type=\"button\" class=\"analyzer-refresh\">Refresh</button>\n        </div>\n      </div>\n    </section>",
1)
anchor = "  `;\n\n  const channelSelect = root.querySelector<HTMLSelectElement>('.analyzer-channel');"
if anchor not in text:
    raise SystemExit('Analyzer root anchor not found')
text = text.replace(anchor, "  `;\n  root.append(tuneTableView.element);\n\n  const channelSelect = root.querySelector<HTMLSelectElement>('.analyzer-channel');", 1)
anchor = "  const tableBody = root.querySelector<HTMLTableSectionElement>('.analyzer-table tbody');\n  if (!channelSelect || !leftSelect || !rightSelect || !refreshButton || !empty || !content || !tableBody) {"
replace = "  const tableBody = root.querySelector<HTMLTableSectionElement>('.analyzer-table tbody');\n  const compareControls = root.querySelector<HTMLElement>('.analyzer-controls');\n  const heading = root.querySelector<HTMLElement>('.analyzer-head h1');\n  const description = root.querySelector<HTMLElement>('.analyzer-head p');\n  const viewChoices = [...root.querySelectorAll<HTMLButtonElement>('[data-analyzer-view]')];\n  if (!channelSelect || !leftSelect || !rightSelect || !refreshButton || !empty || !content || !tableBody || !compareControls || !heading || !description) {"
if anchor not in text:
    raise SystemExit('Analyzer selector anchor not found')
text = text.replace(anchor, replace, 1)
text = text.replace(
"  const render = (): void => {\n    const trace = selectedTrace();",
"  const render = (): void => {\n    if (currentView !== 'compare') return;\n    const trace = selectedTrace();",
1)
anchor = "  const setContext = (nextContext: LoggerAnalysisContext): void => {"
set_view = """  const setView = (view: 'compare' | 'tune-table'): void => {
    currentView = view;
    const compareActive = view === 'compare';
    compareControls.hidden = !compareActive;
    tuneTableView.element.hidden = compareActive;
    for (const choice of viewChoices) {
      const selected = choice.dataset.analyzerView === view;
      choice.classList.toggle('analyzer-view-choice--active', selected);
      choice.setAttribute('aria-pressed', String(selected));
    }
    heading.textContent = compareActive ? 'Saved range comparison' : 'Tune table correlation';
    description.textContent = compareActive
      ? 'Compare one active decoded channel across two saved Logger ranges.'
      : 'Map decoded operating points and observed values into an explicitly selected MSQ table.';
    if (compareActive) render();
    else {
      empty.hidden = true;
      content.hidden = true;
      tuneTableView.refresh();
    }
  };

"""
if anchor not in text:
    raise SystemExit('Analyzer setContext anchor not found')
text = text.replace(anchor, set_view + anchor, 1)
text = text.replace(
"    context = nextContext;\n    fillChannelSelect(previousChannel);",
"    context = nextContext;\n    tuneTableView.setContext(nextContext);\n    fillChannelSelect(previousChannel);",
1)
anchor = "  refreshButton.addEventListener('click', render);\n\n  return { element: root, setContext, refresh: render };"
replace = """  refreshButton.addEventListener('click', render);
  for (const choice of viewChoices) {
    choice.addEventListener('click', () => {
      const view = choice.dataset.analyzerView;
      if (view === 'compare' || view === 'tune-table') setView(view);
    });
  }

  return {
    element: root,
    setContext,
    setTuneModel: (model, sourceName) => tuneTableView.setTuneModel(model, sourceName),
    refresh: () => currentView === 'compare' ? render() : tuneTableView.refresh(),
  };"""
if anchor not in text:
    raise SystemExit('Analyzer return anchor not found')
text = text.replace(anchor, replace, 1)
analyzer.write_text(text, encoding='utf-8')

shell = Path('apps/web/src/app/app-shell.ts')
text = shell.read_text(encoding='utf-8')
text = text.replace(
"import { MlgFormatError } from '../../../../core/parsers/mlg/mlg-errors';",
"import { MlgFormatError } from '../../../../core/parsers/mlg/mlg-errors';\nimport { parseMsq } from '../../../../core/parsers/msq/msq-parser';\nimport { normalizeMsqTune, type TuneModel } from '../../../../core/tune/tune-model';",
1)
text = text.replace(
"          <button type=\"button\" class=\"load-ini source-load-button\" data-load-state=\"idle\" role=\"menuitem\">\n            <strong>Load INI…</strong><small>Firmware channel catalog</small>\n          </button>",
"          <button type=\"button\" class=\"load-ini source-load-button\" data-load-state=\"idle\" role=\"menuitem\">\n            <strong>Load INI…</strong><small>Firmware channel catalog</small>\n          </button>\n          <button type=\"button\" class=\"load-msq source-load-button\" data-load-state=\"idle\" role=\"menuitem\">\n            <strong>Load MSQ…</strong><small>Tune values and tables</small>\n          </button>",
1)
text = text.replace(
"  iniInput.setAttribute('aria-label', 'Load TunerStudio INI');\n\n  const brandButton",
"  iniInput.setAttribute('aria-label', 'Load TunerStudio INI');\n\n  const msqInput = document.createElement('input');\n  msqInput.type = 'file';\n  msqInput.accept = '.msq,.xml,text/xml,application/xml,text/plain';\n  msqInput.hidden = true;\n  msqInput.setAttribute('aria-label', 'Load TunerStudio MSQ');\n\n  const brandButton",
1)
text = text.replace(
"  const loadIniButton = header.querySelector<HTMLButtonElement>('.load-ini');",
"  const loadIniButton = header.querySelector<HTMLButtonElement>('.load-ini');\n  const loadMsqButton = header.querySelector<HTMLButtonElement>('.load-msq');",
1)
text = text.replace(
"  if (!brandButton || !brandMenu || !loadDataButton || !loadDataMenu || !openButton || !loadIniButton || !loadedLog",
"  if (!brandButton || !brandMenu || !loadDataButton || !loadDataMenu || !openButton || !loadIniButton || !loadMsqButton || !loadedLog",
1)
text = text.replace(
"  let activeIniBinding: BoundChannelCatalog | undefined;\n  let currentRawLog:",
"  let activeIniBinding: BoundChannelCatalog | undefined;\n  let activeTuneModel: TuneModel | undefined;\n  let activeTuneSourceName: string | undefined;\n  let currentRawLog:",
1)
text = text.replace(
"    if (analyzerActive) {\n      analyzerPage.setContext(loggerPage.getAnalysisContext());\n      analyzerPage.refresh();",
"    if (analyzerActive) {\n      analyzerPage.setContext(loggerPage.getAnalysisContext());\n      analyzerPage.setTuneModel(activeTuneModel, activeTuneSourceName);\n      analyzerPage.refresh();",
1)
text = text.replace(
"  loadIniButton.addEventListener('click', () => {\n    closeLoadDataMenu();\n    iniInput.click();\n  });",
"  loadIniButton.addEventListener('click', () => {\n    closeLoadDataMenu();\n    iniInput.click();\n  });\n  loadMsqButton.addEventListener('click', () => {\n    closeLoadDataMenu();\n    msqInput.click();\n  });",
1)
anchor = "  iniInput.addEventListener('change', () => {"
if anchor not in text:
    raise SystemExit('INI change anchor not found')
msq_handler = """  msqInput.addEventListener('change', () => {
    const file = msqInput.files?.item(0);
    msqInput.value = '';
    if (!file) return;

    loadMsqButton.disabled = true;
    setSourceLoadState(loadMsqButton, 'loading', `Loading ${file.name}`);
    appStatus.textContent = 'Loading MSQ…';
    parserStatus.textContent = 'TUNE-MSQ · reading local file';

    void file.text().then((source) => {
      const model = normalizeMsqTune(parseMsq(source));
      activeTuneModel = model;
      activeTuneSourceName = file.name;
      analyzerPage.setTuneModel(model, file.name);
      const tableCount = model.entries.filter((entry) => entry.kind === 'table').length;
      setSourceLoadState(loadMsqButton, 'success', `${file.name} · ${model.entries.length.toLocaleString()} tune entries · ${tableCount.toLocaleString()} table(s)`);
      appStatus.textContent = `${file.name} loaded · ${model.entries.length.toLocaleString()} tune entries`;
      parserStatus.textContent = `TUNE-MSQ · ${tableCount.toLocaleString()} table(s) · session only`;
      if (activeMode === 'analyzer') analyzerPage.refresh();
    }).catch((error: unknown) => {
      activeTuneModel = undefined;
      activeTuneSourceName = undefined;
      analyzerPage.setTuneModel(undefined);
      setSourceLoadState(loadMsqButton, 'issue', error instanceof Error ? error.message : 'MSQ load failed');
      appStatus.textContent = 'MSQ load failed';
      parserStatus.textContent = 'TUNE-MSQ · parser error';
    }).finally(() => {
      loadMsqButton.disabled = false;
    });
  });

"""
text = text.replace(anchor, msq_handler + anchor, 1)
text = text.replace(
"  app.append(header, loggerPage.element, analyzerPage.element, histogramPage.element, footer, fileInput, iniInput, bugReportDialog);",
"  app.append(header, loggerPage.element, analyzerPage.element, histogramPage.element, footer, fileInput, iniInput, msqInput, bugReportDialog);",
1)
shell.write_text(text, encoding='utf-8')
