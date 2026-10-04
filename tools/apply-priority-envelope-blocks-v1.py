from pathlib import Path

# 1) core/log-model/log-types.ts
p = Path('core/log-model/log-types.ts')
s = p.read_text()
anchor = """export interface NumericChannelStatistics {\n  readonly validCount: number;\n  readonly invalidCount: number;\n  readonly min: number | undefined;\n  readonly max: number | undefined;\n  readonly mean: number | undefined;\n  readonly standardDeviation: number | undefined;\n}\n\n"""
insert = """export interface NumericChannelEnvelopeBlocks {\n  readonly blockSize: number;\n  readonly validCount: Uint16Array;\n  readonly invalidCount: Uint16Array;\n  readonly first: Float64Array;\n  readonly firstTimeMs: Float64Array;\n  readonly min: Float64Array;\n  readonly minTimeMs: Float64Array;\n  readonly max: Float64Array;\n  readonly maxTimeMs: Float64Array;\n  readonly last: Float64Array;\n  readonly lastTimeMs: Float64Array;\n}\n\n"""
assert anchor in s, 'statistics anchor missing'
s = s.replace(anchor, anchor + insert, 1)
old = """  /** Optional full-range statistics computed while source samples were already being decoded. */\n  readonly fullStatistics?: NumericChannelStatistics;\n}"""
new = """  /** Optional full-range statistics computed while source samples were already being decoded. */\n  readonly fullStatistics?: NumericChannelStatistics;\n  /** Optional exact fixed-block envelope summaries for acceleration before CRC validity is refreshed. */\n  readonly fullEnvelopeBlocks?: NumericChannelEnvelopeBlocks;\n}"""
assert old in s, 'range metadata anchor missing'
p.write_text(s.replace(old, new, 1))

