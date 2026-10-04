import { describe, expect, it } from 'vitest';
import { parseMsq } from '../../core/parsers/msq/msq-parser';
import { normalizeMsqTune } from '../../core/tune/tune-model';
import { createTuneTable2D, correlateNumericSamplesToTuneTable, locateTuneTablePoint } from '../../core/tune/table-correlation';
import type { NumericChannelRange } from '../../core/log-model/log-types';

function range(startSampleIndex: number, values: readonly number[], validity?: readonly number[]): NumericChannelRange {
  return {
    startSampleIndex,
    timeMs: Float64Array.from(values.map((_, index) => (startSampleIndex + index) * 10)),
    values: Float64Array.from(values),
    validity: Uint8Array.from(validity ?? values.map(() => 1)),
  };
}

function table() {
  const tune = normalizeMsqTune(parseMsq(`<msq><versionInfo signature="sig"/><page number="0">
    <constant name="xBins" rows="1" cols="2">1000 2000</constant>
    <constant name="yBins" rows="2" cols="1">50 100</constant>
    <constant name="veTable" rows="2" cols="2" units="%">40 60 80 100</constant>
  </page></msq>`));
  return createTuneTable2D(tune, { tableName: 'veTable', xAxisName: 'xBins', yAxisName: 'yBins' });
}

describe('tune table correlation', () => {
  it('builds a table only from explicit table/x/y relationships', () => {
    const result = table();
    expect(result).toMatchObject({ name: 'veTable', rows: 2, cols: 2, xAxisName: 'xBins', yAxisName: 'yBins', units: '%' });
    expect(result.xAxis).toEqual([1000, 2000]);
    expect(result.yAxis).toEqual([50, 100]);
  });

  it('performs clamped bilinear tune lookup and reports nearest cell', () => {
    const result = locateTuneTablePoint(table(), 1500, 75);
    expect(result.interpolatedTuneValue).toBeCloseTo(70);
    expect(result.xFraction).toBeCloseTo(0.5);
    expect(result.yFraction).toBeCloseTo(0.5);
    expect(result.nearestCol).toBe(0);
    expect(result.nearestRow).toBe(0);
    expect(locateTuneTablePoint(table(), 500, 150).interpolatedTuneValue).toBe(80);
  });

  it('maps aligned observed samples into nearest cells with sample statistics', () => {
    const result = correlateNumericSamplesToTuneTable(
      table(),
      range(10, [1000, 1100, 2000]),
      range(10, [50, 52, 100]),
      range(10, [10, 14, 30]),
      { complete: true },
    );
    expect(result.inputSampleCount).toBe(3);
    expect(result.mappedSampleCount).toBe(3);
    expect(result.complete).toBe(true);
    const first = result.cells[0]!;
    expect(first.sampleCount).toBe(2);
    expect(first.observedMean).toBe(12);
    expect(first.observedMin).toBe(10);
    expect(first.observedMax).toBe(14);
    expect(first.observedStandardDeviation).toBeCloseTo(Math.sqrt(8));
    expect(result.cells[3]?.sampleCount).toBe(1);
  });

  it('keeps invalid and unavailable evidence separate', () => {
    const result = correlateNumericSamplesToTuneTable(
      table(),
      range(100, [1000, 2000], [1, 0]),
      range(100, [50, 100]),
      range(101, [20]),
      { sampleIndices: [100, 101, 102], complete: false },
    );
    expect(result.inputSampleCount).toBe(3);
    expect(result.mappedSampleCount).toBe(0);
    expect(result.invalidSampleCount).toBe(1);
    expect(result.unavailableSampleCount).toBe(2);
    expect(result.complete).toBe(false);
  });

  it('only computes observed-minus-tune error when explicitly requested', () => {
    const neutral = correlateNumericSamplesToTuneTable(
      table(), range(0, [1500]), range(0, [75]), range(0, [80]), { complete: true },
    );
    const related = correlateNumericSamplesToTuneTable(
      table(), range(0, [1500]), range(0, [75]), range(0, [80]), { complete: true, valueRelation: 'observed-minus-tune' },
    );
    expect(neutral.cells[0]?.meanError).toBeUndefined();
    expect(related.cells[0]?.meanInterpolatedTuneValue).toBeCloseTo(70);
    expect(related.cells[0]?.meanError).toBeCloseTo(10);
  });

  it('validates table dimensions and explicit axis lengths', () => {
    const tune = normalizeMsqTune(parseMsq(`<msq><page><constant name="x" rows="1" cols="1">1</constant><constant name="y" rows="2" cols="1">1 2</constant><constant name="t" rows="2" cols="2">1 2 3 4</constant></page></msq>`));
    expect(() => createTuneTable2D(tune, { tableName: 't', xAxisName: 'x', yAxisName: 'y' })).toThrow(/X axis length/);
  });
});
