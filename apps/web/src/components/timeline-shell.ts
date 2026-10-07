import type { LogMarker, LogTimeRange, NumericChannelRange } from '../../../../core/log-model/log-types';
import type { TimelineViewport, TimelineViewportEdge } from '../../../../core/timeline/viewport-state';
import { buildViewportEnvelope, buildViewportEnvelopeFromBlocks } from '../../../../core/timeline/viewport-series';
import type { TimelineWorkspaceState } from '../state/workspace-state';

export type TimelineViewportIntent =
  | { readonly type: 'fit' }
  | { readonly type: 'zoom'; readonly factor: number; readonly anchorMs: number; readonly centerCursor?: boolean }
  | { readonly type: 'pan'; readonly deltaMs: number; readonly centerCursor?: boolean }
  | { readonly type: 'resize'; readonly edge: TimelineViewportEdge; readonly edgeTimeMs: number; readonly centerCursor?: boolean }
  | { readonly type: 'range'; readonly startMs: number; readonly endMs: number; readonly centerCursor?: boolean }
  | { readonly type: 'history-back' }
  | { readonly type: 'history-forward' };

export interface TimelineOverviewTrace {
  readonly channelId: string;
  readonly channelName: string;
  readonly range: NumericChannelRange;
  readonly color: string;
}

export interface TimelineAnnotationState {
  readonly aTimeMs: number | undefined;
  readonly bTimeMs: number | undefined;
}

