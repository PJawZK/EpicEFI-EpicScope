// Real-browser check for the canvas source-integrity bridge and click explanation.
import { buildRawViewportSeries } from '../../core/timeline/viewport-series';
import { createGraphViewport } from '../../apps/web/src/components/graph-viewport';
import { createParserDiagnosticsIndicator } from '../../apps/web/src/components/parser-diagnostics-indicator';

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
    const count = 320_005;
    for (const recovered of [false, true]) {
      const timeMs = new Float64Array(count).fill(10);
      const values = new Float64Array(count).fill(99);
      const validity = new Uint8Array(count);
      timeMs[0] = 0; values[0] = 1; validity[0] = 1;
      timeMs[count - 1] = 20; values[count - 1] = 3; validity[count - 1] = 1;
      if (recovered) { values[count - 2] = 2; validity[count - 2] = 1; }
      const points = buildRawViewportSeries({ startSampleIndex: 0, timeMs, values, validity }, 0, 20);
      assert(points.length === (recovered ? 3 : 2) && points[0].breakBefore && points.at(-1).breakBefore === !recovered, 'Large retry run changed source-gap continuity');
      if (recovered) assert(points[1].timeMs === 10 && points[1].value === 2 && !points[1].breakBefore, 'Large retry run lost its valid replacement');
      checks.push(`>320k retry samples preserve continuity with replacement=${recovered}`);
    }
    const range = {
      startSampleIndex: 0,
      timeMs: Float64Array.from({ length: count }, (_, i) => i),
      values: Float64Array.from({ length: count }, (_, i) => i),
      validity: new Uint8Array(count).fill(1),
    };
    const points = buildRawViewportSeries(range, 0, count - 1);
    assert(points.length === count && points[0].breakBefore && points.slice(1).every(point => !point.breakBefore) && points.at(-1).value === count - 1, 'Continuous large raw series lost samples or introduced gaps');
    checks.push('>320k continuous valid raw samples remain complete without artificial gaps');

    graph.setLog([channel], source, { startMs: 0, endMs: 1000, durationMs: 1000 });
    graph.setViewport(full);
    await graph.toggleChannel('rpm');

    const markers = [{ timeMs: 500, kind: 'corrupt-record', breaksContinuity: true, count: 1, message: 'Synthetic CRC failure' }];
    graph.setSourceIntegrity(source, markers);
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
    const notice = graph.element.querySelector('.graph-toast');
    const message = graph.element.querySelector('.graph-toast-message')?.textContent ?? '';
    assert(message.includes('Imported log data issue') && message.includes('dotted bridge'), 'Marker click did not explain source/log corruption and bridge meaning');
    assert(notice && !notice.hidden, 'Source-integrity explanation did not remain visible after marker press');
    checks.push('pressing the fixed warning marker opens a persistent source-data explanation');

    await new Promise((resolve) => setTimeout(resolve, 3500));
    assert(!notice.hidden, 'Source-integrity explanation still auto-dismissed on a timer');
    checks.push('source-integrity explanation does not disappear on a timer');

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    graph.dismissSourceIntegrityNotice(document.body);
    assert(notice.hidden, 'Outside press did not dismiss the source-integrity explanation');
    checks.push('host-routed outside press dismisses the source-integrity explanation');

    dottedSegments.length = 0;
    graph.setViewport({ fullStartMs: 0, fullEndMs: 180000, visibleStartMs: 0, visibleEndMs: 180000 });
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    assert(dottedSegments.length === 0, 'Integrity bridge remained rendered when zoomed beyond marker visibility range');
    checks.push('dotted trace bridges are suppressed when zoomed too far out to remain useful');

    graph.setViewport(full);
    const unrelated = createParserDiagnosticsIndicator();
    unrelated.setDiagnostics([]);
    dottedSegments.length = 0;
    graph.setViewport(full);
    assert(dottedSegments.length > 0, 'An unrelated Parser view cleared graph-owned integrity state');
    checks.push('unrelated Parser UI updates cannot clear graph integrity state');

    graph.clearChannels();
    await graph.toggleChannel('rpm');
    dottedSegments.length = 0;
    graph.setViewport(full);
    assert(dottedSegments.length > 0, 'Workspace-style channel restoration lost retained markers');
    checks.push('channel restoration retains current source integrity without republishing diagnostics');

    const replacement = { ...source };
    graph.setLog([channel], replacement, { startMs: 0, endMs: 1000, durationMs: 1000 });
    graph.setViewport(full);
    await graph.toggleChannel('rpm');
    dottedSegments.length = 0;
    graph.setSourceIntegrity(source, markers);
    graph.setViewport(full);
    assert(dottedSegments.length === 0, 'An obsolete data source populated replacement markers');
    graph.setSourceIntegrity(replacement, markers);
    assert(dottedSegments.length > 0, 'Replacement source did not receive explicit markers');
    checks.push('source replacement clears markers and rejects obsolete source delivery');

    dottedSegments.length = 0;
    graph.disposeSourceIntegrity();
    graph.disposeSourceIntegrity();
    graph.setSourceIntegrity(replacement, markers);
    graph.setViewport(full);
    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: markerX, clientY: markerY }));
    assert(dottedSegments.length === 0 && notice.hidden, 'Disposed overlay rendered or reopened evidence');
    graph.clear();
    graph.setSourceIntegrity(replacement, markers);
    assert(dottedSegments.length === 0, 'Cleared graph accepted obsolete markers');
    checks.push('overlay disposal is idempotent and prevents late rendering or popup reopening');

    return { passed: checks.length, checks };
  } finally {
    CanvasRenderingContext2D.prototype.setLineDash = originalSetLineDash;
    CanvasRenderingContext2D.prototype.moveTo = originalMoveTo;
    CanvasRenderingContext2D.prototype.lineTo = originalLineTo;
    graph.disposeSourceIntegrity();
    graph.element.remove();
  }
}
