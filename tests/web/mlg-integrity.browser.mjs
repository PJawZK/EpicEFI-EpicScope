import { annotateMlgSourceIntegrityDiagnostics } from '../../core/parsers/mlg/mlg-integrity';
import { createScalarHeaderFixture } from '../logs/mlg-fixture-builder';
import { importMlgFile } from '../../apps/web/src/adapters/mlg-file-import';
import { importMlgFileStaged } from '../../apps/web/src/adapters/mlg-staged-import';
const assert = (ok, message) => { if (!ok) throw Error(message); };

export async function runMlgIntegrityChecks() {
  const checks = [], count = 320_005;
  let reads = 0;
  const offsets = new Proxy(Float64Array.from({ length: count }, (_, i) => 100 + i * 13), {
    get(target, key) {
      if (typeof key === 'string' && /^\d+$/.test(key) && ++reads > 100) throw Error('Annotation scanned full index');
      return Reflect.get(target, key, target);
    },
  });
  const index = { offsets, timeMs: Float64Array.from({ length: count }, (_, i) => i * 10), counters: new Uint8Array(count), crcValid: new Uint8Array(count) };
  const unrelated = [{ code: 'unrelated', severity: 'info', message: 'Info', recoverable: true }];
  assert(annotateMlgSourceIntegrityDiagnostics(index, unrelated, 5) === unrelated && reads === 0, 'Irrelevant annotation touched records or copied diagnostics');
  const samples = [count - 1, 0, 160_002];
  const annotated = annotateMlgSourceIntegrityDiagnostics(index, samples.map(i => ({ code: 'mlg-crc-mismatch', severity: 'warning', message: 'CRC', recoverable: true, offset: 109 + i * 13 })), 5);
  assert(annotated.every((d, i) => d.timeMs === samples[i] * 10 && d.sourceIntegrity.breaksContinuity) && reads <= 100, 'Sparse large-index annotations lost offsets, time or bounded lookup');
  checks.push('>320k-record sparse annotation uses bounded offset reads; irrelevant diagnostics read none');

  const header = createScalarHeaderFixture({ version: 2, type: 0, recordLength: 1 });
  const bytes = new Uint8Array(header.length + 5 * 6); bytes.set(header);
  const records = [[10, 100, 1, true], [11, 101, 2, false], [11, 101, 2, true], [12, 102, 3, false], [13, 103, 4, true]];
  records.forEach(([counter, timestamp, value, valid], i) => bytes.set([0, counter, timestamp >> 8, timestamp & 255, value, valid ? value : value + 1], header.length + i * 6));
  const file = new File([bytes], 'integrity-parity.mlg', { lastModified: 123 });
  const fallback = await importMlgFile(file);
  const crc = fallback.summary.diagnostics.filter(d => d.code === 'mlg-crc-retry-recovered' || d.code === 'mlg-crc-mismatch');
  assert(crc.length === 2 && crc[0].sourceIntegrity.kind === 'recovered-retry' && !crc[0].sourceIntegrity.breaksContinuity && crc[1].sourceIntegrity.kind === 'corrupt-record' && crc[1].sourceIntegrity.breaksContinuity, 'Actual fallback parsing lost recovered/unrecovered semantics');
  assert(crc[0].timeMs === fallback.recordIndex.timeMs[1] && crc[1].timeMs === fallback.recordIndex.timeMs[3], 'Actual annotation has incorrect source times');
  if (typeof Worker !== 'undefined') {
    const handle = importMlgFileStaged(file);
    const indexed = await handle.indexed;
    handle.startValidation();
    const validated = await handle.validated;
    assert(JSON.stringify(validated.diagnostics) === JSON.stringify(fallback.summary.diagnostics), 'Staged/fallback diagnostic metadata differs');
    assert(JSON.stringify([...indexed.recordIndex.crcValid]) === JSON.stringify([...fallback.recordIndex.crcValid]), 'Annotation changed source validity across import paths');
    checks.push('actual staged/fallback CRC diagnostics, source times and validity are identical');
  } else checks.push('actual fallback CRC diagnostics retain source times and retry/corruption semantics with Worker disabled');
  return { passed: checks.length, checks };
}