export interface TimelineShellController {
  readonly element: HTMLElement;
  setExpanded(expanded: boolean): void;
  isExpanded(): boolean;
  setPlaybackSpeed(speed: number): void;
  setOverviewTracesVisible(visible: boolean): void;
  setViewHistoryState(canBack: boolean, canForward: boolean): void;
  setTimeRange(timeRange: LogTimeRange | undefined, recordCount: number): void;
  extendTimeRange(timeRange: LogTimeRange | undefined, recordCount: number, markers: readonly LogMarker[]): void;
  setOverviewContent(traces: readonly TimelineOverviewTrace[], markers: readonly LogMarker[]): void;
  refreshOverview(): void;
  refreshValidity(): void;
  setViewport(viewport: TimelineViewport | undefined): void;
  setCursorTime(timeMs: number): void;
  getCursorTime(): number;
  togglePlayback(): void;
  stepCursor(direction: -1 | 1): void;
  addUserMarker(): void;
  setAnalysisBoundary(boundary: 'a' | 'b'): void;
  navigateMarker(direction: 'previous' | 'next'): void;
  onCursorChange(listener: (timeMs: number) => void): void;
  onViewportIntent(listener: (intent: TimelineViewportIntent) => void): void;
  onAnnotationChange(listener: (state: TimelineAnnotationState) => void): void;
  onWorkspaceMutation(listener: () => void): void;
  getWorkspaceState(): TimelineWorkspaceState;
  restoreWorkspaceState(state: TimelineWorkspaceState): void;
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
  let sourceMarkers: readonly LogMarker[] = [];
  let userMarkers: LogMarker[] = [];
  let aTimeMs: number | undefined;
  let bTimeMs: number | undefined;
  let savedRanges: { readonly label: string; readonly startMs: number; readonly endMs: number }[] = [];
  let playbackFrame: number | undefined;
  let playbackLastNow: number | undefined;
  let playbackSpeed = 1;
  let overviewTracesVisible = true;
  let precomputedEnvelopeBlocksEnabled = true;
  let cursorListener: ((timeMs: number) => void) | undefined;
  let viewportListener: ((intent: TimelineViewportIntent) => void) | undefined;
  let annotationListener: ((state: TimelineAnnotationState) => void) | undefined;
  let workspaceMutationListener: (() => void) | undefined;
  let restoringWorkspace = false;

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
    <div class="timeline-controls" aria-label="Navigate">
      <span class="timeline-group-label">Navigate</span>
      <div class="transport" aria-label="Playback controls">
        <button type="button" data-action="start" disabled title="Start">|◀</button>
        <button type="button" data-action="back" disabled title="Back">◀</button>
        <button type="button" data-action="play" disabled title="Play / pause">▶</button>
        <button type="button" data-action="forward" disabled title="Forward">▶</button>
        <button type="button" data-action="end" disabled title="End">▶|</button>
      </div>
      <span class="timeline-time">00:00.000 / 00:00.000</span>
      <div class="timeline-progress" role="slider" aria-label="Timeline cursor" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0" tabindex="0"><span></span></div>
      <div class="timeline-zoom-actions" aria-label="Zoom controls">
        <button type="button" data-viewport-action="fit" disabled>Fit</button>
        <button type="button" data-viewport-action="zoom-in" disabled title="Zoom in">＋</button>
        <button type="button" data-viewport-action="zoom-out" disabled title="Zoom out">−</button>
      </div>
      <div class="timeline-history-actions" aria-label="View history">
        <button type="button" data-view-history="back" disabled title="Previous view">↶ View</button>
        <button type="button" data-view-history="forward" disabled title="Next view">View ↷</button>
      </div>
      <span class="timeline-navigate-status">Cursor <strong class="timeline-cursor-value">00:00.000</strong></span>
      <span class="timeline-navigate-status">Visible <strong class="timeline-visible-range">—</strong></span>
    </div>
    <div class="timeline-meta" aria-label="Range and markers">
      <span class="timeline-group-label">Range / Markers</span>
      <span>Marker <strong class="timeline-marker-value">—</strong></span>
      <div class="timeline-marker-actions" aria-label="Marker navigation">
        <button type="button" data-marker-action="previous" disabled title="Previous marker">◀ M</button>
        <button type="button" data-marker-action="next" disabled title="Next marker">M ▶</button>
      </div>
      <span>A/B <strong class="timeline-ab-value">—</strong></span>
      <button type="button" class="timeline-set-a" disabled>Set A</button>
      <button type="button" class="timeline-set-b" disabled>Set B</button>
      <button type="button" class="timeline-save-range" disabled>Save Range</button>
      <select class="timeline-saved-ranges" aria-label="Saved ranges" hidden>
        <option value="">Saved ranges</option>
      </select>
      <button type="button" class="timeline-add-marker" disabled>＋ Marker</button>
      <span class="grow"></span>
      <span class="timeline-analysis-context">Analyze · set A and B</span>
      <details class="timeline-maintenance-menu">
        <summary title="More range and marker actions" aria-label="More range and marker actions">⋯</summary>
        <span class="timeline-maintenance-actions">
          <button type="button" class="timeline-rename-range" disabled title="Rename selected saved range">Rename Range</button>
          <button type="button" class="timeline-delete-range" disabled title="Delete selected saved range">Delete Range</button>
          <button type="button" class="timeline-edit-marker" disabled>Edit Marker</button>
          <button type="button" class="timeline-delete-marker" disabled>Delete Marker</button>
          <button type="button" class="timeline-clear-ab" disabled>Clear A/B</button>
        </span>
      </details>
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
  const abText = timeline.querySelector<HTMLElement>('.timeline-ab-value');
  const analysisContext = timeline.querySelector<HTMLElement>('.timeline-analysis-context');
  const savedRangeSelect = timeline.querySelector<HTMLSelectElement>('.timeline-saved-ranges');
  const saveRangeButton = timeline.querySelector<HTMLButtonElement>('.timeline-save-range');
  const renameRangeButton = timeline.querySelector<HTMLButtonElement>('.timeline-rename-range');
  const deleteRangeButton = timeline.querySelector<HTMLButtonElement>('.timeline-delete-range');
  const addMarkerButton = timeline.querySelector<HTMLButtonElement>('.timeline-add-marker');
  const editMarkerButton = timeline.querySelector<HTMLButtonElement>('.timeline-edit-marker');
  const deleteMarkerButton = timeline.querySelector<HTMLButtonElement>('.timeline-delete-marker');
  const setAButton = timeline.querySelector<HTMLButtonElement>('.timeline-set-a');
  const setBButton = timeline.querySelector<HTMLButtonElement>('.timeline-set-b');
  const clearAbButton = timeline.querySelector<HTMLButtonElement>('.timeline-clear-ab');
  const progress = timeline.querySelector<HTMLElement>('.timeline-progress');
  const progressFill = progress?.querySelector<HTMLElement>('span');
  const transportButtons = [...timeline.querySelectorAll<HTMLButtonElement>('.transport button')];
  const markerButtons = [...timeline.querySelectorAll<HTMLButtonElement>('[data-marker-action]')];
  const historyButtons = [...timeline.querySelectorAll<HTMLButtonElement>('[data-view-history]')];
  const viewportButtons = [...timeline.querySelectorAll<HTMLButtonElement>('[data-viewport-action]')];
  if (!overview || !overviewCanvas || !overviewText || !focusWindow || !focusStartHandle || !focusEndHandle || !overviewCursor || !timelineTime || !cursorText || !visibleRangeText || !markerText || !abText || !analysisContext || !savedRangeSelect || !saveRangeButton || !renameRangeButton || !deleteRangeButton || !addMarkerButton || !editMarkerButton || !deleteMarkerButton || !setAButton || !setBButton || !clearAbButton || !progress || !progressFill) {
    throw new Error('Timeline shell structure is incomplete.');
  }

