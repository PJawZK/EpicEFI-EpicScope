import type { LogTimeRange } from '../log-model/log-types';
import type { TimelineViewport } from './viewport-state';

export interface ExtendLiveViewportOptions {
  readonly followLatest: boolean;
  readonly followWindowMs?: number;
}

export function extendLiveViewport(
  current: TimelineViewport | undefined,
  nextRange: LogTimeRange,
  options: ExtendLiveViewportOptions,
): TimelineViewport {
  const fullStartMs = Math.min(nextRange.startMs, nextRange.endMs);
  const fullEndMs = Math.max(nextRange.startMs, nextRange.endMs);
  const fullSpan = Math.max(0, fullEndMs - fullStartMs);

  if (options.followLatest || !current) {
    const requestedWindow = Math.max(1, options.followWindowMs ?? 10_000);
    const visibleSpan = Math.min(requestedWindow, fullSpan);
    return {
      fullStartMs,
      fullEndMs,
      visibleStartMs: Math.max(fullStartMs, fullEndMs - visibleSpan),
      visibleEndMs: fullEndMs,
    };
  }

  const currentSpan = Math.max(0, current.visibleEndMs - current.visibleStartMs);
  let visibleStartMs = Math.max(fullStartMs, Math.min(current.visibleStartMs, fullEndMs));
  let visibleEndMs = Math.max(visibleStartMs, Math.min(current.visibleEndMs, fullEndMs));

  if (visibleEndMs - visibleStartMs < currentSpan && fullSpan >= currentSpan) {
    visibleEndMs = Math.min(fullEndMs, visibleStartMs + currentSpan);
    visibleStartMs = Math.max(fullStartMs, visibleEndMs - currentSpan);
  }

  return { fullStartMs, fullEndMs, visibleStartMs, visibleEndMs };
}
