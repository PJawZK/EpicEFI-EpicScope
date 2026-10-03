from pathlib import Path
import re


def replace_once(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'missing {label}')
    return text.replace(old, new, 1)

# --- MLG decoded range cache ---
p = Path('core/parsers/mlg/mlg-channel-data.ts')
s = p.read_text()
s = replace_once(s,
"interface CachedChannel {\n  readonly range: NumericChannelRange;\n  readonly bytes: number;\n}",
"interface CachedChannel {\n  readonly channelId: string;\n  readonly range: NumericChannelRange;\n  readonly bytes: number;\n}", 'cached interface')

old = '''  private cached(channelId: string): NumericChannelRange | undefined {\n    const entry = this.decodedCache.get(channelId);\n    if (!entry) return undefined;\n    this.decodedCache.delete(channelId);\n    this.decodedCache.set(channelId, entry);\n    return entry.range;\n  }\n\n  private cache(channelId: string, range: NumericChannelRange): void {\n    const bytes = range.values.byteLength;\n    if (bytes > DECODED_CHANNEL_CACHE_LIMIT) return;\n\n    const previous = this.decodedCache.get(channelId);\n    if (previous) {\n      this.decodedCache.delete(channelId);\n      this.decodedCacheBytes -= previous.bytes;\n    }\n\n    while (\n      this.decodedCache.size > 0\n      && this.decodedCacheBytes + bytes > DECODED_CHANNEL_CACHE_LIMIT\n    ) {\n      const oldestId = this.decodedCache.keys().next().value as string | undefined;\n      if (!oldestId) break;\n      const oldest = this.decodedCache.get(oldestId);\n      this.decodedCache.delete(oldestId);\n      this.decodedCacheBytes -= oldest?.bytes ?? 0;\n    }\n\n    this.decodedCache.set(channelId, { range, bytes });\n    this.decodedCacheBytes += bytes;\n  }'''
new = '''  private cachedEntryContaining(\n    channelId: string,\n    startSampleIndex: number,\n    sampleCount: number,\n  ): readonly [string, CachedChannel] | undefined {\n    const requestedEnd = startSampleIndex + sampleCount;\n    let match: readonly [string, CachedChannel] | undefined;\n    for (const entry of this.decodedCache) {\n      const [key, cached] = entry;\n      if (cached.channelId !== channelId) continue;\n      const cachedStart = cached.range.startSampleIndex;\n      const cachedEnd = cachedStart + cached.range.values.length;\n      if (startSampleIndex >= cachedStart && requestedEnd <= cachedEnd) match = [key, cached];\n    }\n    return match;\n  }\n\n  private cached(\n    channelId: string,\n    startSampleIndex: number,\n    sampleCount: number,\n  ): NumericChannelRange | undefined {\n    const match = this.cachedEntryContaining(channelId, startSampleIndex, sampleCount);\n    if (!match) return undefined;\n    const [key, entry] = match;\n    this.decodedCache.delete(key);\n    this.decodedCache.set(key, entry);\n\n    const offset = startSampleIndex - entry.range.startSampleIndex;\n    if (offset === 0 && sampleCount === entry.range.values.length) return entry.range;\n    const end = offset + sampleCount;\n    return {\n      startSampleIndex,\n      timeMs: entry.range.timeMs.slice(offset, end),\n      values: entry.range.values.slice(offset, end),\n      validity: entry.range.validity.slice(offset, end),\n    };\n  }\n\n  private cache(channelId: string, range: NumericChannelRange): void {\n    const bytes = range.values.byteLength;\n    if (bytes > DECODED_CHANNEL_CACHE_LIMIT) return;\n    const key = `${channelId}:${range.startSampleIndex}:${range.values.length}`;\n\n    const previous = this.decodedCache.get(key);\n    if (previous) {\n      this.decodedCache.delete(key);\n      this.decodedCacheBytes -= previous.bytes;\n    }\n\n    while (\n      this.decodedCache.size > 0\n      && this.decodedCacheBytes + bytes > DECODED_CHANNEL_CACHE_LIMIT\n    ) {\n      const oldestKey = this.decodedCache.keys().next().value as string | undefined;\n      if (!oldestKey) break;\n      const oldest = this.decodedCache.get(oldestKey);\n      this.decodedCache.delete(oldestKey);\n      this.decodedCacheBytes -= oldest?.bytes ?? 0;\n    }\n\n    this.decodedCache.set(key, { channelId, range, bytes });\n    this.decodedCacheBytes += bytes;\n  }'''
s = replace_once(s, old, new, 'range cache methods')

