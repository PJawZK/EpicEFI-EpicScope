import { createOrderedBridgeLookup } from './source-integrity-bridges';
import type { NumericChannelRange } from '../../../../core/log-model/log-types';
import type { SourceIntegrityMarker } from '../app/source-integrity-markers';

const MAX_RENDERED_VIEWPORT_SPAN_MS = 120_000;
const HIT_RADIUS_PX = 12;
const ICON_RADIUS_PX = 8;
const BRIDGE_DASH = [3, 4] as const;

export interface SourceIntegrityOverlayTrace {
  readonly range: NumericChannelRange;
  readonly color: string;
  readonly valueMin: number;
  readonly valueMax: number;
  readonly top: number;
  readonly height: number;
}

export interface SourceIntegrityOverlayDrawContext {
  readonly width: number;
  readonly height: number;
  readonly inset: number;
  readonly visibleStartMs: number;
  readonly visibleEndMs: number;
  readonly traces: readonly SourceIntegrityOverlayTrace[];
  xForTime(timeMs: number): number;
}

export interface SourceIntegrityCanvasOverlay {
  /** Markers are ordered by source-relative time by the Logger projection. */
  setMarkers(markers: readonly SourceIntegrityMarker[]): void;
  dismissNotice(target: Node): void;
  dispose(): void;
  draw(
    context: CanvasRenderingContext2D,
    layout: SourceIntegrityOverlayDrawContext,
  ): void;
}

interface MarkerHitTarget {
  readonly x: number;
  readonly y: number;
  readonly marker: SourceIntegrityMarker;
}

