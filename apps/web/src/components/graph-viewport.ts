import type {
  ChannelDefinition,
  LogTimeRange,
  NumericChannelDataSource,
  NumericChannelRange,
} from '../../../../core/log-model/log-types';
import type { TimelineViewport } from '../../../../core/timeline/viewport-state';
import {
  buildViewportEnvelope,
  type ViewportEnvelopeColumn,
} from '../../../../core/timeline/viewport-series';

export interface GraphViewportController {
  readonly element: HTMLElement;
  setLog(
    channels: readonly ChannelDefinition[],
    channelData: NumericChannelDataSource,
    timeRange: LogTimeRange | undefined,
  ): void;
  selectChannel(channelId: string): Promise<void>;
  setCursorTime(timeMs: number): void;
  setViewport(viewport: TimelineViewport | undefined): void;
  onZoom(listener: (factor: number, anchorMs: number) => void): void;
  onPan(listener: (deltaMs: number) => void): void;
  clear(): void;
}

interface RawRepresentativePoint {
  readonly timeMs: number;
  readonly value: number;
}

function formatValue(value: number, precision = 2): string {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(Math.min(6, Math.max(0, precision)));
}

function rawRepresentativePoints(column: ViewportEnvelopeColumn): readonly RawRepresentativePoint[] {
  const candidates: RawRepresentativePoint[] = [
    { timeMs: column.firstTimeMs, value: column.first },
    { timeMs: column.minTimeMs, value: column.min },
    { timeMs: column.maxTimeMs, value: column.max },
    { timeMs: column.lastTimeMs, value: column.last },
  ];
  candidates.sort((left, right) => left.timeMs - right.timeMs);

  const result: RawRepresentativePoint[] = [];
  for (const candidate of candidates) {
    const previous = result[result.length - 1];
    if (previous && previous.timeMs === candidate.timeMs && previous.value === candidate.value) continue;
    result.push(candidate);
  }
  return result;
}

