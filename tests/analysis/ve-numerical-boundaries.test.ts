import { describe, expect, it } from 'vitest';
import { buildVeDelayTable, interpolateVeDelayTable } from '../../core/analysis/ve-delay-table';
import { buildVeEvidenceMap, interpolateVeTable } from '../../core/analysis/ve-evidence-map';
import { veAnalysisAxisIssue } from '../../core/analysis/ve-axis-validation';

describe('VE analytical numerical boundaries', () => {
  const rpmBins = [1000, 2000, 3000], loadBins = [50, 75, 100];
  const values = [10, 30, NaN, 100, 200, NaN, NaN, NaN, NaN];
  const base = buildVeDelayTable([], rpmBins, loadBins);
  const delay = { ...base, cells: base.cells.map((cell, i) => ({ ...cell, workingMs: Number.isNaN(values[i]) ? undefined : values[i] })) };
  const target = { rpmBins, loadBins, values, rows: 3, cols: 3 };
  for (const [rpm, load, expected] of [[1000, 50, 10], [2000, 75, 200], [1500, 75, 150], [1500, 62.5, 85], [2500, 62.5, undefined], [999, 50, undefined]] as const) {
    it(`requires only nonzero-weight corners at ${rpm}/${load}`, () => {
      expect(interpolateVeDelayTable(delay, rpm, load)).toBe(expected);
      expect(interpolateVeTable(target, rpm, load)).toBe(expected);
    });
  }
  it('returns unavailable for a nonfinite required delay corner', () => {
    const broken = { ...delay, cells: delay.cells.map((cell, i) => i === 4 ? { ...cell, workingMs: NaN } : cell) };
    expect(interpolateVeDelayTable(broken, 1500, 62.5)).toBeUndefined();
  });
  for (const axis of [[], [NaN], [2000, 1000], [1000, 1000], [1000, 3000, 2000]]) {
    it(`rejects incompatible analytical axis ${axis.join(',')} at job boundaries`, () => {
      expect(veAnalysisAxisIssue(axis)).toBeDefined();
      expect(() => buildVeDelayTable([], axis, [50])).toThrow();
      const range = { startSampleIndex: 0, timeMs: Float64Array.of(0), values: Float64Array.of(1000), validity: Uint8Array.of(1) };
      expect(() => buildVeEvidenceMap({ actualMixture: range, rpm: range, load: range, target, veRpmBins: axis, veLoadBins: [50] })).toThrow();
    });
  }
  it('accepts singleton and increasing analytical axes without normalization', () => {
    expect(veAnalysisAxisIssue([1000])).toBeUndefined();
    expect(veAnalysisAxisIssue(rpmBins)).toBeUndefined();
    expect(rpmBins).toEqual([1000, 2000, 3000]);
  });
});
