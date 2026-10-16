import {
  SOURCE_INTEGRITY_DIAGNOSTICS_EVENT,
  type SourceIntegrityDiagnosticsEventDetail,
  type SourceIntegrityMarker,
} from '../app/source-integrity-events';

const MAX_RENDERED_VIEWPORT_SPAN_MS = 120_000;
const HIT_RADIUS_PX = 10;
const ICON_RADIUS_PX = 7;
const ICON_CENTER_Y_PX = 13;
const LINE_START_Y_PX = 22;

export interface SourceIntegrityOverlayDrawContext {
  readonly width: number;
  readonly height: number;
  readonly inset: number;
  readonly visibleStartMs: number;
  readonly visibleEndMs: number;
  xForTime(timeMs: number): number;
}

export interface SourceIntegrityCanvasOverlay {
  draw(
    context: CanvasRenderingContext2D,
    layout: SourceIntegrityOverlayDrawContext,
  ): void;
}

interface MarkerHitTarget {
  readonly x: number;
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
    return `Imported log data issue at ${at} · ${count}. EpicScope intentionally breaks the trace here because no trusted replacement is available.`;
  }
  if (marker.kind === 'timestamp-gap') {
    return `Imported log data issue at ${at} · timestamp/data gap. EpicScope intentionally shows the discontinuity.`;
  }
  if (marker.kind === 'delivery-loss') {
    return `Recorded source data issue at ${at} · delivery loss. EpicScope intentionally shows the discontinuity.`;
  }
  return `Recovered logger retry at ${at} · a valid same-timestamp replacement is available, so trace continuity is preserved.`;
}

function nearestHit(
  targets: readonly MarkerHitTarget[],
  x: number,
): MarkerHitTarget | undefined {
  let best: MarkerHitTarget | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    const distance = Math.abs(target.x - x);
    if (distance <= HIT_RADIUS_PX && distance < bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }
  return best;
}

export function createSourceIntegrityCanvasOverlay(
  canvas: HTMLCanvasElement,
  showMessage: (message: string) => void,
): SourceIntegrityCanvasOverlay {
  let markers: readonly SourceIntegrityMarker[] = [];
  let hitTargets: readonly MarkerHitTarget[] = [];

  window.addEventListener(SOURCE_INTEGRITY_DIAGNOSTICS_EVENT, (event) => {
    const detail = (event as CustomEvent<SourceIntegrityDiagnosticsEventDetail>).detail;
    markers = detail?.markers ?? [];
    hitTargets = [];
  });

  canvas.addEventListener('click', (event) => {
    if (hitTargets.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return;
    const hit = nearestHit(hitTargets, event.clientX - rect.left);
    if (!hit) return;
    showMessage(markerExplanation(hit.marker));
  });

  return {
    draw: (context, layout) => {
      hitTargets = [];
      const span = layout.visibleEndMs - layout.visibleStartMs;
      if (
        span <= 0
        || span > MAX_RENDERED_VIEWPORT_SPAN_MS
        || markers.length === 0
      ) {
        return;
      }

      const visible = markers.filter((marker) =>
        marker.breaksContinuity
        && marker.timeMs >= layout.visibleStartMs
        && marker.timeMs <= layout.visibleEndMs
      );
      if (visible.length === 0) return;

      const nextTargets: MarkerHitTarget[] = [];
      context.save();
      context.font = '700 9px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      for (const marker of visible) {
        const x = layout.xForTime(marker.timeMs);
        if (x < layout.inset || x > layout.width - layout.inset) continue;

        context.strokeStyle = 'rgba(239, 108, 117, 0.88)';
        context.lineWidth = 1;
        context.setLineDash([3, 4]);
        context.beginPath();
        context.moveTo(x + 0.5, LINE_START_Y_PX);
        context.lineTo(x + 0.5, layout.height - layout.inset);
        context.stroke();
        context.setLineDash([]);

        context.fillStyle = 'rgba(22, 28, 33, 0.96)';
        context.strokeStyle = 'rgba(239, 108, 117, 0.98)';
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(x, ICON_CENTER_Y_PX, ICON_RADIUS_PX, 0, Math.PI * 2);
        context.fill();
        context.stroke();

        context.fillStyle = 'rgba(255, 221, 224, 0.98)';
        context.fillText('!', x, ICON_CENTER_Y_PX + 0.5);

        context.fillStyle = 'rgba(239, 108, 117, 0.98)';
        context.beginPath();
        context.moveTo(x - 3, ICON_CENTER_Y_PX + ICON_RADIUS_PX - 1);
        context.lineTo(x + 3, ICON_CENTER_Y_PX + ICON_RADIUS_PX - 1);
        context.lineTo(x, LINE_START_Y_PX);
        context.closePath();
        context.fill();

        nextTargets.push({ x, marker });
      }

      context.restore();
      hitTargets = nextTargets;
    },
  };
}
