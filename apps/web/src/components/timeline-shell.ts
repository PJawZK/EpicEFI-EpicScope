import type { LogMarker, LogTimeRange, NumericChannelRange } from '../../../../core/log-model/log-types';
import type { TimelineViewport, TimelineViewportEdge } from '../../../../core/timeline/viewport-state';
import { buildViewportEnvelope } from '../../../../core/timeline/viewport-series';

export type TimelineViewportIntent =
  | { readonly type: 'fit' }
  | { readonly type: 'zoom'; readonly factor: number; readonly anchorMs: number; readonly centerCursor?: boolean }
  | { readonly type: 'pan'; readonly deltaMs: number; readonly centerCursor?: boolean }
  | { readonly type: 'resize'; readonly edge: TimelineViewportEdge; readonly edgeTimeMs: number; readonly centerCursor?: boolean };

export interface TimelineOverviewTrace {
  readonly channelId: string;
  readonly channelName: string;
  readonly range: NumericChannelRange;
  readonly color: string;
}

export interface TimelineShellController {
  readonly element: HTMLElement;
  setExpanded(expanded: boolean): void;
  isExpanded(): boolean;
  setTimeRange(timeRange: LogTimeRange | undefined, recordCount: number): void;
  setOverviewContent(traces: readonly TimelineOverviewTrace[], markers: readonly LogMarker[]): void;
  refreshOverview(): void;
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
  let overviewTraces: readonly TimelineOverviewTrace[] = [];
  let overviewMarkers: readonly LogMarker[] = [];
  let cursorListener: ((timeMs: number) => void) | undefined;
  let viewportListener: ((intent: TimelineViewportIntent) => void) | undefined;

  const timeline = document.createElement('section');
  timeline.className = 'timeline-shell';
  timeline.setAttribute('aria-label', 'Timeline');

  timeline.innerHTML = `
    <div class="timeline-overview">
      <canvas class="timeline-overview-canvas" aria-hidden="true"></canvas>
      <div class="timeline-overview-empty">Timeline overview becomes available after a log is loaded.</div>
      <div class="timeline-focus-placeholder" title="Drag visible window to pan">
        <span class="timeline-focus-handle timeline-focus-handle--start" data-focus-edge="start" title="Drag to resize visible range"></span>
        <span class="timeline-focus-handle timeline-focus-handle--end" data-focus-edge="end" title="Drag to resize visible range"></span>
      </div>
      <span class="timeline-overview-cursor" title="Drag timeline cursor" hidden></span>
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
      <div class="timeline-marker-actions" aria-label="Source marker navigation">
        <button type="button" data-marker-action="previous" disabled title="Previous source marker">◀ M</button>
        <button type="button" data-marker-action="next" disabled title="Next source marker">M ▶</button>
      </div>
      <div class="timeline-zoom-actions">
        <button type="button" data-viewport-action="fit" disabled>Fit</button>
        <button type="button" data-viewport-action="zoom-in" disabled title="Zoom in">＋</button>
        <button type="button" data-viewport-action="zoom-out" disabled title="Zoom out">−</button>
      </div>
    </div>
    <div class="timeline-meta">
      <span>Cursor <strong class="timeline-cursor-value">00:00.000</strong></span>
      <span>Visible range <strong class="timeline-visible-range">—</strong></span>
      <span>Marker <strong class="timeline-marker-value">—</strong></span>
      <span>A/B <strong>—</strong></span>
      <span class="grow"></span>
      <button type="button" disabled>Save Range</button>
      <button type="button" disabled>＋ Marker</button>
      <button type="button" disabled>Set A</button>
      <button type="button" disabled>Set B</button>
    </div>
  `;

