import { describe, expect, it } from 'vitest';
import { buildScatterEvidenceCsv, scatterCsvFilename } from '../../apps/web/src/pages/scatter-csv-export';
import type { NumericScatterResult } from '../../core/analysis/scatter';

const result: NumericScatterResult = {
  sampleIndices: Uint32Array.from([10, 11, 15]),
  xValues: Float64Array.from([100, 110, 125]),
  yValues: Float64Array.from([2500, 2800, 3200]),
  inputSampleCount: 4,
  validPairSampleCount: 3,
  invalidSampleCount: 1,
  unavailableSampleCount: 0,
  xMin: 100,
  xMax: 125,
  yMin: 2500,
  yMax: 3200,
};

describe('Scatter CSV evidence export', () => {
  it('exports every qualified valid pair with provenance', () => {
    const exported = buildScatterEvidenceCsv({
      result,
      evidenceKind: 'qualified',
      scopeLabel: 'Current A/B',
      qualificationLabel: 'Steady, warm',
      xChannelLabel: 'MAP, kPa source',
      xUnit: 'kPa',
      yChannelLabel: 'RPM',
      yUnit: 'rpm',
      timeForSampleIndex: (sampleIndex) => sampleIndex * 2,
    });
    expect(exported.rowCount).toBe(3);
    expect(exported.csv.split('\n')).toHaveLength(4);
    expect(exported.csv).toContain('qualified,Current A/B,"Steady, warm",10,20,0.02,"MAP, kPa source",kPa,100,RPM,rpm,2500');
    expect(exported.csv).toContain('15,30,0.03');
  });

  it('exports only source samples inside the selected region', () => {
    const exported = buildScatterEvidenceCsv({
      result,
      evidenceKind: 'region',
      scopeLabel: 'Full Log',
      qualificationLabel: '',
      xChannelLabel: 'MAP',
      yChannelLabel: 'RPM',
      timeForSampleIndex: () => undefined,
      selectedSampleIndices: Uint32Array.from([11, 15]),
    });
    expect(exported.rowCount).toBe(2);
    expect(exported.csv).not.toContain(',10,,');
    expect(exported.csv).toContain('region,Full Log,None,11,,,MAP,,110,RPM,,2800');
    expect(exported.csv).toContain('region,Full Log,None,15,,,MAP,,125,RPM,,3200');
  });

  it('creates bounded readable filenames', () => {
    expect(scatterCsvFilename('MAP kPa', 'Engine RPM', 'region')).toBe('scatter-Engine-RPM-vs-MAP-kPa-region.csv');
  });
});
