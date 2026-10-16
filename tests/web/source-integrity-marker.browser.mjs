// Real-browser check for the canvas source-integrity bridge and click explanation.
import { createGraphViewport } from '../../apps/web/src/components/graph-viewport';
import { SOURCE_INTEGRITY_DIAGNOSTICS_EVENT } from '../../apps/web/src/app/source-integrity-events';

function batchPerformance(channelCount) {
  return {
    channelCount,
    cacheHitChannelIds: [],
    physicalReadCount: 0,
    physicalBytesRead: 0,
    physicalReadMs: 0,
  };
}

export async function runSourceIntegrityMarkerChecks() {
  const checks = [];
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const graph = createGraphViewport();
  graph.element.style.width = '800px';
  graph.element.style.height = '280px';
  document.body.append(graph.element);

  const channel = { id: 'rpm', sourceName: 'RPM', displayName: 'RPM', unit: 'rpm', valueType: 'number' };
  const sampleCount = 101;
  const source = {
    sampleCount,
    sampleRangeForTime(startMs, endMs) {
      const start = Math.max(0, Math.floor(Math.min(startMs, endMs) / 10));
      const end = Math.min(sampleCount, Math.ceil(Math.max(startMs, endMs) / 10) + 1);
      return { startSampleIndex: start, sampleCount: Math.max(0, end - start) };
    },
    async readChannelRange(_id, start, count) {
      const validity = new Uint8Array(count).fill(1);
      const corruptLocalIndex = 50 - start;
      if (corruptLocalIndex >= 0 && corruptLocalIndex < count) validity[corruptLocalIndex] = 0;
      return {
        startSampleIndex: start,
        timeMs: Float64Array.from({ length: count }, (_, index) => (start + index) * 10),
        values: Float64Array.from({ length: count }, (_, index) => 1000 + start + index),
        validity,
      };
    },
    async readChannelsRange(ids, start, count) {
      const ranges = new Map();
      for (const id of ids) ranges.set(id, await this.readChannelRange(id, start, count));
      return { ranges, performance: batchPerformance(ids.length) };
    },
  };

  const full = { fullStartMs: 0, fullEndMs: 1000, visibleStartMs: 0, visibleEndMs: 1000 };
  const originalSetLineDash = CanvasRenderingContext2D.prototype.setLineDash;
  const originalMoveTo = CanvasRenderingContext2D.prototype.moveTo;
  const originalLineTo = CanvasRenderingContext2D.prototype.lineTo;
  let dotted = false;
  let pendingMove;
  const dottedSegments = [];
  CanvasRenderingContext2D.prototype.setLineDash = function(values) {
    dotted = Array.isArray(values) && values.length === 2 && values[0] === 3 && values[1] === 4;
    return originalSetLineDash.call(this, values);
  };
  CanvasRenderingContext2D.prototype.moveTo = function(x, y) {
    if (dotted) pendingMove = { x, y };
    return originalMoveTo.call(this, x, y);
  };
  CanvasRenderingContext2D.prototype.lineTo = function(x, y) {
    if (dotted && pendingMove) dottedSegments.push({ from: pendingMove, to: { x, y } });
    return originalLineTo.call(this, x, y);
  };

  try {
    graph.setLog([channel], source, { startMs: 0, endMs: 1000, durationMs: 1000 });
    graph.setViewport(full);
    await graph.toggleChannel('rpm');

    window.dispatchEvent(new CustomEvent(SOURCE_INTEGRITY_DIAGNOSTICS_EVENT, {
      detail: {
        markers: [{
          timeMs: 500,
          kind: 'corrupt-record',
          breaksContinuity: true,
          count: 1,
          message: 'Synthetic CRC failure',
        }],
      },
    }));
    dottedSegments.length = 0;
    graph.setViewport(full);
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    assert(dottedSegments.length > 0, 'Visible source corruption did not render a dotted trace bridge');
    const bridge = dottedSegments[0];
    assert(bridge.to.x > bridge.from.x && Math.abs(bridge.to.x - bridge.from.x) > 1, 'Integrity rendering used a vertical marker instead of spanning the trace interruption');
    checks.push('genuine source corruption renders a dotted bridge between trusted trace endpoints');

    const canvas = graph.element.querySelector('.graph-canvas');
    const rect = canvas.getBoundingClientRect();
    const markerX = rect.left + (bridge.from.x + bridge.to.x) / 2;
    const markerY = rect.top + rect.height / 2;
    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: markerX, clientY: markerY }));
    const message = graph.element.querySelector('.graph-toast-message')?.textContent ?? '';
    assert(message.includes('Imported log data issue') && message.includes('dotted bridge'), 'Marker click did not explain source/log corruption and bridge meaning');
    checks.push('pressing the fixed warning marker explains the source-data bridge');

    dottedSegments.length = 0;
    graph.setViewport({ fullStartMs: 0, fullEndMs: 180000, visibleStartMs: 0, visibleEndMs: 180000 });
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    assert(dottedSegments.length === 0, 'Integrity bridge remained rendered when zoomed beyond marker visibility range');
    checks.push('dotted trace bridges are suppressed when zoomed too far out to remain useful');

    return { passed: checks.length, checks };
  } finally {
    CanvasRenderingContext2D.prototype.setLineDash = originalSetLineDash;
    CanvasRenderingContext2D.prototype.moveTo = originalMoveTo;
    CanvasRenderingContext2D.prototype.lineTo = originalLineTo;
    graph.element.remove();
  }
}
