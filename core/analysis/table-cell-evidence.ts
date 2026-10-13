import type { NumericChannelRange } from '../log-model/log-types';

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
