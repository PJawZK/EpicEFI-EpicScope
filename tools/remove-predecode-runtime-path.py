from pathlib import Path

p = Path('apps/web/src/pages/logger-page.ts')
s = p.read_text()
old_plan = """    const uniqueRequestedIds = [...new Set(paneRequests.flatMap((request) => request.requestedIds))];\n    const predecodeTarget = opportunisticPredecodeTarget();\n    const batchRequestedIds = [...uniqueRequestedIds];\n    if (predecodeTarget > batchRequestedIds.length) {\n      const alreadyRequested = new Set(batchRequestedIds);\n      for (const channelId of channelDefinitions.keys()) {\n        if (batchRequestedIds.length >= predecodeTarget) break;\n        if (alreadyRequested.has(channelId) || unavailableChannelIds.has(channelId)) continue;\n        batchRequestedIds.push(channelId);\n        alreadyRequested.add(channelId);\n      }\n    }\n    const opportunisticPredecodeCount = batchRequestedIds.length - uniqueRequestedIds.length;\n"""
new_plan = """    const uniqueRequestedIds = [...new Set(paneRequests.flatMap((request) => request.requestedIds))];\n    const batchRequestedIds = uniqueRequestedIds;\n"""
if old_plan not in s:
    raise SystemExit('predecode batch-plan block not found')
s = s.replace(old_plan, new_plan, 1)
old_label = """        channelName: opportunisticPredecodeCount > 0\n          ? `Multi-pane restore (${uniqueRequestedIds.length} workspace + ${opportunisticPredecodeCount} predecode = ${batchRequestedIds.length} channels)`\n          : `Multi-pane restore (${uniqueRequestedIds.length} channels)`,\n"""
new_label = """        channelName: `Multi-pane restore (${uniqueRequestedIds.length} channels)`,\n"""
if old_label not in s:
    raise SystemExit('predecode diagnostics label block not found')
s = s.replace(old_label, new_label, 1)
p.write_text(s)
