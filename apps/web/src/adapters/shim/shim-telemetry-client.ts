import { decodeShimTelemetryFrame, type ShimTelemetryFrame } from './shim-binary-decoder';
import {
  SHIM_PROTOCOL_VERSION,
  type ShimErrorMessage,
  type ShimLifecycleMessage,
  type ShimSchema,
  type ShimSchemaMessage,
  type ShimServerControlMessage,
  type ShimStreamDefinitionMessage,
  type ShimStreamMode,
  type ShimWelcomeMessage,
  ShimProtocolError,
  parseShimControlMessage,
} from './shim-protocol';

export type ShimTelemetryClientState =
  | 'disconnected'
  | 'connecting'
  | 'awaiting-hello-required'
  | 'awaiting-welcome'
  | 'waiting-schema'
  | 'ready'
  | 'ecu-down'
  | 'incompatible-schema'
  | 'reconnecting'
  | 'error';

export interface ShimSocketLike {
  binaryType: BinaryType;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: 'open', listener: (event: Event) => void): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  addEventListener(type: 'close', listener: (event: CloseEvent) => void): void;
  addEventListener(type: 'error', listener: (event: Event) => void): void;
}

export type ShimSocketFactory = (url: string) => ShimSocketLike;

export interface ShimReconnectScheduler {
  schedule(callback: () => void, delayMs: number): number;
  cancel(token: number): void;
}

export interface ShimSubscriptionSpec {
  readonly channels: readonly string[];
  readonly mode?: ShimStreamMode;
  readonly rateHz: number;
  readonly deliveryHz: number;
}

interface DesiredSubscription {
  readonly id: number;
  readonly channels: readonly string[];
  readonly mode: ShimStreamMode;
  readonly rateHz: number;
  readonly deliveryHz: number;
}

interface ActiveSubscription {
  readonly subscriptionId: number;
  readonly definition: ShimStreamDefinitionMessage;
}

export type ShimTelemetryClientEvent =
  | { readonly type: 'state'; readonly state: ShimTelemetryClientState }
  | { readonly type: 'welcome'; readonly welcome: ShimWelcomeMessage }
  | { readonly type: 'schema'; readonly schema: ShimSchema }
  | { readonly type: 'lifecycle'; readonly lifecycle: ShimLifecycleMessage }
  | { readonly type: 'streamDefinition'; readonly subscriptionId: number; readonly definition: ShimStreamDefinitionMessage }
  | { readonly type: 'telemetry'; readonly subscriptionId: number; readonly frame: ShimTelemetryFrame }
  | { readonly type: 'serverError'; readonly error: ShimErrorMessage; readonly subscriptionId?: number }
  | { readonly type: 'protocolError'; readonly error: ShimProtocolError }
  | { readonly type: 'transportError' }
  | { readonly type: 'reconnectScheduled'; readonly delayMs: number; readonly closeCode?: number };

export interface ShimTelemetryClientOptions {
  readonly url: string;
  readonly socketFactory?: ShimSocketFactory;
  readonly scheduler?: ShimReconnectScheduler;
}

const DEFAULT_RECONNECT_DELAYS_MS = [500, 1_000, 2_000, 4_000, 8_000, 15_000] as const;
const CLIENT_QUOTA_CLOSE_CODE = 1013;
const CLIENT_QUOTA_MIN_RETRY_MS = 5_000;

const DEFAULT_SCHEDULER: ShimReconnectScheduler = {
  schedule(callback, delayMs) {
    return globalThis.setTimeout(callback, delayMs);
  },
  cancel(token) {
    globalThis.clearTimeout(token);
  },
};

function defaultSocketFactory(url: string): ShimSocketLike {
  return new WebSocket(url) as unknown as ShimSocketLike;
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function asProtocolError(error: unknown): ShimProtocolError {
  if (error instanceof ShimProtocolError) return error;
  return new ShimProtocolError('telemetryClientError', error instanceof Error ? error.message : String(error));
}

async function binaryBytes(data: unknown): Promise<Uint8Array> {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return new Uint8Array(await data.arrayBuffer());
  }
  throw new ShimProtocolError('unexpectedWebSocketPayload', 'Shim WebSocket message is neither JSON text nor binary telemetry.');
}

export class ShimTelemetryClient {
  private readonly url: string;
  private readonly socketFactory: ShimSocketFactory;
  private readonly scheduler: ShimReconnectScheduler;
  private readonly listeners = new Set<(event: ShimTelemetryClientEvent) => void>();
  private readonly desiredSubscriptions = new Map<number, DesiredSubscription>();
  private readonly pendingSubscribeRequests = new Map<number, number>();
  private readonly cancelledSubscribeRequests = new Set<number>();
  private readonly activeStreams = new Map<number, ActiveSubscription>();

