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
});
