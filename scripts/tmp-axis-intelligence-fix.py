from pathlib import Path
import re

p = Path('scripts/tmp-axis-intelligence.py')
s = p.read_text(encoding='utf-8')

pattern = re.compile(r"# Resolve axes before building heatmap and surface validation errors\.\nold = \"\"\"[\s\S]*?if old not in text:\n    raise SystemExit\('missing table generator heatmap call block'\)\ntext = text\.replace\(old, new, 1\)\n", re.M)
replacement = '''# Resolve axes before building heatmap and surface validation errors.\nold = \"\"\"    const valueRange = aggregation === 'count'\n      ? undefined\n      : deltaTrace && zTrace ? subtractNumericRanges(zTrace.range, deltaTrace.range) : zTrace!.range;\n    const xMin = optionalFinite(xMinInput);\n    const xMax = optionalFinite(xMaxInput);\n    const yMin = optionalFinite(yMinInput);\n    const yMax = optionalFinite(yMaxInput);\n    const result = buildNumericHeatmap(xTrace.range, yTrace.range, {\n      sampleIndices: qualified.eligibleSampleIndices,\n      xBinCount: binCount(xBinsInput, 16),\n      yBinCount: binCount(yBinsInput, 16),\n      ...(xMin !== undefined ? { xMin } : {}),\n      ...(xMax !== undefined ? { xMax } : {}),\n      ...(yMin !== undefined ? { yMin } : {}),\n      ...(yMax !== undefined ? { yMax } : {}),\n      aggregation,\n      ...(valueRange ? { valueRange } : {}),\n    });\n\"\"\"\nnew = \"\"\"    const valueRange = aggregation === 'count'\n      ? undefined\n      : deltaTrace && zTrace ? subtractNumericRanges(zTrace.range, deltaTrace.range) : zTrace!.range;\n    const explicitAxes = resolveExplicitAxes();\n    if (explicitAxes.error) {\n      currentResult = undefined;\n      currentXTrace = xTrace;\n      currentYTrace = yTrace;\n      currentZTrace = zTrace;\n      currentDeltaTrace = deltaTrace;\n      currentScope = scope;\n      layout = undefined;\n      empty.hidden = false;\n      empty.querySelector('strong')!.textContent = 'Table axis configuration is incomplete.';\n      empty.querySelector('span')!.textContent = explicitAxes.error;\n      canvas.hidden = true;\n      status.hidden = true;\n      exportButton.disabled = true;\n      return;\n    }\n    const xMin = optionalFinite(xMinInput);\n    const xMax = optionalFinite(xMaxInput);\n    const yMin = optionalFinite(yMinInput);\n    const yMax = optionalFinite(yMaxInput);\n    const result = buildNumericHeatmap(xTrace.range, yTrace.range, {\n      sampleIndices: qualified.eligibleSampleIndices,\n      ...(explicitAxes.xAxisValues ? { xAxisValues: explicitAxes.xAxisValues } : { xBinCount: binCount(xBinsInput, 16) }),\n      ...(explicitAxes.yAxisValues ? { yAxisValues: explicitAxes.yAxisValues } : { yBinCount: binCount(yBinsInput, 16) }),\n      ...(!explicitAxes.xAxisValues && xMin !== undefined ? { xMin } : {}),\n      ...(!explicitAxes.xAxisValues && xMax !== undefined ? { xMax } : {}),\n      ...(!explicitAxes.yAxisValues && yMin !== undefined ? { yMin } : {}),\n      ...(!explicitAxes.yAxisValues && yMax !== undefined ? { yMax } : {}),\n      aggregation,\n      ...(valueRange ? { valueRange } : {}),\n    });\n\"\"\"\nif old not in text:\n    raise SystemExit('missing table generator heatmap call block')\ntext = text.replace(old, new, 1)\n'''
s, count = pattern.subn(replacement, s, count=1)
if count != 1:
    raise SystemExit('failed to update axis script heatmap replacement')

needle = "text = text.replace(\"formatNumber((bin.lowerBound + bin.upperBound) / 2, 1)\", \"formatNumber(bin.centerValue, 1)\")"
extra = needle + "\ntext = text.replace(\"const xCenters = result.xBins.map((bin) => (bin.lowerBound + bin.upperBound) / 2);\", \"const xCenters = result.xBins.map((bin) => bin.centerValue);\")\ntext = text.replace(\"formatNumber((yBin.lowerBound + yBin.upperBound) / 2, 6)\", \"formatNumber(yBin.centerValue, 6)\")"
if needle not in s:
    raise SystemExit('missing center label patch marker')
s = s.replace(needle, extra, 1)

p.write_text(s, encoding='utf-8')
Path('scripts/tmp-axis-intelligence-fix.py').unlink(missing_ok=True)
