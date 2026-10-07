import { describe, expect, it } from 'vitest';
import {
  parseShimControlMessage,
  SHIM_PROTOCOL_VERSION,
  SHIM_TELEMETRY_ENCODING,
  ShimProtocolError,
} from '../../../apps/web/src/adapters/shim/shim-protocol';

function expectProtocolError(text: string, code: string): void {
  try {
    parseShimControlMessage(text);
    throw new Error('Expected ShimProtocolError.');
  } catch (error) {
    expect(error).toBeInstanceOf(ShimProtocolError);
    expect((error as ShimProtocolError).code).toBe(code);
  }
}

describe('ts_shim control protocol v1', () => {
  it('parses helloRequired and welcome with negotiated limits', () => {
    expect(parseShimControlMessage('{"type":"helloRequired","protocolVersion":1}')).toEqual({
      type: 'helloRequired',
      protocolVersion: SHIM_PROTOCOL_VERSION,
    });

    const welcome = parseShimControlMessage(JSON.stringify({
      type: 'welcome',
      protocolVersion: 1,
      clockId: 'native-1234',
      generation: 3,
      ecu: { signature: 'epicEFI master.test' },
      simulator: false,
      schema: { id: 'native-v1:1a2b3c4d', iniHash: 'crc32:1a2b3c4d' },
      capabilities: ['latest', 'series', 'float64'],
      limits: { maxStreams: 16, maxChannelsPerStream: 256, maxRateHz: 50, maxDeliveryHz: 60 },
      requestId: 1,
    }));

    expect(welcome.type).toBe('welcome');
    if (welcome.type !== 'welcome') throw new Error('unexpected message');
    expect(welcome.clockId).toBe('native-1234');
    expect(welcome.generation).toBe(3);
    expect(welcome.ecu.signature).toBe('epicEFI master.test');
    expect(welcome.limits.maxRateHz).toBe(50);
    expect(welcome.limits.maxChannelsPerStream).toBe(256);
    expect(welcome.requestId).toBe(1);
  });

  it('parses lifecycle and streamDefinition identity used to validate binary frames', () => {
    const lifecycle = parseShimControlMessage(JSON.stringify({
      type: 'lifecycle',
      state: 'up',
      generation: 4,
      signature: 'epicEFI master.test',
      schemaCompatible: true,
    }));
    expect(lifecycle).toEqual({
      type: 'lifecycle',
      state: 'up',
      generation: 4,
      signature: 'epicEFI master.test',
      schemaCompatible: true,
    });

    const definition = parseShimControlMessage(JSON.stringify({
      type: 'streamDefinition',
      protocolVersion: 1,
      streamId: 7,
      schemaId: 'native-v1:1a2b3c4d',
      generation: 4,
      channels: ['RPMValue', 'coolant'],
      mode: 'series',
      rateHz: 50,
      deliveryHz: 10,
      encoding: SHIM_TELEMETRY_ENCODING,
      requestId: 3,
    }));
    expect(definition.type).toBe('streamDefinition');
    if (definition.type !== 'streamDefinition') throw new Error('unexpected message');
    expect(definition.channels).toEqual(['RPMValue', 'coolant']);
    expect(definition.encoding).toBe(SHIM_TELEMETRY_ENCODING);
  });

  it('parses the live schema channel registry', () => {
    const message = parseShimControlMessage(JSON.stringify({
      type: 'schema',
      schema: {
        id: 'native-v1:1a2b3c4d',
        iniHash: 'crc32:1a2b3c4d',
        decoderVersion: 'epicefi-native-output-v1',
        complete: true,
        decodable: true,
        channels: [
          { id: 'RPMValue', name: 'RPMValue', unit: 'RPM', type: 'number' },
          { id: 'fanOn', name: 'fanOn', unit: '', type: 'number' },
        ],
      },
    }));
    expect(message.type).toBe('schema');
    if (message.type !== 'schema') throw new Error('unexpected message');
    expect(message.schema.decodable).toBe(true);
    expect(message.schema.channels.map((channel) => channel.id)).toEqual(['RPMValue', 'fanOn']);
  });

  it('rejects malformed JSON, protocol mismatch, unknown messages and unsupported telemetry encoding', () => {
    expectProtocolError('{', 'malformedJson');
    expectProtocolError('{"type":"helloRequired","protocolVersion":2}', 'versionMismatch');
    expectProtocolError('{"type":"somethingNew"}', 'unknownServerMessage');
    expectProtocolError(JSON.stringify({
      type: 'streamDefinition',
      protocolVersion: 1,
      streamId: 1,
      schemaId: 'x',
      generation: 1,
      channels: ['RPMValue'],
      mode: 'series',
      rateHz: 20,
      deliveryHz: 10,
      encoding: 'other',
    }), 'unsupportedEncoding');
  });
});
