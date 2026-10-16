import type { ObservabilityRecord } from '../record';
import type { ParserDiagnostic, ParserDiagnosticSeverity } from '../../../../../core/log-model/log-types';

export interface SourceIntegritySummary {
  readonly recoveredRetryArtifacts: number;
  readonly validRetryLikeRuns: number;
  readonly unrecoveredCrcRecords: number;
  readonly counterAnomalies: number;
  readonly groupedUnresolvedEvents: number;
}

export interface DiagnosticGroup {
  count: number;
  severity: ParserDiagnosticSeverity;
  message: string;
}

export function severityRank(severity: ParserDiagnosticSeverity): number {
  if (severity === 'error') return 3;
  if (severity === 'warning') return 2;
  return 1;
}

export function unresolvedParserDiagnostics(
  diagnostics: readonly ParserDiagnostic[],
): ParserDiagnostic[] {
  return diagnostics.filter((diagnostic) =>
    (diagnostic.severity === 'warning' || diagnostic.severity === 'error')
    && diagnostic.code !== 'mlg-retry-recovery-summary'
    && diagnostic.code !== 'mlg-counter-pattern-summary'
  );
}

function integerGcd(left: number, right: number): number {
  let a = Math.abs(Math.trunc(left));
  let b = Math.abs(Math.trunc(right));
  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
}

function estimateMlgRecordStride(diagnostics: readonly ParserDiagnostic[]): number | undefined {
  const crcOffsets = diagnostics
    .filter((diagnostic) =>
      (diagnostic.code === 'mlg-crc-mismatch' || diagnostic.code === 'mlg-crc-retry-recovered')
      && diagnostic.offset !== undefined
    )
    .map((diagnostic) => diagnostic.offset!)
    .sort((left, right) => left - right);
  if (crcOffsets.length < 2) return undefined;

  let stride = 0;
  for (let index = 1; index < crcOffsets.length; index += 1) {
    const difference = crcOffsets[index]! - crcOffsets[index - 1]!;
    if (difference <= 0) continue;
    stride = stride === 0 ? difference : integerGcd(stride, difference);
    if (stride === 1) return undefined;
  }
  return stride >= 8 && stride <= 1_000_000 ? stride : undefined;
}

function groupedUnresolvedMlgEventCount(diagnostics: readonly ParserDiagnostic[]): number {
  const unresolved = diagnostics
    .filter((diagnostic) =>
      (diagnostic.code === 'mlg-crc-mismatch' || diagnostic.code === 'mlg-counter-discontinuity')
      && diagnostic.offset !== undefined
    )
    .sort((left, right) => left.offset! - right.offset!);
  if (unresolved.length === 0) return 0;

  const stride = estimateMlgRecordStride(diagnostics);
  if (!stride) return unresolved.length;
  const adjacency = stride + 8;
  let groups = 1;
  let previousOffset = unresolved[0]!.offset!;
  for (const diagnostic of unresolved.slice(1)) {
    const offset = diagnostic.offset!;
    if (offset - previousOffset > adjacency) groups += 1;
    previousOffset = offset;
  }
  return groups;
}

export function summarizeSourceIntegrity(
  diagnostics: readonly ParserDiagnostic[],
): SourceIntegritySummary {
  const count = (code: string): number => diagnostics.filter((item) => item.code === code).length;
  return {
    recoveredRetryArtifacts: count('mlg-crc-retry-recovered'),
    validRetryLikeRuns: count('mlg-counter-retry-pattern'),
    unrecoveredCrcRecords: count('mlg-crc-mismatch'),
    counterAnomalies: count('mlg-counter-discontinuity'),
    groupedUnresolvedEvents: groupedUnresolvedMlgEventCount(diagnostics),
  };
}

export function groupDiagnostics(
  diagnostics: readonly ParserDiagnostic[],
): Map<string, DiagnosticGroup> {
  const grouped = new Map<string, DiagnosticGroup>();
  for (const diagnostic of diagnostics) {
    const existing = grouped.get(diagnostic.code);
    if (existing) {
      existing.count += 1;
      if (severityRank(diagnostic.severity) > severityRank(existing.severity)) {
        existing.severity = diagnostic.severity;
      }
    } else {
      grouped.set(diagnostic.code, {
        count: 1,
        severity: diagnostic.severity,
        message: diagnostic.message,
      });
    }
  }
  return grouped;
}

