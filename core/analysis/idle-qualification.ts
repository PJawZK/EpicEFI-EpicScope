import type { NumericChannelRange } from '../log-model/log-types';
import { qualifyNumericSamples, type NumericQualificationCondition, type NumericQualificationChannelRange } from './sample-qualification';
import { idleTimeInRegions, mergeIdleRegionBounds, type IdleRegionBounds } from './idle-regions';

export interface IdleQualificationResult {
  readonly eligibility: Uint8Array;
  readonly input: number;
  readonly eligible: number;
  readonly rejected: number;
  readonly invalid: number;
  readonly unavailable: number;
  readonly manualBypassed: number;
  readonly complete: boolean;
}
/** Threshold conversion only. Original recorded Fahrenheit values are never rewritten. */
export const idleCoolantThreshold = (celsius: number, unit: '°C' | '°F') => unit === '°F' ? celsius * 9 / 5 + 32 : celsius;

/** One original-index scope partition and one shared qualification pass; no per-region analysis. */
export function qualifyIdleSamples(request: {
  referenceId: string;
  channels: ReadonlyMap<string, NumericQualificationChannelRange>;
  conditions: readonly NumericQualificationCondition[];
  scope: readonly IdleRegionBounds[];
  bypass: readonly IdleRegionBounds[];
}): IdleQualificationResult {
  const reference = request.channels.get(request.referenceId);
  if (!reference) throw new Error('Recorded RPM is required for qualification.');
  const rpm: NumericChannelRange = reference.range, scope = mergeIdleRegionBounds(request.scope), bypass = mergeIdleRegionBounds(request.bypass);
  const eligibility = new Uint8Array(rpm.values.length), selected: number[] = [];
  let input = 0, manualBypassed = 0, invalid = 0;
  for (let local = 0; local < rpm.values.length; local++) {
    const time = rpm.timeMs[local];
    if (time === undefined || !Number.isFinite(time) || !idleTimeInRegions(time, scope)) continue;
    input++;
    if (idleTimeInRegions(time, bypass)) {
      const value = rpm.values[local];
      if (rpm.validity[local] === 1 && value !== undefined && Number.isFinite(value)) { eligibility[local] = 1; manualBypassed++; }
      else invalid++;
    } else selected.push(rpm.startSampleIndex + local);
  }
  const bounds = scope.length ? { startMs: scope[0]!.startMs, endMs: scope.at(-1)!.endMs } : undefined;
  const result = qualifyNumericSamples({ referenceChannelId: request.referenceId, channels: request.channels, conditions: request.conditions,
    sampleIndices: Uint32Array.from(selected), requireTimeAlignment: true, ...(bounds ? { timeRange: bounds } : {}) });
  for (const index of result.eligibleSampleIndices) eligibility[index - rpm.startSampleIndex] = 1;
  return { eligibility, input, eligible: result.eligibleSampleCount + manualBypassed, rejected: result.valueRejectedSampleCount, invalid: result.invalidSampleCount + invalid,
    unavailable: result.unavailableSampleCount, manualBypassed, complete: result.complete };
}