# 2) core/timeline/viewport-series.ts
p = Path('core/timeline/viewport-series.ts')
s = p.read_text()
s = s.replace(
"import type { NumericChannelRange } from '../log-model/log-types';",
"import type { NumericChannelEnvelopeBlocks, NumericChannelRange } from '../log-model/log-types';",
1)
insert_before = """export function buildViewportEnvelope(\n"""
helper = r'''export function buildEnvelopeBlockSummary(
  values: Float64Array,
  timeMs: Float64Array,
  validity: Uint8Array,
  blockSize = 64,
): NumericChannelEnvelopeBlocks {
  if (!Number.isSafeInteger(blockSize) || blockSize <= 0 || blockSize > 65535) {
    throw new RangeError(`Invalid envelope block size ${blockSize}.`);
  }
  if (values.length !== timeMs.length || values.length !== validity.length) {
    throw new RangeError('Envelope block source arrays must have equal length.');
  }
  const blockCount = Math.ceil(values.length / blockSize);
  const validCount = new Uint16Array(blockCount);
  const invalidCount = new Uint16Array(blockCount);
  const first = new Float64Array(blockCount); first.fill(Number.NaN);
  const firstTimeMs = new Float64Array(blockCount); firstTimeMs.fill(Number.NaN);
  const min = new Float64Array(blockCount); min.fill(Number.NaN);
  const minTimeMs = new Float64Array(blockCount); minTimeMs.fill(Number.NaN);
  const max = new Float64Array(blockCount); max.fill(Number.NaN);
  const maxTimeMs = new Float64Array(blockCount); maxTimeMs.fill(Number.NaN);
  const last = new Float64Array(blockCount); last.fill(Number.NaN);
  const lastTimeMs = new Float64Array(blockCount); lastTimeMs.fill(Number.NaN);

  for (let index = 0; index < values.length; index += 1) {
    const block = Math.floor(index / blockSize);
    const value = values[index];
    const time = timeMs[index];
    if (validity[index] !== 1 || value === undefined || time === undefined || !Number.isFinite(value) || !Number.isFinite(time)) {
      invalidCount[block] = (invalidCount[block] ?? 0) + 1;
      continue;
    }
    const count = validCount[block] ?? 0;
    if (count === 0) {
      first[block] = value; firstTimeMs[block] = time;
      min[block] = value; minTimeMs[block] = time;
      max[block] = value; maxTimeMs[block] = time;
    } else {
      if (value < (min[block] ?? Number.POSITIVE_INFINITY)) { min[block] = value; minTimeMs[block] = time; }
      if (value > (max[block] ?? Number.NEGATIVE_INFINITY)) { max[block] = value; maxTimeMs[block] = time; }
    }
    last[block] = value; lastTimeMs[block] = time;
    validCount[block] = count + 1;
  }
  return { blockSize, validCount, invalidCount, first, firstTimeMs, min, minTimeMs, max, maxTimeMs, last, lastTimeMs };
}

function viewportX(timeMs: number, startMs: number, span: number, pixelWidth: number): number {
  const normalized = (timeMs - startMs) / span;
  return Math.min(pixelWidth - 1, Math.max(0, Math.floor(normalized * pixelWidth)));
}

export function buildViewportEnvelopeFromBlocks(
  range: NumericChannelRange,
  blocks: NumericChannelEnvelopeBlocks,
  startMs: number,
  endMs: number,
  pixelWidth: number,
): ViewportEnvelope {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    throw new RangeError(`Invalid viewport range ${startMs}..${endMs}.`);
  }
  if (!Number.isSafeInteger(pixelWidth) || pixelWidth <= 0) {
    throw new RangeError(`Invalid viewport width ${pixelWidth}.`);
  }
  if (!Number.isSafeInteger(blocks.blockSize) || blocks.blockSize <= 0) {
    return buildViewportEnvelope(range, startMs, endMs, pixelWidth);
  }

  const span = Math.max(1e-9, endMs - startMs);
  const buckets: Array<BucketState | undefined> = new Array(pixelWidth);
  let valueMin = Number.POSITIVE_INFINITY;
  let valueMax = Number.NEGATIVE_INFINITY;
  let validSampleCount = 0;
  let invalidSampleCount = 0;

  const mergePoint = (time: number, value: number): void => {
    const x = viewportX(time, startMs, span, pixelWidth);
    const bucket = buckets[x];
    if (!bucket) {
      buckets[x] = { first: value, firstTimeMs: time, min: value, minTimeMs: time, max: value, maxTimeMs: time, last: value, lastTimeMs: time };
    } else {
      if (value < bucket.min) { bucket.min = value; bucket.minTimeMs = time; }
      if (value > bucket.max) { bucket.max = value; bucket.maxTimeMs = time; }
      bucket.last = value; bucket.lastTimeMs = time;
    }
  };

  const scanSample = (index: number): void => {
    const time = range.timeMs[index];
    const value = range.values[index];
    if (time === undefined || value === undefined) return;
    if (range.validity[index] !== 1 || !Number.isFinite(value)) { invalidSampleCount += 1; return; }
    validSampleCount += 1;
    valueMin = Math.min(valueMin, value); valueMax = Math.max(valueMax, value);
    mergePoint(time, value);
  };

  const mergeBlock = (block: number): boolean => {
    const count = blocks.validCount[block] ?? 0;
    invalidSampleCount += blocks.invalidCount[block] ?? 0;
    if (count === 0) return true;
    const firstTime = blocks.firstTimeMs[block];
    const lastTime = blocks.lastTimeMs[block];
    if (firstTime === undefined || lastTime === undefined || !Number.isFinite(firstTime) || !Number.isFinite(lastTime)) return false;
    const x = viewportX(firstTime, startMs, span, pixelWidth);
    if (x !== viewportX(lastTime, startMs, span, pixelWidth)) return false;
    const firstValue = blocks.first[block];
    const minValue = blocks.min[block];
    const maxValue = blocks.max[block];
    const lastValue = blocks.last[block];
    const minTime = blocks.minTimeMs[block];
    const maxTime = blocks.maxTimeMs[block];
    if ([firstValue, minValue, maxValue, lastValue, minTime, maxTime].some((value) => value === undefined || !Number.isFinite(value))) return false;
    const bucket = buckets[x];
    if (!bucket) {
      buckets[x] = {
        first: firstValue!, firstTimeMs: firstTime,
        min: minValue!, minTimeMs: minTime!,
        max: maxValue!, maxTimeMs: maxTime!,
        last: lastValue!, lastTimeMs: lastTime,
      };
    } else {
      if (minValue! < bucket.min) { bucket.min = minValue!; bucket.minTimeMs = minTime!; }
      if (maxValue! > bucket.max) { bucket.max = maxValue!; bucket.maxTimeMs = maxTime!; }
      bucket.last = lastValue!; bucket.lastTimeMs = lastTime;
    }
    validSampleCount += count;
    valueMin = Math.min(valueMin, minValue!); valueMax = Math.max(valueMax, maxValue!);
    return true;
  };

  const startIndex = lowerBound(range.timeMs, startMs);
  const endIndex = upperBound(range.timeMs, endMs);
  const blockSize = blocks.blockSize;
  let index = startIndex;
  while (index < endIndex) {
    const block = Math.floor(index / blockSize);
    const blockStart = block * blockSize;
    const blockEnd = Math.min(range.values.length, blockStart + blockSize);
    const sliceEnd = Math.min(endIndex, blockEnd);
    if (index === blockStart && sliceEnd === blockEnd && mergeBlock(block)) {
      index = blockEnd;
      continue;
    }
    while (index < sliceEnd) { scanSample(index); index += 1; }
  }

  const columns: ViewportEnvelopeColumn[] = [];
  for (let x = 0; x < buckets.length; x += 1) {
    const bucket = buckets[x];
    if (bucket) columns.push({ x, ...bucket });
  }
  return {
    columns,
    valueMin: validSampleCount > 0 ? valueMin : 0,
    valueMax: validSampleCount > 0 ? valueMax : 0,
    validSampleCount,
    invalidSampleCount,
  };
}

'''
assert insert_before in s, 'viewport envelope anchor missing'
s = s.replace(insert_before, helper + insert_before, 1)
p.write_text(s)

