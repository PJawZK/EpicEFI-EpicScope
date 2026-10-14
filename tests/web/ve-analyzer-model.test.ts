import { describe, expect, it } from 'vitest';
import type { TuneEntry, TuneModel } from '../../core/tune/tune-model';
import {
  assessTargetMixtureTable,
  inferTuneMixtureScale,
  preferredTargetMixtureTableName,
  preferredVeAxisName,
  preferredVeTableName,
  targetMixtureTableCandidates,
  veAxisCandidates,
  veTableCandidates,
} from '../../apps/web/src/pages/ve-analyzer-model';

function entry(
  name: string,
  kind: TuneEntry['kind'],
  rows: number,
  cols: number,
  values: readonly number[],
  units?: string,
): TuneEntry {
  return {
    name,
    kind,
    sourceKind: 'constant',
    pageNumber: 1,
    rows,
    cols,
    digits: 1,
    units,
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

  it('prefers an AFR/lambda target table distinct from the selected VE table', () => {
    const tune = model([
      entry('veTable1', 'table', 3, 4, Array(12).fill(60)),
      entry('ignitionTable', 'table', 3, 4, Array(12).fill(10)),
      entry('targetAfrTable', 'table', 3, 4, Array(12).fill(14.1), 'AFR'),
    ]);

    expect(targetMixtureTableCandidates(tune).map((candidate) => candidate.name)).toEqual([
      'veTable1',
      'ignitionTable',
      'targetAfrTable',
    ]);
    expect(preferredTargetMixtureTableName(tune, 'veTable1')).toBe('targetAfrTable');
  });

  it('does not silently choose an unrelated first table as target mixture authority', () => {
    const tune = model([
      entry('veTable1', 'table', 3, 4, Array(12).fill(60)),
      entry('ignitionTable', 'table', 3, 4, Array(12).fill(28)),
      entry('boostDutyTable', 'table', 3, 4, Array(12).fill(55)),
    ]);

    expect(preferredTargetMixtureTableName(tune, 'veTable1')).toBeUndefined();
  });

  it('recognizes AFR and Lambda from metadata or conservative value ranges', () => {
    expect(inferTuneMixtureScale(entry('targetAfr', 'table', 2, 2, [14.1, 13.5, 12, 11.5], 'AFR'))).toBe('afr');
    expect(inferTuneMixtureScale(entry('targetLambda', 'table', 2, 2, [1, 0.95, 0.82, 0.78], 'Lambda'))).toBe('lambda');
    expect(inferTuneMixtureScale(entry('mysteryTarget', 'table', 2, 2, [14.1, 13.8, 12.5, 11.8]))).toBe('afr');
    expect(inferTuneMixtureScale(entry('mysteryTarget', 'table', 2, 2, [1, 0.98, 0.88, 0.8]))).toBe('lambda');
  });

  it('warns when the selected mixture scale disagrees with the target table', () => {
    const afr = entry('targetAfrTable', 'table', 2, 2, [14.1, 13.5, 12, 11.5], 'AFR');
    const mismatch = assessTargetMixtureTable(afr, 'lambda', 'veTable1');
    expect(mismatch.status).toBe('invalid');
    expect(mismatch.messages.join(' ')).toMatch(/Scale mismatch/);

    const valid = assessTargetMixtureTable(afr, 'afr', 'veTable1');
    expect(valid.status).toBe('ok');
  });

  it('rejects using the VE table itself as target mixture authority', () => {
    const ve = entry('veTable1', 'table', 2, 2, [55, 60, 65, 70]);
    const result = assessTargetMixtureTable(ve, 'afr', 'veTable1');
    expect(result.status).toBe('invalid');
    expect(result.messages.join(' ')).toMatch(/same table/);
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
    expect(preferredTargetMixtureTableName(tune)).toBeUndefined();
  });
});
