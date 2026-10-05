from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing patch marker: {label}')
    return text.replace(old, new, 1)

path = Path('apps/web/src/pages/histogram-table-generator-view.ts')
text = path.read_text()

text = replace_once(
    text,
    "import { buildNumericHeatmap, type NumericHeatmapResult } from '../../../../core/analysis/heatmap';\n",
    "import { buildNumericHeatmap, type NumericHeatmapResult } from '../../../../core/analysis/heatmap';\nimport { buildCellCenteredWeightedMean } from '../../../../core/analysis/weighted-cell-mean';\n",
    'weighted import',
)
text = replace_once(
    text,
    "  type HistogramFilterConditionState,\n  type HistogramTablePresetState,\n} from '../state/histogram-table-storage';\n",
    "  type HistogramFilterConditionState,\n  type HistogramTableAggregation,\n  type HistogramTableColorMode,\n  type HistogramTablePresetState,\n} from '../state/histogram-table-storage';\n",
    'storage type imports',
)
text = text.replace(
    'function formatCellValue(value: number | undefined, method: NumericAggregationMethod, width: number): string {',
    'function formatCellValue(value: number | undefined, method: HistogramTableAggregation, width: number): string {',
    1,
)
text = text.replace(
    'function aggregationLabel(method: NumericAggregationMethod): string {\n  if (method === \'count\') return \'Count\';',
    "function aggregationLabel(method: HistogramTableAggregation): string {\n  if (method === 'weighted-mean') return 'Weighted mean';\n  if (method === 'count') return 'Count';",
    1,
)
text = replace_once(
    text,
    "  let currentResult: NumericHeatmapResult | undefined;\n  let currentXTrace: HistogramTraceContext | undefined;\n",
    "  let currentResult: NumericHeatmapResult | undefined;\n  let currentAggregation: HistogramTableAggregation = 'mean';\n  let currentCellTotalWeights: Float64Array | undefined;\n  let currentWeightedContributingCounts: Uint32Array | undefined;\n  let currentXTrace: HistogramTraceContext | undefined;\n",
    'weighted state',
)
text = replace_once(
    text,
    '        <option value="mean" selected>Mean</option>\n        <option value="count">Count</option>',
    '        <option value="mean" selected>Mean</option>\n        <option value="weighted-mean">Weighted mean · MLV experimental</option>\n        <option value="count">Count</option>',
    'weighted aggregation option',
)
text = replace_once(
    text,
    '          <label class="histogram-table-toggle"><input class="histogram-table-show-hits" type="checkbox" checked /><span>Show hit count in cells</span></label>\n          <p>Set Y rows to 1 for an MLV-style single-row bar graph. Blank limits use observed data range.</p>',
    '''          <label class="histogram-table-toggle"><input class="histogram-table-show-hits" type="checkbox" checked /><span>Show hit count in cells</span></label>
          <div class="histogram-table-weighting" hidden>
            <label><span>Min individual weight</span><input class="histogram-table-min-individual-weight" type="number" min="0" max="1" step="0.01" value="0" /></label>
            <label><span>Min total hit weight</span><input class="histogram-table-min-total-weight" type="number" min="0" step="0.1" value="0" /></label>
            <label><span>Cell color</span><select class="histogram-table-color-mode"><option value="value">Cell value</option><option value="weight">Hit weight</option></select></label>
            <p>Experimental MLV-style weighting: 1.0 at the X/Y cell center, falling toward 0.0 at the cell boundary. The two thresholds mirror MLV's hit-weight controls.</p>
          </div>
          <p>Set Y rows to 1 for an MLV-style single-row bar graph. Blank limits use observed data range.</p>''',
    'weight controls markup',
)
text = replace_once(
    text,
    "  const showHitsInput = root.querySelector<HTMLInputElement>('.histogram-table-show-hits');\n  const exportButton = root.querySelector<HTMLButtonElement>('.histogram-table-export');\n",
    "  const showHitsInput = root.querySelector<HTMLInputElement>('.histogram-table-show-hits');\n  const weightingFields = root.querySelector<HTMLElement>('.histogram-table-weighting');\n  const minimumIndividualWeightInput = root.querySelector<HTMLInputElement>('.histogram-table-min-individual-weight');\n  const minimumTotalWeightInput = root.querySelector<HTMLInputElement>('.histogram-table-min-total-weight');\n  const colorModeSelect = root.querySelector<HTMLSelectElement>('.histogram-table-color-mode');\n  const exportButton = root.querySelector<HTMLButtonElement>('.histogram-table-export');\n",
    'weight controls query',
)
text = replace_once(
    text,
    "    || !yMinInput || !yMaxInput || !showHitsInput || !exportButton || !empty || !status || !canvas || !tooltip\n",
    "    || !yMinInput || !yMaxInput || !showHitsInput || !weightingFields || !minimumIndividualWeightInput || !minimumTotalWeightInput || !colorModeSelect\n    || !exportButton || !empty || !status || !canvas || !tooltip\n",
    'weight controls guard',
)
text = text.replace(
    '  const selectedAggregation = (): NumericAggregationMethod => aggregationSelect.value as NumericAggregationMethod;',
    '  const selectedAggregation = (): HistogramTableAggregation => aggregationSelect.value as HistogramTableAggregation;',
    1,
)
text = replace_once(
    text,
    "    aggregation: aggregationSelect.value as NumericAggregationMethod,\n    axisSource: axisSourceSelect.value as 'auto' | 'custom' | 'msq',\n",
    "    aggregation: aggregationSelect.value as HistogramTableAggregation,\n    axisSource: axisSourceSelect.value as 'auto' | 'custom' | 'msq',\n",
    'preset aggregation type',
)
text = replace_once(
    text,
    "    showHits: showHitsInput.checked,\n    groupLogic: filterBetweenLogicSelect.value as NumericQualificationLogic,\n",
    "    showHits: showHitsInput.checked,\n    minimumIndividualWeight: Number(minimumIndividualWeightInput.value) || 0,\n    minimumTotalWeight: Number(minimumTotalWeightInput.value) || 0,\n    colorMode: colorModeSelect.value as HistogramTableColorMode,\n    groupLogic: filterBetweenLogicSelect.value as NumericQualificationLogic,\n",
    'preset weighted capture',
)
text = replace_once(
    text,
    "    showHitsInput.checked = preset.showHits;\n    filterBetweenLogicSelect.value = preset.groupLogic;\n",
    "    showHitsInput.checked = preset.showHits;\n    minimumIndividualWeightInput.value = String(preset.minimumIndividualWeight ?? 0);\n    minimumTotalWeightInput.value = String(preset.minimumTotalWeight ?? 0);\n    colorModeSelect.value = preset.colorMode ?? 'value';\n    filterBetweenLogicSelect.value = preset.groupLogic;\n",
    'preset weighted apply',
)
text = replace_once(
    text,
    "  const updateValueControls = (): void => {\n    const usesValue = selectedAggregation() !== 'count';\n    zField.hidden = !usesValue;\n    deltaField.hidden = !usesValue;\n  };\n",
    "  const updateValueControls = (): void => {\n    const aggregation = selectedAggregation();\n    const usesValue = aggregation !== 'count';\n    zField.hidden = !usesValue;\n    deltaField.hidden = !usesValue;\n    weightingFields.hidden = aggregation !== 'weighted-mean';\n  };\n",
    'update weighted controls visibility',
)
text = replace_once(
    text,
    "    const aggregation = selectedAggregation();\n    const zId = aggregation === 'count' ? undefined : (zSelect.value || context.channels[0]?.id);\n",
    "    const aggregation = selectedAggregation();\n    const baseAggregation: NumericAggregationMethod = aggregation === 'weighted-mean' ? 'mean' : aggregation;\n    const zId = aggregation === 'count' ? undefined : (zSelect.value || context.channels[0]?.id);\n",
    'base aggregation',
)
text = replace_once(
    text,
    "      aggregation,\n      ...(valueRange ? { valueRange } : {}),\n    });\n\n    const complete = qualified.complete\n",
    "      aggregation: baseAggregation,\n      ...(valueRange ? { valueRange } : {}),\n    });\n\n    let displayResult = result;\n    currentCellTotalWeights = undefined;\n    currentWeightedContributingCounts = undefined;\n    if (aggregation === 'weighted-mean' && valueRange) {\n      const weighted = buildCellCenteredWeightedMean(xTrace.range, yTrace.range, valueRange, result, {\n        minimumIndividualWeight: Math.max(0, Math.min(1, Number(minimumIndividualWeightInput.value) || 0)),\n        minimumTotalWeight: Math.max(0, Number(minimumTotalWeightInput.value) || 0),\n      });\n      currentCellTotalWeights = weighted.cellTotalWeights;\n      currentWeightedContributingCounts = weighted.cellContributingSampleCounts;\n      displayResult = {\n        ...result,\n        cellValues: weighted.cellValues,\n        cellValueSampleCounts: weighted.cellContributingSampleCounts,\n        cellValueMin: weighted.cellValueMin,\n        cellValueMax: weighted.cellValueMax,\n        valueValidSampleCount: weighted.contributingSampleCount,\n        valueInvalidSampleCount: weighted.invalidValueSampleCount,\n        valueUnavailableSampleCount: weighted.unavailableValueSampleCount,\n      };\n    }\n\n    const complete = qualified.complete\n",
    'weighted result application',
)
text = replace_once(
    text,
    "      && result.unavailableSampleCount === 0\n      && result.valueUnavailableSampleCount === 0;\n\n    currentResult = result;\n",
    "      && displayResult.unavailableSampleCount === 0\n      && displayResult.valueUnavailableSampleCount === 0;\n\n    currentResult = displayResult;\n    currentAggregation = aggregation;\n",
    'weighted current result',
)
text = replace_once(
    text,
    "    summary('binned').textContent = result.binnedSampleCount.toLocaleString();\n    summary('outside').textContent = result.outsideRangeSampleCount.toLocaleString();\n",
    "    summary('binned').textContent = displayResult.binnedSampleCount.toLocaleString();\n    summary('outside').textContent = displayResult.outsideRangeSampleCount.toLocaleString();\n",
    'weighted summaries',
)
text = text.replace('`${aggregationLabel(aggregation)} · ${traceLabel(zTrace)} − ${traceLabel(deltaTrace)}`', '`${aggregationLabel(aggregation)} · ${traceLabel(zTrace)} − ${traceLabel(deltaTrace)}`')

