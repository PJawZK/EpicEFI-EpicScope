import type { NumericChannelDataSource, NumericChannelRange } from '../log-model/log-types';

export type ChannelValueSearchMode = 'max' | 'min' | 'closest';
export type ChannelConstraintOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq';

export interface ChannelValueConstraint {
  readonly channelId: string;
  readonly operator: ChannelConstraintOperator;
  readonly value: number;
}

export interface ChannelValueSearchRequest {
  readonly channelId: string;
  readonly mode: ChannelValueSearchMode;
  readonly targetValue?: number;
  readonly constraint?: ChannelValueConstraint;
  readonly resultLimit?: number;
  readonly chunkSize?: number;
}

export interface ChannelValueSearchResult {
  readonly rank: number;
  readonly sampleIndex: number;
  readonly timeMs: number;
  readonly value: number;
  readonly constraintValue?: number;
}

const DEFAULT_CHUNK_SIZE = 8192;
const DEFAULT_RESULT_LIMIT = 100;
const MAX_RESULT_LIMIT = 500;

function validAt(range: NumericChannelRange, index: number): boolean {
  return range.validity[index] === 1
    && Number.isFinite(range.timeMs[index])
    && Number.isFinite(range.values[index]);
}

function constraintMatches(value: number, operator: ChannelConstraintOperator, target: number): boolean {
  if (operator === 'gt') return value > target;
  if (operator === 'gte') return value >= target;
  if (operator === 'lt') return value < target;
  if (operator === 'lte') return value <= target;
  return value === target;
}

function score(mode: ChannelValueSearchMode, value: number, targetValue: number | undefined): number {
  if (mode === 'max') return -value;
  if (mode === 'min') return value;
  if (targetValue === undefined || !Number.isFinite(targetValue)) {
    throw new RangeError('closest search requires a finite targetValue.');
  }
  return Math.abs(value - targetValue);
}

function insertRanked(
  results: ChannelValueSearchResult[],
  candidate: ChannelValueSearchResult,
  mode: ChannelValueSearchMode,
  targetValue: number | undefined,
  limit: number,
): void {
  const candidateScore = score(mode, candidate.value, targetValue);
  let low = 0;
  let high = results.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const current = results[mid];
    if (!current) break;
    const currentScore = score(mode, current.value, targetValue);
    const candidateFirst = candidateScore < currentScore
      || (candidateScore === currentScore && candidate.timeMs < current.timeMs);
    if (candidateFirst) high = mid;
    else low = mid + 1;
  }
  results.splice(low, 0, candidate);
  if (results.length > limit) results.pop();
}

export async function searchChannelValues(
  source: NumericChannelDataSource,
  request: ChannelValueSearchRequest,
): Promise<readonly ChannelValueSearchResult[]> {
  if (!request.channelId) throw new RangeError('channelId is required.');
  if (request.mode === 'closest' && (request.targetValue === undefined || !Number.isFinite(request.targetValue))) {
    throw new RangeError('closest search requires a finite targetValue.');
  }
  if (request.constraint && !Number.isFinite(request.constraint.value)) {
    throw new RangeError('constraint value must be finite.');
  }

  const limit = Math.min(MAX_RESULT_LIMIT, Math.max(1, Math.floor(request.resultLimit ?? DEFAULT_RESULT_LIMIT)));
  const chunkSize = Math.max(1, Math.floor(request.chunkSize ?? DEFAULT_CHUNK_SIZE));
  const results: ChannelValueSearchResult[] = [];

  for (let start = 0; start < source.sampleCount; start += chunkSize) {
    const count = Math.min(chunkSize, source.sampleCount - start);
    const [primary, constraint] = await Promise.all([
      source.readChannelRange(request.channelId, start, count),
      request.constraint
        ? source.readChannelRange(request.constraint.channelId, start, count)
        : Promise.resolve(undefined),
    ]);

    const sampleCount = Math.min(primary.values.length, primary.timeMs.length, primary.validity.length);
    for (let index = 0; index < sampleCount; index += 1) {
      if (!validAt(primary, index)) continue;

      let constraintValue: number | undefined;
      if (request.constraint) {
        if (!constraint || !validAt(constraint, index)) continue;
        const rawConstraintValue = constraint.values[index];
        if (rawConstraintValue === undefined) continue;
        constraintValue = rawConstraintValue;
        if (!constraintMatches(constraintValue, request.constraint.operator, request.constraint.value)) continue;
      }

      const value = primary.values[index];
      const timeMs = primary.timeMs[index];
      if (value === undefined || timeMs === undefined) continue;

      insertRanked(results, {
        rank: 0,
        sampleIndex: primary.startSampleIndex + index,
        timeMs,
        value,
        ...(constraintValue === undefined ? {} : { constraintValue }),
      }, request.mode, request.targetValue, limit);
    }
  }

  return results.map((result, index) => ({ ...result, rank: index + 1 }));
}


export function findSteppedSearchResultIndex(
  results: readonly ChannelValueSearchResult[],
  currentIndex: number,
  direction: -1 | 1,
  minimumValueStep: number,
): number | undefined {
  if (results.length === 0 || currentIndex < 0 || currentIndex >= results.length) return undefined;

  const current = results[currentIndex];
  if (!current) return undefined;
  const step = Number.isFinite(minimumValueStep) ? Math.max(0, Math.abs(minimumValueStep)) : 0;

  for (
    let index = currentIndex + direction;
    index >= 0 && index < results.length;
    index += direction
  ) {
    const candidate = results[index];
    if (!candidate) continue;
    if (step === 0 || Math.abs(candidate.value - current.value) >= step) return index;
  }

  return undefined;
}
