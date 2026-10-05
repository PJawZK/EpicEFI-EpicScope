from pathlib import Path

p = Path('apps/web/src/pages/histogram-table-generator-view.ts')
s = p.read_text()
old = """      displayResult = {
        ...result,
        cellValues: weighted.cellValues,
        cellValueSampleCounts: weighted.cellContributingSampleCounts,
        cellValueMin: weighted.cellValueMin,
        cellValueMax: weighted.cellValueMax,
        valueValidSampleCount: weighted.contributingSampleCount,
        valueInvalidSampleCount: weighted.invalidValueSampleCount,
        valueUnavailableSampleCount: weighted.unavailableValueSampleCount,
      };"""
new = """      displayResult = {
        ...result,
        counts: weighted.cellContributingSampleCounts,
        cellValues: weighted.cellValues,
        cellValueSampleCounts: weighted.cellContributingSampleCounts,
        cellSampleIndices: weighted.cellSampleIndices,
        cellValueMin: weighted.cellValueMin,
        cellValueMax: weighted.cellValueMax,
        maxCellCount: Math.max(0, ...weighted.cellContributingSampleCounts),
        valueValidSampleCount: weighted.contributingSampleCount,
        valueInvalidSampleCount: weighted.invalidValueSampleCount,
        valueUnavailableSampleCount: weighted.unavailableValueSampleCount,
      };"""
if old not in s:
    raise SystemExit('weighted display result block not found')
s = s.replace(old, new, 1)
s = s.replace("if (method === 'weighted-mean') return 'Weighted mean';", "if (method === 'weighted-mean') return 'MLV weighted mean';")
s = s.replace('<option value="weighted-mean">Weighted mean · MLV experimental</option>', '<option value="weighted-mean">MLV weighted mean</option>')
p.write_text(s)
