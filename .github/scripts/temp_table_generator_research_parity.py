from pathlib import Path

ROOT = Path('.')


def replace_once(path: str, old: str, new: str) -> None:
    p = ROOT / path
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one anchor, found {count}')
    p.write_text(text.replace(old, new, 1))


# Core aggregation: add exact median without burdening non-median callers with sorting/storage.
replace_once(
    'core/analysis/numeric-aggregation.ts',
    """  | 'mean'\n  | 'variance'\n""",
    """  | 'mean'\n  | 'median'\n  | 'variance'\n""",
)
replace_once(
    'core/analysis/numeric-aggregation.ts',
    """export interface NumericAggregationOptions {\n  /** Optional source sample indices, for example qualification output. */\n  readonly sampleIndices?: ArrayLike<number>;\n}\n""",
    """export interface NumericAggregationOptions {\n  /** Optional source sample indices, for example qualification output. */\n  readonly sampleIndices?: ArrayLike<number>;\n  /** Collect/sort valid values only when an exact median is requested. */\n  readonly includeMedian?: boolean;\n}\n""",
)
replace_once(
    'core/analysis/numeric-aggregation.ts',
    """  readonly max: number | undefined;\n  readonly mean: number | undefined;\n  /** Mean magnitude around zero, useful for signed correction/control signals. */\n""",
    """  readonly max: number | undefined;\n  readonly mean: number | undefined;\n  readonly median: number | undefined;\n  /** Mean magnitude around zero, useful for signed correction/control signals. */\n""",
)
replace_once(
    'core/analysis/numeric-aggregation.ts',
    """  let mean = 0;\n  let m2 = 0;\n\n  const inputSampleCount = forEachSelectedSample(range, options.sampleIndices, (localIndex) => {\n""",
    """  let mean = 0;\n  let m2 = 0;\n  const medianValues = options.includeMedian ? [] as number[] : undefined;\n\n  const inputSampleCount = forEachSelectedSample(range, options.sampleIndices, (localIndex) => {\n""",
)
replace_once(
    'core/analysis/numeric-aggregation.ts',
    """    validSampleCount += 1;\n    sum += value;\n""",
    """    validSampleCount += 1;\n    medianValues?.push(value);\n    sum += value;\n""",
)
replace_once(
    'core/analysis/numeric-aggregation.ts',
    """  const variance = validSampleCount > 1\n    ? m2 / (validSampleCount - 1)\n    : validSampleCount === 1 ? 0 : undefined;\n\n  return {\n""",
    """  const variance = validSampleCount > 1\n    ? m2 / (validSampleCount - 1)\n    : validSampleCount === 1 ? 0 : undefined;\n  let median: number | undefined;\n  if (medianValues && medianValues.length > 0) {\n    medianValues.sort((left, right) => left - right);\n    const middle = Math.floor(medianValues.length / 2);\n    median = medianValues.length % 2 === 1\n      ? medianValues[middle]\n      : (medianValues[middle - 1]! + medianValues[middle]!) / 2;\n  }\n\n  return {\n""",
)
replace_once(
    'core/analysis/numeric-aggregation.ts',
    """    max: validSampleCount > 0 ? max : undefined,\n    mean: validSampleCount > 0 ? mean : undefined,\n    meanAbsolute: validSampleCount > 0 ? sumAbsolute / validSampleCount : undefined,\n""",
    """    max: validSampleCount > 0 ? max : undefined,\n    mean: validSampleCount > 0 ? mean : undefined,\n    median,\n    meanAbsolute: validSampleCount > 0 ? sumAbsolute / validSampleCount : undefined,\n""",
)
replace_once(
    'core/analysis/numeric-aggregation.ts',
    """  if (method === 'max') return result.max;\n  if (method === 'mean') return result.mean;\n  if (method === 'variance') return result.variance;\n""",
    """  if (method === 'max') return result.max;\n  if (method === 'mean') return result.mean;\n  if (method === 'median') return result.median;\n  if (method === 'variance') return result.variance;\n""",
)

# Heatmap requests median collection only for the median statistic.
replace_once(
    'core/analysis/heatmap.ts',
    """    const aggregate = aggregateNumericSamples(options.valueRange!, { sampleIndices });\n""",
    """    const aggregate = aggregateNumericSamples(options.valueRange!, {\n      sampleIndices,\n      ...(aggregationMethod === 'median' ? { includeMedian: true } : {}),\n    });\n""",
)

