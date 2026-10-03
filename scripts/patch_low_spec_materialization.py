from pathlib import Path

p = Path('apps/web/src/components/graph-viewport.ts')
s = p.read_text()

s = s.replace(
"const PROGRESSIVE_FILL_LOW_SPEC_MAX_STEP_SAMPLES = 32_768;\n",
"const PROGRESSIVE_FILL_LOW_SPEC_MAX_STEP_SAMPLES = 32_768;\nconst MATERIALIZATION_DESKTOP_DELAY_MS = 120;\nconst MATERIALIZATION_LOW_SPEC_IDLE_DELAY_MS = 1_000;\n"
)

s = s.replace(
"  const materializingTraceIds = new Set<string>();\n  let decodeInFlight = false;",
"  const materializingTraceIds = new Set<string>();\n  const materializationTimers = new Map<string, number>();\n  let decodeInFlight = false;"
)

old = """        const activated = activeTraces.get(channelId);\n        if (activated && !activated.statisticsComplete) {\n          window.setTimeout(() => { void materializeActiveChannel(channelId); }, 120);\n        }\n"""
new = """        const activated = activeTraces.get(channelId);\n        if (activated && !activated.statisticsComplete) scheduleMaterialization(channelId);\n"""
if old not in s:
    raise SystemExit('activation materialization anchor not found')
s = s.replace(old, new, 1)

anchor = """  const materializeActiveChannel = async (channelId: string): Promise<void> => {\n"""
insert = """  const scheduleMaterialization = (channelId: string): void => {\n    const existingTimer = materializationTimers.get(channelId);\n    if (existingTimer !== undefined) window.clearTimeout(existingTimer);\n    const logicalThreads = Math.max(1, globalThis.navigator?.hardwareConcurrency ?? 1);\n    const delayMs = logicalThreads <= 3\n      ? MATERIALIZATION_LOW_SPEC_IDLE_DELAY_MS\n      : MATERIALIZATION_DESKTOP_DELAY_MS;\n    const timer = window.setTimeout(() => {\n      materializationTimers.delete(channelId);\n      void materializeActiveChannel(channelId);\n    }, delayMs);\n    materializationTimers.set(channelId, timer);\n  };\n\n"""
if anchor not in s:
    raise SystemExit('materialize function anchor not found')
s = s.replace(anchor, insert + anchor, 1)

old_scale = """      const scaleStart = now();\n      const scale = buildStableValueScale(range);\n      const scaleMs = now() - scaleStart;\n      activeTraces.set(channelId, {\n        ...latest,\n        range,\n        scale,\n"""
new_scale = """      const scaleMs = 0;\n      activeTraces.set(channelId, {\n        ...latest,\n        range,\n        scale: latest.scale,\n"""
if old_scale not in s:
    raise SystemExit('materialization scale anchor not found')
s = s.replace(old_scale, new_scale, 1)

# Reschedule low-spec pending materialization whenever the viewport changes, so full I/O starts only after interaction settles.
old_viewport = """  const setViewport = (nextViewport: TimelineViewport | undefined): void => {\n    viewport = nextViewport;\n"""
new_viewport = """  const setViewport = (nextViewport: TimelineViewport | undefined): void => {\n    viewport = nextViewport;\n    const logicalThreads = Math.max(1, globalThis.navigator?.hardwareConcurrency ?? 1);\n    if (logicalThreads <= 3) {\n      for (const [channelId, trace] of activeTraces) {\n        if (!trace.statisticsComplete && !materializingTraceIds.has(channelId)) {\n          scheduleMaterialization(channelId);\n        }\n      }\n    }\n"""
if old_viewport not in s:
    raise SystemExit('setViewport anchor not found')
s = s.replace(old_viewport, new_viewport, 1)

# Clear timers whenever the graph is reset/cleared. There are two materializingTraceIds.clear() sites.
s = s.replace(
"    materializingTraceIds.clear();\n    activeTraces.clear();",
"    materializingTraceIds.clear();\n    for (const timer of materializationTimers.values()) window.clearTimeout(timer);\n    materializationTimers.clear();\n    activeTraces.clear();"
)

p.write_text(s)
