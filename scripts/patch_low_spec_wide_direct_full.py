from pathlib import Path

path = Path('apps/web/src/components/graph-viewport.ts')
text = path.read_text()
old = '''    const logicalThreads = Math.max(1, globalThis.navigator?.hardwareConcurrency ?? 1);\n    if (logicalThreads <= 3 && candidate.sampleCount > LOW_SPEC_INITIAL_VIEWPORT_MAX_SAMPLES) {\n      const boundedCandidateCount = Math.min(candidate.sampleCount, channelData.sampleCount);\n      const candidateStart = candidate.sampleCount >= channelData.sampleCount\n        ? 0\n        : candidate.startSampleIndex;\n      const centeredStart = candidateStart\n        + Math.floor((boundedCandidateCount - LOW_SPEC_INITIAL_VIEWPORT_MAX_SAMPLES) / 2);\n      const maximumStart = Math.max(0, channelData.sampleCount - LOW_SPEC_INITIAL_VIEWPORT_MAX_SAMPLES);\n      return {\n        startSampleIndex: Math.min(maximumStart, Math.max(0, centeredStart)),\n        sampleCount: LOW_SPEC_INITIAL_VIEWPORT_MAX_SAMPLES,\n        phase: 'viewport',\n      };\n    }\n\n    if (candidate.sampleCount <= 0 || candidate.sampleCount >= channelData.sampleCount) {\n      return { startSampleIndex: 0, sampleCount: channelData.sampleCount, phase: 'full' };\n    }\n'''
new = '''    const logicalThreads = Math.max(1, globalThis.navigator?.hardwareConcurrency ?? 1);\n    if (logicalThreads <= 3 && candidate.sampleCount > LOW_SPEC_INITIAL_VIEWPORT_MAX_SAMPLES) {\n      return { startSampleIndex: 0, sampleCount: channelData.sampleCount, phase: 'full' };\n    }\n\n    if (candidate.sampleCount <= 0 || candidate.sampleCount >= channelData.sampleCount) {\n      return { startSampleIndex: 0, sampleCount: channelData.sampleCount, phase: 'full' };\n    }\n'''
if old not in text:
    raise SystemExit('target block not found')
path.write_text(text.replace(old, new, 1))
