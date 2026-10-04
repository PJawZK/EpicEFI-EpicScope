from pathlib import Path

# core/log-model/log-types.ts: allow multiple exact envelope levels.
p = Path('core/log-model/log-types.ts')
s = p.read_text()
s = s.replace(
    '  readonly fullEnvelopeBlocks?: NumericChannelEnvelopeBlocks;\n',
    '  readonly fullEnvelopeBlocks?: readonly NumericChannelEnvelopeBlocks[];\n',
    1,
)
p.write_text(s)

# core/timeline/viewport-series.ts: add exact hierarchy construction and greedy largest-level merge.
p = Path('core/timeline/viewport-series.ts')
s = p.read_text()
anchor = """export function buildEnvelopeBlockSummary(\n  values: Float64Array,\n  timeMs: Float64Array,\n  validity: Uint8Array,\n  blockSize = 64,\n): NumericChannelEnvelopeBlocks {\n"""
assert anchor in s, 'block summary function missing'

insert_anchor = """function viewportX(timeMs: number, startMs: number, span: number, pixelWidth: number): number {\n"""
helper = r'''function aggregateEnvelopeBlockSummary(
  source: NumericChannelEnvelopeBlocks,
  factor = 4,
): NumericChannelEnvelopeBlocks {
  if (!Number.isSafeInteger(factor) || factor <= 1) {
    throw new RangeError(`Invalid envelope aggregation factor ${factor}.`);
  }
  const sourceCount = source.validCount.length;
  const blockCount = Math.ceil(sourceCount / factor);
  const blockSize = source.blockSize * factor;
  if (blockSize > 65535) throw new RangeError(`Envelope block size ${blockSize} exceeds count capacity.`);

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

  for (let block = 0; block < blockCount; block += 1) {
    const childStart = block * factor;
    const childEnd = Math.min(sourceCount, childStart + factor);
    let totalValid = 0;
    let totalInvalid = 0;
    for (let child = childStart; child < childEnd; child += 1) {
      const childValid = source.validCount[child] ?? 0;
      totalInvalid += source.invalidCount[child] ?? 0;
      if (childValid === 0) continue;

      const childFirst = source.first[child];
      const childFirstTime = source.firstTimeMs[child];
      const childMin = source.min[child];
      const childMinTime = source.minTimeMs[child];
      const childMax = source.max[child];
      const childMaxTime = source.maxTimeMs[child];
      const childLast = source.last[child];
      const childLastTime = source.lastTimeMs[child];
      if (
        childFirst === undefined || childFirstTime === undefined
        || childMin === undefined || childMinTime === undefined
        || childMax === undefined || childMaxTime === undefined
        || childLast === undefined || childLastTime === undefined
      ) continue;

      if (totalValid === 0) {
        first[block] = childFirst;
        firstTimeMs[block] = childFirstTime;
        min[block] = childMin;
        minTimeMs[block] = childMinTime;
        max[block] = childMax;
        maxTimeMs[block] = childMaxTime;
      } else {
        if (childMin < (min[block] ?? Number.POSITIVE_INFINITY)) {
          min[block] = childMin;
          minTimeMs[block] = childMinTime;
        }
        if (childMax > (max[block] ?? Number.NEGATIVE_INFINITY)) {
          max[block] = childMax;
          maxTimeMs[block] = childMaxTime;
        }
      }
      last[block] = childLast;
      lastTimeMs[block] = childLastTime;
      totalValid += childValid;
    }
    validCount[block] = totalValid;
    invalidCount[block] = totalInvalid;
  }

  return { blockSize, validCount, invalidCount, first, firstTimeMs, min, minTimeMs, max, maxTimeMs, last, lastTimeMs };
}

export function buildEnvelopeBlockHierarchy(
  values: Float64Array,
  timeMs: Float64Array,
  validity: Uint8Array,
  baseBlockSize = 64,
  levelCount = 3,
): readonly NumericChannelEnvelopeBlocks[] {
  if (!Number.isSafeInteger(levelCount) || levelCount <= 0) {
    throw new RangeError(`Invalid envelope hierarchy level count ${levelCount}.`);
  }
  const levels: NumericChannelEnvelopeBlocks[] = [
    buildEnvelopeBlockSummary(values, timeMs, validity, baseBlockSize),
  ];
  while (levels.length < levelCount) {
    levels.push(aggregateEnvelopeBlockSummary(levels[levels.length - 1]!, 4));
  }
  return levels;
}

'''
assert insert_anchor in s, 'viewportX anchor missing'
s = s.replace(insert_anchor, helper + insert_anchor, 1)

