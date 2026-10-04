import { describe, expect, it } from 'vitest';

import type { ParserDiagnostic } from '../../core/log-model/log-types';
import {
  buildParserDiagnosticsReport,
  summarizeSourceIntegrity,
  unresolvedParserDiagnostics,
} from '../../apps/web/src/components/parser-diagnostics-indicator';

const diagnostic = (
  code: string,
  severity: ParserDiagnostic['severity'],
  offset?: number,
  message = code,
): ParserDiagnostic => ({ code, severity, offset, message, recoverable: true });

describe('parser diagnostics indicator data helpers', () => {
  it('filters unresolved warnings/errors while excluding summary diagnostics', () => {
    const diagnostics = [
      diagnostic('info-only', 'info'),
      diagnostic('mlg-retry-recovery-summary', 'warning'),
      diagnostic('mlg-counter-pattern-summary', 'warning'),
      diagnostic('mlg-crc-mismatch', 'warning', 100),
      diagnostic('fatal', 'error', 200),
    ];

    expect(unresolvedParserDiagnostics(diagnostics).map((item) => item.code)).toEqual([
      'mlg-crc-mismatch',
      'fatal',
    ]);
  });

  it('summarizes retry recovery, CRC/counter anomalies and grouped unresolved events', () => {
    const diagnostics = [
      diagnostic('mlg-crc-retry-recovered', 'info', 100),
      diagnostic('mlg-crc-retry-recovered', 'info', 200),
      diagnostic('mlg-counter-retry-pattern', 'info', 300),
      diagnostic('mlg-crc-mismatch', 'warning', 400),
      diagnostic('mlg-counter-discontinuity', 'warning', 500),
      diagnostic('mlg-crc-mismatch', 'warning', 1000),
    ];

    expect(summarizeSourceIntegrity(diagnostics)).toEqual({
      recoveredRetryArtifacts: 2,
      validRetryLikeRuns: 1,
      unrecoveredCrcRecords: 2,
      counterAnomalies: 1,
      groupedUnresolvedEvents: 2,
    });
  });

  it('builds a complete text report from the same diagnostic semantics', () => {
    const diagnostics = [
      diagnostic('mlg-crc-retry-recovered', 'info', 100, 'recovered'),
      diagnostic('mlg-crc-mismatch', 'warning', 200, 'bad crc'),
      diagnostic('mlg-crc-mismatch', 'warning', 300, 'bad crc again'),
    ];

    const report = buildParserDiagnosticsReport(diagnostics);
    expect(report).toContain('EpicScope parser diagnostics');
    expect(report).toContain('Total: 3');
    expect(report).toContain('Unresolved: 2');
    expect(report).toContain('Recovered retry artifacts: 1');
    expect(report).toContain('WARNING | mlg-crc-mismatch | 2');
    expect(report).toContain('byte 200 | bad crc');
    expect(report).toContain('[All diagnostics]');
  });
});
