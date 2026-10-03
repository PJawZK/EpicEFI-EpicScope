from pathlib import Path

path = Path('apps/web/src/components/graph-viewport.ts')
text = path.read_text()

old = "              await dataSource.readChannelRange(\n                channelId,\n                requestRange.startSampleIndex,\n                requestRange.sampleCount,\n              ),\n"
new = "              await dataSource.readChannelRange(\n                channelId,\n                0,\n                dataSource.sampleCount,\n              ),\n"
if old not in text:
    raise SystemExit('promotion fallback range not found')
text = text.replace(old, new, 1)

old = "              await channelData!.readChannelRange(channelId, 0, channelData!.sampleCount),\n"
new = "              await channelData!.readChannelRange(\n                channelId,\n                requestRange.startSampleIndex,\n                requestRange.sampleCount,\n              ),\n"
if old not in text:
    raise SystemExit('viewport fallback range not found')
text = text.replace(old, new, 1)

path.write_text(text)
