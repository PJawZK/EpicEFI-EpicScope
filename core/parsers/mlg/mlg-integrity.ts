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

  const crcDisplacement = BLOCK_HEADER_LENGTH + recordLength;
  let annotated: ParserDiagnostic[] | undefined;
  for (let diagnosticIndex = 0; diagnosticIndex < diagnostics.length; diagnosticIndex += 1) {
    const diagnostic = diagnostics[diagnosticIndex]!;
    if (
      diagnostic.offset === undefined
      || !Number.isFinite(diagnostic.offset)
      || (diagnostic.code !== 'mlg-crc-retry-recovered' && diagnostic.code !== 'mlg-crc-mismatch')
    ) continue;

    // Scanner offsets are in source order. Search the existing index rather
    // than allocating an entry for every record after worker validation.
    let low = 0;
    let high = recordIndex.offsets.length;
    while (low < high) {
      const middle = low + Math.floor((high - low) / 2);
      if (recordIndex.offsets[middle]! + crcDisplacement < diagnostic.offset) low = middle + 1;
      else high = middle;
    }
    const offset = recordIndex.offsets[low];
    if (offset === undefined || offset + crcDisplacement !== diagnostic.offset) continue;
    const timeMs = recordIndex.timeMs[low];
    if (timeMs === undefined || !Number.isFinite(timeMs)) continue;

    annotated ??= diagnostics.slice();
    if (diagnostic.code === 'mlg-crc-retry-recovered') {
      annotated[diagnosticIndex] = {
        ...diagnostic,
        timeMs,
        sourceIntegrity: {
          kind: 'recovered-retry' as const,
          breaksContinuity: false,
        },
      };
      continue;
    }

    annotated[diagnosticIndex] = {
      ...diagnostic,
      timeMs,
      sourceIntegrity: {
        kind: 'corrupt-record' as const,
        breaksContinuity: true,
      },
    };
  }
  return annotated ?? diagnostics;
}