old = '''  public hasCachedChannelRange(\n    channelId: string,\n    startSampleIndex: number,\n    sampleCount: number,\n  ): boolean {\n    return startSampleIndex === 0\n      && sampleCount === this.sampleCount\n      && this.decodedCache.has(channelId);\n  }'''
new = '''  public hasCachedChannelRange(\n    channelId: string,\n    startSampleIndex: number,\n    sampleCount: number,\n  ): boolean {\n    return this.cachedEntryContaining(channelId, startSampleIndex, sampleCount) !== undefined;\n  }'''
s = replace_once(s, old, new, 'has cached range')

s = replace_once(s,
'''    const isFullRange = startSampleIndex === 0 && sampleCount === this.sampleCount;\n    const before = this.source.performanceSnapshot?.();''',
'''    const before = this.source.performanceSnapshot?.();''', 'remove full-only cache guard')
s = replace_once(s,
'''    for (const channelId of uniqueIds) {\n      if (isFullRange) {\n        const cached = this.cached(channelId);\n        if (cached) {\n          ranges.set(channelId, cached);\n          cacheHitChannelIds.push(channelId);\n          continue;\n        }\n      }\n      misses.push(this.resolveChannel(channelId, sampleCount));\n    }''',
'''    for (const channelId of uniqueIds) {\n      const cached = this.cached(channelId, startSampleIndex, sampleCount);\n      if (cached) {\n        ranges.set(channelId, cached);\n        cacheHitChannelIds.push(channelId);\n        continue;\n      }\n      misses.push(this.resolveChannel(channelId, sampleCount));\n    }''', 'resolve partial cache')
s = replace_once(s,
'''    for (const [channelId, range] of decoded.ranges) {\n      ranges.set(channelId, range);\n      if (isFullRange) this.cache(channelId, range);\n    }''',
'''    for (const [channelId, range] of decoded.ranges) {\n      ranges.set(channelId, range);\n      this.cache(channelId, range);\n    }''', 'cache partial ranges')
p.write_text(s)

# --- Graph: retain viewport ranges and refill lazily ---
p = Path('apps/web/src/components/graph-viewport.ts')
s = p.read_text()
s = replace_once(s,
'''interface ActiveTrace {\n  readonly channel: ChannelDefinition;\n  readonly range: NumericChannelRange;\n  readonly scale: StableValueScale;\n  readonly fullStatistics: ReturnType<typeof summarizeRange>;\n  readonly color: string;\n}''',
'''interface ActiveTrace {\n  readonly channel: ChannelDefinition;\n  readonly range: NumericChannelRange;\n  readonly scale: StableValueScale;\n  readonly fullStatistics: ReturnType<typeof summarizeRange>;\n  readonly statisticsComplete: boolean;\n  readonly color: string;\n}''', 'active trace completeness')
s = replace_once(s,
'''  let decodeInFlight = false;\n  let decodeGeneration = 0;''',
'''  let decodeInFlight = false;\n  let decodeGeneration = 0;\n  let viewportRefreshTimer: number | undefined;\n  let viewportRefreshGeneration = 0;''', 'viewport refresh state')

# Cursor must not report an edge value outside a partial range.
s = replace_once(s,
'''function nearestValue(range: NumericChannelRange, cursorTimeMs: number): number | undefined {\n  if (range.timeMs.length === 0) return undefined;''',
'''function nearestValue(range: NumericChannelRange, cursorTimeMs: number): number | undefined {\n  if (range.timeMs.length === 0) return undefined;\n  const firstTime = range.timeMs[0];\n  const lastTime = range.timeMs[range.timeMs.length - 1];\n  if (firstTime === undefined || lastTime === undefined || cursorTimeMs < firstTime || cursorTimeMs > lastTime) {\n    return undefined;\n  }''', 'partial cursor bounds')

