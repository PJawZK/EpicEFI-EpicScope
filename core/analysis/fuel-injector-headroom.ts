import type { NumericChannelRange } from '../log-model/log-types';
import type { FuelPressureInjectorResult, ThresholdEvent } from './specialized-analyzers';

export interface FuelInjectorHeadroomSummary {
  readonly validSampleCount: number;
  readonly unavailableSampleCount: number;
  readonly invalidSampleCount: number;
  readonly meanHeadroomPercent: number | undefined;
  readonly minimumHeadroomPercent: number | undefined;
  readonly highDutySampleCount: number;
  readonly highDutySamplePercent: number | undefined;
  readonly saturationSampleCount: number;
}

export interface FuelInjectorEventContext {
  readonly type: 'low-pressure' | 'high-duty';
  readonly event: ThresholdEvent;
  readonly rpmAtExtreme?: number;
  readonly loadAtExtreme?: number;
  readonly fuelPressureAtExtreme?: number;
  readonly railDifferentialAtExtreme?: number;
  readonly highSidePressureAtExtreme?: number;
  readonly injectorPulseWidthAtExtreme?: number;
  readonly injectorDutyAtExtreme?: number;
  readonly injectorDeadtimeAtExtreme?: number;
}

export interface FuelInjectorHeadroomContextResult {
  readonly headroom?: FuelInjectorHeadroomSummary;
  readonly events: readonly FuelInjectorEventContext[];
}

export interface FuelInjectorHeadroomContextOptions {
  readonly highDutyThreshold?: number;
  readonly sampleIndices?: ArrayLike<number>;
  readonly pressureEvents?: readonly ThresholdEvent[];
}

function localIndex(range: NumericChannelRange, sampleIndex: number): number | undefined {
  const index = sampleIndex - range.startSampleIndex;
  if (!Number.isSafeInteger(index) || index < 0 || index >= range.values.length || index >= range.validity.length) return undefined;
  return index;
}

