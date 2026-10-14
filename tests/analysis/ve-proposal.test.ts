import { describe, expect, it } from 'vitest';
import type { VeEvidenceMapResult } from '../../core/analysis/ve-evidence-map';
import { buildVeProposal } from '../../core/analysis/ve-proposal';

function evidence(ratios: readonly (number | undefined)[], weights: readonly number[]): VeEvidenceMapResult {
  return {
    inputSampleCount: 10,
    validAlignedSampleCount: 10,
    rangeRejectedSampleCount: 0,
    transientRejectedSampleCount: 0,
    targetOutOfRangeSampleCount: 0,
    veOutOfRangeSampleCount: 0,
    delayUnavailableSampleCount: 0,
    invalidSampleCount: 0,
    eligibleSampleCount: 10,
    contributingSampleCount: 10,
    delayMs: 0,
    cells: ratios.map((ratio, index) => ({
      row: 0,
      col: index,
      sampleCount: weights[index]! > 0 ? 5 : 0,
      totalWeight: weights[index]!,
      correctionRatio: ratio,
      correctionPercent: ratio === undefined ? undefined : (ratio - 1) * 100,
      sampleIndices: new Uint32Array(),
    })),
  };
}

describe('VE proposal model', () => {
  it('blends accepted evidence with the current VE as an explicit prior', () => {
    const result = buildVeProposal([60], 1, 1, evidence([1.1], [20]), {
      priorWeight: 20,
      minimumEvidenceWeight: 5,
      maximumAbsoluteChange: 50,
      maximumPercentChange: 50,
    });
    expect(result.cells[0]!.evidenceCandidate).toBeCloseTo(66, 8);
    expect(result.cells[0]!.proposedValue).toBeCloseTo(63, 8);
    expect(result.cells[0]!.state).toBe('measured');
  });

  it('keeps weak evidence observational instead of inventing a proposal', () => {
    const result = buildVeProposal([60], 1, 1, evidence([1.05], [2]), {
      priorWeight: 20,
      minimumEvidenceWeight: 5,
      maximumAbsoluteChange: 50,
      maximumPercentChange: 50,
    });
    expect(result.cells[0]!.state).toBe('weak-evidence');
    expect(result.cells[0]!.proposedValue).toBeUndefined();
  });

  it('withholds evidence outside the configured authority instead of clamping it', () => {
    const result = buildVeProposal([60], 1, 1, evidence([1.4], [20]), {
      priorWeight: 20,
      minimumEvidenceWeight: 5,
      maximumAbsoluteChange: 50,
      maximumPercentChange: 10,
    });
    expect(result.cells[0]!.state).toBe('withheld-limit');
    expect(result.cells[0]!.proposedValue).toBeUndefined();
    expect(result.cells[0]!.changePercent).toBeCloseTo(40, 8);
  });
});