  const overview = timeline.querySelector<HTMLElement>('.timeline-overview');
  const overviewCanvas = timeline.querySelector<HTMLCanvasElement>('.timeline-overview-canvas');
  const overviewText = timeline.querySelector<HTMLElement>('.timeline-overview-empty');
  const focusWindow = timeline.querySelector<HTMLElement>('.timeline-focus-placeholder');
  const focusStartHandle = timeline.querySelector<HTMLElement>('.timeline-focus-handle--start');
  const focusEndHandle = timeline.querySelector<HTMLElement>('.timeline-focus-handle--end');
  const overviewCursor = timeline.querySelector<HTMLElement>('.timeline-overview-cursor');
  const timelineTime = timeline.querySelector<HTMLElement>('.timeline-time');
  const cursorText = timeline.querySelector<HTMLElement>('.timeline-cursor-value');
  const visibleRangeText = timeline.querySelector<HTMLElement>('.timeline-visible-range');
  const markerText = timeline.querySelector<HTMLElement>('.timeline-marker-value');
  const progress = timeline.querySelector<HTMLElement>('.timeline-progress');
  const progressFill = progress?.querySelector<HTMLElement>('span');
  const transportButtons = [...timeline.querySelectorAll<HTMLButtonElement>('.transport button')];
  const markerButtons = [...timeline.querySelectorAll<HTMLButtonElement>('[data-marker-action]')];
  const viewportButtons = [...timeline.querySelectorAll<HTMLButtonElement>('[data-viewport-action]')];
  if (!overview || !overviewCanvas || !overviewText || !focusWindow || !focusStartHandle || !focusEndHandle || !overviewCursor || !timelineTime || !cursorText || !visibleRangeText || !markerText || !progress || !progressFill) {
    throw new Error('Timeline shell structure is incomplete.');
  }

