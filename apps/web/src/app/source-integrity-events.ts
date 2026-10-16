import type {
  ParserDiagnostic,
  SourceIntegrityKind,
} from '../../../../core/log-model/log-types';

export const SOURCE_INTEGRITY_DIAGNOSTICS_EVENT = 'epicscope:source-integrity-diagnostics';

export interface SourceIntegrityMarker {
  readonly timeMs: number;
  readonly kind: SourceIntegrityKind;
  readonly breaksContinuity: boolean;
  readonly count: number;
  readonly message: string;
}

export interface SourceIntegrityDiagnosticsEventDetail {
  readonly markers: readonly SourceIntegrityMarker[];
}

export function sourceIntegrityMarkersFromDiagnostics(
  diagnostics: readonly ParserDiagnostic[],
): readonly SourceIntegrityMarker[] {
  const grouped = new Map<string, SourceIntegrityMarker>();

  for (const diagnostic of diagnostics) {
    const metadata = diagnostic.sourceIntegrity;
    const timeMs = diagnostic.timeMs;
    if (!metadata || timeMs === undefined || !Number.isFinite(timeMs)) continue;

    const key = `${metadata.kind}:${timeMs}`;
    const existing = grouped.get(key);
    if (existing) {
      grouped.set(key, {
        ...existing,
        count: existing.count + 1,
      });
      continue;
    }

    grouped.set(key, {
      timeMs,
      kind: metadata.kind,
      breaksContinuity: metadata.breaksContinuity,
      count: 1,
      message: diagnostic.message,
    });
  }

  return [...grouped.values()].sort((left, right) => left.timeMs - right.timeMs);
}

export function publishSourceIntegrityDiagnostics(
  diagnostics: readonly ParserDiagnostic[],
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<SourceIntegrityDiagnosticsEventDetail>(
    SOURCE_INTEGRITY_DIAGNOSTICS_EVENT,
    {
      detail: {
        markers: sourceIntegrityMarkersFromDiagnostics(diagnostics),
      },
    },
  ));
}
