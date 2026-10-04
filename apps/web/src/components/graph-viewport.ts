import type {
  ChannelDefinition,
  LogTimeRange,
  NumericChannelDataSource,
  NumericChannelRange,
} from '../../../../core/log-model/log-types';
import type { TimelineViewport } from '../../../../core/timeline/viewport-state';
import { buildStableValueScale, type StableValueScale } from '../../../../core/timeline/value-scale';
import {
  buildRawViewportSeries,
  buildViewportEnvelope,
  buildViewportEnvelopeFromBlocks,
  type ViewportEnvelopeColumn,
} from '../../../../core/timeline/viewport-series';

const MAX_ACTIVE_TRACES = 8;
const TRACE_COLORS = ['#42a5f5', '#26c6a3', '#f0b44d', '#c98cff', '#ef6c75', '#70d6ff', '#b8d95a', '#ff8c42'] as const;
const PROGRESSIVE_FILL_BASE_STEP_SAMPLES = 16_384;
const VIEWPORT_REFRESH_DEFAULT_DELAY_MS = 90;
const VIEWPORT_INTERACTION_BURST_WINDOW_MS = 180;
const VIEWPORT_INTERACTION_SETTLE_DELAY_MS = 160;
const PROGRESSIVE_FILL_DESKTOP_MAX_STEP_SAMPLES = 65_536;
const PROGRESSIVE_FILL_LOW_SPEC_MAX_STEP_SAMPLES = 32_768;
const MATERIALIZATION_DESKTOP_DELAY_MS = 120;
const MATERIALIZATION_LOW_SPEC_IDLE_DELAY_MS = 1_000;
const LOW_SPEC_INITIAL_VIEWPORT_MAX_SAMPLES = 16_384;

function progressiveFillStepSamples(missingSamples: number, completedSteps: number): number {
  if (completedSteps === 0 || missingSamples <= PROGRESSIVE_FILL_BASE_STEP_SAMPLES * 2) {
    return PROGRESSIVE_FILL_BASE_STEP_SAMPLES;
  }

  const logicalThreads = Math.max(1, globalThis.navigator?.hardwareConcurrency ?? 1);
  const maximum = logicalThreads <= 3
    ? PROGRESSIVE_FILL_LOW_SPEC_MAX_STEP_SAMPLES
    : PROGRESSIVE_FILL_DESKTOP_MAX_STEP_SAMPLES;
  if (missingSamples >= PROGRESSIVE_FILL_BASE_STEP_SAMPLES * 8) return maximum;
  return Math.min(maximum, PROGRESSIVE_FILL_BASE_STEP_SAMPLES * 2);
}

export interface GraphCursorValue {
  readonly channelId: string;
  readonly value: number | undefined;
}

export interface GraphOverviewTrace {
  readonly channelId: string;
  readonly channelName: string;
  readonly range: NumericChannelRange;
  readonly color: string;
}

export interface GraphChannelStatistics {
  readonly channelId: string;
  readonly current: number | undefined;
  readonly full: {
    readonly complete: boolean;
    readonly validCount: number;
    readonly invalidCount: number;
    readonly min: number | undefined;
    readonly max: number | undefined;
    readonly mean: number | undefined;
    readonly standardDeviation: number | undefined;
  };
  readonly visible: {
    readonly validCount: number;
    readonly min: number | undefined;
    readonly max: number | undefined;
    readonly mean: number | undefined;
  };
}

export interface GraphChannelPerformance {
  readonly channelId: string;
  readonly phase: 'viewport' | 'full' | 'cache';
  readonly startSampleIndex: number;
  readonly requestedSampleCount: number;
  readonly totalMs: number;
  readonly readDecodeMs: number;
  readonly scaleMs: number;
  readonly renderMs: number;
  readonly sampleCount: number;
  readonly batchSize: number;
  readonly cacheHit: boolean;
  readonly physicalReadCount: number;
  readonly physicalBytesRead: number;
  readonly physicalReadMs: number;
  readonly persistentLookupMs?: number;
  readonly persistentRangeBuildMs?: number;
  readonly delegatedSourceMs?: number;
  readonly sidecarManifestMs?: number;
  readonly sidecarFileOpenMs?: number;
  readonly sidecarBlobReadMs?: number;
  readonly sidecarDecodeMs?: number;
  readonly sidecarRangeBuildMs?: number;
}

export interface GraphPreloadedActivationPerformance {
  readonly totalMs: number;
  readonly channelLookupMs: number;
  readonly statisticsScaleMs: number;
  readonly traceRegistrationMs: number;
  readonly readoutMs: number;
  readonly cursorMs: number;
  readonly drawMs: number;
  readonly envelopeMs: number;
  readonly drawSetupMs: number;
  readonly drawTraceMs: number;
  readonly drawOverlayMs: number;
}

export interface GraphPreloadedActivationResult {
  readonly activatedChannelIds: readonly string[];
  readonly performance: GraphPreloadedActivationPerformance;
}

export type GraphViewportDisplayMode = 'overlay' | 'stacked';

export interface GraphViewportController {
  readonly element: HTMLElement;
  setLog(
    channels: readonly ChannelDefinition[],
    channelData: NumericChannelDataSource,
    timeRange: LogTimeRange | undefined,
  ): void;
  toggleChannel(channelId: string): Promise<boolean>;
  activatePreloadedChannels(
    ranges: ReadonlyMap<string, NumericChannelRange>,
  ): GraphPreloadedActivationResult;
  clearChannels(options?: { readonly render?: boolean }): void;
  getOverviewTraces(): readonly GraphOverviewTrace[];
  getChannelStatistics(channelId: string): GraphChannelStatistics | undefined;
  setCursorTime(timeMs: number): void;
  setViewport(viewport: TimelineViewport | undefined): void;
  setAnalysisRange(aTimeMs: number | undefined, bTimeMs: number | undefined): void;
  onZoom(listener: (factor: number, anchorMs: number) => void): void;
  onPan(listener: (deltaMs: number) => void): void;
  onCursorValues(listener: (values: readonly GraphCursorValue[]) => void): void;
  onChannelPerformance(listener: (performance: GraphChannelPerformance) => void): void;
  onPendingChannelsChanged(listener: (channelIds: readonly string[]) => void): void;
  loadPendingChannels(): void;
  refreshValidity(): void;
  setHighZoomSamplePointsVisible(visible: boolean): void;
  setAssignedChannels(channels: readonly ChannelDefinition[]): void;
  setDisplayMode(mode: GraphViewportDisplayMode): void;
  clear(): void;
}

interface RawRepresentativePoint {
  readonly timeMs: number;
  readonly value: number;
}

interface ActiveTrace {
  readonly channel: ChannelDefinition;
  readonly range: NumericChannelRange;
  readonly scale: StableValueScale;
  readonly fullStatistics: ReturnType<typeof summarizeRange>;
  readonly statisticsComplete: boolean;
  readonly color: string;
}

interface PendingTrace {
  readonly channel: ChannelDefinition;
  readonly startedMs: number;
  readonly resolve: (active: boolean) => void;
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

function nearestValue(range: NumericChannelRange, cursorTimeMs: number): number | undefined {
  if (range.timeMs.length === 0) return undefined;
  const firstTime = range.timeMs[0];
  const lastTime = range.timeMs[range.timeMs.length - 1];
  if (firstTime === undefined || lastTime === undefined || cursorTimeMs < firstTime || cursorTimeMs > lastTime) {
    return undefined;
  }
  let low = 0;
  let high = range.timeMs.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const value = range.timeMs[mid] ?? 0;
    if (value < cursorTimeMs) low = mid + 1;
    else high = mid;
  }

  let index = low;
  if (index > 0) {
    const current = range.timeMs[index] ?? Number.POSITIVE_INFINITY;
    const previous = range.timeMs[index - 1] ?? Number.NEGATIVE_INFINITY;
    if (Math.abs(previous - cursorTimeMs) <= Math.abs(current - cursorTimeMs)) index -= 1;
  }