# Numeric compare keeps its Record contract valid when the aggregation vocabulary expands.
replace_once(
    'core/analysis/numeric-compare.ts',
    """  'mean',\n  'variance',\n""",
    """  'mean',\n  'median',\n  'variance',\n""",
)
replace_once(
    'core/analysis/numeric-compare.ts',
    """function aggregateSide(side: NumericCompareSide): NumericAggregationResult {\n  return side.sampleIndices === undefined\n    ? aggregateNumericSamples(side.range)\n    : aggregateNumericSamples(side.range, { sampleIndices: side.sampleIndices });\n}\n""",
    """function aggregateSide(side: NumericCompareSide): NumericAggregationResult {\n  return side.sampleIndices === undefined\n    ? aggregateNumericSamples(side.range, { includeMedian: true })\n    : aggregateNumericSamples(side.range, { sampleIndices: side.sampleIndices, includeMedian: true });\n}\n""",
)

# Persisted Table Generator presets accept the new statistic.
replace_once(
    'apps/web/src/state/histogram-table-storage.ts',
    """  'mean',\n  'variance',\n""",
    """  'mean',\n  'median',\n  'variance',\n""",
)

# Pure source-evidence helper used by the cell inspector.
(ROOT / 'core/analysis/table-cell-evidence.ts').write_text(r'''import type { NumericChannelRange } from '../log-model/log-types';

export interface TableCellEvidenceRow {
  readonly sampleIndex: number;
  readonly timeMs: number | undefined;
  readonly x: number | undefined;
  readonly y: number | undefined;
  readonly z: number | undefined;
  readonly reference: number | undefined;
  readonly delta: number | undefined;
}

export interface TableCellEvidenceOptions {
  readonly sampleIndices: ArrayLike<number>;
  readonly xRange: NumericChannelRange;
  readonly yRange: NumericChannelRange;
  readonly zRange?: NumericChannelRange;
  readonly referenceRange?: NumericChannelRange;
}

function localIndex(range: NumericChannelRange, sampleIndex: number): number | undefined {
  const index = sampleIndex - range.startSampleIndex;
  return Number.isSafeInteger(index) && index >= 0 && index < range.values.length && index < range.validity.length
    ? index
    : undefined;
}

function finiteValue(range: NumericChannelRange | undefined, sampleIndex: number): number | undefined {
  if (!range) return undefined;
  const index = localIndex(range, sampleIndex);
  if (index === undefined || range.validity[index] !== 1) return undefined;
  const value = range.values[index];
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

function finiteTime(range: NumericChannelRange, sampleIndex: number): number | undefined {
  const index = localIndex(range, sampleIndex);
  if (index === undefined || index >= range.timeMs.length) return undefined;
  const value = range.timeMs[index];
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

export function buildTableCellEvidenceRows(options: TableCellEvidenceOptions): readonly TableCellEvidenceRow[] {
  const rows: TableCellEvidenceRow[] = [];
  for (let position = 0; position < options.sampleIndices.length; position += 1) {
    const sampleIndex = options.sampleIndices[position];
    if (sampleIndex === undefined || !Number.isSafeInteger(sampleIndex)) continue;
    const z = finiteValue(options.zRange, sampleIndex);
    const reference = finiteValue(options.referenceRange, sampleIndex);
    rows.push({
      sampleIndex,
      timeMs: finiteTime(options.xRange, sampleIndex),
      x: finiteValue(options.xRange, sampleIndex),
      y: finiteValue(options.yRange, sampleIndex),
      z,
      reference,
      delta: z !== undefined && reference !== undefined ? z - reference : undefined,
    });
  }
  return rows;
}
''')

