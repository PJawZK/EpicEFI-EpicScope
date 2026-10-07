export const SHIM_PROTOCOL_VERSION = 1 as const;
export const SHIM_TELEMETRY_ENCODING = 'epicefi-f64-v1' as const;

export type ShimQualityCode = 0 | 1 | 2 | 3 | 4;
export type ShimLifecycleState = 'up' | 'down';
export type ShimStreamMode = 'latest' | 'series';

export interface ShimLimits {
  readonly maxStreams: number;
  readonly maxChannelsPerStream: number;
  readonly maxRateHz: number;
  readonly maxDeliveryHz: number;
}

export interface ShimSchemaIdentity {
  readonly id: string;
  readonly iniHash: string;
}

export interface ShimWelcomeMessage {
  readonly type: 'welcome';
  readonly protocolVersion: 1;
  readonly clockId: string;
  readonly generation: number;
  readonly ecu: { readonly signature: string };
  readonly simulator: boolean;
  readonly schema: ShimSchemaIdentity;
  readonly capabilities: readonly string[];
  readonly limits: ShimLimits;
  readonly requestId?: number;
}

export interface ShimSchemaEnumValue {
  readonly value: number;
  readonly label: string;
}

export interface ShimSchemaDisplayHint {
  readonly id: string;
  readonly name: string;
  readonly unit?: string;
  readonly suggestedMin?: number;
  readonly suggestedMax?: number;
  readonly lowDanger?: number;
  readonly lowWarning?: number;
  readonly highWarning?: number;
  readonly highDanger?: number;
  readonly precision?: number;
  readonly labelPrecision?: number;
  readonly category?: string;
}

export interface ShimSchemaChannel {
  readonly id: string;
  readonly name: string;
  readonly unit: string;
  readonly type: 'number';
  readonly enumValues?: readonly ShimSchemaEnumValue[];
  readonly displayHints?: readonly ShimSchemaDisplayHint[];
  readonly category?: string;
  readonly onLabel?: string;
}

export interface ShimSchemaGaugePage {
  readonly id: string;
  readonly name: string;
  readonly gauges: readonly { readonly id: string; readonly channelId: string }[];
}

export interface ShimSchemaIndicator {
  readonly id: string;
  readonly channelId: string;
  readonly offLabel?: string;
  readonly onLabel?: string;
  readonly activeWhen: 'zero' | 'nonzero';
}

export interface ShimSchema {
  readonly id: string;
  readonly iniHash: string;
  readonly decoderVersion: string;
  readonly complete: boolean;
  readonly decodable: boolean;
  readonly channels: readonly ShimSchemaChannel[];
  readonly gaugePages?: readonly ShimSchemaGaugePage[];
  readonly indicators?: readonly ShimSchemaIndicator[];
}

export interface ShimSchemaMessage {
  readonly type: 'schema';
  readonly schema: ShimSchema;
  readonly requestId?: number;
}

export interface ShimLifecycleMessage {
  readonly type: 'lifecycle';
  readonly state: ShimLifecycleState;
  readonly generation: number;
  readonly signature?: string;
  readonly schemaCompatible?: boolean;
}

export interface ShimStreamDefinitionMessage {
  readonly type: 'streamDefinition';
  readonly protocolVersion: 1;
  readonly streamId: number;
  readonly schemaId: string;
  readonly generation: number;
  readonly channels: readonly string[];
  readonly mode: ShimStreamMode;
  readonly rateHz: number;
  readonly deliveryHz: number;
  readonly encoding: typeof SHIM_TELEMETRY_ENCODING;
  readonly requestId?: number;
}

export interface ShimHelloRequiredMessage {
  readonly type: 'helloRequired';
  readonly protocolVersion: 1;
}

export interface ShimUnsubscribedMessage {
  readonly type: 'unsubscribed';
  readonly streamId: number;
  readonly requestId?: number;
}

export interface ShimPongMessage {
  readonly type: 'pong';
  readonly requestId?: number;
}

export interface ShimErrorMessage {
  readonly type: 'error';
  readonly code: string;
  readonly message: string;
  readonly requestId?: number;
}

