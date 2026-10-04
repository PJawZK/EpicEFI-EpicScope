from pathlib import Path

# graph-viewport.ts
p = Path('apps/web/src/components/graph-viewport.ts')
s = p.read_text()

old = """export interface GraphChannelPerformance {\n  readonly channelId: string;\n  readonly phase: 'viewport' | 'full' | 'cache';\n  readonly startSampleIndex: number;\n  readonly requestedSampleCount: number;\n  readonly totalMs: number;\n  readonly readDecodeMs: number;\n  readonly scaleMs: number;\n  readonly renderMs: number;\n  readonly sampleCount: number;\n  readonly batchSize: number;\n  readonly cacheHit: boolean;\n  readonly physicalReadCount: number;\n  readonly physicalBytesRead: number;\n  readonly physicalReadMs: number;\n}\n\nexport type GraphViewportDisplayMode = 'overlay' | 'stacked';\n"""
new = """export interface GraphChannelPerformance {\n  readonly channelId: string;\n  readonly phase: 'viewport' | 'full' | 'cache';\n  readonly startSampleIndex: number;\n  readonly requestedSampleCount: number;\n  readonly totalMs: number;\n  readonly readDecodeMs: number;\n  readonly scaleMs: number;\n  readonly renderMs: number;\n  readonly sampleCount: number;\n  readonly batchSize: number;\n  readonly cacheHit: boolean;\n  readonly physicalReadCount: number;\n  readonly physicalBytesRead: number;\n  readonly physicalReadMs: number;\n}\n\nexport interface GraphPreloadedActivationPerformance {\n  readonly totalMs: number;\n  readonly channelLookupMs: number;\n  readonly statisticsScaleMs: number;\n  readonly traceRegistrationMs: number;\n  readonly readoutMs: number;\n  readonly cursorMs: number;\n  readonly drawMs: number;\n  readonly envelopeMs: number;\n}\n\nexport interface GraphPreloadedActivationResult {\n  readonly activatedChannelIds: readonly string[];\n  readonly performance: GraphPreloadedActivationPerformance;\n}\n\nexport type GraphViewportDisplayMode = 'overlay' | 'stacked';\n"""
assert old in s, 'graph perf interface anchor missing'
s = s.replace(old, new, 1)

old = """  activatePreloadedChannels(\n    ranges: ReadonlyMap<string, NumericChannelRange>,\n  ): readonly string[];\n"""
new = """  activatePreloadedChannels(\n    ranges: ReadonlyMap<string, NumericChannelRange>,\n  ): GraphPreloadedActivationResult;\n"""
assert old in s, 'graph controller signature missing'
s = s.replace(old, new, 1)

old = """  let displayMode: GraphViewportDisplayMode = 'overlay';\n  let assignedChannels: readonly ChannelDefinition[] = [];\n"""
new = """  let displayMode: GraphViewportDisplayMode = 'overlay';\n  let assignedChannels: readonly ChannelDefinition[] = [];\n  let measureEnvelopeBuild = false;\n  let measuredEnvelopeBuildMs = 0;\n"""
assert old in s, 'graph state anchor missing'
s = s.replace(old, new, 1)

old = """        : buildViewportEnvelope(\n            trace.range,\n            visibleStartMs,\n            visibleEndMs,\n            pixelWidth,\n          );\n"""
new = """        : (() => {\n            const envelopeStarted = measureEnvelopeBuild\n              ? (globalThis.performance?.now() ?? Date.now())\n              : 0;\n            const built = buildViewportEnvelope(\n              trace.range,\n              visibleStartMs,\n              visibleEndMs,\n              pixelWidth,\n            );\n            if (measureEnvelopeBuild) {\n              measuredEnvelopeBuildMs += (globalThis.performance?.now() ?? Date.now()) - envelopeStarted;\n            }\n            return built;\n          })();\n"""
assert old in s, 'envelope build anchor missing'
s = s.replace(old, new, 1)