export function createGraphViewport(): GraphViewportController {
  let channels: readonly ChannelDefinition[] = [];
  let channelData: NumericChannelDataSource | undefined;
  let timeRange: LogTimeRange | undefined;
  let viewport: TimelineViewport | undefined;
  let selectedChannel: ChannelDefinition | undefined;
  let selectedRange: NumericChannelRange | undefined;
  let cursorTimeMs = 0;
  let zoomListener: ((factor: number, anchorMs: number) => void) | undefined;
  let panListener: ((deltaMs: number) => void) | undefined;

  const root = document.createElement('div');
  root.className = 'graph-viewport';
  root.innerHTML = `
    <canvas class="graph-canvas" aria-label="Channel graph"></canvas>
    <div class="graph-overlay graph-overlay--empty">
      <strong>Select a channel</strong>
      <span>Choose a channel from Full Sensor List to graph it.</span>
    </div>
    <div class="graph-readout" hidden>
      <strong class="graph-readout-name"></strong>
      <span class="graph-readout-value"></span>
    </div>
  `;

  const canvas = root.querySelector<HTMLCanvasElement>('.graph-canvas');
  const overlay = root.querySelector<HTMLElement>('.graph-overlay');
  const overlayTitle = root.querySelector<HTMLElement>('.graph-overlay strong');
  const overlayDetail = root.querySelector<HTMLElement>('.graph-overlay span');
  const readout = root.querySelector<HTMLElement>('.graph-readout');
  const readoutName = root.querySelector<HTMLElement>('.graph-readout-name');
  const readoutValue = root.querySelector<HTMLElement>('.graph-readout-value');
  if (!canvas || !overlay || !overlayTitle || !overlayDetail || !readout || !readoutName || !readoutValue) {
    throw new Error('Graph viewport structure is incomplete.');
  }

  const nearestValue = (): number | undefined => {
    if (!selectedRange || selectedRange.timeMs.length === 0) return undefined;
    let low = 0;
    let high = selectedRange.timeMs.length - 1;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const value = selectedRange.timeMs[mid] ?? 0;
      if (value < cursorTimeMs) low = mid + 1;
      else high = mid;
    }
    let index = low;
    if (index > 0) {
      const current = selectedRange.timeMs[index] ?? Number.POSITIVE_INFINITY;
      const previous = selectedRange.timeMs[index - 1] ?? Number.NEGATIVE_INFINITY;
      if (Math.abs(previous - cursorTimeMs) <= Math.abs(current - cursorTimeMs)) index -= 1;
    }
    if (selectedRange.validity[index] !== 1) return undefined;
    return selectedRange.values[index];
  };

  const draw = (): void => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const targetWidth = Math.max(1, Math.round(width * dpr));
    const targetHeight = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const inset = 6;
    const plotWidth = Math.max(1, width - inset * 2);
    const plotHeight = Math.max(1, height - inset * 2);
    context.lineWidth = 1;

    context.strokeStyle = 'rgba(89, 129, 151, 0.14)';
    for (let i = 1; i < 5; i += 1) {
      const y = inset + (plotHeight * i) / 5;
      context.beginPath();
      context.moveTo(inset, y + 0.5);
      context.lineTo(width - inset, y + 0.5);
      context.stroke();
    }
    for (let i = 1; i < 5; i += 1) {
      const x = inset + (plotWidth * i) / 5;
      context.beginPath();
      context.moveTo(x + 0.5, inset);
      context.lineTo(x + 0.5, height - inset);
      context.stroke();
    }

    if (!selectedRange || !selectedChannel || !viewport) return;
    const visibleStartMs = viewport.visibleStartMs;
    const visibleEndMs = viewport.visibleEndMs;

    const envelope = buildViewportEnvelope(
      selectedRange,
      visibleStartMs,
      visibleEndMs,
      Math.max(1, Math.floor(plotWidth)),
    );
    const rawSpan = envelope.valueMax - envelope.valueMin;
    const padding = rawSpan > 0 ? rawSpan * 0.04 : Math.max(1, Math.abs(envelope.valueMax) * 0.04);
    const axisMin = envelope.valueMin >= 0
      ? Math.max(0, envelope.valueMin - padding)
      : envelope.valueMin - padding;
    const axisMax = envelope.valueMax <= 0
      ? Math.min(0, envelope.valueMax + padding)
      : envelope.valueMax + padding;
    const axisSpan = Math.max(1e-9, axisMax - axisMin);
    const yForValue = (value: number): number => {
      const normalized = (value - axisMin) / axisSpan;
      return inset + plotHeight - normalized * plotHeight;
    };
    const duration = Math.max(1e-9, visibleEndMs - visibleStartMs);
    const xForTime = (timeMs: number): number => inset + ((timeMs - visibleStartMs) / duration) * plotWidth;

    // Experimental renderer: preserve first/min/max/last raw values per horizontal
    // bucket while bounding work. Visual tuning is deliberately deferred until the
    // viewport and multi-channel feature set is established.
    context.strokeStyle = '#42a5f5';
    context.lineWidth = 1.15;
    context.lineJoin = 'miter';
    context.lineCap = 'butt';
    context.beginPath();
    let previousBucketX: number | undefined;
    let hasTrace = false;

    for (const column of envelope.columns) {
      const points = rawRepresentativePoints(column);
      if (points.length === 0) continue;
      const breakBeforeBucket = previousBucketX === undefined || column.x - previousBucketX > 2;
      for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        if (!point) continue;
        const x = xForTime(point.timeMs);
        const y = yForValue(point.value);
        if (breakBeforeBucket && index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
        hasTrace = true;
      }
      previousBucketX = column.x;
    }
    if (hasTrace) context.stroke();

    if (cursorTimeMs >= visibleStartMs && cursorTimeMs <= visibleEndMs) {
      const cursorX = xForTime(cursorTimeMs);
      context.strokeStyle = 'rgba(216, 237, 248, 0.92)';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(cursorX + 0.5, inset);
      context.lineTo(cursorX + 0.5, height - inset);
      context.stroke();
    }

    const value = nearestValue();
    readoutName.textContent = selectedChannel.sourceName;
    readoutValue.textContent = `${formatValue(value ?? Number.NaN, selectedChannel.precision ?? 2)}${selectedChannel.unit ? ` ${selectedChannel.unit}` : ''}`;
  };

  const resizeObserver = new ResizeObserver(draw);
  resizeObserver.observe(root);

  canvas.addEventListener('wheel', (event) => {
    if (!viewport || !zoomListener) return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const anchorMs = viewport.visibleStartMs + ratio * (viewport.visibleEndMs - viewport.visibleStartMs);
    const factor = event.deltaY < 0 ? 0.72 : 1.38;
    zoomListener(factor, anchorMs);
  }, { passive: false });

  canvas.addEventListener('pointerdown', (event) => {
    if (!viewport || !panListener || event.button !== 0) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    root.classList.add('graph-viewport--panning');
    let lastX = event.clientX;

    const move = (moveEvent: PointerEvent): void => {
      if (!viewport) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0) return;
      const deltaX = moveEvent.clientX - lastX;
      lastX = moveEvent.clientX;
      const span = viewport.visibleEndMs - viewport.visibleStartMs;
      panListener?.(-(deltaX / rect.width) * span);
    };
    const end = (endEvent: PointerEvent): void => {
      if (canvas.hasPointerCapture(endEvent.pointerId)) canvas.releasePointerCapture(endEvent.pointerId);
      root.classList.remove('graph-viewport--panning');
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', end);
      canvas.removeEventListener('pointercancel', end);
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  });

  const setLog = (
    nextChannels: readonly ChannelDefinition[],
    nextChannelData: NumericChannelDataSource,
    nextTimeRange: LogTimeRange | undefined,
  ): void => {
    channels = nextChannels;
    channelData = nextChannelData;
    timeRange = nextTimeRange;
    viewport = nextTimeRange
      ? {
          fullStartMs: nextTimeRange.startMs,
          fullEndMs: nextTimeRange.endMs,
          visibleStartMs: nextTimeRange.startMs,
          visibleEndMs: nextTimeRange.endMs,
        }
      : undefined;
    selectedChannel = undefined;
    selectedRange = undefined;
    cursorTimeMs = nextTimeRange?.startMs ?? 0;
    overlay.hidden = false;
    overlayTitle.textContent = 'Select a channel';
    overlayDetail.textContent = 'Choose a channel from Full Sensor List to graph it.';
    readout.hidden = true;
    draw();
  };

  const selectChannel = async (channelId: string): Promise<void> => {
    if (!channelData) return;
    const channel = channels.find((candidate) => candidate.id === channelId);
    if (!channel) return;
    overlay.hidden = false;
    overlayTitle.textContent = `Loading ${channel.sourceName}…`;
    overlayDetail.textContent = 'Reading bounded channel data from the local log.';
    try {
      const range = await channelData.readChannelRange(channel.id, 0, channelData.sampleCount);
      selectedChannel = channel;
      selectedRange = range;
      overlay.hidden = true;
      readout.hidden = false;
      draw();
    } catch (error) {
      overlay.hidden = false;
      overlayTitle.textContent = 'Could not graph channel';
      overlayDetail.textContent = error instanceof Error ? error.message : 'Unknown channel-read error.';
      readout.hidden = true;
    }
  };

  const setCursorTime = (timeMs: number): void => {
    if (!timeRange) return;
    cursorTimeMs = Math.min(timeRange.endMs, Math.max(timeRange.startMs, timeMs));
    draw();
  };

  const setViewport = (nextViewport: TimelineViewport | undefined): void => {
    viewport = nextViewport;
    draw();
  };

  const clear = (): void => {
    channels = [];
    channelData = undefined;
    timeRange = undefined;
    viewport = undefined;
    selectedChannel = undefined;
    selectedRange = undefined;
    cursorTimeMs = 0;
    overlay.hidden = false;
    overlayTitle.textContent = 'Open a log to start scoping';
    overlayDetail.textContent = 'The graph will use normalized local channel data.';
    readout.hidden = true;
    draw();
  };

  clear();
  return {
    element: root,
    setLog,
    selectChannel,
    setCursorTime,
    setViewport,
    onZoom: (listener) => { zoomListener = listener; },
    onPan: (listener) => { panListener = listener; },
    clear,
  };
}
