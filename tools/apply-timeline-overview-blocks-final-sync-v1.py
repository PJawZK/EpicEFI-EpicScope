from pathlib import Path

# Timeline overview: reuse exact precomputed 64-sample envelope blocks before CRC refresh.
p = Path('apps/web/src/components/timeline-shell.ts')
s = p.read_text()
s = s.replace(
    "import { buildViewportEnvelope } from '../../../../core/timeline/viewport-series';",
    "import { buildViewportEnvelope, buildViewportEnvelopeFromBlocks } from '../../../../core/timeline/viewport-series';",
    1,
)
s = s.replace(
    "  refreshOverview(): void;\n  setViewport(viewport: TimelineViewport | undefined): void;",
    "  refreshOverview(): void;\n  refreshValidity(): void;\n  setViewport(viewport: TimelineViewport | undefined): void;",
    1,
)
s = s.replace(
    "  let overviewTracesVisible = true;\n",
    "  let overviewTracesVisible = true;\n  let precomputedEnvelopeBlocksEnabled = true;\n",
    1,
)
s = s.replace(
    "  const setTimeRange = (nextRange: LogTimeRange | undefined, recordCount: number): void => {\n    fullStartMs = nextRange?.startMs ?? 0;",
    "  const setTimeRange = (nextRange: LogTimeRange | undefined, recordCount: number): void => {\n    precomputedEnvelopeBlocksEnabled = true;\n    fullStartMs = nextRange?.startMs ?? 0;",
    1,
)
s = s.replace(
    "      const envelope = buildViewportEnvelope(trace.range, fullStartMs, fullEndMs, envelopeWidth);",
    "      const envelope = precomputedEnvelopeBlocksEnabled && trace.range.fullEnvelopeBlocks\n        ? buildViewportEnvelopeFromBlocks(\n            trace.range,\n            trace.range.fullEnvelopeBlocks,\n            fullStartMs,\n            fullEndMs,\n            envelopeWidth,\n          )\n        : buildViewportEnvelope(trace.range, fullStartMs, fullEndMs, envelopeWidth);",
    1,
)
s = s.replace(
    "    setOverviewContent,\n    refreshOverview: renderOverview,\n    setViewport,",
    "    setOverviewContent,\n    refreshOverview: renderOverview,\n    refreshValidity: () => {\n      precomputedEnvelopeBlocksEnabled = false;\n      renderOverview();\n    },\n    setViewport,",
    1,
)
p.write_text(s)

# Logger restore: avoid re-running active-pane assigned-channel/readout sync after layout already did it.
p = Path('apps/web/src/pages/logger-page.ts')
s = p.read_text()
s = s.replace(
    "  const syncActivePaneContext = (): ActivePaneSyncPerformance => {",
    "  const syncActivePaneContext = (\n    options: { readonly syncAssignedChannels?: boolean } = {},\n  ): ActivePaneSyncPerformance => {",
    1,
)
s = s.replace(
    "    if (runtime) syncPaneAssignedChannels(runtime, pane);\n    const assignedSyncMs = now() - stageStarted;",
    "    if (runtime && options.syncAssignedChannels !== false) syncPaneAssignedChannels(runtime, pane);\n    const assignedSyncMs = now() - stageStarted;",
    1,
)
s = s.replace(
    "    const finalSyncPerformance = syncActivePaneContext();\n    const finalSyncMs = now() - finalSyncStarted;",
    "    const finalSyncPerformance = syncActivePaneContext({ syncAssignedChannels: false });\n    const finalSyncMs = now() - finalSyncStarted;",
    1,
)
s = s.replace(
    "    refreshValidity: () => {\n      paneRuntimes.forEach((runtime) => runtime.graph.refreshValidity());",
    "    refreshValidity: () => {\n      paneRuntimes.forEach((runtime) => runtime.graph.refreshValidity());\n      timeline.refreshValidity();",
    1,
)
p.write_text(s)
