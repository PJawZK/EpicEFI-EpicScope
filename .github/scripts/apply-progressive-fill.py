from pathlib import Path

path = Path('apps/web/src/components/graph-viewport.ts')
text = path.read_text()

needle = "const TRACE_COLORS = ['#42a5f5', '#26c6a3', '#f0b44d', '#c98cff', '#ef6c75', '#70d6ff', '#b8d95a', '#ff8c42'] as const;\n"
replacement = needle + "const PROGRESSIVE_FILL_STEP_SAMPLES = 16_384;\n"
if 'PROGRESSIVE_FILL_STEP_SAMPLES' not in text:
    if needle not in text:
        raise SystemExit('TRACE_COLORS anchor not found')
    text = text.replace(needle, replacement, 1)

start = text.index('  const rangeCovers = (')
end = text.index('  const scheduleViewportRefresh =', start)
new_block = r'''  const rangeCovers = (
    range: NumericChannelRange,
    startSampleIndex: number,
    sampleCount: number,
  ): boolean => {
    const rangeEnd = range.startSampleIndex + range.values.length;
    return startSampleIndex >= range.startSampleIndex
      && startSampleIndex + sampleCount <= rangeEnd;
  };

  const mergeContiguousRanges = (
    first: NumericChannelRange,
    second: NumericChannelRange,
  ): NumericChannelRange => {
    if (first.values.length === 0) return second;
    if (second.values.length === 0) return first;
    const firstEnd = first.startSampleIndex + first.values.length;
    const secondEnd = second.startSampleIndex + second.values.length;
    if (firstEnd < second.startSampleIndex || secondEnd < first.startSampleIndex) return second;

    const startSampleIndex = Math.min(first.startSampleIndex, second.startSampleIndex);
    const endSampleIndex = Math.max(firstEnd, secondEnd);
    const sampleCount = endSampleIndex - startSampleIndex;
    const timeMs = new Float64Array(sampleCount);
    const values = new Float64Array(sampleCount);
    const validity = new Uint8Array(sampleCount);

    const copy = (range: NumericChannelRange): void => {
      const offset = range.startSampleIndex - startSampleIndex;
      timeMs.set(range.timeMs, offset);
      values.set(range.values, offset);
      validity.set(range.validity, offset);
    };
    copy(first);
    copy(second);
    return { startSampleIndex, timeMs, values, validity };
  };

  const refreshActiveViewportRanges = async (generation: number): Promise<void> => {
    const dataSource = channelData;
    if (!dataSource || !viewport || activeTraces.size === 0) return;
    if (decodeInFlight) {
      if (generation === viewportRefreshGeneration) scheduleViewportRefresh();
      return;
    }

    const requestRange = currentChannelReadRange();
    const desiredStart = requestRange.startSampleIndex;
    const desiredEnd = desiredStart + requestRange.sampleCount;
    const channelIds = [...activeTraces.entries()]
      .filter(([, trace]) => !rangeCovers(trace.range, desiredStart, requestRange.sampleCount))
      .map(([channelId]) => channelId);
    if (channelIds.length === 0) return;

    const now = (): number => globalThis.performance?.now() ?? Date.now();

    for (const channelId of channelIds) {
      let preferLeft = true;
      while (generation === viewportRefreshGeneration) {
        const existing = activeTraces.get(channelId);
        if (!existing || rangeCovers(existing.range, desiredStart, requestRange.sampleCount)) break;

        const existingStart = existing.range.startSampleIndex;
        const existingEnd = existingStart + existing.range.values.length;
        const disjointLeft = desiredEnd < existingStart;
        const disjointRight = desiredStart > existingEnd;

        let chunkStart: number;
        let chunkCount: number;
        let replaceExisting = false;

        if (disjointLeft || disjointRight) {
          chunkStart = desiredStart;
          chunkCount = Math.min(PROGRESSIVE_FILL_STEP_SAMPLES, requestRange.sampleCount);
          replaceExisting = true;
        } else {
          const missingLeft = Math.max(0, existingStart - desiredStart);
          const missingRight = Math.max(0, desiredEnd - existingEnd);
          if (missingLeft <= 0 && missingRight <= 0) break;

          if (missingLeft > 0 && (missingRight <= 0 || preferLeft)) {
            chunkCount = Math.min(PROGRESSIVE_FILL_STEP_SAMPLES, missingLeft);
            chunkStart = existingStart - chunkCount;
            preferLeft = false;
          } else {
            chunkStart = existingEnd;
            chunkCount = Math.min(PROGRESSIVE_FILL_STEP_SAMPLES, missingRight);
            preferLeft = true;
          }
        }

        if (chunkCount <= 0) break;
        const readStart = now();
        try {
          const result = dataSource.readChannelsRange
            ? await dataSource.readChannelsRange([channelId], chunkStart, chunkCount)
            : {
                ranges: new Map([[channelId, await dataSource.readChannelRange(
                  channelId,
                  chunkStart,
                  chunkCount,
                )]]),
                performance: {
                  channelCount: 1,
                  cacheHitChannelIds: [] as readonly string[],
                  physicalReadCount: 0,
                  physicalBytesRead: 0,
                  physicalReadMs: 0,
                },
              };
          const readDecodeMs = now() - readStart;
          if (generation !== viewportRefreshGeneration) return;

          const nextRange = result.ranges.get(channelId);
          const latest = activeTraces.get(channelId);
          if (!nextRange || !latest) break;
          const merged = replaceExisting
            ? nextRange
            : mergeContiguousRanges(latest.range, nextRange);

          const scaleStart = now();
          const scale = buildStableValueScale(merged);
          const scaleMs = now() - scaleStart;
          activeTraces.set(channelId, {
            ...latest,
            range: merged,
            scale,
            fullStatistics: summarizeRange(merged),
            statisticsComplete: merged.startSampleIndex === 0
              && merged.values.length === dataSource.sampleCount,
          });
          envelopeCache.delete(channelId);

          renderReadout();
          emitCursorValues();
          const renderStart = now();
          draw();
          const renderMs = now() - renderStart;
          const completedMs = now();
          channelPerformanceListener?.({
            channelId,
            phase: requestRange.phase,
            startSampleIndex: chunkStart,
            requestedSampleCount: chunkCount,
            totalMs: completedMs - readStart,
            readDecodeMs,
            scaleMs,
            renderMs,
            sampleCount: nextRange.values.length,
            batchSize: 1,
            cacheHit: result.performance.cacheHitChannelIds.includes(channelId),
            physicalReadCount: result.performance.physicalReadCount,
            physicalBytesRead: result.performance.physicalBytesRead,
            physicalReadMs: result.performance.physicalReadMs,
          });
        } catch {
          // Keep already decoded coverage visible if a progressive refill fails.
          break;
        }
      }
    }
  };

'''
text = text[:start] + new_block + text[end:]
path.write_text(text)
