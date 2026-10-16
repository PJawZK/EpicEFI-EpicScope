import type { ParserDiagnostic } from '../../log-model/log-types';
import type { MlgRecordIndex } from './mlg-records';

const BLOCK_HEADER_LENGTH = 4;

/**
 * Adds structured source-integrity semantics to already-classified MLG CRC diagnostics.
 *
 * Retry classification remains owned by mlg-records. This adapter only maps the
 * classified byte offset back to its source record/time so presentation never has
 * to parse human-readable diagnostic text.
 */
export function annotateMlgSourceIntegrityDiagnostics(
  recordIndex: MlgRecordIndex,
  diagnostics: readonly ParserDiagnostic[],
  recordLength: number,
): readonly ParserDiagnostic[] {
  if (diagnostics.length === 0 || recordIndex.offsets.length === 0) return diagnostics;

  const blockLength = BLOCK_HEADER_LENGTH + recordLength + 1;
  const recordIndexByCrcOffset = new Map<number, number>();
  for (let index = 0; index < recordIndex.offsets.length; index += 1) {
    const offset = recordIndex.offsets[index];
    if (offset === undefined) continue;
    recordIndexByCrcOffset.set(offset + blockLength - 1, index);
  }

  return diagnostics.map((diagnostic) => {
    if (
      diagnostic.offset === undefined
      || (diagnostic.code !== 'mlg-crc-retry-recovered' && diagnostic.code !== 'mlg-crc-mismatch')
    ) {
      return diagnostic;
    }

    const sampleIndex = recordIndexByCrcOffset.get(diagnostic.offset);
    if (sampleIndex === undefined) return diagnostic;
    const timeMs = recordIndex.timeMs[sampleIndex];
    if (timeMs === undefined || !Number.isFinite(timeMs)) return diagnostic;

    if (diagnostic.code === 'mlg-crc-retry-recovered') {
      return {
        ...diagnostic,
        timeMs,
        sourceIntegrity: {
          kind: 'recovered-retry' as const,
          breaksContinuity: false,
        },
      };
    }

    return {
      ...diagnostic,
      timeMs,
      sourceIntegrity: {
        kind: 'corrupt-record' as const,
        breaksContinuity: true,
      },
    };
  });
}
