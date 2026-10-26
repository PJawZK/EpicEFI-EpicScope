import { describe, expect, it } from 'vitest';
import { analyzeIdleStability } from '../../core/analysis/idle-stability';
import type { NumericChannelRange } from '../../core/log-model/log-types';

const range = (values: readonly number[], startSampleIndex = 0): NumericChannelRange => ({
  startSampleIndex, values: Float64Array.from(values), timeMs: Float64Array.from(values, (_, index) => index * 100), validity: new Uint8Array(values.length).fill(1),
});
describe('native Idle stability contract', () => {
  it('uses production sample sigma, actual-minus-target RMSE and paired in-band denominator', () => {
    const result = analyzeIdleStability(range([900, 1000, 1100]), range([1000, 1000, 1000]));
    expect(result.analysis.rpm.standardDeviation).toBe(100);
    expect(result.analysis.tracking?.rmse).toBeCloseTo(Math.sqrt(20000 / 3));
    expect(result.inBandPercent).toBeCloseTo(100 / 3);
    expect([...result.error!.values]).toEqual([-100, 0, 100]);
    expect(result.analysis.sagEvents).toEqual([]);
  });
  it('preserves absolute sample identity, inclusive scope and invalid counts', () => {
    const rpm = range([800, 900, 1000, 1100], 10); rpm.validity[2] = 0;
    const result = analyzeIdleStability(rpm, range([900, 900, 900, 900], 10), { startMs: 100, endMs: 200 });
    expect([...result.sampleIndices]).toEqual([11, 12]);
    expect(result.analysis.rpm.validSampleCount).toBe(1);
    expect(result.analysis.rpm.invalidSampleCount).toBe(1);
    expect(result.analysis.tracking?.invalidSampleCount).toBe(1);
    expect([...result.error!.validity]).toEqual([0, 1, 0, 0]);
  });
  it('keeps missing target unavailable rather than zero or borrowed from another role', () => {
    const result = analyzeIdleStability(range([800, 900]), undefined);
    expect(result.analysis.rpm.mean).toBe(850);
    expect(result.analysis.tracking).toBeUndefined();
    expect(result.inBandPercent).toBeUndefined();
    expect(result.error).toBeUndefined();
  });
  it('rejects invalid/nonfinite pairs and reports unavailable grid coverage', () => {
    const rpm = range([900, 1000, 1100], 10);
    const target = range([1000, Number.NaN], 11);
    target.timeMs[0] = 100; target.timeMs[1] = 200;
    const result = analyzeIdleStability(rpm, target);
    expect(result.analysis.tracking).toMatchObject({ sampleCount: 1, invalidSampleCount: 1, unavailableSampleCount: 1, rmse: 0 });
    expect(result.inBandPercent).toBe(100);
  });
  it('rejects mismatched timestamps without mutating canonical validity', () => {
    const rpm = range([900]); const target = range([900]); target.timeMs[0] = 10;
    const result = analyzeIdleStability(rpm, target);
    expect(result.analysis.tracking?.sampleCount).toBe(0);
    expect(result.analysis.tracking?.invalidSampleCount).toBe(1);
    expect(result.inBandPercent).toBeUndefined();
    expect(target.validity[0]).toBe(1);
  });
  it('does not interpolate or time-weight across gaps, and excludes nonfinite timestamps', () => {
    const rpm = range([900, 1000, 9999]); rpm.timeMs[1] = 10000; rpm.timeMs[2] = Number.NaN;
    const result = analyzeIdleStability(rpm, undefined);
    expect(result.analysis.rpm.mean).toBe(950);
    expect([...result.sampleIndices]).toEqual([0, 1]);
    expect(result.endMs).toBe(10000);
  });
  it('returns unavailable metrics for an empty/all-invalid region', () => {
    const rpm = range([Number.NaN]);
    expect(analyzeIdleStability(rpm, range([900])).analysis.tracking?.rmse).toBeUndefined();
    expect(analyzeIdleStability(rpm, undefined, { startMs: 10, endMs: 20 }).analysis.rpm.mean).toBeUndefined();
    expect(() => analyzeIdleStability(rpm, undefined, { startMs: 20, endMs: 10 })).toThrow(RangeError);
  });
  it('handles >320k continuous valid samples without sample-sized spreads or sag work', () => {
    const count = 320459;
    const rpm = { startSampleIndex: 40, values: new Float64Array(count).fill(900), timeMs: Float64Array.from({ length: count }, (_, i) => i * 12.5), validity: new Uint8Array(count).fill(1) };
    const result = analyzeIdleStability(rpm, rpm);
    expect(result.analysis.rpm.validSampleCount).toBe(count);
    expect(result.analysis.tracking?.rmse).toBe(0);
    expect(result.analysis.rpm.standardDeviation).toBe(0);
    expect(result.inBandPercent).toBe(100);
    expect(result.sampleIndices[count - 1]).toBe(40 + count - 1);
  });
});
