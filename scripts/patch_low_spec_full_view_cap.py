from pathlib import Path

path = Path('apps/web/src/components/graph-viewport.ts')
text = path.read_text()
old = '''    if (candidate.sampleCount <= 0 || candidate.sampleCount >= channelData.sampleCount) {
      return { startSampleIndex: 0, sampleCount: channelData.sampleCount, phase: 'full' };
    }

    const logicalThreads = Math.max(1, globalThis.navigator?.hardwareConcurrency ?? 1);
    if (logicalThreads <= 3 && candidate.sampleCount > LOW_SPEC_INITIAL_VIEWPORT_MAX_SAMPLES) {
      const centeredStart = candidate.startSampleIndex
        + Math.floor((candidate.sampleCount - LOW_SPEC_INITIAL_VIEWPORT_MAX_SAMPLES) / 2);
      const maximumStart = Math.max(0, channelData.sampleCount - LOW_SPEC_INITIAL_VIEWPORT_MAX_SAMPLES);
      return {
        startSampleIndex: Math.min(maximumStart, Math.max(0, centeredStart)),
        sampleCount: LOW_SPEC_INITIAL_VIEWPORT_MAX_SAMPLES,
        phase: 'viewport',
      };
    }

    return { ...candidate, phase: 'viewport' };
'''
new = '''    const logicalThreads = Math.max(1, globalThis.navigator?.hardwareConcurrency ?? 1);
    if (logicalThreads <= 3 && candidate.sampleCount > LOW_SPEC_INITIAL_VIEWPORT_MAX_SAMPLES) {
      const boundedCandidateCount = Math.min(candidate.sampleCount, channelData.sampleCount);
      const candidateStart = candidate.sampleCount >= channelData.sampleCount
        ? 0
        : candidate.startSampleIndex;
      const centeredStart = candidateStart
        + Math.floor((boundedCandidateCount - LOW_SPEC_INITIAL_VIEWPORT_MAX_SAMPLES) / 2);
      const maximumStart = Math.max(0, channelData.sampleCount - LOW_SPEC_INITIAL_VIEWPORT_MAX_SAMPLES);
      return {
        startSampleIndex: Math.min(maximumStart, Math.max(0, centeredStart)),
        sampleCount: LOW_SPEC_INITIAL_VIEWPORT_MAX_SAMPLES,
        phase: 'viewport',
      };
    }

    if (candidate.sampleCount <= 0 || candidate.sampleCount >= channelData.sampleCount) {
      return { startSampleIndex: 0, sampleCount: channelData.sampleCount, phase: 'full' };
    }

    return { ...candidate, phase: 'viewport' };
'''
if old not in text:
    raise SystemExit('target block not found')
path.write_text(text.replace(old, new, 1))
