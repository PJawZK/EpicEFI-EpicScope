import { describe, expect, it } from 'vitest';
import {
  ShimTelemetryClient,
  type ShimReconnectScheduler,
  type ShimSocketLike,
  type ShimTelemetryClientEvent,
} from '../../../apps/web/src/adapters/shim/shim-telemetry-client';
import { ShimProtocolError } from '../../../apps/web/src/adapters/shim/shim-protocol';

class FakeSocket implements ShimSocketLike {
  binaryType: BinaryType = 'blob';
  readonly sent: string[] = [];
  readonly closes: Array<{ code?: number; reason?: string }> = [];
  private readonly listeners = {
    open: [] as Array<(event: Event) => void>,
    message: [] as Array<(event: MessageEvent<unknown>) => void>,
    close: [] as Array<(event: CloseEvent) => void>,
    error: [] as Array<(event: Event) => void>,
  };

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closes.push({ ...(code === undefined ? {} : { code }), ...(reason === undefined ? {} : { reason }) });
  }

  addEventListener(type: 'open', listener: (event: Event) => void): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  addEventListener(type: 'close', listener: (event: CloseEvent) => void): void;
  addEventListener(type: 'error', listener: (event: Event) => void): void;
  addEventListener(type: 'open' | 'message' | 'close' | 'error', listener: ((event: Event) => void) | ((event: MessageEvent<unknown>) => void) | ((event: CloseEvent) => void)): void {
    (this.listeners[type] as Array<(event: never) => void>).push(listener as (event: never) => void);
  }

  emitOpen(): void {
    for (const listener of this.listeners.open) listener(new Event('open'));
  }

  emitText(value: unknown): void {
    const event = { data: JSON.stringify(value) } as MessageEvent<string>;
    for (const listener of this.listeners.message) listener(event);
  }

  emitBinary(bytes: Uint8Array): void {
    const copy = bytes.slice();
    const event = { data: copy.buffer } as MessageEvent<ArrayBuffer>;
    for (const listener of this.listeners.message) listener(event);
  }

  emitClose(code: number): void {
    const event = { code } as CloseEvent;
    for (const listener of this.listeners.close) listener(event);
  }
}

class FakeScheduler implements ShimReconnectScheduler {
  readonly scheduled: Array<{ token: number; delayMs: number; callback: () => void }> = [];
  private nextToken = 1;

  schedule(callback: () => void, delayMs: number): number {
    const token = this.nextToken++;
    this.scheduled.push({ token, delayMs, callback });
    return token;
  }

  cancel(token: number): void {
    const index = this.scheduled.findIndex((entry) => entry.token === token);
    if (index >= 0) this.scheduled.splice(index, 1);
  }

  runNext(): void {
    const entry = this.scheduled.shift();
    if (!entry) throw new Error('No scheduled callback.');
    entry.callback();
  }
}

function welcome(generation = 4) {
  return {
    type: 'welcome',
    protocolVersion: 1,
    clockId: 'native-test',
    generation,
    ecu: { signature: 'epicEFI test' },
    simulator: false,
    schema: { id: 'native-v1:test', iniHash: 'crc32:test' },
    capabilities: ['latest', 'series', 'float64'],
    limits: { maxStreams: 16, maxChannelsPerStream: 256, maxRateHz: 50, maxDeliveryHz: 60 },
    requestId: 1,
  };
}

function schema() {
  return {
    type: 'schema',
    schema: {
      id: 'native-v1:test',
      iniHash: 'crc32:test',
      decoderVersion: 'epicefi-native-output-v1',
      complete: true,
      decodable: true,
      channels: [
        { id: 'RPMValue', name: 'RPMValue', unit: 'RPM', type: 'number' },
        { id: 'coolant', name: 'coolant', unit: 'C', type: 'number' },
      ],
    },
  };
}

function writeU64(view: DataView, offset: number, value: bigint): void {
  view.setUint32(offset, Number((value >> 32n) & 0xffff_ffffn), false);
  view.setUint32(offset + 4, Number(value & 0xffff_ffffn), false);
}

