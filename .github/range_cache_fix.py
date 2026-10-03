from pathlib import Path
p = Path('core/parsers/mlg/mlg-channel-data.ts')
s = p.read_text()
old = "    const uniqueIds = [...new Set(channelIds)];\n    const isFullRange = startSampleIndex === 0 && sampleCount === this.sampleCount;\n    const before = this.source.performanceSnapshot?.();"
new = "    const uniqueIds = [...new Set(channelIds)];\n    const before = this.source.performanceSnapshot?.();"
if old in s:
    s = s.replace(old, new, 1)
p.write_text(s)
