from pathlib import Path

# Instrument logger-page restore prepare/final sync phases.
p = Path('apps/web/src/pages/logger-page.ts')
s = p.read_text()

old = '''  const syncActivePaneContext = (): void => {\n    const runtime = activePaneRuntime();\n    const pane = activePaneState();\n    const assignedIds = renderablePersistentChannelIds(pane?.channelIds ?? []);\n    inspector.setActiveChannels(assignedIds);\n    inspector.setQueuedChannels([]);\n    valueSearch.setActiveChannels(\n      runtime\n        ? [...runtime.activeChannelIds].flatMap((id) => {\n            const channel = channelDefinitions.get(id);\n            return channel ? [channel] : [];\n          })\n        : [],\n    );\n    if (runtime) syncPaneAssignedChannels(runtime, pane);\n    timeline.setOverviewContent(runtime?.graph.getOverviewTraces() ?? [], logMarkers);\n  };\n'''
new = '''  interface ActivePaneSyncPerformance {\n    readonly resolveMs: number;\n    readonly assignedNormalizeMs: number;\n    readonly inspectorActiveMs: number;\n    readonly inspectorQueuedMs: number;\n    readonly valueSearchMs: number;\n    readonly assignedSyncMs: number;\n    readonly overviewMs: number;\n    readonly totalMs: number;\n  }\n\n  const syncActivePaneContext = (): ActivePaneSyncPerformance => {\n    const now = (): number => globalThis.performance?.now() ?? Date.now();\n    const started = now();\n    let stageStarted = started;\n    const runtime = activePaneRuntime();\n    const pane = activePaneState();\n    const resolveMs = now() - stageStarted;\n\n    stageStarted = now();\n    const assignedIds = renderablePersistentChannelIds(pane?.channelIds ?? []);\n    const assignedNormalizeMs = now() - stageStarted;\n\n    stageStarted = now();\n    inspector.setActiveChannels(assignedIds);\n    const inspectorActiveMs = now() - stageStarted;\n\n    stageStarted = now();\n    inspector.setQueuedChannels([]);\n    const inspectorQueuedMs = now() - stageStarted;\n\n    stageStarted = now();\n    valueSearch.setActiveChannels(\n      runtime\n        ? [...runtime.activeChannelIds].flatMap((id) => {\n            const channel = channelDefinitions.get(id);\n            return channel ? [channel] : [];\n          })\n        : [],\n    );\n    const valueSearchMs = now() - stageStarted;\n\n    stageStarted = now();\n    if (runtime) syncPaneAssignedChannels(runtime, pane);\n    const assignedSyncMs = now() - stageStarted;\n\n    stageStarted = now();\n    timeline.setOverviewContent(runtime?.graph.getOverviewTraces() ?? [], logMarkers);\n    const overviewMs = now() - stageStarted;\n\n    return {\n      resolveMs, assignedNormalizeMs, inspectorActiveMs, inspectorQueuedMs,\n      valueSearchMs, assignedSyncMs, overviewMs, totalMs: now() - started,\n    };\n  };\n'''
assert old in s, 'syncActivePaneContext anchor missing'
s = s.replace(old, new, 1)

old = '''    const prepareStarted = now();\n    const generation = ++workspaceGeneration;\n    activeWorkspaceId = target.id;\n    refreshWorkspaceSelector();\n    refreshViewHistoryState();\n\n    paneRuntimes.forEach((runtime) => {\n      runtime.graph.clearChannels();\n      runtime.activeChannelIds.clear();\n    });\n    inspector.setActiveChannels([]);\n    inspector.setQueuedChannels([]);\n    valueSearch.setActiveChannels([]);\n    timeline.setOverviewContent([], logMarkers);\n\n    renderGraphLayout();\n    if (target.viewport) syncViewport({ ...target.viewport });\n    setCursorWithoutFollow(target.cursorTimeMs);\n\n    const visibleCount = paneCountForLayout(target.layout);\n'''
new = '''    const prepareStarted = now();\n    let prepareStageStarted = prepareStarted;\n    const generation = ++workspaceGeneration;\n    activeWorkspaceId = target.id;\n    refreshWorkspaceSelector();\n    refreshViewHistoryState();\n    const prepareStateMs = now() - prepareStageStarted;\n\n    prepareStageStarted = now();\n    paneRuntimes.forEach((runtime) => {\n      runtime.graph.clearChannels();\n      runtime.activeChannelIds.clear();\n    });\n    inspector.setActiveChannels([]);\n    inspector.setQueuedChannels([]);\n    valueSearch.setActiveChannels([]);\n    timeline.setOverviewContent([], logMarkers);\n    const prepareClearMs = now() - prepareStageStarted;\n\n    prepareStageStarted = now();\n    renderGraphLayout();\n    const prepareLayoutMs = now() - prepareStageStarted;\n\n    prepareStageStarted = now();\n    if (target.viewport) syncViewport({ ...target.viewport });\n    setCursorWithoutFollow(target.cursorTimeMs);\n    const prepareViewportMs = now() - prepareStageStarted;\n\n    prepareStageStarted = now();\n    const visibleCount = paneCountForLayout(target.layout);\n'''
assert old in s, 'prepare initial anchor missing'
s = s.replace(old, new, 1)