  const emitAnnotationState = (): void => {
    annotationListener?.({ aTimeMs, bTimeMs });
  };

  const emitWorkspaceMutation = (): void => {
    if (!restoringWorkspace) workspaceMutationListener?.();
  };

  const currentUserMarkerIndex = (): number => userMarkers.findIndex(
    (marker) => Math.abs(marker.timeMs - cursorTimeMs) <= 0.5,
  );

  const allMarkers = (): readonly LogMarker[] => [...sourceMarkers, ...userMarkers]
    .filter((marker) => Number.isFinite(marker.timeMs))
    .sort((left, right) => left.timeMs - right.timeMs);

  const renderRangeState = (): void => {
    const a = aTimeMs === undefined ? '—' : formatDuration(aTimeMs - fullStartMs);
    const b = bTimeMs === undefined ? '—' : formatDuration(bTimeMs - fullStartMs);
    const delta = aTimeMs === undefined || bTimeMs === undefined
      ? ''
      : ` · Δ ${formatDuration(Math.abs(bTimeMs - aTimeMs))}`;
    abText.textContent = `A ${a} · B ${b}${delta}`;
    saveRangeButton.disabled = fullDuration() <= 0 || aTimeMs === undefined || bTimeMs === undefined || aTimeMs === bTimeMs;
    addMarkerButton.disabled = fullDuration() <= 0;
    setAButton.disabled = fullDuration() <= 0;
    setBButton.disabled = fullDuration() <= 0;
    clearAbButton.disabled = aTimeMs === undefined && bTimeMs === undefined;
    const analysisReady = aTimeMs !== undefined && bTimeMs !== undefined && aTimeMs !== bTimeMs;
    analysisContext.textContent = analysisReady ? 'Analyze · range ready' : 'Analyze · set A and B';
    analysisContext.classList.toggle('timeline-analysis-context--ready', analysisReady);
  };

  const refreshSavedRangeSelect = (): void => {
    savedRangeSelect.replaceChildren(new Option('Saved ranges', ''));
    savedRanges.forEach((range, index) => {
      savedRangeSelect.add(new Option(range.label, String(index)));
    });
    savedRangeSelect.hidden = savedRanges.length === 0;
    savedRangeSelect.value = '';
    renameRangeButton.disabled = true;
    deleteRangeButton.disabled = true;
  };

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

