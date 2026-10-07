import { describe, expect, it } from 'vitest';
import type { ShimTelemetryFrame } from '../../../apps/web/src/adapters/shim/shim-binary-decoder';
import { ShimLiveSession, type ShimLiveSessionClient } from '../../../apps/web/src/adapters/shim/shim-live-session';
import type { ShimStreamDefinitionMessage, ShimWelcomeMessage } from '../../../apps/web/src/adapters/shim/shim-protocol';
import { ShimProtocolError } from '../../../apps/web/src/adapters/shim/shim-protocol';
import type { ShimSubscriptionSpec, ShimTelemetryClientEvent, ShimTelemetryClientState } from '../../../apps/web/src/adapters/shim/shim-telemetry-client';

class FakeClient implements ShimLiveSessionClient {
  state: ShimTelemetryClientState = 'ready';
  welcome: ShimWelcomeMessage | undefined = welcome('clock-a', 4);
  readonly subscriptions: ShimSubscriptionSpec[] = [];
  readonly unsubscribed: number[] = [];
  private readonly listeners = new Set<(event: ShimTelemetryClientEvent) => void>();
  private nextId = 1;

  subscribe(spec: ShimSubscriptionSpec): number {
    this.subscriptions.push(spec);
    return this.nextId++;
  }
  unsubscribe(subscriptionId: number): boolean {
    this.unsubscribed.push(subscriptionId);
    return true;
  }
  onEvent(listener: (event: ShimTelemetryClientEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit(event: ShimTelemetryClientEvent): void {
    if (event.type === 'state') this.state = event.state;
    if (event.type === 'welcome') this.welcome = event.welcome;
    for (const listener of this.listeners) listener(event);
  }
}

function welcome(clockId: string, generation: number): ShimWelcomeMessage {
  return {
    type: 'welcome', protocolVersion: 1, clockId, generation,
    ecu: { signature: 'epic' }, simulator: false,
    schema: { id: 'schema-1', iniHash: 'hash' }, capabilities: [],
    limits: { maxStreams: 16, maxChannelsPerStream: 256, maxRateHz: 50, maxDeliveryHz: 50 },
  };
}

function definition(streamId: number, generation: number): ShimStreamDefinitionMessage {
  return {
    type: 'streamDefinition', protocolVersion: 1, streamId, schemaId: 'schema-1', generation,
    channels: ['RPMValue', 'coolant'], mode: 'series', rateHz: 50, deliveryHz: 10,
    encoding: 'epicefi-f64-v1',
  };
}

function frame(streamId: number, generation: bigint, sequence: bigint, timestampNs: bigint, values: readonly [number, number]): ShimTelemetryFrame {
  return {
    encoding: 'epicefi-f64-v1', streamId, generation, deliverySequence: sequence,
    deliveryLoss: 0, flags: 0, channelCount: 2,
    samples: [{ acquisitionSequence: sequence, timestampNs, lossBefore: 0, values: new Float64Array(values), quality: new Uint8Array([0, 0]) }],
  };
}

describe('ShimLiveSession', () => {
  it('starts selected-channel recording, creates a segment and exposes a growing numeric source', async () => {
    const client = new FakeClient();
    let now = 1_000;
    const session = new ShimLiveSession(client, { nowMs: () => now });

    session.startRecording({ channels: ['RPMValue', 'coolant'], rateHz: 50, deliveryHz: 10 });
    expect(session.state).toBe('waiting-stream');
    expect(client.subscriptions[0]?.mode).toBe('series');

    client.emit({ type: 'streamDefinition', subscriptionId: 1, definition: definition(7, 4) });
    client.emit({ type: 'telemetry', subscriptionId: 1, frame: frame(7, 4n, 100n, 5_000_000_000n, [800, 80]) });
    now += 20;
    client.emit({ type: 'telemetry', subscriptionId: 1, frame: frame(7, 4n, 101n, 5_020_000_000n, [810, 80.5]) });

    expect(session.state).toBe('recording');
    expect(session.capture?.sampleCount).toBe(2);
    expect(session.capture?.segments).toHaveLength(1);
    const range = await session.dataSource!.readChannelRange('RPMValue', 0, 10);
    expect([...range.timeMs]).toEqual([0, 20]);
    expect([...range.values]).toEqual([800, 810]);
  });

  it('keeps the recording armed across reconnect and creates a new clock segment with a wall-time gap', () => {
    const client = new FakeClient();
    let now = 1_000;
    const session = new ShimLiveSession(client, { nowMs: () => now });
    session.startRecording({ channels: ['RPMValue', 'coolant'], rateHz: 50, deliveryHz: 10 });
    client.emit({ type: 'streamDefinition', subscriptionId: 1, definition: definition(7, 4) });
    client.emit({ type: 'telemetry', subscriptionId: 1, frame: frame(7, 4n, 100n, 5_000_000_000n, [800, 80]) });

    now = 1_500;
    client.emit({ type: 'state', state: 'reconnecting' });
    expect(session.state).toBe('waiting-reconnect');
    client.welcome = welcome('clock-b', 5);
    now = 2_000;
    client.emit({ type: 'streamDefinition', subscriptionId: 1, definition: definition(9, 5) });
    client.emit({ type: 'telemetry', subscriptionId: 1, frame: frame(9, 5n, 1n, 900_000_000n, [820, 81]) });

    expect(session.capture?.segments).toHaveLength(2);
    expect(session.capture?.segments[1]?.clockId).toBe('clock-b');
    expect(session.capture?.segments[1]?.startTimeMs).toBe(1_000);
    expect(session.capture?.endTimeMs).toBe(1_000);
  });

  it('stops by unsubscribing while retaining the completed capture for analysis', () => {
    const client = new FakeClient();
    const session = new ShimLiveSession(client, { nowMs: () => 0 });
    session.startRecording({ channels: ['RPMValue'], rateHz: 20, deliveryHz: 10 });
    const capture = session.capture;
    session.stopRecording();
    expect(client.unsubscribed).toEqual([1]);
    expect(session.state).toBe('stopped');
    expect(session.capture).toBe(capture);
    expect(session.dataSource).toBeDefined();
  });

  it('rejects recording before the telemetry client is ready', () => {
    const client = new FakeClient();
    client.state = 'waiting-schema';
    const session = new ShimLiveSession(client);
    expect(() => session.startRecording({ channels: ['RPMValue'], rateHz: 20, deliveryHz: 10 })).toThrow(ShimProtocolError);
  });

  it('isolates telemetry for other subscriptions', () => {
    const client = new FakeClient();
    const session = new ShimLiveSession(client, { nowMs: () => 0 });
    session.startRecording({ channels: ['RPMValue', 'coolant'], rateHz: 50, deliveryHz: 10 });
    client.emit({ type: 'streamDefinition', subscriptionId: 99, definition: definition(77, 4) });
    client.emit({ type: 'telemetry', subscriptionId: 99, frame: frame(77, 4n, 1n, 1n, [900, 90]) });
    expect(session.capture?.sampleCount).toBe(0);
  });
});
