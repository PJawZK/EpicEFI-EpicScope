import { describe, expect, it } from 'vitest';
import { annotateMlgSourceIntegrityDiagnostics } from '../../../core/parsers/mlg/mlg-integrity';
import type { MlgRecordIndex } from '../../../core/parsers/mlg/mlg-records';

describe('annotateMlgSourceIntegrityDiagnostics', () => {
  it('maps recovered and unrecovered CRC diagnostics to source time and continuity semantics', () => {
    const recordIndex: MlgRecordIndex = {
      offsets: new Float64Array([100, 200, 300]),
      timeMs: new Float64Array([10, 20, 30]),
      counters: new Uint8Array([1, 2, 3]),
      crcValid: new Uint8Array([0, 1, 0]),
    };
    const recordLength = 5;
    const blockLength = 4 + recordLength + 1;

    const result = annotateMlgSourceIntegrityDiagnostics(recordIndex, [
      {
        code: 'mlg-crc-retry-recovered',
        severity: 'info',
        message: 'Recovered retry.',
        recoverable: true,
        offset: 100 + blockLength - 1,
      },
      {
        code: 'mlg-crc-mismatch',
        severity: 'warning',
        message: 'Unrecovered CRC failure.',
        recoverable: true,
        offset: 300 + blockLength - 1,
      },
    ], recordLength);

    expect(result[0]).toMatchObject({
      timeMs: 10,
      sourceIntegrity: {
        kind: 'recovered-retry',
        breaksContinuity: false,
      },
    });
    expect(result[1]).toMatchObject({
      timeMs: 30,
      sourceIntegrity: {
        kind: 'corrupt-record',
        breaksContinuity: true,
      },
    });
  });
  function fixture(count = 320_005) {
    let reads = 0;
    const offsets = new Proxy(Float64Array.from({ length: count }, (_, i) => 100 + i * 13), {
      get(target, key) {
        if (typeof key === 'string' && /^\d+$/.test(key)) {
          reads += 1;
          if (reads > 100) throw new Error('Annotation scanned the record index');
        }
        return Reflect.get(target, key, target);
      },
    });
    return { index: { offsets, timeMs: Float64Array.from({ length: count }, (_, i) => i * 10), counters: new Uint8Array(count), crcValid: new Uint8Array(count) }, reads: () => reads };
  }

  it('does not inspect record offsets or copy diagnostics when no CRC annotation is needed', () => {
    const { index, reads } = fixture();
    const diagnostics = [
      { code: 'unrelated', severity: 'info' as const, message: 'Info', recoverable: true, offset: 109 },
      { code: 'mlg-crc-mismatch', severity: 'warning' as const, message: 'No offset', recoverable: true },
    ];
    expect(annotateMlgSourceIntegrityDiagnostics(index, diagnostics, 5)).toBe(diagnostics);
    expect(reads()).toBe(0);
  });

  it('locates sparse first/middle/last CRC events in >320k noncontiguous records with bounded reads', () => {
    const count = 320_005;
    const { index, reads } = fixture(count);
    const samples = [count - 1, 0, 160_002];
    const diagnostics = samples.map((i, j) => ({ code: j === 1 ? 'mlg-crc-retry-recovered' : 'mlg-crc-mismatch', severity: 'warning' as const, message: `Record ${i}`, recoverable: true, offset: 100 + i * 13 + 9 }));
    const result = annotateMlgSourceIntegrityDiagnostics(index, diagnostics, 5);
    expect(result.map(d => d.timeMs)).toEqual(samples.map(i => i * 10));
    expect(result.map(d => d.sourceIntegrity)).toEqual([
      { kind: 'corrupt-record', breaksContinuity: true },
      { kind: 'recovered-retry', breaksContinuity: false },
      { kind: 'corrupt-record', breaksContinuity: true },
    ]);
    expect(result.map(d => d.message)).toEqual(diagnostics.map(d => d.message));
    expect(diagnostics.every(d => !('timeMs' in d))).toBe(true);
    expect(reads()).toBeLessThanOrEqual(100);
  });

  it('retains unmatched diagnostics by identity and only copies the list when annotation succeeds', () => {
    const { index } = fixture(4);
    index.timeMs[1] = NaN;
    const diagnostic = (offset: number) => ({ code: 'mlg-crc-mismatch', severity: 'warning' as const, message: 'CRC', recoverable: true, offset });
    const missing = [diagnostic(108), diagnostic(110), diagnostic(149), diagnostic(NaN), diagnostic(Infinity), diagnostic(122)];
    expect(annotateMlgSourceIntegrityDiagnostics(index, missing, 5)).toBe(missing);
    const valid = diagnostic(109);
    const result = annotateMlgSourceIntegrityDiagnostics(index, [...missing, valid], 5);
    missing.forEach((d, i) => expect(result[i]).toBe(d));
    expect(result.at(-1)).toMatchObject({ timeMs: 0, sourceIntegrity: { kind: 'corrupt-record', breaksContinuity: true } });
    expect(result.at(-1)).not.toBe(valid);
  });
});
