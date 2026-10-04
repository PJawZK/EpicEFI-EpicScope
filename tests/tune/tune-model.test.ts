import { describe, expect, it } from 'vitest';
import { parseMsq } from '../../core/parsers/msq/msq-parser';
import { normalizeMsqTune, numericTuneEntry } from '../../core/tune/tune-model';

const SAMPLE = `<msq>
  <bibliography author="TS" writeDate="today"/>
  <versionInfo fileFormat="5.0" firmwareInfo="fw" signature="sig"/>
  <page number="0">
    <constant digits="1" name="scalar" units="ms">7.9</constant>
    <constant cols="3" name="curve" rows="1">1 2 3</constant>
    <constant cols="2" name="table" rows="2">1 2 3 4</constant>
    <pcVariable name="mode">"Dual stride, newest"</pcVariable>
  </page>
</msq>`;

describe('normalizeMsqTune', () => {
  it('classifies numeric scalar, vector and table entries without inventing axis semantics', () => {
    const tune = normalizeMsqTune(parseMsq(SAMPLE));
    expect(tune.byName.get('scalar')).toMatchObject({ kind: 'scalar', rows: 1, cols: 1, numericValues: [7.9] });
    expect(tune.byName.get('curve')).toMatchObject({ kind: 'vector', rows: 1, cols: 3, numericValues: [1, 2, 3] });
    expect(tune.byName.get('table')).toMatchObject({ kind: 'table', rows: 2, cols: 2, numericValues: [1, 2, 3, 4] });
  });

  it('preserves text values and tune identity separately from numeric entries', () => {
    const tune = normalizeMsqTune(parseMsq(SAMPLE));
    expect(tune.identity).toMatchObject({ fileFormat: '5.0', firmwareInfo: 'fw', signature: 'sig', author: 'TS' });
    expect(tune.byName.get('mode')).toMatchObject({ kind: 'text', textValue: 'Dual stride, newest' });
  });

  it('returns numeric entries only from numericTuneEntry', () => {
    const tune = normalizeMsqTune(parseMsq(SAMPLE));
    expect(numericTuneEntry(tune, 'table')?.numericValues).toEqual([1, 2, 3, 4]);
    expect(numericTuneEntry(tune, 'mode')).toBeUndefined();
    expect(numericTuneEntry(tune, 'missing')).toBeUndefined();
  });
});
