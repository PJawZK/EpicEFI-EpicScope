import type { ObservabilityRecord } from '../record';
import type { BugReportRuntimeErrorEntry } from '../reports/runtime-report';
import type { ObservabilityRecorder } from '../recorder';

/** Existing error handlers publish to the stream; no second runtime-error store. */
export function recordRuntimeError(recorder: ObservabilityRecorder, entry: BugReportRuntimeErrorEntry, activeView?: string): void {
  const stack = entry.stack ?? '';
  recorder.record({ recordKind: 'event', subsystem: 'application', component: 'runtime',
    name: `runtime.${entry.kind}`, origin: 'async', severity: 'error', ...(activeView === undefined ? {} : { activeView }),
    metadata: {
      time: entry.time, kind: entry.kind, message: entry.message, source: entry.source ?? '',
      line: entry.line ?? 0, column: entry.column ?? 0,
      stack0: stack.slice(0, 256), stack1: stack.slice(256, 512), stack2: stack.slice(512, 768), stack3: stack.slice(768, 1024),
      messageTruncated: entry.message.length > 256, sourceTruncated: (entry.source?.length ?? 0) > 256, stackTruncated: stack.length > 1024,
    },
  });
}

export function runtimeErrorCount(recorder: ObservabilityRecorder): number {
  return Math.min(50, recorder.countNamed('runtime.error') + recorder.countNamed('runtime.unhandledrejection'));
}

/** Legacy report lens, projected only when requested. Original order/50-entry tail retained. */
export function runtimeErrorsForReport(recorder: ObservabilityRecorder, capturedRecords?: readonly ObservabilityRecord[]): readonly BugReportRuntimeErrorEntry[] {
  return (capturedRecords ?? recorder.snapshot()).filter(r => r.name === 'runtime.error' || r.name === 'runtime.unhandledrejection').slice(-50).map(record => {
    const m = record.metadata ?? {};
    const stack = [m.stack0, m.stack1, m.stack2, m.stack3].filter(x => typeof x === 'string').join('');
    return {
      time: typeof m.time === 'number' ? m.time : record.wallTime,
      kind: record.name === 'runtime.error' ? 'error' : 'unhandledrejection',
      message: `${m.message ?? 'Unknown runtime error'}${m.messageTruncated ? ' [truncated]' : ''}`,
      ...(m.source ? { source: `${m.source}${m.sourceTruncated ? ' [truncated]' : ''}` } : {}),
      ...(typeof m.line === 'number' && m.line ? { line: m.line } : {}),
      ...(typeof m.column === 'number' && m.column ? { column: m.column } : {}),
      ...(stack ? { stack: `${stack}${m.stackTruncated ? '\n[truncated]' : ''}` } : {}),
    };
  });
}

/** Never stringify an arbitrary rejection object or traverse a domain payload. */
export function runtimeRejectionEntry(reason: unknown, time = Date.now()): BugReportRuntimeErrorEntry {
  try {
    if (reason instanceof Error) return { time, kind: 'unhandledrejection', message: reason.message, ...(reason.stack ? { stack: reason.stack } : {}) };
    const message = reason === null || reason === undefined ? 'Unknown rejection'
      : typeof reason === 'object' || typeof reason === 'function' ? `Non-Error rejection (${typeof reason})` : String(reason);
    return { time, kind: 'unhandledrejection', message };
  } catch {
    return { time, kind: 'unhandledrejection', message: 'Rejection details unavailable' };
  }
}
