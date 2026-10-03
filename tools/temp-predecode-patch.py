from pathlib import Path

path = Path('apps/web/src/pages/logger-page.ts')
text = path.read_text()

anchor = "const MAX_ACTIVE_WEB_TRACES = 8;\n"
insert = """const MAX_ACTIVE_WEB_TRACES = 8;\nconst OPPORTUNISTIC_PREDECODE_OPTIONS = new Set([32, 64, 128]);\n\nfunction opportunisticPredecodeTarget(): number {\n  const raw = new URLSearchParams(globalThis.location?.search ?? '').get('predecode');\n  const parsed = Number(raw);\n  return OPPORTUNISTIC_PREDECODE_OPTIONS.has(parsed) ? parsed : 0;\n}\n"""
assert anchor in text
text = text.replace(anchor, insert, 1)

anchor = "    const uniqueRequestedIds = [...new Set(paneRequests.flatMap((request) => request.requestedIds))];\n    const prepareMs = now() - prepareStarted;\n"
replacement = """    const uniqueRequestedIds = [...new Set(paneRequests.flatMap((request) => request.requestedIds))];\n    const predecodeTarget = opportunisticPredecodeTarget();\n    const batchRequestedIds = [...uniqueRequestedIds];\n    if (predecodeTarget > batchRequestedIds.length) {\n      const alreadyRequested = new Set(batchRequestedIds);\n      for (const channelId of channelDefinitions.keys()) {\n        if (batchRequestedIds.length >= predecodeTarget) break;\n        if (alreadyRequested.has(channelId) || unavailableChannelIds.has(channelId)) continue;\n        batchRequestedIds.push(channelId);\n        alreadyRequested.add(channelId);\n      }\n    }\n    const opportunisticPredecodeCount = batchRequestedIds.length - uniqueRequestedIds.length;\n    const prepareMs = now() - prepareStarted;\n"""
assert anchor in text
text = text.replace(anchor, replacement, 1)

text = text.replace(
"        uniqueRequestedIds,\n        0,\n        channelDataSource.sampleCount,\n",
"        batchRequestedIds,\n        0,\n        channelDataSource.sampleCount,\n",
1,
)
text = text.replace(
"        batch.performance.cacheHitChannelIds.length === uniqueRequestedIds.length;\n",
"        batch.performance.cacheHitChannelIds.length === batchRequestedIds.length;\n",
1,
)
text = text.replace(
"        channelName: `Multi-pane restore (${uniqueRequestedIds.length} channels)`,\n",
"        channelName: opportunisticPredecodeCount > 0\n          ? `Multi-pane restore (${uniqueRequestedIds.length} workspace + ${opportunisticPredecodeCount} predecode = ${batchRequestedIds.length} channels)`\n          : `Multi-pane restore (${uniqueRequestedIds.length} channels)`,\n",
1,
)
text = text.replace(
"        batchSize: uniqueRequestedIds.length,\n        cacheHit: batch.performance.cacheHitChannelIds.length === uniqueRequestedIds.length,\n",
"        batchSize: batchRequestedIds.length,\n        cacheHit: batch.performance.cacheHitChannelIds.length === batchRequestedIds.length,\n",
1,
)

path.write_text(text)
