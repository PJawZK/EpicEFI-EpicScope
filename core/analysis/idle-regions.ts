import type { NumericChannelRange } from '../log-model/log-types';
import { matchesNumericQualification } from './sample-qualification';

export interface IdleCandidateRegion {
  readonly startMs: number;
  readonly endMs: number;
  readonly startSampleIndex: number;
  readonly endSampleIndex: number;
  readonly validSampleCount: number;
}
export interface IdleCandidateOptions {
  readonly maximumRpm: number;
  readonly minimumDurationMs: number;
  readonly maximumGapMs: number;
  readonly eligibility?: Uint8Array;
}

/** RPM-only candidate windows, not inferred idle state or a tuning verdict.
 * Invalid unrecovered records, nonpositive RPM and gaps end a window. A valid
 * same-time retry can replace an invalid attempt without inventing a gap.
 * Bounds are inclusive original recorded samples; no interpolation or padding.
 */
export function discoverIdleCandidates(rpm: NumericChannelRange, options: IdleCandidateOptions) {
  const { maximumRpm, minimumDurationMs, maximumGapMs } = options;
  if (!Number.isFinite(maximumRpm) || maximumRpm <= 0 || !Number.isFinite(minimumDurationMs) || minimumDurationMs <= 0
    || !Number.isFinite(maximumGapMs) || maximumGapMs <= 0) throw new RangeError('Invalid Idle candidate settings.');
  if (options.eligibility && options.eligibility.length !== rpm.values.length) throw new RangeError('Idle discovery eligibility must match the original RPM grid.');
  const regions: IdleCandidateRegion[] = [];
  let current: IdleCandidateRegion | undefined;
  let invalidTime: number | undefined;
  let totalCount = 0;
  const finish = () => {
    if (current && current.endMs - current.startMs >= minimumDurationMs) {
      totalCount += 1;
      // Bound UI/session storage, still report all detected intervals.
      if (regions.length < 200) regions.push(current);
    }
    current = undefined;
  };
  for (let local = 0; local < rpm.values.length; local += 1) {
    const time = rpm.timeMs[local], value = rpm.values[local];
    if (time === undefined || !Number.isFinite(time)) { finish(); invalidTime = undefined; continue; }
    if (invalidTime !== undefined && invalidTime !== time) { finish(); invalidTime = undefined; }
    if (rpm.validity[local] !== 1 || value === undefined || !Number.isFinite(value)) { invalidTime = time; continue; }
    invalidTime = undefined;
    if (options.eligibility && options.eligibility[local] !== 1) { finish(); continue; }
    if (!matchesNumericQualification(value, 'gt', 0) || !matchesNumericQualification(value, 'lte', maximumRpm)) { finish(); continue; }
    if (current && (time < current.endMs || time - current.endMs > maximumGapMs)) finish();
    const index = rpm.startSampleIndex + local;
    current = current ? { ...current, endMs: time, endSampleIndex: index, validSampleCount: current.validSampleCount + 1 }
      : { startMs: time, endMs: time, startSampleIndex: index, endSampleIndex: index, validSampleCount: 1 };
  }
  finish();
  return { regions, totalCount };
}

export interface IdleRegionBounds { readonly startMs: number; readonly endMs: number; }
/** Inclusive union, preserving gaps. Does not fill the bounding envelope between regions. */
export function mergeIdleRegionBounds(regions: readonly IdleRegionBounds[]): IdleRegionBounds[] {
  const sorted = regions.map(({ startMs, endMs }) => {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) throw new RangeError('Invalid Idle region bounds.');
    return { startMs, endMs };
  }).sort((a, b) => a.startMs - b.startMs);
  const merged: IdleRegionBounds[] = [];
  for (const region of sorted) {
    const previous = merged.at(-1);
    if (previous && region.startMs <= previous.endMs) merged[merged.length - 1] = { startMs: previous.startMs, endMs: Math.max(previous.endMs, region.endMs) };
    else merged.push(region);
  }
  return merged;
}

export function idleTimeInRegions(timeMs: number, regions: readonly IdleRegionBounds[]): boolean {
  let low = 0, high = regions.length;
  while (low < high) { const mid = (low + high) >>> 1; if (regions[mid]!.startMs <= timeMs) low = mid + 1; else high = mid; }
  return low > 0 && timeMs <= regions[low - 1]!.endMs;
}
