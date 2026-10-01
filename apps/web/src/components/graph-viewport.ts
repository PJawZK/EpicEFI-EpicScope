import type {
  ChannelDefinition,
  LogTimeRange,
  NumericChannelDataSource,
  NumericChannelRange,
} from '../../../../core/log-model/log-types';
import { buildViewportEnvelope } from '../../../../core/timeline/viewport-series';

export interface GraphViewportController {
  readonly element: HTMLElement;
  setLog(
    channels: readonly ChannelDefinition[],
    channelData: NumericChannelDataSource,
    timeRange: LogTimeRange | undefined,
  ): void;
  selectChannel(channelId: string): Promise<void>;
  setCursorTime(timeMs: number): void;
  clear(): void;
}

function formatValue(value: number, precision = 2): string {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(Math.min(6, Math.max(0, precision)));
}

function formatAxisValue(value: number, span: number, preferredPrecision = 2): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(span) >= 100) return value.toFixed(0);
  if (Math.abs(span) >= 10) return value.toFixed(Math.min(1, preferredPrecision));
  return value.toFixed(Math.min(3, Math.max(1, preferredPrecision)));
}

function formatTimeLabel(timeMs: number): string {
  const safe = Math.max(0, timeMs);
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const milliseconds = Math.floor(safe % 1_000);
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
  if (safe >= 10_000) {
    return `${seconds}s`;
  }
  return `${seconds}.${Math.floor(milliseconds / 100)}s`;
}

