// Real-browser check for the canvas source-integrity marker and click explanation.
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
      return {
        startSampleIndex: start,
        timeMs: Float64Array.from({ length: count }, (_, index) => (start + index) * 10),
        values: Float64Array.from({ length: count }, (_, index) => 1000 + start + index),
        validity: new Uint8Array(count).fill(1),
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
  let dottedDraws = 0;
  CanvasRenderingContext2D.prototype.setLineDash = function(values) {
    if (Array.isArray(values) && values.length === 2 && values[0] === 3 && values[1] === 4) dottedDraws += 1;
    return originalSetLineDash.call(this, values);
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
    dottedDraws = 0;
    graph.setViewport(full);
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    assert(dottedDraws > 0, 'Visible source corruption did not render a dotted marker line');
    checks.push('genuine source corruption renders a dotted graph marker at useful zoom');

    const canvas = graph.element.querySelector('.graph-canvas');
    const rect = canvas.getBoundingClientRect();
    const x = rect.left + 6 + 0.5 * Math.max(1, rect.width - 12);
    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: rect.top + 13 }));
    const message = graph.element.querySelector('.graph-toast-message')?.textContent ?? '';
    assert(message.includes('Imported log data issue') && message.includes('CRC-invalid source record'), 'Marker click did not explain source/log corruption');
    checks.push('pressing the marker explains that the discontinuity comes from imported log data');

    dottedDraws = 0;
    graph.setViewport({ fullStartMs: 0, fullEndMs: 180000, visibleStartMs: 0, visibleEndMs: 180000 });
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    assert(dottedDraws === 0, 'Integrity line remained rendered when zoomed beyond marker visibility range');
    checks.push('dotted marker line is suppressed when zoomed too far out to remain useful');

    return { passed: checks.length, checks };
  } finally {
    CanvasRenderingContext2D.prototype.setLineDash = originalSetLineDash;
    graph.element.remove();
  }
}
