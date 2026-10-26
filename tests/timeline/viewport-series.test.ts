import { describe, expect, it } from 'vitest';
import { buildEnvelopeBlockSummary, buildRawViewportSeries, buildViewportEnvelope, buildViewportEnvelopeFromBlocks, nearestNumericSample } from '../../core/timeline/viewport-series';

it('shared cursor returns original sample identity, never an interpolated or invalid value', () => {
  const range = { startSampleIndex: 10, timeMs: Float64Array.from([100, 200, 300]), values: Float64Array.from([900, 999, 1100]), validity: Uint8Array.from([1, 0, 1]) };
  expect(nearestNumericSample(range, 110)).toEqual({ sampleIndex: 10, timeMs: 100, value: 900 });
  expect(nearestNumericSample(range, 150)).toEqual({ sampleIndex: 10, timeMs: 100, value: 900 });
  expect(nearestNumericSample(range, 200)).toBeUndefined();
  expect(nearestNumericSample(range, 99)).toBeUndefined();
  expect(nearestNumericSample(range, NaN)).toBeUndefined();
});

describe('buildViewportEnvelope', () => {
  it('excludes invalid samples while preserving first/min/max/last raw samples', () => {
    const envelope = buildViewportEnvelope({
      startSampleIndex: 0,
      timeMs: new Float64Array([0, 10, 20, 25, 30]),
      values: new Float64Array([1, 99, 5, 3, 4]),
      validity: new Uint8Array([1, 0, 1, 1, 1]),
    }, 0, 30, 3);

    expect(envelope.validSampleCount).toBe(4);
    expect(envelope.invalidSampleCount).toBe(1);
    expect(envelope.valueMin).toBe(1);
    expect(envelope.valueMax).toBe(5);
    expect(envelope.columns).toEqual([
      {
        x: 0,
        first: 1,
        firstTimeMs: 0,
        min: 1,
        minTimeMs: 0,
        max: 1,
        maxTimeMs: 0,
        last: 1,
        lastTimeMs: 0,
      },
      {
        x: 2,
        first: 5,
        firstTimeMs: 20,
        min: 3,
        minTimeMs: 25,
        max: 5,
        maxTimeMs: 20,
        last: 4,
        lastTimeMs: 30,
      },
    ]);
  });

  it('matches the raw envelope exactly when fixed block summaries accelerate complete blocks', () => {
    const sampleCount = 257;
    const timeMs = Float64Array.from({ length: sampleCount }, (_, index) => index * 7 + (index % 9 === 0 ? 1 : 0));
    const values = Float64Array.from({ length: sampleCount }, (_, index) => Math.sin(index / 8) * 20 + (index % 17));
    const validity = Uint8Array.from({ length: sampleCount }, (_, index) => index % 41 === 0 ? 0 : 1);
    const range = { startSampleIndex: 0, timeMs, values, validity };
    const blocks = buildEnvelopeBlockSummary(values, timeMs, validity, 16);

    for (const [startMs, endMs, width] of [[0, timeMs[sampleCount - 1]!, 23], [113, 1400, 37], [500, 900, 11]] as const) {
      expect(buildViewportEnvelopeFromBlocks(range, blocks, startMs, endMs, width))
        .toEqual(buildViewportEnvelope(range, startMs, endMs, width));
    }
  });

  it('preserves extrema timing so a bucket can be rendered in raw chronological order', () => {
    const envelope = buildViewportEnvelope({
      startSampleIndex: 0,
      timeMs: new Float64Array([0, 1, 2, 3]),
      values: new Float64Array([10, 30, 5, 20]),
      validity: new Uint8Array([1, 1, 1, 1]),
    }, 0, 3, 1);

    expect(envelope.columns[0]).toEqual({
      x: 0,
      first: 10,
      firstTimeMs: 0,
      min: 5,
      minTimeMs: 2,
      max: 30,
      maxTimeMs: 1,
      last: 20,
      lastTimeMs: 3,
    });
  });

  it('counts and bins only samples inside the visible time range', () => {
    const envelope = buildViewportEnvelope({
      startSampleIndex: 0,
      timeMs: new Float64Array([0, 10, 20, 30, 40, 50]),
      values: new Float64Array([99, 1, 2, 3, 4, 99]),
      validity: new Uint8Array([0, 1, 1, 1, 1, 0]),
    }, 10, 40, 4);

    expect(envelope.validSampleCount).toBe(4);
    expect(envelope.invalidSampleCount).toBe(0);
    expect(envelope.valueMin).toBe(1);
    expect(envelope.valueMax).toBe(4);
  });

  it('connects real high-zoom samples even when their pixel spacing would be large', () => {
    const points = buildRawViewportSeries({
      startSampleIndex: 0,
      timeMs: new Float64Array([0, 11, 22, 33, 44]),
      values: new Float64Array([10, 11, 12, 13, 14]),
      validity: new Uint8Array([1, 1, 1, 1, 1]),
    }, 0, 44);

    expect(points.map((point) => point.breakBefore)).toEqual([true, false, false, false, false]);
  });

  it('breaks a raw high-zoom trace across invalid source records', () => {
    const points = buildRawViewportSeries({
      startSampleIndex: 0,
      timeMs: new Float64Array([0, 10, 20, 30]),
      values: new Float64Array([1, 2, 3, 4]),
      validity: new Uint8Array([1, 1, 0, 1]),
    }, 0, 30);

    expect(points).toEqual([
      { timeMs: 0, value: 1, breakBefore: true },
      { timeMs: 10, value: 2, breakBefore: false },
      { timeMs: 30, value: 4, breakBefore: true },
    ]);
  });

  it('preserves raw trace continuity when invalid retry attempts have a valid same-timestamp replacement', () => {
    const points = buildRawViewportSeries({
      startSampleIndex: 0,
      timeMs: new Float64Array([0, 10, 20, 20, 20, 30]),
      values: new Float64Array([1, 2, 90, 91, 3, 4]),
      validity: new Uint8Array([1, 1, 0, 0, 1, 1]),
    }, 0, 30);

    expect(points).toEqual([
      { timeMs: 0, value: 1, breakBefore: true },
      { timeMs: 10, value: 2, breakBefore: false },
      { timeMs: 20, value: 3, breakBefore: false },
      { timeMs: 30, value: 4, breakBefore: false },
    ]);
  });

  it('bounds timestamp reads for an unrecovered same-timestamp run', () => {
    const count = 1024;
    let reads = 0;
    const timeMs = new Proxy(new Float64Array(count), {
      get(target, key) {
        if (typeof key === 'string' && /^\d+$/.test(key)) {
          reads += 1;
          if (reads > count * 12) throw new Error('Retry rendering exceeded bounded timestamp reads');
        }
        return Reflect.get(target, key, target);
      },
    });
    expect(buildRawViewportSeries({ startSampleIndex: 0, timeMs,
      values: new Float64Array(count), validity: new Uint8Array(count) }, 0, 0)).toEqual([]);
    expect(reads).toBeLessThanOrEqual(count * 12);
  });

  it.each([
    { name: 'unrecovered group before a recovered group', times: [0, 10, 20, 20, 30], values: [1, 2, 3, 4, 5], valid: [1, 0, 0, 1, 1], breaks: [true, true, false] },
    { name: 'invalid suffix after a valid same-time sample', times: [0, 10, 10, 20], values: [1, 2, 3, 4], valid: [1, 1, 0, 1], breaks: [true, false, true] },
    { name: 'nonfinite values followed by same-time recovery', times: [0, 10, 10, 20], values: [1, NaN, 3, 4], valid: [1, 1, 1, 1], breaks: [true, false, false] },
    { name: 'multiple valid same-time samples and later recovery', times: [0, 10, 10, 10, 10, 20], values: [1, 2, 3, 4, 5, 6], valid: [1, 1, 0, 1, 1, 1], breaks: [true, false, false, false, false] },
  ])('preserves gap semantics for $name', ({ times, values, valid, breaks }) => {
    const range = { startSampleIndex: 0, timeMs: Float64Array.from(times), values: Float64Array.from(values), validity: Uint8Array.from(valid) };
    const points = buildRawViewportSeries(range, 0, 30);
    expect(points.map(p => p.breakBefore)).toEqual(breaks);
    expect(points.map(p => p.value)).toEqual(values.filter((value, index) => valid[index] === 1 && Number.isFinite(value)));
  });

  it.each([false, true])('handles >320k retry attempts with final replacement=%s', (recovered) => {
    const count = 320_005;
    const timeMs = new Float64Array(count).fill(10);
    const values = new Float64Array(count).fill(99);
    const validity = new Uint8Array(count);
    timeMs[0] = 0; values[0] = 1; validity[0] = 1;
    timeMs[count - 1] = 20; values[count - 1] = 3; validity[count - 1] = 1;
    if (recovered) { values[count - 2] = 2; validity[count - 2] = 1; }
    expect(buildRawViewportSeries({ startSampleIndex: 0, timeMs, values, validity }, 0, 20)).toEqual(recovered
      ? [{ timeMs: 0, value: 1, breakBefore: true }, { timeMs: 10, value: 2, breakBefore: false }, { timeMs: 20, value: 3, breakBefore: false }]
      : [{ timeMs: 0, value: 1, breakBefore: true }, { timeMs: 20, value: 3, breakBefore: true }]);
  });

  it('preserves >320k continuous valid samples and viewport bounds', () => {
    const count = 320_005;
    const range = { startSampleIndex: 0, timeMs: Float64Array.from({ length: count }, (_, i) => i), values: Float64Array.from({ length: count }, (_, i) => i), validity: new Uint8Array(count).fill(1) };
    const points = buildRawViewportSeries(range, 0, count - 1);
    expect(points).toHaveLength(count);
    expect(points[0]?.breakBefore).toBe(true);
    expect(points.slice(1).every(p => !p.breakBefore)).toBe(true);
    expect(buildRawViewportSeries(range, 100, 102)).toEqual([
      { timeMs: 100, value: 100, breakBefore: true }, { timeMs: 101, value: 101, breakBefore: false }, { timeMs: 102, value: 102, breakBefore: false },
    ]);
  });

  it('breaks a raw high-zoom trace across an abnormal timestamp gap', () => {
    const points = buildRawViewportSeries({
      startSampleIndex: 0,
      timeMs: new Float64Array([0, 10, 20, 200, 210]),
      values: new Float64Array([1, 2, 3, 4, 5]),
      validity: new Uint8Array([1, 1, 1, 1, 1]),
    }, 0, 210);

    expect(points.map((point) => point.breakBefore)).toEqual([true, false, false, true, false]);
  });
});
