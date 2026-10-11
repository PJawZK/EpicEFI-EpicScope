import type { NumericChannelRange } from '../log-model/log-types';

export interface FuelingContextInputs {
  readonly reference: NumericChannelRange;
  readonly dfcoActive?: NumericChannelRange;
  readonly fuelCutReason?: NumericChannelRange;
  readonly aeActive?: NumericChannelRange;
  readonly decelActive?: NumericChannelRange;
}

export interface FuelingCutReasonCount {
  readonly code: number;
  readonly count: number;
}

export interface FuelingContextResult {
  readonly inputSampleCount: number;
  readonly calibrationEligibleSampleIndices: readonly number[];
  readonly delayEligibleSampleIndices: readonly number[];
  readonly dfcoActiveSampleCount: number;
  readonly fuelCutSampleCount: number;
  readonly aeActiveSampleCount: number;
  readonly decelActiveSampleCount: number;
  readonly invalidContextSampleCount: number;
  readonly unavailableContextSampleCount: number;
  readonly fuelCutReasonCounts: readonly FuelingCutReasonCount[];
}

function localIndex(range: NumericChannelRange, sampleIndex: number): number | undefined {
  const index = sampleIndex - range.startSampleIndex;
  if (!Number.isSafeInteger(index) || index < 0 || index >= range.values.length || index >= range.validity.length) return undefined;
  return index;
}

function selectedIndices(reference: NumericChannelRange, sampleIndices?: ArrayLike<number>): number[] {
  const raw = sampleIndices
    ? Array.from({ length: sampleIndices.length }, (_, index) => sampleIndices[index])
    : Array.from({ length: reference.values.length }, (_, index) => reference.startSampleIndex + index);
  return [...new Set(raw.filter((value): value is number => Number.isSafeInteger(value)))].sort((left, right) => left - right);
}

type ContextSample = { readonly kind: 'valid'; readonly value: number } | { readonly kind: 'invalid' | 'unavailable' };

function contextSample(range: NumericChannelRange | undefined, sampleIndex: number): ContextSample | undefined {
  if (!range) return undefined;
  const index = localIndex(range, sampleIndex);
  if (index === undefined) return { kind: 'unavailable' };
  if (range.validity[index] !== 1) return { kind: 'invalid' };
  const value = range.values[index];
  if (value === undefined || !Number.isFinite(value)) return { kind: 'invalid' };
  return { kind: 'valid', value };
}

export function qualifyFuelingContext(
  inputs: FuelingContextInputs,
  sampleIndices?: ArrayLike<number>,
): FuelingContextResult {
  const indices = selectedIndices(inputs.reference, sampleIndices);
  const calibrationEligibleSampleIndices: number[] = [];
  const delayEligibleSampleIndices: number[] = [];
  const reasonCounts = new Map<number, number>();

  let dfcoActiveSampleCount = 0;
  let fuelCutSampleCount = 0;
  let aeActiveSampleCount = 0;
  let decelActiveSampleCount = 0;
  let invalidContextSampleCount = 0;
  let unavailableContextSampleCount = 0;

  for (const sampleIndex of indices) {
    const samples = [
      contextSample(inputs.dfcoActive, sampleIndex),
      contextSample(inputs.fuelCutReason, sampleIndex),
      contextSample(inputs.aeActive, sampleIndex),
      contextSample(inputs.decelActive, sampleIndex),
    ];
    if (samples.some((entry) => entry?.kind === 'unavailable')) {
      unavailableContextSampleCount += 1;
      continue;
    }
    if (samples.some((entry) => entry?.kind === 'invalid')) {
      invalidContextSampleCount += 1;
      continue;
    }

    const dfco = samples[0]?.kind === 'valid' ? samples[0].value : 0;
    const cutReason = samples[1]?.kind === 'valid' ? Math.trunc(samples[1].value) : 0;
    const ae = samples[2]?.kind === 'valid' ? samples[2].value : 0;
    const decel = samples[3]?.kind === 'valid' ? samples[3].value : 0;

    const dfcoActive = dfco !== 0;
    const fuelCutActive = cutReason !== 0;
    const aeActive = ae !== 0;
    const decelActive = decel !== 0;

    if (dfcoActive) dfcoActiveSampleCount += 1;
    if (fuelCutActive) {
      fuelCutSampleCount += 1;
      reasonCounts.set(cutReason, (reasonCounts.get(cutReason) ?? 0) + 1);
    }
    if (aeActive) aeActiveSampleCount += 1;
    if (decelActive) decelActiveSampleCount += 1;

    if (dfcoActive || fuelCutActive) continue;
    delayEligibleSampleIndices.push(sampleIndex);
    if (!aeActive && !decelActive) calibrationEligibleSampleIndices.push(sampleIndex);
  }

  return {
    inputSampleCount: indices.length,
    calibrationEligibleSampleIndices,
    delayEligibleSampleIndices,
    dfcoActiveSampleCount,
    fuelCutSampleCount,
    aeActiveSampleCount,
    decelActiveSampleCount,
    invalidContextSampleCount,
    unavailableContextSampleCount,
    fuelCutReasonCounts: [...reasonCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0] - right[0])
      .map(([code, count]) => ({ code, count })),
  };
}
