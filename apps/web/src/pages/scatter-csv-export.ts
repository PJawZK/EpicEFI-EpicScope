import type { NumericScatterResult } from '../../../../core/analysis/scatter';

export type ScatterCsvEvidenceKind = 'qualified' | 'region';

export interface ScatterCsvExportOptions {
  readonly result: NumericScatterResult;
  readonly evidenceKind: ScatterCsvEvidenceKind;
  readonly scopeLabel: string;
  readonly qualificationLabel: string;
  readonly xChannelLabel: string;
  readonly xUnit?: string | undefined;
  readonly yChannelLabel: string;
  readonly yUnit?: string | undefined;
  readonly timeForSampleIndex: (sampleIndex: number) => number | undefined;
  readonly selectedSampleIndices?: ArrayLike<number> | undefined;
}

export interface ScatterCsvExportResult {
  readonly csv: string;
  readonly rowCount: number;
}

function quoteCsv(value: string | number): string {
  const text = String(value);
  return /[\",\n\r]/.test(text) ? `\"${text.replace(/\"/g, '\"\"')}\"` : text;
}

export function buildScatterEvidenceCsv(options: ScatterCsvExportOptions): ScatterCsvExportResult {
  const selected = options.selectedSampleIndices
    ? new Set(Array.from(options.selectedSampleIndices, (value) => Number(value)))
    : undefined;
  const rows: string[] = [[
    'evidence_set', 'scope', 'qualification', 'sample_index', 'time_ms', 'time_s',
    'x_channel', 'x_unit', 'x_value', 'y_channel', 'y_unit', 'y_value',
  ].join(',')];
  let rowCount = 0;

  for (let index = 0; index < options.result.validPairSampleCount; index += 1) {
    const sampleIndex = options.result.sampleIndices[index];
    const xValue = options.result.xValues[index];
    const yValue = options.result.yValues[index];
    if (sampleIndex === undefined || xValue === undefined || yValue === undefined) continue;
    if (selected && !selected.has(sampleIndex)) continue;
    const timeMs = options.timeForSampleIndex(sampleIndex);
    const values: (string | number)[] = [
      options.evidenceKind,
      options.scopeLabel,
      options.qualificationLabel || 'None',
      sampleIndex,
      timeMs ?? '',
      timeMs === undefined ? '' : timeMs / 1000,
      options.xChannelLabel,
      options.xUnit ?? '',
      xValue,
      options.yChannelLabel,
      options.yUnit ?? '',
      yValue,
    ];
    rows.push(values.map(quoteCsv).join(','));
    rowCount += 1;
  }

  return { csv: rows.join('\n'), rowCount };
}

export function scatterCsvFilename(xLabel: string, yLabel: string, evidenceKind: ScatterCsvEvidenceKind): string {
  const safe = (value: string): string => value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'channel';
  return `scatter-${safe(yLabel)}-vs-${safe(xLabel)}-${evidenceKind}.csv`;
}