# Make accelerated builder accept either legacy single level or hierarchy.
s = s.replace(
    '  blocks: NumericChannelEnvelopeBlocks,\n',
    '  blocks: NumericChannelEnvelopeBlocks | readonly NumericChannelEnvelopeBlocks[],\n',
    1,
)
old = """  if (!Number.isSafeInteger(blocks.blockSize) || blocks.blockSize <= 0) {\n    return buildViewportEnvelope(range, startMs, endMs, pixelWidth);\n  }\n\n  const span = Math.max(1e-9, endMs - startMs);\n"""
new = """  const levels = (Array.isArray(blocks) ? blocks : [blocks])\n    .filter((level) => Number.isSafeInteger(level.blockSize) && level.blockSize > 0)\n    .sort((left, right) => right.blockSize - left.blockSize);\n  if (levels.length === 0) return buildViewportEnvelope(range, startMs, endMs, pixelWidth);\n\n  const span = Math.max(1e-9, endMs - startMs);\n"""
assert old in s, 'single-level validation anchor missing'
s = s.replace(old, new, 1)

# Replace mergeBlock closure to take a level.
s = s.replace(
    '  const mergeBlock = (block: number): boolean => {\n    const count = blocks.validCount[block] ?? 0;\n',
    '  const mergeBlock = (level: NumericChannelEnvelopeBlocks, block: number): boolean => {\n    const count = level.validCount[block] ?? 0;\n',
    1,
)
for old_text, new_text in [
    ('blocks.invalidCount[block]', 'level.invalidCount[block]'),
    ('blocks.firstTimeMs[block]', 'level.firstTimeMs[block]'),
    ('blocks.lastTimeMs[block]', 'level.lastTimeMs[block]'),
    ('blocks.first[block]', 'level.first[block]'),
    ('blocks.min[block]', 'level.min[block]'),
    ('blocks.max[block]', 'level.max[block]'),
    ('blocks.last[block]', 'level.last[block]'),
    ('blocks.minTimeMs[block]', 'level.minTimeMs[block]'),
    ('blocks.maxTimeMs[block]', 'level.maxTimeMs[block]'),
]:
    s = s.replace(old_text, new_text)

old_loop = """  const blockSize = blocks.blockSize;\n  let index = startIndex;\n  while (index < endIndex) {\n    const block = Math.floor(index / blockSize);\n    const blockStart = block * blockSize;\n    const blockEnd = Math.min(range.values.length, blockStart + blockSize);\n    const sliceEnd = Math.min(endIndex, blockEnd);\n    if (index === blockStart && sliceEnd === blockEnd && mergeBlock(block)) {\n      index = blockEnd;\n      continue;\n    }\n    while (index < sliceEnd) { scanSample(index); index += 1; }\n  }\n"""
new_loop = """  let index = startIndex;\n  while (index < endIndex) {\n    let merged = false;\n    for (const level of levels) {\n      const blockSize = level.blockSize;\n      if (index % blockSize !== 0) continue;\n      const block = Math.floor(index / blockSize);\n      const blockStart = block * blockSize;\n      const blockEnd = Math.min(range.values.length, blockStart + blockSize);\n      if (blockStart !== index || blockEnd > endIndex) continue;\n      if (mergeBlock(level, block)) {\n        index = blockEnd;\n        merged = true;\n        break;\n      }\n    }\n    if (merged) continue;\n    scanSample(index);\n    index += 1;\n  }\n"""
assert old_loop in s, 'single-level scan loop missing'
s = s.replace(old_loop, new_loop, 1)
p.write_text(s)

# worker protocol: captured column carries hierarchy.
p = Path('apps/web/src/workers/mlg-worker-protocol.ts')
s = p.read_text().replace(
    '  readonly envelopeBlocks: NumericChannelEnvelopeBlocks;\n',
    '  readonly envelopeBlocks: readonly NumericChannelEnvelopeBlocks[];\n',
    1,
)
p.write_text(s)

