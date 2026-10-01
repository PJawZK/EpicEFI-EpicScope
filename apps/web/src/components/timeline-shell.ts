export interface TimelineShellController {
  readonly element: HTMLElement;
  setExpanded(expanded: boolean): void;
  isExpanded(): boolean;
  setDuration(durationMs: number | undefined, recordCount: number): void;
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

  const timeline = document.createElement('section');
  timeline.className = 'timeline-shell';
  timeline.setAttribute('aria-label', 'Timeline');

  timeline.innerHTML = `
    <div class="timeline-overview" aria-hidden="true">
      <div class="timeline-overview-empty">Timeline overview becomes available after a log is loaded.</div>
      <div class="timeline-focus-placeholder"></div>
    </div>
    <div class="timeline-controls">
      <div class="transport" aria-label="Playback controls">
        <button type="button" disabled title="Start">|◀</button>
        <button type="button" disabled title="Back">◀</button>
        <button type="button" disabled title="Play / pause">▶</button>
        <button type="button" disabled title="Forward">▶</button>
        <button type="button" disabled title="End">▶|</button>
      </div>
      <span class="timeline-time">00:00.000 / 00:00.000</span>
      <div class="timeline-progress" aria-hidden="true"><span></span></div>
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

  const overviewText = timeline.querySelector<HTMLElement>('.timeline-overview-empty');
  const timelineTime = timeline.querySelector<HTMLElement>('.timeline-time');
  if (!overviewText || !timelineTime) {
    throw new Error('Timeline shell structure is incomplete.');
  }

  const setExpanded = (next: boolean): void => {
    expanded = next;
    timeline.classList.toggle('timeline-shell--compact', !expanded);
    timeline.dataset.expanded = String(expanded);
  };

  const setDuration = (durationMs: number | undefined, recordCount: number): void => {
    if (durationMs === undefined) {
      overviewText.textContent = recordCount > 0
        ? `${recordCount.toLocaleString()} records indexed; duration unavailable.`
        : 'No logger records found in this log.';
      timelineTime.textContent = '00:00.000 / 00:00.000';
      return;
    }
    overviewText.textContent = `${recordCount.toLocaleString()} records indexed · graph overview follows in TIMELINE.`;
    timelineTime.textContent = `00:00.000 / ${formatDuration(durationMs)}`;
  };

  setExpanded(true);

  return {
    element: timeline,
    setExpanded,
    isExpanded: () => expanded,
    setDuration,
  };
}
