import type { TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext } from './logger-page';
import type { VeAnalyzerViewController } from './ve-analyzer-view-v9';

function traceExtentSignature(context: LoggerAnalysisContext): string {
  return context.traces.map((trace) => {
    const times = trace.range.timeMs;
    const first = times.length > 0 ? times[0] : undefined;
    const last = times.length > 0 ? times[times.length - 1] : undefined;
    return [
      trace.channel.id,
      trace.range.startSampleIndex,
      trace.range.values.length,
      first ?? '',
      last ?? '',
      trace.complete ? 1 : 0,
    ].join(':');
  }).join('|');
}

function savedRangeSignature(context: LoggerAnalysisContext): string {
  return context.savedRanges.map((range) => JSON.stringify(range)).join('|');
}

/**
 * Same-source continuity is intentionally stricter than the old shape-based
 * comparison. Logger caches `analysisChannels()` until the source/catalog is
 * invalidated, so channel-array identity is the primary source revision key.
 * Trace extent additionally invalidates growing/live data while normal Logger
 * focus/viewport navigation remains continuity-safe.
 */
export function sameVeAnalyzerSession(
  previous: LoggerAnalysisContext | undefined,
  next: LoggerAnalysisContext,
): boolean {
  if (!previous || previous.channels !== next.channels) return false;
  if (previous.aTimeMs !== next.aTimeMs || previous.bTimeMs !== next.bTimeMs) return false;
  if (savedRangeSignature(previous) !== savedRangeSignature(next)) return false;
  return traceExtentSignature(previous) === traceExtentSignature(next);
}

/**
 * Prevents v2's destructive rebuild when Analyzer is merely re-entered from
 * Logger with the same source authority. Genuine source/scope changes still
 * flow through normally. Refresh is never suppressed and no DOM is touched.
 */
export function installVeAnalyzerSessionContinuity(inner: VeAnalyzerViewController): VeAnalyzerViewController {
  let previousContext: LoggerAnalysisContext | undefined;
  let previousTune: TuneModel | undefined;
  let previousTuneSourceName: string | undefined;

  return {
    element: inner.element,
    setContext(next) {
      const same = sameVeAnalyzerSession(previousContext, next);
      previousContext = next;
      if (!same) inner.setContext(next);
    },
    setTuneModel(model, sourceName) {
      const same = model === previousTune && sourceName === previousTuneSourceName;
      previousTune = model;
      previousTuneSourceName = sourceName;
      if (!same) inner.setTuneModel(model, sourceName);
    },
    refresh() {
      inner.refresh();
    },
  };
}
