import { describe, expect, it } from 'vitest';
import {
  createFullViewport,
  fitViewport,
  followCursor,
  panViewport,
  viewportSpan,
  zoomViewport,
} from '../../core/timeline/viewport-state';

describe('timeline viewport state', () => {
  it('zooms around an anchor while preserving bounds', () => {
    const full = createFullViewport(0, 1000);
    const zoomed = zoomViewport(full, 0.5, 250);

    expect(viewportSpan(zoomed)).toBe(500);
    expect(zoomed.visibleStartMs).toBe(125);
    expect(zoomed.visibleEndMs).toBe(625);
    expect(fitViewport(zoomed)).toEqual(full);
  });

  it('pans without leaving the full log range', () => {
    const zoomed = zoomViewport(createFullViewport(0, 1000), 0.5, 500);
    expect(panViewport(zoomed, 400)).toMatchObject({ visibleStartMs: 500, visibleEndMs: 1000 });
    expect(panViewport(zoomed, -400)).toMatchObject({ visibleStartMs: 0, visibleEndMs: 500 });
  });

  it('lets a forward cursor move freely until the viewport midpoint then follows it', () => {
    const viewport = { fullStartMs: 0, fullEndMs: 1000, visibleStartMs: 0, visibleEndMs: 400 };

    expect(followCursor(viewport, 50, 180)).toEqual(viewport);
    expect(followCursor(viewport, 180, 260)).toMatchObject({ visibleStartMs: 60, visibleEndMs: 460 });
  });

  it('uses the same midpoint rule when moving backward', () => {
    const viewport = { fullStartMs: 0, fullEndMs: 1000, visibleStartMs: 600, visibleEndMs: 1000 };

    expect(followCursor(viewport, 950, 840)).toEqual(viewport);
    expect(followCursor(viewport, 840, 740)).toMatchObject({ visibleStartMs: 540, visibleEndMs: 940 });
  });
});