function telemetryFrame(streamId: number, generation: bigint, values: readonly number[]): Uint8Array {
  const channelCount = values.length;
  const sampleBytes = 20 + 9 * channelCount;
  const bytes = new Uint8Array(36 + sampleBytes);
  const view = new DataView(bytes.buffer);
  bytes.set([0x45, 0x54, 0x4c, 0x4d], 0);
  view.setUint8(4, 1);
  view.setUint8(5, 0);
  view.setUint16(6, 32, false);
  view.setUint32(8, streamId, false);
  writeU64(view, 12, generation);
  writeU64(view, 20, 1n);
  view.setUint16(28, 1, false);
  view.setUint16(30, channelCount, false);
  view.setUint32(32, 0, false);
  writeU64(view, 36, 100n);
  writeU64(view, 44, 1_000_000_000n);
  view.setUint32(52, 0, false);
  let offset = 56;
  for (const value of values) {
    view.setFloat64(offset, value, false);
    offset += 8;
  }
  values.forEach((_value, index) => view.setUint8(offset + index, 0));
  return bytes;
}

function createHarness() {
  const sockets: FakeSocket[] = [];
  const scheduler = new FakeScheduler();
  const client = new ShimTelemetryClient({
    url: 'ws://shim:29002/telemetry',
    scheduler,
    socketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
  });
  const events: ShimTelemetryClientEvent[] = [];
  client.onEvent((event) => events.push(event));
  return { client, sockets, scheduler, events };
}

function makeReady(harness: ReturnType<typeof createHarness>): FakeSocket {
  harness.client.connect();
  const socket = harness.sockets[0]!;
  socket.emitOpen();
  socket.emitText({ type: 'helloRequired', protocolVersion: 1 });
  socket.emitText(welcome());
  socket.emitText(schema());
  socket.emitText({ type: 'lifecycle', state: 'up', generation: 4, signature: 'epicEFI test', schemaCompatible: true });
  return socket;
}

