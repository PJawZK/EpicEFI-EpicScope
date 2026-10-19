import { describe, expect, it } from 'vitest';
import type { VeEvidenceCell } from '../../core/analysis/ve-evidence-map';
import type { VeProposalCell } from '../../core/analysis/ve-proposal';
import { projectVeTable, veSourceHeatLevel } from '../../apps/web/src/pages/ve-analyzer-table-projection';
import { veResultDisplay } from '../../apps/web/src/pages/ve-analyzer-result-view';

const evidence = (overrides: Partial<VeEvidenceCell> = {}): VeEvidenceCell => ({
  row: 0, col: 0, sampleCount: 42, totalWeight: 20.5001234, correctionRatio: 1.1, correctionPercent: 10.012345,
  correctionP10Ratio: 1.06, correctionP90Ratio: 1.14, correctionSpreadPercent: 8.012345,
  confidence: 'strong', sampleIndices: new Uint32Array(), ...overrides,
});
const proposal = (overrides: Partial<VeProposalCell> = {}): VeProposalCell => ({
  row: 0, col: 0, currentValue: 60, proposedValue: 63.012345, evidenceCandidate: 66,
  changeValue: 3.012345, changePercent: 5.020575, state: 'measured', totalWeight: 20.5001234, sampleCount: 42, ...overrides,
});

describe('VE Analyzer typed result views', () => {
  it('retains full precision from semantic proposal/evidence rather than rounded labels', () => {
    const metrics = projectVeTable([60], 1, 1, [1000.25], [50.5], { cells: [evidence()] }, { cells: [proposal()] }).cells[0]!;
    expect(metrics).toMatchObject({ state: 'measured', current: 60, proposed: 63.012345, changeValue: 3.012345,
      changePercent: 5.020575, correctionPercent: 10.012345, spreadPercent: 8.012345,
      confidence: 'strong', weight: 20.5001234, samples: 42 });
    expect(veResultDisplay(metrics, 'change')).toMatchObject({ text: '+3.01', numericValue: 3.012345 });
  });

  it.each(['weak-evidence', 'withheld-limit'] as const)('keeps %s separate from an emitted proposal', state => {
    const metrics = projectVeTable([60], 1, 1, undefined, undefined, { cells: [evidence()] },
      { cells: [proposal({ state, proposedValue: undefined, changeValue: 6, changePercent: 10 })] }).cells[0]!;
    expect(veResultDisplay(metrics, 'proposal').text).toBe('60');
    expect(veResultDisplay(metrics, 'change').text).toBe('+6');
    expect(veResultDisplay(metrics, 'change-percent').text).toBe('+10%');
  });

  it('exposes evidence-only and delay views with the source VE fallback', () => {
    const metrics = projectVeTable([72], 1, 1, undefined, undefined,
      { cells: [evidence({ correctionPercent: -3.5, correctionSpreadPercent: 4, confidence: 'moderate', totalWeight: 9.25, sampleCount: 18 })] }).cells[0]!;
    expect(veResultDisplay(metrics, 'mixture-error').text).toBe('-3.5%');
    expect(veResultDisplay(metrics, 'samples').text).toBe('18');
    expect(veResultDisplay(metrics, 'weight').text).toBe('9.25');
    expect(veResultDisplay(metrics, 'confidence').text).toBe('Moderate');
    expect(veResultDisplay(metrics, 'spread').text).toBe('4%');
    expect(veResultDisplay(metrics, 'delay').text).toBe('72');
    expect(veResultDisplay(metrics, 'delay', 187.6).text).toBe('188');
  });

  it('keeps untouched source VE visible when the selected metric is absent', () => {
    const metrics = projectVeTable([47.8], 1, 1, undefined, undefined,
      { cells: [evidence({ totalWeight: 0, sampleCount: 0, confidence: 'none' })] }).cells[0]!;
    for (const view of ['change', 'change-percent', 'mixture-error', 'samples', 'weight', 'confidence', 'spread', 'delay'] as const) {
      expect(veResultDisplay(metrics, view)).toEqual({ text: '47.8', numericValue: 47.8, scaleMode: 'base' });
    }
  });

  it('normalizes source heat once and handles nonfinite/missing and flat values', () => {
    const projection = projectVeTable([50, NaN, 70, Infinity], 2, 2);
    expect(projection.heatRange).toEqual({ min: 50, max: 70 });
    expect(veSourceHeatLevel(projection, 50)).toBe('0');
    expect(veSourceHeatLevel(projection, 70)).toBe('1');
    expect(veSourceHeatLevel(projection, undefined)).toBeUndefined();
    expect(projection.cells[1]?.current).toBeUndefined();
    expect(veSourceHeatLevel(projectVeTable([60, 60], 1, 2), 60)).toBe('0.5');
    expect(projectVeTable([NaN], 1, 1).heatRange).toBeUndefined();
  });
});
