import { describe, expect, it } from 'vitest';
import {
  centerViewportOn,
  createFullViewport,
  fitViewport,
  followCursor,
  panViewport,
  resizeViewport,
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

  it('centers the visible window on the requested time while preserving span and bounds', () => {
    const viewport = { fullStartMs: 0, fullEndMs: 1000, visibleStartMs: 100, visibleEndMs: 500 };
    expect(centerViewportOn(viewport, 700)).toMatchObject({ visibleStartMs: 500, visibleEndMs: 900 });
    expect(centerViewportOn(viewport, 950)).toMatchObject({ visibleStartMs: 600, visibleEndMs: 1000 });
  });

  it('resizes either viewport edge while enforcing minimum span and full-log bounds', () => {
    const viewport = { fullStartMs: 0, fullEndMs: 1000, visibleStartMs: 200, visibleEndMs: 800 };
    expect(resizeViewport(viewport, 'start', 300)).toMatchObject({ visibleStartMs: 300, visibleEndMs: 800 });
    expect(resizeViewport(viewport, 'end', 650)).toMatchObject({ visibleStartMs: 200, visibleEndMs: 700 });
    expect(resizeViewport(viewport, 'start', 790, 100)).toMatchObject({ visibleStartMs: 700, visibleEndMs: 800 });
    expect(resizeViewport(viewport, 'end', 210, 100)).toMatchObject({ visibleStartMs: 200, visibleEndMs: 300 });
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

  it('enforces the 500 ms default minimum zoom span', () => {
    const full = createFullViewport(0, 5000);
    const zoomed = zoomViewport(full, 0.001, 2500);
    expect(viewportSpan(zoomed)).toBe(500);
  });
});
