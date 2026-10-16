import type { NumericChannelRange } from '../log-model/log-types';

export type AfrDelayResponsePolarity = 'inverse' | 'same' | 'either';

export interface AfrDelayAnalyzerInputs {
  readonly actualAfr: NumericChannelRange;
  readonly fuelCommand: NumericChannelRange;
  readonly rpm?: NumericChannelRange;
  readonly load?: NumericChannelRange;
}

export interface AfrDelayAnalyzerConfig {
  readonly commandDeltaThreshold: number;
  readonly afrResponseThreshold: number;
  readonly searchWindowMs?: number;
  readonly minimumEventSpacingMs?: number;
  readonly responsePolarity?: AfrDelayResponsePolarity;
}

export interface AfrDelayEvent {
  readonly commandSampleIndex: number;
  readonly responseSampleIndex: number;
  readonly commandTimeMs: number;
  readonly responseTimeMs: number;
  readonly onsetDelayMs: number;
  readonly commandDelta: number;
  readonly baselineAfr: number;
  readonly responseAfr: number;
  readonly responseDeltaAfr: number;
  readonly peakResponseDeltaAfr: number;
  readonly peakResponseDelayMs: number;
  readonly t50Ms: number | undefined;
  readonly t90Ms: number | undefined;
  readonly rpm: number | undefined;
  readonly load: number | undefined;
}

export interface AfrDelayDistribution {
  readonly minimumMs: number;
  readonly p10Ms: number;
  readonly medianMs: number;
  readonly p90Ms: number;
  readonly maximumMs: number;
}

export interface AfrDelayAnalyzerResult {
  readonly candidateEventCount: number;
  readonly usableEventCount: number;
  readonly rejectedNoResponseCount: number;
  readonly rejectedOverlapCount: number;
  readonly rejectedGapCount: number;
  readonly events: readonly AfrDelayEvent[];
  readonly onsetDelay: AfrDelayDistribution | undefined;
  readonly medianT50Ms: number | undefined;
  readonly medianT90Ms: number | undefined;
  readonly evidenceStrength: 'none' | 'limited' | 'moderate' | 'strong';
}

interface SampleValue {
  readonly sampleIndex: number;
  readonly timeMs: number;
  readonly value: number;
}

function sample(range: NumericChannelRange | undefined, sampleIndex: number): SampleValue | undefined {
  if (!range) return undefined;
  const localIndex = sampleIndex - range.startSampleIndex;
  if (!Number.isSafeInteger(localIndex) || localIndex < 0 || localIndex >= range.values.length || localIndex >= range.validity.length) return undefined;
  if (range.validity[localIndex] !== 1) return undefined;
  const value = range.values[localIndex];
  const timeMs = range.timeMs[localIndex];
  if (value === undefined || timeMs === undefined || !Number.isFinite(value) || !Number.isFinite(timeMs)) return undefined;
  return { sampleIndex, timeMs, value };
}

function selectedIndices(reference: NumericChannelRange, sampleIndices?: ArrayLike<number>): number[] {
  const raw = sampleIndices
    ? Array.from({ length: sampleIndices.length }, (_, index) => sampleIndices[index])
    : Array.from({ length: reference.values.length }, (_, index) => reference.startSampleIndex + index);
  return [...new Set(raw.filter((value): value is number => Number.isSafeInteger(value)))].sort((left, right) => left - right);
}

// Internal contract: callers provide ascending values; interpolation never mutates them.
function percentileSorted(sorted: readonly number[], fraction: number): number | undefined {
  if (sorted.length === 0) return undefined;
  const position = Math.max(0, Math.min(1, fraction)) * (sorted.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sorted[lowerIndex]!;
  const upper = sorted[upperIndex]!;
  if (lowerIndex === upperIndex) return lower;
  return lower + (upper - lower) * (position - lowerIndex);
}

function percentile(values: readonly number[], fraction: number): number | undefined {
  return percentileSorted([...values].sort((left, right) => left - right), fraction);
}

function distribution(values: readonly number[]): AfrDelayDistribution | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  return {
    minimumMs: sorted[0]!,
    p10Ms: percentileSorted(sorted, 0.10)!,
    medianMs: percentileSorted(sorted, 0.50)!,
    p90Ms: percentileSorted(sorted, 0.90)!,
    maximumMs: sorted[sorted.length - 1]!,
  };
}