old = '''    const uniqueRequestedIds = [...new Set(paneRequests.flatMap((request) => request.requestedIds))];\n    const predecodeTarget = opportunisticPredecodeTarget();\n'''
new = '''    const preparePaneRequestsMs = now() - prepareStageStarted;\n\n    prepareStageStarted = now();\n    const uniqueRequestedIds = [...new Set(paneRequests.flatMap((request) => request.requestedIds))];\n    const predecodeTarget = opportunisticPredecodeTarget();\n'''
assert old in s, 'pane requests anchor missing'
s = s.replace(old, new, 1)

old = '''    const opportunisticPredecodeCount = batchRequestedIds.length - uniqueRequestedIds.length;\n    const prepareMs = now() - prepareStarted;\n'''
new = '''    const opportunisticPredecodeCount = batchRequestedIds.length - uniqueRequestedIds.length;\n    const prepareBatchPlanMs = now() - prepareStageStarted;\n    const prepareMs = now() - prepareStarted;\n'''
assert old in s, 'prepare end anchor missing'
s = s.replace(old, new, 1)

old = '''    const finalSyncStarted = now();\n    syncActivePaneContext();\n    const finalSyncMs = now() - finalSyncStarted;\n    workspaceRestorePerformanceListener?.({\n      totalMs: now() - restoreStarted,\n      prepareMs,\n'''
new = '''    const finalSyncStarted = now();\n    const finalSyncPerformance = syncActivePaneContext();\n    const finalSyncMs = now() - finalSyncStarted;\n    workspaceRestorePerformanceListener?.({\n      totalMs: now() - restoreStarted,\n      prepareMs,\n      prepareStateMs,\n      prepareClearMs,\n      prepareLayoutMs,\n      prepareViewportMs,\n      preparePaneRequestsMs,\n      prepareBatchPlanMs,\n'''
assert old in s, 'final sync anchor missing'
s = s.replace(old, new, 1)

old = '''      activationEnvelopeMs,\n      finalSyncMs,\n      visiblePaneCount: visibleCount,\n'''
new = '''      activationEnvelopeMs,\n      finalSyncMs,\n      finalSyncResolveMs: finalSyncPerformance.resolveMs,\n      finalSyncAssignedNormalizeMs: finalSyncPerformance.assignedNormalizeMs,\n      finalSyncInspectorActiveMs: finalSyncPerformance.inspectorActiveMs,\n      finalSyncInspectorQueuedMs: finalSyncPerformance.inspectorQueuedMs,\n      finalSyncValueSearchMs: finalSyncPerformance.valueSearchMs,\n      finalSyncAssignedSyncMs: finalSyncPerformance.assignedSyncMs,\n      finalSyncOverviewMs: finalSyncPerformance.overviewMs,\n      visiblePaneCount: visibleCount,\n'''
assert old in s, 'performance payload anchor missing'
s = s.replace(old, new, 1)
p.write_text(s)

