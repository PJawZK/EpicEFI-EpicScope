import { describe, expect, it } from 'vitest';
import { NUMERIC_SAMPLE_QUALITY } from '../../../core/log-model/log-types';
import type { ShimTelemetryFrame } from '../../../apps/web/src/adapters/shim/shim-binary-decoder';
import { ShimCaptureSession } from '../../../apps/web/src/adapters/shim/shim-capture-session';
import { ShimLiveNumericChannelDataSource } from '../../../apps/web/src/adapters/shim/shim-live-data-source';
import type { ShimStreamDefinitionMessage } from '../../../apps/web/src/adapters/shim/shim-protocol';
import { ShimProtocolError } from '../../../apps/web/src/adapters/shim/shim-protocol';

function definition(streamId = 7, generation = 4): ShimStreamDefinitionMessage {
  return {
    type: 'streamDefinition',
    protocolVersion: 1,
    streamId,
    schemaId: 'schema-1',
    generation,
    channels: ['RPMValue', 'coolant'],
    mode: 'series',
    rateHz: 50,
    deliveryHz: 10,
    encoding: 'epicefi-f64-v1',
  };
}

function frame(options: {
  readonly streamId?: number;
  readonly generation?: bigint;
  readonly deliveryLoss?: number;
  readonly sequences?: readonly bigint[];
  readonly timestamps?: readonly bigint[];
  readonly values?: readonly (readonly [number, number])[];
  readonly quality?: readonly (readonly [number, number])[];
} = {}): ShimTelemetryFrame {
  const sequences = options.sequences ?? [100n, 101n, 102n];
  const timestamps = options.timestamps ?? [1_000_000_000n, 1_020_000_000n, 1_040_000_000n];
  const values = options.values ?? [[800, 80], [810, 80.5], [820, 81]];
  const quality = options.quality ?? [[0, 0], [2, 0], [1, 3]];
  return {
    encoding: 'epicefi-f64-v1',
    streamId: options.streamId ?? 7,
    generation: options.generation ?? 4n,
    deliverySequence: 1n,
    deliveryLoss: options.deliveryLoss ?? 0,
    flags: (options.deliveryLoss ?? 0) > 0 ? 1 : 0,
    channelCount: 2,
    samples: sequences.map((acquisitionSequence, index) => ({
      acquisitionSequence,
      timestampNs: timestamps[index]!,
      lossBefore: index === 0 ? (options.deliveryLoss ?? 0) : 0,
      values: Float64Array.from(values[index]!),
      quality: Uint8Array.from(quality[index]!),
    })),
  };
}

function expectProtocolError(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error('Expected ShimProtocolError.');
  } catch (error) {
    expect(error).toBeInstanceOf(ShimProtocolError);
    expect((error as ShimProtocolError).code).toBe(code);
  }
}

