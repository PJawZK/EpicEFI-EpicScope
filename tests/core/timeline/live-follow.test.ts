import { describe, expect, it } from 'vitest';
import { extendLiveViewport } from '../../../core/timeline/live-follow';

describe('extendLiveViewport', () => {
  it('follows the newest sample with a bounded rolling window', () => {
    expect(extendLiveViewport(undefined, { startMs: 0, endMs: 25_000, durationMs: 25_000 }, {
      followLatest: true,
      followWindowMs: 10_000,
    })).toEqual({
      fullStartMs: 0,
      fullEndMs: 25_000,
      visibleStartMs: 15_000,
      visibleEndMs: 25_000,
    });
  });

  it('grows the initial window until the requested follow span is available', () => {
    expect(extendLiveViewport(undefined, { startMs: 0, endMs: 4_000, durationMs: 4_000 }, {
      followLatest: true,
      followWindowMs: 10_000,
    })).toEqual({
      fullStartMs: 0,
      fullEndMs: 4_000,
      visibleStartMs: 0,
      visibleEndMs: 4_000,
    });
  });

  it('preserves an inspected historical viewport when follow is off', () => {
    expect(extendLiveViewport({
      fullStartMs: 0,
      fullEndMs: 10_000,
      visibleStartMs: 2_000,
      visibleEndMs: 6_000,
    }, { startMs: 0, endMs: 20_000, durationMs: 20_000 }, {
      followLatest: false,
    })).toEqual({
      fullStartMs: 0,
      fullEndMs: 20_000,
      visibleStartMs: 2_000,
      visibleEndMs: 6_000,
    });
  });
});
