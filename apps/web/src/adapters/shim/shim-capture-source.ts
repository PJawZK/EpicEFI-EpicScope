import type { ImportedLogSummary, ParserDiagnostic } from '../../../../../core/log-model/log-types';
import { shimSchemaChannelDefinitions } from './shim-schema-adapter';
import type { ShimCaptureSession } from './shim-capture-session';
import type { ShimLiveNumericChannelDataSource } from './shim-live-data-source';
import type { ShimSchema, ShimWelcomeMessage } from './shim-protocol';

export interface ShimCaptureSource {
  readonly summary: ImportedLogSummary;
  readonly recordCount: number;
  readonly channelData: ShimLiveNumericChannelDataSource;
}

export interface CreateShimCaptureSourceOptions {
  readonly captureId: string;
  readonly capture: ShimCaptureSession;
  readonly channelData: ShimLiveNumericChannelDataSource;
  readonly schema: ShimSchema;
  readonly welcome: ShimWelcomeMessage;
}

export function createShimCaptureSource(options: CreateShimCaptureSourceOptions): ShimCaptureSource {
  const { capture, channelData, schema, welcome } = options;
  const snapshot = capture.snapshot();
  const selected = new Set(snapshot.channelIds);
  const channels = shimSchemaChannelDefinitions(schema).filter((channel) => selected.has(channel.id));
  const endMs = capture.endTimeMs ?? 0;
  const diagnostics: ParserDiagnostic[] = [];

  if (snapshot.deliveryLossCount > 0) {
    diagnostics.push({
      code: 'SHIM_DELIVERY_LOSS',
      severity: 'warning',
      message: `${snapshot.deliveryLossCount.toLocaleString()} queued shim sample cop${snapshot.deliveryLossCount === 1 ? 'y was' : 'ies were'} reported lost during this capture.`,
      recoverable: true,
    });
  }

  const markers = snapshot.segments.slice(1).map((segment) => ({
    timeMs: segment.startTimeMs,
    label: `Shim reconnect · generation ${segment.generation}`,
  }));

  return {
    summary: {
      source: {
        id: options.captureId,
        displayName: `Shim capture · ${snapshot.sampleCount.toLocaleString()} samples`,
        format: 'TS-SHIM',
        sizeBytes: 0,
      },
      channels,
      diagnostics,
      markers,
      timeRange: {
        startMs: 0,
        endMs,
        durationMs: endMs,
      },
    },
    recordCount: snapshot.sampleCount,
    channelData,
  };
}