# 3) worker protocol
p = Path('apps/web/src/workers/mlg-worker-protocol.ts')
s = p.read_text()
s = s.replace('  NumericChannelStatistics,\n', '  NumericChannelEnvelopeBlocks,\n  NumericChannelStatistics,\n', 1)
old = """  readonly statistics: NumericChannelStatistics;\n}"""
new = """  readonly statistics: NumericChannelStatistics;\n  readonly envelopeBlocks: NumericChannelEnvelopeBlocks;\n}"""
assert old in s, 'captured protocol anchor missing'
p.write_text(s.replace(old, new, 1))

# 4) worker builds block summary after scan and transfers buffers
p = Path('apps/web/src/workers/mlg-import.worker.ts')
s = p.read_text()
import_anchor = """import { BlobByteSource } from '../adapters/blob-byte-source';\n"""
assert import_anchor in s, 'worker import anchor missing'
s = s.replace(import_anchor, import_anchor + "import { buildEnvelopeBlockSummary } from '../../../../core/timeline/viewport-series';\n", 1)
old = """      const recordScanMs = now() - scanStart;\n\n      const finalizeStart = now();\n"""
new = """      const recordScanMs = now() - scanStart;\n      const capturedEnvelopeBlocks = capturedPriority.map((captured) => buildEnvelopeBlockSummary(\n        captured.values,\n        scanResult.records.timeMs,\n        scanResult.records.crcValid,\n        64,\n      ));\n\n      const finalizeStart = now();\n"""
assert old in s, 'worker post-scan anchor missing'
s = s.replace(old, new, 1)
old = """            capturedPriorityColumns: capturedPriority.map((captured) => ({\n              channelId: captured.channelId,\n              values: captured.values,\n              statistics: {\n"""
new = """            capturedPriorityColumns: capturedPriority.map((captured, capturedIndex) => ({\n              channelId: captured.channelId,\n              values: captured.values,\n              envelopeBlocks: capturedEnvelopeBlocks[capturedIndex]!,\n              statistics: {\n"""
assert old in s, 'worker payload anchor missing'
s = s.replace(old, new, 1)
old = """        ...capturedPriority.map((captured) => captured.values.buffer as ArrayBuffer),\n      ]);\n"""
new = """        ...capturedPriority.map((captured) => captured.values.buffer as ArrayBuffer),\n        ...capturedEnvelopeBlocks.flatMap((blocks) => [\n          blocks.validCount.buffer, blocks.invalidCount.buffer,\n          blocks.first.buffer, blocks.firstTimeMs.buffer, blocks.min.buffer, blocks.minTimeMs.buffer,\n          blocks.max.buffer, blocks.maxTimeMs.buffer, blocks.last.buffer, blocks.lastTimeMs.buffer,\n        ] as ArrayBuffer[]),\n      ]);\n"""
assert old in s, 'worker transfer anchor missing'
s = s.replace(old, new, 1)
p.write_text(s)

# 5) sidecar carries summary onto full range
p = Path('apps/web/src/adapters/mlg-column-sidecar-v1.ts')
s = p.read_text()
s = s.replace('  NumericChannelDataSource,\n', '  NumericChannelDataSource,\n  NumericChannelEnvelopeBlocks,\n', 1)
old = """  values: Float64Array,\n  fullStatistics?: NumericChannelStatistics,\n): NumericChannelRange {\n"""
new = """  values: Float64Array,\n  fullStatistics?: NumericChannelStatistics,\n  fullEnvelopeBlocks?: NumericChannelEnvelopeBlocks,\n): NumericChannelRange {\n"""
assert old in s, 'sidecar buildRange args anchor missing'
s = s.replace(old, new, 1)
old = """    ...(isFullRange && fullStatistics ? { fullStatistics } : {}),\n  };\n}"""
new = """    ...(isFullRange && fullStatistics ? { fullStatistics } : {}),\n    ...(isFullRange && fullEnvelopeBlocks ? { fullEnvelopeBlocks } : {}),\n  };\n}"""
assert old in s, 'sidecar buildRange metadata anchor missing'
s = s.replace(old, new, 1)
old = """    readonly values: Float64Array;\n    readonly statistics: NumericChannelStatistics;\n  }>();\n"""
new = """    readonly values: Float64Array;\n    readonly statistics: NumericChannelStatistics;\n    readonly envelopeBlocks: NumericChannelEnvelopeBlocks;\n  }>();\n"""
assert old in s, 'sidecar captured type anchor missing'
s = s.replace(old, new, 1)
old = """          values: column.values,\n          statistics: column.statistics,\n        });\n"""
new = """          values: column.values,\n          statistics: column.statistics,\n          envelopeBlocks: column.envelopeBlocks,\n        });\n"""
assert old in s, 'sidecar seed metadata anchor missing'
s = s.replace(old, new, 1)
old = """            buildRange(this.recordIndex, 0, this.sampleCount, column.values, column.statistics),\n"""
new = """            buildRange(\n              this.recordIndex,\n              0,\n              this.sampleCount,\n              column.values,\n              column.statistics,\n              column.envelopeBlocks,\n            ),\n"""
assert old in s, 'sidecar captured buildRange anchor missing'
s = s.replace(old, new, 1)
p.write_text(s)

