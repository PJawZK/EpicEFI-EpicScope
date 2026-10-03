from pathlib import Path

path = Path('apps/web/src/pages/logger-page.ts')
text = path.read_text()
old = "      channelPerformanceListener?.({\n        channelId: '__multi-pane-restore__',\n        channelName: `Multi-pane restore (${uniqueRequestedIds.length} channels)`,\n        totalMs: batchElapsed,\n"
new = "      channelPerformanceListener?.({\n        channelId: '__multi-pane-restore__',\n        channelName: `Multi-pane restore (${uniqueRequestedIds.length} channels)`,\n        phase: 'full',\n        startSampleIndex: 0,\n        requestedSampleCount: channelDataSource.sampleCount,\n        totalMs: batchElapsed,\n"
if old not in text:
    raise SystemExit('multi-pane performance event not found')
path.write_text(text.replace(old, new, 1))

error_file = Path('TYPECHECK_ERROR.txt')
if error_file.exists():
    error_file.unlink()
