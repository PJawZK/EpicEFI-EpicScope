import { getTimeQueryIndex } from '../log-model/time-query-index';
import type { NumericChannelEnvelopeBlocks, NumericChannelRange } from '../log-model/log-types';

export interface ViewportEnvelopeColumn {
  readonly x: number;
  /** Present only when the source has multiple monotonic runs. */
  readonly sourceRun?: number;
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

  if (!getTimeQueryIndex(range.timeMs).monotonic) return buildViewportEnvelope(range, startMs, endMs, pixelWidth);

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
    if (count === 0) {
      invalidSampleCount += blocks.invalidCount[block] ?? 0;
      return true;
    }
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
    invalidSampleCount += blocks.invalidCount[block] ?? 0;
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

export function buildViewportEnvelope(range: NumericChannelRange, startMs: number, endMs: number, pixelWidth: number): ViewportEnvelope {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs || !Number.isSafeInteger(pixelWidth) || pixelWidth <= 0) throw new RangeError('Invalid viewport bounds/width');
  const index = getTimeQueryIndex(range.timeMs), spans = index.spans(startMs, endMs);
  const columns: ViewportEnvelopeColumn[] = []; let validSampleCount = 0, invalidSampleCount = 0, valueMin = Infinity, valueMax = -Infinity;
  for (const span of spans) {
    const envelope = buildMonotonicEnvelope(range, startMs, endMs, pixelWidth, span.start, span.end);
    for (const column of envelope.columns) columns.push(index.monotonic ? column : { ...column, sourceRun: span.run });
    validSampleCount += envelope.validSampleCount; invalidSampleCount += envelope.invalidSampleCount;
    if (envelope.validSampleCount) { valueMin = Math.min(valueMin, envelope.valueMin); valueMax = Math.max(valueMax, envelope.valueMax); }
  }
  return { columns, validSampleCount, invalidSampleCount, valueMin: validSampleCount ? valueMin : 0, valueMax: validSampleCount ? valueMax : 0 };
}

function buildMonotonicEnvelope(
  range: NumericChannelRange,
  startMs: number,
  endMs: number,
  pixelWidth: number,
  startIndex: number,
  endIndex: number,
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

/** A bounded source-local reference, independent of the current zoom/pan bounds. */
function hasCadenceGap(range: NumericChannelRange, index: number, previousTime: number): boolean {
  const gap = range.timeMs[index]! - previousTime;
  if (gap <= 50) return false;
  const query = getTimeQueryIndex(range.timeMs), runId = query.runAt(index), run = runId === undefined ? undefined : query.runs[runId];
  const intervals: number[] = [];
  for (let i = index - 1; i > Math.max(run?.start ?? 0, index - 130); i--) {
    const delta = range.timeMs[i]! - range.timeMs[i - 1]!;
    if (Number.isFinite(delta) && delta > 0) intervals.push(delta);
  }
  // At the beginning of a loaded range, use available following context. With
  // no reference cadence, two observations alone cannot establish an outlier.
  if (intervals.length === 0) {
    for (let i = index + 1; i < Math.min(run?.end ?? range.timeMs.length, index + 130); i++) {
      const delta = range.timeMs[i]! - range.timeMs[i - 1]!;
      if (Number.isFinite(delta) && delta > 0) intervals.push(delta);
    }
  }
  return intervals.length > 0 && gap > Math.max(50, median(intervals) * 5);
}

/** Empty pixel columns are not source evidence. Check the original observations
 * between adjacent envelope columns, preserving same-time retry replacements.
 * Cached by the existing graph envelope owner; never scans an entire log. */
export function buildViewportEnvelopeBreaks(range: NumericChannelRange, envelope: ViewportEnvelope): readonly boolean[] {
  return envelope.columns.map((column, index) => {
    const previous = envelope.columns[index - 1];
    if (!previous || previous.sourceRun !== column.sourceRun) return true;
    const timeIndex = getTimeQueryIndex(range.timeMs), run = timeIndex.runs[column.sourceRun ?? 0]!;
    const start = timeIndex.bound(previous.lastTimeMs, run.start, run.end, true);
    const end = timeIndex.bound(column.firstTimeMs, run.start, run.end);
    for (let i = start; i < end; i++) {
      if (range.validity[i] !== 1 || !Number.isFinite(range.values[i]) || !Number.isFinite(range.timeMs[i])) return true;
    }
    return hasCadenceGap(range, end, previous.lastTimeMs);
  });
}

/**
 * Returns the actual valid samples inside a viewport in source order.
 * Rendering may opt into the immediate original boundary neighbors for clipping;
 * the default remains strictly scoped and never introduces interpolated samples.
 *
 * Lines are broken only when source validity is interrupted without a valid
 * same-timestamp replacement, or when timestamp spacing is substantially
 * larger than the normal cadence in bounded source-local context. Recovered logger retry
 * attempts are retained as invalid source evidence but do not fabricate a
 * presentation gap when the valid replacement is present immediately after.
 */
export function buildRawViewportSeries(
  range: NumericChannelRange,
  startMs: number,
  endMs: number,
  includeBoundaryNeighbors = false,
): readonly RawViewportPoint[] {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    throw new RangeError(`Invalid viewport range ${startMs}..${endMs}.`);
  }

  const spans = getTimeQueryIndex(range.timeMs).spans(startMs, endMs, includeBoundaryNeighbors);
  const points: RawViewportPoint[] = [];
  let forceBreak = true;
  let previousValidTime: number | undefined;
  let pendingInvalidTime: number | undefined;

  for (const span of spans) {
  forceBreak = true; previousValidTime = undefined; pendingInvalidTime = undefined;
  for (let index = span.start; index < span.end; index += 1) {
    const timeMs = range.timeMs[index];
    const value = range.values[index];
    const usable = timeMs !== undefined
      && value !== undefined
      && range.validity[index] === 1
      && Number.isFinite(timeMs)
      && Number.isFinite(value);

    // Defer a finite invalid group's continuity decision until its timestamp
    // changes or a valid replacement arrives. Each sample is visited once;
    // an earlier unrecovered group must still break a later recovered group.
    if (pendingInvalidTime !== undefined && pendingInvalidTime !== timeMs) {
      forceBreak = true;
      pendingInvalidTime = undefined;
    }
    if (!usable) {
      if (timeMs !== undefined && Number.isFinite(timeMs)) {
        // A later corrupt attempt at an already represented timestamp cannot erase
        // that trusted measurement or manufacture a trace break at the next sample.
        if(timeMs!==previousValidTime)pendingInvalidTime = timeMs;
      }
      else forceBreak = true;
      continue;
    }
    pendingInvalidTime = undefined;

    points.push({
      timeMs,
      value,
      breakBefore: forceBreak || previousValidTime === undefined || hasCadenceGap(range, index, previousValidTime),
    });
    forceBreak = false;
    previousValidTime = timeMs;
  }

  }

  return points;
}


