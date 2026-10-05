from pathlib import Path

p = Path('apps/web/src/pages/histogram-table-generator-view.ts')
s = p.read_text()
old = '''      displayResult = {
        ...result,
        cellValues: weighted.cellValues,
        cellValueSampleCounts: weighted.cellContributingSampleCounts,
        cellValueMin: weighted.cellValueMin,
        cellValueMax: weighted.cellValueMax,
        valueValidSampleCount: weighted.contributingSampleCount,
        valueInvalidSampleCount: weighted.invalidValueSampleCount,
        valueUnavailableSampleCount: weighted.unavailableValueSampleCount,
      };'''
new = '''      displayResult = {
        ...result,
        counts: weighted.cellContributingSampleCounts,
        cellSampleIndices: weighted.cellSampleIndices,
        cellValues: weighted.cellValues,
        cellValueSampleCounts: weighted.cellContributingSampleCounts,
        cellValueMin: weighted.cellValueMin,
        cellValueMax: weighted.cellValueMax,
        valueValidSampleCount: weighted.contributingSampleCount,
        valueInvalidSampleCount: weighted.invalidValueSampleCount,
        valueUnavailableSampleCount: weighted.unavailableValueSampleCount,
        maxCellCount: Math.max(0, ...weighted.cellContributingSampleCounts),
      };'''
if old not in s:
    raise SystemExit('weighted displayResult block not found')
s = s.replace(old, new, 1)
p.write_text(s)
