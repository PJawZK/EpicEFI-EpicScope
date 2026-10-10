import { describe, expect, it } from 'vitest';

import type { ChannelPerformanceRun } from '../../apps/web/src/components/performance-diagnostics';
import { buildPerformanceDiagnosticsReport } from '../../apps/web/src/components/performance-diagnostics-report';

describe('performance diagnostics report formatter', () => {
  it('formats captured channel selections independently of the DOM controller', () => {
    const channel: ChannelPerformanceRun = {
      channelName: 'accelerationLat',
      phase: 'full',
      startSampleIndex: 0,
      requestedSampleCount: 320458,
      totalMs: 42,
      readDecodeMs: 12,
      scaleMs: 10,
      renderMs: 20,
      sampleCount: 320458,
      batchSize: 1,
      cacheHit: true,
      physicalReadCount: 0,
      physicalBytesRead: 0,
      physicalReadMs: 0,
      persistentLookupMs: 0.2,
      delegatedSourceMs: 11.4,
      sidecarReadPath: 'native',
      sidecarBlobReadAggregateMs: 5.5,
      sidecarDecodeAggregateMs: 4.5,
    };

    const report = buildPerformanceDiagnosticsReport([], [], [], [], [channel]);

    expect(report).toContain('EpicScope performance diagnostics');
    expect(report).toContain('[Channel selections]');
    expect(report).toContain('accelerationLat');
    expect(report).toContain('readDecode=12.00 ms');
    expect(report).toContain('persistentLookup=0.20 ms');
    expect(report).toContain('sidecarPath=native');
    expect(report).toContain('sidecarBlobReadAggregate=5.50 ms');
  });
});
