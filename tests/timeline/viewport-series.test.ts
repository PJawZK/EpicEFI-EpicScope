import { describe, expect, it } from 'vitest';
import { buildEnvelopeBlockHierarchy, buildEnvelopeBlockSummary, buildRawViewportSeries, buildViewportEnvelope, buildViewportEnvelopeFromBlocks } from '../../core/timeline/viewport-series';

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

  it('matches the raw envelope exactly with a multilevel 64/256/1024 hierarchy', () => {
    const sampleCount = 4099;
    const timeMs = Float64Array.from({ length: sampleCount }, (_, index) => index * 7 + (index % 11));
    const values = Float64Array.from({ length: sampleCount }, (_, index) => Math.sin(index / 13) * 30 + Math.cos(index / 41) * 9);
    const validity = Uint8Array.from({ length: sampleCount }, (_, index) => index % 97 === 0 || index % 211 === 0 ? 0 : 1);
    const range = { startSampleIndex: 0, timeMs, values, validity };
    const hierarchy = buildEnvelopeBlockHierarchy(values, timeMs, validity, 64, 3);

    expect(hierarchy.map((level) => level.blockSize)).toEqual([64, 256, 1024]);
    for (const [startMs, endMs, width] of [
      [timeMs[0]!, timeMs[sampleCount - 1]!, 23],
      [timeMs[0]!, timeMs[sampleCount - 1]!, 137],
      [timeMs[321]!, timeMs[3777]!, 51],
      [timeMs[1000]!, timeMs[1800]!, 311],
    ] as const) {
      expect(buildViewportEnvelopeFromBlocks(range, hierarchy, startMs, endMs, width))
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
