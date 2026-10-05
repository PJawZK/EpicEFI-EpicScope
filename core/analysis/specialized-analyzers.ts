import { aggregateNumericSamples, type NumericAggregationResult } from './numeric-aggregation';
import type { NumericChannelRange } from '../log-model/log-types';

export interface SpecializedAnalysisScope {
  readonly sampleIndices?: ArrayLike<number>;
  readonly complete?: boolean;
}

interface SampleValue {
  readonly sampleIndex: number;
  readonly localIndex: number;
  readonly timeMs: number;
  readonly value: number;
}

function localIndex(range: NumericChannelRange, sampleIndex: number): number | undefined {
  const index = sampleIndex - range.startSampleIndex;
  if (!Number.isSafeInteger(index) || index < 0 || index >= range.values.length || index >= range.validity.length) return undefined;
  return index;
}

function sample(range: NumericChannelRange | undefined, sampleIndex: number): SampleValue | undefined {
  if (!range) return undefined;
  const index = localIndex(range, sampleIndex);
  if (index === undefined || range.validity[index] !== 1) return undefined;
  const value = range.values[index];
  const timeMs = range.timeMs[index];
  if (value === undefined || timeMs === undefined || !Number.isFinite(value) || !Number.isFinite(timeMs)) return undefined;
  return { sampleIndex, localIndex: index, timeMs, value };
}

function selectedIndices(reference: NumericChannelRange, scope: SpecializedAnalysisScope): number[] {
  if (scope.sampleIndices) return Array.from({ length: scope.sampleIndices.length }, (_, i) => scope.sampleIndices?.[i]).filter((v): v is number => Number.isSafeInteger(v));
  return Array.from({ length: reference.values.length }, (_, i) => reference.startSampleIndex + i);
}

function aggregate(range: NumericChannelRange | undefined, indices: readonly number[]): NumericAggregationResult | undefined {
  return range ? aggregateNumericSamples(range, { sampleIndices: indices }) : undefined;
}

export interface TrackingSummary {
  readonly sampleCount: number;
  readonly invalidSampleCount: number;
  readonly unavailableSampleCount: number;
  readonly meanError: number | undefined;
  readonly meanAbsoluteError: number | undefined;
  readonly rmse: number | undefined;
  readonly maxPositiveError: number | undefined;
  readonly maxNegativeError: number | undefined;
}

function tracking(actual: NumericChannelRange, target: NumericChannelRange, indices: readonly number[]): TrackingSummary {
  let sampleCount = 0;
  let invalidSampleCount = 0;
  let unavailableSampleCount = 0;
  let sumError = 0;
  let sumAbs = 0;
  let sumSq = 0;
  let maxPositive = Number.NEGATIVE_INFINITY;
  let maxNegative = Number.POSITIVE_INFINITY;
  for (const index of indices) {
    const actualLocal = localIndex(actual, index);
    const targetLocal = localIndex(target, index);
    if (actualLocal === undefined || targetLocal === undefined) {
      unavailableSampleCount += 1;
      continue;
    }
    const a = actual.values[actualLocal];
    const t = target.values[targetLocal];
    if (actual.validity[actualLocal] !== 1 || target.validity[targetLocal] !== 1 || a === undefined || t === undefined || !Number.isFinite(a) || !Number.isFinite(t)) {
      invalidSampleCount += 1;
      continue;
    }
    const error = a - t;
    sampleCount += 1;
    sumError += error;
    sumAbs += Math.abs(error);
    sumSq += error * error;
    maxPositive = Math.max(maxPositive, error);
    maxNegative = Math.min(maxNegative, error);
  }
  return {
    sampleCount,
    invalidSampleCount,
    unavailableSampleCount,
    meanError: sampleCount ? sumError / sampleCount : undefined,
    meanAbsoluteError: sampleCount ? sumAbs / sampleCount : undefined,
    rmse: sampleCount ? Math.sqrt(sumSq / sampleCount) : undefined,
    maxPositiveError: sampleCount ? Math.max(0, maxPositive) : undefined,
    maxNegativeError: sampleCount ? Math.min(0, maxNegative) : undefined,
  };
}

