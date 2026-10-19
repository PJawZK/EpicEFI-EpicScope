import { veAnalysisAxisIssue } from './ve-axis-validation';
import { VE_ANALYSIS_BATCH_SIZE, finishVeAnalysis, runVeAnalysis, type VeAnalysisSteps, type VeAnalysisWorkOptions } from './ve-analysis-work';
import type { NumericChannelRange } from '../log-model/log-types';
import {
  buildVeEvidenceMapSteps,
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
  startSampleIndex: number,
  values: Float64Array,
  validity: Uint8Array,
  timeMs: Float64Array,
): NumericChannelRange {
  return {
    startSampleIndex,
    values,
    validity,
    timeMs,
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
  return finishVeAnalysis(buildVeDelayAlignedEvidenceSteps(inputs, config));
}

export function buildVeEvidenceMapWithDelayTableAsync(inputs: VeDelayAlignedEvidenceInputs, config: Omit<VeEvidenceConfig, 'delayMs'> = {}, options: VeAnalysisWorkOptions = {}): Promise<VeDelayAlignedEvidenceResult> {
  return runVeAnalysis(buildVeDelayAlignedEvidenceSteps(inputs, config, true), options);
}

function* buildVeDelayAlignedEvidenceSteps(inputs: VeDelayAlignedEvidenceInputs, config: Omit<VeEvidenceConfig, 'delayMs'>, cooperative = false): VeAnalysisSteps<VeDelayAlignedEvidenceResult> {
  for (const [name, axis] of [['Delay RPM', inputs.delayTable.rpmBins], ['Delay load', inputs.delayTable.loadBins]] as const) {
    const issue = veAnalysisAxisIssue(axis);
    if (issue) throw new RangeError(`${name}: ${issue}`);
  }
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
    if (!inputs.sampleIndices && actualValidity[local] === 1) delayUnavailableSampleCount += 1;
    actualValidity[local] = 0;
  };

  for (let local = 0; local < length; local += 1) {
    if (local % VE_ANALYSIS_BATCH_SIZE === 0) yield { phase: 'Aligning mixture delay', completed: local, total: length };
    // Preserve invalid-observation classification before testing delay support.
    // A zero/nonfinite mixture or timestamp is not missing engine history.
    if (actualValidity[local] !== 1 || !(actualValues[local]! > 0) || !Number.isFinite(actualValues[local])) continue;
    const mixtureTimeMs = inputs.actualMixture.timeMs[local];
    if (mixtureTimeMs === undefined || !Number.isFinite(mixtureTimeMs)) {
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
    if (refinedDelayMs === undefined || !Number.isFinite(refinedDelayMs) || refinedDelayMs < 0) {
      unavailable(local);
      continue;
    }
    if (Math.abs(refinedDelayMs - delayMs) > 0.5) {
      delayMs = refinedDelayMs;
      engineTimeMs = mixtureTimeMs - delayMs;
      rpm = interpolateNumericRangeAtTime(inputs.rpm, engineTimeMs);
      load = interpolateNumericRangeAtTime(inputs.load, engineTimeMs);
      if (rpm === undefined || load === undefined) {
        unavailable(local);
        continue;
      }
      // Verify availability at the final engine point without adding another
      // refinement iteration or substituting a delay from a different point.
      const finalDelayMs = interpolateVeDelayTable(inputs.delayTable, rpm, load);
      if (finalDelayMs === undefined || !Number.isFinite(finalDelayMs) || finalDelayMs < 0) {
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

  // Count in the same selected observation geometry/multiplicity as the base
  // evidence builder. Invalid/out-of-range selections remain its responsibility.
  const selectedCount = inputs.sampleIndices?.length ?? 0;
  const origin = inputs.actualMixture.startSampleIndex;
  for (let position = 0; position < selectedCount; position += 1) {
    if (position % VE_ANALYSIS_BATCH_SIZE === 0) yield { phase: 'Counting unavailable delay', completed: position, total: selectedCount };
    const index = inputs.sampleIndices![position]!;
    const local = index - origin;
    if (Number.isSafeInteger(index) && local >= 0 && local < length
      && inputs.actualMixture.validity[local] === 1 && actualValidity[local] === 0) delayUnavailableSampleCount += 1;
  }

  // Derived arrays share the observation origin. Raw-source quality/statistics
  // and envelope metadata no longer describe these values and must not escape.
  const actualMixture = alignedRange(origin, actualValues, actualValidity, alignedTimes);
  const rpm = alignedRange(origin, rpmValues, rpmValidity, alignedTimes);
  const load = alignedRange(origin, loadValues, loadValidity, alignedTimes);
  const fuelCorrectionPercent = inputs.fuelCorrectionPercent && correctionValues && correctionValidity
    ? alignedRange(origin, correctionValues, correctionValidity, alignedTimes)
    : undefined;

  const base = yield* buildVeEvidenceMapSteps({
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
  }, cooperative);

  return {
    ...base,
    delayModel: 'rpm-load-table',
    delayUnavailableSampleCount: base.delayUnavailableSampleCount + delayUnavailableSampleCount,
    invalidSampleCount: Math.max(0, base.invalidSampleCount - delayUnavailableSampleCount),
  };
}
