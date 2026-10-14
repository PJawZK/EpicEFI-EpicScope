import type { NumericChannelRange } from '../log-model/log-types';
import {
  buildVeEvidenceMap,
  interpolateNumericRangeAtTime,
  type VeEvidenceConfig,
  type VeEvidenceInputs,
  type VeEvidenceMapResult,
} from './ve-evidence-map';
import { interpolateVeDelayTable, type VeDelayTable } from './ve-delay-table';

export interface VeDelayAlignedEvidenceInputs extends VeEvidenceInputs {
  readonly delayTable: VeDelayTable;
}

export interface VeDelayAlignedEvidenceResult extends VeEvidenceMapResult {
  readonly delayModel: 'rpm-load-table';
}

function alignedRange(
  source: NumericChannelRange,
  values: Float64Array,
  validity: Uint8Array,
  timeMs: Float64Array,
): NumericChannelRange {
  return {
    ...source,
    values,
    validity,
    timeMs,
    ...(source.quality ? { quality: new Uint8Array(source.quality) } : {}),
  };
}

/**
 * Associates each observed mixture sample with the engine event that produced it.
 *
 * Delay lookup starts from the operating point at the mixture timestamp, then performs
 * one refinement using the delayed operating point. No global-delay fallback is used:
 * a sample whose working delay cannot be resolved is explicitly unavailable.
 */
export function buildVeEvidenceMapWithDelayTable(
  inputs: VeDelayAlignedEvidenceInputs,
  config: Omit<VeEvidenceConfig, 'delayMs'> = {},
): VeDelayAlignedEvidenceResult {
  const length = inputs.actualMixture.values.length;
  const actualValues = new Float64Array(inputs.actualMixture.values);
  const actualValidity = new Uint8Array(inputs.actualMixture.validity);
  const alignedTimes = new Float64Array(inputs.actualMixture.timeMs);
  const rpmValues = new Float64Array(length);
  const loadValues = new Float64Array(length);
  const rpmValidity = new Uint8Array(length);
  const loadValidity = new Uint8Array(length);
  const correctionValues = inputs.fuelCorrectionPercent ? new Float64Array(length) : undefined;
  const correctionValidity = inputs.fuelCorrectionPercent ? new Uint8Array(length) : undefined;
  let delayUnavailableSampleCount = 0;

  const unavailable = (local: number): void => {
    if (actualValidity[local] === 1) delayUnavailableSampleCount += 1;
    actualValidity[local] = 0;
  };

  for (let local = 0; local < length; local += 1) {
    if (actualValidity[local] !== 1) continue;
    const mixtureTimeMs = inputs.actualMixture.timeMs[local];
    if (mixtureTimeMs === undefined || !Number.isFinite(mixtureTimeMs)) {
      unavailable(local);
      continue;
    }

    const observedRpm = interpolateNumericRangeAtTime(inputs.rpm, mixtureTimeMs);
    const observedLoad = interpolateNumericRangeAtTime(inputs.load, mixtureTimeMs);
    if (observedRpm === undefined || observedLoad === undefined) {
      unavailable(local);
      continue;
    }

    let delayMs = interpolateVeDelayTable(inputs.delayTable, observedRpm, observedLoad);
    if (delayMs === undefined || !Number.isFinite(delayMs) || delayMs < 0) {
      unavailable(local);
      continue;
    }

    let engineTimeMs = mixtureTimeMs - delayMs;
    let rpm = interpolateNumericRangeAtTime(inputs.rpm, engineTimeMs);
    let load = interpolateNumericRangeAtTime(inputs.load, engineTimeMs);
    if (rpm === undefined || load === undefined) {
      unavailable(local);
      continue;
    }

    // Refine once using the operating point associated with the delayed engine event.
    const refinedDelayMs = interpolateVeDelayTable(inputs.delayTable, rpm, load);
    if (refinedDelayMs !== undefined && Number.isFinite(refinedDelayMs) && refinedDelayMs >= 0 && Math.abs(refinedDelayMs - delayMs) > 0.5) {
      delayMs = refinedDelayMs;
      engineTimeMs = mixtureTimeMs - delayMs;
      rpm = interpolateNumericRangeAtTime(inputs.rpm, engineTimeMs);
      load = interpolateNumericRangeAtTime(inputs.load, engineTimeMs);
      if (rpm === undefined || load === undefined) {
        unavailable(local);
        continue;
      }
    }

    alignedTimes[local] = engineTimeMs;
    rpmValues[local] = rpm;
    loadValues[local] = load;
    rpmValidity[local] = 1;
    loadValidity[local] = 1;

    if (inputs.fuelCorrectionPercent && correctionValues && correctionValidity) {
      const correction = interpolateNumericRangeAtTime(inputs.fuelCorrectionPercent, engineTimeMs);
      if (correction !== undefined) {
        correctionValues[local] = correction;
        correctionValidity[local] = 1;
      }
    }
  }

  const actualMixture = alignedRange(inputs.actualMixture, actualValues, actualValidity, alignedTimes);
  const rpm = alignedRange(inputs.rpm, rpmValues, rpmValidity, alignedTimes);
  const load = alignedRange(inputs.load, loadValues, loadValidity, alignedTimes);
  const fuelCorrectionPercent = inputs.fuelCorrectionPercent && correctionValues && correctionValidity
    ? alignedRange(inputs.fuelCorrectionPercent, correctionValues, correctionValidity, alignedTimes)
    : undefined;

  const base = buildVeEvidenceMap({
    actualMixture,
    rpm,
    load,
    target: inputs.target,
    veRpmBins: inputs.veRpmBins,
    veLoadBins: inputs.veLoadBins,
    ...(inputs.sampleIndices ? { sampleIndices: inputs.sampleIndices } : {}),
    ...(fuelCorrectionPercent ? { fuelCorrectionPercent } : {}),
  }, {
    ...config,
    delayMs: 0,
  });

  return {
    ...base,
    delayModel: 'rpm-load-table',
    delayUnavailableSampleCount: base.delayUnavailableSampleCount + delayUnavailableSampleCount,
    invalidSampleCount: Math.max(0, base.invalidSampleCount - delayUnavailableSampleCount),
  };
}