export interface TimedEvent {
  readonly startSampleIndex: number;
  readonly endSampleIndex: number;
  readonly startTimeMs: number;
  readonly endTimeMs: number;
  readonly durationMs: number;
  readonly sampleCount: number;
}

export interface IdleSagEvent extends TimedEvent {
  readonly minimumErrorRpm: number;
  readonly recoveryMs: number | undefined;
}

export interface IdleAnalysisResult {
  readonly rpm: NumericAggregationResult;
  readonly target?: NumericAggregationResult;
  readonly valveDuty?: NumericAggregationResult;
  readonly bias?: NumericAggregationResult;
  readonly feedForward?: NumericAggregationResult;
  readonly pTerm?: NumericAggregationResult;
  readonly iTerm?: NumericAggregationResult;
  readonly dTerm?: NumericAggregationResult;
  readonly tracking?: TrackingSummary;
  readonly sagEvents: readonly IdleSagEvent[];
  readonly complete: boolean;
}

export interface IdleAnalysisOptions extends SpecializedAnalysisScope {
  readonly sagThresholdRpm?: number;
  readonly settledBandRpm?: number;
}

export function analyzeIdle(inputs: {
  readonly rpm: NumericChannelRange;
  readonly target?: NumericChannelRange;
  readonly valveDuty?: NumericChannelRange;
  readonly bias?: NumericChannelRange;
  readonly feedForward?: NumericChannelRange;
  readonly pTerm?: NumericChannelRange;
  readonly iTerm?: NumericChannelRange;
  readonly dTerm?: NumericChannelRange;
}, options: IdleAnalysisOptions = {}): IdleAnalysisResult {
  const indices = selectedIndices(inputs.rpm, options);
  const sagThreshold = options.sagThresholdRpm ?? 100;
  const settledBand = options.settledBandRpm ?? 40;
  if (sagThreshold <= 0 || settledBand < 0) throw new RangeError('Idle sag/settled thresholds must be non-negative and sag threshold must be > 0.');
  const sagEvents: IdleSagEvent[] = [];
  if (inputs.target) {
    let start: number | undefined;
    let minError = 0;
    for (let position = 0; position < indices.length; position += 1) {
      const index = indices[position]!;
      const rpm = sample(inputs.rpm, index);
      const target = sample(inputs.target, index);
      const error = rpm && target ? rpm.value - target.value : undefined;
      if (error !== undefined && error <= -sagThreshold) {
        if (start === undefined) start = position;
        minError = Math.min(minError, error);
        continue;
      }
      if (start !== undefined) {
        const startIndex = indices[start]!;
        const endPosition = Math.max(start, position - 1);
        const endIndex = indices[endPosition]!;
        const startSample = sample(inputs.rpm, startIndex)!;
        const endSample = sample(inputs.rpm, endIndex)!;
        let recoveryMs: number | undefined;
        for (let recoveryPosition = position; recoveryPosition < indices.length; recoveryPosition += 1) {
          const recoveryIndex = indices[recoveryPosition]!;
          const r = sample(inputs.rpm, recoveryIndex);
          const t = sample(inputs.target, recoveryIndex);
          if (r && t && Math.abs(r.value - t.value) <= settledBand) {
            recoveryMs = r.timeMs - endSample.timeMs;
            break;
          }
        }
        sagEvents.push({
          startSampleIndex: startIndex,
          endSampleIndex: endIndex,
          startTimeMs: startSample.timeMs,
          endTimeMs: endSample.timeMs,
          durationMs: endSample.timeMs - startSample.timeMs,
          sampleCount: endPosition - start + 1,
          minimumErrorRpm: minError,
          recoveryMs,
        });
        start = undefined;
        minError = 0;
      }
    }
  }
  const result: IdleAnalysisResult = {
    rpm: aggregateNumericSamples(inputs.rpm, { sampleIndices: indices }),
    sagEvents,
    complete: options.complete === true,
    ...(inputs.target ? { target: aggregateNumericSamples(inputs.target, { sampleIndices: indices }), tracking: tracking(inputs.rpm, inputs.target, indices) } : {}),
    ...(inputs.valveDuty ? { valveDuty: aggregateNumericSamples(inputs.valveDuty, { sampleIndices: indices }) } : {}),
    ...(inputs.bias ? { bias: aggregateNumericSamples(inputs.bias, { sampleIndices: indices }) } : {}),
    ...(inputs.feedForward ? { feedForward: aggregateNumericSamples(inputs.feedForward, { sampleIndices: indices }) } : {}),
    ...(inputs.pTerm ? { pTerm: aggregateNumericSamples(inputs.pTerm, { sampleIndices: indices }) } : {}),
    ...(inputs.iTerm ? { iTerm: aggregateNumericSamples(inputs.iTerm, { sampleIndices: indices }) } : {}),
    ...(inputs.dTerm ? { dTerm: aggregateNumericSamples(inputs.dTerm, { sampleIndices: indices }) } : {}),
  };
  return result;
}

