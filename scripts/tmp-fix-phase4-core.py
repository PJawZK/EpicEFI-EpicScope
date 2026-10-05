from pathlib import Path
p = Path('core/analysis/specialized-analyzers.ts')
s = p.read_text(encoding='utf-8')
old = """\nfunction aggregate(range: NumericChannelRange | undefined, indices: readonly number[]): NumericAggregationResult | undefined {\n  return range ? aggregateNumericSamples(range, { sampleIndices: indices }) : undefined;\n}\n"""
if old not in s:
    raise SystemExit('unused aggregate helper not found')
p.write_text(s.replace(old, '\n', 1), encoding='utf-8')
