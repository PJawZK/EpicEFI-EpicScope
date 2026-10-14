import { describe, expect, it } from 'vitest';
import type { TuneEntry, TuneModel } from '../../core/tune/tune-model';
import {
  preferredVeAxisName,
  preferredVeTableName,
  veAxisCandidates,
  veTableCandidates,
} from '../../apps/web/src/pages/ve-analyzer-model';

function entry(name: string, kind: TuneEntry['kind'], rows: number, cols: number, values: readonly number[]): TuneEntry {
  return {
    name,
    kind,
    sourceKind: 'constant',
    pageNumber: 1,
    rows,
    cols,
    digits: 1,
    units: undefined,
    numericValues: values,
    textValue: undefined,
  };
}

function model(entries: readonly TuneEntry[]): TuneModel {
  return {
    identity: { fileFormat: undefined, firmwareInfo: undefined, signature: undefined, writeDate: undefined, author: undefined },
    entries,
    byName: new Map(entries.map((candidate) => [candidate.name, candidate])),
  };
}

describe('VE Analyzer tune mapping helpers', () => {
  it('offers numeric 2D tables and prefers a VE-named table', () => {
    const tune = model([
      entry('ignitionTable', 'table', 3, 4, Array(12).fill(10)),
      entry('veTable1', 'table', 3, 4, Array(12).fill(60)),
      entry('rpmBins', 'vector', 1, 4, [1000, 2000, 3000, 4000]),
    ]);

    expect(veTableCandidates(tune).map((candidate) => candidate.name)).toEqual(['ignitionTable', 'veTable1']);
    expect(preferredVeTableName(tune)).toBe('veTable1');
  });

  it('limits axis candidates to the selected table dimensions', () => {
    const tune = model([
      entry('veTable1', 'table', 3, 4, Array(12).fill(60)),
      entry('rpmBins', 'vector', 1, 4, [1000, 2000, 3000, 4000]),
      entry('loadBins', 'vector', 3, 1, [40, 100, 180]),
      entry('wrongLength', 'vector', 1, 5, [1, 2, 3, 4, 5]),
    ]);

    expect(veAxisCandidates(tune, 'veTable1', 'rpm').map((candidate) => candidate.name)).toEqual(['rpmBins']);
    expect(veAxisCandidates(tune, 'veTable1', 'load').map((candidate) => candidate.name)).toEqual(['loadBins']);
    expect(preferredVeAxisName(tune, 'veTable1', 'rpm')).toBe('rpmBins');
    expect(preferredVeAxisName(tune, 'veTable1', 'load')).toBe('loadBins');
  });

  it('returns no axis candidates for a missing or non-table entry', () => {
    const tune = model([entry('rpmBins', 'vector', 1, 4, [1000, 2000, 3000, 4000])]);
    expect(veAxisCandidates(tune, 'missing', 'rpm')).toEqual([]);
    expect(preferredVeTableName(tune)).toBeUndefined();
  });
});
