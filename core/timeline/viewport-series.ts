import type { NumericChannelEnvelopeBlocks, NumericChannelRange } from '../log-model/log-types';

export interface ViewportEnvelopeColumn {
  readonly x: number;
  readonly first: number;
  readonly firstTimeMs: number;
  readonly min: number;
  readonly minTimeMs: number;
  readonly max: number;
  readonly maxTimeMs: number;
  readonly last: number;
  readonly lastTimeMs: number;
}

export interface ViewportEnvelope {
  readonly columns: readonly ViewportEnvelopeColumn[];
  readonly valueMin: number;
  readonly valueMax: number;
  readonly validSampleCount: number;
  readonly invalidSampleCount: number;
}

interface BucketState {
  first: number;
  firstTimeMs: number;
  min: number;
  minTimeMs: number;
  max: number;
  maxTimeMs: number;
  last: number;
  lastTimeMs: number;
}

function lowerBound(values: Float64Array, target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = low + Math.floor((high - low) / 2);
    if ((values[mid] ?? Number.POSITIVE_INFINITY) < target) low = mid + 1;
    else high = mid;
  }
  return low;
}

function upperBound(values: Float64Array, target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = low + Math.floor((high - low) / 2);
    if ((values[mid] ?? Number.POSITIVE_INFINITY) <= target) low = mid + 1;
    else high = mid;
  }
  return low;
}

