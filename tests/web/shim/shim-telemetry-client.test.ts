import { describe, expect, it } from 'vitest';
import { socketOwnershipScenario, currentSocketConversionScenario } from '../../fixtures/shim-socket-ownership';
import { createHarness, makeReady, welcome, schema, telemetryFrame } from '../../fixtures/shim-telemetry';
import { ShimProtocolError } from '../../../apps/web/src/adapters/shim/shim-protocol';

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

    const telemetry = [...harness.events].reverse().find((event) => event.type === 'telemetry');
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

describe('telemetry conversion ownership after transport replacement', () => {
  it.each(['success', 'reject', 'corrupt'] as const)('discards obsolete %s after reconnect even when stream ID/generation match', async kind => {
    const result = await socketOwnershipScenario(kind, 'reconnect');
    expect(result.lateTypes).toEqual([]); expect(result.stateAfterLate).toBe('ready');
    expect(result.currentValues).toEqual([222]); expect(result.binaryType).toBe('arraybuffer');
  });
  it.each(['success', 'reject', 'corrupt'] as const)('discards obsolete %s after manual disconnect', async kind => {
    const result = await socketOwnershipScenario(kind, 'disconnect');
    expect(result.lateTypes).toEqual([]); expect(result.stateAfterLate).toBe('disconnected');
  });
  it('rejects obsolete corrupt input before decoding even when a different frame generation would reject valid old frames', async () => {
    const result = await socketOwnershipScenario('corrupt', 'reconnect', 5);
    expect(result.lateTypes).toEqual([]); expect(result.stateAfterLate).toBe('ready'); expect(result.currentValues).toEqual([222]);
  });
});

describe('current transport conversion behavior', () => {
 it('still accepts native Blob conversion from the current socket', async () => {
  expect(await currentSocketConversionScenario('success')).toEqual({ state: 'ready', errors: 0, values: [333] });
 });
 it('still reports current conversion rejection as a protocol error', async () => {
  expect(await currentSocketConversionScenario('reject')).toEqual({ state: 'error', errors: 1, values: [] });
 });
});
