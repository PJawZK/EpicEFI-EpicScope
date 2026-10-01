export interface TimelineViewport {
  readonly fullStartMs: number;
  readonly fullEndMs: number;
  readonly visibleStartMs: number;
  readonly visibleEndMs: number;
}

const DEFAULT_MIN_SPAN_MS = 100;

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite.`);
  return value;
}

export function viewportSpan(viewport: TimelineViewport): number {
  return Math.max(0, viewport.visibleEndMs - viewport.visibleStartMs);
}

export function fullViewportSpan(viewport: TimelineViewport): number {
  return Math.max(0, viewport.fullEndMs - viewport.fullStartMs);
}

export function createFullViewport(fullStartMs: number, fullEndMs: number): TimelineViewport {
  finite(fullStartMs, 'fullStartMs');
  finite(fullEndMs, 'fullEndMs');
  if (fullEndMs < fullStartMs) throw new RangeError('fullEndMs must be >= fullStartMs.');
  return { fullStartMs, fullEndMs, visibleStartMs: fullStartMs, visibleEndMs: fullEndMs };
}

function clampVisibleWindow(
  viewport: TimelineViewport,
  requestedStartMs: number,
  requestedEndMs: number,
  minSpanMs = DEFAULT_MIN_SPAN_MS,
): TimelineViewport {
  const fullSpan = fullViewportSpan(viewport);
  if (fullSpan <= 0) return createFullViewport(viewport.fullStartMs, viewport.fullEndMs);

  const minimumSpan = Math.min(fullSpan, Math.max(1, minSpanMs));
  let span = Math.max(minimumSpan, requestedEndMs - requestedStartMs);
  span = Math.min(fullSpan, span);

  let start = requestedStartMs;
  let end = start + span;
  if (start < viewport.fullStartMs) {
    start = viewport.fullStartMs;
    end = start + span;
  }
  if (end > viewport.fullEndMs) {
    end = viewport.fullEndMs;
    start = end - span;
  }

  return {
    fullStartMs: viewport.fullStartMs,
    fullEndMs: viewport.fullEndMs,
    visibleStartMs: start,
    visibleEndMs: end,
  };
}

export function fitViewport(viewport: TimelineViewport): TimelineViewport {
  return createFullViewport(viewport.fullStartMs, viewport.fullEndMs);
}

export function zoomViewport(
  viewport: TimelineViewport,
  factor: number,
  anchorMs: number,
  minSpanMs = DEFAULT_MIN_SPAN_MS,
): TimelineViewport {
  finite(factor, 'factor');
  finite(anchorMs, 'anchorMs');
  if (factor <= 0) throw new RangeError('factor must be > 0.');

  const currentSpan = viewportSpan(viewport);
  const fullSpan = fullViewportSpan(viewport);
  if (currentSpan <= 0 || fullSpan <= 0) return viewport;

  const anchor = Math.min(viewport.visibleEndMs, Math.max(viewport.visibleStartMs, anchorMs));
  const anchorRatio = (anchor - viewport.visibleStartMs) / currentSpan;
  const targetSpan = Math.min(fullSpan, Math.max(Math.min(fullSpan, minSpanMs), currentSpan * factor));
  const targetStart = anchor - targetSpan * anchorRatio;
  return clampVisibleWindow(viewport, targetStart, targetStart + targetSpan, minSpanMs);
}

export function panViewport(viewport: TimelineViewport, deltaMs: number): TimelineViewport {
  finite(deltaMs, 'deltaMs');
  const span = viewportSpan(viewport);
  if (span <= 0) return viewport;
  return clampVisibleWindow(viewport, viewport.visibleStartMs + deltaMs, viewport.visibleEndMs + deltaMs, span);
}

export function followCursor(
  viewport: TimelineViewport,
  previousCursorMs: number,
  nextCursorMs: number,
): TimelineViewport {
  const span = viewportSpan(viewport);
  const fullSpan = fullViewportSpan(viewport);
  if (span <= 0 || span >= fullSpan) return viewport;

  const midpoint = viewport.visibleStartMs + span / 2;
  const movingForward = nextCursorMs > previousCursorMs;
  const movingBackward = nextCursorMs < previousCursorMs;

  if ((movingForward && nextCursorMs > midpoint) || (movingBackward && nextCursorMs < midpoint)) {
    return clampVisibleWindow(viewport, nextCursorMs - span / 2, nextCursorMs + span / 2, span);
  }
  if (nextCursorMs < viewport.visibleStartMs || nextCursorMs > viewport.visibleEndMs) {
    return clampVisibleWindow(viewport, nextCursorMs - span / 2, nextCursorMs + span / 2, span);
  }
  return viewport;
}

export function viewportEquals(left: TimelineViewport, right: TimelineViewport): boolean {
  return left.fullStartMs === right.fullStartMs
    && left.fullEndMs === right.fullEndMs
    && left.visibleStartMs === right.visibleStartMs
    && left.visibleEndMs === right.visibleEndMs;
}
