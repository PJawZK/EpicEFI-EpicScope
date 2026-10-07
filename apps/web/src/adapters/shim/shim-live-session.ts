import { ShimCaptureSession } from './shim-capture-session';
import { ShimLiveNumericChannelDataSource } from './shim-live-data-source';
import { ShimProtocolError, type ShimWelcomeMessage } from './shim-protocol';
import type {
  ShimSubscriptionSpec,
  ShimTelemetryClientEvent,
  ShimTelemetryClientState,
} from './shim-telemetry-client';

export type ShimLiveSessionState =
  | 'idle'
  | 'waiting-stream'
  | 'recording'
  | 'waiting-reconnect'
  | 'stopped'
  | 'error';

export interface ShimLiveSessionClient {
  readonly state: ShimTelemetryClientState;
  readonly welcome: ShimWelcomeMessage | undefined;
  subscribe(spec: ShimSubscriptionSpec): number;
  unsubscribe(subscriptionId: number): boolean;
  onEvent(listener: (event: ShimTelemetryClientEvent) => void): () => void;
}

export interface ShimLiveRecordingSpec extends ShimSubscriptionSpec {
  readonly channels: readonly string[];
}

export type ShimLiveSessionEvent =
  | { readonly type: 'state'; readonly state: ShimLiveSessionState }
  | { readonly type: 'captureChanged'; readonly sampleCount: number; readonly deliveryLossCount: number }
  | { readonly type: 'error'; readonly error: ShimProtocolError };

export interface ShimLiveSessionOptions {
  readonly nowMs?: () => number;
}

export class ShimLiveSession {
  private readonly listeners = new Set<(event: ShimLiveSessionEvent) => void>();
  private readonly nowMs: () => number;
  private readonly unsubscribeClientEvents: () => void;
  private currentState: ShimLiveSessionState = 'idle';
  private subscriptionId: number | undefined;
  private captureInternal: ShimCaptureSession | undefined;
  private dataSourceInternal: ShimLiveNumericChannelDataSource | undefined;
  private recordingStartedAtMs = 0;

  constructor(
    private readonly client: ShimLiveSessionClient,
    options: ShimLiveSessionOptions = {},
  ) {
    this.nowMs = options.nowMs ?? (() => performance.now());
    this.unsubscribeClientEvents = client.onEvent((event) => this.handleClientEvent(event));
  }

  get state(): ShimLiveSessionState { return this.currentState; }
  get capture(): ShimCaptureSession | undefined { return this.captureInternal; }
  get dataSource(): ShimLiveNumericChannelDataSource | undefined { return this.dataSourceInternal; }
  get isRecording(): boolean { return this.subscriptionId !== undefined && this.currentState !== 'stopped'; }

  onEvent(listener: (event: ShimLiveSessionEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  startRecording(spec: ShimLiveRecordingSpec): void {
    if (this.subscriptionId !== undefined) throw new ShimProtocolError('recordingAlreadyActive', 'A shim recording is already active.');
    if (this.client.state !== 'ready' || !this.client.welcome) throw new ShimProtocolError('clientNotReady', 'Shim client must be ready before recording starts.');
    const capture = new ShimCaptureSession();
    this.captureInternal = capture;
    this.dataSourceInternal = new ShimLiveNumericChannelDataSource(capture);
    this.recordingStartedAtMs = this.nowMs();
    try {
      this.subscriptionId = this.client.subscribe({ ...spec, mode: spec.mode ?? 'series' });
      this.setState('waiting-stream');
    } catch (error) {
      this.captureInternal = undefined;
      this.dataSourceInternal = undefined;
      this.fail(error);
      throw error;
    }
  }

  stopRecording(): void {
    const subscriptionId = this.subscriptionId;
    this.subscriptionId = undefined;
    if (subscriptionId !== undefined) this.client.unsubscribe(subscriptionId);
    this.setState('stopped');
  }

  dispose(): void {
    if (this.subscriptionId !== undefined) this.client.unsubscribe(this.subscriptionId);
    this.subscriptionId = undefined;
    this.unsubscribeClientEvents();
    this.listeners.clear();
  }

  private emit(event: ShimLiveSessionEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private setState(state: ShimLiveSessionState): void {
    if (this.currentState === state) return;
    this.currentState = state;
    this.emit({ type: 'state', state });
  }

  private fail(error: unknown): void {
    const protocolError = error instanceof ShimProtocolError
      ? error
      : new ShimProtocolError('liveSessionError', error instanceof Error ? error.message : String(error));
    this.setState('error');
    this.emit({ type: 'error', error: protocolError });
  }

  private handleClientEvent(event: ShimTelemetryClientEvent): void {
    const subscriptionId = this.subscriptionId;
    if (subscriptionId === undefined) return;
    try {
      switch (event.type) {
        case 'streamDefinition':
          if (event.subscriptionId !== subscriptionId) return;
          this.beginSegment(event.definition);
          return;
        case 'telemetry':
          if (event.subscriptionId !== subscriptionId) return;
          this.captureInternal?.appendFrame(event.frame);
          if (this.captureInternal) this.emit({ type: 'captureChanged', sampleCount: this.captureInternal.sampleCount, deliveryLossCount: this.captureInternal.deliveryLossCount });
          this.setState('recording');
          return;
        case 'state':
          if (event.state === 'reconnecting' || event.state === 'ecu-down') this.setState('waiting-reconnect');
          return;
        case 'lifecycle':
          if (event.lifecycle.state === 'down') this.setState('waiting-reconnect');
          return;
        case 'serverError':
          if (event.subscriptionId === subscriptionId) this.fail(new ShimProtocolError(event.error.code, event.error.message));
          return;
        case 'protocolError':
          this.fail(event.error);
          return;
        default:
          return;
      }
    } catch (error) {
      this.fail(error);
    }
  }

  private beginSegment(definition: Parameters<ShimCaptureSession['beginSegment']>[0]['definition']): void {
    const capture = this.captureInternal;
    const welcome = this.client.welcome;
    if (!capture || !welcome) throw new ShimProtocolError('sessionMetadataMissing', 'Shim capture metadata is unavailable for a new stream segment.');
    const elapsedWallMs = Math.max(0, this.nowMs() - this.recordingStartedAtMs);
    const priorEndMs = capture.endTimeMs ?? 0;
    capture.beginSegment({
      clockId: welcome.clockId,
      definition,
      startTimeMs: Math.max(priorEndMs, elapsedWallMs),
    });
    this.setState('waiting-stream');
  }
}
