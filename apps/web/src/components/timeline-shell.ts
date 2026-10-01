export interface TimelineShellController {
  readonly element: HTMLElement;
  setExpanded(expanded: boolean): void;
  isExpanded(): boolean;
  setDuration(durationMs: number | undefined, recordCount: number): void;
  setCursorTime(timeMs: number): void;
  getCursorTime(): number;
  onCursorChange(listener: (timeMs: number) => void): void;
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
  let durationMs = 0;
  let cursorTimeMs = 0;
  let cursorListener: ((timeMs: number) => void) | undefined;

  const timeline = document.createElement('section');
  timeline.className = 'timeline-shell';
  timeline.setAttribute('aria-label', 'Timeline');

  timeline.innerHTML = `
    <div class="timeline-overview">
      <div class="timeline-overview-empty">Timeline overview becomes available after a log is loaded.</div>
      <div class="timeline-focus-placeholder"></div>
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
        <button type="button" disabled>Fit</button>
        <button type="button" disabled>＋</button>
        <button type="button" disabled>−</button>
      </div>
    </div>
    <div class="timeline-meta">
      <span>Cursor <strong>00:00.000</strong></span>
      <span>Visible range <strong>—</strong></span>
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
  const overviewCursor = timeline.querySelector<HTMLElement>('.timeline-overview-cursor');
  const timelineTime = timeline.querySelector<HTMLElement>('.timeline-time');
  const cursorText = timeline.querySelector<HTMLElement>('.timeline-meta strong');
  const progress = timeline.querySelector<HTMLElement>('.timeline-progress');
  const progressFill = progress?.querySelector<HTMLElement>('span');
  const transportButtons = [...timeline.querySelectorAll<HTMLButtonElement>('.transport button')];
  if (!overview || !overviewText || !overviewCursor || !timelineTime || !cursorText || !progress || !progressFill) {
    throw new Error('Timeline shell structure is incomplete.');
  }

  const renderCursor = (): void => {
    const ratio = durationMs > 0 ? Math.min(1, Math.max(0, cursorTimeMs / durationMs)) : 0;
    progressFill.style.width = `${ratio * 100}%`;
    overviewCursor.style.left = `${ratio * 100}%`;
    overviewCursor.hidden = durationMs <= 0;
    timelineTime.textContent = `${formatDuration(cursorTimeMs)} / ${formatDuration(durationMs)}`;
    cursorText.textContent = formatDuration(cursorTimeMs);
    progress.setAttribute('aria-valuemax', String(Math.round(durationMs)));
    progress.setAttribute('aria-valuenow', String(Math.round(cursorTimeMs)));
  };

  const updateCursor = (next: number, notify = true): void => {
    cursorTimeMs = Math.min(durationMs, Math.max(0, Number.isFinite(next) ? next : 0));
    renderCursor();
    if (notify) cursorListener?.(cursorTimeMs);
  };

  const setExpanded = (next: boolean): void => {
    expanded = next;
    timeline.classList.toggle('timeline-shell--compact', !expanded);
    timeline.dataset.expanded = String(expanded);
  };

  const setDuration = (nextDurationMs: number | undefined, recordCount: number): void => {
    durationMs = Math.max(0, nextDurationMs ?? 0);
    cursorTimeMs = 0;
    if (nextDurationMs === undefined) {
      overviewText.textContent = recordCount > 0
        ? `${recordCount.toLocaleString()} records indexed; duration unavailable.`
        : 'No logger records found in this log.';
    } else {
      overviewText.textContent = `${recordCount.toLocaleString()} records indexed · click or drag timeline to move cursor.`;
    }
    const enabled = durationMs > 0;
    for (const button of transportButtons) {
      const action = button.dataset.action;
      button.disabled = !enabled || action === 'play';
    }
    progress.tabIndex = enabled ? 0 : -1;
    renderCursor();
  };

  const pointerToTime = (clientX: number, element: HTMLElement): number => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * durationMs;
  };

  const beginDrag = (event: PointerEvent, element: HTMLElement): void => {
    if (durationMs <= 0) return;
    event.preventDefault();
    element.setPointerCapture(event.pointerId);
    updateCursor(pointerToTime(event.clientX, element));
    const move = (moveEvent: PointerEvent): void => {
      updateCursor(pointerToTime(moveEvent.clientX, element));
    };
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

  progress.addEventListener('pointerdown', (event) => beginDrag(event, progress));
  overview.addEventListener('pointerdown', (event) => beginDrag(event, overview));
  progress.addEventListener('keydown', (event) => {
    if (durationMs <= 0) return;
    const step = Math.max(1, durationMs / 100);
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      updateCursor(cursorTimeMs - step);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      updateCursor(cursorTimeMs + step);
    } else if (event.key === 'Home') {
      event.preventDefault();
      updateCursor(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      updateCursor(durationMs);
    }
  });

  for (const button of transportButtons) {
    button.addEventListener('click', () => {
      const step = Math.max(1, durationMs / 100);
      switch (button.dataset.action) {
        case 'start': updateCursor(0); break;
        case 'back': updateCursor(cursorTimeMs - step); break;
        case 'forward': updateCursor(cursorTimeMs + step); break;
        case 'end': updateCursor(durationMs); break;
      }
    });
  }

  setExpanded(true);
  renderCursor();

  return {
    element: timeline,
    setExpanded,
    isExpanded: () => expanded,
    setDuration,
    setCursorTime: (timeMs) => updateCursor(timeMs, false),
    getCursorTime: () => cursorTimeMs,
    onCursorChange: (listener) => { cursorListener = listener; },
  };
}
