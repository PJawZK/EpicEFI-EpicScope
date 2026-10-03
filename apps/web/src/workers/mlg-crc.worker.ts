import type { ParserDiagnostic } from '../../../../core/log-model/log-types';
import { calculateMlgRecordChecksum } from '../../../../core/parsers/mlg/mlg-records';

interface CrcChunkRequest {
  readonly type: 'checksum-chunk';
  readonly chunkId: number;
  readonly firstIndex: number;
  readonly firstOffset: number;
  readonly recordLength: number;
  readonly relativeOffsets: Float64Array;
  readonly buffer: ArrayBuffer;
}

interface CrcChunkResult {
  readonly type: 'chunk-result';
  readonly chunkId: number;
  readonly firstIndex: number;
  readonly crcValid: Uint8Array;
  readonly diagnostics: readonly ParserDiagnostic[];
  readonly checksumCpuMs: number;
  readonly diagnosticCpuMs: number;
  readonly checksumBytes: number;
}

interface CrcChunkError {
  readonly type: 'error';
  readonly chunkId: number;
  readonly message: string;
}

type CrcWorkerResponse = CrcChunkResult | CrcChunkError;

interface WorkerScope {
  onmessage: ((event: MessageEvent<CrcChunkRequest>) => void) | null;
  postMessage(message: CrcWorkerResponse, transfer?: Transferable[]): void;
}

const scope = globalThis as unknown as WorkerScope;
const now = (): number => globalThis.performance?.now() ?? Date.now();
const BLOCK_HEADER_LENGTH = 4;

scope.onmessage = (event): void => {
  const request = event.data;
  if (request.type !== 'checksum-chunk') return;

  try {
    const bytes = new Uint8Array(request.buffer);
    const blockLength = BLOCK_HEADER_LENGTH + request.recordLength + 1;
    const crcValid = new Uint8Array(request.relativeOffsets.length);
    const diagnostics: ParserDiagnostic[] = [];
    let checksumCpuMs = 0;
    let diagnosticCpuMs = 0;
    let checksumBytes = 0;

    for (let localIndex = 0; localIndex < request.relativeOffsets.length; localIndex += 1) {
      const relativeOffset = request.relativeOffsets[localIndex];
      if (relativeOffset === undefined) continue;
      const recordStart = relativeOffset + BLOCK_HEADER_LENGTH;
      checksumBytes += request.recordLength;

      const checksumStart = now();
      const expectedCrc = calculateMlgRecordChecksum(bytes, recordStart, request.recordLength);
      checksumCpuMs += now() - checksumStart;

      const actualCrc = bytes[relativeOffset + blockLength - 1] ?? 0;
      const valid = expectedCrc === actualCrc;
      crcValid[localIndex] = valid ? 1 : 0;

      if (!valid) {
        const diagnosticStart = now();
        const absoluteOffset = request.firstOffset + relativeOffset;
        const recordIndex = request.firstIndex + localIndex;
        const counter = bytes[relativeOffset + 1] ?? 0;
        const rawTimestamp = ((bytes[relativeOffset + 2] ?? 0) << 8)
          | (bytes[relativeOffset + 3] ?? 0);
        const blockHeaderSum = calculateMlgRecordChecksum(
          bytes,
          relativeOffset,
          BLOCK_HEADER_LENGTH,
        );
        const headerInclusiveCrc = (expectedCrc + blockHeaderSum) & 0xff;
        const checksumDelta = (actualCrc - expectedCrc + 256) & 0xff;
        diagnostics.push({
          code: 'mlg-crc-mismatch',
          severity: 'warning',
          message: `MLG record ${recordIndex.toLocaleString()} checksum expected ${expectedCrc}, found ${actualCrc}; delta ${checksumDelta}; counter ${counter}; timestamp ${rawTimestamp}; header-inclusive candidate ${headerInclusiveCrc}.`,
          recoverable: true,
          offset: absoluteOffset + blockLength - 1,
        });
        diagnosticCpuMs += now() - diagnosticStart;
      }
    }

    const response: CrcChunkResult = {
      type: 'chunk-result',
      chunkId: request.chunkId,
      firstIndex: request.firstIndex,
      crcValid,
      diagnostics,
      checksumCpuMs,
      diagnosticCpuMs,
      checksumBytes,
    };
    scope.postMessage(response, [crcValid.buffer]);
  } catch (error) {
    scope.postMessage({
      type: 'error',
      chunkId: request.chunkId,
      message: error instanceof Error ? error.message : 'Unknown CRC checksum worker error.',
    });
  }
};
