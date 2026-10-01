export interface TimelineShellController {
  readonly element: HTMLElement;
  setExpanded(expanded: boolean): void;
  isExpanded(): boolean;
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

  const setExpanded = (next: boolean): void => {
    expanded = next;
    timeline.classList.toggle('timeline-shell--compact', !expanded);
    timeline.dataset.expanded = String(expanded);
  };

  setExpanded(true);

  return {
    element: timeline,
    setExpanded,
    isExpanded: () => expanded,
  };
}