describe('shim live capture and numeric source', () => {
  it('accumulates telemetry into capture-relative time and preserves rich quality', async () => {
    const capture = new ShimCaptureSession();
    capture.beginSegment({ clockId: 'clock-a', definition: definition() });
    capture.appendFrame(frame({ deliveryLoss: 2 }));

    const source = new ShimLiveNumericChannelDataSource(capture);
    expect(source.sampleCount).toBe(3);
    expect(capture.deliveryLossCount).toBe(2);
    expect(capture.acquisitionSequenceAt(2)).toBe(102n);

    const rpm = await source.readChannelRange('RPMValue', 0, 3);
    expect([...rpm.timeMs]).toEqual([0, 20, 40]);
    expect([...rpm.values]).toEqual([800, 810, 820]);
    expect([...rpm.quality!]).toEqual([
      NUMERIC_SAMPLE_QUALITY.valid,
      NUMERIC_SAMPLE_QUALITY.stale,
      NUMERIC_SAMPLE_QUALITY.invalid,
    ]);
    expect([...rpm.validity]).toEqual([1, 0, 0]);

    const coolant = await source.readChannelRange('coolant', 0, 3);
    expect([...coolant.quality!]).toEqual([
      NUMERIC_SAMPLE_QUALITY.valid,
      NUMERIC_SAMPLE_QUALITY.valid,
      NUMERIC_SAMPLE_QUALITY.unavailable,
    ]);
    expect([...coolant.validity]).toEqual([1, 1, 0]);
  });

  it('provides stable bounded snapshots while new live samples may arrive later', async () => {
    const capture = new ShimCaptureSession();
    capture.beginSegment({ clockId: 'clock-a', definition: definition() });
    capture.appendFrame(frame({ sequences: [100n], timestamps: [1_000_000_000n], values: [[800, 80]], quality: [[0, 0]] }));
    const source = new ShimLiveNumericChannelDataSource(capture);

    const first = await source.readChannelsRange!(['RPMValue', 'coolant'], 0, source.sampleCount);
    capture.appendFrame(frame({ sequences: [101n], timestamps: [1_020_000_000n], values: [[810, 80.5]], quality: [[0, 0]] }));

    expect(first.ranges.get('RPMValue')!.values.length).toBe(1);
    expect(source.sampleCount).toBe(2);
    const second = await source.readChannelRange('RPMValue', 0, source.sampleCount);
    expect([...second.values]).toEqual([800, 810]);
  });

  it('maps time windows to the live sample index range', () => {
    const capture = new ShimCaptureSession();
    capture.beginSegment({ clockId: 'clock-a', definition: definition() });
    capture.appendFrame(frame());
    const source = new ShimLiveNumericChannelDataSource(capture);

    expect(source.sampleRangeForTime!(5, 25)).toEqual({ startSampleIndex: 1, sampleCount: 1 });
    expect(source.sampleRangeForTime!(40, 0)).toEqual({ startSampleIndex: 0, sampleCount: 3 });
  });

  it('starts a later connection segment at an explicit capture-relative time', async () => {
    const capture = new ShimCaptureSession();
    capture.beginSegment({ clockId: 'clock-a', definition: definition(7, 4) });
    capture.appendFrame(frame({ sequences: [100n], timestamps: [1_000_000_000n], values: [[800, 80]], quality: [[0, 0]] }));

    capture.beginSegment({ clockId: 'clock-b', definition: definition(9, 5), startTimeMs: 250 });
    capture.appendFrame(frame({ streamId: 9, generation: 5n, sequences: [5n, 6n], timestamps: [8_000_000_000n, 8_020_000_000n], values: [[700, 79], [710, 79.5]], quality: [[0, 0], [0, 0]] }));

    const source = new ShimLiveNumericChannelDataSource(capture);
    const rpm = await source.readChannelRange('RPMValue', 0, 3);
    expect([...rpm.timeMs]).toEqual([0, 250, 270]);
    expect(capture.segments).toHaveLength(2);
    expect(capture.segments[1]?.clockId).toBe('clock-b');
    expect(capture.segments[1]?.startSampleIndex).toBe(1);
  });

  it('rejects changed channel ordering, sequence regression and unsupported quality codes', () => {
    const capture = new ShimCaptureSession();
    capture.beginSegment({ clockId: 'clock-a', definition: definition() });
    capture.appendFrame(frame({ sequences: [100n], timestamps: [1_000_000_000n], values: [[800, 80]], quality: [[0, 0]] }));

    expectProtocolError(() => capture.appendFrame(frame({ sequences: [99n], timestamps: [1_020_000_000n], values: [[810, 80.5]], quality: [[0, 0]] })), 'captureSequenceRegression');
    expectProtocolError(() => capture.appendFrame(frame({ sequences: [101n], timestamps: [1_020_000_000n], values: [[810, 80.5]], quality: [[9, 0]] })), 'invalidTelemetryQuality');

    const changed = { ...definition(9, 5), channels: ['coolant', 'RPMValue'] };
    expectProtocolError(() => capture.beginSegment({ clockId: 'clock-b', definition: changed, startTimeMs: 100 }), 'captureChannelSetChanged');
  });
});
