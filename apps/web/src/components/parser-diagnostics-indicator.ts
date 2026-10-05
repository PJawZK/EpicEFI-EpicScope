import type {
  ParserDiagnostic,
  ParserDiagnosticSeverity,
} from '../../../../core/log-model/log-types';

export interface ParserDiagnosticsIndicatorController {
  readonly element: HTMLElement;
  setDiagnostics(diagnostics: readonly ParserDiagnostic[]): void;
  clear(): void;
}

export interface SourceIntegritySummary {
  readonly recoveredRetryArtifacts: number;
  readonly validRetryLikeRuns: number;
  readonly unrecoveredCrcRecords: number;
  readonly counterAnomalies: number;
  readonly groupedUnresolvedEvents: number;
}

interface DiagnosticGroup {
  count: number;
  severity: ParserDiagnosticSeverity;
  message: string;
}

function severityRank(severity: ParserDiagnosticSeverity): number {
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

function groupDiagnostics(
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
): string {
  const grouped = groupDiagnostics(diagnostics);
  const sourceIntegrity = summarizeSourceIntegrity(diagnostics);
  const unresolved = unresolvedParserDiagnostics(diagnostics);
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

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.append(textArea);
  textArea.focus();
  textArea.select();
  const copied = document.execCommand('copy');
  textArea.remove();
  if (!copied) throw new Error('Clipboard copy was not available.');
}

export function createParserDiagnosticsIndicator(): ParserDiagnosticsIndicatorController {
  const root = document.createElement('div');
  root.className = 'parser-indicator-wrap';
  root.innerHTML = `
    <button type="button" class="parser-indicator parser-indicator--good utility-action-button" aria-haspopup="dialog" aria-expanded="false" title="No parser diagnostics">
      <span class="parser-indicator-light" aria-hidden="true"></span>
      <span>Diag</span>
      <span class="parser-indicator-count" hidden></span>
      <span class="sr-only">Parser diagnostics</span>
    </button>
    <div class="parser-diagnostic-popover" role="dialog" aria-label="Parser diagnostics" hidden></div>
  `;

  const button = root.querySelector<HTMLButtonElement>('.parser-indicator');
  const count = root.querySelector<HTMLElement>('.parser-indicator-count');
  const popover = root.querySelector<HTMLElement>('.parser-diagnostic-popover');
  if (!button || !count || !popover) {
    throw new Error('Parser diagnostics indicator structure is incomplete.');
  }

  const close = (): void => {
    popover.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  };

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const nextOpen = popover.hidden;
    popover.hidden = !nextOpen;
    button.setAttribute('aria-expanded', String(nextOpen));
  });
  popover.addEventListener('click', (event) => event.stopPropagation());
  document.addEventListener('click', close);

  const setDiagnostics = (diagnostics: readonly ParserDiagnostic[]): void => {
    const grouped = groupDiagnostics(diagnostics);
    let worst: ParserDiagnosticSeverity | 'good' = 'good';

    for (const diagnostic of diagnostics) {
      if (worst === 'good' || severityRank(diagnostic.severity) > severityRank(worst)) {
        worst = diagnostic.severity;
      }
    }

    button.classList.remove(
      'parser-indicator--good',
      'parser-indicator--info',
      'parser-indicator--warning',
      'parser-indicator--error',
    );
    button.classList.add(`parser-indicator--${worst}`);

    if (diagnostics.length === 0) {
      count.hidden = true;
      count.textContent = '';
      button.title = 'No parser diagnostics';
      popover.innerHTML = '<div class="parser-popover-empty">No parser diagnostics.</div>';
      close();
      return;
    }

    const unresolved = unresolvedParserDiagnostics(diagnostics);
    const sourceIntegrity = summarizeSourceIntegrity(diagnostics);
    count.hidden = false;
    count.textContent = (unresolved.length > 0 ? unresolved.length : diagnostics.length).toLocaleString();
    button.title = `${unresolved.length.toLocaleString()} unresolved · ${diagnostics.length.toLocaleString()} total parser diagnostics`;

    const heading = document.createElement('div');
    heading.className = 'parser-popover-heading';

    const headingTitle = document.createElement('strong');
    headingTitle.textContent = 'Parser diagnostics';

    const headingActions = document.createElement('div');
    headingActions.className = 'parser-popover-heading-actions';

    const headingCount = document.createElement('span');
    headingCount.textContent = `${unresolved.length.toLocaleString()} unresolved · ${diagnostics.length.toLocaleString()} total`;

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'parser-copy-report';
    copyButton.textContent = 'Copy report';
    copyButton.title = 'Copy complete parser diagnostics report';

    headingActions.append(headingCount, copyButton);
    heading.append(headingTitle, headingActions);

    const sourceSummary = document.createElement('div');
    sourceSummary.className = 'parser-popover-groups';
    const sourceRows: readonly [string, number, ParserDiagnosticSeverity][] = [
      ['Recovered retry artifacts', sourceIntegrity.recoveredRetryArtifacts, 'info'],
      ['Valid retry-like runs', sourceIntegrity.validRetryLikeRuns, 'info'],
      ['Unrecovered CRC records', sourceIntegrity.unrecoveredCrcRecords, 'warning'],
      ['Counter anomalies', sourceIntegrity.counterAnomalies, 'warning'],
      ['Grouped unresolved MLG events', sourceIntegrity.groupedUnresolvedEvents, sourceIntegrity.groupedUnresolvedEvents > 0 ? 'warning' : 'info'],
    ];
    for (const [label, value, severity] of sourceRows) {
      const row = document.createElement('div');
      row.className = `parser-popover-group parser-popover-group--${severity}`;
      row.innerHTML = `
        <span class="parser-popover-severity" aria-hidden="true"></span>
        <strong>${label}</strong>
        <span>${value.toLocaleString()}</span>
      `;
      sourceSummary.append(row);
    }

    const groups = document.createElement('div');
    groups.className = 'parser-popover-groups';
    for (const [code, item] of grouped) {
      const row = document.createElement('div');
      row.className = `parser-popover-group parser-popover-group--${item.severity}`;
      row.innerHTML = `
        <span class="parser-popover-severity" aria-hidden="true"></span>
        <strong>${code}</strong>
        <span>${item.count.toLocaleString()}</span>
      `;
      row.title = item.message;
      groups.append(row);
    }

    const occurrences = document.createElement('div');
    occurrences.className = 'parser-popover-occurrences';
    const occurrenceHeading = document.createElement('strong');
    occurrenceHeading.textContent = 'Unresolved occurrences';
    occurrences.append(occurrenceHeading);

    const list = document.createElement('ol');
    for (const diagnostic of unresolved.slice(0, 40)) {
      const item = document.createElement('li');
      const offset = diagnostic.offset === undefined
        ? ''
        : ` · byte ${diagnostic.offset.toLocaleString()}`;
      item.textContent = `${diagnostic.code}${offset} — ${diagnostic.message}`;
      list.append(item);
    }
    if (unresolved.length === 0) {
      const clean = document.createElement('div');
      clean.className = 'parser-popover-empty';
      clean.textContent = 'No unresolved parser diagnostics.';
      occurrences.append(clean);
    } else {
      occurrences.append(list);
    }

    copyButton.addEventListener('click', () => {
      const report = buildParserDiagnosticsReport(diagnostics);
      const previousLabel = copyButton.textContent ?? 'Copy report';
      copyButton.disabled = true;
      void copyText(report)
        .then(() => {
          copyButton.textContent = 'Copied';
        })
        .catch(() => {
          copyButton.textContent = 'Copy failed';
        })
        .finally(() => {
          window.setTimeout(() => {
            copyButton.textContent = previousLabel;
            copyButton.disabled = false;
          }, 1200);
        });
    });

    popover.replaceChildren(heading, sourceSummary, groups, occurrences);
  };

  const clear = (): void => setDiagnostics([]);
  clear();
  return { element: root, setDiagnostics, clear };
}
