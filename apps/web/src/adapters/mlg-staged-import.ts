import { MlgNumericChannelDataSource } from '../../../../core/parsers/mlg/mlg-channel-data';
import type { NumericChannelDataSource } from '../../../../core/log-model/log-types';
import { BlobByteSource } from './blob-byte-source';
import { MlgColumnSidecarDataSource } from './mlg-column-sidecar';
import { createPersistentColumnCacheDataSource } from './persistent-channel-cache';
import type {
  MlgPriorityCaptureSelector,
  MlgWorkerIndexedPayload,
  MlgWorkerResponse,
  MlgWorkerValidatedPayload,
} from '../workers/mlg-worker-protocol';

export interface StagedIndexedMlgFile extends MlgWorkerIndexedPayload {
  readonly channelData: NumericChannelDataSource;
}

export interface StagedValidatedMlgFile extends MlgWorkerValidatedPayload {}

export interface StagedMlgImportHandle {
  readonly indexed: Promise<StagedIndexedMlgFile>;
  readonly validated: Promise<StagedValidatedMlgFile>;
  startValidation(prioritizedChannelIds?: readonly string[]): void;
  cancel(): void;
}

export function supportsStagedMlgWorker(): boolean {
  return typeof Worker !== 'undefined';
}

export function importMlgFileStaged(file: File, priorityCapture: readonly MlgPriorityCaptureSelector[] = []): StagedMlgImportHandle {
  const worker = new Worker(
    new URL('../workers/mlg-import.worker.ts', import.meta.url),
    { type: 'module' },
  );

  let indexedPayload: StagedIndexedMlgFile | undefined;
  let sidecarChannelData: MlgColumnSidecarDataSource | undefined;
  let indexedSettled = false;
  let validationSettled = false;
  let validationStarted = false;
  let resolveIndexed!: (value: StagedIndexedMlgFile) => void;
  let rejectIndexed!: (reason?: unknown) => void;
  let resolveValidated!: (value: StagedValidatedMlgFile) => void;
  let rejectValidated!: (reason?: unknown) => void;

  const indexed = new Promise<StagedIndexedMlgFile>((resolve, reject) => {
    resolveIndexed = resolve;
    rejectIndexed = reject;
  });
  const validated = new Promise<StagedValidatedMlgFile>((resolve, reject) => {
    resolveValidated = resolve;
    rejectValidated = reject;
  });
  // Indexed failures also reject validation; attach a handler immediately so
  // fallback-to-main-thread does not create an unhandled rejection.
  void validated.catch(() => undefined);

  const terminate = (): void => worker.terminate();

  worker.onmessage = (event: MessageEvent<MlgWorkerResponse>): void => {
    const message = event.data;

    if (message.type === 'indexed') {
      const source = new BlobByteSource(file, {
        cacheSeedPages: message.payload.sourceCacheSeed,
      });
      const baseChannelData = new MlgNumericChannelDataSource(
        source,
        message.payload.fields,
        message.payload.recordIndex,
      );
      sidecarChannelData = new MlgColumnSidecarDataSource(
        baseChannelData,
        message.payload.summary.source.id,
        message.payload.fields,
        message.payload.recordIndex,
      );
      if (message.payload.capturedPriorityColumns) sidecarChannelData.seedCapturedPriorityColumns(message.payload.capturedPriorityColumns);
      const channelData = createPersistentColumnCacheDataSource(
        sidecarChannelData,
        message.payload.summary.source.id,
        message.payload.recordIndex.timeMs,
        message.payload.recordIndex.crcValid,
      );
      indexedPayload = {
        ...message.payload,
        channelData,
      };
      indexedSettled = true;
      resolveIndexed(indexedPayload);

      // Warm only the bounded <=96 MiB contiguous cache. This never blocks
      // time-to-usable. Large logs rely on the post-ready column sidecar for
      // arbitrary first-use channel access once background validation finishes.
      void source.warmCache();
      return;
    }

    if (message.type === 'validated') {
      if (!indexedPayload) {
        const error = new Error('MLG worker returned CRC validation before indexing.');
        if (!indexedSettled) rejectIndexed(error);
        rejectValidated(error);
        terminate();
        return;
      }
      indexedPayload.recordIndex.crcValid.set(message.payload.crcValid);
      if (message.payload.sidecar) {
        sidecarChannelData?.activate(message.payload.sidecar.manifest);
      }
      sidecarChannelData?.releasePrioritizedChannels();
      validationSettled = true;
      resolveValidated(message.payload);
      terminate();
      return;
    }

    const suffix = message.code ? ` [${message.code}]` : '';
    const error = new Error(`${message.message}${suffix}`);
    if (!indexedSettled) {
      indexedSettled = true;
      rejectIndexed(error);
    }
    if (!validationSettled) {
      validationSettled = true;
      rejectValidated(error);
    }
    sidecarChannelData?.releasePrioritizedChannels();
    terminate();
  };

  worker.onerror = (event): void => {
    const error = new Error(event.message || 'MLG worker failed.');
    if (!indexedSettled) {
      indexedSettled = true;
      rejectIndexed(error);
    }
    if (!validationSettled) {
      validationSettled = true;
      rejectValidated(error);
    }
    sidecarChannelData?.releasePrioritizedChannels();
    terminate();
  };

  worker.postMessage({
    type: 'import',
    file,
    sourceIdentity: {
      id: `file:${file.name}:${file.size}:${file.lastModified}`,
      displayName: file.name,
      format: 'MLG',
      sizeBytes: file.size,
    },
    ...(priorityCapture.length > 0 ? { priorityCapture } : {}),
  });

  return {
    indexed,
    validated,
    startValidation: (prioritizedChannelIds = []) => {
      if (validationStarted || validationSettled) return;
      validationStarted = true;
      sidecarChannelData?.prioritizeChannelsUntilReady(prioritizedChannelIds);
      worker.postMessage({ type: 'start-validation' });
    },
    cancel: () => {
      const error = new Error('MLG import cancelled.');
      if (!indexedSettled) {
        indexedSettled = true;
        rejectIndexed(error);
      }
      if (!validationSettled) {
        validationSettled = true;
        rejectValidated(error);
      }
      sidecarChannelData?.releasePrioritizedChannels();
      terminate();
    },
  };
}
