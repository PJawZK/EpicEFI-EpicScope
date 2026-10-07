import { describe, expect, it } from 'vitest';
import { createShimCaptureSource } from '../../../apps/web/src/adapters/shim/shim-capture-source';
import { ShimCaptureSession } from '../../../apps/web/src/adapters/shim/shim-capture-session';
import { ShimLiveNumericChannelDataSource } from '../../../apps/web/src/adapters/shim/shim-live-data-source';
import type { ShimSchema, ShimStreamDefinitionMessage } from '../../../apps/web/src/adapters/shim/shim-protocol';
import type { ShimTelemetryFrame } from '../../../apps/web/src/adapters/shim/shim-binary-decoder';

const definition: ShimStreamDefinitionMessage = {
  type: 'streamDefinition',
  protocolVersion: 1,
  streamId: 7,
  schemaId: 'schema-1',
  generation: 4,
  channels: ['RPMValue', 'coolant'],
  mode: 'series',
  rateHz: 50,
  deliveryHz: 10,
  encoding: 'epicefi-f64-v1',
};

const schema: ShimSchema = {
  id: 'schema-1',
  iniHash: 'hash',
  decoderVersion: '1',
  complete: true,
  decodable: true,
  channels: [
    { id: 'RPMValue', name: 'RPMValue', unit: 'rpm', type: 'number' },
    { id: 'coolant', name: 'coolant', unit: 'C', type: 'number' },
    { id: 'unused', name: 'unused', unit: '', type: 'number' },
  ],
};

function frame(streamId: number, generation: bigint, deliveryLoss = 0): ShimTelemetryFrame {
  return {
    encoding: 'epicefi-f64-v1',
    flags: deliveryLoss > 0 ? 1 : 0,
    streamId,
    generation,
    deliverySequence: 1n,
    deliveryLoss,
    channelCount: 2,
    samples: [
      {
        acquisitionSequence: 100n,
        timestampNs: 1_000_000_000n,
        lossBefore: 0,
        values: new Float64Array([800, 80]),
        quality: new Uint8Array([0, 0]),
      },
      {
        acquisitionSequence: 101n,
        timestampNs: 1_020_000_000n,
        lossBefore: 0,
        values: new Float64Array([810, 81]),
        quality: new Uint8Array([0, 2]),
      },
    ],
  };
}

describe('createShimCaptureSource', () => {
  it('builds a Logger-compatible source using only captured schema channels', async () => {
    const capture = new ShimCaptureSession();
    capture.beginSegment({ clockId: 'clock-a', definition, startTimeMs: 0 });
    capture.appendFrame(frame(7, 4n));
    const source = createShimCaptureSource({
      captureId: 'shim:test',
      capture,
      channelData: new ShimLiveNumericChannelDataSource(capture),
      schema,
    });

    expect(source.recordCount).toBe(2);
    expect(source.summary.source.format).toBe('TS-SHIM');
    expect(source.summary.channels.map((channel) => channel.id)).toEqual(['RPMValue', 'coolant']);
    expect(source.summary.timeRange).toEqual({ startMs: 0, endMs: 20, durationMs: 20 });
    const coolant = await source.channelData.readChannelRange('coolant', 0, 2);
    expect([...coolant.quality!]).toEqual([0, 2]);
    expect([...coolant.validity]).toEqual([1, 0]);
  });

  it('surfaces delivery loss and reconnect segments as provenance', () => {
    const capture = new ShimCaptureSession();
    capture.beginSegment({ clockId: 'clock-a', definition, startTimeMs: 0 });
    capture.appendFrame(frame(7, 4n, 3));
    const reconnectDefinition = { ...definition, streamId: 8, generation: 5 };
    capture.beginSegment({ clockId: 'clock-b', definition: reconnectDefinition, startTimeMs: 100 });
    capture.appendFrame({
      ...frame(8, 5n),
      samples: [{
        acquisitionSequence: 200n,
        timestampNs: 9_000_000_000n,
        lossBefore: 0,
        values: new Float64Array([820, 82]),
        quality: new Uint8Array([0, 0]),
      }],
      deliveryLoss: 0,
      flags: 0,
    });

    const source = createShimCaptureSource({
      captureId: 'shim:reconnect',
      capture,
      channelData: new ShimLiveNumericChannelDataSource(capture),
      schema,
    });

    expect(source.summary.diagnostics[0]?.code).toBe('SHIM_DELIVERY_LOSS');
    expect(source.summary.markers).toEqual([{ timeMs: 100, label: 'Shim reconnect · generation 5' }]);
    expect(source.summary.timeRange?.endMs).toBe(100);
  });
});