function valueAt(range: NumericChannelRange | undefined, sampleIndex: number): number | undefined {
  if (!range) return undefined;
  const index = localIndex(range, sampleIndex);
  if (index === undefined || range.validity[index] !== 1) return undefined;
  const value = range.values[index];
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

function selectedIndices(reference: NumericChannelRange, requested?: ArrayLike<number>): number[] {
  if (requested) {
    return Array.from({ length: requested.length }, (_, index) => requested[index])
      .filter((value): value is number => Number.isSafeInteger(value));
  }
  return Array.from({ length: reference.values.length }, (_, index) => reference.startSampleIndex + index);
}

function summarizeHeadroom(
  reference: NumericChannelRange,
  duty: NumericChannelRange | undefined,
  highDutyThreshold: number,
  sampleIndices?: ArrayLike<number>,
): FuelInjectorHeadroomSummary | undefined {
  if (!duty) return undefined;
  const indices = selectedIndices(reference, sampleIndices);
  let validSampleCount = 0;
  let unavailableSampleCount = 0;
  let invalidSampleCount = 0;
  let highDutySampleCount = 0;
  let saturationSampleCount = 0;
  let sumHeadroom = 0;
  let minimumHeadroom = Number.POSITIVE_INFINITY;

  for (const sampleIndex of indices) {
    const index = localIndex(duty, sampleIndex);
    if (index === undefined) {
      unavailableSampleCount += 1;
      continue;
    }
    const dutyValue = duty.values[index];
    if (duty.validity[index] !== 1 || dutyValue === undefined || !Number.isFinite(dutyValue)) {
      invalidSampleCount += 1;
      continue;
    }
    const headroom = 100 - dutyValue;
    validSampleCount += 1;
    sumHeadroom += headroom;
    minimumHeadroom = Math.min(minimumHeadroom, headroom);
    if (dutyValue > highDutyThreshold) highDutySampleCount += 1;
    if (dutyValue >= 100) saturationSampleCount += 1;
  }

  return {
    validSampleCount,
    unavailableSampleCount,
    invalidSampleCount,
    meanHeadroomPercent: validSampleCount > 0 ? sumHeadroom / validSampleCount : undefined,
    minimumHeadroomPercent: validSampleCount > 0 ? minimumHeadroom : undefined,
    highDutySampleCount,
    highDutySamplePercent: validSampleCount > 0 ? (highDutySampleCount / validSampleCount) * 100 : undefined,
    saturationSampleCount,
  };
}

function contextualize(
  type: FuelInjectorEventContext['type'],
  event: ThresholdEvent,
  inputs: {
    readonly rpm?: NumericChannelRange;
    readonly load?: NumericChannelRange;
    readonly fuelPressure?: NumericChannelRange;
    readonly railDifferential?: NumericChannelRange;
    readonly highSidePressure?: NumericChannelRange;
    readonly injectorPulseWidth?: NumericChannelRange;
    readonly injectorDuty?: NumericChannelRange;
    readonly injectorDeadtime?: NumericChannelRange;
  },
): FuelInjectorEventContext {
  const sampleIndex = event.extremeSampleIndex;
  const rpmAtExtreme = valueAt(inputs.rpm, sampleIndex);
  const loadAtExtreme = valueAt(inputs.load, sampleIndex);
  const fuelPressureAtExtreme = valueAt(inputs.fuelPressure, sampleIndex);
  const railDifferentialAtExtreme = valueAt(inputs.railDifferential, sampleIndex);
  const highSidePressureAtExtreme = valueAt(inputs.highSidePressure, sampleIndex);
  const injectorPulseWidthAtExtreme = valueAt(inputs.injectorPulseWidth, sampleIndex);
  const injectorDutyAtExtreme = valueAt(inputs.injectorDuty, sampleIndex);
  const injectorDeadtimeAtExtreme = valueAt(inputs.injectorDeadtime, sampleIndex);
  return {
    type,
    event,
    ...(rpmAtExtreme !== undefined ? { rpmAtExtreme } : {}),
    ...(loadAtExtreme !== undefined ? { loadAtExtreme } : {}),
    ...(fuelPressureAtExtreme !== undefined ? { fuelPressureAtExtreme } : {}),
    ...(railDifferentialAtExtreme !== undefined ? { railDifferentialAtExtreme } : {}),
    ...(highSidePressureAtExtreme !== undefined ? { highSidePressureAtExtreme } : {}),
    ...(injectorPulseWidthAtExtreme !== undefined ? { injectorPulseWidthAtExtreme } : {}),
    ...(injectorDutyAtExtreme !== undefined ? { injectorDutyAtExtreme } : {}),
    ...(injectorDeadtimeAtExtreme !== undefined ? { injectorDeadtimeAtExtreme } : {}),
  };
}

export function analyzeFuelInjectorHeadroomContext(
  analysis: FuelPressureInjectorResult,
  inputs: {
    readonly reference: NumericChannelRange;
    readonly rpm?: NumericChannelRange;
    readonly load?: NumericChannelRange;
    readonly fuelPressure?: NumericChannelRange;
    readonly railDifferential?: NumericChannelRange;
    readonly highSidePressure?: NumericChannelRange;
    readonly injectorPulseWidth?: NumericChannelRange;
    readonly injectorDuty?: NumericChannelRange;
    readonly injectorDeadtime?: NumericChannelRange;
  },
  options: FuelInjectorHeadroomContextOptions = {},
): FuelInjectorHeadroomContextResult {
  const highDutyThreshold = options.highDutyThreshold ?? 90;
  if (!Number.isFinite(highDutyThreshold)) throw new RangeError('High-duty threshold must be finite.');

  const contextInputs = {
    ...(inputs.rpm ? { rpm: inputs.rpm } : {}),
    ...(inputs.load ? { load: inputs.load } : {}),
    ...(inputs.fuelPressure ? { fuelPressure: inputs.fuelPressure } : {}),
    ...(inputs.railDifferential ? { railDifferential: inputs.railDifferential } : {}),
    ...(inputs.highSidePressure ? { highSidePressure: inputs.highSidePressure } : {}),
    ...(inputs.injectorPulseWidth ? { injectorPulseWidth: inputs.injectorPulseWidth } : {}),
    ...(inputs.injectorDuty ? { injectorDuty: inputs.injectorDuty } : {}),
    ...(inputs.injectorDeadtime ? { injectorDeadtime: inputs.injectorDeadtime } : {}),
  };
  const pressureEvents = options.pressureEvents ?? analysis.lowPressureEvents;
  const events: FuelInjectorEventContext[] = [
    ...pressureEvents.map((event) => contextualize('low-pressure', event, contextInputs)),
    ...analysis.highDutyEvents.map((event) => contextualize('high-duty', event, contextInputs)),
  ].sort((left, right) => left.event.startSampleIndex - right.event.startSampleIndex || left.event.endSampleIndex - right.event.endSampleIndex);

  const headroom = summarizeHeadroom(inputs.reference, inputs.injectorDuty, highDutyThreshold, options.sampleIndices);
  return {
    ...(headroom ? { headroom } : {}),
    events,
  };
}