# Extend diagnostics model/report.
p = Path('apps/web/src/components/performance-diagnostics.ts')
s = p.read_text()
old = '''  readonly prepareMs: number;\n  readonly sharedBatchMs: number;\n'''
new = '''  readonly prepareMs: number;\n  readonly prepareStateMs: number;\n  readonly prepareClearMs: number;\n  readonly prepareLayoutMs: number;\n  readonly prepareViewportMs: number;\n  readonly preparePaneRequestsMs: number;\n  readonly prepareBatchPlanMs: number;\n  readonly sharedBatchMs: number;\n'''
assert old in s, 'diagnostics prepare interface anchor missing'
s = s.replace(old, new, 1)
old = '''  readonly finalSyncMs: number;\n  readonly visiblePaneCount: number;\n'''
new = '''  readonly finalSyncMs: number;\n  readonly finalSyncResolveMs: number;\n  readonly finalSyncAssignedNormalizeMs: number;\n  readonly finalSyncInspectorActiveMs: number;\n  readonly finalSyncInspectorQueuedMs: number;\n  readonly finalSyncValueSearchMs: number;\n  readonly finalSyncAssignedSyncMs: number;\n  readonly finalSyncOverviewMs: number;\n  readonly visiblePaneCount: number;\n'''
assert old in s, 'diagnostics final sync interface anchor missing'
s = s.replace(old, new, 1)
old = '''        `prepare=${latestRestore.prepareMs.toFixed(2)} ms`,\n        `sharedBatch=${latestRestore.sharedBatchMs.toFixed(2)} ms`,\n'''
new = '''        `prepare=${latestRestore.prepareMs.toFixed(2)} ms`,\n        `prepareState=${latestRestore.prepareStateMs.toFixed(2)} ms`,\n        `prepareClear=${latestRestore.prepareClearMs.toFixed(2)} ms`,\n        `prepareLayout=${latestRestore.prepareLayoutMs.toFixed(2)} ms`,\n        `prepareViewport=${latestRestore.prepareViewportMs.toFixed(2)} ms`,\n        `preparePaneRequests=${latestRestore.preparePaneRequestsMs.toFixed(2)} ms`,\n        `prepareBatchPlan=${latestRestore.prepareBatchPlanMs.toFixed(2)} ms`,\n        `prepareRemainder=${Math.max(0, latestRestore.prepareMs - latestRestore.prepareStateMs - latestRestore.prepareClearMs - latestRestore.prepareLayoutMs - latestRestore.prepareViewportMs - latestRestore.preparePaneRequestsMs - latestRestore.prepareBatchPlanMs).toFixed(2)} ms`,\n        `sharedBatch=${latestRestore.sharedBatchMs.toFixed(2)} ms`,\n'''
assert old in s, 'report prepare anchor missing'
s = s.replace(old, new, 1)
old = '''        `finalSync=${latestRestore.finalSyncMs.toFixed(2)} ms`,\n        `visiblePanes=${latestRestore.visiblePaneCount}`,\n'''
new = '''        `finalSync=${latestRestore.finalSyncMs.toFixed(2)} ms`,\n        `finalSyncResolve=${latestRestore.finalSyncResolveMs.toFixed(2)} ms`,\n        `finalSyncAssignedNormalize=${latestRestore.finalSyncAssignedNormalizeMs.toFixed(2)} ms`,\n        `finalSyncInspectorActive=${latestRestore.finalSyncInspectorActiveMs.toFixed(2)} ms`,\n        `finalSyncInspectorQueued=${latestRestore.finalSyncInspectorQueuedMs.toFixed(2)} ms`,\n        `finalSyncValueSearch=${latestRestore.finalSyncValueSearchMs.toFixed(2)} ms`,\n        `finalSyncAssignedSync=${latestRestore.finalSyncAssignedSyncMs.toFixed(2)} ms`,\n        `finalSyncOverview=${latestRestore.finalSyncOverviewMs.toFixed(2)} ms`,\n        `finalSyncRemainder=${Math.max(0, latestRestore.finalSyncMs - latestRestore.finalSyncResolveMs - latestRestore.finalSyncAssignedNormalizeMs - latestRestore.finalSyncInspectorActiveMs - latestRestore.finalSyncInspectorQueuedMs - latestRestore.finalSyncValueSearchMs - latestRestore.finalSyncAssignedSyncMs - latestRestore.finalSyncOverviewMs).toFixed(2)} ms`,\n        `visiblePanes=${latestRestore.visiblePaneCount}`,\n'''
assert old in s, 'report final sync anchor missing'
s = s.replace(old, new, 1)
p.write_text(s)
