import type { NumericChannelRange } from '../log-model/log-types';
import { mergeIdleRegionBounds, type IdleRegionBounds } from './idle-regions';
import { analyzeIdle, type IdleAnalysisResult } from './specialized-analyzers';

export interface IdleStabilityResult {
  readonly analysis: IdleAnalysisResult;
  /** Original source indices, including invalid measurements inside the scope. */
  readonly sampleIndices: Uint32Array;
  readonly error: NumericChannelRange | undefined;
  readonly inBandPercent: number | undefined;
  readonly settledBandRpm: number;
  readonly startMs: number | undefined;
  readonly endMs: number | undefined;
}

/** Descriptive recorded-region stability. No inferred idle state, events or tune diagnosis. */
export function analyzeIdleStability(
  rpm: NumericChannelRange,
  target: NumericChannelRange | undefined,
  options: { startMs?: number; endMs?: number; regions?: readonly IdleRegionBounds[]; settledBandRpm?: number; complete?: boolean } = {},
): IdleStabilityResult {
  const lower = options.startMs ?? Number.NEGATIVE_INFINITY;
  const upper = options.endMs ?? Number.POSITIVE_INFINITY;
  const band = options.settledBandRpm ?? 40;
  if ((options.startMs !== undefined && !Number.isFinite(options.startMs))
    || (options.endMs !== undefined && !Number.isFinite(options.endMs))
    || upper < lower || !Number.isFinite(band) || band < 0) {
    throw new RangeError('Invalid stability scope or settled band.');
  }
  const regions = options.regions === undefined ? undefined : mergeIdleRegionBounds(options.regions);
  const includes = (time: number) => {
    if (!regions) return true;
    let low = 0, high = regions.length;
    while (low < high) { const mid = (low + high) >>> 1; if (regions[mid]!.startMs <= time) low = mid + 1; else high = mid; }
    return low > 0 && time <= regions[low - 1]!.endMs;
  };
  const indices: number[] = [];
  const values = target ? new Float64Array(rpm.values.length).fill(Number.NaN) : undefined;
  const validity = target ? new Uint8Array(rpm.values.length) : undefined;
  // Reject incompatible sample/time grids for paired metrics without changing original inputs.
  const targetValidity = target ? new Uint8Array(target.validity) : undefined;
  let paired = 0;
  let inBand = 0;
  let startMs: number | undefined;
  let endMs: number | undefined;
  for (let local = 0; local < rpm.values.length; local += 1) {
    const time = rpm.timeMs[local];
    if (time === undefined || !Number.isFinite(time) || time < lower || time > upper || !includes(time)) continue;
    const index = rpm.startSampleIndex + local;
    indices.push(index);
    startMs = startMs === undefined ? time : Math.min(startMs, time);
    endMs = endMs === undefined ? time : Math.max(endMs, time);
    if (!target || !targetValidity || !values || !validity) continue;
    const other = index - target.startSampleIndex;
    if (other < 0 || other >= target.values.length) continue;
    const actual = rpm.values[local];
    const desired = target.values[other];
    if (target.timeMs[other] !== time) targetValidity[other] = 0;
    if (rpm.validity[local] !== 1 || targetValidity[other] !== 1 || actual === undefined || desired === undefined
      || !Number.isFinite(actual) || !Number.isFinite(desired)) continue;
    const error = actual - desired;
    values[local] = error;
    validity[local] = 1;
    paired += 1;
    if (Math.abs(error) <= band) inBand += 1;
  }
  const sampleIndices = Uint32Array.from(indices);
  const alignedTarget = target && targetValidity ? { ...target, validity: targetValidity } : undefined;
  const analysis = analyzeIdle({ rpm, ...(alignedTarget ? { target: alignedTarget } : {}) }, {
    sampleIndices, complete: options.complete === true, includeSagEvents: false,
  });
  return {
    analysis, sampleIndices,
    error: values && validity ? { startSampleIndex: rpm.startSampleIndex, timeMs: rpm.timeMs, values, validity } : undefined,
    inBandPercent: paired ? 100 * inBand / paired : undefined,
    settledBandRpm: band, startMs, endMs,
  };
}
