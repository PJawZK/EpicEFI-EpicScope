from pathlib import Path

path = Path('apps/web/src/components/graph-viewport.ts')
text = path.read_text()

text = text.replace(
"const MATERIALIZATION_LOW_SPEC_IDLE_DELAY_MS = 1_000;\n",
"const MATERIALIZATION_LOW_SPEC_IDLE_DELAY_MS = 1_000;\nconst LOW_SPEC_INITIAL_VIEWPORT_MAX_SAMPLES = 16_384;\n",
)

old = """    if (candidate.sampleCount <= 0 || candidate.sampleCount >= channelData.sampleCount) {\n      return { startSampleIndex: 0, sampleCount: channelData.sampleCount, phase: 'full' };\n    }\n    return { ...candidate, phase: 'viewport' };\n"""
new = """    if (candidate.sampleCount <= 0 || candidate.sampleCount >= channelData.sampleCount) {\n      return { startSampleIndex: 0, sampleCount: channelData.sampleCount, phase: 'full' };\n    }\n\n    const logicalThreads = Math.max(1, globalThis.navigator?.hardwareConcurrency ?? 1);\n    if (logicalThreads <= 3 && candidate.sampleCount > LOW_SPEC_INITIAL_VIEWPORT_MAX_SAMPLES) {\n      const centeredStart = candidate.startSampleIndex\n        + Math.floor((candidate.sampleCount - LOW_SPEC_INITIAL_VIEWPORT_MAX_SAMPLES) / 2);\n      const maximumStart = Math.max(0, channelData.sampleCount - LOW_SPEC_INITIAL_VIEWPORT_MAX_SAMPLES);\n      return {\n        startSampleIndex: Math.min(maximumStart, Math.max(0, centeredStart)),\n        sampleCount: LOW_SPEC_INITIAL_VIEWPORT_MAX_SAMPLES,\n        phase: 'viewport',\n      };\n    }\n\n    return { ...candidate, phase: 'viewport' };\n"""
if old not in text:
    raise SystemExit('target block not found')
text = text.replace(old, new)
path.write_text(text)
