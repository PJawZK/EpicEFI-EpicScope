import { describe, expect, it } from 'vitest';
import { discoverIdleCandidates } from '../../core/analysis/idle-regions';
import type { NumericChannelRange } from '../../core/log-model/log-types';
const options = { maximumRpm: 1200, minimumDurationMs: 200, maximumGapMs: 150 };
const range = (values: number[], times = values.map((_, i) => i * 100)): NumericChannelRange => ({ startSampleIndex: 10, values: Float64Array.from(values), timeMs: Float64Array.from(times), validity: new Uint8Array(values.length).fill(1) });
describe('recorded RPM candidate windows', () => {
  it('uses inclusive RPM ceiling, excludes stopped engine and returns original endpoints', () => {
    const result = discoverIdleCandidates(range([0, 1200, 900, 1000, 1300, 900, 900, 900]), options);
    expect(result.regions).toEqual([
      { startMs: 100, endMs: 300, startSampleIndex: 11, endSampleIndex: 13, validSampleCount: 3 },
      { startMs: 500, endMs: 700, startSampleIndex: 15, endSampleIndex: 17, validSampleCount: 3 },
    ]);
  });
  it('splits invalid records, nonfinite values and oversized gaps; never pads short runs', () => {
    const rpm = range([900, 900, 900, 900, 900, 900, NaN, 900], [0,100,200,300,400,1000,1100,1200]); rpm.validity[2] = 0;
    expect(discoverIdleCandidates(rpm, options).totalCount).toBe(0);
  });
  it('accepts same-timestamp valid retry without treating invalid attempts as measurements', () => {
    const rpm = range([900, 9999, 900, 900], [0,100,100,200]); rpm.validity[1] = 0;
    expect(discoverIdleCandidates(rpm, options).regions[0]).toMatchObject({ startSampleIndex: 10, endSampleIndex: 13, validSampleCount: 3 });
    rpm.validity[2] = 0;
    expect(discoverIdleCandidates(rpm, options).totalCount).toBe(0);
  });
  it('does not let a later retry mask an earlier unrecovered timestamp', () => {
    const rpm = range([900, 9999, 9999, 900, 900], [0,50,100,100,200]); rpm.validity[1] = rpm.validity[2] = 0;
    expect(discoverIdleCandidates(rpm, options).totalCount).toBe(0);
  });
  it('handles >320k continuous valid samples and bounds the retained candidate list', () => {
    const n = 320459, rpm: NumericChannelRange = { startSampleIndex: 7, values: new Float64Array(n).fill(900), timeMs: Float64Array.from({ length: n }, (_, i) => i * 100), validity: new Uint8Array(n).fill(1) };
    expect(discoverIdleCandidates(rpm, options).regions[0]).toMatchObject({ startSampleIndex: 7, endSampleIndex: n + 6, validSampleCount: n });
    for (let i = 3; i < n; i += 4) rpm.values[i] = 1500;
    const result = discoverIdleCandidates(rpm, options); expect(result.totalCount).toBeGreaterThan(200); expect(result.regions).toHaveLength(200);
  });
  it('rejects invalid thresholds', () => {
    expect(() => discoverIdleCandidates(range([900]), { ...options, maximumRpm: NaN })).toThrow(RangeError);
    expect(() => discoverIdleCandidates(range([900]), { ...options, minimumDurationMs: 0 })).toThrow(RangeError);
  });
});
