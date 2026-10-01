import { describe, expect, it } from 'vitest';
import { buildViewportEnvelope } from '../../core/timeline/viewport-series';

describe('buildViewportEnvelope', () => {
  it('excludes invalid samples while preserving valid min/max columns', () => {
    const envelope = buildViewportEnvelope({
      startSampleIndex: 0,
      timeMs: new Float64Array([0, 10, 20, 30]),
      values: new Float64Array([1, 99, 3, 4]),
      validity: new Uint8Array([1, 0, 1, 1]),
    }, 0, 30, 3);

    expect(envelope.validSampleCount).toBe(3);
    expect(envelope.invalidSampleCount).toBe(1);
    expect(envelope.valueMin).toBe(1);
    expect(envelope.valueMax).toBe(4);
    expect(envelope.columns.map((column) => [column.x, column.min, column.max])).toEqual([
      [0, 1, 1],
      [2, 3, 4],
    ]);
  });
});
