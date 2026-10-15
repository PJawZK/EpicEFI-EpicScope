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

function sameChannelCatalog(
  left: LoggerAnalysisContext['channels'],
  right: LoggerAnalysisContext['channels'],
): boolean {
  if (left === right) return true;
  if (left.length !== right.length || left.length === 0) return false;
  return left.every((channel, index) => channel === right[index]);
}

/**
 * A Logger -> Analyzer return on the same source must not destroy an already
 * calculated VE session. Logger can hand back a fresh array wrapper for the
 * same catalog, so source continuity follows the stable ChannelDefinition
 * objects instead of requiring array identity. A/B and saved-range equality
 * still invalidate the session when analysis scope actually changes.
 */
export function sameVeAnalysisContext(
  previous: LoggerAnalysisContext | undefined,
  next: LoggerAnalysisContext,
): boolean {
  return previous !== undefined
    && sameChannelCatalog(previous.channels, next.channels)
    && previous.aTimeMs === next.aTimeMs
    && previous.bTimeMs === next.bTimeMs
    && sameSavedRanges(previous.savedRanges, next.savedRanges);
}
