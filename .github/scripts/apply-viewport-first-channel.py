from pathlib import Path

path = Path('apps/web/src/components/graph-viewport.ts')
text = path.read_text()
start_marker = "  const promoteViewportBatchToFull = async (\n"
end_marker = "  const flushPending = async (): Promise<void> => {\n"
start = text.find(start_marker)
end = text.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('viewport promotion block not found')
block = text[start:end]
old = "    if (!channelData || channelIds.length === 0) return;\n\n    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));"
new = "    const dataSource = channelData;\n    if (!dataSource || channelIds.length === 0) return;\n\n    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));"
if old not in block:
    raise SystemExit('promotion capture insertion point not found')
block = block.replace(old, new, 1)
block = block.replace('channelData.readChannelsRange', 'dataSource.readChannelsRange')
block = block.replace('channelData!.readChannelRange', 'dataSource.readChannelRange')
block = block.replace('channelData.readChannelRange', 'dataSource.readChannelRange')
block = block.replace('channelData!.sampleCount', 'dataSource.sampleCount')
block = block.replace('channelData.sampleCount', 'dataSource.sampleCount')
text = text[:start] + block + text[end:]
path.write_text(text)
