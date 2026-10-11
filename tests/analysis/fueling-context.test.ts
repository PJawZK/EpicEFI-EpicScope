import { describe, expect, it } from 'vitest';
import type { NumericChannelRange } from '../../core/log-model/log-types';
import { qualifyFuelingContext } from '../../core/analysis/fueling-context';

function range(values: readonly number[], startSampleIndex = 0, validity?: readonly number[]): NumericChannelRange {
  return {
    startSampleIndex,
    timeMs: Float64Array.from(values.map((_, index) => index * 100)),
    values: Float64Array.from(values),
    validity: Uint8Array.from(validity ?? values.map(() => 1)),
  };
}

describe('Fueling cut and transient context qualification', () => {
  it('excludes DFCO and other fuel cuts from calibration and delay evidence', () => {
    const result = qualifyFuelingContext({
      reference: range([1, 1, 1, 1, 1]),
      dfcoActive: range([0, 1, 0, 0, 0]),
      fuelCutReason: range([0, 0, 5, 0, 17]),
    });

    expect(result.calibrationEligibleSampleIndices).toEqual([0, 3]);
    expect(result.delayEligibleSampleIndices).toEqual([0, 3]);
    expect(result.dfcoActiveSampleCount).toBe(1);
    expect(result.fuelCutSampleCount).toBe(2);
    expect(result.fuelCutReasonCounts).toEqual([{ code: 5, count: 1 }, { code: 17, count: 1 }]);
  });

  it('excludes AE and decel from calibration evidence but retains them for delay analysis', () => {
    const result = qualifyFuelingContext({
      reference: range([1, 1, 1, 1]),
      aeActive: range([0, 1, 0, 0]),
      decelActive: range([0, 0, 1, 0]),
    });

    expect(result.calibrationEligibleSampleIndices).toEqual([0, 3]);
    expect(result.delayEligibleSampleIndices).toEqual([0, 1, 2, 3]);
    expect(result.aeActiveSampleCount).toBe(1);
    expect(result.decelActiveSampleCount).toBe(1);
  });

  it('keeps selected context gaps and invalid values explicit and conservative', () => {
    const result = qualifyFuelingContext({
      reference: range([1, 1, 1, 1], 10),
      dfcoActive: range([0, 0, 0], 10, [1, 0, 1]),
    }, [10, 11, 12, 13]);

    expect(result.calibrationEligibleSampleIndices).toEqual([10, 12]);
    expect(result.delayEligibleSampleIndices).toEqual([10, 12]);
    expect(result.invalidContextSampleCount).toBe(1);
    expect(result.unavailableContextSampleCount).toBe(1);
  });

  it('leaves all scoped samples eligible when no optional context channels are supplied', () => {
    const result = qualifyFuelingContext({ reference: range([1, 1, 1]) }, [0, 2]);
    expect(result.calibrationEligibleSampleIndices).toEqual([0, 2]);
    expect(result.delayEligibleSampleIndices).toEqual([0, 2]);
    expect(result.invalidContextSampleCount).toBe(0);
    expect(result.unavailableContextSampleCount).toBe(0);
  });
});