  if (range.validity[index] !== 1) return undefined;
  const value = range.values[index];
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

function summarizeRange(
  range: NumericChannelRange,
  startMs = Number.NEGATIVE_INFINITY,
  endMs = Number.POSITIVE_INFINITY,
): {
  validCount: number;
  invalidCount: number;
  min: number | undefined;
  max: number | undefined;
  mean: number | undefined;
  standardDeviation: number | undefined;
} {
  let validCount = 0;
  let invalidCount = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let mean = 0;
  let m2 = 0;

  for (let index = 0; index < range.values.length; index += 1) {
    const timeMs = range.timeMs[index];
    if (timeMs === undefined || timeMs < startMs || timeMs > endMs) continue;
    const value = range.values[index];
    if (range.validity[index] !== 1 || value === undefined || !Number.isFinite(value)) {
      invalidCount += 1;
      continue;
    }
    validCount += 1;
    min = Math.min(min, value);
    max = Math.max(max, value);
    const delta = value - mean;
    mean += delta / validCount;
    m2 += delta * (value - mean);
  }

  return {
    validCount,
    invalidCount,
    min: validCount > 0 ? min : undefined,
    max: validCount > 0 ? max : undefined,
    mean: validCount > 0 ? mean : undefined,
    standardDeviation: validCount > 1 ? Math.sqrt(m2 / (validCount - 1)) : validCount === 1 ? 0 : undefined,
  };
}

function stableScaleFromStatistics(
  statistics: ReturnType<typeof summarizeRange>,
): StableValueScale {
  const { min, max, validCount } = statistics;
  if (validCount === 0 || min === undefined || max === undefined) return { min: 0, max: 1 };

  const rawSpan = max - min;
  const padding = rawSpan > 0
    ? rawSpan * 0.04
    : Math.max(1, Math.abs(max) * 0.04);

  const paddedMin = min >= 0 ? Math.max(0, min - padding) : min - padding;
  const paddedMax = max <= 0 ? Math.min(0, max + padding) : max + padding;

  if (paddedMax > paddedMin) return { min: paddedMin, max: paddedMax };
  return { min: paddedMin, max: paddedMin + 1 };
}

export function createGraphViewport(): GraphViewportController {
  let channels: readonly ChannelDefinition[] = [];
  let channelData: NumericChannelDataSource | undefined;
  let timeRange: LogTimeRange | undefined;
  let viewport: TimelineViewport | undefined;
  const activeTraces = new Map<string, ActiveTrace>();
  const envelopeCache = new Map<string, {
    readonly visibleStartMs: number;
    readonly visibleEndMs: number;
    readonly pixelWidth: number;
    readonly envelope: ReturnType<typeof buildViewportEnvelope>;
  }>();
  let cursorTimeMs = 0;
  let aTimeMs: number | undefined;
  let bTimeMs: number | undefined;
  let zoomListener: ((factor: number, anchorMs: number) => void) | undefined;
  let panListener: ((deltaMs: number) => void) | undefined;
  let cursorValuesListener: ((values: readonly GraphCursorValue[]) => void) | undefined;
  let channelPerformanceListener: ((performance: GraphChannelPerformance) => void) | undefined;
  let pendingChannelsListener: ((channelIds: readonly string[]) => void) | undefined;
  const pendingTraces = new Map<string, PendingTrace>();
  const loadingTraceIds = new Set<string>();
  const materializingTraceIds = new Set<string>();
  const materializationTimers = new Map<string, number>();
  let decodeInFlight = false;
  let decodeGeneration = 0;
  let viewportRefreshTimer: number | undefined;
  let viewportRefreshGeneration = 0;
  let lastViewportInteractionMs = Number.NEGATIVE_INFINITY;
  let nextViewportRefreshDelayMs = VIEWPORT_REFRESH_DEFAULT_DELAY_MS;
  let highZoomSamplePointsVisible = true;
  let displayMode: GraphViewportDisplayMode = 'overlay';
  let assignedChannels: readonly ChannelDefinition[] = [];
  let measureEnvelopeBuild = false;
  let measuredEnvelopeBuildMs = 0;
  let measuredDrawSetupMs = 0;
  let measuredDrawTraceMs = 0;
  let measuredDrawOverlayMs = 0;
  let precomputedEnvelopeBlocksEnabled = true;

  const root = document.createElement('div');
  root.className = 'graph-viewport';
  root.innerHTML = `
    <canvas class="graph-canvas" aria-label="Channel graph"></canvas>
    <div class="graph-overlay graph-overlay--empty">
      <strong>Select channels</strong>
      <span>Choose up to ${MAX_ACTIVE_TRACES} channels from Full Sensor List to graph them.</span>
    </div>
    <div class="graph-corner-readout graph-corner-readout--names" hidden></div>
    <div class="graph-corner-readout graph-corner-readout--now" data-label="NOW" hidden></div>
    <div class="graph-corner-readout graph-corner-readout--min" data-label="MIN" hidden></div>
    <div class="graph-corner-readout graph-corner-readout--max" data-label="MAX" hidden></div>
    <div class="graph-toast graph-toast--warning" role="status" aria-live="polite" hidden>
      <span class="graph-toast-icon" aria-hidden="true">!</span>
      <span class="graph-toast-message"></span>
    </div>
  `;

  const canvas = root.querySelector<HTMLCanvasElement>('.graph-canvas');
  const overlay = root.querySelector<HTMLElement>('.graph-overlay');
  const overlayTitle = root.querySelector<HTMLElement>('.graph-overlay strong');
  const overlayDetail = root.querySelector<HTMLElement>('.graph-overlay span');
  const nameReadout = root.querySelector<HTMLElement>('.graph-corner-readout--names');
  const nowReadout = root.querySelector<HTMLElement>('.graph-corner-readout--now');
  const minReadout = root.querySelector<HTMLElement>('.graph-corner-readout--min');
  const maxReadout = root.querySelector<HTMLElement>('.graph-corner-readout--max');
  const toast = root.querySelector<HTMLElement>('.graph-toast');
  const toastMessage = root.querySelector<HTMLElement>('.graph-toast-message');
  if (!canvas || !overlay || !overlayTitle || !overlayDetail || !nameReadout || !nowReadout || !minReadout || !maxReadout || !toast || !toastMessage) {
    throw new Error('Graph viewport structure is incomplete.');
  }

  let toastTimer: number | undefined;
  const showToast = (message: string): void => {
    if (toastTimer !== undefined) window.clearTimeout(toastTimer);
    toastMessage.textContent = message;
    toast.hidden = false;
    toast.classList.remove('graph-toast--leaving');
    toastTimer = window.setTimeout(() => {
      toast.classList.add('graph-toast--leaving');
      window.setTimeout(() => {
        toast.hidden = true;
        toast.classList.remove('graph-toast--leaving');
      }, 180);
    }, 3200);
  };

  const emitCursorValues = (): void => {
    const values = [...activeTraces.entries()].map(([channelId, trace]) => ({
      channelId,
      value: nearestValue(trace.range, cursorTimeMs),
    }));
    cursorValuesListener?.(values);
  };

  const formatReadoutValue = (trace: ActiveTrace, value: number | undefined): string => {
    if (value === undefined || !Number.isFinite(value)) return '—';
    const precision = Math.min(6, Math.max(0, trace.channel.precision ?? 2));
    return value.toFixed(precision);
  };

  const renderReadout = (): void => {
    nameReadout.replaceChildren();
    nowReadout.replaceChildren();
    minReadout.replaceChildren();
    maxReadout.replaceChildren();

    const displayChannels = assignedChannels.length > 0
      ? assignedChannels
      : [...activeTraces.values()].map((trace) => trace.channel);

    const appendMetric = (
      host: HTMLElement,
      channel: ChannelDefinition,
      color: string,
      value: string,
    ): void => {
      const item = document.createElement('span');
      item.className = 'graph-corner-item';

      const swatch = document.createElement('span');
      swatch.className = 'graph-trace-swatch';
      swatch.style.background = color;

      const text = document.createElement('span');
      const unit = channel.unit ? ` ${channel.unit}` : '';
      text.textContent = `${value}${unit}`;

      item.append(swatch, text);
      host.append(item);
    };

    displayChannels.forEach((channel, index) => {
      const trace = activeTraces.get(channel.id);
      const color = trace?.color ?? TRACE_COLORS[index % TRACE_COLORS.length] ?? '#587487';

      const nameItem = document.createElement('span');
      nameItem.className = 'graph-corner-item graph-corner-item--name';

      const swatch = document.createElement('span');
      swatch.className = 'graph-trace-swatch';
      swatch.style.background = color;

      const name = document.createElement('span');
      name.textContent = channel.displayName || channel.sourceName;
      name.title = channel.sourceName;

      nameItem.append(swatch, name);
      nameReadout.append(nameItem);

      appendMetric(
        nowReadout,
        channel,
        color,
        trace ? formatReadoutValue(trace, nearestValue(trace.range, cursorTimeMs)) : '—',
      );
      appendMetric(
        minReadout,
        channel,
        color,
        trace ? formatReadoutValue(trace, trace.fullStatistics.min) : '—',
      );
      appendMetric(
        maxReadout,
        channel,
        color,
        trace ? formatReadoutValue(trace, trace.fullStatistics.max) : '—',
      );
    });

    const hidden = displayChannels.length === 0 || displayMode === 'stacked';
    nameReadout.hidden = hidden;
    nowReadout.hidden = hidden;
    minReadout.hidden = hidden;
    maxReadout.hidden = hidden;
  };

  const draw = (): void => {
    const drawBreakdownStarted = measureEnvelopeBuild
      ? (globalThis.performance?.now() ?? Date.now())
      : 0;
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

    const stackedChannels = displayMode === 'stacked'
      ? (assignedChannels.length > 0
          ? assignedChannels
          : [...activeTraces.values()].map((trace) => trace.channel))
      : [];
    const stacked = displayMode === 'stacked' && stackedChannels.length > 0;

    context.strokeStyle = 'rgba(89, 129, 151, 0.14)';
    if (!stacked) {
      for (let i = 1; i < 5; i += 1) {
        const y = inset + (plotHeight * i) / 5;
        context.beginPath();
        context.moveTo(inset, y + 0.5);
        context.lineTo(width - inset, y + 0.5);
        context.stroke();
      }
    }
    for (let i = 1; i < 5; i += 1) {
      const x = inset + (plotWidth * i) / 5;
      context.beginPath();
      context.moveTo(x + 0.5, inset);
      context.lineTo(x + 0.5, height - inset);
      context.stroke();
    }

    const traceEntries = [...activeTraces.entries()];
    if (stacked) {
      const rowHeight = plotHeight / Math.max(1, stackedChannels.length);
      context.strokeStyle = 'rgba(89, 129, 151, 0.20)';
      for (let index = 1; index < stackedChannels.length; index += 1) {
        const y = inset + rowHeight * index;
        context.beginPath();
        context.moveTo(inset, y + 0.5);
        context.lineTo(width - inset, y + 0.5);
        context.stroke();
      }
    }

    if (stacked) {
      const rowHeight = plotHeight / Math.max(1, stackedChannels.length);
      for (let rowIndex = 0; rowIndex < stackedChannels.length; rowIndex += 1) {
        const channel = stackedChannels[rowIndex];
        if (!channel) continue;
        const trace = activeTraces.get(channel.id);
        const rowTop = inset + rowHeight * rowIndex;
        const labelHeight = Math.min(15, Math.max(10, rowHeight * 0.24));
        const unit = channel.unit ? ` ${channel.unit}` : '';
        const name = channel.displayName || channel.sourceName;
        const metric = trace
          ? `NOW ${formatReadoutValue(trace, nearestValue(trace.range, cursorTimeMs))}  ·  MIN ${formatReadoutValue(trace, trace.fullStatistics.min)}  ·  MAX ${formatReadoutValue(trace, trace.fullStatistics.max)}${unit}`
          : 'WAITING FOR LOG DATA';

        const chipWidth = Math.max(120, Math.min(plotWidth - 4, 390));
        context.fillStyle = 'rgba(0, 0, 0, 0.72)';
        context.fillRect(inset + 2, rowTop + 2, chipWidth, Math.max(10, labelHeight - 1));
        context.fillStyle = trace?.color ?? '#587487';
        context.beginPath();
        context.arc(inset + 8, rowTop + labelHeight / 2 + 1, 2.5, 0, Math.PI * 2);
        context.fill();

        context.font = '600 8px sans-serif';
        context.textBaseline = 'middle';
        context.fillStyle = trace ? '#d9edf7' : '#9ab0bd';
        context.fillText(name, inset + 14, rowTop + labelHeight / 2 + 1);
        const nameWidth = context.measureText(name).width;
        context.fillStyle = trace ? '#88a0af' : '#647f8f';
        context.font = '600 7px sans-serif';
        context.fillText(metric, inset + 22 + nameWidth, rowTop + labelHeight / 2 + 1);
        context.textBaseline = 'alphabetic';
      }
    }

    if (!viewport || activeTraces.size === 0) {
      return;
    }

    const visibleStartMs = viewport.visibleStartMs;
    const visibleEndMs = viewport.visibleEndMs;
    const duration = Math.max(1e-9, visibleEndMs - visibleStartMs);
    const xForTime = (timeMs: number): number => inset + ((timeMs - visibleStartMs) / duration) * plotWidth;

    const pixelWidth = Math.max(1, Math.floor(plotWidth));
    const tracePhaseStarted = measureEnvelopeBuild
      ? (globalThis.performance?.now() ?? Date.now())
      : 0;
    const envelopeBeforeTracePhase = measuredEnvelopeBuildMs;
    if (measureEnvelopeBuild) measuredDrawSetupMs += tracePhaseStarted - drawBreakdownStarted;
    for (let traceIndex = 0; traceIndex < traceEntries.length; traceIndex += 1) {
      const entry = traceEntries[traceIndex];
      if (!entry) continue;
      const [channelId, trace] = entry;
      const cachedEnvelope = envelopeCache.get(channelId);
      const envelope = cachedEnvelope
        && cachedEnvelope.visibleStartMs === visibleStartMs
        && cachedEnvelope.visibleEndMs === visibleEndMs
        && cachedEnvelope.pixelWidth === pixelWidth
        ? cachedEnvelope.envelope
        : (() => {
            const envelopeStarted = measureEnvelopeBuild
              ? (globalThis.performance?.now() ?? Date.now())
              : 0;
            const built = precomputedEnvelopeBlocksEnabled && trace.range.fullEnvelopeBlocks
              ? buildViewportEnvelopeFromBlocks(
                  trace.range,
                  trace.range.fullEnvelopeBlocks,
                  visibleStartMs,
                  visibleEndMs,
                  pixelWidth,
                )
              : buildViewportEnvelope(
                  trace.range,
                  visibleStartMs,
                  visibleEndMs,
                  pixelWidth,
                );
            if (measureEnvelopeBuild) {
              measuredEnvelopeBuildMs += (globalThis.performance?.now() ?? Date.now()) - envelopeStarted;
            }
            return built;
          })();
      if (cachedEnvelope?.envelope !== envelope) {
        envelopeCache.set(channelId, {
          visibleStartMs,
          visibleEndMs,
          pixelWidth,
          envelope,
        });
      }
      const axisSpan = Math.max(1e-9, trace.scale.max - trace.scale.min);
      const rowHeight = stacked ? plotHeight / Math.max(1, stackedChannels.length) : plotHeight;
      const stackedIndex = stacked
        ? Math.max(0, stackedChannels.findIndex((channel) => channel.id === channelId))
        : traceIndex;
      const rowTop = stacked ? inset + rowHeight * stackedIndex : inset;
      const labelHeight = stacked ? Math.min(15, Math.max(10, rowHeight * 0.24)) : 0;
      const traceTop = rowTop + labelHeight + (stacked ? 2 : 0);
      const traceHeight = Math.max(4, rowHeight - labelHeight - (stacked ? 5 : 0));
      const yForValue = (value: number): number => {
        const normalized = (value - trace.scale.min) / axisSpan;
        return traceTop + traceHeight - normalized * traceHeight;
      };

      context.strokeStyle = trace.color;
      context.lineWidth = 1.1;
      context.lineJoin = 'miter';
      context.lineCap = 'butt';

      // At high zoom there may be only a few real samples spread across hundreds
      // of pixels. Pixel-bucket gaps are not missing data, so switch to direct
      // source-order rendering once the visible sample count is modest.
      const useRawSeries = envelope.validSampleCount <= pixelWidth * 2;
      if (useRawSeries) {
        const points = buildRawViewportSeries(trace.range, visibleStartMs, visibleEndMs);
        context.beginPath();
        let hasTrace = false;
        for (const point of points) {
          const x = xForTime(point.timeMs);
          const y = yForValue(point.value);
          if (point.breakBefore) context.moveTo(x, y);
          else context.lineTo(x, y);
          hasTrace = true;
        }
        if (hasTrace) context.stroke();

        // Make individual recorded samples visible only at very high zoom.
        if (highZoomSamplePointsVisible && points.length > 0 && points.length <= 128) {
          context.fillStyle = trace.color;
          for (const point of points) {
            const x = xForTime(point.timeMs);
            const y = yForValue(point.value);
            context.beginPath();
            context.arc(x, y, 1.6, 0, Math.PI * 2);
            context.fill();
          }
        }
      } else {
        // Zoomed-out rendering keeps first/min/max/last raw values per horizontal
        // bucket. The envelope preserves extrema without plotting every record.
        context.beginPath();
        let previousBucketX: number | undefined;
        let hasTrace = false;
        const isolatedPoints: { readonly x: number; readonly y: number }[] = [];

        for (let columnIndex = 0; columnIndex < envelope.columns.length; columnIndex += 1) {
          const column = envelope.columns[columnIndex];
          if (!column) continue;
          const points = rawRepresentativePoints(column);
          if (points.length === 0) continue;

          const previousColumn = envelope.columns[columnIndex - 1];
          const nextColumn = envelope.columns[columnIndex + 1];
          const gapFromPrevious = previousColumn ? column.x - previousColumn.x : Number.POSITIVE_INFINITY;
          const gapToNext = nextColumn ? nextColumn.x - column.x : Number.POSITIVE_INFINITY;
          const isolatedBucket = gapFromPrevious > 2 && gapToNext > 2;
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

          if (
            isolatedBucket
            && column.first === column.last
            && column.min === column.max
          ) {
            isolatedPoints.push({
              x: xForTime(column.firstTimeMs),
              y: yForValue(column.first),
            });
          }
          previousBucketX = column.x;
        }
        if (hasTrace) context.stroke();

        if (isolatedPoints.length > 0) {
          context.fillStyle = trace.color;
          for (const point of isolatedPoints) {
            context.fillRect(point.x - 1, point.y - 1, 2, 2);
          }
        }
      }
    }

    const overlayPhaseStarted = measureEnvelopeBuild
      ? (globalThis.performance?.now() ?? Date.now())
      : 0;
    if (measureEnvelopeBuild) {
      measuredDrawTraceMs += Math.max(
        0,
        overlayPhaseStarted - tracePhaseStarted - (measuredEnvelopeBuildMs - envelopeBeforeTracePhase),
      );
    }

    if (aTimeMs !== undefined || bTimeMs !== undefined) {
      const visibleA = aTimeMs !== undefined && aTimeMs >= visibleStartMs && aTimeMs <= visibleEndMs;
      const visibleB = bTimeMs !== undefined && bTimeMs >= visibleStartMs && bTimeMs <= visibleEndMs;

      if (aTimeMs !== undefined && bTimeMs !== undefined) {
        const rangeStart = Math.max(visibleStartMs, Math.min(aTimeMs, bTimeMs));
        const rangeEnd = Math.min(visibleEndMs, Math.max(aTimeMs, bTimeMs));
        if (rangeEnd >= rangeStart) {
          const x1 = xForTime(rangeStart);
          const x2 = xForTime(rangeEnd);
          context.fillStyle = 'rgba(84, 148, 205, 0.10)';
          context.fillRect(x1, inset, Math.max(1, x2 - x1), plotHeight);
        }
      }

      const drawBoundary = (timeMs: number, label: 'A' | 'B', stroke: string): void => {
        if (timeMs < visibleStartMs || timeMs > visibleEndMs) return;
        const x = xForTime(timeMs);
        context.strokeStyle = stroke;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x + 0.5, inset);
        context.lineTo(x + 0.5, height - inset);
        context.stroke();
        context.fillStyle = stroke;
        context.font = '9px sans-serif';
        context.fillText(label, x + 3, inset + 10);
      };

      if (visibleA && aTimeMs !== undefined) drawBoundary(aTimeMs, 'A', 'rgba(83, 181, 255, 0.95)');
      if (visibleB && bTimeMs !== undefined) drawBoundary(bTimeMs, 'B', 'rgba(255, 184, 77, 0.95)');
    }

    if (cursorTimeMs >= visibleStartMs && cursorTimeMs <= visibleEndMs) {
      const cursorX = xForTime(cursorTimeMs);
      context.strokeStyle = 'rgba(216, 237, 248, 0.92)';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(cursorX + 0.5, inset);
      context.lineTo(cursorX + 0.5, height - inset);
      context.stroke();
    }

    if (measureEnvelopeBuild) {
      measuredDrawOverlayMs += (globalThis.performance?.now() ?? Date.now()) - overlayPhaseStarted;
    }

  };