export function buildEnvelopeBlockSummary(
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

function aggregateEnvelopeBlockSummary(
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

function viewportX(timeMs: number, startMs: number, span: number, pixelWidth: number): number {
  const normalized = (timeMs - startMs) / span;
  return Math.min(pixelWidth - 1, Math.max(0, Math.floor(normalized * pixelWidth)));
}

export function buildViewportEnvelopeFromBlocks(
  range: NumericChannelRange,
  blocks: NumericChannelEnvelopeBlocks | readonly NumericChannelEnvelopeBlocks[],
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
  const levels = (Array.isArray(blocks) ? blocks : [blocks])
    .filter((level) => Number.isSafeInteger(level.blockSize) && level.blockSize > 0)
    .sort((left, right) => right.blockSize - left.blockSize);
  if (levels.length === 0) return buildViewportEnvelope(range, startMs, endMs, pixelWidth);

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

  const mergeBlock = (level: NumericChannelEnvelopeBlocks, block: number): boolean => {
    const count = level.validCount[block] ?? 0;
    if (count === 0) {
      invalidSampleCount += level.invalidCount[block] ?? 0;
      return true;
    }
    const firstTime = level.firstTimeMs[block];
    const lastTime = level.lastTimeMs[block];
    if (firstTime === undefined || lastTime === undefined || !Number.isFinite(firstTime) || !Number.isFinite(lastTime)) return false;
    const x = viewportX(firstTime, startMs, span, pixelWidth);
    if (x !== viewportX(lastTime, startMs, span, pixelWidth)) return false;
    const firstValue = level.first[block];
    const minValue = level.min[block];
    const maxValue = level.max[block];
    const lastValue = level.last[block];
    const minTime = level.minTimeMs[block];
    const maxTime = level.maxTimeMs[block];
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
    invalidSampleCount += level.invalidCount[block] ?? 0;
    valueMin = Math.min(valueMin, minValue!); valueMax = Math.max(valueMax, maxValue!);
    return true;
  };

  const startIndex = lowerBound(range.timeMs, startMs);
  const endIndex = upperBound(range.timeMs, endMs);
  let index = startIndex;
  while (index < endIndex) {
    let merged = false;
    for (const level of levels) {
      const blockSize = level.blockSize;
      if (index % blockSize !== 0) continue;
      const block = Math.floor(index / blockSize);
      const blockStart = block * blockSize;
      const blockEnd = Math.min(range.values.length, blockStart + blockSize);
      if (blockStart !== index || blockEnd > endIndex) continue;
      if (mergeBlock(level, block)) {
        index = blockEnd;
        merged = true;
        break;
      }
    }
    if (merged) continue;
    scanSample(index);
    index += 1;
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

export function buildViewportEnvelope(
  range: NumericChannelRange,
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

  const span = Math.max(1e-9, endMs - startMs);
  const buckets = new Map<number, BucketState>();
  let valueMin = Number.POSITIVE_INFINITY;
  let valueMax = Number.NEGATIVE_INFINITY;
  let validSampleCount = 0;
  let invalidSampleCount = 0;

  const startIndex = lowerBound(range.timeMs, startMs);
  const endIndex = upperBound(range.timeMs, endMs);

  for (let index = startIndex; index < endIndex; index += 1) {
    const timeMs = range.timeMs[index];
    const value = range.values[index];
    const valid = range.validity[index] === 1;
    if (timeMs === undefined || value === undefined) continue;
    if (!valid || !Number.isFinite(value)) {
      invalidSampleCount += 1;
      continue;
    }

    validSampleCount += 1;
    valueMin = Math.min(valueMin, value);
    valueMax = Math.max(valueMax, value);
    const normalized = (timeMs - startMs) / span;
    const x = Math.min(pixelWidth - 1, Math.max(0, Math.floor(normalized * pixelWidth)));
    const bucket = buckets.get(x);
    if (bucket) {
      if (value < bucket.min) {
        bucket.min = value;
        bucket.minTimeMs = timeMs;
      }
      if (value > bucket.max) {
        bucket.max = value;
        bucket.maxTimeMs = timeMs;
      }
      bucket.last = value;
      bucket.lastTimeMs = timeMs;
    } else {
      buckets.set(x, {
        first: value,
        firstTimeMs: timeMs,
        min: value,
        minTimeMs: timeMs,
        max: value,
        maxTimeMs: timeMs,
        last: value,
        lastTimeMs: timeMs,
      });
    }
  }

  return {
    columns: [...buckets.entries()]
      .sort(([left], [right]) => left - right)
      .map(([x, bucket]) => ({ x, ...bucket })),
    valueMin: validSampleCount > 0 ? valueMin : 0,
    valueMax: validSampleCount > 0 ? valueMax : 0,
    validSampleCount,
    invalidSampleCount,
  };
}

export interface RawViewportPoint {
  readonly timeMs: number;
  readonly value: number;
  readonly breakBefore: boolean;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/**
 * Returns the actual valid samples inside a viewport in source order.
 *
 * Lines are broken only when source validity is interrupted or when the
 * timestamp spacing is substantially larger than the normal cadence in the
 * visible range. This is intended for high-zoom rendering where pixel-bucket
 * spacing is not evidence of missing data.
 */
export function buildRawViewportSeries(
  range: NumericChannelRange,
  startMs: number,
  endMs: number,
): readonly RawViewportPoint[] {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    throw new RangeError(`Invalid viewport range ${startMs}..${endMs}.`);
  }

  const startIndex = lowerBound(range.timeMs, startMs);
  const endIndex = upperBound(range.timeMs, endMs);
  const cadenceSamples: number[] = [];
  let previousTime: number | undefined;

  for (let index = startIndex; index < endIndex; index += 1) {
    const timeMs = range.timeMs[index];
    if (timeMs === undefined || !Number.isFinite(timeMs)) continue;
    if (previousTime !== undefined) {
      const delta = timeMs - previousTime;
      if (delta > 0 && Number.isFinite(delta)) cadenceSamples.push(delta);
    }
    previousTime = timeMs;
  }

  const normalCadenceMs = median(cadenceSamples);
  const gapThresholdMs = Math.max(50, normalCadenceMs * 5);
  const points: RawViewportPoint[] = [];
  let forceBreak = true;
  let previousValidTime: number | undefined;

  for (let index = startIndex; index < endIndex; index += 1) {
    const timeMs = range.timeMs[index];
    const value = range.values[index];
    if (
      timeMs === undefined
      || value === undefined
      || range.validity[index] !== 1
      || !Number.isFinite(timeMs)
      || !Number.isFinite(value)
    ) {
      forceBreak = true;
      continue;
    }

    const timeGap = previousValidTime === undefined ? 0 : timeMs - previousValidTime;
    points.push({
      timeMs,
      value,
      breakBefore: forceBreak || previousValidTime === undefined || timeGap > gapThresholdMs,
    });
    forceBreak = false;
    previousValidTime = timeMs;
  }

  return points;
}

