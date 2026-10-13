export interface DistributionCsvStats {
  readonly count: number;
  readonly min: number | undefined;
  readonly max: number | undefined;
  readonly mean: number | undefined;
  readonly median: number | undefined;
  readonly standardDeviation: number | undefined;
  readonly p05: number | undefined;
  readonly p25: number | undefined;
  readonly p75: number | undefined;
  readonly p95: number | undefined;
}

export interface DistributionCsvSeries {
  readonly label: string;
  readonly binValues: readonly number[];
  readonly stats: DistributionCsvStats;
  readonly inputSampleCount: number;
  readonly eligibleSampleCount: number;
  readonly rejectedSampleCount: number;
  readonly outsideGeometrySampleCount?: number;
}

export interface DistributionCsvOptions {
  readonly channelLabel: string;
  readonly unit?: string | undefined;
  readonly metric: string;
  readonly display: string;
  readonly binMode: string;
  readonly rangeMin: number;
  readonly rangeMax: number;
  readonly series: readonly DistributionCsvSeries[];
}

export interface DistributionCsvResult {
  readonly csv: string;
  readonly binRowCount: number;
}

function quote(value: string | number | boolean): string {
  const text = String(value);
  return /[\",\n\r]/.test(text) ? `\"${text.replace(/\"/g, '\"\"')}\"` : text;
}

export function buildDistributionCsv(options: DistributionCsvOptions): DistributionCsvResult {
  const header = [
    'row_type', 'series', 'channel', 'unit', 'metric', 'display', 'bin_mode',
    'bin_index', 'lower', 'upper', 'upper_inclusive', 'value',
    'sample_count', 'min', 'max', 'mean', 'median', 'stddev', 'p05', 'p25', 'p75', 'p95',
    'input_samples', 'eligible_samples', 'rejected_samples', 'outside_geometry_samples',
  ];
  const rows: string[] = [header.join(',')];
  const binCount = options.series[0]?.binValues.length ?? 0;
  const width = binCount > 0 ? (options.rangeMax - options.rangeMin) / binCount : 0;
  let binRowCount = 0;

  for (const series of options.series) {
    for (let index = 0; index < series.binValues.length; index += 1) {
      const lower = options.rangeMin + width * index;
      const upper = index === binCount - 1 ? options.rangeMax : options.rangeMin + width * (index + 1);
      const values: (string | number | boolean)[] = [
        'bin', series.label, options.channelLabel, options.unit ?? '', options.metric, options.display, options.binMode,
        index, lower, upper, index === binCount - 1, series.binValues[index] ?? 0,
        '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      ];
      rows.push(values.map(quote).join(','));
      binRowCount += 1;
    }
    const stats = series.stats;
    const summary: (string | number | boolean)[] = [
      'summary', series.label, options.channelLabel, options.unit ?? '', options.metric, options.display, options.binMode,
      '', '', '', '', '',
      stats.count, stats.min ?? '', stats.max ?? '', stats.mean ?? '', stats.median ?? '', stats.standardDeviation ?? '',
      stats.p05 ?? '', stats.p25 ?? '', stats.p75 ?? '', stats.p95 ?? '',
      series.inputSampleCount, series.eligibleSampleCount, series.rejectedSampleCount, series.outsideGeometrySampleCount ?? 0,
    ];
    rows.push(summary.map(quote).join(','));
  }
  return { csv: rows.join('\n'), binRowCount };
}

export function distributionCsvFilename(channelLabel: string): string {
  const safe = channelLabel.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'channel';
  return `distribution-${safe}.csv`;
}
