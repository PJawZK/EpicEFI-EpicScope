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
    fuelCorrectionUnavailableSampleCount: 0,
    fuelCorrectionCompensatedSampleCount: 0,
    invalidSampleCount: 0,
    eligibleSampleCount: 10,
    contributingSampleCount: 10,
    delayMs: 0,
    fuelCorrectionCompensated: false,
    cells: ratios.map((ratio, index) => ({
      row: 0,
      col: index,
      sampleCount: weights[index]! > 0 ? 5 : 0,
      totalWeight: weights[index]!,
      correctionRatio: ratio,
      correctionPercent: ratio === undefined ? undefined : (ratio - 1) * 100,
      correctionP10Ratio: ratio,
      correctionP90Ratio: ratio,
      correctionSpreadPercent: ratio === undefined ? undefined : 0,
      confidence: weights[index]! >= 8 ? 'moderate' : weights[index]! > 0 ? 'limited' : 'none',
      sampleIndices: new Uint32Array(),
    })),
  };
}

describe('VE proposal model', () => {
  it('counts protected cells separately even without evidence or with an otherwise withheld correction', () => {
    const result = buildVeProposal([60, 70], 1, 2, evidence([undefined, 5], [0, 20]), {
      priorWeight: 0, minimumEvidenceWeight: 5, maximumAbsoluteChange: 1, maximumPercentChange: 1,
      pinnedCellIndices: new Set([0, 1]),
    });
    expect(result.cells.map(cell => cell.state)).toEqual(['pinned', 'pinned']);
    expect(result.pinnedCellCount).toBe(2);
    expect(result.noEvidenceCellCount + result.weakCellCount + result.withheldCellCount + result.measuredCellCount).toBe(0);
  });
  it('excludes pinned nodes from generated proposals without discarding neighboring evidence', () => {
    const source = evidence([1.1, 1.2], [20, 20]);
    const result = buildVeProposal([60, 70], 1, 2, source, {
      priorWeight: 0, minimumEvidenceWeight: 5, maximumAbsoluteChange: 50, maximumPercentChange: 50,
      pinnedCellIndices: new Set([0]),
    });
    expect(result.cells[0]!.state).toBe('pinned');
    expect(result.cells[0]!.proposedValue).toBeUndefined();
    expect(result.cells[0]!.evidenceCandidate).toBeUndefined();
    expect(result.cells[1]!.proposedValue).toBe(84);
    expect(result.pinnedCellCount).toBe(1);
    expect(result.measuredCellCount).toBe(1);
    expect(result.noEvidenceCellCount).toBe(0);
    expect(source.cells.map(cell => cell.totalWeight)).toEqual([20, 20]);
  });
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
