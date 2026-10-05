from pathlib import Path
import re


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding='utf-8')
    if text.count(old) != 1:
        raise SystemExit(f'{path}: expected exactly one match, found {text.count(old)} for {old[:80]!r}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


def replace_between(path: Path, start: str, end: str, replacement: str) -> None:
    text = path.read_text(encoding='utf-8')
    a = text.find(start)
    if a < 0:
        raise SystemExit(f'{path}: start marker missing: {start!r}')
    b = text.find(end, a)
    if b < 0:
        raise SystemExit(f'{path}: end marker missing: {end!r}')
    path.write_text(text[:a] + replacement + text[b:], encoding='utf-8')


# 1. Explicit Table Generator axes use tune-table edge clamping, while generic
# heatmap behavior remains unchanged unless explicitly requested.
heatmap = Path('core/analysis/heatmap.ts')
replace_once(
    heatmap,
    "  readonly yAxisValues?: readonly number[];\n  /** Cell statistic. Defaults to sample count/density. */",
    "  readonly yAxisValues?: readonly number[];\n  /** Clamp values beyond explicit-axis midpoint bounds into the nearest edge cell. */\n  readonly clampExplicitAxisEdges?: boolean;\n  /** Cell statistic. Defaults to sample count/density. */",
)
replace_once(
    heatmap,
    "  const explicitYAxisValues = normalizedAxisValues(options.yAxisValues, 'y');\n  const scan = scanPairs(xRange, yRange, options.sampleIndices);",
    "  const explicitYAxisValues = normalizedAxisValues(options.yAxisValues, 'y');\n  const clampXAxisEdges = options.clampExplicitAxisEdges === true && explicitXAxisValues !== undefined;\n  const clampYAxisEdges = options.clampExplicitAxisEdges === true && explicitYAxisValues !== undefined;\n  const scan = scanPairs(xRange, yRange, options.sampleIndices);",
)
replace_once(
    heatmap,
    "function binIndexForBins(value: number, bins: readonly NumericHeatmapAxisBin[]): number | undefined {\n  for (let index = 0; index < bins.length; index += 1) {",
    "function binIndexForBins(\n  value: number,\n  bins: readonly NumericHeatmapAxisBin[],\n  clampEdges = false,\n): number | undefined {\n  if (bins.length === 0) return undefined;\n  if (clampEdges && value < bins[0]!.lowerBound) return 0;\n  if (clampEdges && value > bins[bins.length - 1]!.upperBound) return bins.length - 1;\n  for (let index = 0; index < bins.length; index += 1) {",
)
replace_once(
    heatmap,
    "    const xBelow = pair.x < xRangeMin;\n    const xAbove = pair.x > xRangeMax;\n    const yBelow = pair.y < yRangeMin;\n    const yAbove = pair.y > yRangeMax;",
    "    const xBelow = !clampXAxisEdges && pair.x < xRangeMin;\n    const xAbove = !clampXAxisEdges && pair.x > xRangeMax;\n    const yBelow = !clampYAxisEdges && pair.y < yRangeMin;\n    const yAbove = !clampYAxisEdges && pair.y > yRangeMax;",
)
replace_once(
    heatmap,
    "    const xIndex = binIndexForBins(pair.x, xAxis.bins);\n    const yIndex = binIndexForBins(pair.y, yAxis.bins);",
    "    const xIndex = binIndexForBins(pair.x, xAxis.bins, clampXAxisEdges);\n    const yIndex = binIndexForBins(pair.y, yAxis.bins, clampYAxisEdges);",
)

test = Path('tests/analysis/heatmap.test.ts')
replace_once(
    test,
    "  it('rejects duplicate explicit axis centers', () => {",
    "  it('can clamp samples beyond explicit table axes into the nearest edge cells', () => {\n    const result = buildNumericHeatmap(\n      range(0, [0, 1000, 2000, 8000]),\n      range(0, [0, 50, 100, 500]),\n      {\n        xAxisValues: [1000, 2000],\n        yAxisValues: [50, 100],\n        clampExplicitAxisEdges: true,\n      },\n    );\n\n    expect(result.binnedSampleCount).toBe(4);\n    expect(result.outsideRangeSampleCount).toBe(0);\n    expect(result.xBelowRangeSampleCount).toBe(0);\n    expect(result.xAboveRangeSampleCount).toBe(0);\n    expect(result.yBelowRangeSampleCount).toBe(0);\n    expect(result.yAboveRangeSampleCount).toBe(0);\n    expect([...result.counts]).toEqual([2, 0, 0, 2]);\n  });\n\n  it('rejects duplicate explicit axis centers', () => {",
)

# 2. Histogram mode: Table Generator selector in global header, remove redundant
# Heatmap/Dual Heatmap, and add the dedicated Math Channels page.
hist = Path('apps/web/src/pages/histogram-page.ts')
replace_once(
    hist,
    "import { createHeatmapView } from './heatmap-view';\nimport { createDualHeatmapView } from './dual-heatmap-view';\nimport { createScatterView } from './scatter-view';",
    "import { createScatterView } from './scatter-view';\nimport { createHistogramMathChannelsView } from './histogram-math-channels-view';",
)
replace_once(
    hist,
    "export interface HistogramPageController {\n  readonly element: HTMLElement;",
    "export interface HistogramPageController {\n  readonly element: HTMLElement;\n  readonly headerControl: HTMLElement;",
)
replace_once(
    hist,
    "type HistogramView = 'table' | 'distribution' | 'heatmap' | 'dual-heatmap' | 'scatter';",
    "type HistogramView = 'table' | 'distribution' | 'scatter' | 'math-channels';",
)
replace_once(
    hist,
    "  const tableGeneratorView = createHistogramTableGeneratorView();\n  const heatmapView = createHeatmapView();\n  const dualHeatmapView = createDualHeatmapView();\n  const scatterView = createScatterView();\n\n  const page = document.createElement('main');",
    "  const tableGeneratorView = createHistogramTableGeneratorView();\n  const scatterView = createScatterView();\n  const mathChannelsView = createHistogramMathChannelsView();\n\n  const headerControl = document.createElement('label');\n  headerControl.className = 'histogram-header-view';\n  headerControl.innerHTML = `\n    <span>Analysis</span>\n    <select class=\"histogram-view-select\" aria-label=\"Histogram analysis view\">\n      <option value=\"table\" selected>Table Generator</option>\n      <option value=\"distribution\">Distribution</option>\n      <option value=\"scatter\">Scatter</option>\n      <option value=\"math-channels\">Math Channels</option>\n    </select>\n  `;\n\n  const page = document.createElement('main');",
)
replace_between(
    hist,
    "    <div class=\"histogram-workspace-bar\">",
    "    <div class=\"histogram-workspace-body\">",
    "    <div class=\"histogram-workspace-bar\">\n      <div class=\"histogram-workspace-hint\">MLV-style table generation · all available log channels · selected channels decode on demand</div>\n    </div>\n",
)
replace_once(
    hist,
    "  const viewSelect = page.querySelector<HTMLSelectElement>('.histogram-view-select');",
    "  const viewSelect = headerControl.querySelector<HTMLSelectElement>('.histogram-view-select');",
)
replace_once(
    hist,
    "  body.append(tableGeneratorView.element, heatmapView.element, dualHeatmapView.element, scatterView.element);",
    "  body.append(tableGeneratorView.element, scatterView.element, mathChannelsView.element);",
)
replace_once(
    hist,
    "    else if (activeView === 'heatmap') heatmapView.refresh();\n    else if (activeView === 'dual-heatmap') dualHeatmapView.refresh();\n    else scatterView.refresh();",
    "    else if (activeView === 'scatter') scatterView.refresh();\n    else mathChannelsView.refresh();",
)
replace_once(
    hist,
    "    heatmapView.element.hidden = view !== 'heatmap';\n    dualHeatmapView.element.hidden = view !== 'dual-heatmap';\n    scatterView.element.hidden = view !== 'scatter';",
    "    scatterView.element.hidden = view !== 'scatter';\n    mathChannelsView.element.hidden = view !== 'math-channels';",
)
replace_once(
    hist,
    "    heatmapView.setContext(nextContext);\n    dualHeatmapView.setContext(nextContext);\n    scatterView.setContext(nextContext);",
    "    scatterView.setContext(nextContext);\n    mathChannelsView.setContext(nextContext);",
)
replace_once(
    hist,
    "    if (value === 'table' || value === 'distribution' || value === 'heatmap' || value === 'dual-heatmap' || value === 'scatter') setActiveView(value);",
    "    if (value === 'table' || value === 'distribution' || value === 'scatter' || value === 'math-channels') setActiveView(value);",
)
replace_once(
    hist,
    "  heatmapView.setContext(context);\n  dualHeatmapView.setContext(context);\n  scatterView.setContext(context);",
    "  scatterView.setContext(context);\n  mathChannelsView.setContext(context);",
)
replace_once(
    hist,
    "  return { element: page, setContext, refresh: refreshActive };",
    "  return { element: page, headerControl, setContext, refresh: refreshActive };",
)

# Avoid spread-argument limits on large preview ranges in the new Math Channels page.
math_page = Path('apps/web/src/pages/histogram-math-channels-view.ts')
replace_once(
    math_page,
    "      const sum = values.reduce((total, value) => total + value, 0);\n      stat('count').textContent = values.length.toLocaleString();\n      stat('min').textContent = formatNumber(Math.min(...values));\n      stat('max').textContent = formatNumber(Math.max(...values));\n      stat('mean').textContent = formatNumber(sum / values.length);",
    "      let sum = 0;\n      let minimum = Number.POSITIVE_INFINITY;\n      let maximum = Number.NEGATIVE_INFINITY;\n      for (const value of values) {\n        sum += value;\n        minimum = Math.min(minimum, value);\n        maximum = Math.max(maximum, value);\n      }\n      stat('count').textContent = values.length.toLocaleString();\n      stat('min').textContent = formatNumber(minimum);\n      stat('max').textContent = formatNumber(maximum);\n      stat('mean').textContent = formatNumber(sum / values.length);",
)

# 3. Table Generator: mode-specific controls, information help, MSQ axis suggestions,
# formula storage sync, and table-edge clamping.
table = Path('apps/web/src/pages/histogram-table-generator-view.ts')
replace_once(
    table,
    "          <label><span>X columns</span><input class=\"histogram-table-x-bins\" type=\"number\" min=\"1\" max=\"64\" step=\"1\" value=\"16\" /></label>\n          <label><span>Y rows</span><input class=\"histogram-table-y-bins\" type=\"number\" min=\"1\" max=\"64\" step=\"1\" value=\"16\" /></label>\n          <label><span>X min</span><input class=\"histogram-table-x-min\" type=\"number\" step=\"any\" placeholder=\"Auto\" /></label>\n          <label><span>X max</span><input class=\"histogram-table-x-max\" type=\"number\" step=\"any\" placeholder=\"Auto\" /></label>\n          <label><span>Y min</span><input class=\"histogram-table-y-min\" type=\"number\" step=\"any\" placeholder=\"Auto\" /></label>\n          <label><span>Y max</span><input class=\"histogram-table-y-max\" type=\"number\" step=\"any\" placeholder=\"Auto\" /></label>",
    "          <div class=\"histogram-table-axis-auto\">\n            <label><span>X columns</span><input class=\"histogram-table-x-bins\" type=\"number\" min=\"1\" max=\"64\" step=\"1\" value=\"16\" /></label>\n            <label><span>Y rows</span><input class=\"histogram-table-y-bins\" type=\"number\" min=\"1\" max=\"64\" step=\"1\" value=\"16\" /></label>\n            <label><span>X min</span><input class=\"histogram-table-x-min\" type=\"number\" step=\"any\" placeholder=\"Auto\" /></label>\n            <label><span>X max</span><input class=\"histogram-table-x-max\" type=\"number\" step=\"any\" placeholder=\"Auto\" /></label>\n            <label><span>Y min</span><input class=\"histogram-table-y-min\" type=\"number\" step=\"any\" placeholder=\"Auto\" /></label>\n            <label><span>Y max</span><input class=\"histogram-table-y-max\" type=\"number\" step=\"any\" placeholder=\"Auto\" /></label>\n          </div>",
)
replace_once(
    table,
    "      </details>\n      <button type=\"button\" class=\"histogram-table-export\" disabled>Export CSV</button>",
    "      </details>\n      <details class=\"histogram-table-help\">\n        <summary aria-label=\"Table Generator information\" title=\"How Table Generator works\">i</summary>\n        <div class=\"histogram-table-help-popover\">\n          <strong>Table Generator</strong>\n          <p>Choose X and Y to define the table cells, then choose the Cell statistic and Z value to calculate inside each cell.</p>\n          <p><b>Auto bins</b> divides the observed/requested range. <b>Custom breakpoints</b> uses your cell centers. <b>Loaded MSQ table</b> uses the tune-table grid and suggests matching X/Y axes, which remain editable.</p>\n          <p>Filters qualify samples before binning. Custom/MSQ values beyond the outer breakpoints are assigned to the nearest edge cell so table results do not lose edge samples.</p>\n        </div>\n      </details>\n      <button type=\"button\" class=\"histogram-table-export\" disabled>Export CSV</button>",
)
replace_once(
    table,
    "  const customAxisFields = root.querySelector<HTMLElement>('.histogram-table-axis-custom');",
    "  const autoAxisFields = root.querySelector<HTMLElement>('.histogram-table-axis-auto');\n  const customAxisFields = root.querySelector<HTMLElement>('.histogram-table-axis-custom');",
)
replace_once(
    table,
    "    || !filterList || !addFilterButton || !axisSourceSelect || !customAxisFields || !xBreakpointsInput || !yBreakpointsInput",
    "    || !filterList || !addFilterButton || !axisSourceSelect || !autoAxisFields || !customAxisFields || !xBreakpointsInput || !yBreakpointsInput",
)
replace_between(
    table,
    "  const populateMsqAxisSelectors = (): void => {",
    "  const updateAxisControls = (): void => {",
    "  const populateMsqAxisSelectors = (preferSuggested = false): void => {\n    const previousTable = msqTableSelect.value;\n    const previousX = msqXAxisSelect.value;\n    const previousY = msqYAxisSelect.value;\n    msqTableSelect.replaceChildren();\n    msqXAxisSelect.replaceChildren();\n    msqYAxisSelect.replaceChildren();\n    const model = context.tuneModel;\n    if (!model) {\n      msqTableSelect.add(new Option('No MSQ loaded', ''));\n      msqXAxisSelect.add(new Option('—', ''));\n      msqYAxisSelect.add(new Option('—', ''));\n      return;\n    }\n    const tables = model.entries.filter((entry) => entry.kind === 'table' && entry.numericValues);\n    for (const tableEntry of tables) msqTableSelect.add(new Option(tableEntry.name, tableEntry.name));\n    if (previousTable && tables.some((tableEntry) => tableEntry.name === previousTable)) msqTableSelect.value = previousTable;\n    const selectedTable = model.byName.get(msqTableSelect.value) ?? tables[0];\n    if (!selectedTable) return;\n    if (!msqTableSelect.value) msqTableSelect.value = selectedTable.name;\n    const numeric = model.entries.filter((entry) => entry.numericValues);\n    const xCandidates = numeric.filter((entry) => entry.numericValues?.length === selectedTable.cols && entry.name !== selectedTable.name);\n    const yCandidates = numeric.filter((entry) => entry.numericValues?.length === selectedTable.rows && entry.name !== selectedTable.name);\n    const tableIndex = model.entries.indexOf(selectedTable);\n    const score = (entry: (typeof model.entries)[number], axis: 'x' | 'y'): number => {\n      const entryIndex = model.entries.indexOf(entry);\n      const name = entry.name.toLocaleLowerCase();\n      let value = entry.kind === 'vector' ? 1000 : 0;\n      if (entry.pageNumber !== undefined && entry.pageNumber === selectedTable.pageNumber) value += 500;\n      value += Math.max(0, 240 - Math.abs(entryIndex - tableIndex) * 12);\n      if (entryIndex < tableIndex) value += 50;\n      if (axis === 'x' && /(rpm|speed|x.?axis|x.?bin|column)/i.test(name)) value += 140;\n      if (axis === 'y' && /(map|load|tps|pressure|y.?axis|y.?bin|row)/i.test(name)) value += 140;\n      return value;\n    };\n    const rankedX = [...xCandidates].sort((left, right) => score(right, 'x') - score(left, 'x'));\n    const rankedY = [...yCandidates].sort((left, right) => score(right, 'y') - score(left, 'y'));\n    for (const entry of rankedX) msqXAxisSelect.add(new Option(entry.name, entry.name));\n    for (const entry of rankedY) msqYAxisSelect.add(new Option(entry.name, entry.name));\n    const tableChanged = previousTable !== selectedTable.name;\n    const keepX = !preferSuggested && !tableChanged && previousX && xCandidates.some((entry) => entry.name === previousX);\n    const suggestedX = keepX ? previousX : rankedX[0]?.name ?? '';\n    if (suggestedX) msqXAxisSelect.value = suggestedX;\n    const keepY = !preferSuggested && !tableChanged && previousY && yCandidates.some((entry) => entry.name === previousY);\n    const suggestedY = keepY\n      ? previousY\n      : rankedY.find((entry) => entry.name !== suggestedX)?.name ?? rankedY[0]?.name ?? '';\n    if (suggestedY) msqYAxisSelect.value = suggestedY;\n  };\n\n",
)
replace_once(
    table,
    "  const updateAxisControls = (): void => {\n    const mode = axisSourceSelect.value;\n    customAxisFields.hidden = mode !== 'custom';\n    msqAxisFields.hidden = mode !== 'msq';",
    "  const updateAxisControls = (): void => {\n    const mode = axisSourceSelect.value;\n    autoAxisFields.hidden = mode !== 'auto';\n    customAxisFields.hidden = mode !== 'custom';\n    msqAxisFields.hidden = mode !== 'msq';",
)
replace_once(
    table,
    "      ...(explicitAxes.yAxisValues ? { yAxisValues: explicitAxes.yAxisValues } : { yBinCount: binCount(yBinsInput, 16) }),\n      ...(!explicitAxes.xAxisValues && xMin !== undefined ? { xMin } : {}),",
    "      ...(explicitAxes.yAxisValues ? { yAxisValues: explicitAxes.yAxisValues } : { yBinCount: binCount(yBinsInput, 16) }),\n      ...(explicitAxes.xAxisValues || explicitAxes.yAxisValues ? { clampExplicitAxisEdges: true } : {}),\n      ...(!explicitAxes.xAxisValues && xMin !== undefined ? { xMin } : {}),",
)
replace_once(
    table,
    "  msqTableSelect.addEventListener('change', () => { populateMsqAxisSelectors(); scheduleRender(); });",
    "  msqTableSelect.addEventListener('change', () => { populateMsqAxisSelectors(true); scheduleRender(); });",
)
replace_once(
    table,
    "  showHitsInput.addEventListener('change', renderChart);\n  exportButton.addEventListener('click', exportCsv);",
    "  showHitsInput.addEventListener('change', renderChart);\n  window.addEventListener('epicscope-histogram-calculated-fields-changed', () => {\n    calculatedFields = loadHistogramCalculatedFields();\n    populateFormulaManager();\n    loadSelectedFormulaEditor();\n    refreshLogicalSelectors();\n    scheduleRender();\n  });\n  exportButton.addEventListener('click', exportCsv);",
)

# Slightly increase the Table Generator canvas labels/values too; CSS cannot reach canvas text.
text = table.read_text(encoding='utf-8')
def bump_canvas_font(match: re.Match[str]) -> str:
    size = int(match.group(1))
    return f"{size + 1}px system-ui, sans-serif" if size <= 9 else match.group(0)
text = re.sub(r'(\d+)px system-ui, sans-serif', bump_canvas_font, text)
table.write_text(text, encoding='utf-8')

# 4. Global header/footer hierarchy: Histogram view selector in top row and
# consistent global diagnostics/perf/report action group.
shell = Path('apps/web/src/app/app-shell.ts')
replace_once(
    shell,
    "      <div class=\"graph-selector-slot\"></div>",
    "      <div class=\"graph-selector-slot\"></div>\n      <div class=\"histogram-selector-slot\" hidden></div>",
)
replace_once(
    shell,
    "  footer.innerHTML = `\n    <div class=\"diagnostics-slot\"></div>\n    <div class=\"performance-diagnostics-slot\"></div>\n    <div class=\"bug-report-slot\"></div>",
    "  footer.innerHTML = `\n    <div class=\"footer-utility-actions\">\n      <div class=\"diagnostics-slot\"></div>\n      <div class=\"performance-diagnostics-slot\"></div>\n      <div class=\"bug-report-slot\"></div>\n    </div>",
)
replace_once(
    shell,
    "  const loggerToolsSlot = header.querySelector<HTMLElement>('.logger-tools-slot');",
    "  const histogramSelectorSlot = header.querySelector<HTMLElement>('.histogram-selector-slot');\n  const loggerToolsSlot = header.querySelector<HTMLElement>('.logger-tools-slot');",
)
replace_once(
    shell,
    "  if (!graphSelectorSlot || !loggerToolsSlot || !settingsShortcutsSlot || !diagnosticsSlot || !performanceDiagnosticsSlot || !bugReportSlot) {",
    "  if (!graphSelectorSlot || !histogramSelectorSlot || !loggerToolsSlot || !settingsShortcutsSlot || !diagnosticsSlot || !performanceDiagnosticsSlot || !bugReportSlot) {",
)
replace_once(
    shell,
    "  graphSelectorSlot.append(loggerPage.graphSelector);\n  loggerToolsSlot.append(loggerPage.headerTools);",
    "  graphSelectorSlot.append(loggerPage.graphSelector);\n  histogramSelectorSlot.append(histogramPage.headerControl);\n  loggerToolsSlot.append(loggerPage.headerTools);",
)
replace_once(
    shell,
    "  bugReportButton.className = 'bug-report-button';\n  bugReportButton.textContent = 'Bug report';",
    "  bugReportButton.className = 'bug-report-button utility-action-button';\n  bugReportButton.innerHTML = '<span class=\"utility-action-symbol\" aria-hidden=\"true\">⚑</span><span>Report</span>';",
)
replace_once(
    shell,
    "    graphSelectorSlot.hidden = !loggerActive;\n    loggerToolsSlot.hidden = !loggerActive;",
    "    graphSelectorSlot.hidden = !loggerActive;\n    histogramSelectorSlot.hidden = !histogramActive;\n    loggerToolsSlot.hidden = !loggerActive;",
)

parser = Path('apps/web/src/components/parser-diagnostics-indicator.ts')
replace_once(
    parser,
    "    <button type=\"button\" class=\"parser-indicator parser-indicator--good\" aria-haspopup=\"dialog\" aria-expanded=\"false\" title=\"No parser diagnostics\">\n      <span class=\"parser-indicator-light\" aria-hidden=\"true\"></span>\n      <span class=\"parser-indicator-count\" hidden></span>\n      <span class=\"sr-only\">Parser diagnostics</span>",
    "    <button type=\"button\" class=\"parser-indicator parser-indicator--good utility-action-button\" aria-haspopup=\"dialog\" aria-expanded=\"false\" title=\"No parser diagnostics\">\n      <span class=\"parser-indicator-light\" aria-hidden=\"true\"></span>\n      <span>Diag</span>\n      <span class=\"parser-indicator-count\" hidden></span>\n      <span class=\"sr-only\">Parser diagnostics</span>",
)

perf = Path('apps/web/src/components/performance-diagnostics.ts')
replace_once(
    perf,
    "class=\"performance-diagnostics-button\"",
    "class=\"performance-diagnostics-button utility-action-button\"",
)

# 5. Styles: dedicated Math Channels page, header selector, contextual help,
# global utility buttons, mode-only Table options, and system-wide small-text bump.
workspace_css = Path('apps/web/src/styles/histogram-workspace.css')
workspace_css.write_text(workspace_css.read_text(encoding='utf-8') + r'''

/* Histogram top-row analysis selector and 0.0.45-style Math Channels page. */
.histogram-header-view {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.histogram-header-view > span {
  color: #8298a6;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .04em;
  text-transform: uppercase;
}
.histogram-header-view select {
  min-width: 148px;
  height: 34px;
  border: 1px solid #2f4b59;
  border-radius: 4px;
  background: #0b1b24;
  color: #e0eaf0;
  padding: 0 9px;
  font-size: 10px;
  font-weight: 750;
}
.histogram-math-channels-view {
  width: 100%; height: 100%; min-height: 0;
  display: grid;
  grid-template-columns: 330px minmax(0,1fr);
  gap: 7px;
  padding: 7px;
  background: #071119;
}
.histogram-math-channels-view[hidden] { display:none; }
.math-channel-manager,.math-channel-editor {
  min-width:0; min-height:0;
  border:1px solid #263b4c; border-radius:4px;
  background:#0b151e; overflow:hidden;
}
.math-channel-manager { display:grid; grid-template-rows:44px 44px minmax(0,1fr) 34px; }
.math-channel-manager > header,.math-channel-editor > header {
  display:flex; align-items:center; gap:8px; padding:0 10px;
  border-bottom:1px solid #1b2a36; background:#0e1923;
}
.math-channel-manager > header strong,.math-channel-editor > header strong { color:#f1f6f8; font-size:12px; }
.math-channel-manager > header button { margin-left:auto; min-height:29px; padding:0 9px; border-color:#2078cc; background:#1668be; font-weight:750; }
.math-channel-search-wrap { padding:7px; }
.math-channel-search,.math-channel-source-search,.math-channel-form input,.math-channel-form textarea {
  width:100%; border:1px solid #2a4051; border-radius:3px; background:#0e1a24; color:#dce7ef;
}
.math-channel-search,.math-channel-source-search,.math-channel-form input { height:30px; padding:0 8px; }
.math-channel-list { min-height:0; overflow:auto; }
.math-channel-row { width:100%; min-height:54px; display:grid; gap:3px; padding:7px 9px; border:0; border-bottom:1px solid #1b2a36; border-radius:0; background:transparent; text-align:left; }
.math-channel-row:hover { background:#10202c; }
.math-channel-row--active { background:#11283a; box-shadow:inset 3px 0 0 #2788ff; }
.math-channel-row strong { color:#d8e4ea; font-size:11px; }
.math-channel-row small { color:#91a5b1; font:10px/1.3 ui-monospace,SFMono-Regular,Consolas,monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.math-channel-empty { padding:20px 12px; color:#8ca0ad; font-size:10px; line-height:1.5; text-align:center; }
.math-channel-manager > footer { display:flex; align-items:center; padding:0 9px; border-top:1px solid #1b2a36; color:#8fa2af; font-size:10px; }
.math-channel-editor { display:grid; grid-template-rows:44px minmax(0,1fr); }
.math-channel-editor > header > div { min-width:0; }
.math-channel-editor > header small { display:block; margin-top:2px; color:#91a4b0; font-size:9px; }
.math-channel-editor-body { min-height:0; overflow:auto; display:grid; grid-template-columns:minmax(330px,.9fr) minmax(320px,1.1fr); gap:14px; padding:12px; }
.math-channel-form { min-width:0; display:flex; flex-direction:column; gap:10px; }
.math-channel-field-grid { display:grid; grid-template-columns:1fr 110px; gap:8px; }
.math-channel-form label > span { display:block; margin-bottom:5px; color:#9cafbd; font-size:10px; font-weight:700; }
.math-channel-form textarea { min-height:112px; padding:8px; resize:vertical; font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace; }
.math-channel-helper-row { display:flex; flex-wrap:wrap; gap:4px; }
.math-channel-helper-row button,.math-channel-source-chip { min-height:27px; border:1px solid #294154; background:#101e29; color:#c0cdd5; border-radius:3px; font-size:10px; }
.math-channel-helper-row button:hover,.math-channel-source-chip:hover { background:#173047; color:#fff; }
.math-channel-help { margin:0; color:#91a5b1; font-size:10px; line-height:1.5; }
.math-channel-help code { color:#c9d7df; }
.math-channel-validation { padding:8px; border:1px solid #294154; border-radius:3px; background:#09131c; color:#aebdc7; font:10px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace; }
.math-channel-validation--good { color:#62d99b; border-color:#2f7557; }
.math-channel-validation--warning { color:#edc65c; border-color:#796128; }
.math-channel-validation--error { color:#ff858e; border-color:#814149; }
.math-channel-actions { display:grid; grid-template-columns:auto auto 1fr auto; gap:6px; }
.math-channel-actions button { min-height:29px; padding:0 9px; }
.math-channel-save { background:#1668be; border-color:#2078cc; }
.math-channel-delete { color:#ff8990; border-color:#6b3137; }
.math-channel-preview { min-width:0; min-height:0; display:grid; grid-template-rows:auto minmax(240px,1fr); gap:9px; }
.math-channel-preview-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; }
.math-channel-preview-stats > div { min-width:0; padding:8px; border:1px solid #263b4c; border-radius:3px; background:#0a141d; }
.math-channel-preview-stats span { display:block; color:#8da0ac; font-size:9px; margin-bottom:4px; }
.math-channel-preview-stats strong { color:#e5eef3; font-size:15px; font-variant-numeric:tabular-nums; }
.math-channel-source-browser { min-height:0; display:grid; grid-template-rows:38px minmax(0,1fr); border:1px solid #263b4c; background:#09131c; }
.math-channel-source-browser > header { display:grid; grid-template-columns:auto minmax(160px,1fr); gap:8px; align-items:center; padding:4px 7px; border-bottom:1px solid #1b2a36; }
.math-channel-source-browser > header strong { font-size:11px; color:#d8e4ea; }
.math-channel-source-list { min-height:0; overflow:auto; padding:6px; display:flex; align-content:flex-start; flex-wrap:wrap; gap:5px; }
.math-channel-source-chip { display:grid; justify-items:start; gap:1px; height:auto; padding:5px 7px; }
.math-channel-source-chip strong { font-size:10px; }
.math-channel-source-chip small { color:#8196a3; font-size:8px; }
@media(max-width:1000px){.histogram-math-channels-view{grid-template-columns:260px minmax(0,1fr)}.math-channel-editor-body{grid-template-columns:1fr}.math-channel-preview{min-height:300px}}
''', encoding='utf-8')

table_css = Path('apps/web/src/styles/histogram-table-generator.css')
table_css.write_text(table_css.read_text(encoding='utf-8') + r'''

/* Contextual Table menu: only the selected axis-source controls remain visible. */
.histogram-table-axis-auto,.histogram-table-axis-custom,.histogram-table-axis-msq { grid-column:1/-1; }
.histogram-table-axis-auto { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.histogram-table-axis-auto[hidden],.histogram-table-axis-custom[hidden],.histogram-table-axis-msq[hidden] { display:none; }
.histogram-table-axis-custom,.histogram-table-axis-msq { grid-template-columns:1fr 1fr; gap:8px; }
.histogram-table-axis-custom:not([hidden]),.histogram-table-axis-msq:not([hidden]) { display:grid; }
.histogram-table-axis-custom input,.histogram-table-axis-msq select { width:100%; min-width:0; min-height:28px; border:1px solid #2b4554; border-radius:3px; background:#0f1d27; color:#dce9ef; padding:0 6px; font-size:10px; }
.histogram-table-formulas { display:none!important; }
.histogram-table-help { position:relative; }
.histogram-table-help > summary { width:27px; height:27px; display:grid; place-items:center; border:1px solid #3a586a; border-radius:50%; background:#0e202b; color:#9fd0e8; cursor:pointer; list-style:none; font:800 13px/1 Georgia,serif; }
.histogram-table-help > summary::-webkit-details-marker { display:none; }
.histogram-table-help[open] > summary,.histogram-table-help > summary:hover { border-color:#4a8eb3; background:#12334a; color:#fff; }
.histogram-table-help-popover { position:absolute; z-index:35; top:32px; right:0; width:min(380px,72vw); padding:10px; border:1px solid #355164; border-radius:4px; background:#0b171f; box-shadow:0 10px 30px rgba(0,0,0,.42); }
.histogram-table-help-popover strong { display:block; margin-bottom:6px; color:#edf6fa; font-size:11px; }
.histogram-table-help-popover p { margin:5px 0; color:#9eb0ba; font-size:10px; line-height:1.45; }
.histogram-table-help-popover b { color:#dce9ef; }
.histogram-table-toolbar label > span,.histogram-table-options-popover label > span { font-size:9px; }
.histogram-table-toolbar select,.histogram-table-toolbar input[type="number"],.histogram-table-toolbar button,.histogram-table-filters summary,.histogram-table-options summary,.histogram-table-filter-popover select,.histogram-table-filter-popover input[type="number"],.histogram-table-filter-popover button,.histogram-table-options-popover input[type="number"] { font-size:10px; }
.histogram-table-status { font-size:9px; min-height:24px; }
.histogram-table-tooltip { font-size:9px; }
.histogram-table-tooltip strong { font-size:10px; }
''', encoding='utf-8')

app_css = Path('apps/web/src/styles/app.css')
app_css.write_text(app_css.read_text(encoding='utf-8') + r'''

/* Global clickable utility group and readability pass. */
.footer-utility-actions { display:flex; align-items:center; gap:3px; flex:0 0 auto; }
.footer-utility-actions > div { display:flex; align-items:center; }
.utility-action-button { height:25px!important; min-width:0!important; display:inline-flex!important; align-items:center!important; justify-content:center!important; gap:5px!important; padding:0 8px!important; border:1px solid #345365!important; border-radius:4px!important; background:#0d1d28!important; color:#d8e5eb!important; font-size:10px!important; font-weight:800!important; box-shadow:inset 0 1px 0 rgba(255,255,255,.035); }
.utility-action-button:hover,.utility-action-button[aria-expanded="true"] { border-color:#4a758c!important; background:#123044!important; color:#fff!important; }
.utility-action-symbol { min-width:13px; text-align:center; font-size:12px; line-height:1; }
.status-bar { gap:9px; font-size:10px; }
.histogram-selector-slot { display:inline-flex; align-items:center; }
''', encoding='utf-8')

perf_css = Path('apps/web/src/styles/performance-diagnostics.css')
perf_css.write_text(perf_css.read_text(encoding='utf-8') + r'''
.performance-diagnostics-button.utility-action-button { min-width:0; }
.performance-diagnostics-button.utility-action-button > span:first-child { font-size:12px; }
.performance-row { font-size:10px; }
.performance-channel-card strong { font-size:10px; }
.performance-diagnostics-head small,.performance-empty,.performance-channel-card span { font-size:10px; }
''', encoding='utf-8')

logger_css = Path('apps/web/src/styles/logger-ui.css')
logger_css.write_text(logger_css.read_text(encoding='utf-8') + r'''
.status-bar .parser-indicator.utility-action-button { min-width:0; padding:0 8px!important; }
.status-bar .parser-indicator.utility-action-button .parser-indicator-light { width:10px; height:10px; flex-basis:10px; }
.status-bar .parser-indicator--warning.utility-action-button { border-color:#80652c!important; background:#2a220e!important; }
.status-bar .parser-indicator--error.utility-action-button { border-color:#87424a!important; background:#2b1418!important; }
.status-bar .parser-indicator--info.utility-action-button { border-color:#35677f!important; background:#102735!important; }
''', encoding='utf-8')

# Bump only the genuinely tiny CSS text globally. This deliberately leaves
# >=10px typography alone to avoid a wholesale layout scale change.
for css in Path('apps/web/src/styles').glob('*.css'):
    text = css.read_text(encoding='utf-8')
    def bump_small(match: re.Match[str]) -> str:
        size = int(match.group(1))
        if size <= 7:
            return 'font-size:8px'
        if size == 8:
            return 'font-size:9px'
        if size == 9:
            return 'font-size:10px'
        return match.group(0)
    text = re.sub(r'font-size\s*:\s*(\d+)px', bump_small, text)
    css.write_text(text, encoding='utf-8')

print('Histogram UI/data consistency patch applied.')
