import type { LogTimeRange } from '../../../../core/log-model/log-types';
import type { TimelineViewport } from '../../../../core/timeline/viewport-state';

export type TimelineViewportIntent =
  | { readonly type: 'fit' }
  | { readonly type: 'zoom'; readonly factor: number; readonly anchorMs: number }
  | { readonly type: 'pan'; readonly deltaMs: number };

export interface TimelineShellController {
  readonly element: HTMLElement;
  setExpanded(expanded: boolean): void;
  isExpanded(): boolean;
  setTimeRange(timeRange: LogTimeRange | undefined, recordCount: number): void;
  setViewport(viewport: TimelineViewport | undefined): void;
  setCursorTime(timeMs: number): void;
  getCursorTime(): number;
  onCursorChange(listener: (timeMs: number) => void): void;
  onViewportIntent(listener: (intent: TimelineViewportIntent) => void): void;
}

function formatDuration(durationMs: number): string {
  const safe = Math.max(0, durationMs);
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const milliseconds = Math.floor(safe % 1_000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

export function createTimelineShell(): TimelineShellController {
  let expanded = true;
  let fullStartMs = 0;
  let fullEndMs = 0;
  let cursorTimeMs = 0;
  let viewport: TimelineViewport | undefined;
  let cursorListener: ((timeMs: number) => void) | undefined;
  let viewportListener: ((intent: TimelineViewportIntent) => void) | undefined;

  const timeline = document.createElement('section');
  timeline.className = 'timeline-shell';
  timeline.setAttribute('aria-label', 'Timeline');

  timeline.innerHTML = `
    <div class="timeline-overview">
      <div class="timeline-overview-empty">Timeline overview becomes available after a log is loaded.</div>
      <div class="timeline-focus-placeholder" title="Drag visible window to pan"></div>
      <span class="timeline-overview-cursor" hidden></span>
    </div>
    <div class="timeline-controls">
      <div class="transport" aria-label="Playback controls">
        <button type="button" data-action="start" disabled title="Start">|◀</button>
        <button type="button" data-action="back" disabled title="Back">◀</button>
        <button type="button" data-action="play" disabled title="Play / pause">▶</button>
        <button type="button" data-action="forward" disabled title="Forward">▶</button>
        <button type="button" data-action="end" disabled title="End">▶|</button>
      </div>
      <span class="timeline-time">00:00.000 / 00:00.000</span>
      <div class="timeline-progress" role="slider" aria-label="Timeline cursor" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0" tabindex="0"><span></span></div>
      <div class="timeline-zoom-actions">
        <button type="button" data-viewport-action="fit" disabled>Fit</button>
        <button type="button" data-viewport-action="zoom-in" disabled title="Zoom in">＋</button>
        <button type="button" data-viewport-action="zoom-out" disabled title="Zoom out">−</button>
      </div>
    </div>
    <div class="timeline-meta">
      <span>Cursor <strong class="timeline-cursor-value">00:00.000</strong></span>
      <span>Visible range <strong class="timeline-visible-range">—</strong></span>
      <span>A/B <strong>—</strong></span>
      <span class="grow"></span>
      <button type="button" disabled>Save Range</button>
      <button type="button" disabled>＋ Marker</button>
      <button type="button" disabled>Set A</button>
      <button type="button" disabled>Set B</button>
    </div>
  `;

  const overview = timeline.querySelector<HTMLElement>('.timeline-overview');
  const overviewText = timeline.querySelector<HTMLElement>('.timeline-overview-empty');
  const focusWindow = timeline.querySelector<HTMLElement>('.timeline-focus-placeholder');
  const overviewCursor = timeline.querySelector<HTMLElement>('.timeline-overview-cursor');
  const timelineTime = timeline.querySelector<HTMLElement>('.timeline-time');
  const cursorText = timeline.querySelector<HTMLElement>('.timeline-cursor-value');
  const visibleRangeText = timeline.querySelector<HTMLElement>('.timeline-visible-range');
  const progress = timeline.querySelector<HTMLElement>('.timeline-progress');
  const progressFill = progress?.querySelector<HTMLElement>('span');
  const transportButtons = [...timeline.querySelectorAll<HTMLButtonElement>('.transport button')];
  const viewportButtons = [...timeline.querySelectorAll<HTMLButtonElement>('[data-viewport-action]')];
  if (!overview || !overviewText || !focusWindow || !overviewCursor || !timelineTime || !cursorText || !visibleRangeText || !progress || !progressFill) {
    throw new Error('Timeline shell structure is incomplete.');
  }

  const fullDuration = (): number => Math.max(0, fullEndMs - fullStartMs);
  const visibleSpan = (): number => viewport ? Math.max(0, viewport.visibleEndMs - viewport.visibleStartMs) : fullDuration();

  const renderViewport = (): void => {
    const duration = fullDuration();
    if (!viewport || duration <= 0) {
      focusWindow.style.left = '0%';
      focusWindow.style.width = '100%';
      focusWindow.hidden = duration <= 0;
      visibleRangeText.textContent = '—';
      return;
    }
    const left = ((viewport.visibleStartMs - fullStartMs) / duration) * 100;
    const width = ((viewport.visibleEndMs - viewport.visibleStartMs) / duration) * 100;
    focusWindow.hidden = false;
    focusWindow.style.left = `${Math.max(0, Math.min(100, left))}%`;
    focusWindow.style.width = `${Math.max(0.2, Math.min(100, width))}%`;
    visibleRangeText.textContent = `${formatDuration(viewport.visibleStartMs - fullStartMs)}–${formatDuration(viewport.visibleEndMs - fullStartMs)}`;
  };

  const renderCursor = (): void => {
    const duration = fullDuration();
    const elapsed = Math.max(0, cursorTimeMs - fullStartMs);
    const ratio = duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 0;
    progressFill.style.width = `${ratio * 100}%`;
    overviewCursor.style.left = `${ratio * 100}%`;
    overviewCursor.hidden = duration <= 0;
    timelineTime.textContent = `${formatDuration(elapsed)} / ${formatDuration(duration)}`;
    cursorText.textContent = formatDuration(elapsed);
    progress.setAttribute('aria-valuemax', String(Math.round(duration)));
    progress.setAttribute('aria-valuenow', String(Math.round(elapsed)));
  };

  const updateCursor = (next: number, notify = true): void => {
    cursorTimeMs = Math.min(fullEndMs, Math.max(fullStartMs, Number.isFinite(next) ? next : fullStartMs));
    renderCursor();
    if (notify) cursorListener?.(cursorTimeMs);
  };

  const setExpanded = (next: boolean): void => {
    expanded = next;
    timeline.classList.toggle('timeline-shell--compact', !expanded);
    timeline.dataset.expanded = String(expanded);
  };

  const setTimeRange = (nextRange: LogTimeRange | undefined, recordCount: number): void => {
    fullStartMs = nextRange?.startMs ?? 0;
    fullEndMs = nextRange?.endMs ?? 0;
    cursorTimeMs = fullStartMs;
    viewport = nextRange
      ? { fullStartMs, fullEndMs, visibleStartMs: fullStartMs, visibleEndMs: fullEndMs }
      : undefined;

    if (!nextRange) {
      overviewText.textContent = recordCount > 0
        ? `${recordCount.toLocaleString()} records indexed; duration unavailable.`
        : 'No logger records found in this log.';
    } else {
      overviewText.textContent = `${recordCount.toLocaleString()} records indexed · focus window shows the graph viewport.`;
    }

    const enabled = fullDuration() > 0;
    for (const button of transportButtons) {
      const action = button.dataset.action;
      button.disabled = !enabled || action === 'play';
    }
    for (const button of viewportButtons) button.disabled = !enabled;
    progress.tabIndex = enabled ? 0 : -1;
    renderViewport();
    renderCursor();
  };

  const setViewport = (nextViewport: TimelineViewport | undefined): void => {
    viewport = nextViewport;
    renderViewport();
  };

  const pointerToTime = (clientX: number, element: HTMLElement): number => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0) return fullStartMs;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return fullStartMs + ratio * fullDuration();
  };

  const beginCursorDrag = (event: PointerEvent, element: HTMLElement): void => {
    if (fullDuration() <= 0) return;
    event.preventDefault();
    element.setPointerCapture(event.pointerId);
    updateCursor(pointerToTime(event.clientX, element));
    const move = (moveEvent: PointerEvent): void => updateCursor(pointerToTime(moveEvent.clientX, element));
    const end = (endEvent: PointerEvent): void => {
      if (element.hasPointerCapture(endEvent.pointerId)) element.releasePointerCapture(endEvent.pointerId);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', end);
      element.removeEventListener('pointercancel', end);
    };
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', end);
    element.addEventListener('pointercancel', end);
  };

  const beginViewportDrag = (event: PointerEvent): void => {
    if (!viewport || fullDuration() <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    focusWindow.setPointerCapture(event.pointerId);
    let lastX = event.clientX;
    let moved = false;
    const move = (moveEvent: PointerEvent): void => {
      const rect = overview.getBoundingClientRect();
      if (rect.width <= 0) return;
      const deltaX = moveEvent.clientX - lastX;
      lastX = moveEvent.clientX;
      if (Math.abs(deltaX) > 0.25) moved = true;
      viewportListener?.({ type: 'pan', deltaMs: (deltaX / rect.width) * fullDuration() });
    };
    const end = (endEvent: PointerEvent): void => {
      if (focusWindow.hasPointerCapture(endEvent.pointerId)) focusWindow.releasePointerCapture(endEvent.pointerId);
      focusWindow.removeEventListener('pointermove', move);
      focusWindow.removeEventListener('pointerup', end);
      focusWindow.removeEventListener('pointercancel', end);
      if (!moved) updateCursor(pointerToTime(endEvent.clientX, overview));
    };
    focusWindow.addEventListener('pointermove', move);
    focusWindow.addEventListener('pointerup', end);
    focusWindow.addEventListener('pointercancel', end);
  };

  progress.addEventListener('pointerdown', (event) => beginCursorDrag(event, progress));
  overview.addEventListener('pointerdown', (event) => beginCursorDrag(event, overview));
  focusWindow.addEventListener('pointerdown', beginViewportDrag);

  progress.addEventListener('keydown', (event) => {
    if (fullDuration() <= 0) return;
    const step = Math.max(1, visibleSpan() / 100);
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      updateCursor(cursorTimeMs - step);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      updateCursor(cursorTimeMs + step);
    } else if (event.key === 'Home') {
      event.preventDefault();
      updateCursor(fullStartMs);
    } else if (event.key === 'End') {
      event.preventDefault();
      updateCursor(fullEndMs);
    }
  });

  for (const button of transportButtons) {
    button.addEventListener('click', () => {
      const step = Math.max(1, visibleSpan() / 100);
      switch (button.dataset.action) {
        case 'start': updateCursor(fullStartMs); break;
        case 'back': updateCursor(cursorTimeMs - step); break;
        case 'forward': updateCursor(cursorTimeMs + step); break;
        case 'end': updateCursor(fullEndMs); break;
      }
    });
  }

  for (const button of viewportButtons) {
    button.addEventListener('click', () => {
      if (!viewport) return;
      const action = button.dataset.viewportAction;
      if (action === 'fit') viewportListener?.({ type: 'fit' });
      if (action === 'zoom-in') viewportListener?.({ type: 'zoom', factor: 0.5, anchorMs: cursorTimeMs });
      if (action === 'zoom-out') viewportListener?.({ type: 'zoom', factor: 2, anchorMs: cursorTimeMs });
    });
  }

  setExpanded(true);
  renderViewport();
  renderCursor();

  return {
    element: timeline,
    setExpanded,
    isExpanded: () => expanded,
    setTimeRange,
    setViewport,
    setCursorTime: (timeMs) => updateCursor(timeMs, false),
    getCursorTime: () => cursorTimeMs,
    onCursorChange: (listener) => { cursorListener = listener; },
    onViewportIntent: (listener) => { viewportListener = listener; },
  };
}