  const resizeObserver = new ResizeObserver(draw);
  resizeObserver.observe(root);

  const markViewportInteraction = (): void => {
    const now = globalThis.performance?.now() ?? Date.now();
    const repeated = now - lastViewportInteractionMs <= VIEWPORT_INTERACTION_BURST_WINDOW_MS;
    lastViewportInteractionMs = now;
    nextViewportRefreshDelayMs = repeated
      ? VIEWPORT_INTERACTION_SETTLE_DELAY_MS
      : VIEWPORT_REFRESH_DEFAULT_DELAY_MS;

    // Stop progressive work from chasing a viewport the user has already left.
    // An in-flight Blob read cannot be aborted, but its result is discarded.
    viewportRefreshGeneration += 1;
    if (viewportRefreshTimer !== undefined) {
      window.clearTimeout(viewportRefreshTimer);
      viewportRefreshTimer = undefined;
    }
  };

  canvas.addEventListener('wheel', (event) => {
    if (!viewport || !zoomListener) return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const anchorMs = viewport.visibleStartMs + ratio * (viewport.visibleEndMs - viewport.visibleStartMs);
    const factor = event.deltaY < 0 ? 0.72 : 1.38;
    markViewportInteraction();
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
      markViewportInteraction();
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

  const emitPendingChannels = (): void => {
    pendingChannelsListener?.([...pendingTraces.keys()]);
  };

  const cancelPending = (): void => {
    decodeGeneration += 1;
    for (const pending of pendingTraces.values()) pending.resolve(false);
    pendingTraces.clear();
    loadingTraceIds.clear();
    decodeInFlight = false;
    emitPendingChannels();
  };

  const currentChannelReadRange = (): {
    readonly startSampleIndex: number;
    readonly sampleCount: number;
    readonly phase: 'viewport' | 'full';
  } => {
    if (!channelData) return { startSampleIndex: 0, sampleCount: 0, phase: 'full' };
    if (!viewport || !channelData.sampleRangeForTime) {
      return { startSampleIndex: 0, sampleCount: channelData.sampleCount, phase: 'full' };
    }

    const candidate = channelData.sampleRangeForTime(
      viewport.visibleStartMs,
      viewport.visibleEndMs,
    );
    const logicalThreads = Math.max(1, globalThis.navigator?.hardwareConcurrency ?? 1);
    if (logicalThreads <= 3 && candidate.sampleCount > LOW_SPEC_INITIAL_VIEWPORT_MAX_SAMPLES) {
      return { startSampleIndex: 0, sampleCount: channelData.sampleCount, phase: 'full' };
    }

    if (candidate.sampleCount <= 0 || candidate.sampleCount >= channelData.sampleCount) {
      return { startSampleIndex: 0, sampleCount: channelData.sampleCount, phase: 'full' };
    }

    return { ...candidate, phase: 'viewport' };
  };

  const flushPending = async (): Promise<void> => {
    if (decodeInFlight || !channelData || pendingTraces.size === 0) return;

    decodeInFlight = true;
    const generation = decodeGeneration;
    const batch = [...pendingTraces.entries()];
    pendingTraces.clear();
    emitPendingChannels();
    const channelIds = batch.map(([channelId]) => channelId);
    const requestRange = currentChannelReadRange();
    for (const channelId of channelIds) loadingTraceIds.add(channelId);

    overlay.hidden = false;
    overlayTitle.textContent = batch.length > 1
      ? `Loading ${batch.length} channels…`
      : `Loading ${batch[0]?.[1].channel.sourceName ?? 'channel'}…`;
    overlayDetail.textContent = requestRange.phase === 'viewport'
      ? `Reading ${requestRange.sampleCount.toLocaleString()} visible samples first.`
      : batch.length > 1
        ? 'Reading selected channels in one sequential log pass.'
        : 'Reading bounded channel data from the local log. Additional selections will join the next pass.';

    const now = (): number => globalThis.performance?.now() ?? Date.now();
    const readStart = now();

    try {
      const result = channelData.readChannelsRange
        ? await channelData.readChannelsRange(
            channelIds,
            requestRange.startSampleIndex,
            requestRange.sampleCount,
          )
        : {
            ranges: new Map(await Promise.all(channelIds.map(async (channelId) => [
              channelId,
              await channelData!.readChannelRange(
                channelId,
                requestRange.startSampleIndex,
                requestRange.sampleCount,
              ),
            ] as const))),
            performance: {
              channelCount: channelIds.length,
              cacheHitChannelIds: [] as readonly string[],
              physicalReadCount: 0,
              physicalBytesRead: 0,
              physicalReadMs: 0,
            },
          };
      const readDecodeMs = now() - readStart;

      if (generation !== decodeGeneration) {
        for (const [, pending] of batch) pending.resolve(false);
        return;
      }

      const cacheHits = new Set(result.performance.cacheHitChannelIds);
      const scaleTimes = new Map<string, number>();
      const usedColors = new Set([...activeTraces.values()].map((trace) => trace.color));

      for (const [channelId, pending] of batch) {
        const range = result.ranges.get(channelId);
        if (!range) continue;
        const scaleStart = now();
        const scale = buildStableValueScale(range);
        scaleTimes.set(channelId, now() - scaleStart);
        const color = TRACE_COLORS.find((candidate) => !usedColors.has(candidate)) ?? TRACE_COLORS[0];
        usedColors.add(color);
        activeTraces.set(channelId, {
          channel: pending.channel,
          range,
          scale,
          fullStatistics: summarizeRange(range),
          statisticsComplete: requestRange.phase === 'full',
          color,
        });
      }

      overlay.hidden = activeTraces.size > 0;
      renderReadout();
      emitCursorValues();
      const renderStart = now();
      draw();
      const renderMs = now() - renderStart;
      const completedMs = now();

      for (const [channelId, pending] of batch) {
        const range = result.ranges.get(channelId);
        if (!range) {
          pending.resolve(false);
          continue;
        }
        channelPerformanceListener?.({
          channelId,
          phase: requestRange.phase,
          startSampleIndex: requestRange.startSampleIndex,
          requestedSampleCount: requestRange.sampleCount,
          totalMs: completedMs - readStart,
          readDecodeMs,
          scaleMs: scaleTimes.get(channelId) ?? 0,
          renderMs,
          sampleCount: range.values.length,
          batchSize: batch.length,
          cacheHit: cacheHits.has(channelId),
          physicalReadCount: result.performance.physicalReadCount,
          physicalBytesRead: result.performance.physicalBytesRead,
          physicalReadMs: result.performance.physicalReadMs,
          persistentLookupMs: result.performance.persistentLookupMs,
          persistentRangeBuildMs: result.performance.persistentRangeBuildMs,
          delegatedSourceMs: result.performance.delegatedSourceMs,
          sidecarManifestMs: result.performance.sidecarManifestMs,
          sidecarFileOpenMs: result.performance.sidecarFileOpenMs,
          sidecarBlobReadMs: result.performance.sidecarBlobReadMs,
          sidecarDecodeMs: result.performance.sidecarDecodeMs,
          sidecarRangeBuildMs: result.performance.sidecarRangeBuildMs,
        });
        pending.resolve(true);
        const activated = activeTraces.get(channelId);
        if (activated && !activated.statisticsComplete) scheduleMaterialization(channelId);
      }

    } catch (error) {
      if (generation === decodeGeneration) {
        overlay.hidden = false;
        overlayTitle.textContent = 'Could not graph channel';
        overlayDetail.textContent = error instanceof Error ? error.message : 'Unknown channel-read error.';
        draw();
      }
      for (const [, pending] of batch) pending.resolve(false);
    } finally {
      for (const channelId of channelIds) loadingTraceIds.delete(channelId);
      if (generation === decodeGeneration) {
        decodeInFlight = false;
        // Everything selected while this pass was running is now one batch.
        if (pendingTraces.size > 0) void flushPending();
      }
    }
  };

  const scheduleMaterialization = (channelId: string): void => {
    const existingTimer = materializationTimers.get(channelId);
    if (existingTimer !== undefined) window.clearTimeout(existingTimer);
    const logicalThreads = Math.max(1, globalThis.navigator?.hardwareConcurrency ?? 1);
    const delayMs = logicalThreads <= 3
      ? MATERIALIZATION_LOW_SPEC_IDLE_DELAY_MS
      : MATERIALIZATION_DESKTOP_DELAY_MS;
    const timer = window.setTimeout(() => {
      materializationTimers.delete(channelId);
      void materializeActiveChannel(channelId);
    }, delayMs);
    materializationTimers.set(channelId, timer);
  };

  const materializeActiveChannel = async (channelId: string): Promise<void> => {
    const dataSource = channelData;
    const initial = activeTraces.get(channelId);
    if (!dataSource || !initial || initial.statisticsComplete || materializingTraceIds.has(channelId)) return;

    materializingTraceIds.add(channelId);
    const now = (): number => globalThis.performance?.now() ?? Date.now();
    const readStart = now();
    try {
      const result = dataSource.readChannelsRange
        ? await dataSource.readChannelsRange([channelId], 0, dataSource.sampleCount)
        : {
            ranges: new Map([[channelId, await dataSource.readChannelRange(
              channelId,
              0,
              dataSource.sampleCount,
            )]]),
            performance: {
              channelCount: 1,
              cacheHitChannelIds: [] as readonly string[],
              physicalReadCount: 0,
              physicalBytesRead: 0,
              physicalReadMs: 0,
            },
          };
      const readDecodeMs = now() - readStart;
      if (channelData !== dataSource) return;

      const latest = activeTraces.get(channelId);
      const range = result.ranges.get(channelId);
      if (!latest || !range || range.startSampleIndex !== 0 || range.values.length !== dataSource.sampleCount) return;

      const scaleMs = 0;
      activeTraces.set(channelId, {
        ...latest,
        range,
        scale: latest.scale,
        fullStatistics: summarizeRange(range),
        statisticsComplete: true,
      });
      envelopeCache.delete(channelId);
      renderReadout();
      emitCursorValues();
      const renderStart = now();
      draw();
      const renderMs = now() - renderStart;
      const completedMs = now();
      channelPerformanceListener?.({
        channelId,
        phase: 'full',
        startSampleIndex: 0,
        requestedSampleCount: dataSource.sampleCount,
        totalMs: completedMs - readStart,
        readDecodeMs,
        scaleMs,
        renderMs,
        sampleCount: range.values.length,
        batchSize: 1,
        cacheHit: result.performance.cacheHitChannelIds.includes(channelId),
        physicalReadCount: result.performance.physicalReadCount,
        physicalBytesRead: result.performance.physicalBytesRead,
        physicalReadMs: result.performance.physicalReadMs,
      });
    } catch {
      // Keep the viewport-first trace usable if complete materialization fails.
    } finally {
      materializingTraceIds.delete(channelId);
      const latest = activeTraces.get(channelId);
      if (latest && !latest.statisticsComplete) scheduleViewportRefresh();
    }
  };

  const rangeCovers = (
    range: NumericChannelRange,
    startSampleIndex: number,
    sampleCount: number,
  ): boolean => {
    const rangeEnd = range.startSampleIndex + range.values.length;
    return startSampleIndex >= range.startSampleIndex
      && startSampleIndex + sampleCount <= rangeEnd;
  };

  const mergeContiguousRanges = (
    first: NumericChannelRange,
    second: NumericChannelRange,
  ): NumericChannelRange => {
    if (first.values.length === 0) return second;
    if (second.values.length === 0) return first;
    const firstEnd = first.startSampleIndex + first.values.length;
    const secondEnd = second.startSampleIndex + second.values.length;
    if (firstEnd < second.startSampleIndex || secondEnd < first.startSampleIndex) return second;

    const startSampleIndex = Math.min(first.startSampleIndex, second.startSampleIndex);
    const endSampleIndex = Math.max(firstEnd, secondEnd);
    const sampleCount = endSampleIndex - startSampleIndex;
    const timeMs = new Float64Array(sampleCount);
    const values = new Float64Array(sampleCount);
    const validity = new Uint8Array(sampleCount);

    const copy = (range: NumericChannelRange): void => {
      const offset = range.startSampleIndex - startSampleIndex;
      timeMs.set(range.timeMs, offset);
      values.set(range.values, offset);
      validity.set(range.validity, offset);
    };
    copy(first);
    copy(second);
    return { startSampleIndex, timeMs, values, validity };
  };

  const refreshActiveViewportRanges = async (generation: number): Promise<void> => {
    const dataSource = channelData;
    if (!dataSource || !viewport || activeTraces.size === 0) return;
    if (decodeInFlight) {
      if (generation === viewportRefreshGeneration) scheduleViewportRefresh();
      return;
    }

    const requestRange = currentChannelReadRange();
    const desiredStart = requestRange.startSampleIndex;
    const desiredEnd = desiredStart + requestRange.sampleCount;
    const channelIds = [...activeTraces.entries()]
      .filter(([channelId, trace]) => !materializingTraceIds.has(channelId)
        && !rangeCovers(trace.range, desiredStart, requestRange.sampleCount))
      .map(([channelId]) => channelId);
    if (channelIds.length === 0) return;

    const now = (): number => globalThis.performance?.now() ?? Date.now();

    for (const channelId of channelIds) {
      let preferLeft = true;
      let completedSteps = 0;
      while (generation === viewportRefreshGeneration) {
        const existing = activeTraces.get(channelId);
        if (!existing || rangeCovers(existing.range, desiredStart, requestRange.sampleCount)) break;

        const existingStart = existing.range.startSampleIndex;
        const existingEnd = existingStart + existing.range.values.length;
        const disjointLeft = desiredEnd < existingStart;
        const disjointRight = desiredStart > existingEnd;

        let chunkStart: number;
        let chunkCount: number;
        let replaceExisting = false;

        if (disjointLeft || disjointRight) {
          chunkStart = desiredStart;
          chunkCount = Math.min(PROGRESSIVE_FILL_BASE_STEP_SAMPLES, requestRange.sampleCount);
          replaceExisting = true;
        } else {
          const missingLeft = Math.max(0, existingStart - desiredStart);
          const missingRight = Math.max(0, desiredEnd - existingEnd);
          const fillStepSamples = progressiveFillStepSamples(
            missingLeft + missingRight,
            completedSteps,
          );
          if (missingLeft <= 0 && missingRight <= 0) break;

          if (missingLeft > 0 && (missingRight <= 0 || preferLeft)) {
            chunkCount = Math.min(fillStepSamples, missingLeft);
            chunkStart = existingStart - chunkCount;
            preferLeft = false;
          } else {
            chunkStart = existingEnd;
            chunkCount = Math.min(fillStepSamples, missingRight);
            preferLeft = true;
          }
        }

        if (chunkCount <= 0) break;
        const readStart = now();
        try {
          const result = dataSource.readChannelsRange
            ? await dataSource.readChannelsRange([channelId], chunkStart, chunkCount)
            : {
                ranges: new Map([[channelId, await dataSource.readChannelRange(
                  channelId,
                  chunkStart,
                  chunkCount,
                )]]),
                performance: {
                  channelCount: 1,
                  cacheHitChannelIds: [] as readonly string[],
                  physicalReadCount: 0,
                  physicalBytesRead: 0,
                  physicalReadMs: 0,
                },
              };
          const readDecodeMs = now() - readStart;
          if (generation !== viewportRefreshGeneration) return;

          const nextRange = result.ranges.get(channelId);
          const latest = activeTraces.get(channelId);
          if (!nextRange || !latest) break;
          const merged = replaceExisting
            ? nextRange
            : mergeContiguousRanges(latest.range, nextRange);

          const scaleStart = now();
          const fullStatistics = summarizeRange(merged);
          const scale = stableScaleFromStatistics(fullStatistics);
          const scaleMs = now() - scaleStart;
          activeTraces.set(channelId, {
            ...latest,
            range: merged,
            scale,
            fullStatistics,
            statisticsComplete: merged.startSampleIndex === 0
              && merged.values.length === dataSource.sampleCount,
          });
          envelopeCache.delete(channelId);

          renderReadout();
          emitCursorValues();
          const renderStart = now();
          draw();
          const renderMs = now() - renderStart;
          const completedMs = now();
          channelPerformanceListener?.({
            channelId,
            phase: requestRange.phase,
            startSampleIndex: chunkStart,
            requestedSampleCount: chunkCount,
            totalMs: completedMs - readStart,
            readDecodeMs,
            scaleMs,
            renderMs,
            sampleCount: nextRange.values.length,
            batchSize: 1,
            cacheHit: result.performance.cacheHitChannelIds.includes(channelId),
            physicalReadCount: result.performance.physicalReadCount,
            physicalBytesRead: result.performance.physicalBytesRead,
            physicalReadMs: result.performance.physicalReadMs,
          persistentLookupMs: result.performance.persistentLookupMs,
          persistentRangeBuildMs: result.performance.persistentRangeBuildMs,
          delegatedSourceMs: result.performance.delegatedSourceMs,
          sidecarManifestMs: result.performance.sidecarManifestMs,
          sidecarFileOpenMs: result.performance.sidecarFileOpenMs,
          sidecarBlobReadMs: result.performance.sidecarBlobReadMs,
          sidecarDecodeMs: result.performance.sidecarDecodeMs,
          sidecarRangeBuildMs: result.performance.sidecarRangeBuildMs,
          });
          completedSteps += 1;
        } catch {
          // Keep already decoded coverage visible if a progressive refill fails.
          break;
        }
      }
    }
  };

  const scheduleViewportRefresh = (): void => {
    viewportRefreshGeneration += 1;
    const generation = viewportRefreshGeneration;
    const delayMs = nextViewportRefreshDelayMs;
    nextViewportRefreshDelayMs = VIEWPORT_REFRESH_DEFAULT_DELAY_MS;
    if (viewportRefreshTimer !== undefined) window.clearTimeout(viewportRefreshTimer);
    viewportRefreshTimer = window.setTimeout(() => {
      viewportRefreshTimer = undefined;
      void refreshActiveViewportRanges(generation);
    }, delayMs);
  };

  const activateCachedChannel = async (
    channelId: string,
    pending: PendingTrace,
  ): Promise<boolean> => {
    if (!channelData) return false;
    const now = (): number => globalThis.performance?.now() ?? Date.now();
    const readStart = now();
    try {
      const result = channelData.readChannelsRange
        ? await channelData.readChannelsRange([channelId], 0, channelData.sampleCount)
        : {
            ranges: new Map([[channelId, await channelData.readChannelRange(
              channelId,
              0,
              channelData.sampleCount,
            )]]),
            performance: {
              channelCount: 1,
              cacheHitChannelIds: [] as readonly string[],
              physicalReadCount: 0,
              physicalBytesRead: 0,
              physicalReadMs: 0,
            },
          };
      const readDecodeMs = now() - readStart;
      const range = result.ranges.get(channelId);
      if (!range) return false;

      const scaleStart = now();
      const fullStatistics = summarizeRange(range);
      const scale = stableScaleFromStatistics(fullStatistics);
      const scaleMs = now() - scaleStart;
      const usedColors = new Set([...activeTraces.values()].map((trace) => trace.color));
      const color = TRACE_COLORS.find((candidate) => !usedColors.has(candidate)) ?? TRACE_COLORS[0];
      activeTraces.set(channelId, {
        channel: pending.channel,
        range,
        scale,
        fullStatistics,
        statisticsComplete: true,
        color,
      });
      overlay.hidden = true;
      renderReadout();
      emitCursorValues();
      const renderStart = now();
      draw();
      const renderMs = now() - renderStart;
      const completedMs = now();

      channelPerformanceListener?.({
        channelId,
        phase: 'cache',
        startSampleIndex: 0,
        requestedSampleCount: channelData.sampleCount,
        totalMs: completedMs - pending.startedMs,
        readDecodeMs,
        scaleMs,
        renderMs,
        sampleCount: range.values.length,
        batchSize: 1,
        cacheHit: result.performance.cacheHitChannelIds.includes(channelId),
        physicalReadCount: result.performance.physicalReadCount,
        physicalBytesRead: result.performance.physicalBytesRead,
        physicalReadMs: result.performance.physicalReadMs,
      });
      return true;
    } catch {
      return false;
    }
  };

  const setLog = (
    nextChannels: readonly ChannelDefinition[],
    nextChannelData: NumericChannelDataSource,
    nextTimeRange: LogTimeRange | undefined,
  ): void => {
    channels = nextChannels;
    channelData = nextChannelData;
    precomputedEnvelopeBlocksEnabled = true;
    timeRange = nextTimeRange;
    viewport = nextTimeRange
      ? {
          fullStartMs: nextTimeRange.startMs,
          fullEndMs: nextTimeRange.endMs,
          visibleStartMs: nextTimeRange.startMs,
          visibleEndMs: nextTimeRange.endMs,
        }
      : undefined;
    cancelPending();
    viewportRefreshGeneration += 1;
    if (viewportRefreshTimer !== undefined) {
      window.clearTimeout(viewportRefreshTimer);
      viewportRefreshTimer = undefined;
    }
    materializingTraceIds.clear();
    for (const timer of materializationTimers.values()) window.clearTimeout(timer);
    materializationTimers.clear();
    activeTraces.clear();
    envelopeCache.clear();
    cursorTimeMs = nextTimeRange?.startMs ?? 0;
    aTimeMs = undefined;
    bTimeMs = undefined;
    overlay.hidden = assignedChannels.length > 0;
    overlayTitle.textContent = 'Select channels';
    overlayDetail.textContent = `Choose up to ${MAX_ACTIVE_TRACES} channels from Full Sensor List to graph them.`;
    renderReadout();
    emitCursorValues();
    toast.hidden = true;
    if (toastTimer !== undefined) {
      window.clearTimeout(toastTimer);
      toastTimer = undefined;
    }
    draw();
  };

  const activatePreloadedChannels = (
    ranges: ReadonlyMap<string, NumericChannelRange>,
  ): GraphPreloadedActivationResult => {
    const now = (): number => globalThis.performance?.now() ?? Date.now();
    const totalStarted = now();
    if (ranges.size === 0) {
      return {
        activatedChannelIds: [],
        performance: {
          totalMs: now() - totalStarted,
          channelLookupMs: 0,
          statisticsScaleMs: 0,
          traceRegistrationMs: 0,
          readoutMs: 0,
          cursorMs: 0,
          drawMs: 0,
          envelopeMs: 0,
          drawSetupMs: 0,
          drawTraceMs: 0,
          drawOverlayMs: 0,
        },
      };
    }

    cancelPending();
    const activated: string[] = [];
    const usedColors = new Set([...activeTraces.values()].map((trace) => trace.color));
    let channelLookupMs = 0;
    let statisticsScaleMs = 0;
    let traceRegistrationMs = 0;

    for (const [channelId, range] of ranges) {
      if (activeTraces.has(channelId) || activeTraces.size >= MAX_ACTIVE_TRACES) continue;
      const lookupStarted = now();
      const channel = channels.find((candidate) => candidate.id === channelId);
      channelLookupMs += now() - lookupStarted;
      if (!channel) continue;

      const statisticsStarted = now();
      const fullStatistics = range.fullStatistics ?? summarizeRange(range);
      const scale = stableScaleFromStatistics(fullStatistics);
      statisticsScaleMs += now() - statisticsStarted;

      const registrationStarted = now();
      const color = TRACE_COLORS.find((candidate) => !usedColors.has(candidate)) ?? TRACE_COLORS[0];
      usedColors.add(color);
      activeTraces.set(channelId, {
        channel,
        range,
        scale,
        fullStatistics,
        statisticsComplete: range.startSampleIndex === 0
          && range.values.length === channelData?.sampleCount,
        color,
      });
      activated.push(channelId);
      traceRegistrationMs += now() - registrationStarted;
    }

    overlay.hidden = activeTraces.size > 0;
    const readoutStarted = now();
    renderReadout();
    const readoutMs = now() - readoutStarted;
    const cursorStarted = now();
    emitCursorValues();
    const cursorMs = now() - cursorStarted;
    measuredEnvelopeBuildMs = 0;
    measuredDrawSetupMs = 0;
    measuredDrawTraceMs = 0;
    measuredDrawOverlayMs = 0;
    measureEnvelopeBuild = true;
    const drawStarted = now();
    try {
      draw();
    } finally {
      measureEnvelopeBuild = false;
    }
    const drawMs = now() - drawStarted;
    const envelopeMs = measuredEnvelopeBuildMs;

    return {
      activatedChannelIds: activated,
      performance: {
        totalMs: now() - totalStarted,
        channelLookupMs,
        statisticsScaleMs,
        traceRegistrationMs,
        readoutMs,
        cursorMs,
        drawMs,
        envelopeMs,
        drawSetupMs: measuredDrawSetupMs,
        drawTraceMs: measuredDrawTraceMs,
        drawOverlayMs: measuredDrawOverlayMs,
      },
    };
  };

  const toggleChannel = async (channelId: string): Promise<boolean> => {
    const queued = pendingTraces.get(channelId);
    if (queued) {
      pendingTraces.delete(channelId);
      queued.resolve(false);
      emitPendingChannels();
      return false;
    }

    if (loadingTraceIds.has(channelId)) return false;

    const existing = activeTraces.get(channelId);
    if (existing) {
      activeTraces.delete(channelId);
      envelopeCache.delete(channelId);
      overlay.hidden = activeTraces.size > 0 || assignedChannels.length > 0;
      if (activeTraces.size === 0 && assignedChannels.length === 0) {
        overlay.hidden = false;
        overlayTitle.textContent = 'Select channels';
        overlayDetail.textContent = `Choose up to ${MAX_ACTIVE_TRACES} channels from Full Sensor List to graph them.`;
      }
      renderReadout();
      emitCursorValues();
      draw();
      return false;
    }

    if (!channelData) return false;
    if (
      activeTraces.size
      + pendingTraces.size
      + loadingTraceIds.size
      >= MAX_ACTIVE_TRACES
    ) {
      overlay.hidden = activeTraces.size > 0;
      showToast(`Trace limit reached — EpicScope currently allows up to ${MAX_ACTIVE_TRACES} simultaneous Web traces.`);
      return false;
    }

    const channel = channels.find((candidate) => candidate.id === channelId);
    if (!channel) return false;

    const now = (): number => globalThis.performance?.now() ?? Date.now();
    let resolveSelection!: (active: boolean) => void;
    const result = new Promise<boolean>((resolve) => {
      resolveSelection = resolve;
    });
    const pending: PendingTrace = {
      channel,
      startedMs: now(),
      resolve: resolveSelection,
    };

    const cacheReady = channelData.hasCachedChannelRange?.(
      channelId,
      0,
      channelData.sampleCount,
    ) ?? false;

    if (cacheReady) {
      overlay.hidden = false;
      overlayTitle.textContent = `Loading ${channel.sourceName}…`;
      overlayDetail.textContent = 'Using decoded channel cache.';
      void activateCachedChannel(channelId, pending).then(resolveSelection);
      return result;
    }

    pendingTraces.set(channelId, pending);
    emitPendingChannels();
    overlay.hidden = false;

    if (channelData.requiresExplicitBatchSelection) {
      overlayTitle.textContent = `${pendingTraces.size} channel${pendingTraces.size === 1 ? '' : 's'} selected`;
      overlayDetail.textContent = 'Choose the remaining channels, then move back to the graph to load them together.';
      return result;
    }

    overlayTitle.textContent = decodeInFlight
      ? 'Queued for next channel pass…'
      : `Loading ${channel.sourceName}…`;
    overlayDetail.textContent = decodeInFlight
      ? `${pendingTraces.size} channel${pendingTraces.size === 1 ? '' : 's'} waiting; they will share the next sequential pass.`
      : 'Starting one sequential log pass. Additional selections made while it runs will be grouped.';

    if (!decodeInFlight) void flushPending();
    return result;
  };

  const clearChannels = (options: { readonly render?: boolean } = {}): void => {
    cancelPending();
    viewportRefreshGeneration += 1;
    if (viewportRefreshTimer !== undefined) {
      window.clearTimeout(viewportRefreshTimer);
      viewportRefreshTimer = undefined;
    }
    materializingTraceIds.clear();
    for (const timer of materializationTimers.values()) window.clearTimeout(timer);
    materializationTimers.clear();
    activeTraces.clear();
    envelopeCache.clear();
    if (options.render !== false) renderReadout();
    if (options.render !== false) emitCursorValues();
    overlay.hidden = assignedChannels.length > 0;
    overlayTitle.textContent = 'Select channels';
    overlayDetail.textContent = `Choose up to ${MAX_ACTIVE_TRACES} channels from Full Sensor List to graph them.`;
    if (options.render !== false) draw();
  };

  const setCursorTime = (timeMs: number): void => {
    if (!timeRange) return;
    cursorTimeMs = Math.min(timeRange.endMs, Math.max(timeRange.startMs, timeMs));
    emitCursorValues();
    renderReadout();
    draw();
  };

  const setViewport = (nextViewport: TimelineViewport | undefined): void => {
    viewport = nextViewport;
    const logicalThreads = Math.max(1, globalThis.navigator?.hardwareConcurrency ?? 1);
    if (logicalThreads <= 3) {
      for (const [channelId, trace] of activeTraces) {
        if (!trace.statisticsComplete && !materializingTraceIds.has(channelId)) {
          scheduleMaterialization(channelId);
        }
      }
    }
    scheduleViewportRefresh();
    draw();
  };

  const refreshValidity = (): void => {
    // Priority envelope blocks are computed before CRC validation; once source
    // validity changes, fall back to authoritative raw samples for exact redraws.
    precomputedEnvelopeBlocksEnabled = false;
    envelopeCache.clear();
    emitCursorValues();
    draw();
  };

  const clear = (): void => {
    cancelPending();
    channels = [];
    channelData = undefined;
    timeRange = undefined;
    viewport = undefined;
    activeTraces.clear();
    assignedChannels = [];
    envelopeCache.clear();
    cursorTimeMs = 0;
    aTimeMs = undefined;
    bTimeMs = undefined;
    overlay.hidden = false;
    overlayTitle.textContent = 'Open a log to start scoping';
    overlayDetail.textContent = 'The graph will use normalized local channel data.';
    renderReadout();
    emitCursorValues();
    draw();
  };

  clear();
  return {
    element: root,
    setLog,
    toggleChannel,
    activatePreloadedChannels,
    clearChannels,
    getOverviewTraces: () => [...activeTraces.entries()].map(([channelId, trace]) => ({
      channelId,
      channelName: trace.channel.sourceName,
      range: trace.range,
      color: trace.color,
    })),
    getChannelStatistics: (channelId) => {
      const trace = activeTraces.get(channelId);
      if (!trace) return undefined;
      const full = trace.statisticsComplete
        ? trace.fullStatistics
        : summarizeRange(trace.range);
      const visible = viewport
        ? summarizeRange(trace.range, viewport.visibleStartMs, viewport.visibleEndMs)
        : full;
      return {
        channelId,
        current: nearestValue(trace.range, cursorTimeMs),
        full: { ...full, complete: trace.statisticsComplete },
        visible: {
          validCount: visible.validCount,
          min: visible.min,
          max: visible.max,
          mean: visible.mean,
        },
      };
    },
    setCursorTime,
    setViewport,
    setAnalysisRange: (nextA, nextB) => {
      aTimeMs = nextA;
      bTimeMs = nextB;
      draw();
    },
    onZoom: (listener) => { zoomListener = listener; },
    onPan: (listener) => { panListener = listener; },
    onCursorValues: (listener) => { cursorValuesListener = listener; },
    onChannelPerformance: (listener) => { channelPerformanceListener = listener; },
    onPendingChannelsChanged: (listener) => { pendingChannelsListener = listener; },
    loadPendingChannels: () => { if (!decodeInFlight) void flushPending(); },
    refreshValidity,
    setHighZoomSamplePointsVisible: (visible) => {
      highZoomSamplePointsVisible = visible;
      draw();
    },
    setAssignedChannels: (nextChannels) => {
      assignedChannels = nextChannels.slice(0, MAX_ACTIVE_TRACES);
      overlay.hidden = assignedChannels.length > 0 || activeTraces.size > 0;
      renderReadout();
      draw();
    },
    setDisplayMode: (mode) => {
      if (displayMode === mode) return;
      displayMode = mode;
      root.classList.toggle('graph-viewport--stacked', mode === 'stacked');
      renderReadout();
      draw();
    },
    clear,
  };
}
