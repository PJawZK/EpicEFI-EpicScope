import { describe, expect, it } from 'vitest';
import { buildTableCellEvidenceRows } from '../../core/analysis/table-cell-evidence';
import type { NumericChannelRange } from '../../core/log-model/log-types';

function range(start: number, values: readonly number[], validity?: readonly number[]): NumericChannelRange {
  return {
    startSampleIndex: start,
    timeMs: Float64Array.from(values.map((_, index) => (start + index) * 10)),
    values: Float64Array.from(values),
    validity: Uint8Array.from(validity ?? values.map(() => 1)),
  };
}

describe('Table Generator cell evidence', () => {
  it('aligns X/Y/Z/reference values by source sample and derives delta', () => {
    const rows = buildTableCellEvidenceRows({
      sampleIndices: Uint32Array.from([101, 102]),
      xRange: range(100, [1000, 2000, 3000]),
      yRange: range(100, [50, 60, 70]),
      zRange: range(100, [0.9, 1.0, 1.1]),
      referenceRange: range(100, [1.0, 1.0, 1.0]),
    });
    expect(rows).toEqual([
      { sampleIndex: 101, timeMs: 1010, x: 2000, y: 60, z: 1, reference: 1, delta: 0 },
      { sampleIndex: 102, timeMs: 1020, x: 3000, y: 70, z: 1.1, reference: 1, delta: 0.10000000000000009 },
    ]);
  });

  it('keeps source identity while reporting invalid values as unavailable evidence', () => {
    const rows = buildTableCellEvidenceRows({
      sampleIndices: [5],
      xRange: range(5, [10]),
      yRange: range(5, [20], [0]),
      zRange: range(5, [30]),
    });
    expect(rows[0]).toMatchObject({ sampleIndex: 5, timeMs: 50, x: 10, y: undefined, z: 30 });
  });
});
