import type { LoggerAnalysisContext } from './logger-page';

export function sameAnalyzerChannelCatalog(
  left: LoggerAnalysisContext['channels'],
  right: LoggerAnalysisContext['channels'],
): boolean {
  return left.length === right.length && left.every((channel, index) => channel === right[index]);
}

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

export function sameVeAnalysisContext(
  left: LoggerAnalysisContext | undefined,
  right: LoggerAnalysisContext,
): boolean {
  return left !== undefined
    && sameAnalyzerChannelCatalog(left.channels, right.channels)
    && left.aTimeMs === right.aTimeMs
    && left.bTimeMs === right.bTimeMs
    && left.sourceSampleCount === right.sourceSampleCount
    && sameSavedRanges(left.savedRanges, right.savedRanges);
}