# Table Generator UI: Median + richer evidence rows/copy.
replace_once(
    'apps/web/src/pages/histogram-table-generator-view.ts',
    """import { buildCellCenteredWeightedMean } from '../../../../core/analysis/weighted-cell-mean';\nimport type { NumericAggregationMethod } from '../../../../core/analysis/numeric-aggregation';\n""",
    """import { buildCellCenteredWeightedMean } from '../../../../core/analysis/weighted-cell-mean';\nimport { buildTableCellEvidenceRows } from '../../../../core/analysis/table-cell-evidence';\nimport type { NumericAggregationMethod } from '../../../../core/analysis/numeric-aggregation';\n""",
)
replace_once(
    'apps/web/src/pages/histogram-table-generator-view.ts',
    """  if (method === 'mean') return 'Mean';\n  if (method === 'min') return 'Minimum';\n""",
    """  if (method === 'mean') return 'Mean';\n  if (method === 'median') return 'Median';\n  if (method === 'min') return 'Minimum';\n""",
)
replace_once(
    'apps/web/src/pages/histogram-table-generator-view.ts',
    """  let selectedCell: { readonly cellIndex: number; readonly xIndex: number; readonly yIndex: number; readonly sampleIndices: readonly number[]; readonly timeMs: readonly number[]; readonly label: string } | undefined;\n""",
    """  let selectedCell: { readonly cellIndex: number; readonly xIndex: number; readonly yIndex: number; readonly sampleIndices: readonly number[]; readonly timeMs: readonly number[]; readonly label: string; readonly copyText: string } | undefined;\n""",
)
replace_once(
    'apps/web/src/pages/histogram-table-generator-view.ts',
    """        <option value=\"mean\">Mean</option>\n        <option value=\"count\">Count</option>\n""",
    """        <option value=\"mean\">Mean</option>\n        <option value=\"median\">Median</option>\n        <option value=\"count\">Count</option>\n""",
)