old = """  const activatePreloadedChannels = (\n    ranges: ReadonlyMap<string, NumericChannelRange>,\n  ): readonly string[] => {\n    if (ranges.size === 0) return [];\n\n    cancelPending();\n    const activated: string[] = [];\n    const usedColors = new Set([...activeTraces.values()].map((trace) => trace.color));\n\n    for (const [channelId, range] of ranges) {\n      if (activeTraces.has(channelId) || activeTraces.size >= MAX_ACTIVE_TRACES) continue;\n      const channel = channels.find((candidate) => candidate.id === channelId);\n      if (!channel) continue;\n\n      const fullStatistics = summarizeRange(range);\n      const scale = stableScaleFromStatistics(fullStatistics);\n      const color = TRACE_COLORS.find((candidate) => !usedColors.has(candidate)) ?? TRACE_COLORS[0];\n      usedColors.add(color);\n      activeTraces.set(channelId, {\n        channel,\n        range,\n        scale,\n        fullStatistics,\n        statisticsComplete: range.startSampleIndex === 0\n          && range.values.length === channelData?.sampleCount,\n        color,\n      });\n      activated.push(channelId);\n    }\n\n    overlay.hidden = activeTraces.size > 0;\n    renderReadout();\n    emitCursorValues();\n    draw();\n    return activated;\n  };\n"""
new = """  const activatePreloadedChannels = (\n    ranges: ReadonlyMap<string, NumericChannelRange>,\n  ): GraphPreloadedActivationResult => {\n    const now = (): number => globalThis.performance?.now() ?? Date.now();\n    const totalStarted = now();\n    if (ranges.size === 0) {\n      return {\n        activatedChannelIds: [],\n        performance: {\n          totalMs: now() - totalStarted,\n          channelLookupMs: 0,\n          statisticsScaleMs: 0,\n          traceRegistrationMs: 0,\n          readoutMs: 0,\n          cursorMs: 0,\n          drawMs: 0,\n          envelopeMs: 0,\n        },\n      };\n    }\n\n    cancelPending();\n    const activated: string[] = [];\n    const usedColors = new Set([...activeTraces.values()].map((trace) => trace.color));\n    let channelLookupMs = 0;\n    let statisticsScaleMs = 0;\n    let traceRegistrationMs = 0;\n\n    for (const [channelId, range] of ranges) {\n      if (activeTraces.has(channelId) || activeTraces.size >= MAX_ACTIVE_TRACES) continue;\n      const lookupStarted = now();\n      const channel = channels.find((candidate) => candidate.id === channelId);\n      channelLookupMs += now() - lookupStarted;\n      if (!channel) continue;\n\n      const statisticsStarted = now();\n      const fullStatistics = summarizeRange(range);\n      const scale = stableScaleFromStatistics(fullStatistics);\n      statisticsScaleMs += now() - statisticsStarted;\n\n      const registrationStarted = now();\n      const color = TRACE_COLORS.find((candidate) => !usedColors.has(candidate)) ?? TRACE_COLORS[0];\n      usedColors.add(color);\n      activeTraces.set(channelId, {\n        channel,\n        range,\n        scale,\n        fullStatistics,\n        statisticsComplete: range.startSampleIndex === 0\n          && range.values.length === channelData?.sampleCount,\n        color,\n      });\n      activated.push(channelId);\n      traceRegistrationMs += now() - registrationStarted;\n    }\n\n    overlay.hidden = activeTraces.size > 0;\n    const readoutStarted = now();\n    renderReadout();\n    const readoutMs = now() - readoutStarted;\n    const cursorStarted = now();\n    emitCursorValues();\n    const cursorMs = now() - cursorStarted;\n    measuredEnvelopeBuildMs = 0;\n    measureEnvelopeBuild = true;\n    const drawStarted = now();\n    try {\n      draw();\n    } finally {\n      measureEnvelopeBuild = false;\n    }\n    const drawMs = now() - drawStarted;\n    const envelopeMs = measuredEnvelopeBuildMs;\n\n    return {\n      activatedChannelIds: activated,\n      performance: {\n        totalMs: now() - totalStarted,\n        channelLookupMs,\n        statisticsScaleMs,\n        traceRegistrationMs,\n        readoutMs,\n        cursorMs,\n        drawMs,\n        envelopeMs,\n      },\n    };\n  };\n"""
assert old in s, 'activatePreloadedChannels block missing'
s = s.replace(old, new, 1)
p.write_text(s)

# logger-page.ts
p = Path('apps/web/src/pages/logger-page.ts')
s = p.read_text()
old = """  readonly activationMs: number;\n  readonly finalSyncMs: number;\n"""
new = """  readonly activationMs: number;\n  readonly activationGraphTotalMs: number;\n  readonly activationChannelLookupMs: number;\n  readonly activationStatisticsScaleMs: number;\n  readonly activationTraceRegistrationMs: number;\n  readonly activationReadoutMs: number;\n  readonly activationCursorMs: number;\n  readonly activationDrawMs: number;\n  readonly activationEnvelopeMs: number;\n  readonly finalSyncMs: number;\n"""
assert old in s, 'logger perf interface anchor missing'
s = s.replace(old, new, 1)

old = """    const activationStarted = now();\n    const loads = paneRequests.map(async ({ runtime, pane, assignedIds, requestedIds }) => {\n"""
new = """    const activationStarted = now();\n    let activationGraphTotalMs = 0;\n    let activationChannelLookupMs = 0;\n    let activationStatisticsScaleMs = 0;\n    let activationTraceRegistrationMs = 0;\n    let activationReadoutMs = 0;\n    let activationCursorMs = 0;\n    let activationDrawMs = 0;\n    let activationEnvelopeMs = 0;\n    const loads = paneRequests.map(async ({ runtime, pane, assignedIds, requestedIds }) => {\n"""
assert old in s, 'activation start anchor missing'
s = s.replace(old, new, 1)

