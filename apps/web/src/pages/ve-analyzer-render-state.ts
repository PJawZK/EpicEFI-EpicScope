import type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
import type { VeResultView } from './ve-analyzer-result-view';

export interface VeCanonicalRenderText {
  readonly currentText: string;
  readonly proposalText?: string;
}

function numericText(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed);
}

/**
 * Captures the authoritative text emitted by the base VE renderer before any
 * result-view overlay rewrites it. This is deliberately presentation-only:
 * analysis lifecycle calls are never intercepted here.
 */
export function parseVeCanonicalRenderText(text: string): VeCanonicalRenderText | undefined {
  const parts = text.split('→').map((part) => part.trim());
  if (!numericText(parts[0])) return undefined;
  if (parts[1] && numericText(parts[1])) return { currentText: parts[0]!, proposalText: parts[1] };
  return { currentText: parts[0]! };
}

function selectedResultView(root: HTMLElement): VeResultView {
  const value = root.querySelector<HTMLSelectElement>('select[aria-label="VE Analyzer result view"]')?.value;
  switch (value) {
    case 'change':
    case 'change-percent':
    case 'mixture-error':
    case 'samples':
    case 'weight':
    case 'confidence':
    case 'spread':
    case 'delay':
      return value;
    default:
      return 'proposal';
  }
}

/**
 * Keeps v7 as the sole result-view renderer while protecting it from consuming
 * its own previous output. The authoritative base renderer replaces the table;
 * this layer snapshots that fresh output once, restores it before a user view
 * switch, then only repairs exact source precision/fallback text afterward.
 *
 * No setContext/setTuneModel/refresh interception and no analysis recomputation.
 */
export function installVeAnalyzerRenderState(inner: VeAnalyzerViewController): VeAnalyzerViewController {
  const root = inner.element;
  const veHost = root.querySelector<HTMLElement>('[data-ve-analyzer="ve-table-view"]');
  const resultSelect = root.querySelector<HTMLSelectElement>('select[aria-label="VE Analyzer result view"]');
  const canonical = new WeakMap<HTMLTableCellElement, VeCanonicalRenderText>();

  const cells = (): HTMLTableCellElement[] =>
    veHost ? [...veHost.querySelectorAll<HTMLTableCellElement>('.ve-workbench-table tbody td')] : [];

  const captureFreshTable = (): void => {
    for (const cell of cells()) {
      const main = cell.querySelector<HTMLElement>(':scope > span');
      if (!main) continue;
      const parsed = parseVeCanonicalRenderText(main.textContent ?? '');
      if (parsed) canonical.set(cell, parsed);
    }
  };

  const restoreCanonicalInput = (): void => {
    for (const cell of cells()) {
      const state = canonical.get(cell);
      const main = cell.querySelector<HTMLElement>(':scope > span');
      if (!state || !main) continue;
      main.textContent = state.proposalText
        ? `${state.currentText} → ${state.proposalText}`
        : state.currentText;
    }
  };

  const repairPresentation = (): void => {
    const view = selectedResultView(root);
    for (const cell of cells()) {
      const state = canonical.get(cell);
      const main = cell.querySelector<HTMLElement>(':scope > span');
      if (!state || !main) continue;

      if (view === 'proposal') {
        const text = state.proposalText ?? state.currentText;
        main.textContent = text;
        cell.dataset.veResultValue = text;
        delete cell.dataset.veResultFallback;
        cell.classList.remove('ve-result-missing');
        continue;
      }

      if (cell.classList.contains('ve-result-missing') || main.textContent?.trim() === '—') {
        main.textContent = state.currentText;
        cell.dataset.veResultValue = state.currentText;
        cell.dataset.veResultFallback = 'base-ve';
        cell.classList.remove('ve-result-missing');
      }
    }
  };

  const scheduleRepair = (): void => queueMicrotask(repairPresentation);

  // The base table already exists during construction. Capture it before queued
  // v7 result-view work gets a chance to rewrite its contents.
  captureFreshTable();
  scheduleRepair();

  if (veHost) {
    new MutationObserver(() => {
      captureFreshTable();
      scheduleRepair();
    }).observe(veHost, { childList: true });
  }

  if (resultSelect) {
    // Restore authoritative source text before v7's normal bubbling change
    // handler parses the cells, then repair exact precision/fallback afterward.
    resultSelect.addEventListener('change', restoreCanonicalInput, { capture: true });
    resultSelect.addEventListener('change', scheduleRepair);
  }

  return inner;
}
