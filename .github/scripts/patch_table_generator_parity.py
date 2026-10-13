from pathlib import Path
p = Path('apps/web/src/pages/histogram-table-generator-view.ts')
text = p.read_text()
old = """  const timeForSourceIndex = (sampleIndex: number): number | undefined => {\n    const trace = currentXTrace;\n    if (!trace) return undefined;\n    const localIndex = sampleIndex - trace.range.startSampleIndex;\n    if (!Number.isSafeInteger(localIndex) || localIndex < 0 || localIndex >= trace.range.timeMs.length) return undefined;\n    const time = trace.range.timeMs[localIndex];\n    return time !== undefined && Number.isFinite(time) ? time : undefined;\n  };\n\n"""
if text.count(old) != 1:
    raise SystemExit(f'expected one obsolete time helper, found {text.count(old)}')
p.write_text(text.replace(old, '', 1))
