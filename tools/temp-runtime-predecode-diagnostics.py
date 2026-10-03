from pathlib import Path

path = Path('apps/web/src/pages/logger-page.ts')
text = path.read_text()

old_import = "import { createChannelValueSearchPanel } from '../panels/channel-value-search-panel';\n"
new_import = old_import + "import { buildOpportunisticPredecodeSelection } from '../performance/opportunistic-predecode';\n"
if old_import not in text:
    raise SystemExit('import anchor not found')
text = text.replace(old_import, new_import, 1)

old_block = """    const uniqueRequestedIds = [...new Set(paneRequests.flatMap((request) => request.requestedIds))];\n    const predecodeTarget = opportunisticPredecodeTarget();\n    const batchRequestedIds = [...uniqueRequestedIds];\n    if (predecodeTarget > batchRequestedIds.length) {\n      const alreadyRequested = new Set(batchRequestedIds);\n      for (const channelId of channelDefinitions.keys()) {\n        if (batchRequestedIds.length >= predecodeTarget) break;\n        if (alreadyRequested.has(channelId) || unavailableChannelIds.has(channelId)) continue;\n        batchRequestedIds.push(channelId);\n        alreadyRequested.add(channelId);\n      }\n    }\n    const opportunisticPredecodeCount = batchRequestedIds.length - uniqueRequestedIds.length;\n"""
new_block = """    const uniqueRequestedIds = [...new Set(paneRequests.flatMap((request) => request.requestedIds))];\n    const predecodeTarget = opportunisticPredecodeTarget();\n    const predecodeSelection = buildOpportunisticPredecodeSelection(\n      uniqueRequestedIds,\n      channelDefinitions,\n      unavailableChannelIds,\n      predecodeTarget,\n    );\n    const batchRequestedIds = [...predecodeSelection.batchIds];\n    const opportunisticPredecodeCount = predecodeSelection.opportunisticIds.length;\n"""
if old_block not in text:
    raise SystemExit('selection block not found')
text = text.replace(old_block, new_block, 1)

old_name = """        channelName: opportunisticPredecodeCount > 0\n          ? `Multi-pane restore (${uniqueRequestedIds.length} workspace + ${opportunisticPredecodeCount} predecode = ${batchRequestedIds.length} channels)`\n          : `Multi-pane restore (${uniqueRequestedIds.length} channels)`,\n"""
new_name = """        channelName: opportunisticPredecodeCount > 0\n          ? `Multi-pane restore (${uniqueRequestedIds.length} workspace + ${opportunisticPredecodeCount} predecode = ${batchRequestedIds.length} channels); predecode=[${predecodeSelection.opportunisticLabels.join(', ')}]`\n          : `Multi-pane restore (${uniqueRequestedIds.length} channels)`,\n"""
if old_name not in text:
    raise SystemExit('diagnostic name block not found')
text = text.replace(old_name, new_name, 1)

path.write_text(text)