export interface AeTransientEvent extends TimedEvent {
  readonly direction: 'tip-in' | 'decel';
  readonly tpsDelta: number;
  readonly mapDelta?: number;
  readonly predictionErrorAtEnd?: number;
  readonly afrLeanExcursion?: number;
  readonly afrRichExcursion?: number;
}

export interface AeMapPredictResult {
  readonly tps: NumericAggregationResult;
  readonly map?: NumericAggregationResult;
  readonly predictedMap?: NumericAggregationResult;
  readonly afr?: NumericAggregationResult;
  readonly events: readonly AeTransientEvent[];
  readonly complete: boolean;
}

export interface AeMapPredictOptions extends SpecializedAnalysisScope {
  readonly tpsDeltaThreshold?: number;
  readonly eventWindowMs?: number;
}

export function analyzeAeMapPredict(inputs: {
  readonly tps: NumericChannelRange;
  readonly map?: NumericChannelRange;
  readonly predictedMap?: NumericChannelRange;
  readonly afr?: NumericChannelRange;
}, options: AeMapPredictOptions = {}): AeMapPredictResult {
  const indices = selectedIndices(inputs.tps, options);
  const threshold = options.tpsDeltaThreshold ?? 2;
  const windowMs = options.eventWindowMs ?? 500;
  if (threshold <= 0 || windowMs < 0) throw new RangeError('AE TPS threshold must be > 0 and event window must be >= 0.');
  const events: AeTransientEvent[] = [];
  for (let position = 1; position < indices.length; position += 1) {
    const previous = sample(inputs.tps, indices[position - 1]!);
    const current = sample(inputs.tps, indices[position]!);
    if (!previous || !current) continue;
    const delta = current.value - previous.value;
    if (Math.abs(delta) < threshold) continue;
    let endPosition = position;
    while (endPosition + 1 < indices.length) {
      const next = sample(inputs.tps, indices[endPosition + 1]!);
      if (!next || next.timeMs - current.timeMs > windowMs) break;
      endPosition += 1;
    }
    const endIndex = indices[endPosition]!;
    const endTps = sample(inputs.tps, endIndex) ?? current;
    const startMap = sample(inputs.map, previous.sampleIndex);
    const endMap = sample(inputs.map, endIndex);
    const endPredicted = sample(inputs.predictedMap, endIndex);
    const startAfr = sample(inputs.afr, previous.sampleIndex);
    let lean = 0;
    let rich = 0;
    if (startAfr && inputs.afr) {
      for (let scan = position; scan <= endPosition; scan += 1) {
        const afr = sample(inputs.afr, indices[scan]!);
        if (!afr) continue;
        lean = Math.max(lean, afr.value - startAfr.value);
        rich = Math.min(rich, afr.value - startAfr.value);
      }
    }
    events.push({
      startSampleIndex: current.sampleIndex,
      endSampleIndex: endIndex,
      startTimeMs: current.timeMs,
      endTimeMs: endTps.timeMs,
      durationMs: endTps.timeMs - current.timeMs,
      sampleCount: endPosition - position + 1,
      direction: delta > 0 ? 'tip-in' : 'decel',
      tpsDelta: delta,
      ...(startMap && endMap ? { mapDelta: endMap.value - startMap.value } : {}),
      ...(endMap && endPredicted ? { predictionErrorAtEnd: endPredicted.value - endMap.value } : {}),
      ...(startAfr ? { afrLeanExcursion: lean, afrRichExcursion: rich } : {}),
    });
    position = endPosition;
  }
  return {
    tps: aggregateNumericSamples(inputs.tps, { sampleIndices: indices }),
    events,
    complete: options.complete === true,
    ...(inputs.map ? { map: aggregateNumericSamples(inputs.map, { sampleIndices: indices }) } : {}),
    ...(inputs.predictedMap ? { predictedMap: aggregateNumericSamples(inputs.predictedMap, { sampleIndices: indices }) } : {}),
    ...(inputs.afr ? { afr: aggregateNumericSamples(inputs.afr, { sampleIndices: indices }) } : {}),
  };
}