  const renderOverview = (): void => {
    const rect = overview.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));
    if (overviewCanvas.width !== pixelWidth || overviewCanvas.height !== pixelHeight) {
      overviewCanvas.width = pixelWidth;
      overviewCanvas.height = pixelHeight;
    }

    const context = overviewCanvas.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const duration = Math.max(0, fullEndMs - fullStartMs);
    if (duration <= 0) return;

    context.save();
    context.lineWidth = 1;
    context.strokeStyle = 'rgba(240, 180, 77, 0.58)';
    for (const marker of overviewMarkers) {
      if (marker.timeMs < fullStartMs || marker.timeMs > fullEndMs) continue;
      const x = ((marker.timeMs - fullStartMs) / duration) * width;
      context.beginPath();
      context.moveTo(x + 0.5, 0);
      context.lineTo(x + 0.5, height);
      context.stroke();
    }
    context.restore();

    const envelopeWidth = Math.max(1, width);
    for (const trace of overviewTraces) {
      const envelope = buildViewportEnvelope(trace.range, fullStartMs, fullEndMs, envelopeWidth);
      if (envelope.validSampleCount === 0 || envelope.columns.length === 0) continue;

      const valueSpan = Math.max(1e-12, envelope.valueMax - envelope.valueMin);
      const yFor = (value: number): number => {
        const normalized = (value - envelope.valueMin) / valueSpan;
        return height - 2 - normalized * Math.max(1, height - 4);
      };

      context.save();
      context.strokeStyle = trace.color;
      context.globalAlpha = overviewTraces.length > 4 ? 0.48 : 0.68;
      context.lineWidth = 1;
      for (const column of envelope.columns) {
        const x = column.x + 0.5;
        context.beginPath();
        context.moveTo(x, yFor(column.min));
        context.lineTo(x, yFor(column.max));
        context.stroke();
      }

      context.globalAlpha = overviewTraces.length > 4 ? 0.68 : 0.88;
      context.beginPath();
      let started = false;
      for (const column of envelope.columns) {
        const x = column.x + 0.5;
        const y = yFor(column.last);
        if (!started) {
          context.moveTo(x, y);
          started = true;
        } else {
          context.lineTo(x, y);
        }
      }
      if (started) context.stroke();
      context.restore();
    }
  };

  const updateOverviewMessage = (): void => {
    if (fullEndMs <= fullStartMs) {
      overviewText.hidden = false;
      return;
    }
    if (overviewTraces.length > 0) {
      overviewText.hidden = true;
      return;
    }
    overviewText.hidden = false;
    overviewText.textContent = overviewMarkers.length > 0
      ? `Select a channel to add trace context · ${overviewMarkers.length.toLocaleString()} source marker${overviewMarkers.length === 1 ? '' : 's'} shown.`
      : 'Select a channel to add a whole-log overview trace.';
  };

  const setOverviewContent = (
    traces: readonly TimelineOverviewTrace[],
    markers: readonly LogMarker[],
  ): void => {
    overviewTraces = traces;
    overviewMarkers = [...markers]
      .filter((marker) => Number.isFinite(marker.timeMs))
      .sort((left, right) => left.timeMs - right.timeMs);
    updateOverviewMessage();
    renderOverview();
    renderCursor();
  };

  const fullDuration = (): number => Math.max(0, fullEndMs - fullStartMs);
  const visibleSpan = (): number => viewport ? Math.max(0, viewport.visibleEndMs - viewport.visibleStartMs) : fullDuration();
  const viewportIsFull = (): boolean => {
    if (!viewport) return true;
    const duration = fullDuration();
    return duration <= 0 || visibleSpan() >= duration - 0.5;
  };

  const renderViewport = (): void => {
    const duration = fullDuration();
    if (!viewport || duration <= 0) {
      focusWindow.style.left = '0%';
      focusWindow.style.width = '100%';
      focusWindow.hidden = duration <= 0;
      focusWindow.classList.add('timeline-focus-placeholder--full');
      visibleRangeText.textContent = '—';
      return;
    }
    const left = ((viewport.visibleStartMs - fullStartMs) / duration) * 100;
    const width = ((viewport.visibleEndMs - viewport.visibleStartMs) / duration) * 100;
    focusWindow.hidden = false;
    focusWindow.style.left = `${Math.max(0, Math.min(100, left))}%`;
    focusWindow.style.width = `${Math.max(0.2, Math.min(100, width))}%`;
    focusWindow.classList.toggle('timeline-focus-placeholder--full', viewportIsFull());
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

    const markerToleranceMs = 0.5;
    const exactMarker = overviewMarkers.find(
      (marker) => Math.abs(marker.timeMs - cursorTimeMs) <= markerToleranceMs,
    );
    markerText.textContent = exactMarker?.label?.trim() || (exactMarker ? 'Source marker' : '—');
    markerText.title = exactMarker
      ? `${markerText.textContent} · ${formatDuration(exactMarker.timeMs - fullStartMs)}`
      : '';

    const hasPrevious = overviewMarkers.some(
      (marker) => marker.timeMs < cursorTimeMs - markerToleranceMs,
    );
    const hasNext = overviewMarkers.some(
      (marker) => marker.timeMs > cursorTimeMs + markerToleranceMs,
    );
    for (const button of markerButtons) {
      button.disabled = button.dataset.markerAction === 'previous' ? !hasPrevious : !hasNext;
    }
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
    overviewTraces = [];
    overviewMarkers = [];
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
    updateOverviewMessage();
    renderOverview();
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

  const beginCursorDrag = (event: PointerEvent, captureElement: HTMLElement, coordinateElement: HTMLElement): void => {
    if (fullDuration() <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    captureElement.setPointerCapture(event.pointerId);
    updateCursor(pointerToTime(event.clientX, coordinateElement));
    const move = (moveEvent: PointerEvent): void => updateCursor(pointerToTime(moveEvent.clientX, coordinateElement));
    const end = (endEvent: PointerEvent): void => {
      if (captureElement.hasPointerCapture(endEvent.pointerId)) captureElement.releasePointerCapture(endEvent.pointerId);
      captureElement.removeEventListener('pointermove', move);
      captureElement.removeEventListener('pointerup', end);
      captureElement.removeEventListener('pointercancel', end);
    };
    captureElement.addEventListener('pointermove', move);
    captureElement.addEventListener('pointerup', end);
    captureElement.addEventListener('pointercancel', end);
  };

  const beginViewportDrag = (event: PointerEvent): void => {
    if (!viewport || fullDuration() <= 0) return;
    if (viewportIsFull()) {
      beginCursorDrag(event, overview, overview);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    focusWindow.setPointerCapture(event.pointerId);
    viewportListener?.({ type: 'pan', deltaMs: 0, centerCursor: true });
    let lastX = event.clientX;
    const move = (moveEvent: PointerEvent): void => {
      const rect = overview.getBoundingClientRect();
      if (rect.width <= 0) return;
      const deltaX = moveEvent.clientX - lastX;
      lastX = moveEvent.clientX;
      viewportListener?.({ type: 'pan', deltaMs: (deltaX / rect.width) * fullDuration(), centerCursor: true });
    };
    const end = (endEvent: PointerEvent): void => {
      if (focusWindow.hasPointerCapture(endEvent.pointerId)) focusWindow.releasePointerCapture(endEvent.pointerId);
      focusWindow.removeEventListener('pointermove', move);
      focusWindow.removeEventListener('pointerup', end);
      focusWindow.removeEventListener('pointercancel', end);
    };
    focusWindow.addEventListener('pointermove', move);
    focusWindow.addEventListener('pointerup', end);
    focusWindow.addEventListener('pointercancel', end);
  };

  const beginHandleDrag = (event: PointerEvent, edge: TimelineViewportEdge, handle: HTMLElement): void => {
    if (!viewport || fullDuration() <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    handle.setPointerCapture(event.pointerId);
    const update = (clientX: number): void => {
      viewportListener?.({
        type: 'resize',
        edge,
        edgeTimeMs: pointerToTime(clientX, overview),
        centerCursor: true,
      });
    };
    update(event.clientX);
    const move = (moveEvent: PointerEvent): void => update(moveEvent.clientX);
    const end = (endEvent: PointerEvent): void => {
      if (handle.hasPointerCapture(endEvent.pointerId)) handle.releasePointerCapture(endEvent.pointerId);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  };

  progress.addEventListener('pointerdown', (event) => beginCursorDrag(event, progress, progress));
  overview.addEventListener('pointerdown', (event) => beginCursorDrag(event, overview, overview));
  overviewCursor.addEventListener('pointerdown', (event) => beginCursorDrag(event, overviewCursor, overview));
  focusWindow.addEventListener('pointerdown', beginViewportDrag);
  focusStartHandle.addEventListener('pointerdown', (event) => beginHandleDrag(event, 'start', focusStartHandle));
  focusEndHandle.addEventListener('pointerdown', (event) => beginHandleDrag(event, 'end', focusEndHandle));

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

  for (const button of markerButtons) {
    button.addEventListener('click', () => {
      const action = button.dataset.markerAction;
      if (action === 'previous' || action === 'next') navigateMarker(action);
    });
  }


  const navigateMarker = (direction: 'previous' | 'next'): void => {
    const toleranceMs = 0.5;
    const marker = direction === 'previous'
      ? [...overviewMarkers].reverse().find(
          (candidate) => candidate.timeMs < cursorTimeMs - toleranceMs,
        )
      : overviewMarkers.find(
          (candidate) => candidate.timeMs > cursorTimeMs + toleranceMs,
        );
    if (marker) updateCursor(marker.timeMs);
  };

  for (const button of viewportButtons) {
    button.addEventListener('click', () => {
      if (!viewport) return;
      const action = button.dataset.viewportAction;
      if (action === 'fit') viewportListener?.({ type: 'fit' });
      if (action === 'zoom-in') viewportListener?.({ type: 'zoom', factor: 0.5, anchorMs: cursorTimeMs, centerCursor: true });
      if (action === 'zoom-out') viewportListener?.({ type: 'zoom', factor: 2, anchorMs: cursorTimeMs, centerCursor: true });
    });
  }

  const overviewResizeObserver = new ResizeObserver(renderOverview);
  overviewResizeObserver.observe(overview);

  setExpanded(true);
  renderOverview();
  renderViewport();
  renderCursor();

  return {
    element: timeline,
    setExpanded,
    isExpanded: () => expanded,
    setTimeRange,
    setOverviewContent,
    refreshOverview: renderOverview,
    setViewport,
    setCursorTime: (timeMs) => updateCursor(timeMs, false),
    getCursorTime: () => cursorTimeMs,
    onCursorChange: (listener) => { cursorListener = listener; },
    onViewportIntent: (listener) => { viewportListener = listener; },
  };
}