# Remove eager viewport -> full-log promotion function.
pattern = re.compile(r"\n  const promoteViewportBatchToFull = async \([\s\S]*?\n  const flushPending = async \(\): Promise<void> => \{")
m = pattern.search(s)
if m:
    s = s[:m.start()] + "\n  const flushPending = async (): Promise<void> => {" + s[m.end():]
elif 'const promoteViewportBatchToFull' in s:
    raise SystemExit('could not remove promotion function')

s = s.replace("\n      if (requestRange.phase === 'viewport') {\n        void promoteViewportBatchToFull(channelIds, generation);\n      }", "", 1)

# Mark completeness for direct viewport/full loads.
s = replace_once(s,
'''          fullStatistics: summarizeRange(range),\n          color,''',
'''          fullStatistics: summarizeRange(range),\n          statisticsComplete: requestRange.phase === 'full',\n          color,''', 'pending completeness')

# Cached channel activation always requests the full range.
s = replace_once(s,
'''        fullStatistics: summarizeRange(range),\n        color,\n      });\n      overlay.hidden = true;''',
'''        fullStatistics: summarizeRange(range),\n        statisticsComplete: true,\n        color,\n      });\n      overlay.hidden = true;''', 'cached completeness')

# Preloaded workspace ranges are generally full; calculate rather than assume.
s = replace_once(s,
'''        fullStatistics: summarizeRange(range),\n        color,\n      });\n      activated.push(channelId);''',
'''        fullStatistics: summarizeRange(range),\n        statisticsComplete: range.startSampleIndex === 0\n          && range.values.length === channelData?.sampleCount,\n        color,\n      });\n      activated.push(channelId);''', 'preloaded completeness')

# Insert viewport refill scheduler before cached activation.
anchor = "\n  const activateCachedChannel = async (\n"
if 'const refreshActiveViewportRanges = async' not in s:
    if anchor not in s:
        raise SystemExit('missing viewport refresh insertion anchor')
    block = r'''
  const rangeCovers = (
    range: NumericChannelRange,
    startSampleIndex: number,
    sampleCount: number,
  ): boolean => {
    const rangeEnd = range.startSampleIndex + range.values.length;
    return startSampleIndex >= range.startSampleIndex
      && startSampleIndex + sampleCount <= rangeEnd;
  };

  const refreshActiveViewportRanges = async (generation: number): Promise<void> => {
    const dataSource = channelData;
    if (!dataSource || !viewport || activeTraces.size === 0) return;
    if (decodeInFlight) {
      if (generation === viewportRefreshGeneration) scheduleViewportRefresh();
      return;
    }

    const requestRange = currentChannelReadRange();
    const channelIds = [...activeTraces.entries()]
      .filter(([, trace]) => !rangeCovers(
        trace.range,
        requestRange.startSampleIndex,
        requestRange.sampleCount,
      ))
      .map(([channelId]) => channelId);
    if (channelIds.length === 0) return;

    const now = (): number => globalThis.performance?.now() ?? Date.now();
    const readStart = now();
    try {
      const result = dataSource.readChannelsRange
        ? await dataSource.readChannelsRange(
            channelIds,
            requestRange.startSampleIndex,
            requestRange.sampleCount,
          )
        : {
            ranges: new Map(await Promise.all(channelIds.map(async (channelId) => [
              channelId,
              await dataSource.readChannelRange(
                channelId,
                requestRange.startSampleIndex,
                requestRange.sampleCount,
              ),
            ] as const))),
            performance: {
              channelCount: channelIds.length,
              cacheHitChannelIds: [] as readonly string[],
              physicalReadCount: 0,
              physicalBytesRead: 0,
              physicalReadMs: 0,
            },
          };
      const readDecodeMs = now() - readStart;
      if (generation !== viewportRefreshGeneration) return;

      const cacheHits = new Set(result.performance.cacheHitChannelIds);
      const scaleTimes = new Map<string, number>();
      for (const channelId of channelIds) {
        const existing = activeTraces.get(channelId);
        const range = result.ranges.get(channelId);
        if (!existing || !range) continue;
        const scaleStart = now();
        const scale = buildStableValueScale(range);
        scaleTimes.set(channelId, now() - scaleStart);
        activeTraces.set(channelId, {
          ...existing,
          range,
          scale,
          fullStatistics: summarizeRange(range),
          statisticsComplete: requestRange.phase === 'full',
        });
        envelopeCache.delete(channelId);
      }

      renderReadout();
      emitCursorValues();
      const renderStart = now();
      draw();
      const renderMs = now() - renderStart;
      const completedMs = now();
      for (const channelId of channelIds) {
        const range = result.ranges.get(channelId);
        if (!range || !activeTraces.has(channelId)) continue;
        channelPerformanceListener?.({
          channelId,
          phase: requestRange.phase,
          startSampleIndex: requestRange.startSampleIndex,
          requestedSampleCount: requestRange.sampleCount,
          totalMs: completedMs - readStart,
          readDecodeMs,
          scaleMs: scaleTimes.get(channelId) ?? 0,
          renderMs,
          sampleCount: range.values.length,
          batchSize: channelIds.length,
          cacheHit: cacheHits.has(channelId),
          physicalReadCount: result.performance.physicalReadCount,
          physicalBytesRead: result.performance.physicalBytesRead,
          physicalReadMs: result.performance.physicalReadMs,
        });
      }
    } catch {
      // Keep the last decoded range visible if a viewport refill fails.
    }
  };

  const scheduleViewportRefresh = (): void => {
    viewportRefreshGeneration += 1;
    const generation = viewportRefreshGeneration;
    if (viewportRefreshTimer !== undefined) window.clearTimeout(viewportRefreshTimer);
    viewportRefreshTimer = window.setTimeout(() => {
      viewportRefreshTimer = undefined;
      void refreshActiveViewportRanges(generation);
    }, 90);
  };
'''
    s = s.replace(anchor, block + anchor, 1)