# 6) graph uses exact block accelerated envelope until CRC validity refresh
p = Path('apps/web/src/components/graph-viewport.ts')
s = p.read_text()
s = s.replace('  buildViewportEnvelope,\n', '  buildViewportEnvelope,\n  buildViewportEnvelopeFromBlocks,\n', 1)
anchor = """  let measuredEnvelopeBuildMs = 0;\n"""
assert anchor in s, 'graph envelope state anchor missing'
s = s.replace(anchor, anchor + "  let precomputedEnvelopeBlocksEnabled = true;\n", 1)
old = """            const built = buildViewportEnvelope(\n              trace.range,\n              visibleStartMs,\n              visibleEndMs,\n              pixelWidth,\n            );\n"""
new = """            const built = precomputedEnvelopeBlocksEnabled && trace.range.fullEnvelopeBlocks\n              ? buildViewportEnvelopeFromBlocks(\n                  trace.range,\n                  trace.range.fullEnvelopeBlocks,\n                  visibleStartMs,\n                  visibleEndMs,\n                  pixelWidth,\n                )\n              : buildViewportEnvelope(\n                  trace.range,\n                  visibleStartMs,\n                  visibleEndMs,\n                  pixelWidth,\n                );\n"""
assert old in s, 'graph envelope build anchor missing'
s = s.replace(old, new, 1)
old = """    channels = nextChannels;\n    channelData = nextChannelData;\n"""
new = """    channels = nextChannels;\n    channelData = nextChannelData;\n    precomputedEnvelopeBlocksEnabled = true;\n"""
assert old in s, 'graph setLog anchor missing'
s = s.replace(old, new, 1)
old = """  const refreshValidity = (): void => {\n    envelopeCache.clear();\n"""
new = """  const refreshValidity = (): void => {\n    // Priority envelope blocks are computed before CRC validation; once source\n    // validity changes, fall back to authoritative raw samples for exact redraws.\n    precomputedEnvelopeBlocksEnabled = false;\n    envelopeCache.clear();\n"""
assert old in s, 'graph refreshValidity anchor missing'
s = s.replace(old, new, 1)
p.write_text(s)

# 7) tests verify exact accelerated envelopes against raw path
p = Path('tests/timeline/viewport-series.test.ts')
s = p.read_text()
s = s.replace(
"import { buildRawViewportSeries, buildViewportEnvelope } from '../../core/timeline/viewport-series';",
"import { buildEnvelopeBlockSummary, buildRawViewportSeries, buildViewportEnvelope, buildViewportEnvelopeFromBlocks } from '../../core/timeline/viewport-series';",
1)
anchor = """  it('preserves extrema timing so a bucket can be rendered in raw chronological order', () => {\n"""
test = """  it('matches the raw envelope exactly when fixed block summaries accelerate complete blocks', () => {\n    const sampleCount = 257;\n    const timeMs = Float64Array.from({ length: sampleCount }, (_, index) => index * 7 + (index % 9 === 0 ? 1 : 0));\n    const values = Float64Array.from({ length: sampleCount }, (_, index) => Math.sin(index / 8) * 20 + (index % 17));\n    const validity = Uint8Array.from({ length: sampleCount }, (_, index) => index % 41 === 0 ? 0 : 1);\n    const range = { startSampleIndex: 0, timeMs, values, validity };\n    const blocks = buildEnvelopeBlockSummary(values, timeMs, validity, 16);\n\n    for (const [startMs, endMs, width] of [[0, timeMs[sampleCount - 1]!, 23], [113, 1400, 37], [500, 900, 11]] as const) {\n      expect(buildViewportEnvelopeFromBlocks(range, blocks, startMs, endMs, width))\n        .toEqual(buildViewportEnvelope(range, startMs, endMs, width));\n    }\n  });\n\n"""
assert anchor in s, 'test insertion anchor missing'
s = s.replace(anchor, test + anchor, 1)
p.write_text(s)