# worker: build hierarchy, and transfer every level.
p = Path('apps/web/src/workers/mlg-import.worker.ts')
s = p.read_text()
s = s.replace(
    "import { buildEnvelopeBlockSummary } from '../../../../core/timeline/viewport-series';",
    "import { buildEnvelopeBlockHierarchy } from '../../../../core/timeline/viewport-series';",
    1,
)
s = s.replace(
    'const capturedEnvelopeBlocks = capturedPriority.map((captured) => buildEnvelopeBlockSummary(\n',
    'const capturedEnvelopeBlocks = capturedPriority.map((captured) => buildEnvelopeBlockHierarchy(\n',
    1,
)
# Existing call has final 64; add level count argument.
s = s.replace(
    '        64,\n      ));\n',
    '        64,\n        3,\n      ));\n',
    1,
)
old_transfer = """        ...capturedEnvelopeBlocks.flatMap((blocks) => [\n          blocks.validCount.buffer, blocks.invalidCount.buffer,\n          blocks.first.buffer, blocks.firstTimeMs.buffer, blocks.min.buffer, blocks.minTimeMs.buffer,\n          blocks.max.buffer, blocks.maxTimeMs.buffer, blocks.last.buffer, blocks.lastTimeMs.buffer,\n        ] as ArrayBuffer[]),\n"""
new_transfer = """        ...capturedEnvelopeBlocks.flatMap((levels) => levels.flatMap((blocks) => [\n          blocks.validCount.buffer, blocks.invalidCount.buffer,\n          blocks.first.buffer, blocks.firstTimeMs.buffer, blocks.min.buffer, blocks.minTimeMs.buffer,\n          blocks.max.buffer, blocks.maxTimeMs.buffer, blocks.last.buffer, blocks.lastTimeMs.buffer,\n        ] as ArrayBuffer[])),\n"""
assert old_transfer in s, 'worker transfer block missing'
s = s.replace(old_transfer, new_transfer, 1)
p.write_text(s)

# sidecar: stored metadata now hierarchy array.
p = Path('apps/web/src/adapters/mlg-column-sidecar-v1.ts')
s = p.read_text()
s = s.replace(
    '  fullEnvelopeBlocks?: NumericChannelEnvelopeBlocks,\n',
    '  fullEnvelopeBlocks?: readonly NumericChannelEnvelopeBlocks[],\n',
    1,
)
s = s.replace(
    '    readonly envelopeBlocks: NumericChannelEnvelopeBlocks;\n',
    '    readonly envelopeBlocks: readonly NumericChannelEnvelopeBlocks[];\n',
    1,
)
p.write_text(s)

# tests: retain single-level exactness and add multilevel exactness across more ranges.
p = Path('tests/timeline/viewport-series.test.ts')
s = p.read_text()
s = s.replace(
    'import { buildEnvelopeBlockSummary, buildRawViewportSeries, buildViewportEnvelope, buildViewportEnvelopeFromBlocks } from \'../../core/timeline/viewport-series\';',
    'import { buildEnvelopeBlockHierarchy, buildEnvelopeBlockSummary, buildRawViewportSeries, buildViewportEnvelope, buildViewportEnvelopeFromBlocks } from \'../../core/timeline/viewport-series\';',
    1,
)
anchor = """  it('preserves extrema timing so a bucket can be rendered in raw chronological order', () => {\n"""
test = r'''  it('matches the raw envelope exactly with a multilevel 64/256/1024 hierarchy', () => {
    const sampleCount = 4099;
    const timeMs = Float64Array.from({ length: sampleCount }, (_, index) => index * 7 + (index % 11));
    const values = Float64Array.from({ length: sampleCount }, (_, index) => Math.sin(index / 13) * 30 + Math.cos(index / 41) * 9);
    const validity = Uint8Array.from({ length: sampleCount }, (_, index) => index % 97 === 0 || index % 211 === 0 ? 0 : 1);
    const range = { startSampleIndex: 0, timeMs, values, validity };
    const hierarchy = buildEnvelopeBlockHierarchy(values, timeMs, validity, 64, 3);

    expect(hierarchy.map((level) => level.blockSize)).toEqual([64, 256, 1024]);
    for (const [startMs, endMs, width] of [
      [timeMs[0]!, timeMs[sampleCount - 1]!, 23],
      [timeMs[0]!, timeMs[sampleCount - 1]!, 137],
      [timeMs[321]!, timeMs[3777]!, 51],
      [timeMs[1000]!, timeMs[1800]!, 311],
    ] as const) {
      expect(buildViewportEnvelopeFromBlocks(range, hierarchy, startMs, endMs, width))
        .toEqual(buildViewportEnvelope(range, startMs, endMs, width));
    }
  });

'''
assert anchor in s, 'test insertion anchor missing'
s = s.replace(anchor, test + anchor, 1)
p.write_text(s)
