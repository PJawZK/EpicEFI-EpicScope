from pathlib import Path

p = Path('apps/web/src/components/graph-viewport.ts')
s = p.read_text()

anchor = """function summarizeRange(\n  range: NumericChannelRange,\n  startMs = Number.NEGATIVE_INFINITY,\n  endMs = Number.POSITIVE_INFINITY,\n): {\n"""
if anchor not in s:
    raise SystemExit('summarizeRange anchor missing')

insert_after = """  return {\n    validCount,\n    invalidCount,\n    min: validCount > 0 ? min : undefined,\n    max: validCount > 0 ? max : undefined,\n    mean: validCount > 0 ? mean : undefined,\n    standardDeviation: validCount > 1 ? Math.sqrt(m2 / (validCount - 1)) : validCount === 1 ? 0 : undefined,\n  };\n}\n"""
helper = """\nfunction stableScaleFromStatistics(\n  statistics: ReturnType<typeof summarizeRange>,\n): StableValueScale {\n  const { min, max, validCount } = statistics;\n  if (validCount === 0 || min === undefined || max === undefined) return { min: 0, max: 1 };\n\n  const rawSpan = max - min;\n  const padding = rawSpan > 0\n    ? rawSpan * 0.04\n    : Math.max(1, Math.abs(max) * 0.04);\n\n  const paddedMin = min >= 0 ? Math.max(0, min - padding) : min - padding;\n  const paddedMax = max <= 0 ? Math.min(0, max + padding) : max + padding;\n\n  if (paddedMax > paddedMin) return { min: paddedMin, max: paddedMax };\n  return { min: paddedMin, max: paddedMin + 1 };\n}\n"""
if insert_after not in s:
    raise SystemExit('summarizeRange end missing')
s = s.replace(insert_after, insert_after + helper, 1)

old = """      const scale = buildStableValueScale(range);\n      const color = TRACE_COLORS.find((candidate) => !usedColors.has(candidate)) ?? TRACE_COLORS[0];\n      usedColors.add(color);\n      activeTraces.set(channelId, {\n        channel,\n        range,\n        scale,\n        fullStatistics: summarizeRange(range),\n"""
new = """      const fullStatistics = summarizeRange(range);\n      const scale = stableScaleFromStatistics(fullStatistics);\n      const color = TRACE_COLORS.find((candidate) => !usedColors.has(candidate)) ?? TRACE_COLORS[0];\n      usedColors.add(color);\n      activeTraces.set(channelId, {\n        channel,\n        range,\n        scale,\n        fullStatistics,\n"""
if old not in s:
    raise SystemExit('preloaded activation block missing')
s = s.replace(old, new, 1)

old = """      const scaleStart = now();\n      const scale = buildStableValueScale(range);\n      const scaleMs = now() - scaleStart;\n      const usedColors = new Set([...activeTraces.values()].map((trace) => trace.color));\n      const color = TRACE_COLORS.find((candidate) => !usedColors.has(candidate)) ?? TRACE_COLORS[0];\n      activeTraces.set(channelId, {\n        channel: pending.channel,\n        range,\n        scale,\n        fullStatistics: summarizeRange(range),\n"""
new = """      const scaleStart = now();\n      const fullStatistics = summarizeRange(range);\n      const scale = stableScaleFromStatistics(fullStatistics);\n      const scaleMs = now() - scaleStart;\n      const usedColors = new Set([...activeTraces.values()].map((trace) => trace.color));\n      const color = TRACE_COLORS.find((candidate) => !usedColors.has(candidate)) ?? TRACE_COLORS[0];\n      activeTraces.set(channelId, {\n        channel: pending.channel,\n        range,\n        scale,\n        fullStatistics,\n"""
if old not in s:
    raise SystemExit('cached activation block missing')
s = s.replace(old, new, 1)

old = """          const scaleStart = now();\n          const scale = buildStableValueScale(merged);\n          const scaleMs = now() - scaleStart;\n          activeTraces.set(channelId, {\n            ...latest,\n            range: merged,\n            scale,\n            fullStatistics: summarizeRange(merged),\n"""
new = """          const scaleStart = now();\n          const fullStatistics = summarizeRange(merged);\n          const scale = stableScaleFromStatistics(fullStatistics);\n          const scaleMs = now() - scaleStart;\n          activeTraces.set(channelId, {\n            ...latest,\n            range: merged,\n            scale,\n            fullStatistics,\n"""
if old not in s:
    raise SystemExit('viewport refresh block missing')
s = s.replace(old, new, 1)

old = """      const full = summarizeRange(trace.range);\n      const visible = viewport\n        ? summarizeRange(trace.range, viewport.visibleStartMs, viewport.visibleEndMs)\n        : full;\n"""
new = """      const full = trace.statisticsComplete\n        ? trace.fullStatistics\n        : summarizeRange(trace.range);\n      const visible = viewport\n        ? summarizeRange(trace.range, viewport.visibleStartMs, viewport.visibleEndMs)\n        : full;\n"""
if old not in s:
    raise SystemExit('statistics getter block missing')
s = s.replace(old, new, 1)

p.write_text(s)