# Render normalization can use hit weight instead of cell value.
old = '''          const finite = value !== undefined && Number.isFinite(value);\n          const normalized = !finite\n            ? 0\n            : valueSpan > 0 && valueMin !== undefined\n              ? Math.max(0, Math.min(1, (Number(value) - valueMin) / valueSpan))\n              : count > 0 ? 1 : 0;'''
new = '''          const finite = value !== undefined && Number.isFinite(value);\n          const cellWeight = currentCellTotalWeights?.[cellIndex] ?? 0;\n          const maxWeight = currentCellTotalWeights ? Math.max(0, ...currentCellTotalWeights) : 0;\n          const normalized = currentAggregation === 'weighted-mean' && colorModeSelect.value === 'weight'\n            ? maxWeight > 0 ? Math.max(0, Math.min(1, cellWeight / maxWeight)) : 0\n            : !finite\n              ? 0\n              : valueSpan > 0 && valueMin !== undefined\n                ? Math.max(0, Math.min(1, (Number(value) - valueMin) / valueSpan))\n                : count > 0 ? 1 : 0;'''
text = replace_once(text, old, new, 'weight color normalization')

text = text.replace(
    'const text = formatCellValue(finite ? Number(value) : undefined, result.aggregationMethod, cellWidth);',
    'const text = formatCellValue(finite ? Number(value) : undefined, currentAggregation, cellWidth);',
    1,
)
text = text.replace(
    "ctx.fillText(`${aggregationLabel(result.aggregationMethod)} · ${valueName}`, left, 5);",
    "ctx.fillText(`${aggregationLabel(currentAggregation)} · ${valueName}`, left, 5);",
    1,
)