describe('ts_shim telemetry client', () => {
  it('performs hello/welcome/schema/lifecycle handshake before becoming ready', () => {
    const harness = createHarness();
    harness.client.connect();
    const socket = harness.sockets[0]!;

    expect(harness.client.state).toBe('connecting');
    socket.emitOpen();
    expect(harness.client.state).toBe('awaiting-hello-required');

    socket.emitText({ type: 'helloRequired', protocolVersion: 1 });
    expect(harness.client.state).toBe('awaiting-welcome');
    expect(JSON.parse(socket.sent[0]!)).toMatchObject({ type: 'hello', protocolVersion: 1 });

    socket.emitText(welcome());
    expect(harness.client.state).toBe('waiting-schema');
    socket.emitText(schema());
    socket.emitText({ type: 'lifecycle', state: 'up', generation: 4, signature: 'epicEFI test', schemaCompatible: true });

    expect(harness.client.state).toBe('ready');
    expect(harness.client.welcome?.limits.maxRateHz).toBe(50);
    expect(harness.client.schema?.channels.map((channel) => channel.id)).toEqual(['RPMValue', 'coolant']);
  });

  it('subscribes with explicit rates, accepts matching streamDefinition and emits binary telemetry', async () => {
    const harness = createHarness();
    const socket = makeReady(harness);
    const subscriptionId = harness.client.subscribe({ channels: ['RPMValue', 'coolant'], rateHz: 50, deliveryHz: 10 });
    const subscribe = JSON.parse(socket.sent.at(-1)!) as { requestId: number };

    expect(JSON.parse(socket.sent.at(-1)!)).toMatchObject({
      type: 'subscribe',
      channels: ['RPMValue', 'coolant'],
      mode: 'series',
      rateHz: 50,
      deliveryHz: 10,
    });

    socket.emitText({
      type: 'streamDefinition',
      protocolVersion: 1,
      streamId: 7,
      schemaId: 'native-v1:test',
      generation: 4,
      channels: ['RPMValue', 'coolant'],
      mode: 'series',
      rateHz: 50,
      deliveryHz: 10,
      encoding: 'epicefi-f64-v1',
      requestId: subscribe.requestId,
    });
    socket.emitBinary(telemetryFrame(7, 4n, [812, 83.5]));
    await Promise.resolve();
    await Promise.resolve();

    const telemetry = harness.events.findLast((event) => event.type === 'telemetry');
    expect(telemetry?.type).toBe('telemetry');
    if (telemetry?.type === 'telemetry') {
      expect(telemetry.subscriptionId).toBe(subscriptionId);
      expect([...telemetry.frame.samples[0]!.values]).toEqual([812, 83.5]);
    }
  });

  it('invalidates streams on lifecycle change and automatically resubscribes desired streams', () => {
    const harness = createHarness();
    const socket = makeReady(harness);
    harness.client.subscribe({ channels: ['RPMValue'], rateHz: 20, deliveryHz: 10 });
    const first = JSON.parse(socket.sent.at(-1)!) as { requestId: number };
    socket.emitText({
      type: 'streamDefinition', protocolVersion: 1, streamId: 3, schemaId: 'native-v1:test', generation: 4,
      channels: ['RPMValue'], mode: 'series', rateHz: 20, deliveryHz: 10, encoding: 'epicefi-f64-v1', requestId: first.requestId,
    });

    const sendsBeforeLifecycle = socket.sent.length;
    socket.emitText(schema());
    socket.emitText({ type: 'lifecycle', state: 'up', generation: 5, signature: 'epicEFI test', schemaCompatible: true });

    expect(harness.client.state).toBe('ready');
    expect(socket.sent.length).toBe(sendsBeforeLifecycle + 1);
    expect(JSON.parse(socket.sent.at(-1)!)).toMatchObject({ type: 'subscribe', channels: ['RPMValue'], rateHz: 20, deliveryHz: 10 });
  });

  it('enters ECU-down and incompatible-schema states without subscribing', () => {
    const harness = createHarness();
    const socket = makeReady(harness);

    socket.emitText({ type: 'lifecycle', state: 'down', generation: 4 });
    expect(harness.client.state).toBe('ecu-down');

    socket.emitText({
      type: 'schema',
      schema: { id: 'native-unavailable', iniHash: '', decoderVersion: 'epicefi-native-output-v1', complete: false, decodable: false, channels: [] },
    });
    socket.emitText({ type: 'lifecycle', state: 'up', generation: 5, signature: 'other', schemaCompatible: false });
    expect(harness.client.state).toBe('incompatible-schema');
  });

  it('rejects illegal subscriptions before sending them', () => {
    const harness = createHarness();
    const socket = makeReady(harness);
    const sentBefore = socket.sent.length;

    expect(() => harness.client.subscribe({ channels: ['missing'], rateHz: 20, deliveryHz: 10 })).toThrow(ShimProtocolError);
    expect(() => harness.client.subscribe({ channels: ['RPMValue'], rateHz: 60, deliveryHz: 10 })).toThrow(ShimProtocolError);
    expect(harness.sockets[0]!.sent).toHaveLength(sentBefore);
  });

  it('unsubscribes active streams and stops accepting their telemetry immediately', async () => {
    const harness = createHarness();
    const socket = makeReady(harness);
    const subscriptionId = harness.client.subscribe({ channels: ['RPMValue'], rateHz: 20, deliveryHz: 10 });
    const subscribe = JSON.parse(socket.sent.at(-1)!) as { requestId: number };
    socket.emitText({
      type: 'streamDefinition', protocolVersion: 1, streamId: 8, schemaId: 'native-v1:test', generation: 4,
      channels: ['RPMValue'], mode: 'series', rateHz: 20, deliveryHz: 10, encoding: 'epicefi-f64-v1', requestId: subscribe.requestId,
    });

    expect(harness.client.unsubscribe(subscriptionId)).toBe(true);
    expect(JSON.parse(socket.sent.at(-1)!)).toMatchObject({ type: 'unsubscribe', streamId: 8 });
    const telemetryBefore = harness.events.filter((event) => event.type === 'telemetry').length;
    socket.emitBinary(telemetryFrame(8, 4n, [900]));
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.events.filter((event) => event.type === 'telemetry')).toHaveLength(telemetryBefore);
  });

  it('backs off reconnect attempts and treats close 1013 as quota pressure', () => {
    const harness = createHarness();
    harness.client.connect();
    harness.sockets[0]!.emitOpen();
    harness.sockets[0]!.emitClose(1006);
    expect(harness.scheduler.scheduled[0]?.delayMs).toBe(500);

    harness.scheduler.runNext();
    expect(harness.sockets).toHaveLength(2);
    harness.sockets[1]!.emitOpen();
    harness.sockets[1]!.emitClose(1006);
    expect(harness.scheduler.scheduled[0]?.delayMs).toBe(1_000);

    harness.scheduler.runNext();
    harness.sockets[2]!.emitOpen();
    harness.sockets[2]!.emitClose(1013);
    expect(harness.scheduler.scheduled[0]?.delayMs).toBeGreaterThanOrEqual(5_000);
  });

  it('resets reconnect backoff after a healthy welcome', () => {
    const harness = createHarness();
    harness.client.connect();
    const socket = harness.sockets[0]!;
    socket.emitOpen();
    socket.emitText({ type: 'helloRequired', protocolVersion: 1 });
    socket.emitText(welcome());
    socket.emitClose(1006);

    expect(harness.scheduler.scheduled[0]?.delayMs).toBe(500);
  });
});
