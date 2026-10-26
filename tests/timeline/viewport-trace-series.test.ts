import { describe, expect, it } from 'vitest';
import { buildViewportTraceSeries, rawRepresentativePoints } from '../../core/timeline/viewport-series';
import type { NumericChannelRange } from '../../core/log-model/log-types';
const range = (n: number): NumericChannelRange => ({ startSampleIndex: 0, values: Float64Array.from({ length: n }, (_, i) => 900 + i % 7), timeMs: Float64Array.from({ length: n }, (_, i) => i * 10), validity: new Uint8Array(n).fill(1) });
describe('Logger/Idle recorded trace policy', () => {
  it('orders first/extrema/last by recorded timestamps and deduplicates', () => {
    expect(rawRepresentativePoints({ x: 0, first: 9, firstTimeMs: 0, max: 12, maxTimeMs: 1, min: 8, minTimeMs: 2, last: 8, lastTimeMs: 2 })).toEqual([{ value: 9, timeMs: 0 }, { value: 12, timeMs: 1 }, { value: 8, timeMs: 2 }]);
  });
  it('retains flat connected traces and narrow extrema at original timestamps in dense data', () => {
    const rpm = range(320459); rpm.values.fill(900); rpm.values[171001] = 4000;
    const trace = buildViewportTraceSeries(rpm, 0, rpm.timeMs.at(-1)!, 500);
    expect(trace.mode).toBe('envelope'); expect(trace.points.length).toBeLessThanOrEqual(2000);
    expect(trace.points.filter(p => p.breakBefore)).toHaveLength(1);
    expect(trace.points).toContainEqual({ timeMs: 1710010, value: 4000, breakBefore: false });
  });
  it('switches to exact raw samples on zoom regardless of full recording size', () => {
    const trace = buildViewportTraceSeries(range(320459), 10000, 10100, 500);
    expect(trace.mode).toBe('raw'); expect(trace.points).toHaveLength(11);
    expect(trace.points[0]).toMatchObject({ timeMs: 10000, value: 906, breakBefore: true });
  });
  it('preserves sparse source validity gaps and does not bridge empty dense buckets', () => {
    const rpm = range(10); rpm.validity[4] = 0;
    expect(buildViewportTraceSeries(rpm, 0, 90, 50).points.filter(p => p.breakBefore)).toHaveLength(2);
    const dense = range(1000); for (let i = 400; i < 600; i++) dense.validity[i] = 0;
    expect(buildViewportTraceSeries(dense, 0, 9990, 100).points.filter(p => p.breakBefore)).toHaveLength(2);
  });
});

it('slices recorded presentation without copies, interpolation or renumbering', async()=>{
  const {sliceNumericRangeByTime}=await import('../../core/timeline/viewport-series');
  const rpm=range(10);rpm.validity[3]=0;const sliced=sliceNumericRangeByTime(rpm,20,40);
  expect(sliced.startSampleIndex).toBe(2);expect([...sliced.timeMs]).toEqual([20,30,40]);
  expect([...sliced.validity]).toEqual([1,0,1]);expect(sliced.values.buffer).toBe(rpm.values.buffer);
});
