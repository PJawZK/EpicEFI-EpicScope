import { describe, expect, it } from 'vitest';
import { MemoryByteSource } from '../../../core/parsers/byte-source';
import { auditMlgIntegrity } from '../../../core/parsers/mlg/mlg-integrity-audit';
import { parseMlg } from '../../../core/parsers/mlg/mlg-parser';
import {
  buildRawViewportSeries,
  buildViewportEnvelope,
  buildEnvelopeBlockSummary,
  buildViewportEnvelopeFromBlocks,
} from '../../../core/timeline/viewport-series';
import { idleContractMlg } from '../../fixtures/idle/mlg-contract';
import { createScalarHeaderFixture } from '../../logs/mlg-fixture-builder';
import { summarizeNumericRange } from '../../../core/analysis/range-statistics';
import { aggregateNumericSamples } from '../../../core/analysis/numeric-aggregation';
import { buildNumericHistogram } from '../../../core/analysis/histogram';

// Independently generated test bytes, based on observed November 1 event shapes.
// These are not extracts of the user's recording or new causal classifications.
async function parse(bytes: Uint8Array) {
  return parseMlg(new MemoryByteSource(bytes), {
    id: 'nov01-regression', displayName: 'generated.mlg', format: 'MLG', sizeBytes: bytes.length,
  });
}

