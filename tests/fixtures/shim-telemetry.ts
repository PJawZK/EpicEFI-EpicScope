import { ShimTelemetryClient, type ShimSocketLike, type ShimReconnectScheduler, type ShimTelemetryClientEvent } from '../../apps/web/src/adapters/shim/shim-telemetry-client';

export class FakeSocket implements ShimSocketLike {
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

  emitData(data: unknown): void {
    for (const listener of this.listeners.message) listener({ data } as MessageEvent<unknown>);
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

export class FakeScheduler implements ShimReconnectScheduler {
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

export function welcome(generation = 4) {
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

export function schema() {
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

export function telemetryFrame(streamId: number, generation: bigint, values: readonly number[]): Uint8Array {
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

export function createHarness() {
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

export function makeReady(harness: ReturnType<typeof createHarness>): FakeSocket {
  harness.client.connect();
  const socket = harness.sockets[0]!;
  socket.emitOpen();
  socket.emitText({ type: 'helloRequired', protocolVersion: 1 });
  socket.emitText(welcome());
  socket.emitText(schema());
  socket.emitText({ type: 'lifecycle', state: 'up', generation: 4, signature: 'epicEFI test', schemaCompatible: true });
  return socket;
}

