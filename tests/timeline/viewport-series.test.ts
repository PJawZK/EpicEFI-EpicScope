import { describe, expect, it } from 'vitest';
import { buildRawViewportSeries, buildViewportEnvelope } from '../../core/timeline/viewport-series';

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
