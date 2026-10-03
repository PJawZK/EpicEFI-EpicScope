from pathlib import Path
import re

path = Path('core/parsers/mlg/mlg-records.ts')
text = path.read_text()

replacement = r'''export function classifyMlgRetryDiagnostics(
  recordIndex: MlgRecordIndex,
  crcValid: Uint8Array,
  diagnostics: readonly ParserDiagnostic[],
  recordLength: number,
): MlgDiagnosticClassification {
  const blockLength = BLOCK_HEADER_LENGTH + recordLength + 1;
  const recoveredInvalidIndices = new Set<number>();
  const retryCounterOffsets = new Set<number>();
  const recoveredCrcOffsets = new Set<number>();
  const counterPatternOffsets = new Set<number>();
  const counterPatternDiagnostics: ParserDiagnostic[] = [];
  let invalidCount = 0;

  for (let index = 0; index < crcValid.length; index += 1) {
    if (crcValid[index] === 0) invalidCount += 1;
  }

  // Retry behavior in real EpicEFI MLG logs is run-shaped: consecutive
  // attempts repeat both the block counter and the source timestamp. Treat
  // the complete run as one unit so bad -> bad -> valid retries are recovered
  // correctly and a merely repeated counter with advancing time is not hidden.
  let runStart = 0;
  while (runStart < recordIndex.counters.length) {
    const counter = recordIndex.counters[runStart];
    const timeMs = recordIndex.timeMs[runStart];
    if (counter === undefined || timeMs === undefined) {
      runStart += 1;
      continue;
    }

    let runEnd = runStart + 1;
    while (
      runEnd < recordIndex.counters.length
      && recordIndex.counters[runEnd] === counter
      && recordIndex.timeMs[runEnd] === timeMs
    ) {
      runEnd += 1;
    }

    const runLength = runEnd - runStart;
    if (runLength > 1) {
      const invalidIndices: number[] = [];
      let allValid = true;
      for (let index = runStart; index < runEnd; index += 1) {
        if (crcValid[index] !== 1) {
          allValid = false;
          invalidIndices.push(index);
        }
      }

      const finalValid = crcValid[runEnd - 1] === 1;
      if (invalidIndices.length > 0 && finalValid) {
        for (let index = runStart; index < runEnd; index += 1) {
          const offset = recordIndex.offsets[index];
          if (offset !== undefined) retryCounterOffsets.add(offset + 1);
        }
        for (const index of invalidIndices) {
          const offset = recordIndex.offsets[index];
          if (offset === undefined) continue;
          recoveredInvalidIndices.add(index);
          recoveredCrcOffsets.add(offset + blockLength - 1);
        }
      } else if (allValid && runStart > 0) {
        const previousCounter = recordIndex.counters[runStart - 1];
        const firstOffset = recordIndex.offsets[runStart];
        if (previousCounter !== undefined && firstOffset !== undefined) {
          const advance = (counter - previousCounter + COUNTER_MODULUS) % COUNTER_MODULUS;
          if (advance === runLength) {
            for (let index = runStart; index < runEnd; index += 1) {
              const offset = recordIndex.offsets[index];
              if (offset !== undefined) counterPatternOffsets.add(offset + 1);
            }
            counterPatternDiagnostics.push({
              code: 'mlg-counter-retry-pattern',
              severity: 'info',
              message: `MLG counter advanced from ${previousCounter} to ${counter}, followed by ${runLength} CRC-valid records with the same counter and timestamp. Classified as retry-like counter behavior; source records remain valid and unchanged.`,
              recoverable: true,
              offset: firstOffset + 1,
            });
          }
        }
      }
    }

    runStart = runEnd;
  }

  const classified: ParserDiagnostic[] = [];
  for (const diagnostic of diagnostics) {
    if (
      diagnostic.code === 'mlg-counter-discontinuity'
      && diagnostic.offset !== undefined
      && (
        retryCounterOffsets.has(diagnostic.offset)
        || counterPatternOffsets.has(diagnostic.offset)
      )
    ) {
      continue;
    }

    if (
      diagnostic.code === 'mlg-crc-mismatch'
      && diagnostic.offset !== undefined
      && recoveredCrcOffsets.has(diagnostic.offset)
    ) {
      classified.push({
        ...diagnostic,
        code: 'mlg-crc-retry-recovered',
        severity: 'info',
        message: `${diagnostic.message} A later valid record in the same counter/timestamp retry run recovers this attempt; the invalid attempt remains excluded from trusted data.`,
      });
      continue;
    }

    classified.push(diagnostic);
  }

  classified.push(...counterPatternDiagnostics);

  const recoveredRetryCount = recoveredInvalidIndices.size;
  const unrecoveredInvalidCount = Math.max(0, invalidCount - recoveredRetryCount);
  const counterRetryPatternCount = counterPatternDiagnostics.length;
  if (counterRetryPatternCount > 0) {
    classified.unshift({
      code: 'mlg-counter-pattern-summary',
      severity: 'info',
      message: `MLG counter classification: ${counterRetryPatternCount.toLocaleString()} CRC-valid same-counter/same-timestamp retry-like run${counterRetryPatternCount === 1 ? '' : 's'} classified. Source records remain valid and unchanged.`,
      recoverable: true,
    });
  }

  if (invalidCount > 0) {
    classified.unshift({
      code: 'mlg-retry-recovery-summary',
      severity: unrecoveredInvalidCount > 0 ? 'warning' : 'info',
      message: `MLG CRC classification: ${recoveredRetryCount.toLocaleString()} invalid record${recoveredRetryCount === 1 ? '' : 's'} recovered by a later valid record in the same counter/timestamp retry run; ${unrecoveredInvalidCount.toLocaleString()} invalid record${unrecoveredInvalidCount === 1 ? '' : 's'} not recovered in such a run. Invalid attempts remain retained as source evidence and excluded from trusted samples.`,
      recoverable: true,
    });
  }

  return {
    diagnostics: classified,
    recoveredRetryCount,
    unrecoveredInvalidCount,
    counterRetryPatternCount,
  };
}
'''

pattern = re.compile(
    r'export function classifyMlgRetryDiagnostics\([\s\S]*?\n}\n\nclass GrowingFloat64Buffer',
)
match = pattern.search(text)
if not match:
    raise SystemExit('classifier function anchor not found')

updated = text[:match.start()] + replacement + '\nclass GrowingFloat64Buffer' + text[match.end():]
path.write_text(updated)
print('patched', path)
