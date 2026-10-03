import { BoundNumericChannelDataSource } from '../channels/channel-binding';
import type {
  NumericChannelBatchResult,
  NumericChannelDataSource,
  NumericChannelRange,
} from '../log-model/log-types';

export interface BoundCacheDiagnosticEvent {
  readonly sequence: number;
  readonly kind:
    | 'read-batch-start'
    | 'read-batch-end'
    | 'read-single-start'
    | 'read-single-end'
    | 'has-cache'
    | 'retain';
  readonly boundInstanceId: number;
  readonly sourceInstanceId: number;
  readonly channelIds: readonly string[];
  readonly sourceChannelIds: readonly string[];
  readonly residentCount: number;
  readonly residentSourceIds: readonly string[];
  readonly startSampleIndex?: number;
  readonly sampleCount?: number;
  readonly cacheReady?: boolean;
  readonly retained?: boolean;
  readonly cacheHitChannelIds?: readonly string[];
  readonly physicalReadCount?: number;
  readonly physicalBytesRead?: number;
}

export interface BoundCacheDiagnosticSnapshot {
  readonly boundInstances: number;
  readonly rawSources: number;
  readonly retainAttempts: number;
  readonly retainSuccesses: number;
  readonly hasCacheChecks: number;
  readonly recentEvents: readonly BoundCacheDiagnosticEvent[];
}

type BoundInternals = {
  readonly source: NumericChannelDataSource;
  readonly sourceChannelIdByBoundId: ReadonlyMap<string, string>;
  readonly residentFullRanges: Map<string, NumericChannelRange>;
};

type BoundPrototype = {
  retainFullRange(channelId: string, range: NumericChannelRange): void;
  hasCachedChannelRange(
    channelId: string,
    startSampleIndex: number,
    sampleCount: number,
  ): boolean;
  readChannelRange(
    channelId: string,
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<NumericChannelRange>;
  readChannelsRange(
    channelIds: readonly string[],
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<NumericChannelBatchResult>;
};

const boundIds = new WeakMap<object, number>();
const sourceIds = new WeakMap<object, number>();
let nextBoundId = 1;
let nextSourceId = 1;
let sequence = 0;
let retainAttempts = 0;
let retainSuccesses = 0;
let hasCacheChecks = 0;
const events: BoundCacheDiagnosticEvent[] = [];

function objectId(map: WeakMap<object, number>, object: object, next: () => number): number {
  const existing = map.get(object);
  if (existing) return existing;
  const created = next();
  map.set(object, created);
  return created;
}

function boundId(instance: object): number {
  return objectId(boundIds, instance, () => nextBoundId++);
}

function sourceId(source: object): number {
  return objectId(sourceIds, source, () => nextSourceId++);
}

function internals(instance: BoundNumericChannelDataSource): BoundInternals {
  return instance as unknown as BoundInternals;
}

function sourceChannelIds(
  state: BoundInternals,
  channelIds: readonly string[],
): string[] {
  return channelIds.map((channelId) => state.sourceChannelIdByBoundId.get(channelId) ?? '?');
}

function record(
  instance: BoundNumericChannelDataSource,
  kind: BoundCacheDiagnosticEvent['kind'],
  channelIds: readonly string[],
  extra: Omit<
    BoundCacheDiagnosticEvent,
    | 'sequence'
    | 'kind'
    | 'boundInstanceId'
    | 'sourceInstanceId'
    | 'channelIds'
    | 'sourceChannelIds'
    | 'residentCount'
    | 'residentSourceIds'
  > = {},
): void {
  const state = internals(instance);
  events.push({
    sequence: ++sequence,
    kind,
    boundInstanceId: boundId(instance),
    sourceInstanceId: sourceId(state.source),
    channelIds: [...channelIds],
    sourceChannelIds: sourceChannelIds(state, channelIds),
    residentCount: state.residentFullRanges.size,
    residentSourceIds: [...state.residentFullRanges.keys()],
    ...extra,
  });
  if (events.length > 60) events.shift();
}

export function latestBoundCacheDiagnosticSnapshot(): BoundCacheDiagnosticSnapshot {
  return {
    boundInstances: nextBoundId - 1,
    rawSources: nextSourceId - 1,
    retainAttempts,
    retainSuccesses,
    hasCacheChecks,
    recentEvents: [...events],
  };
}

const prototype = BoundNumericChannelDataSource.prototype as unknown as BoundPrototype;
const marker = Symbol.for('epicscope.bound-cache-observability-installed');
const globalMarker = globalThis as typeof globalThis & { [marker]?: boolean };

if (!globalMarker[marker]) {
  globalMarker[marker] = true;

  const originalRetain = prototype.retainFullRange;
  prototype.retainFullRange = function (
    this: BoundNumericChannelDataSource,
    channelId: string,
    range: NumericChannelRange,
  ): void {
    retainAttempts += 1;
    const state = internals(this);
    const sourceChannelId = state.sourceChannelIdByBoundId.get(channelId);
    const retained = range.startSampleIndex === 0
      && range.values.length === this.sampleCount
      && sourceChannelId !== undefined;
    originalRetain.call(this, channelId, range);
    if (retained && sourceChannelId && state.residentFullRanges.has(sourceChannelId)) {
      retainSuccesses += 1;
    }
    record(this, 'retain', [channelId], {
      startSampleIndex: range.startSampleIndex,
      sampleCount: range.values.length,
      retained,
    });
  };

  const originalHasCache = prototype.hasCachedChannelRange;
  prototype.hasCachedChannelRange = function (
    this: BoundNumericChannelDataSource,
    channelId: string,
    startSampleIndex: number,
    sampleCount: number,
  ): boolean {
    hasCacheChecks += 1;
    const cacheReady = originalHasCache.call(this, channelId, startSampleIndex, sampleCount);
    record(this, 'has-cache', [channelId], {
      startSampleIndex,
      sampleCount,
      cacheReady,
    });
    return cacheReady;
  };

  const originalReadSingle = prototype.readChannelRange;
  prototype.readChannelRange = async function (
    this: BoundNumericChannelDataSource,
    channelId: string,
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<NumericChannelRange> {
    record(this, 'read-single-start', [channelId], { startSampleIndex, sampleCount });
    const result = await originalReadSingle.call(this, channelId, startSampleIndex, sampleCount);
    record(this, 'read-single-end', [channelId], {
      startSampleIndex: result.startSampleIndex,
      sampleCount: result.values.length,
    });
    return result;
  };

  const originalReadBatch = prototype.readChannelsRange;
  prototype.readChannelsRange = async function (
    this: BoundNumericChannelDataSource,
    channelIds: readonly string[],
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<NumericChannelBatchResult> {
    record(this, 'read-batch-start', channelIds, { startSampleIndex, sampleCount });
    const result = await originalReadBatch.call(this, channelIds, startSampleIndex, sampleCount);
    record(this, 'read-batch-end', channelIds, {
      startSampleIndex,
      sampleCount,
      cacheHitChannelIds: [...result.performance.cacheHitChannelIds],
      physicalReadCount: result.performance.physicalReadCount,
      physicalBytesRead: result.performance.physicalBytesRead,
    });
    return result;
  };
}