export type ShimServerControlMessage =
  | ShimHelloRequiredMessage
  | ShimWelcomeMessage
  | ShimSchemaMessage
  | ShimLifecycleMessage
  | ShimStreamDefinitionMessage
  | ShimUnsubscribedMessage
  | ShimPongMessage
  | ShimErrorMessage;

export interface ShimHelloRequest {
  readonly type: 'hello';
  readonly protocolVersion: 1;
  readonly requestId?: number;
}

export interface ShimGetSchemaRequest {
  readonly type: 'getSchema';
  readonly requestId?: number;
}

export interface ShimSubscribeRequest {
  readonly type: 'subscribe';
  readonly channels: readonly string[];
  readonly mode: ShimStreamMode;
  readonly rateHz: number;
  readonly deliveryHz: number;
  readonly requestId?: number;
}

export interface ShimUnsubscribeRequest {
  readonly type: 'unsubscribe';
  readonly streamId: number;
  readonly requestId?: number;
}

export interface ShimPingRequest {
  readonly type: 'ping';
  readonly requestId?: number;
}

export type ShimClientControlMessage =
  | ShimHelloRequest
  | ShimGetSchemaRequest
  | ShimSubscribeRequest
  | ShimUnsubscribeRequest
  | ShimPingRequest;

export class ShimProtocolError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ShimProtocolError';
    this.code = code;
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ShimProtocolError('invalidControlMessage', `${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function stringField(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new ShimProtocolError('invalidControlMessage', `${label} must be a string.`);
  return value;
}

function booleanField(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new ShimProtocolError('invalidControlMessage', `${label} must be a boolean.`);
  return value;
}

function safeInteger(value: unknown, label: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new ShimProtocolError('invalidControlMessage', `${label} must be a safe integer >= ${minimum}.`);
  }
  return value as number;
}

function finiteNumber(value: unknown, label: string, minimum?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || (minimum !== undefined && value < minimum)) {
    throw new ShimProtocolError('invalidControlMessage', `${label} must be a finite number${minimum === undefined ? '' : ` >= ${minimum}`}.`);
  }
  return value;
}

function optionalRequestId(source: Record<string, unknown>): { readonly requestId?: number } {
  const value = source.requestId;
  if (value === undefined) return {};
  return { requestId: safeInteger(value, 'requestId') };
}

function stringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new ShimProtocolError('invalidControlMessage', `${label} must be an array of strings.`);
  }
  return value as string[];
}

function parseSchema(value: unknown): ShimSchema {
  const source = record(value, 'schema');
  const rawChannels = source.channels;
  if (!Array.isArray(rawChannels)) throw new ShimProtocolError('invalidControlMessage', 'schema.channels must be an array.');
  const channels = rawChannels.map((value, index): ShimSchemaChannel => {
    const channel = record(value, `schema.channels[${index}]`);
    const type = stringField(channel.type, `schema.channels[${index}].type`);
    if (type !== 'number') throw new ShimProtocolError('invalidControlMessage', `schema.channels[${index}].type must be number.`);
    const result: ShimSchemaChannel = {
      id: stringField(channel.id, `schema.channels[${index}].id`),
      name: stringField(channel.name, `schema.channels[${index}].name`),
      unit: stringField(channel.unit, `schema.channels[${index}].unit`),
      type,
    };
    return result;
  });
  return {
    id: stringField(source.id, 'schema.id'),
    iniHash: stringField(source.iniHash, 'schema.iniHash'),
    decoderVersion: stringField(source.decoderVersion, 'schema.decoderVersion'),
    complete: booleanField(source.complete, 'schema.complete'),
    decodable: booleanField(source.decodable, 'schema.decodable'),
    channels,
  };
}

export function parseShimControlMessage(text: string): ShimServerControlMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new ShimProtocolError('malformedJson', 'Shim control payload is not valid JSON.');
  }
  const source = record(parsed, 'control message');
  const type = stringField(source.type, 'control message type');

  switch (type) {
    case 'helloRequired': {
      const protocolVersion = safeInteger(source.protocolVersion, 'protocolVersion');
      if (protocolVersion !== SHIM_PROTOCOL_VERSION) throw new ShimProtocolError('versionMismatch', `Unsupported shim protocol version ${protocolVersion}.`);
      return { type, protocolVersion };
    }
    case 'welcome': {
      const protocolVersion = safeInteger(source.protocolVersion, 'protocolVersion');
      if (protocolVersion !== SHIM_PROTOCOL_VERSION) throw new ShimProtocolError('versionMismatch', `Unsupported shim protocol version ${protocolVersion}.`);
      const ecu = record(source.ecu, 'welcome.ecu');
      const schema = record(source.schema, 'welcome.schema');
      const limits = record(source.limits, 'welcome.limits');
      return {
        type,
        protocolVersion,
        clockId: stringField(source.clockId, 'welcome.clockId'),
        generation: safeInteger(source.generation, 'welcome.generation'),
        ecu: { signature: stringField(ecu.signature, 'welcome.ecu.signature') },
        simulator: booleanField(source.simulator, 'welcome.simulator'),
        schema: {
          id: stringField(schema.id, 'welcome.schema.id'),
          iniHash: stringField(schema.iniHash, 'welcome.schema.iniHash'),
        },
        capabilities: stringArray(source.capabilities, 'welcome.capabilities'),
        limits: {
          maxStreams: safeInteger(limits.maxStreams, 'welcome.limits.maxStreams', 1),
          maxChannelsPerStream: safeInteger(limits.maxChannelsPerStream, 'welcome.limits.maxChannelsPerStream', 1),
          maxRateHz: finiteNumber(limits.maxRateHz, 'welcome.limits.maxRateHz', 0),
          maxDeliveryHz: finiteNumber(limits.maxDeliveryHz, 'welcome.limits.maxDeliveryHz', 0),
        },
        ...optionalRequestId(source),
      };
    }
    case 'schema':
      return { type, schema: parseSchema(source.schema), ...optionalRequestId(source) };
    case 'lifecycle': {
      const state = stringField(source.state, 'lifecycle.state');
      if (state !== 'up' && state !== 'down') throw new ShimProtocolError('invalidControlMessage', `Unsupported lifecycle state ${state}.`);
      return {
        type,
        state,
        generation: safeInteger(source.generation, 'lifecycle.generation'),
        ...(source.signature === undefined ? {} : { signature: stringField(source.signature, 'lifecycle.signature') }),
        ...(source.schemaCompatible === undefined ? {} : { schemaCompatible: booleanField(source.schemaCompatible, 'lifecycle.schemaCompatible') }),
      };
    }
    case 'streamDefinition': {
      const protocolVersion = safeInteger(source.protocolVersion, 'protocolVersion');
      if (protocolVersion !== SHIM_PROTOCOL_VERSION) throw new ShimProtocolError('versionMismatch', `Unsupported shim protocol version ${protocolVersion}.`);
      const mode = stringField(source.mode, 'streamDefinition.mode');
      if (mode !== 'latest' && mode !== 'series') throw new ShimProtocolError('invalidControlMessage', `Unsupported stream mode ${mode}.`);
      const encoding = stringField(source.encoding, 'streamDefinition.encoding');
      if (encoding !== SHIM_TELEMETRY_ENCODING) throw new ShimProtocolError('unsupportedEncoding', `Unsupported shim telemetry encoding ${encoding}.`);
      return {
        type,
        protocolVersion,
        streamId: safeInteger(source.streamId, 'streamDefinition.streamId', 1),
        schemaId: stringField(source.schemaId, 'streamDefinition.schemaId'),
        generation: safeInteger(source.generation, 'streamDefinition.generation'),
        channels: stringArray(source.channels, 'streamDefinition.channels'),
        mode,
        rateHz: finiteNumber(source.rateHz, 'streamDefinition.rateHz', 0),
        deliveryHz: finiteNumber(source.deliveryHz, 'streamDefinition.deliveryHz', 0),
        encoding,
        ...optionalRequestId(source),
      };
    }
    case 'unsubscribed':
      return { type, streamId: safeInteger(source.streamId, 'unsubscribed.streamId', 1), ...optionalRequestId(source) };
    case 'pong':
      return { type, ...optionalRequestId(source) };
    case 'error':
      return {
        type,
        code: stringField(source.code, 'error.code'),
        message: stringField(source.message, 'error.message'),
        ...optionalRequestId(source),
      };
    default:
      throw new ShimProtocolError('unknownServerMessage', `Unsupported shim server message type ${type}.`);
  }
}