export interface FuelingAnalysisResult {
  readonly actual: NumericAggregationResult;
  readonly target?: NumericAggregationResult;
  readonly ve?: NumericAggregationResult;
  readonly tracking?: TrackingSummary;
  readonly leanSampleCount: number;
  readonly richSampleCount: number;
  readonly complete: boolean;
}

export interface FuelingAnalysisOptions extends SpecializedAnalysisScope {
  readonly errorDeadband?: number;
}

export function analyzeFueling(inputs: {
  readonly actualAfr: NumericChannelRange;
  readonly targetAfr?: NumericChannelRange;
  readonly ve?: NumericChannelRange;
}, options: FuelingAnalysisOptions = {}): FuelingAnalysisResult {
  const indices = selectedIndices(inputs.actualAfr, options);
  const deadband = options.errorDeadband ?? 0.2;
  if (deadband < 0) throw new RangeError('Fueling error deadband must be >= 0.');
  let leanSampleCount = 0;
  let richSampleCount = 0;
  if (inputs.targetAfr) {
    for (const index of indices) {
      const actual = sample(inputs.actualAfr, index);
      const target = sample(inputs.targetAfr, index);
      if (!actual || !target) continue;
      const error = actual.value - target.value;
      if (error > deadband) leanSampleCount += 1;
      else if (error < -deadband) richSampleCount += 1;
    }
  }
  return {
    actual: aggregateNumericSamples(inputs.actualAfr, { sampleIndices: indices }),
    leanSampleCount,
    richSampleCount,
    complete: options.complete === true,
    ...(inputs.targetAfr ? { target: aggregateNumericSamples(inputs.targetAfr, { sampleIndices: indices }), tracking: tracking(inputs.actualAfr, inputs.targetAfr, indices) } : {}),
    ...(inputs.ve ? { ve: aggregateNumericSamples(inputs.ve, { sampleIndices: indices }) } : {}),
  };
}

export interface KnockEvent extends TimedEvent {
  readonly peakKnock: number;
  readonly advanceAtPeak?: number;
  readonly retardAtPeak?: number;
}

export interface IgnitionAnalysisResult {
  readonly advance: NumericAggregationResult;
  readonly retard?: NumericAggregationResult;
  readonly knock?: NumericAggregationResult;
  readonly knockEvents: readonly KnockEvent[];
  readonly complete: boolean;
}

export interface IgnitionAnalysisOptions extends SpecializedAnalysisScope {
  readonly knockThreshold?: number;
}