old = """        if (preloaded.size === requestedIds.length) {\n          const activated = runtime.graph.activatePreloadedChannels(preloaded);\n          runtime.activeChannelIds.clear();\n          activated.forEach((channelId) => runtime.activeChannelIds.add(channelId));\n          pane.channelIds = [...assignedIds];\n          return;\n        }\n"""
new = """        if (preloaded.size === requestedIds.length) {\n          const activation = runtime.graph.activatePreloadedChannels(preloaded);\n          const graphPerformance = activation.performance;\n          activationGraphTotalMs += graphPerformance.totalMs;\n          activationChannelLookupMs += graphPerformance.channelLookupMs;\n          activationStatisticsScaleMs += graphPerformance.statisticsScaleMs;\n          activationTraceRegistrationMs += graphPerformance.traceRegistrationMs;\n          activationReadoutMs += graphPerformance.readoutMs;\n          activationCursorMs += graphPerformance.cursorMs;\n          activationDrawMs += graphPerformance.drawMs;\n          activationEnvelopeMs += graphPerformance.envelopeMs;\n          runtime.activeChannelIds.clear();\n          activation.activatedChannelIds.forEach((channelId) => runtime.activeChannelIds.add(channelId));\n          pane.channelIds = [...assignedIds];\n          return;\n        }\n"""
assert old in s, 'logger preloaded activation block missing'
s = s.replace(old, new, 1)

old = """      activationMs,\n      finalSyncMs,\n"""
new = """      activationMs,\n      activationGraphTotalMs,\n      activationChannelLookupMs,\n      activationStatisticsScaleMs,\n      activationTraceRegistrationMs,\n      activationReadoutMs,\n      activationCursorMs,\n      activationDrawMs,\n      activationEnvelopeMs,\n      finalSyncMs,\n"""
assert old in s, 'restore listener payload anchor missing'
s = s.replace(old, new, 1)
p.write_text(s)

# performance-diagnostics.ts
p = Path('apps/web/src/components/performance-diagnostics.ts')
s = p.read_text()
old = """  readonly activationMs: number;\n  readonly finalSyncMs: number;\n"""
new = """  readonly activationMs: number;\n  readonly activationGraphTotalMs: number;\n  readonly activationChannelLookupMs: number;\n  readonly activationStatisticsScaleMs: number;\n  readonly activationTraceRegistrationMs: number;\n  readonly activationReadoutMs: number;\n  readonly activationCursorMs: number;\n  readonly activationDrawMs: number;\n  readonly activationEnvelopeMs: number;\n  readonly finalSyncMs: number;\n"""
assert old in s, 'diagnostics restore interface anchor missing'
s = s.replace(old, new, 1)

old = """        `activation=${latestRestore.activationMs.toFixed(2)} ms`,\n        `finalSync=${latestRestore.finalSyncMs.toFixed(2)} ms`,\n"""
new = """        `activation=${latestRestore.activationMs.toFixed(2)} ms`,\n        `activationGraphTotal=${latestRestore.activationGraphTotalMs.toFixed(2)} ms`,\n        `activationChannelLookup=${latestRestore.activationChannelLookupMs.toFixed(2)} ms`,\n        `activationStatisticsScale=${latestRestore.activationStatisticsScaleMs.toFixed(2)} ms`,\n        `activationTraceRegistration=${latestRestore.activationTraceRegistrationMs.toFixed(2)} ms`,\n        `activationReadout=${latestRestore.activationReadoutMs.toFixed(2)} ms`,\n        `activationCursor=${latestRestore.activationCursorMs.toFixed(2)} ms`,\n        `activationDraw=${latestRestore.activationDrawMs.toFixed(2)} ms`,\n        `activationEnvelope=${latestRestore.activationEnvelopeMs.toFixed(2)} ms`,\n        `activationDrawOther=${Math.max(0, latestRestore.activationDrawMs - latestRestore.activationEnvelopeMs).toFixed(2)} ms`,\n        `activationRemainder=${Math.max(0, latestRestore.activationMs - latestRestore.activationGraphTotalMs).toFixed(2)} ms`,\n        `finalSync=${latestRestore.finalSyncMs.toFixed(2)} ms`,\n"""
assert old in s, 'diagnostics report anchor missing'
s = s.replace(old, new, 1)

old = """        ['Pane activation', ms(latestRestore.activationMs)],\n        ['Final sync', ms(latestRestore.finalSyncMs)],\n"""
new = """        ['Pane activation', ms(latestRestore.activationMs)],\n        ['Graph activation total', ms(latestRestore.activationGraphTotalMs)],\n        ['Statistics + scale', ms(latestRestore.activationStatisticsScaleMs)],\n        ['Graph draw', ms(latestRestore.activationDrawMs)],\n        ['Envelope build', ms(latestRestore.activationEnvelopeMs)],\n        ['Final sync', ms(latestRestore.finalSyncMs)],\n"""
assert old in s, 'diagnostics UI rows anchor missing'
s = s.replace(old, new, 1)
p.write_text(s)