export function buildParserDiagnosticsReport(
  diagnostics: readonly ParserDiagnostic[],
  prepared = prepareParserDiagnostics(diagnostics),
): string {
  const { grouped, sourceIntegrity, unresolved } = prepared;
  const lines = [
    'EpicScope parser diagnostics',
    '',
    `Total: ${diagnostics.length.toLocaleString()}`,
    `Unresolved: ${unresolved.length.toLocaleString()}`,
    '',
    '[Source integrity]',
    `Recovered retry artifacts: ${sourceIntegrity.recoveredRetryArtifacts.toLocaleString()}`,
    `Valid retry-like runs: ${sourceIntegrity.validRetryLikeRuns.toLocaleString()}`,
    `Unrecovered CRC records: ${sourceIntegrity.unrecoveredCrcRecords.toLocaleString()}`,
    `Counter anomalies: ${sourceIntegrity.counterAnomalies.toLocaleString()}`,
    `Grouped unresolved MLG events: ${sourceIntegrity.groupedUnresolvedEvents.toLocaleString()}`,
    '',
    '[Groups]',
  ];

  for (const [code, item] of grouped) {
    lines.push(
      `${item.severity.toUpperCase()} | ${code} | ${item.count.toLocaleString()}`,
    );
  }

  lines.push('', '[Unresolved diagnostics]');
  unresolved.forEach((diagnostic, index) => {
    const offset = diagnostic.offset === undefined
      ? 'byte —'
      : `byte ${diagnostic.offset.toLocaleString()}`;
    lines.push(
      `${index + 1}. ${diagnostic.severity.toUpperCase()} | ${diagnostic.code} | ${offset} | ${diagnostic.message}`,
    );
  });

  lines.push('', '[All diagnostics]');
  diagnostics.forEach((diagnostic, index) => {
    const offset = diagnostic.offset === undefined
      ? 'byte —'
      : `byte ${diagnostic.offset.toLocaleString()}`;
    lines.push(
      `${index + 1}. ${diagnostic.severity.toUpperCase()} | ${diagnostic.code} | ${offset} | ${diagnostic.message}`,
    );
  });

  return lines.join('\n');
}


/** One owner-prepared view model borrows canonical diagnostics without copying or truncation. */
export function prepareParserDiagnostics(diagnostics: readonly ParserDiagnostic[]) {
  const grouped = groupDiagnostics(diagnostics);
  const sourceIntegrity = summarizeSourceIntegrity(diagnostics);
  const unresolved = unresolvedParserDiagnostics(diagnostics);
  const counts = { info: 0, warning: 0, error: 0, recoverable: 0 };
  let worst: ParserDiagnosticSeverity | 'good' = 'good';
  for (const diagnostic of diagnostics) {
    counts[diagnostic.severity]++;
    if (diagnostic.recoverable) counts.recoverable++;
    if (worst === 'good' || severityRank(diagnostic.severity) > severityRank(worst)) worst = diagnostic.severity;
  }
  return { diagnostics, grouped, sourceIntegrity, unresolved, counts, worst };
}
export type ParserDiagnosticsModel = ReturnType<typeof prepareParserDiagnostics>;

/** Latest summary per load/source: repeated pending/validated snapshots are not summed. */
export function buildParserSessionEvidence(records: readonly ObservabilityRecord[]): string {
  const latest = new Map<string, ObservabilityRecord>();
  for (const record of records) if (record.name === 'parser.source-integrity.summary') {
    const key = record.operationId ?? record.sourceIdentity ?? 'unassigned';
    latest.delete(key); latest.set(key, record);
    if (latest.size > 20) latest.delete(latest.keys().next().value!);
  }
  if (!latest.size) return '';
  return ['[Parser/source integrity session]', 'Compact retained summaries; complete findings remain in the canonical current Parser report.',
    ...Array.from(latest.values()).slice(-20).map(r => `source=${r.sourceIdentity ?? 'unassigned'}; operation=${r.operationId ?? 'none'}; total=${r.metadata?.total}; unresolved=${r.metadata?.unresolved}; recovered=${r.metadata?.recoveredRetryArtifacts}; crc=${r.metadata?.unrecoveredCrcRecords}; counters=${r.metadata?.counterAnomalies}; grouped=${r.metadata?.groupedUnresolvedEvents}`),
  ].join('\n');
}