export function analyzeIgnition(inputs: {
  readonly advance: NumericChannelRange;
  readonly retard?: NumericChannelRange;
  readonly knock?: NumericChannelRange;
}, options: IgnitionAnalysisOptions = {}): IgnitionAnalysisResult {
  const indices = selectedIndices(inputs.advance, options);
  const threshold = options.knockThreshold ?? 0;
  const events: KnockEvent[] = [];
  if (inputs.knock) {
    let start: number | undefined;
    let peakPosition: number | undefined;
    let peakValue = Number.NEGATIVE_INFINITY;
    for (let pos = 0; pos <= indices.length; pos += 1) {
      const index = pos < indices.length ? indices[pos]! : undefined;
      const knock = index === undefined ? undefined : sample(inputs.knock, index);
      if (knock && knock.value > threshold) {
        if (start === undefined) start = pos;
        if (knock.value > peakValue) { peakValue = knock.value; peakPosition = pos; }
        continue;
      }
      if (start !== undefined && peakPosition !== undefined) {
        const endPos = pos - 1;
        const startKnock = sample(inputs.knock, indices[start]!)!;
        const endKnock = sample(inputs.knock, indices[endPos]!)!;
        const peakIndex = indices[peakPosition]!;
        const advance = sample(inputs.advance, peakIndex);
        const retard = sample(inputs.retard, peakIndex);
        events.push({
          startSampleIndex: indices[start]!,
          endSampleIndex: indices[endPos]!,
          startTimeMs: startKnock.timeMs,
          endTimeMs: endKnock.timeMs,
          durationMs: endKnock.timeMs - startKnock.timeMs,
          sampleCount: endPos - start + 1,
          peakKnock: peakValue,
          ...(advance ? { advanceAtPeak: advance.value } : {}),
          ...(retard ? { retardAtPeak: retard.value } : {}),
        });
        start = undefined;
        peakPosition = undefined;
        peakValue = Number.NEGATIVE_INFINITY;
      }
    }
  }
  return {
    advance: aggregateNumericSamples(inputs.advance, { sampleIndices: indices }),
    knockEvents: events,
    complete: options.complete === true,
    ...(inputs.retard ? { retard: aggregateNumericSamples(inputs.retard, { sampleIndices: indices }) } : {}),
    ...(inputs.knock ? { knock: aggregateNumericSamples(inputs.knock, { sampleIndices: indices }) } : {}),
  };
}

export interface ThresholdEvent extends TimedEvent {
  readonly extremeValue: number;
}

function thresholdEvents(range: NumericChannelRange, indices: readonly number[], predicate: (value: number) => boolean, extreme: (a: number, b: number) => number): ThresholdEvent[] {
  const events: ThresholdEvent[] = [];
  let start: number | undefined;
  let extremeValue: number | undefined;
  for (let pos = 0; pos <= indices.length; pos += 1) {
    const current = pos < indices.length ? sample(range, indices[pos]!) : undefined;
    if (current && predicate(current.value)) {
      if (start === undefined) start = pos;
      extremeValue = extremeValue === undefined ? current.value : extreme(extremeValue, current.value);
      continue;
    }
    if (start !== undefined && extremeValue !== undefined) {
      const endPos = pos - 1;
      const first = sample(range, indices[start]!)!;
      const last = sample(range, indices[endPos]!)!;
      events.push({ startSampleIndex: indices[start]!, endSampleIndex: indices[endPos]!, startTimeMs: first.timeMs, endTimeMs: last.timeMs, durationMs: last.timeMs - first.timeMs, sampleCount: endPos - start + 1, extremeValue });
      start = undefined;
      extremeValue = undefined;
    }
  }
  return events;
}

export interface FuelPressureInjectorResult {
  readonly fuelPressure?: NumericAggregationResult;
  readonly railDifferential?: NumericAggregationResult;
  readonly injectorPulseWidth?: NumericAggregationResult;
  readonly injectorDuty?: NumericAggregationResult;
  readonly injectorDeadtime?: NumericAggregationResult;
  readonly lowPressureEvents: readonly ThresholdEvent[];
  readonly highDutyEvents: readonly ThresholdEvent[];
  readonly complete: boolean;
}

export interface FuelPressureInjectorOptions extends SpecializedAnalysisScope {
  readonly lowPressureThreshold?: number;
  readonly highDutyThreshold?: number;
}