  private socket: ShimSocketLike | undefined;
  private reconnectToken: number | undefined;
  private reconnectAttempt = 0;
  private nextRequestId = 1;
  private nextSubscriptionId = 1;
  private manualDisconnect = false;
  private helloSent = false;
  private currentState: ShimTelemetryClientState = 'disconnected';
  private currentWelcome: ShimWelcomeMessage | undefined;
  private currentSchema: ShimSchema | undefined;
  private currentGeneration: number | undefined;

  constructor(options: ShimTelemetryClientOptions) {
    this.url = options.url;
    this.socketFactory = options.socketFactory ?? defaultSocketFactory;
    this.scheduler = options.scheduler ?? DEFAULT_SCHEDULER;
  }

  get state(): ShimTelemetryClientState {
    return this.currentState;
  }

  get welcome(): ShimWelcomeMessage | undefined {
    return this.currentWelcome;
  }

  get schema(): ShimSchema | undefined {
    return this.currentSchema;
  }

  onEvent(listener: (event: ShimTelemetryClientEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  connect(): void {
    if (this.socket) return;
    this.manualDisconnect = false;
    this.cancelReconnect();
    this.openSocket(false);
  }

  disconnect(): void {
    this.manualDisconnect = true;
    this.cancelReconnect();
    this.clearConnectionState();
    const socket = this.socket;
    this.socket = undefined;
    if (socket) socket.close(1000, 'EpicScope disconnect');
    this.setState('disconnected');
  }

  subscribe(spec: ShimSubscriptionSpec): number {
    if (this.currentState !== 'ready' || !this.currentWelcome || !this.currentSchema) {
      throw new ShimProtocolError('clientNotReady', 'Shim telemetry client must be ready before subscribing.');
    }
    const desired: DesiredSubscription = {
      id: this.nextSubscriptionId++,
      channels: [...spec.channels],
      mode: spec.mode ?? 'series',
      rateHz: spec.rateHz,
      deliveryHz: spec.deliveryHz,
    };
    this.validateSubscription(desired);
    this.desiredSubscriptions.set(desired.id, desired);
    this.sendSubscribe(desired);
    return desired.id;
  }

  unsubscribe(subscriptionId: number): boolean {
    if (!this.desiredSubscriptions.delete(subscriptionId)) return false;

    for (const [requestId, pendingSubscriptionId] of this.pendingSubscribeRequests) {
      if (pendingSubscriptionId !== subscriptionId) continue;
      this.pendingSubscribeRequests.delete(requestId);
      this.cancelledSubscribeRequests.add(requestId);
    }

    for (const [streamId, active] of this.activeStreams) {
      if (active.subscriptionId !== subscriptionId) continue;
      this.activeStreams.delete(streamId);
      this.sendControl({ type: 'unsubscribe', streamId, requestId: this.allocateRequestId() });
    }
    return true;
  }

  private emit(event: ShimTelemetryClientEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private setState(state: ShimTelemetryClientState): void {
    if (this.currentState === state) return;
    this.currentState = state;
    this.emit({ type: 'state', state });
  }

  private allocateRequestId(): number {
    const requestId = this.nextRequestId;
    this.nextRequestId = requestId >= Number.MAX_SAFE_INTEGER ? 1 : requestId + 1;
    return requestId;
  }

  private openSocket(isReconnect: boolean): void {
    this.clearConnectionState();
    this.setState(isReconnect ? 'reconnecting' : 'connecting');

    let socket: ShimSocketLike;
    try {
      socket = this.socketFactory(this.url);
    } catch (error) {
      this.emit({ type: 'protocolError', error: asProtocolError(error) });
      this.scheduleReconnect();
      return;
    }

    this.socket = socket;
    socket.binaryType = 'arraybuffer';
    socket.addEventListener('open', () => {
      if (this.socket !== socket) return;
      this.setState('awaiting-hello-required');
    });
    socket.addEventListener('message', (event) => {
      if (this.socket !== socket) return;
      void this.handleMessage(event.data).catch((error) => {
        this.emit({ type: 'protocolError', error: asProtocolError(error) });
        this.setState('error');
      });
    });
    socket.addEventListener('error', () => {
      if (this.socket !== socket) return;
      this.emit({ type: 'transportError' });
    });
    socket.addEventListener('close', (event) => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      this.clearConnectionState();
      if (this.manualDisconnect) {
        this.setState('disconnected');
        return;
      }
      this.scheduleReconnect(event.code);
    });
  }

  private clearConnectionState(): void {
    this.helloSent = false;
    this.currentWelcome = undefined;
    this.currentSchema = undefined;
    this.currentGeneration = undefined;
    this.pendingSubscribeRequests.clear();
    this.cancelledSubscribeRequests.clear();
    this.activeStreams.clear();
  }

  private scheduleReconnect(closeCode?: number): void {
    if (this.manualDisconnect || this.reconnectToken !== undefined) return;
    const index = Math.min(this.reconnectAttempt, DEFAULT_RECONNECT_DELAYS_MS.length - 1);
    let delayMs: number = DEFAULT_RECONNECT_DELAYS_MS[index] ?? 15_000;
    if (closeCode === CLIENT_QUOTA_CLOSE_CODE) delayMs = Math.max(delayMs, CLIENT_QUOTA_MIN_RETRY_MS);
    this.reconnectAttempt += 1;
    this.setState('reconnecting');
    this.emit({
      type: 'reconnectScheduled',
      delayMs,
      ...(closeCode === undefined ? {} : { closeCode }),
    });
    this.reconnectToken = this.scheduler.schedule(() => {
      this.reconnectToken = undefined;
      if (!this.manualDisconnect && !this.socket) this.openSocket(true);
    }, delayMs);
  }

  private cancelReconnect(): void {
    if (this.reconnectToken === undefined) return;
    this.scheduler.cancel(this.reconnectToken);
    this.reconnectToken = undefined;
  }

  private sendControl(message: Record<string, unknown>): void {
    if (!this.socket) throw new ShimProtocolError('socketUnavailable', 'Shim WebSocket is not connected.');
    this.socket.send(JSON.stringify(message));
  }

  private async handleMessage(data: unknown): Promise<void> {
    if (typeof data === 'string') {
      this.handleControl(parseShimControlMessage(data));
      return;
    }
    const bytes = await binaryBytes(data);
    this.handleTelemetry(bytes);
  }

  private handleControl(message: ShimServerControlMessage): void {
    switch (message.type) {
      case 'helloRequired':
        this.handleHelloRequired();
        return;
      case 'welcome':
        this.handleWelcome(message);
        return;
      case 'schema':
        this.handleSchema(message);
        return;
      case 'lifecycle':
        this.handleLifecycle(message);
        return;
      case 'streamDefinition':
        this.handleStreamDefinition(message);
        return;
      case 'unsubscribed':
      case 'pong':
        return;
      case 'error':
        this.handleServerError(message);
        return;
    }
  }

  private handleHelloRequired(): void {
    if (this.helloSent) return;
    this.helloSent = true;
    this.sendControl({ type: 'hello', protocolVersion: SHIM_PROTOCOL_VERSION, requestId: this.allocateRequestId() });
    this.setState('awaiting-welcome');
  }

  private handleWelcome(message: ShimWelcomeMessage): void {
    this.currentWelcome = message;
    this.currentGeneration = message.generation;
    this.reconnectAttempt = 0;
    this.emit({ type: 'welcome', welcome: message });
    this.setState('waiting-schema');
  }

  private handleSchema(message: ShimSchemaMessage): void {
    this.currentSchema = message.schema;
    this.emit({ type: 'schema', schema: message.schema });
    if (!message.schema.decodable) this.setState('incompatible-schema');
  }

  private handleLifecycle(message: ShimLifecycleMessage): void {
    this.pendingSubscribeRequests.clear();
    this.cancelledSubscribeRequests.clear();
    this.activeStreams.clear();
    this.currentGeneration = message.generation;
    this.emit({ type: 'lifecycle', lifecycle: message });

    if (message.state === 'down') {
      this.setState('ecu-down');
      return;
    }
    if (message.schemaCompatible === false || this.currentSchema?.decodable === false) {
      this.setState('incompatible-schema');
      return;
    }
    if (!this.currentSchema) {
      this.setState('waiting-schema');
      return;
    }

    this.setState('ready');
    this.resubscribeDesired();
  }

  private validateSubscription(spec: DesiredSubscription): void {
    const welcome = this.currentWelcome;
    const schema = this.currentSchema;
    if (!welcome || !schema) throw new ShimProtocolError('clientNotReady', 'Shim welcome/schema are unavailable.');
    if (spec.channels.length < 1 || spec.channels.length > welcome.limits.maxChannelsPerStream) {
      throw new ShimProtocolError('invalidSubscription', `Subscription channel count must be 1..${welcome.limits.maxChannelsPerStream}.`);
    }
    if (new Set(spec.channels).size !== spec.channels.length) {
      throw new ShimProtocolError('invalidSubscription', 'Subscription channels must be unique.');
    }
    const available = new Set(schema.channels.map((channel) => channel.id));
    const unavailable = spec.channels.find((channel) => !available.has(channel));
    if (unavailable) throw new ShimProtocolError('invalidSubscription', `Channel ${unavailable} is not present in the active shim schema.`);
    if (!(spec.rateHz > 0) || spec.rateHz > welcome.limits.maxRateHz) {
      throw new ShimProtocolError('invalidSubscription', `rateHz must be > 0 and <= ${welcome.limits.maxRateHz}.`);
    }
    if (!(spec.deliveryHz > 0) || spec.deliveryHz > welcome.limits.maxDeliveryHz) {
      throw new ShimProtocolError('invalidSubscription', `deliveryHz must be > 0 and <= ${welcome.limits.maxDeliveryHz}.`);
    }
    if (this.desiredSubscriptions.size >= welcome.limits.maxStreams && !this.desiredSubscriptions.has(spec.id)) {
      throw new ShimProtocolError('invalidSubscription', `Connection supports at most ${welcome.limits.maxStreams} streams.`);
    }
  }

  private sendSubscribe(spec: DesiredSubscription): void {
    this.validateSubscription(spec);
    const requestId = this.allocateRequestId();
    this.pendingSubscribeRequests.set(requestId, spec.id);
    this.sendControl({
      type: 'subscribe',
      requestId,
      channels: spec.channels,
      mode: spec.mode,
      rateHz: spec.rateHz,
      deliveryHz: spec.deliveryHz,
    });
  }

  private resubscribeDesired(): void {
    for (const spec of this.desiredSubscriptions.values()) {
      try {
        this.sendSubscribe(spec);
      } catch (error) {
        this.emit({ type: 'protocolError', error: asProtocolError(error) });
      }
    }
  }

  private handleStreamDefinition(message: ShimStreamDefinitionMessage): void {
    const requestId = message.requestId;
    if (requestId === undefined) {
      this.emit({ type: 'protocolError', error: new ShimProtocolError('unmatchedStreamDefinition', 'streamDefinition omitted the requestId for an EpicScope subscription.') });
      return;
    }

    if (this.cancelledSubscribeRequests.delete(requestId)) {
      this.sendControl({ type: 'unsubscribe', streamId: message.streamId, requestId: this.allocateRequestId() });
      return;
    }

    const subscriptionId = this.pendingSubscribeRequests.get(requestId);
    if (subscriptionId === undefined) {
      this.emit({ type: 'protocolError', error: new ShimProtocolError('unmatchedStreamDefinition', `No pending subscription matches requestId ${requestId}.`) });
      return;
    }
    this.pendingSubscribeRequests.delete(requestId);

    const desired = this.desiredSubscriptions.get(subscriptionId);
    if (!desired) {
      this.sendControl({ type: 'unsubscribe', streamId: message.streamId, requestId: this.allocateRequestId() });
      return;
    }

    if (
      message.schemaId !== this.currentSchema?.id
      || message.generation !== this.currentGeneration
      || !sameStrings(message.channels, desired.channels)
      || message.mode !== desired.mode
      || message.rateHz !== desired.rateHz
      || message.deliveryHz !== desired.deliveryHz
    ) {
      this.emit({ type: 'protocolError', error: new ShimProtocolError('streamDefinitionMismatch', 'Shim streamDefinition does not match the requested active subscription.') });
      this.sendControl({ type: 'unsubscribe', streamId: message.streamId, requestId: this.allocateRequestId() });
      return;
    }

    this.activeStreams.set(message.streamId, { subscriptionId, definition: message });
    this.emit({ type: 'streamDefinition', subscriptionId, definition: message });
  }

  private handleServerError(message: ShimErrorMessage): void {
    const subscriptionId = message.requestId === undefined ? undefined : this.pendingSubscribeRequests.get(message.requestId);
    if (message.requestId !== undefined) this.pendingSubscribeRequests.delete(message.requestId);
    this.emit({
      type: 'serverError',
      error: message,
      ...(subscriptionId === undefined ? {} : { subscriptionId }),
    });
  }

  private handleTelemetry(bytes: Uint8Array): void {
    const frame = decodeShimTelemetryFrame(bytes);
    const active = this.activeStreams.get(frame.streamId);
    if (!active) return;
    if (frame.generation !== BigInt(active.definition.generation)) return;
    if (frame.channelCount !== active.definition.channels.length) {
      this.emit({ type: 'protocolError', error: new ShimProtocolError('unexpectedTelemetryChannelCount', `Telemetry channel count ${frame.channelCount} does not match stream definition ${active.definition.channels.length}.`) });
      return;
    }
    this.emit({ type: 'telemetry', subscriptionId: active.subscriptionId, frame });
  }
}