function formatElapsedTime(timeMs: number): string {
  const safe = Math.max(0, timeMs);
  const totalSeconds = Math.floor(safe / 1000);
  const milliseconds = Math.floor(safe % 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

function markerExplanation(marker: SourceIntegrityMarker): string {
  const at = formatElapsedTime(marker.timeMs);
  if (marker.kind === 'corrupt-record') {
    const count = marker.count > 1 ? `${marker.count} CRC-invalid source records` : 'CRC-invalid source record';
    return `Imported log data issue at ${at} · ${count}. The dotted bridge spans data EpicScope cannot trust; the solid trace resumes at the next trusted sample.`;
  }
  if (marker.kind === 'timestamp-gap') {
    return `Imported log data issue at ${at} · timestamp/data gap. The dotted bridge marks the interval where source data is missing.`;
  }
  if (marker.kind === 'delivery-loss') {
    return `Recorded source data issue at ${at} · delivery loss. The dotted bridge marks the interval where source data is missing.`;
  }
  return `Recovered logger retry at ${at} · a valid same-timestamp replacement is available, so trace continuity is preserved.`;
}

function nearestHit(
  targets: readonly MarkerHitTarget[],
  x: number,
  y: number,
): MarkerHitTarget | undefined {
  let best: MarkerHitTarget | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    const distance = Math.hypot(target.x - x, target.y - y);
    if (distance <= HIT_RADIUS_PX && distance < bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }
  return best;
}

function markerLowerBound(markers: readonly SourceIntegrityMarker[], timeMs: number): number {
  let low = 0, high = markers.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (markers[middle]!.timeMs < timeMs) low = middle + 1;
    else high = middle;
  }
  return low;
}

function yForValue(trace: SourceIntegrityOverlayTrace, value: number): number {
  const span = Math.max(1e-9, trace.valueMax - trace.valueMin);
  const normalized = (value - trace.valueMin) / span;
  return trace.top + trace.height - normalized * trace.height;
}

export function createSourceIntegrityCanvasOverlay(
  canvas: HTMLCanvasElement,
  showMessage: (message: string) => void,
): SourceIntegrityCanvasOverlay {
  let markers: readonly SourceIntegrityMarker[] = [];
  let disposed = false;
  let hitTargets: readonly MarkerHitTarget[] = [];

  const graphRoot = canvas.closest<HTMLElement>('.graph-viewport');
  const notice = graphRoot?.querySelector<HTMLElement>('.graph-toast');
  const noticeMessage = graphRoot?.querySelector<HTMLElement>('.graph-toast-message');

  const hideNotice = (): void => {
    if (!notice) return;
    notice.hidden = true;
    notice.classList.remove('graph-toast--leaving');
  };

  const showPersistentNotice = (message: string): void => {
    if (!notice || !noticeMessage) {
      showMessage(message);
      return;
    }
    noticeMessage.textContent = message;
    notice.hidden = false;
    notice.classList.remove('graph-toast--leaving');
  };

  const onClick = (event: MouseEvent): void => {
    if (disposed) return;
    if (hitTargets.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const hit = nearestHit(
      hitTargets,
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
    if (!hit) return;
    showPersistentNotice(markerExplanation(hit.marker));
  };
  canvas.addEventListener('click', onClick);

  return {
    setMarkers(nextMarkers) {
      if (disposed || markers === nextMarkers) return;
      markers = nextMarkers;
      hitTargets = [];
      hideNotice();
    },
    dismissNotice(target) {
      if (!disposed && notice && !notice.contains(target)) hideNotice();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      markers = [];
      hitTargets = [];
      hideNotice();
      canvas.removeEventListener('click', onClick);
    },
    draw: (context, layout) => {
      hitTargets = [];
      const span = layout.visibleEndMs - layout.visibleStartMs;
      if (
        disposed
        || span <= 0
        || span > MAX_RENDERED_VIEWPORT_SPAN_MS
        || markers.length === 0
        || layout.traces.length === 0
      ) {
        return;
      }

      const start = markerLowerBound(markers, layout.visibleStartMs);
      if (start >= markers.length || markers[start]!.timeMs > layout.visibleEndMs) return;
      const lookups = layout.traces.map(trace => ({ trace, lookup: createOrderedBridgeLookup(trace.range) }));

      const nextTargets: MarkerHitTarget[] = [];
      context.save();
      context.font = '700 10px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      for (let index = start; index < markers.length; index += 1) {
        const marker = markers[index]!;
        if (marker.timeMs > layout.visibleEndMs) break;
        if (!marker.breaksContinuity) continue;
        const bridges = [];
        for (const { trace, lookup } of lookups) {
          const bridge = lookup(marker.timeMs);
          if (bridge) bridges.push({ trace, bridge });
        }

        let markerX = layout.xForTime(marker.timeMs);
        if (bridges.length > 0) {
          const first = bridges[0]!;
          markerX = (
            layout.xForTime(first.bridge.before.timeMs)
            + layout.xForTime(first.bridge.after.timeMs)
          ) / 2;
        }
        if (markerX < layout.inset || markerX > layout.width - layout.inset) continue;

        for (const { trace, bridge } of bridges) {
          const x1 = layout.xForTime(bridge.before.timeMs);
          const x2 = layout.xForTime(bridge.after.timeMs);
          const y1 = yForValue(trace, bridge.before.value);
          const y2 = yForValue(trace, bridge.after.value);

          context.strokeStyle = trace.color;
          context.globalAlpha = 0.78;
          context.lineWidth = 1.15;
          context.setLineDash([...BRIDGE_DASH]);
          context.beginPath();
          context.moveTo(x1, y1);
          context.lineTo(x2, y2);
          context.stroke();
          context.setLineDash([]);
          context.globalAlpha = 1;

          context.fillStyle = trace.color;
          context.beginPath();
          context.arc(x1, y1, 1.8, 0, Math.PI * 2);
          context.arc(x2, y2, 1.8, 0, Math.PI * 2);
          context.fill();
        }

        const markerY = Math.min(
          layout.height - layout.inset - ICON_RADIUS_PX,
          Math.max(layout.inset + ICON_RADIUS_PX, layout.height / 2),
        );
        context.fillStyle = 'rgba(22, 28, 33, 0.96)';
        context.strokeStyle = 'rgba(239, 108, 117, 0.98)';
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(markerX, markerY, ICON_RADIUS_PX, 0, Math.PI * 2);
        context.fill();
        context.stroke();

        context.fillStyle = 'rgba(255, 221, 224, 0.98)';
        context.fillText('!', markerX, markerY + 0.5);
        nextTargets.push({ x: markerX, y: markerY, marker });
      }

      context.restore();
      hitTargets = nextTargets;
    },
  };
}