export function analyzeFuelPressureInjector(inputs: {
  readonly reference: NumericChannelRange;
  readonly fuelPressure?: NumericChannelRange;
  readonly railDifferential?: NumericChannelRange;
  readonly injectorPulseWidth?: NumericChannelRange;
  readonly injectorDuty?: NumericChannelRange;
  readonly injectorDeadtime?: NumericChannelRange;
}, options: FuelPressureInjectorOptions = {}): FuelPressureInjectorResult {
  const indices = selectedIndices(inputs.reference, options);
  const low = options.lowPressureThreshold;
  const high = options.highDutyThreshold ?? 90;
  return {
    lowPressureEvents: inputs.railDifferential && low !== undefined ? thresholdEvents(inputs.railDifferential, indices, (value) => value < low, Math.min) : [],
    highDutyEvents: inputs.injectorDuty ? thresholdEvents(inputs.injectorDuty, indices, (value) => value > high, Math.max) : [],
    complete: options.complete === true,
    ...(inputs.fuelPressure ? { fuelPressure: aggregateNumericSamples(inputs.fuelPressure, { sampleIndices: indices }) } : {}),
    ...(inputs.railDifferential ? { railDifferential: aggregateNumericSamples(inputs.railDifferential, { sampleIndices: indices }) } : {}),
    ...(inputs.injectorPulseWidth ? { injectorPulseWidth: aggregateNumericSamples(inputs.injectorPulseWidth, { sampleIndices: indices }) } : {}),
    ...(inputs.injectorDuty ? { injectorDuty: aggregateNumericSamples(inputs.injectorDuty, { sampleIndices: indices }) } : {}),
    ...(inputs.injectorDeadtime ? { injectorDeadtime: aggregateNumericSamples(inputs.injectorDeadtime, { sampleIndices: indices }) } : {}),
  };
}

export interface SyncEvent extends TimedEvent {
  readonly reason: 'sync-state' | 'trigger-error' | 'loss-counter';
  readonly peakError?: number;
  readonly lossCountDelta?: number;
}

export interface TriggerSyncResult {
  readonly syncState?: NumericAggregationResult;
  readonly triggerError?: NumericAggregationResult;
  readonly syncLossCounter?: NumericAggregationResult;
  readonly rpm?: NumericAggregationResult;
  readonly events: readonly SyncEvent[];
  readonly complete: boolean;
}

export interface TriggerSyncOptions extends SpecializedAnalysisScope {
  readonly syncedMinimum?: number;
  readonly triggerErrorThreshold?: number;
}

export function analyzeTriggerSync(inputs: {
  readonly reference: NumericChannelRange;
  readonly syncState?: NumericChannelRange;
  readonly triggerError?: NumericChannelRange;
  readonly syncLossCounter?: NumericChannelRange;
  readonly rpm?: NumericChannelRange;
}, options: TriggerSyncOptions = {}): TriggerSyncResult {
  const indices = selectedIndices(inputs.reference, options);
  const events: SyncEvent[] = [];
  const syncedMinimum = options.syncedMinimum ?? 1;
  const errorThreshold = options.triggerErrorThreshold ?? 0;
  if (inputs.syncState) {
    for (const event of thresholdEvents(inputs.syncState, indices, (value) => value < syncedMinimum, Math.min)) events.push({ ...event, reason: 'sync-state' });
  }
  if (inputs.triggerError) {
    for (const event of thresholdEvents(inputs.triggerError, indices, (value) => Math.abs(value) > errorThreshold, (a, b) => Math.abs(b) > Math.abs(a) ? b : a)) events.push({ ...event, reason: 'trigger-error', peakError: event.extremeValue });
  }
  if (inputs.syncLossCounter) {
    for (let pos = 1; pos < indices.length; pos += 1) {
      const previous = sample(inputs.syncLossCounter, indices[pos - 1]!);
      const current = sample(inputs.syncLossCounter, indices[pos]!);
      if (!previous || !current || current.value <= previous.value) continue;
      events.push({ startSampleIndex: current.sampleIndex, endSampleIndex: current.sampleIndex, startTimeMs: current.timeMs, endTimeMs: current.timeMs, durationMs: 0, sampleCount: 1, reason: 'loss-counter', lossCountDelta: current.value - previous.value });
    }
  }
  events.sort((a, b) => a.startSampleIndex - b.startSampleIndex || a.endSampleIndex - b.endSampleIndex);
  return {
    events,
    complete: options.complete === true,
    ...(inputs.syncState ? { syncState: aggregateNumericSamples(inputs.syncState, { sampleIndices: indices }) } : {}),
    ...(inputs.triggerError ? { triggerError: aggregateNumericSamples(inputs.triggerError, { sampleIndices: indices }) } : {}),
    ...(inputs.syncLossCounter ? { syncLossCounter: aggregateNumericSamples(inputs.syncLossCounter, { sampleIndices: indices }) } : {}),
    ...(inputs.rpm ? { rpm: aggregateNumericSamples(inputs.rpm, { sampleIndices: indices }) } : {}),
  };
}
