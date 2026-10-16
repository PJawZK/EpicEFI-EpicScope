import type {
  ParserDiagnostic,
  ParserDiagnosticSeverity,
} from '../../../../core/log-model/log-types';
import { publishSourceIntegrityDiagnostics } from '../app/source-integrity-events';

export interface ParserDiagnosticsIndicatorController {
  readonly element: HTMLElement;
  setDiagnostics(diagnostics: readonly ParserDiagnostic[]): void;
  clear(): void;
  reportText(): string;
  getDiagnostics(): readonly ParserDiagnostic[];
}

import { buildParserDiagnosticsReport, prepareParserDiagnostics, type ParserDiagnosticsModel } from '../observability/reports/parser-report';

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

export function createParserDiagnosticsIndicator(onDiagnostics?: (model: ParserDiagnosticsModel) => void): ParserDiagnosticsIndicatorController {
  let currentModel = prepareParserDiagnostics([]);
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
    publishSourceIntegrityDiagnostics(diagnostics);
    const model = prepareParserDiagnostics(diagnostics);
    currentModel = model;
    const { grouped, worst, unresolved, sourceIntegrity } = model;
    onDiagnostics?.(model);

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
      const report = buildParserDiagnosticsReport(diagnostics, model);
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
  return { element: root, setDiagnostics, clear, getDiagnostics: () => currentModel.diagnostics, reportText: () => buildParserDiagnosticsReport(currentModel.diagnostics, currentModel) };
}