# setLog/clear must cancel delayed viewport work.
s = replace_once(s,
'''    cancelPending();\n    activeTraces.clear();''',
'''    cancelPending();\n    viewportRefreshGeneration += 1;\n    if (viewportRefreshTimer !== undefined) {\n      window.clearTimeout(viewportRefreshTimer);\n      viewportRefreshTimer = undefined;\n    }\n    activeTraces.clear();''', 'setLog viewport cleanup')
# clearChannels has another cancelPending occurrence; patch next occurrence only.
idx = s.find('  const clearChannels = (): void => {')
if idx >= 0:
    tail = s[idx:]
    tail = replace_once(tail,
'''    cancelPending();\n    activeTraces.clear();''',
'''    cancelPending();\n    viewportRefreshGeneration += 1;\n    if (viewportRefreshTimer !== undefined) {\n      window.clearTimeout(viewportRefreshTimer);\n      viewportRefreshTimer = undefined;\n    }\n    activeTraces.clear();''', 'clearChannels viewport cleanup')
    s = s[:idx] + tail

s = replace_once(s,
'''  const setViewport = (nextViewport: TimelineViewport | undefined): void => {\n    viewport = nextViewport;\n    draw();\n  };''',
'''  const setViewport = (nextViewport: TimelineViewport | undefined): void => {\n    viewport = nextViewport;\n    scheduleViewportRefresh();\n    draw();\n  };''', 'viewport refill scheduling')

# Expose whether full-log statistics are complete.
s = replace_once(s,
'''  readonly full: {\n    readonly validCount: number;''',
'''  readonly full: {\n    readonly complete: boolean;\n    readonly validCount: number;''', 'graph stats completeness type')
s = replace_once(s,
'''      return {\n        channelId,\n        current: nearestValue(trace.range, cursorTimeMs),\n        full,''',
'''      return {\n        channelId,\n        current: nearestValue(trace.range, cursorTimeMs),\n        full: { ...full, complete: trace.statisticsComplete },''', 'graph stats completeness return')
p.write_text(s)

