import type { LoggerAnalysisContext } from './logger-page';

function sameSavedRanges(
  left: LoggerAnalysisContext['savedRanges'],
  right: LoggerAnalysisContext['savedRanges'],
): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  return left.every((range, index) => {
    const other = right[index];
    return other !== undefined
      && range.label === other.label
      && range.startMs === other.startMs
      && range.endMs === other.endMs;
  });
}

/**
 * A Logger -> Analyzer return on the same source must not destroy an already
 * calculated VE session. Channel-array identity is the Logger's source-revision
 * anchor; A/B and saved-range equality keep scope changes invalidating normally.
 */
export function sameVeAnalysisContext(
  previous: LoggerAnalysisContext | undefined,
  next: LoggerAnalysisContext,
): boolean {
  return previous !== undefined
    && previous.channels === next.channels
    && previous.aTimeMs === next.aTimeMs
    && previous.bTimeMs === next.bTimeMs
    && sameSavedRanges(previous.savedRanges, next.savedRanges);
}
