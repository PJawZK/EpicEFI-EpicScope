import { describe, expect, it } from 'vitest';
import { buildDistributionCsv, distributionCsvFilename } from '../../apps/web/src/pages/histogram-distribution-csv';

describe('Distribution CSV export', () => {
  it('exports shared bin geometry and summary statistics for compared series', () => {
    const result = buildDistributionCsv({
      channelLabel: 'Engine RPM, filtered', unit: 'rpm', metric: 'percent', display: 'histogram', binMode: 'manual',
      rangeMin: 1000, rangeMax: 3000,
      series: [
        { label: 'Primary A/B', binValues: [25, 75], stats: { count: 4, min: 1100, max: 2800, mean: 2000, median: 2050, standardDeviation: 600, p05: 1150, p25: 1500, p75: 2500, p95: 2750 }, inputSampleCount: 5, eligibleSampleCount: 4, rejectedSampleCount: 1 },
        { label: 'Full Log', binValues: [50, 50], stats: { count: 2, min: 1200, max: 2600, mean: 1900, median: 1900, standardDeviation: 700, p05: 1270, p25: 1550, p75: 2250, p95: 2530 }, inputSampleCount: 3, eligibleSampleCount: 2, rejectedSampleCount: 1 },
      ],
    });
    expect(result.binRowCount).toBe(4);
    expect(result.csv).toContain('bin,Primary A/B,"Engine RPM, filtered",rpm,percent,histogram,manual,0,1000,2000,false,25');
    expect(result.csv).toContain('bin,Full Log,"Engine RPM, filtered",rpm,percent,histogram,manual,1,2000,3000,true,50');
    expect(result.csv).toContain('summary,Primary A/B,"Engine RPM, filtered",rpm,percent,histogram,manual,,,,,,4,1100,2800,2000,2050,600');
    expect(result.csv).toContain(',5,4,1');
  });

  it('creates a readable channel filename', () => {
    expect(distributionCsvFilename('Engine RPM / filtered')).toBe('distribution-Engine-RPM-filtered.csv');
  });
});
