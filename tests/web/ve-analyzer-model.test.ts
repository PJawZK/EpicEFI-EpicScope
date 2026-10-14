import { describe, expect, it } from 'vitest';
import type { TuneEntry, TuneModel } from '../../core/tune/tune-model';
import {
  assessTargetMixtureTable,
  inferTuneMixtureScale,
  preferredTargetMixtureTableName,
  preferredVeAxisName,
  preferredVeTableName,
  targetMixtureTableCandidates,
  tuneMixtureScaleEvidence,
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
  it('prefers the canonical main veTable over auxiliary VE tables', () => {
    const tune = model([
      entry('idleVeTable', 'table', 4, 4, Array(16).fill(50)),
      entry('veTable', 'table', 32, 32, Array(1024).fill(60)),
      entry('veRpmBins', 'vector', 1, 32, Array.from({ length: 32 }, (_, index) => 600 + index * 200)),
    ]);

    expect(veTableCandidates(tune).map((candidate) => candidate.name)).toEqual(['idleVeTable', 'veTable']);
    expect(preferredVeTableName(tune)).toBe('veTable');
  });

  it('prefers canonical lambdaTable with matching VE geometry over auxiliary AFR tables', () => {
    const tune = model([
      entry('veTable', 'table', 32, 32, Array(1024).fill(60), '%'),
      entry('targetAfrBlends1_table', 'table', 8, 8, Array(64).fill(0), 'afr'),
      entry('lambdaTable', 'table', 32, 32, Array(1024).fill(14.1), 'afr'),
    ]);

    expect(targetMixtureTableCandidates(tune).map((candidate) => candidate.name)).toEqual([
      'veTable',
      'targetAfrBlends1_table',
      'lambdaTable',
    ]);
    expect(preferredTargetMixtureTableName(tune, 'veTable')).toBe('lambdaTable');
  });

  it('does not silently choose an unrelated first table as target mixture authority', () => {
    const tune = model([
      entry('veTable', 'table', 3, 4, Array(12).fill(60)),
      entry('ignitionTable', 'table', 3, 4, Array(12).fill(28)),
      entry('boostDutyTable', 'table', 3, 4, Array(12).fill(55)),
    ]);

    expect(preferredTargetMixtureTableName(tune, 'veTable')).toBeUndefined();
  });

  it('uses explicit AFR/Lambda units before identifier wording', () => {
    const afrLambdaKey = entry('lambdaTable', 'table', 2, 2, [14.1, 13.8, 12.5, 11.8], 'afr');
    const afrEvidence = tuneMixtureScaleEvidence(afrLambdaKey);
    expect(afrEvidence.unitScale).toBe('afr');
    expect(afrEvidence.nameScale).toBe('lambda');
    expect(afrEvidence.valueScale).toBe('afr');
    expect(afrEvidence.conflict).toBe(false);
    expect(afrEvidence.resolvedScale).toBe('afr');
    expect(inferTuneMixtureScale(afrLambdaKey)).toBe('afr');
    expect(assessTargetMixtureTable(afrLambdaKey, 'afr', 'veTable').status).toBe('ok');

    const lambda = entry('lambdaTable', 'table', 2, 2, [1, 0.95, 0.82, 0.78], 'lambda');
    expect(inferTuneMixtureScale(lambda)).toBe('lambda');
  });

  it('flags a real unit/value contradiction', () => {
    const contradictory = entry('targetTable', 'table', 2, 2, [14.1, 13.8, 12.5, 11.8], 'lambda');
    const evidence = tuneMixtureScaleEvidence(contradictory);
    expect(evidence.unitScale).toBe('lambda');
    expect(evidence.valueScale).toBe('afr');
    expect(evidence.conflict).toBe(true);
    expect(evidence.resolvedScale).toBe('unknown');

    const assessment = assessTargetMixtureTable(contradictory, 'afr', 'veTable');
    expect(assessment.status).toBe('invalid');
    expect(assessment.messages.join(' ')).toMatch(/Table unit indicates Lambda.*values look like AFR/);
  });

  it('warns without blocking when only an identifier conflicts with value evidence and no unit exists', () => {
    const ambiguous = entry('lambdaTable', 'table', 2, 2, [14.1, 13.8, 12.5, 11.8]);
    const evidence = tuneMixtureScaleEvidence(ambiguous);
    expect(evidence.unitScale).toBe('unknown');
    expect(evidence.nameScale).toBe('lambda');
    expect(evidence.valueScale).toBe('afr');
    expect(evidence.conflict).toBe(false);
    expect(evidence.resolvedScale).toBe('afr');

    const assessment = assessTargetMixtureTable(ambiguous, 'afr', 'veTable');
    expect(assessment.status).toBe('warning');
    expect(assessment.messages.join(' ')).toMatch(/identifier suggests Lambda.*values look like AFR/);
  });

  it('warns when the selected mixture scale disagrees with the target table', () => {
    const afr = entry('targetAfrTable', 'table', 2, 2, [14.1, 13.5, 12, 11.5], 'AFR');
    const mismatch = assessTargetMixtureTable(afr, 'lambda', 'veTable');
    expect(mismatch.status).toBe('invalid');
    expect(mismatch.messages.join(' ')).toMatch(/Scale mismatch/);

    const valid = assessTargetMixtureTable(afr, 'afr', 'veTable');
    expect(valid.status).toBe('ok');
  });

  it('rejects using the VE table itself as target mixture authority', () => {
    const ve = entry('veTable', 'table', 2, 2, [55, 60, 65, 70]);
    const result = assessTargetMixtureTable(ve, 'afr', 'veTable');
    expect(result.status).toBe('invalid');
    expect(result.messages.join(' ')).toMatch(/same table/);
  });

  it('selects axis bins from the selected table family instead of unrelated same-length vectors', () => {
    const tune = model([
      entry('veTable', 'table', 3, 4, Array(12).fill(60)),
      entry('dfcoExitRpmBins', 'vector', 1, 4, [1000, 2000, 3000, 4000]),
      entry('veRpmBins', 'vector', 1, 4, [600, 1200, 2400, 4800]),
      entry('baroCorrPressureBins', 'vector', 3, 1, [80, 100, 120]),
      entry('veLoadBins', 'vector', 3, 1, [40, 100, 180]),
      entry('wrongLength', 'vector', 1, 5, [1, 2, 3, 4, 5]),
    ]);

    expect(preferredVeAxisName(tune, 'veTable', 'rpm')).toBe('veRpmBins');
    expect(preferredVeAxisName(tune, 'veTable', 'load')).toBe('veLoadBins');
    expect(veAxisCandidates(tune, 'veTable', 'rpm').map((candidate) => candidate.name)).toContain('dfcoExitRpmBins');
  });

  it('keeps axis-family selection generic for auxiliary tables', () => {
    const tune = model([
      entry('idleVeTable', 'table', 3, 4, Array(12).fill(50)),
      entry('idleVeRpmBins', 'vector', 1, 4, [600, 800, 1000, 1200]),
      entry('idleVeLoadBins', 'vector', 3, 1, [30, 60, 90]),
      entry('otherRpmBins', 'vector', 1, 4, [1000, 2000, 3000, 4000]),
    ]);

    expect(preferredVeAxisName(tune, 'idleVeTable', 'rpm')).toBe('idleVeRpmBins');
    expect(preferredVeAxisName(tune, 'idleVeTable', 'load')).toBe('idleVeLoadBins');
  });

  it('returns no axis candidates for a missing or non-table entry', () => {
    const tune = model([entry('rpmBins', 'vector', 1, 4, [1000, 2000, 3000, 4000])]);
    expect(veAxisCandidates(tune, 'missing', 'rpm')).toEqual([]);
    expect(preferredVeTableName(tune)).toBeUndefined();
    expect(preferredTargetMixtureTableName(tune)).toBeUndefined();
  });
});
