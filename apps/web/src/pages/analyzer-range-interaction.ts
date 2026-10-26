import type { LoggerAnalysisContext } from './logger-page';

/** Shared VE/Idle range gestures. Owns previews only; Logger owns accepted A/B. */
export function installAnalyzerRangeInteraction(options: {
  track: HTMLElement; band: HTMLElement; start: HTMLElement; end: HTMLElement; signal: AbortSignal;
  getState: () => { context: LoggerAnalysisContext; editing: boolean } | undefined;
  commit: (context: LoggerAnalysisContext, a: number, b: number) => void;
  render: () => void;
}) {
  type Gesture = { pointerId: number; context: LoggerAnalysisContext; origin: number; a: number; b: number; mode: 'new' | 'a' | 'b' | 'move' };
  let gesture: Gesture | undefined;
  const timeAt = (x: number): number | undefined => {
    const extent = options.getState()?.context.sourceTimeRange, rect = options.track.getBoundingClientRect();
    if (!extent || !Number.isFinite(extent.startMs) || !Number.isFinite(extent.endMs) || !(extent.endMs > extent.startMs) || rect.width <= 0) return undefined;
    return extent.startMs + Math.max(0, Math.min(1, (x - rect.left) / rect.width)) * (extent.endMs - extent.startMs);
  };
  const bounds = (g: Gesture, time: number): readonly [number, number] => {
    if (g.mode === 'a') return [time, g.b];
    if (g.mode === 'move') {
      const extent = g.context.sourceTimeRange!;
      const delta = Math.max(extent.startMs - g.a, Math.min(extent.endMs - g.b, time - g.origin));
      return [g.a + delta, g.b + delta];
    }
    return [g.a, time];
  };
  const cancel = () => {
    const old = gesture; gesture = undefined;
    if (!old) return;
    if (options.track.hasPointerCapture(old.pointerId)) options.track.releasePointerCapture(old.pointerId);
    options.render();
  };
  const commit = (context: LoggerAnalysisContext, a: number, b: number) => {
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === b || options.getState()?.context !== context) return;
    options.commit(context, Math.min(a, b), Math.max(a, b));
  };
  options.track.addEventListener('pointerdown', event => {
    const state = options.getState(), time = timeAt(event.clientX);
    if (!state?.context.setAnalysisRange || gesture || event.button !== 0 || time === undefined) return;
    event.preventDefault();
    const context = state.context;
    const hasRange = context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs;
    const handle = event.target === options.start ? 'a' : event.target === options.end ? 'b' : undefined;
    const mode = event.shiftKey || !state.editing ? 'new' : handle ?? (hasRange && event.target === options.band ? 'move' : 'new');
    gesture = { pointerId: event.pointerId, context, origin: time, mode,
      a: mode === 'new' ? time : mode === 'move' ? Math.min(context.aTimeMs!, context.bTimeMs!) : context.aTimeMs!,
      b: mode === 'new' ? time : mode === 'move' ? Math.max(context.aTimeMs!, context.bTimeMs!) : context.bTimeMs! };
    if (handle) (handle === 'a' ? options.start : options.end).focus({ preventScroll: true });
    options.track.setPointerCapture(event.pointerId);
  }, { signal: options.signal });
  options.track.addEventListener('pointermove', event => {
    const time = timeAt(event.clientX), extent = gesture?.context.sourceTimeRange;
    if (!gesture || event.pointerId !== gesture.pointerId || time === undefined || !extent) return;
    const [a, b] = bounds(gesture, time), span = extent.endMs - extent.startMs;
    options.band.hidden = false; options.band.style.left = `${(Math.min(a, b) - extent.startMs) / span * 100}%`; options.band.style.width = `${Math.abs(b - a) / span * 100}%`;
    for (const [node, value] of [[options.start, a], [options.end, b]] as const) { node.hidden = false; node.style.left = `${(value - extent.startMs) / span * 100}%`; }
  }, { signal: options.signal });
  options.track.addEventListener('pointerup', event => {
    const old = gesture, time = timeAt(event.clientX);
    if (!old || event.pointerId !== old.pointerId) return;
    const [a, b] = time === undefined ? [old.a, old.b] : bounds(old, time);
    cancel(); if (time !== undefined) commit(old.context, a, b);
  }, { signal: options.signal });
  for (const name of ['pointercancel', 'lostpointercapture'] as const) options.track.addEventListener(name, cancel, { signal: options.signal });
  options.track.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); cancel(); return; }
    const state = options.getState(), context = state?.context, extent = context?.sourceTimeRange;
    const handle = event.target === options.start ? 'a' : event.target === options.end ? 'b' : undefined;
    if (!context?.setAnalysisRange || !extent || !handle || context.aTimeMs === undefined || context.bTimeMs === undefined || options.track.getAttribute('aria-disabled') === 'true') return;
    const step = Math.max(1, (extent.endMs - extent.startMs) / (event.shiftKey ? 1000 : 100));
    const current = handle === 'a' ? context.aTimeMs : context.bTimeMs;
    const value = event.key === 'Home' ? extent.startMs : event.key === 'End' ? extent.endMs : event.key === 'ArrowLeft' ? current - step : event.key === 'ArrowRight' ? current + step : undefined;
    if (value === undefined) return;
    event.preventDefault(); cancel();
    const bounded = Math.max(extent.startMs, Math.min(extent.endMs, value));
    commit(context, handle === 'a' ? bounded : context.aTimeMs, handle === 'b' ? bounded : context.bTimeMs);
  }, { signal: options.signal });
  return { cancel, contextChanged(context: LoggerAnalysisContext) { if (gesture && gesture.context !== context) cancel(); } };
}
