export interface ChannelDecodePerformanceSnapshot {
  readonly recordedAt: number;
  readonly channelCount: number;
  readonly sampleCount: number;
  readonly batchCount: number;
  readonly totalMs: number;
  readonly cacheResolveMs: number;
  readonly batchPlanMs: number;
  readonly sourceReadAwaitMs: number;
  readonly decodeTransformMs: number;
  readonly resultAssemblyMs: number;
  readonly cacheStoreMs: number;
}

const MAX_SNAPSHOTS = 20;
const snapshots: ChannelDecodePerformanceSnapshot[] = [];

export function recordChannelDecodePerformance(
  snapshot: ChannelDecodePerformanceSnapshot,
): void {
  snapshots.push(snapshot);
  if (snapshots.length > MAX_SNAPSHOTS) snapshots.shift();
}

export function latestChannelDecodePerformance(
  channelCount?: number,
): ChannelDecodePerformanceSnapshot | undefined {
  for (let index = snapshots.length - 1; index >= 0; index -= 1) {
    const snapshot = snapshots[index];
    if (!snapshot) continue;
    if (channelCount === undefined || snapshot.channelCount === channelCount) return snapshot;
  }
  return undefined;
}

export function clearChannelDecodePerformance(): void {
  snapshots.length = 0;
}