old_inspector = r'''    const sourceIndices = [...(result.cellSampleIndices[cell.cellIndex] ?? new Uint32Array(0))];
    const times = sourceIndices.flatMap((sampleIndex) => {
      const time = timeForSourceIndex(sampleIndex);
      return time === undefined ? [] : [time];
    });
    const xBin = result.xBins[cell.xIndex]!;
    const yBin = result.yBins[cell.yIndex]!;
    const value = result.cellValues[cell.cellIndex];
    const count = result.counts[cell.cellIndex] ?? 0;
    const label = `${traceLabel(xTrace)} ${formatNumber(xBin.centerValue)} × ${traceLabel(yTrace)} ${formatNumber(yBin.centerValue)}`;
    selectedCell = { cellIndex: cell.cellIndex, xIndex: cell.xIndex, yIndex: cell.yIndex, sampleIndices: sourceIndices, timeMs: times, label };
    cellInspectorTitle.textContent = label;
    const totalWeight = currentCellTotalWeights?.[cell.cellIndex];
    cellInspectorSubtitle.textContent = `${aggregationLabel(currentAggregation)} ${formatCellValue(value, currentAggregation, 120)} · ${count.toLocaleString()} hits${currentAggregation === 'weighted-mean' ? ` · weight ${formatNumber(totalWeight, 3)}` : ''}`;
    cellInspectorSummary.innerHTML = `<span>${traceLabel(xTrace)} ${formatNumber(xBin.lowerBound)}–${formatNumber(xBin.upperBound)}</span><span>${traceLabel(yTrace)} ${formatNumber(yBin.lowerBound)}–${formatNumber(yBin.upperBound)}</span>`;
    const shown = sourceIndices.slice(0, 200);
    cellSampleList.replaceChildren(...shown.map((sampleIndex, index) => {
      const row = document.createElement('div');
      const time = times[index];
      row.innerHTML = `<span>#${sampleIndex.toLocaleString()}</span><strong>${time === undefined ? '—' : `${(time / 1000).toFixed(3)} s`}</strong>`;
      return row;
    }));
    cellListNote.textContent = sourceIndices.length > 200 ? `Showing 200 of ${sourceIndices.length.toLocaleString()} exact hits` : `${sourceIndices.length.toLocaleString()} exact hits`;
    cellOpenLoggerButton.disabled = times.length === 0 || !context.openSamplesInLogger;
    cellCopyButton.disabled = sourceIndices.length === 0;
    cellInspector.hidden = false;
'''
new_inspector = r'''    const sourceIndices = [...(result.cellSampleIndices[cell.cellIndex] ?? new Uint32Array(0))];
    const evidenceRows = buildTableCellEvidenceRows({
      sampleIndices: sourceIndices,
      xRange: xTrace.range,
      yRange: yTrace.range,
      ...(currentZTrace ? { zRange: currentZTrace.range } : {}),
      ...(currentDeltaTrace ? { referenceRange: currentDeltaTrace.range } : {}),
    });
    const timedRows = evidenceRows.filter((row) => row.timeMs !== undefined);
    const xBin = result.xBins[cell.xIndex]!;
    const yBin = result.yBins[cell.yIndex]!;
    const value = result.cellValues[cell.cellIndex];
    const count = result.counts[cell.cellIndex] ?? 0;
    const label = `${traceLabel(xTrace)} ${formatNumber(xBin.centerValue)} × ${traceLabel(yTrace)} ${formatNumber(yBin.centerValue)}`;
    const copyHeader = ['sampleIndex', 'timeMs', traceLabel(xTrace), traceLabel(yTrace)];
    if (currentZTrace) copyHeader.push(traceLabel(currentZTrace));
    if (currentDeltaTrace) copyHeader.push(traceLabel(currentDeltaTrace), `${traceLabel(currentZTrace!)} - ${traceLabel(currentDeltaTrace)}`);
    const copyRows = evidenceRows.map((row) => {
      const values: (string | number)[] = [row.sampleIndex, row.timeMs ?? '', row.x ?? '', row.y ?? ''];
      if (currentZTrace) values.push(row.z ?? '');
      if (currentDeltaTrace) values.push(row.reference ?? '', row.delta ?? '');
      return values.join('\t');
    });
    selectedCell = {
      cellIndex: cell.cellIndex,
      xIndex: cell.xIndex,
      yIndex: cell.yIndex,
      sampleIndices: timedRows.map((row) => row.sampleIndex),
      timeMs: timedRows.map((row) => row.timeMs!),
      label,
      copyText: [copyHeader.join('\t'), ...copyRows].join('\n'),
    };
    cellInspectorTitle.textContent = label;
    const totalWeight = currentCellTotalWeights?.[cell.cellIndex];
    cellInspectorSubtitle.textContent = `${aggregationLabel(currentAggregation)} ${formatCellValue(value, currentAggregation, 120)} · ${count.toLocaleString()} hits${currentAggregation === 'weighted-mean' ? ` · weight ${formatNumber(totalWeight, 3)}` : ''}`;
    const summaryItems = [
      `${traceLabel(xTrace)} ${formatNumber(xBin.lowerBound)}–${formatNumber(xBin.upperBound)}`,
      `${traceLabel(yTrace)} ${formatNumber(yBin.lowerBound)}–${formatNumber(yBin.upperBound)}`,
    ];
    if (currentZTrace) summaryItems.push(`Z · ${traceLabel(currentZTrace)}${currentZTrace.channel.unit ? ` (${currentZTrace.channel.unit})` : ''}`);
    if (currentDeltaTrace) summaryItems.push(`Reference · ${traceLabel(currentDeltaTrace)}${currentDeltaTrace.channel.unit ? ` (${currentDeltaTrace.channel.unit})` : ''}`);
    cellInspectorSummary.replaceChildren(...summaryItems.map((text) => {
      const span = document.createElement('span');
      span.textContent = text;
      return span;
    }));
    const shown = evidenceRows.slice(0, 200);
    cellSampleList.replaceChildren(...shown.map((evidence) => {
      const row = document.createElement('div');
      const meta = document.createElement('span');
      meta.textContent = `#${evidence.sampleIndex.toLocaleString()} · ${evidence.timeMs === undefined ? '—' : `${(evidence.timeMs / 1000).toFixed(3)} s`}`;
      const values = document.createElement('strong');
      const parts = [
        `X ${formatNumber(evidence.x)}${xTrace.channel.unit ? ` ${xTrace.channel.unit}` : ''}`,
        `Y ${formatNumber(evidence.y)}${yTrace.channel.unit ? ` ${yTrace.channel.unit}` : ''}`,
      ];
      if (currentZTrace) parts.push(`Z ${formatNumber(evidence.z)}${currentZTrace.channel.unit ? ` ${currentZTrace.channel.unit}` : ''}`);
      if (currentDeltaTrace) {
        parts.push(`Ref ${formatNumber(evidence.reference)}${currentDeltaTrace.channel.unit ? ` ${currentDeltaTrace.channel.unit}` : ''}`);
        parts.push(`Δ ${formatNumber(evidence.delta)}${currentZTrace?.channel.unit ? ` ${currentZTrace.channel.unit}` : ''}`);
      }
      values.textContent = parts.join(' · ');
      row.replaceChildren(meta, values);
      return row;
    }));
    cellListNote.textContent = evidenceRows.length > 200 ? `Showing 200 of ${evidenceRows.length.toLocaleString()} exact hits` : `${evidenceRows.length.toLocaleString()} exact hits`;
    cellOpenLoggerButton.disabled = timedRows.length === 0 || !context.openSamplesInLogger;
    cellCopyButton.disabled = evidenceRows.length === 0;
    cellInspector.hidden = false;
'''
replace_once('apps/web/src/pages/histogram-table-generator-view.ts', old_inspector, new_inspector)
replace_once(
    'apps/web/src/pages/histogram-table-generator-view.ts',
    """  cellCopyButton.addEventListener('click', () => {\n    if (!selectedCell) return;\n    const lines = selectedCell.sampleIndices.map((sampleIndex, index) => `${sampleIndex}\\t${selectedCell!.timeMs[index] ?? ''}`);\n    void navigator.clipboard.writeText(['sampleIndex\\ttimeMs', ...lines].join('\\n'));\n  });\n""",
    """  cellCopyButton.addEventListener('click', () => {\n    if (!selectedCell) return;\n    void navigator.clipboard.writeText(selectedCell.copyText);\n  });\n""",
)

