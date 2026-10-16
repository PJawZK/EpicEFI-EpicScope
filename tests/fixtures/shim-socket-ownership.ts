import { createHarness, makeReady, schema, welcome, telemetryFrame, type FakeSocket } from './shim-telemetry';
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function define(socket: FakeSocket, streamGeneration = 4) {
    const request = JSON.parse(socket.sent.at(-1)!);
    socket.emitText({ type: 'streamDefinition', protocolVersion: 1, streamId: 7, schemaId: 'native-v1:test', generation: streamGeneration, channels: ['RPMValue'], mode: 'series', rateHz: 20, deliveryHz: 10, encoding: 'epicefi-f64-v1', requestId: request.requestId });
}

export async function socketOwnershipScenario(kind: 'success' | 'reject' | 'corrupt', replace: 'reconnect' | 'disconnect', generation = 4) {
  const harness = createHarness(), old = makeReady(harness);
  const subscription = harness.client.subscribe({ channels: ['RPMValue'], rateHz: 20, deliveryHz: 10 });
  define(old);
  let resolve!: (value: ArrayBuffer) => void, reject!: (error: Error) => void;
  const held = new Promise<ArrayBuffer>((yes, no) => { resolve = yes; reject = no; });
  class DeferredBlob extends Blob { override arrayBuffer(): Promise<ArrayBuffer> { return held; } }
  old.emitData(new DeferredBlob());
  if (replace === 'reconnect') {
    old.emitClose(1006); harness.scheduler.runNext();
    const current = harness.sockets[1]!;
    current.emitOpen(); current.emitText({ type: 'helloRequired', protocolVersion: 1 }); current.emitText(welcome(generation)); current.emitText(schema());
    current.emitText({ type: 'lifecycle', state: 'up', generation, signature: 'epicEFI test', schemaCompatible: true });
    define(current, generation); // Deliberately reuse stream ID and generation on the new transport.
  } else harness.client.disconnect();
  const before = harness.events.length;
  if (kind === 'reject') reject(new Error('old transport conversion failed'));
  else resolve((kind === 'corrupt' ? new Uint8Array([0, 1, 2]) : telemetryFrame(7, 4n, [111])).slice().buffer);
  await tick();
  const late = harness.events.slice(before), stateAfterLate = harness.client.state;
  let currentValues: number[] = [];
  if (replace === 'reconnect') {
    harness.sockets[1]!.emitBinary(telemetryFrame(7, BigInt(generation), [222])); await tick();
    currentValues = harness.events.slice(before).flatMap(event => event.type === 'telemetry' ? [...event.frame.samples[0]!.values] : []);
  }
  const result = { lateTypes: late.map(e => e.type), stateAfterLate, currentValues, subscription, binaryType: harness.sockets.at(-1)!.binaryType };
  harness.client.disconnect(); return result;
}

export async function currentSocketConversionScenario(kind: 'success' | 'reject') {
  const harness = createHarness(), socket = makeReady(harness);
  harness.client.subscribe({ channels: ['RPMValue'], rateHz: 20, deliveryHz: 10 }); define(socket);
  let conversion!: Promise<ArrayBuffer>;
  class CurrentBlob extends Blob {
    override arrayBuffer(): Promise<ArrayBuffer> {
      conversion = kind === 'success' ? super.arrayBuffer() : Promise.reject(new Error('current conversion failure'));
      return conversion;
    }
  }
  const before = harness.events.length;
  socket.emitData(new CurrentBlob([telemetryFrame(7, 4n, [333]).slice().buffer]));
  await conversion.catch(() => undefined); await tick();
  const events = harness.events.slice(before);
  const result = { state: harness.client.state, errors: events.filter(e => e.type === 'protocolError').length, values: events.flatMap(e => e.type === 'telemetry' ? [...e.frame.samples[0]!.values] : []) };
  harness.client.disconnect(); return result;
}