/** Recorded cursor lookup shared by Logger and Analyzer; never interpolates invalid samples. */
/** Nearest original observation, including invalid records; never skip to a healthier neighbor. */
export function nearestNumericSamplePosition(range: NumericChannelRange, cursorTimeMs: number): { sampleIndex: number; timeMs: number } | undefined {
  const index = getTimeQueryIndex(range.timeMs).nearest(cursorTimeMs);
  return index === undefined ? undefined : { sampleIndex: range.startSampleIndex + index, timeMs: range.timeMs[index]! };
}

export function nearestNumericSample(range: NumericChannelRange, cursorTimeMs: number): { sampleIndex: number; timeMs: number; value: number } | undefined {
  const position=nearestNumericSamplePosition(range,cursorTimeMs);
  if(!position)return undefined;
  const index=position.sampleIndex-range.startSampleIndex,value=range.values[index];
  return range.validity[index]===1&&value!==undefined&&Number.isFinite(value)?{...position,value}:undefined;
}

/** Actual first/extrema/last samples in time order, shared with Logger rendering. */
export function rawRepresentativePoints(column: ViewportEnvelopeColumn): readonly { timeMs: number; value: number }[] {
  const candidates = [
    { timeMs: column.firstTimeMs, value: column.first },
    { timeMs: column.minTimeMs, value: column.min },
    { timeMs: column.maxTimeMs, value: column.max },
    { timeMs: column.lastTimeMs, value: column.last },
  ].sort((left, right) => left.timeMs - right.timeMs);
  return candidates.filter((point, index) => index === 0 || point.timeMs !== candidates[index - 1]!.timeMs || point.value !== candidates[index - 1]!.value);
}

/** Logger density policy: raw visible samples when sparse; ordered extrema when dense. */
export function buildViewportTraceSeries(range: NumericChannelRange, startMs: number, endMs: number, pixelWidth: number): {
  readonly mode: 'raw' | 'envelope'; readonly points: readonly RawViewportPoint[];
} {
  const envelope = buildViewportEnvelope(range, startMs, endMs, pixelWidth);
  if (envelope.validSampleCount <= pixelWidth * 2) return { mode: 'raw', points: buildRawViewportSeries(range, startMs, endMs) };
  const points: RawViewportPoint[] = [];
  const breaks = buildViewportEnvelopeBreaks(range, envelope);
  for (const [columnIndex, column] of envelope.columns.entries()) {
    const representatives = rawRepresentativePoints(column);
    representatives.forEach((point, index) => points.push({ ...point, breakBefore: index === 0 && breaks[columnIndex]! }));
  }
  return { mode: 'envelope', points };
}

/** Zero-copy contiguous source cover. Nonmonotonic covers may include out-of-scope
 * records between matches; presentation applies exact indexed time membership. */
export function sliceNumericRangeByTime(range: NumericChannelRange, startMs: number, endMs: number): NumericChannelRange {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) throw new RangeError('Invalid recorded presentation bounds.');
  const cover = getTimeQueryIndex(range.timeMs).cover(startMs, endMs);
  const start = cover.startSampleIndex, end = start + cover.sampleCount;
  return { startSampleIndex: range.startSampleIndex + start, timeMs: range.timeMs.subarray(start, end), values: range.values.subarray(start, end), validity: range.validity.subarray(start, end) };
}
