import { describe, expect, it } from 'vitest';
import { sourceIntegrityMarkersFromDiagnostics } from '../../apps/web/src/app/source-integrity-events';

describe('sourceIntegrityMarkersFromDiagnostics', () => {
  it('groups repeated retry artifacts at one timestamp and keeps unrecovered corruption separate', () => {
    const markers = sourceIntegrityMarkersFromDiagnostics([
      {
        code: 'mlg-crc-retry-recovered',
        severity: 'info',
        message: 'retry 1',
        recoverable: true,
        timeMs: 100,
        sourceIntegrity: { kind: 'recovered-retry', breaksContinuity: false },
      },
      {
        code: 'mlg-crc-retry-recovered',
        severity: 'info',
        message: 'retry 2',
        recoverable: true,
        timeMs: 100,
        sourceIntegrity: { kind: 'recovered-retry', breaksContinuity: false },
      },
      {
        code: 'mlg-crc-mismatch',
        severity: 'warning',
        message: 'bad source record',
        recoverable: true,
        timeMs: 250,
        sourceIntegrity: { kind: 'corrupt-record', breaksContinuity: true },
      },
    ]);

    expect(markers).toEqual([
      {
        timeMs: 100,
        kind: 'recovered-retry',
        breaksContinuity: false,
        count: 2,
        message: 'retry 1',
      },
      {
        timeMs: 250,
        kind: 'corrupt-record',
        breaksContinuity: true,
        count: 1,
        message: 'bad source record',
      },
    ]);
  });
});
