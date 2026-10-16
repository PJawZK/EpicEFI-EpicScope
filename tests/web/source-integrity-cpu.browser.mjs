import { createGraphViewport } from '../../apps/web/src/components/graph-viewport';
import { createSourceIntegrityCanvasOverlay } from '../../apps/web/src/components/source-integrity-canvas-overlay';
const assert = (ok, message) => { if (!ok) throw Error(message); };
export function runSourceIntegrityCpuChecks() {
  const checks = [], canvas = document.createElement('canvas');
  const overlay = createSourceIntegrityCanvasOverlay(canvas, () => {});
  const context = canvas.getContext('2d');
  const count = 320_005;
  let markerReads = 0, valueReads = 0;
  const markers = new Proxy(Array.from({ length: count }, (_, i) => ({ timeMs: i / 10, kind: 'corrupt-record', breaksContinuity: true, count: 1, message: 'CRC' })), {
    get(target, key) {
      if (typeof key === 'string' && /^\d+$/.test(key) && ++markerReads > 100) throw Error('Scanned offscreen markers');
      return Reflect.get(target, key, target);
    },
  });
  const trace = { range: { startSampleIndex: 0, timeMs: new Float64Array([0, 32001]), values: new Float64Array([1, 2]), validity: new Uint8Array([1, 1]) }, color: '#fff', valueMin: 0, valueMax: 3, top: 0, height: 100 };
  const layout = { width: 800, height: 100, inset: 0, visibleStartMs: 16000, visibleEndMs: 16000.1, traces: [trace], xForTime: t => (t - 16000) * 8000 };
  try {
    overlay.setMarkers(markers); overlay.draw(context, layout);
    assert(markerReads <= 100, 'Offscreen marker selection is not bounded');
    checks.push('>320k sorted markers select a narrow viewport without a full-list pass');
    const values = new Proxy(new Float64Array(count).fill(1), {
      get(target, key) {
        if (typeof key === 'string' && /^\d+$/.test(key) && ++valueReads > count * 4) throw Error('Repeated invalid-span searches');
        return Reflect.get(target, key, target);
      },
    });
    const validity = new Uint8Array(count); validity[0] = 1; validity[count - 1] = 1;
    const dense = Array.from({ length: 4096 }, (_, i) => ({ timeMs: (1 + i * 70) / 10, kind: 'corrupt-record', breaksContinuity: true, count: 1, message: 'CRC' }));
    trace.range = { startSampleIndex: 0, timeMs: Float64Array.from({ length: count }, (_, i) => i / 10), values, validity };
    overlay.setMarkers(dense);
    overlay.draw(context, { ...layout, visibleStartMs: 0, visibleEndMs: 32001, xForTime: t => t / 40 });
    assert(valueReads <= count * 4, 'Dense marker traversal exceeded bounded reads');
    checks.push('4096 markers share bounded traversal across a >320k-record invalid span');
    const graph = createGraphViewport();
    let preparedReads = 0;
    const preparedValues = new Proxy(Float64Array.from({ length: count }, (_, i) => i), {
      get(target, key) {
        if (typeof key === 'string' && /^\d+$/.test(key) && ++preparedReads > 100) throw Error('Prepared activation rescanned sample values');
        return Reflect.get(target, key, target);
      },
    });
    try {
      graph.setLog([{ id: 'rpm', sourceName: 'RPM', displayName: 'RPM', unit: 'rpm', valueType: 'number' }], { sampleCount: count, async readChannelRange() { throw Error('Prepared activation must not read source'); } }, undefined);
      const result = graph.activatePreloadedChannels(new Map([['rpm', {
        startSampleIndex: 0, timeMs: Float64Array.from({ length: count }, (_, i) => i), values: preparedValues, validity: new Uint8Array(count).fill(1),
        fullStatistics: { validCount: count, invalidCount: 0, min: 0, max: count - 1, mean: (count - 1) / 2, standardDeviation: 0 },
      }]]));
      assert(result.activatedChannelIds[0] === 'rpm' && preparedReads <= 100, 'Prepared statistics were not reused');
      checks.push('prepared >320k-record activation reuses supplied statistics without a full scale scan');
    } finally { graph.clear(); graph.disposeSourceIntegrity(); }
    return { passed: checks.length, checks, observed: { markerReads, valueReads, records: count } };
  } finally { overlay.dispose(); }
}
