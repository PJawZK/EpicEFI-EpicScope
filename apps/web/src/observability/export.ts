import type { DiagnosticsCapture } from './diagnostics';
/** Explicit export preserves the whole captured evidence, independent of UI filters/pages. */
export function structuredDiagnostics(capture: DiagnosticsCapture) {
  return { schemaVersion: 1, capturedAt: capture.capturedAt, sessionId: capture.sessionId,
    scope: 'full-local-diagnostics', note: 'May contain filenames, environment details, diagnostic messages and stacks. No raw log/tune/INI file contents. Retention loss is explicit; no crash causality is inferred.',
    health: capture.health, retention: capture.retention, anomalyTracking: capture.anomalyTracking,
    records: capture.records, parserDiagnostics: capture.parserDiagnostics,
    performanceReport: capture.performanceReport, parserReport: capture.parserReport, resources: capture.resources,
    persistence: capture.persistence,
  };
}
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => { let c = n; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const yieldTask = () => new Promise<void>(resolve => globalThis.setTimeout(resolve, 0));
/** Standard ZIP (stored entries), CRC in bounded chunks. No dependency/network upload. */
export async function buildDiagnosticsBundle(capture: DiagnosticsCapture, signal?: AbortSignal): Promise<Blob> {
  const check = () => { if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError'); };
  check(); await yieldTask(); check();
  const encoder = new TextEncoder();
  const files = [{ name: 'report.txt', bytes: encoder.encode(capture.reportText) }, { name: 'observability.json', bytes: encoder.encode(JSON.stringify(structuredDiagnostics(capture), null, 2)) }];
  const body: Uint8Array<ArrayBuffer>[] = [], directory: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0, directorySize = 0;
  for (const file of files) {
    if (file.bytes.length > 0xffffffff - offset) throw new RangeError('Diagnostic bundle exceeds ZIP32 limit');
    let crc = 0xffffffff;
    for (let start = 0; start < file.bytes.length; start += 65536) {
      check(); const end = Math.min(file.bytes.length, start + 65536);
      for (let i = start; i < end; i++) crc = crcTable[(crc ^ file.bytes[i]!) & 255]! ^ (crc >>> 8);
      if (end < file.bytes.length) await yieldTask();
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const name = encoder.encode(file.name), header = new Uint8Array(30 + name.length), h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint16(12, 33, true);
    h.setUint32(14, crc, true); h.setUint32(18, file.bytes.length, true); h.setUint32(22, file.bytes.length, true); h.setUint16(26, name.length, true); header.set(name, 30);
    const central = new Uint8Array(46 + name.length), c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true); c.setUint16(14, 33, true);
    c.setUint32(16, crc, true); c.setUint32(20, file.bytes.length, true); c.setUint32(24, file.bytes.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true); central.set(name, 46);
    body.push(header, file.bytes); directory.push(central); offset += header.length + file.bytes.length; directorySize += central.length;
  }
  check();
  const end = new Uint8Array(22), view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true); view.setUint16(8, files.length, true); view.setUint16(10, files.length, true); view.setUint32(12, directorySize, true); view.setUint32(16, offset, true);
  return new Blob([...body, ...directory, end], { type: 'application/zip' });
}