function signedAfrResponse(commandDelta: number, afrDelta: number, polarity: AfrDelayResponsePolarity): number {
  if (polarity === 'either') return Math.abs(afrDelta);
  const commandSign = Math.sign(commandDelta);
  if (commandSign === 0) return 0;
  const expectedAfrSign = polarity === 'inverse' ? -commandSign : commandSign;
  return afrDelta * expectedAfrSign;
}

function evidenceStrength(eventCount: number, spreadMs: number | undefined): AfrDelayAnalyzerResult['evidenceStrength'] {
  if (eventCount === 0) return 'none';
  if (eventCount < 3) return 'limited';
  if (eventCount < 6) return 'moderate';
  if (spreadMs !== undefined && spreadMs <= 200) return 'strong';
  return 'moderate';
}

export function analyzeAfrDelay(
  inputs: AfrDelayAnalyzerInputs,
  config: AfrDelayAnalyzerConfig,
  sampleIndices?: ArrayLike<number>,
): AfrDelayAnalyzerResult {
  const commandThreshold = config.commandDeltaThreshold;
  const responseThreshold = config.afrResponseThreshold;
  const searchWindowMs = config.searchWindowMs ?? 1000;
  const minimumEventSpacingMs = config.minimumEventSpacingMs ?? 250;
  const polarity = config.responsePolarity ?? 'inverse';

  if (!Number.isFinite(commandThreshold) || commandThreshold <= 0) throw new RangeError('AFR delay command delta threshold must be finite and > 0.');
  if (!Number.isFinite(responseThreshold) || responseThreshold <= 0) throw new RangeError('AFR delay response threshold must be finite and > 0.');
  if (!Number.isFinite(searchWindowMs) || searchWindowMs <= 0) throw new RangeError('AFR delay search window must be finite and > 0 ms.');
  if (!Number.isFinite(minimumEventSpacingMs) || minimumEventSpacingMs < 0) throw new RangeError('AFR delay minimum event spacing must be finite and >= 0 ms.');

  const indices = selectedIndices(inputs.fuelCommand, sampleIndices);
  const events: AfrDelayEvent[] = [];
  let candidateEventCount = 0;
  let rejectedNoResponseCount = 0;
  let rejectedOverlapCount = 0;
  let rejectedGapCount = 0;
  let lastCandidateTimeMs = Number.NEGATIVE_INFINITY;

  for (let position = 1; position < indices.length; position += 1) {
    const previousIndex = indices[position - 1]!;
    const commandIndex = indices[position]!;
    if (commandIndex !== previousIndex + 1) continue;
    const previousCommand = sample(inputs.fuelCommand, previousIndex);
    const currentCommand = sample(inputs.fuelCommand, commandIndex);
    const baselineAfr = sample(inputs.actualAfr, previousIndex);
    const currentAfr = sample(inputs.actualAfr, commandIndex);
    if (!previousCommand || !currentCommand || !baselineAfr || !currentAfr) continue;
    if (currentCommand.timeMs <= previousCommand.timeMs) continue;
    const commandDelta = currentCommand.value - previousCommand.value;
    if (Math.abs(commandDelta) < commandThreshold) continue;
    if (currentCommand.timeMs - lastCandidateTimeMs < minimumEventSpacingMs) continue;

    candidateEventCount += 1;
    lastCandidateTimeMs = currentCommand.timeMs;
    let response: SampleValue | undefined;
    let peakSignedResponse = Number.NEGATIVE_INFINITY;
    let peakAfrDelta = 0;
    let peakDelayMs = 0;
    let t50Ms: number | undefined;
    let t90Ms: number | undefined;
    let overlap = false;
    let gapBeforeResponse = false;
    const responseSamples: { sample: SampleValue; afrDelta: number; signedResponse: number; delayMs: number }[] = [];

    for (let scan = position; scan < indices.length; scan += 1) {
      const scanIndex = indices[scan]!;
      if (scan > position && scanIndex !== indices[scan - 1]! + 1) {
        if (!response) gapBeforeResponse = true;
        break;
      }
      const afr = sample(inputs.actualAfr, scanIndex);
      const command = sample(inputs.fuelCommand, scanIndex);
      if (!afr || !command) {
        if (!response) gapBeforeResponse = true;
        break;
      }
      const delayMs = afr.timeMs - currentCommand.timeMs;
      if (delayMs < 0) continue;
      if (delayMs > searchWindowMs) break;

      if (scan > position) {
        const priorCommand = sample(inputs.fuelCommand, indices[scan - 1]!);
        if (priorCommand && Math.abs(command.value - priorCommand.value) >= commandThreshold) {
          overlap = true;
          break;
        }
      }

      const afrDelta = afr.value - baselineAfr.value;
      const signedResponse = signedAfrResponse(commandDelta, afrDelta, polarity);
      responseSamples.push({ sample: afr, afrDelta, signedResponse, delayMs });
      if (signedResponse > peakSignedResponse) {
        peakSignedResponse = signedResponse;
        peakAfrDelta = afrDelta;
        peakDelayMs = delayMs;
      }
      if (!response && signedResponse >= responseThreshold) response = afr;
    }

    if (overlap && !response) {
      rejectedOverlapCount += 1;
      continue;
    }
    if (gapBeforeResponse && !response) {
      rejectedGapCount += 1;
      continue;
    }
    if (!response || peakSignedResponse < responseThreshold) {
      rejectedNoResponseCount += 1;
      continue;
    }

    const halfResponse = peakSignedResponse * 0.5;
    const ninetyResponse = peakSignedResponse * 0.9;
    for (const candidate of responseSamples) {
      if (t50Ms === undefined && candidate.signedResponse >= halfResponse) t50Ms = candidate.delayMs;
      if (t90Ms === undefined && candidate.signedResponse >= ninetyResponse) t90Ms = candidate.delayMs;
      if (t50Ms !== undefined && t90Ms !== undefined) break;
    }

    const responseAfrDelta = response.value - baselineAfr.value;
    events.push({
      commandSampleIndex: commandIndex,
      responseSampleIndex: response.sampleIndex,
      commandTimeMs: currentCommand.timeMs,
      responseTimeMs: response.timeMs,
      onsetDelayMs: response.timeMs - currentCommand.timeMs,
      commandDelta,
      baselineAfr: baselineAfr.value,
      responseAfr: response.value,
      responseDeltaAfr: responseAfrDelta,
      peakResponseDeltaAfr: peakAfrDelta,
      peakResponseDelayMs: peakDelayMs,
      t50Ms,
      t90Ms,
      rpm: sample(inputs.rpm, commandIndex)?.value,
      load: sample(inputs.load, commandIndex)?.value,
    });
  }

  const onsetDelay = distribution(events.map((event) => event.onsetDelayMs));
  const medianT50Ms = percentile(events.flatMap((event) => event.t50Ms === undefined ? [] : [event.t50Ms]), 0.5);
  const medianT90Ms = percentile(events.flatMap((event) => event.t90Ms === undefined ? [] : [event.t90Ms]), 0.5);
  const spreadMs = onsetDelay ? onsetDelay.p90Ms - onsetDelay.p10Ms : undefined;

  return {
    candidateEventCount,
    usableEventCount: events.length,
    rejectedNoResponseCount,
    rejectedOverlapCount,
    rejectedGapCount,
    events,
    onsetDelay,
    medianT50Ms,
    medianT90Ms,
    evidenceStrength: evidenceStrength(events.length, spreadMs),
  };
}