export function createGraphViewport(): GraphViewportController {
  let channels: readonly ChannelDefinition[] = [];
  let channelData: NumericChannelDataSource | undefined;
  let timeRange: LogTimeRange | undefined;
  let selectedChannel: ChannelDefinition | undefined;
  let selectedRange: NumericChannelRange | undefined;
  let cursorTimeMs = 0;

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
      <small class="graph-readout-meta"></small>
    </div>
  `;

  const canvas = root.querySelector<HTMLCanvasElement>('.graph-canvas');
  const overlay = root.querySelector<HTMLElement>('.graph-overlay');
  const overlayTitle = root.querySelector<HTMLElement>('.graph-overlay strong');
  const overlayDetail = root.querySelector<HTMLElement>('.graph-overlay span');
  const readout = root.querySelector<HTMLElement>('.graph-readout');
  const readoutName = root.querySelector<HTMLElement>('.graph-readout-name');
  const readoutValue = root.querySelector<HTMLElement>('.graph-readout-value');
  const readoutMeta = root.querySelector<HTMLElement>('.graph-readout-meta');
  if (
    !canvas
    || !overlay
    || !overlayTitle
    || !overlayDetail
    || !readout
    || !readoutName
    || !readoutValue
    || !readoutMeta
  ) {
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

    const left = Math.min(64, Math.max(44, width * 0.06));
    const right = 12;
    const top = 18;
    const bottom = 30;
    const plotWidth = Math.max(1, width - left - right);
    const plotHeight = Math.max(1, height - top - bottom);

    context.font = '11px system-ui, sans-serif';
    context.textBaseline = 'middle';
    context.lineWidth = 1;

    if (!selectedRange || !timeRange || !selectedChannel) {
      context.strokeStyle = 'rgba(89, 129, 151, 0.18)';
      for (let i = 0; i <= 4; i += 1) {
        const y = top + (plotHeight * i) / 4;
        context.beginPath();
        context.moveTo(left, y + 0.5);
        context.lineTo(width - right, y + 0.5);
        context.stroke();
      }
      return;
    }

    const envelope = buildViewportEnvelope(selectedRange, timeRange.startMs, timeRange.endMs, Math.max(1, Math.floor(plotWidth)));
    const rawSpan = envelope.valueMax - envelope.valueMin;
    const padding = rawSpan > 0 ? rawSpan * 0.04 : Math.max(1, Math.abs(envelope.valueMax) * 0.04);
    const axisMin = envelope.valueMin - padding;
    const axisMax = envelope.valueMax + padding;
    const axisSpan = Math.max(1e-9, axisMax - axisMin);
    const yForValue = (value: number): number => {
      const normalized = (value - axisMin) / axisSpan;
      return top + plotHeight - normalized * plotHeight;
    };

    context.strokeStyle = 'rgba(89, 129, 151, 0.22)';
    context.fillStyle = 'rgba(180, 204, 218, 0.78)';
    context.textAlign = 'right';
    for (let i = 0; i <= 4; i += 1) {
      const ratio = i / 4;
      const y = top + plotHeight * ratio;
      const value = axisMax - axisSpan * ratio;
      context.beginPath();
      context.moveTo(left, y + 0.5);
      context.lineTo(width - right, y + 0.5);
      context.stroke();
      context.fillText(
        formatAxisValue(value, axisSpan, selectedChannel.precision ?? 2),
        left - 7,
        y,
      );
    }

    context.textAlign = 'center';
    context.textBaseline = 'top';
    for (let i = 0; i <= 4; i += 1) {
      const ratio = i / 4;
      const x = left + plotWidth * ratio;
      const timeMs = timeRange.startMs + timeRange.durationMs * ratio;
      context.strokeStyle = 'rgba(89, 129, 151, 0.12)';
      context.beginPath();
      context.moveTo(x + 0.5, top);
      context.lineTo(x + 0.5, top + plotHeight);
      context.stroke();
      context.fillStyle = 'rgba(180, 204, 218, 0.72)';
      context.fillText(formatTimeLabel(timeMs), x, top + plotHeight + 7);
    }

    if (selectedChannel.unit) {
      context.textAlign = 'left';
      context.textBaseline = 'top';
      context.fillStyle = 'rgba(180, 204, 218, 0.72)';
      context.fillText(selectedChannel.unit, 6, 4);
    }

    context.strokeStyle = 'rgba(66, 165, 245, 0.20)';
    context.lineWidth = 1;
    for (const column of envelope.columns) {
      const x = left + column.x + 0.5;
      context.beginPath();
      context.moveTo(x, yForValue(column.min));
      context.lineTo(x, yForValue(column.max));
      context.stroke();
    }

    context.strokeStyle = '#42a5f5';
    context.lineWidth = 1.35;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.beginPath();
    let previousX: number | undefined;
    let hasTrace = false;
    for (const column of envelope.columns) {
      const x = left + column.x + 0.5;
      const y = yForValue(column.mean);
      if (previousX === undefined || x - previousX > 2.5) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
      previousX = x;
      hasTrace = true;
    }
    if (hasTrace) context.stroke();

    const duration = Math.max(1e-9, timeRange.durationMs);
    const cursorX = left + ((cursorTimeMs - timeRange.startMs) / duration) * plotWidth;
    context.strokeStyle = 'rgba(216, 237, 248, 0.92)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(cursorX + 0.5, top);
    context.lineTo(cursorX + 0.5, top + plotHeight);
    context.stroke();

    const value = nearestValue();
    readoutName.textContent = selectedChannel.sourceName;
    readoutValue.textContent = `${formatValue(value ?? Number.NaN, selectedChannel.precision ?? 2)}${selectedChannel.unit ? ` ${selectedChannel.unit}` : ''}`;
    readoutMeta.textContent = `${formatValue(envelope.valueMin, selectedChannel.precision ?? 2)}–${formatValue(envelope.valueMax, selectedChannel.precision ?? 2)}${selectedChannel.unit ? ` ${selectedChannel.unit}` : ''} · ${envelope.validSampleCount.toLocaleString()} valid${envelope.invalidSampleCount > 0 ? ` · ${envelope.invalidSampleCount.toLocaleString()} invalid skipped` : ''}`;
  };

  const resizeObserver = new ResizeObserver(draw);
  resizeObserver.observe(root);

  const setLog = (
    nextChannels: readonly ChannelDefinition[],
    nextChannelData: NumericChannelDataSource,
    nextTimeRange: LogTimeRange | undefined,
  ): void => {
    channels = nextChannels;
    channelData = nextChannelData;
    timeRange = nextTimeRange;
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

  const clear = (): void => {
    channels = [];
    channelData = undefined;
    timeRange = undefined;
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
  return { element: root, setLog, selectChannel, setCursorTime, clear };
}