# --- Inspector: do not label partial statistics as full-log statistics ---
p = Path('apps/web/src/panels/inspector-panel.ts')
s = p.read_text()
s = replace_once(s,
'''  readonly full: {\n    readonly validCount: number;''',
'''  readonly full: {\n    readonly complete: boolean;\n    readonly validCount: number;''', 'inspector stats completeness type')
old = '''    statisticsBody.innerHTML = [\n      cell('Current', statistics.current === undefined ? '—' : `${formatStatistic(statistics.current, precision)}${unit}`),\n      cell('Full min', statistics.full.min === undefined ? '—' : `${formatStatistic(statistics.full.min, precision)}${unit}`),\n      cell('Full max', statistics.full.max === undefined ? '—' : `${formatStatistic(statistics.full.max, precision)}${unit}`),\n      cell('Full mean', statistics.full.mean === undefined ? '—' : `${formatStatistic(statistics.full.mean, precision)}${unit}`),\n      cell('Std dev', statistics.full.standardDeviation === undefined ? '—' : `${formatStatistic(statistics.full.standardDeviation, precision)}${unit}`),\n      cell('Valid samples', statistics.full.validCount.toLocaleString()),\n      cell('Invalid samples', statistics.full.invalidCount.toLocaleString()),'''
new = '''    const scope = statistics.full.complete ? 'Full' : 'Loaded';\n    statisticsBody.innerHTML = [\n      cell('Current', statistics.current === undefined ? '—' : `${formatStatistic(statistics.current, precision)}${unit}`),\n      cell(`${scope} min`, statistics.full.min === undefined ? '—' : `${formatStatistic(statistics.full.min, precision)}${unit}`),\n      cell(`${scope} max`, statistics.full.max === undefined ? '—' : `${formatStatistic(statistics.full.max, precision)}${unit}`),\n      cell(`${scope} mean`, statistics.full.mean === undefined ? '—' : `${formatStatistic(statistics.full.mean, precision)}${unit}`),\n      cell(`${scope} std dev`, statistics.full.standardDeviation === undefined ? '—' : `${formatStatistic(statistics.full.standardDeviation, precision)}${unit}`),\n      cell(`${scope} valid`, statistics.full.validCount.toLocaleString()),\n      cell(`${scope} invalid`, statistics.full.invalidCount.toLocaleString()),'''
s = replace_once(s, old, new, 'inspector partial labels')
p.write_text(s)

# --- Regression test for partial-range containment cache ---
p = Path('tests/logs/mlg-channel-data.test.ts')
s = p.read_text()
if "caches bounded ranges and serves contained subranges without another source read" not in s:
    insert = r'''

  it('caches bounded ranges and serves contained subranges without another source read', async () => {
    const sampleCount = 512;
    const stride = 4096;
    const bytes = new Uint8Array(sampleCount * stride);
    const offsets = new Float64Array(sampleCount);
    const timeMs = new Float64Array(sampleCount);
    const counters = new Uint8Array(sampleCount);
    const crcValid = new Uint8Array(sampleCount);
    crcValid.fill(1);
    for (let index = 0; index < sampleCount; index += 1) {
      offsets[index] = index * stride;
      timeMs[index] = index;
      counters[index] = index & 0xff;
      bytes[index * stride + 4] = index & 0xff;
    }
    const field: MlgScalarFieldDescriptor = {
      kind: 'scalar', index: 0, offset: 0, type: 0, name: 'test', units: '',
      displayStyle: 0, widthBytes: 1, category: '', scale: 1, transform: 0, digits: 0,
    };
    const recordIndex: MlgRecordIndex = { offsets, timeMs, counters, crcValid };
    const source = new CountingByteSource(bytes);
    const channelData = new MlgNumericChannelDataSource(source, [field], recordIndex);

    const first = await channelData.readChannelRange('mlg:0', 100, 200);
    const readsAfterFirst = source.readCount;
    expect(first.startSampleIndex).toBe(100);
    expect(channelData.hasCachedChannelRange('mlg:0', 120, 40)).toBe(true);

    const contained = await channelData.readChannelRange('mlg:0', 120, 40);
    expect(source.readCount).toBe(readsAfterFirst);
    expect(contained.startSampleIndex).toBe(120);
    expect(contained.values.length).toBe(40);
    expect(contained.values[0]).toBe(120);
  });
'''
    marker = "\n  it('amortizes strided full-channel reads into multi-megabyte source batches'"
    if marker not in s:
        raise SystemExit('missing test insertion marker')
    s = s.replace(marker, insert + marker, 1)
p.write_text(s)