# Make the richer evidence rows readable without taking over the full plot.
replace_once(
    'apps/web/src/styles/histogram-table-generator.css',
    """  width: min(330px, 36vw);\n""",
    """  width: min(560px, 58vw);\n""",
)
replace_once(
    'apps/web/src/styles/histogram-table-generator.css',
    """.histogram-cell-sample-list > div { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 3px 9px; border-bottom: 1px solid rgba(34, 54, 66, .45); font-size:9px; font-variant-numeric: tabular-nums; }\n.histogram-cell-sample-list span { color: #718a99; }\n.histogram-cell-sample-list strong { text-align: right; font-weight: 600; }\n""",
    """.histogram-cell-sample-list > div { display: grid; grid-template-columns: minmax(120px,.55fr) minmax(0,1.45fr); gap: 10px; padding: 4px 9px; border-bottom: 1px solid rgba(34, 54, 66, .45); font-size:9px; font-variant-numeric: tabular-nums; }\n.histogram-cell-sample-list span { color: #718a99; white-space: nowrap; }\n.histogram-cell-sample-list strong { min-width:0; overflow-wrap:anywhere; color:#cbdbe3; text-align:left; font-weight:600; }\n""",
)

# Tests: exact median and aligned source-value evidence.
replace_once(
    'tests/analysis/numeric-aggregation.test.ts',
    """    expect(result.mean).toBe(0);\n    expect(result.meanAbsolute).toBe(1.5);\n""",
    """    expect(result.mean).toBe(0);\n    expect(result.median).toBeUndefined();\n    expect(result.meanAbsolute).toBe(1.5);\n""",
)
replace_once(
    'tests/analysis/numeric-aggregation.test.ts',
    """  it('maps selectable aggregation methods to their explicit result values', () => {\n    const result = aggregateNumericSamples(range(0, [-1, 2, 3]));\n""",
    """  it('computes exact odd/even medians only when requested', () => {\n    expect(aggregateNumericSamples(range(0, [9, 1, 5]), { includeMedian: true }).median).toBe(5);\n    expect(aggregateNumericSamples(range(0, [9, 1, 5, 3]), { includeMedian: true }).median).toBe(4);\n    expect(aggregateNumericSamples(range(0, [9, 1, 5])).median).toBeUndefined();\n  });\n\n  it('maps selectable aggregation methods to their explicit result values', () => {\n    const result = aggregateNumericSamples(range(0, [-1, 2, 3]), { includeMedian: true });\n""",
)
replace_once(
    'tests/analysis/numeric-aggregation.test.ts',
    """      mean: 4 / 3,\n      variance: 13 / 3,\n""",
    """      mean: 4 / 3,\n      median: 2,\n      variance: 13 / 3,\n""",
)

(ROOT / 'tests/analysis/table-cell-evidence.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
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
''')

# Docs: record completed research-parity Table Generator work.
replace_once(
    'docs/HISTOGRAM.md',
    """- Count, Mean, Min, Max, Sum, Standard Deviation, Variance and **Weighted Mean**;\n""",
    """- Count, Mean, **Median**, Min, Max, Sum, Standard Deviation, Variance and **Weighted Mean**;\n""",
)
replace_once(
    'docs/HISTOGRAM.md',
    """- cell sample inspection;\n- exact cell evidence → Logger navigation;\n""",
    """- cell sample inspection with aligned source/time plus actual X/Y/Z/reference/delta values;\n- exact cell evidence → Logger navigation;\n""",
)
replace_once(
    'docs/HISTOGRAM.md',
    """- the cell inspector could later show X/Y/Z/reference values directly, not only source/time identity.\n""",
    """""",
)