# Tooltip gets the MLV-style certainty evidence.
text = replace_once(
    text,
    "    const validValues = result.cellValueSampleCounts[cellIndex] ?? 0;\n",
    "    const validValues = result.cellValueSampleCounts[cellIndex] ?? 0;\n    const totalWeight = currentCellTotalWeights?.[cellIndex];\n    const weightedHits = currentWeightedContributingCounts?.[cellIndex];\n",
    'tooltip weight vars',
)
text = replace_once(
    text,
    "      <strong>${aggregationLabel(result.aggregationMethod)} · ${zName}: ${formatCellValue(value, result.aggregationMethod, 100)}</strong>\n",
    "      <strong>${aggregationLabel(currentAggregation)} · ${zName}: ${formatCellValue(value, currentAggregation, 100)}</strong>\n",
    'tooltip aggregation label',
)
text = replace_once(
    text,
    "      <span>Hits: ${count.toLocaleString()}${result.aggregationMethod === 'count' ? '' : ` · valid Z: ${validValues.toLocaleString()}`}</span>\n",
    "      <span>Hits: ${count.toLocaleString()}${result.aggregationMethod === 'count' ? '' : ` · valid Z: ${validValues.toLocaleString()}`}</span>\n      ${currentAggregation === 'weighted-mean' ? `<span>Total hit weight: ${formatNumber(totalWeight, 3)} · weighted hits: ${(weightedHits ?? 0).toLocaleString()}</span>` : ''}\n",
    'tooltip weighting line',
)