    if (aTimeMs !== undefined || bTimeMs !== undefined) {
      const xForTime = (timeMs: number): number => ((timeMs - fullStartMs) / duration) * width;
      if (aTimeMs !== undefined && bTimeMs !== undefined) {
        const start = Math.max(fullStartMs, Math.min(aTimeMs, bTimeMs));
        const end = Math.min(fullEndMs, Math.max(aTimeMs, bTimeMs));
        if (end >= start) {
          context.fillStyle = 'rgba(84, 148, 205, 0.12)';
          context.fillRect(xForTime(start), 0, Math.max(1, xForTime(end) - xForTime(start)), height);
        }
      }
      const drawBoundary = (timeMs: number, stroke: string): void => {
        if (timeMs < fullStartMs || timeMs > fullEndMs) return;
        const x = xForTime(timeMs);
        context.strokeStyle = stroke;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x + 0.5, 0);
        context.lineTo(x + 0.5, height);
        context.stroke();
      };
      if (aTimeMs !== undefined) drawBoundary(aTimeMs, 'rgba(83, 181, 255, 0.95)');
      if (bTimeMs !== undefined) drawBoundary(bTimeMs, 'rgba(255, 184, 77, 0.95)');
    }

    context.save();
    context.lineWidth = 1;
    context.strokeStyle = 'rgba(240, 180, 77, 0.58)';
    for (const marker of sourceMarkers) {
      if (marker.timeMs < fullStartMs || marker.timeMs > fullEndMs) continue;
      const x = ((marker.timeMs - fullStartMs) / duration) * width;
      context.beginPath();
      context.moveTo(x + 0.5, 0);
      context.lineTo(x + 0.5, height);
      context.stroke();
    }
    context.strokeStyle = 'rgba(66, 165, 245, 0.92)';
    context.lineWidth = 1.5;
    for (const marker of userMarkers) {
      if (marker.timeMs < fullStartMs || marker.timeMs > fullEndMs) continue;
      const x = ((marker.timeMs - fullStartMs) / duration) * width;
      context.beginPath();
      context.moveTo(x + 0.5, 0);
      context.lineTo(x + 0.5, height);
      context.stroke();
    }
    context.restore();

    const envelopeWidth = Math.max(1, width);
    if (!overviewTracesVisible) return;
    for (const trace of overviewTraces) {
      const envelope = precomputedEnvelopeBlocksEnabled && trace.range.fullEnvelopeBlocks
        ? buildViewportEnvelopeFromBlocks(
            trace.range,
            trace.range.fullEnvelopeBlocks,
            fullStartMs,
            fullEndMs,
            envelopeWidth,
          )
        : buildViewportEnvelope(trace.range, fullStartMs, fullEndMs, envelopeWidth);
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

      // A sparse/conditional channel may contribute only one identical value
      // to an isolated horizontal bucket. A zero-length min/max stroke is
      // invisible, so show that real recorded bucket as a tiny point instead
      // of fabricating continuity across missing data.
      context.fillStyle = trace.color;
      for (let index = 0; index < envelope.columns.length; index += 1) {
        const column = envelope.columns[index];
        if (!column) continue;
        const previous = envelope.columns[index - 1];
        const next = envelope.columns[index + 1];
        const isolated = (previous ? column.x - previous.x : Number.POSITIVE_INFINITY) > 2
          && (next ? next.x - column.x : Number.POSITIVE_INFINITY) > 2;
        if (!isolated || column.first !== column.last || column.min !== column.max) continue;
        context.fillRect(column.x - 0.5, yFor(column.first) - 0.5, 1.5, 1.5);
      }
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
    overviewText.textContent = allMarkers().length > 0
      ? `Select a channel to add trace context · ${allMarkers().length.toLocaleString()} source marker${allMarkers().length === 1 ? '' : 's'} shown.`
      : 'Select a channel to add a whole-log overview trace.';
  };

  const setOverviewContent = (
    traces: readonly TimelineOverviewTrace[],
    markers: readonly LogMarker[],
  ): void => {
    overviewTraces = traces;
    sourceMarkers = [...markers]
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
    const markers = allMarkers();
    const exactMarker = markers.find(
      (marker) => Math.abs(marker.timeMs - cursorTimeMs) <= markerToleranceMs,
    );
    markerText.textContent = exactMarker?.label?.trim() || (exactMarker ? 'Source marker' : '—');
    markerText.title = exactMarker
      ? `${markerText.textContent} · ${formatDuration(exactMarker.timeMs - fullStartMs)}`
      : '';

    const userMarkerIndex = currentUserMarkerIndex();
    editMarkerButton.disabled = userMarkerIndex < 0;
    deleteMarkerButton.disabled = userMarkerIndex < 0;

    const hasPrevious = markers.some(
      (marker) => marker.timeMs < cursorTimeMs - markerToleranceMs,
    );
    const hasNext = markers.some(
      (marker) => marker.timeMs > cursorTimeMs + markerToleranceMs,
    );
    for (const button of markerButtons) {
      button.disabled = button.dataset.markerAction === 'previous' ? !hasPrevious : !hasNext;
    }
    renderRangeState();
  };

  const updateCursor = (next: number, notify = true): void => {
    cursorTimeMs = Math.min(fullEndMs, Math.max(fullStartMs, Number.isFinite(next) ? next : fullStartMs));
    renderCursor();
    if (notify) cursorListener?.(cursorTimeMs);
  };

  const setExpanded = (next: boolean): void => {
    if (expanded === next) return;
    expanded = next;
    timeline.classList.toggle('timeline-shell--compact', !expanded);
    timeline.dataset.expanded = String(expanded);
  };

  const setTimeRange = (nextRange: LogTimeRange | undefined, recordCount: number): void => {
    precomputedEnvelopeBlocksEnabled = true;
    fullStartMs = nextRange?.startMs ?? 0;
    fullEndMs = nextRange?.endMs ?? 0;
    overviewTraces = [];
    sourceMarkers = [];
    userMarkers = [];
    aTimeMs = undefined;
    bTimeMs = undefined;
    savedRanges = [];
    emitAnnotationState();
    if (playbackFrame !== undefined) cancelAnimationFrame(playbackFrame);
    playbackFrame = undefined;
    playbackLastNow = undefined;
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
      button.disabled = !enabled;
      if (button.dataset.action === 'play') {
        button.textContent = '▶';
        button.title = 'Play';
      }
    }
    for (const button of viewportButtons) button.disabled = !enabled;
    progress.tabIndex = enabled ? 0 : -1;
    refreshSavedRangeSelect();
    renderRangeState();
    updateOverviewMessage();
    renderOverview();
    renderViewport();
    renderCursor();
  };

  const extendTimeRange = (nextRange: LogTimeRange | undefined, recordCount: number, markers: readonly LogMarker[]): void => {
    fullStartMs = nextRange?.startMs ?? fullStartMs;
    fullEndMs = nextRange?.endMs ?? fullEndMs;
    sourceMarkers = markers;
    cursorTimeMs = Math.min(fullEndMs, Math.max(fullStartMs, cursorTimeMs));
    overviewText.textContent = nextRange
      ? `${recordCount.toLocaleString()} live samples · focus window shows the graph viewport.`
      : `${recordCount.toLocaleString()} live samples; duration unavailable.`;
    const enabled = fullDuration() > 0;
    for (const button of transportButtons) button.disabled = !enabled;
    for (const button of viewportButtons) button.disabled = !enabled;
    progress.tabIndex = enabled ? 0 : -1;
    renderRangeState();
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

  const playButton = transportButtons.find((button) => button.dataset.action === 'play');

  const stopPlayback = (): void => {
    if (playbackFrame !== undefined) cancelAnimationFrame(playbackFrame);
    playbackFrame = undefined;
    playbackLastNow = undefined;
    if (playButton) {
      playButton.textContent = '▶';
      playButton.title = 'Play';
    }
  };

  const playbackTick = (now: number): void => {
    if (playbackFrame === undefined) return;
    const previous = playbackLastNow ?? now;
    playbackLastNow = now;
    const next = cursorTimeMs + Math.max(0, now - previous) * playbackSpeed;
    if (next >= fullEndMs) {
      updateCursor(fullEndMs);
      stopPlayback();
      return;
    }
    updateCursor(next);
    playbackFrame = requestAnimationFrame(playbackTick);
  };

  const togglePlayback = (): void => {
    if (fullDuration() <= 0) return;
    if (playbackFrame !== undefined) {
      stopPlayback();
      return;
    }
    if (cursorTimeMs >= fullEndMs) updateCursor(fullStartMs);
    playbackLastNow = undefined;
    playbackFrame = requestAnimationFrame(playbackTick);
    if (playButton) {
      playButton.textContent = '❚❚';
      playButton.title = 'Pause';
    }
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

  const stepCursor = (direction: -1 | 1): void => {
    if (fullDuration() <= 0) return;
    const step = Math.max(1, visibleSpan() / 100);
    updateCursor(cursorTimeMs + direction * step);
  };

  for (const button of transportButtons) {
    button.addEventListener('click', () => {
      switch (button.dataset.action) {
        case 'start': stopPlayback(); updateCursor(fullStartMs); break;
        case 'back': stepCursor(-1); break;
        case 'play': togglePlayback(); break;
        case 'forward': stepCursor(1); break;
        case 'end': stopPlayback(); updateCursor(fullEndMs); break;
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
    const markers = allMarkers();
    const marker = direction === 'previous'
      ? [...markers].reverse().find(
          (candidate) => candidate.timeMs < cursorTimeMs - toleranceMs,
        )
      : markers.find(
          (candidate) => candidate.timeMs > cursorTimeMs + toleranceMs,
        );
    if (marker) updateCursor(marker.timeMs);
  };

  const addUserMarker = (): void => {
    if (fullDuration() <= 0) return;
    const defaultLabel = `Marker ${userMarkers.length + 1}`;
    const entered = window.prompt('Marker label', defaultLabel);
    if (entered === null) return;
    const label = entered.trim() || defaultLabel;
    userMarkers.push({ timeMs: cursorTimeMs, label });
    userMarkers.sort((left, right) => left.timeMs - right.timeMs);
    renderOverview();
    renderCursor();
    emitWorkspaceMutation();
  };

  addMarkerButton.addEventListener('click', addUserMarker);

  editMarkerButton.addEventListener('click', () => {
    const index = currentUserMarkerIndex();
    if (index < 0) return;
    const marker = userMarkers[index];
    if (!marker) return;
    const entered = window.prompt('Marker label', marker.label ?? '');
    if (entered === null) return;
    const label = entered.trim() || `Marker ${index + 1}`;
    userMarkers[index] = { ...marker, label };
    renderOverview();
    renderCursor();
    emitWorkspaceMutation();
  });

  deleteMarkerButton.addEventListener('click', () => {
    const index = currentUserMarkerIndex();
    if (index < 0) return;
    userMarkers.splice(index, 1);
    renderOverview();
    renderCursor();
    emitWorkspaceMutation();
  });

  const setAnalysisBoundary = (boundary: 'a' | 'b'): void => {
    if (fullDuration() <= 0) return;
    if (boundary === 'a') aTimeMs = cursorTimeMs;
    else bTimeMs = cursorTimeMs;
    renderRangeState();
    renderOverview();
    emitAnnotationState();
    emitWorkspaceMutation();
  };

  setAButton.addEventListener('click', () => setAnalysisBoundary('a'));
  setBButton.addEventListener('click', () => setAnalysisBoundary('b'));

  saveRangeButton.addEventListener('click', () => {
    if (aTimeMs === undefined || bTimeMs === undefined || aTimeMs === bTimeMs) return;
    const startMs = Math.min(aTimeMs, bTimeMs);
    const endMs = Math.max(aTimeMs, bTimeMs);
    const defaultLabel = `Range ${savedRanges.length + 1}`;
    const entered = window.prompt('Saved range label', defaultLabel);
    if (entered === null) return;
    savedRanges.push({ label: entered.trim() || defaultLabel, startMs, endMs });
    refreshSavedRangeSelect();
    emitWorkspaceMutation();
  });

  renameRangeButton.addEventListener('click', () => {
    const index = Number(savedRangeSelect.value);
    const range = savedRanges[index];
    if (!range) return;
    const entered = window.prompt('Saved range label', range.label);
    if (entered === null) return;
    const label = entered.trim();
    if (!label) return;
    savedRanges[index] = { ...range, label };
    refreshSavedRangeSelect();
    savedRangeSelect.value = String(index);
    renameRangeButton.disabled = false;
    deleteRangeButton.disabled = false;
    emitWorkspaceMutation();
  });

  deleteRangeButton.addEventListener('click', () => {
    const index = Number(savedRangeSelect.value);
    if (!Number.isSafeInteger(index) || index < 0 || index >= savedRanges.length) return;
    savedRanges.splice(index, 1);
    refreshSavedRangeSelect();
    emitWorkspaceMutation();
  });

  clearAbButton.addEventListener('click', () => {
    aTimeMs = undefined;
    bTimeMs = undefined;
    renderRangeState();
    renderOverview();
    emitAnnotationState();
    emitWorkspaceMutation();
  });

  savedRangeSelect.addEventListener('change', () => {
    if (savedRangeSelect.value === '') return;
    const index = Number(savedRangeSelect.value);
    if (!Number.isSafeInteger(index) || index < 0 || index >= savedRanges.length) return;
    const range = savedRanges[index];
    if (!range) return;
    aTimeMs = range.startMs;
    bTimeMs = range.endMs;
    renameRangeButton.disabled = false;
    deleteRangeButton.disabled = false;
    renderRangeState();
    renderOverview();
    emitAnnotationState();
    viewportListener?.({ type: 'range', startMs: range.startMs, endMs: range.endMs, centerCursor: true });
    updateCursor((range.startMs + range.endMs) / 2);
  });

  for (const button of historyButtons) {
    button.addEventListener('click', () => {
      const action = button.dataset.viewHistory;
      if (action === 'back') viewportListener?.({ type: 'history-back' });
      if (action === 'forward') viewportListener?.({ type: 'history-forward' });
    });
  }

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

  const getWorkspaceState = (): TimelineWorkspaceState => ({
    expanded,
    userMarkers: userMarkers.map((marker) => ({ ...marker })),
    aTimeMs,
    bTimeMs,
    savedRanges: savedRanges.map((range) => ({ ...range })),
  });

  const restoreWorkspaceState = (state: TimelineWorkspaceState): void => {
    restoringWorkspace = true;
    try {
      expanded = state.expanded;
      timeline.classList.toggle('timeline-shell--compact', !expanded);
      userMarkers = state.userMarkers.map((marker) => ({ ...marker }));
      aTimeMs = state.aTimeMs;
      bTimeMs = state.bTimeMs;
      savedRanges = state.savedRanges.map((range) => ({ ...range }));
      refreshSavedRangeSelect();
      renderRangeState();
      renderCursor();
      renderOverview();
      emitAnnotationState();
    } finally {
      restoringWorkspace = false;
    }
  };

  return {
    element: timeline,
    setExpanded,
    setPlaybackSpeed: (speed) => {
      if (!Number.isFinite(speed) || speed <= 0) return;
      playbackSpeed = Math.min(8, Math.max(0.1, speed));
    },
    setOverviewTracesVisible: (visible) => {
      overviewTracesVisible = visible;
      renderOverview();
    },
    setViewHistoryState: (canBack, canForward) => {
      for (const button of historyButtons) {
        button.disabled = button.dataset.viewHistory === 'back' ? !canBack : !canForward;
      }
    },
    isExpanded: () => expanded,
    setTimeRange,
    extendTimeRange,
    setOverviewContent,
    refreshOverview: renderOverview,
    refreshValidity: () => {
      precomputedEnvelopeBlocksEnabled = false;
      renderOverview();
    },
    setViewport,
    setCursorTime: (timeMs) => updateCursor(timeMs, false),
    getCursorTime: () => cursorTimeMs,
    togglePlayback,
    stepCursor,
    addUserMarker,
    setAnalysisBoundary,
    navigateMarker,
    onCursorChange: (listener) => { cursorListener = listener; },
    onViewportIntent: (listener) => { viewportListener = listener; },
    onAnnotationChange: (listener) => { annotationListener = listener; },
    onWorkspaceMutation: (listener) => { workspaceMutationListener = listener; },
    getWorkspaceState,
    restoreWorkspaceState,
  };
}
