from pathlib import Path
p = Path('core/timeline/viewport-series.ts')
s = p.read_text()
old = """  const mergeBlock = (block: number): boolean => {\n    const count = blocks.validCount[block] ?? 0;\n    invalidSampleCount += blocks.invalidCount[block] ?? 0;\n    if (count === 0) return true;\n"""
new = """  const mergeBlock = (block: number): boolean => {\n    const count = blocks.validCount[block] ?? 0;\n    if (count === 0) {\n      invalidSampleCount += blocks.invalidCount[block] ?? 0;\n      return true;\n    }\n"""
assert old in s, 'mergeBlock count anchor missing'
s = s.replace(old, new, 1)
old = """    validSampleCount += count;\n    valueMin = Math.min(valueMin, minValue!); valueMax = Math.max(valueMax, maxValue!);\n    return true;\n"""
new = """    validSampleCount += count;\n    invalidSampleCount += blocks.invalidCount[block] ?? 0;\n    valueMin = Math.min(valueMin, minValue!); valueMax = Math.max(valueMax, maxValue!);\n    return true;\n"""
assert old in s, 'mergeBlock completion anchor missing'
p.write_text(s.replace(old, new, 1))