# Inspector subtitle reflects weighted mode and total weight.
text = replace_once(
    text,
    "    cellInspectorSubtitle.textContent = `${aggregationLabel(result.aggregationMethod)} ${formatCellValue(value, result.aggregationMethod, 120)} · ${count.toLocaleString()} hits`;\n",
    "    const totalWeight = currentCellTotalWeights?.[cell.cellIndex];\n    cellInspectorSubtitle.textContent = `${aggregationLabel(currentAggregation)} ${formatCellValue(value, currentAggregation, 120)} · ${count.toLocaleString()} hits${currentAggregation === 'weighted-mean' ? ` · weight ${formatNumber(totalWeight, 3)}` : ''}`;\n",
    'inspector weighted subtitle',
)

# CSV identifies weighted mode and exports total hit weights.
text = replace_once(
    text,
    "      ['Cell', aggregationLabel(result.aggregationMethod), zDescription, currentZTrace?.channel.unit ?? ''].map(quote).join(','),\n",
    "      ['Cell', aggregationLabel(currentAggregation), zDescription, currentZTrace?.channel.unit ?? ''].map(quote).join(','),\n",
    'csv weighted label',
)
marker = "    const blob = new Blob([rows.join('\\n')], { type: 'text/csv;charset=utf-8' });\n"
addition = '''    if (currentAggregation === 'weighted-mean' && currentCellTotalWeights) {\n      rows.push('', 'Total hit weights', [traceLabel(yTrace) + ' \\\\ ' + traceLabel(xTrace), ...xCenters.map((value) => formatNumber(value, 6))].map(quote).join(','));\n      for (let yIndex = result.yBins.length - 1; yIndex >= 0; yIndex -= 1) {\n        const yBin = result.yBins[yIndex]!;\n        const values: (string | number)[] = [formatNumber(yBin.centerValue, 6)];\n        for (let xIndex = 0; xIndex < result.xBins.length; xIndex += 1) {\n          values.push(currentCellTotalWeights[yIndex * result.xBins.length + xIndex] ?? 0);\n        }\n        rows.push(values.map(quote).join(','));\n      }\n    }\n'''
text = replace_once(text, marker, addition + marker, 'csv weight table')

# Weighting controls trigger analysis/render updates.
text = replace_once(
    text,
    "  showHitsInput.addEventListener('change', renderChart);\n",
    "  showHitsInput.addEventListener('change', renderChart);\n  minimumIndividualWeightInput.addEventListener('input', () => scheduleRender(120));\n  minimumTotalWeightInput.addEventListener('input', () => scheduleRender(120));\n  colorModeSelect.addEventListener('change', renderChart);\n",
    'weight listeners',
)

path.write_text(text)

# Styling for compact weighting controls inside the existing Table popup.
path = Path('apps/web/src/styles/histogram-table-generator.css')
css = path.read_text()
css += '''\n.histogram-table-weighting {\n  display: grid;\n  grid-column: 1 / -1;\n  grid-template-columns: 1fr 1fr 1fr;\n  gap: 8px;\n  padding-top: 8px;\n  border-top: 1px solid #233746;\n}\n\n.histogram-table-weighting[hidden] {\n  display: none;\n}\n\n.histogram-table-weighting label {\n  min-width: 0;\n}\n\n.histogram-table-weighting select,\n.histogram-table-weighting input {\n  width: 100%;\n  min-width: 0;\n}\n\n.histogram-table-weighting p {\n  grid-column: 1 / -1;\n}\n'''
path.write_text(css)