describe('November 1 source/render evidence boundaries', () => {
  it('keeps a checksum-valid 103.73 ms rollover interval separate from CRC loss', async () => {
    const records = Array.from({ length: 20 }, (_, i) => ({
      counter: 21 + i, timestamp: 58_776 - (19 - i) * 1296, rpm: 900,
    }));
    records.push({ counter: 41, timestamp: 3613, rpm: 901 });
    const parsed = await parse(idleContractMlg(records));
    const times = parsed.recordIndex.timeMs;
    expect(times[20]! - times[19]!).toBeCloseTo(103.73, 8);
    const audit = auditMlgIntegrity(parsed.recordIndex, parsed.summary.diagnostics, 2, {
      rawTimestamps: Uint16Array.from(records, r => r.timestamp),
    });
    expect(audit.invalidRecords).toBe(0);
    expect(audit.observedCounts['recording-time-discontinuity']).toBe(1);
    expect(audit.observedCounts['sequence-discontinuity']).toBeUndefined();
    expect(audit.observedCounts['timestamp-regression']).toBeUndefined();
    expect(audit.observedCounts['timestamp-wrap-or-reset']).toBe(1);
    const range = await parsed.channelData.readChannelRange(parsed.summary.channels[0]!.id, 0, 21);
    expect(buildRawViewportSeries(range, times[0]!, times[20]!).filter(p => p.breakBefore)).toHaveLength(2);
    expect(audit.events.at(-1)?.observations.join(' ')).toContain('unknown cause');
  });

  it('retains original indices and the 41.49 ms trusted span around an unrecovered/recovered pair', async () => {
    const parsed = await parse(idleContractMlg([
      { counter: 52, timestamp: 17_641, rpm: 900 },
      { counter: 54, timestamp: 20_384, rpm: 901, valid: false },
      { counter: 55, timestamp: 21_790, rpm: 902, valid: false },
      { counter: 55, timestamp: 21_790, rpm: 902 },
      { counter: 56, timestamp: 23_090, rpm: 903 },
    ]));
    const audit = auditMlgIntegrity(parsed.recordIndex, parsed.summary.diagnostics, 2);
    expect([...parsed.recordIndex.crcValid]).toEqual([1, 0, 0, 1, 1]);
    expect(audit.observedCounts['unrecovered-corrupt-record']).toBe(1);
    expect(audit.observedCounts['recovered-retry']).toBe(1);
    const range = await parsed.channelData.readChannelRange(parsed.summary.channels[0]!.id, 0, 5);
    expect(range.values).toHaveLength(5);
    expect(range.timeMs[3]! - range.timeMs[0]!).toBeCloseTo(41.49, 8);
    const trace = buildRawViewportSeries(range, range.timeMs[0]!, range.timeMs[4]!);
    expect(trace.map(p => p.breakBefore)).toEqual([true, true, false]);
  });

  it('preserves a channel-only NaN interval alongside finite RPM and an independent corrupt attempt', async () => {
    const rpm = createScalarHeaderFixture({ version: 2, type: 2, name: 'RPM', units: 'RPM' });
    const hybrid = createScalarHeaderFixture({ version: 2, type: 7, name: 'Hybrid: Motor only TPS', units: '%' });
    const descriptorLength = rpm.length - 24;
    const header = new Uint8Array(rpm.length + descriptorLength);
    header.set(rpm); header.set(hybrid.subarray(24), rpm.length);
    const headerView = new DataView(header.buffer);
    headerView.setUint32(16, header.length, false);
    headerView.setUint16(20, 6, false);
    headerView.setUint16(22, 2, false);
    const bytes = new Uint8Array(header.length + 6 * 11);
    bytes.set(header);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < 6; i++) {
      const at = header.length + i * 11;
      bytes[at + 1] = i;
      view.setUint16(at + 2, i * 1000, false);
      view.setUint16(at + 4, 900 + i, false);
      view.setUint32(at + 6, i >= 1 && i <= 4 ? 0x7fc00000 : 0x3f800000, false);
      let sum = i === 2 ? 1 : 0;
      for (let j = 4; j < 10; j++) sum += bytes[at + j]!;
      bytes[at + 10] = sum & 255;
    }
    const parsed = await parse(bytes);
    const ranges = await Promise.all(parsed.summary.channels.map(c => parsed.channelData.readChannelRange(c.id, 0, 6)));
    expect([...parsed.recordIndex.crcValid]).toEqual([1, 1, 0, 1, 1, 1]);
    expect([0, 1, 3, 4, 5].every(i => Number.isFinite(ranges[0]!.values[i]))).toBe(true);
    expect([1, 3, 4].every(i => Number.isNaN(ranges[1]!.values[i]))).toBe(true);
    const audit = auditMlgIntegrity(parsed.recordIndex, parsed.summary.diagnostics, 6, {
      channels: new Map(parsed.summary.channels.map((c, i) => [c.sourceName, ranges[i]!])),
    });
    expect(audit.observedCounts['channel-invalid']).toBe(3);
    expect(audit.observedCounts['unrecovered-corrupt-record']).toBe(1);
    expect(audit.events.filter(e => e.classifications.includes('channel-invalid')).every(
      e => !e.classifications.includes('unrecovered-corrupt-record'),
    )).toBe(true);
    const trace = buildRawViewportSeries(ranges[1]!, 0, 50);
    expect(trace).toHaveLength(2);
    expect(trace.map(p => p.breakBefore)).toEqual([true, true]);
    // CRC-valid NaNs are unusable measurements even though the source-wide
    // compatibility mask stays valid. Every measurement consumer must exclude them.
    expect(summarizeNumericRange(ranges[1]!)).toMatchObject({ validCount: 2, invalidCount: 4, mean: 1 });
    expect(aggregateNumericSamples(ranges[1]!)).toMatchObject({ validSampleCount: 2, invalidSampleCount: 4, unavailableSampleCount: 0, mean: 1 });
    expect(buildNumericHistogram(ranges[1]!)).toMatchObject({ validSampleCount: 2, invalidSampleCount: 4, binnedSampleCount: 2 });
    const envelope = buildViewportEnvelope(ranges[1]!, 0, 50, 100);
    expect(envelope).toMatchObject({ validSampleCount: 2, invalidSampleCount: 4 });
    const blocks = buildEnvelopeBlockSummary(ranges[1]!.values, ranges[1]!.timeMs, ranges[1]!.validity);
    expect(buildViewportEnvelopeFromBlocks(ranges[1]!, blocks, 0, 50, 100)).toEqual(envelope);
    expect(parsed.summary.diagnostics.filter(d => d.code === 'mlg-crc-mismatch')).toHaveLength(1);
    expect([...parsed.recordIndex.crcValid]).toEqual([1, 1, 0, 1, 1, 1]);
  });
});
