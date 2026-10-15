import type { TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext } from './logger-page';
import {
  createVeAnalyzerView as createVeAnalyzerViewV9,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v9';

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

export function createVeAnalyzerView(): VeAnalyzerViewController {
  const inner = createVeAnalyzerViewV9();
  const root = inner.element;
  const veHost = root.querySelector<HTMLElement>('[data-ve-analyzer="ve-table-view"]');
  const resultView = root.querySelector<HTMLSelectElement>('[aria-label="VE Analyzer result view"]');

  let lastContext: LoggerAnalysisContext | undefined;
  let lastTuneModel: TuneModel | undefined;
  let lastTuneSourceName: string | undefined;

  // v7 changes the visible cell text for Result View. Preserve the freshly
  // rendered v2 value/title before any overlay is applied so later view changes
  // never parse a previous overlay as if it were authoritative VE-table data.
  const captureCanonicalCells = (): void => {
    if (!veHost) return;
    for (const cell of veHost.querySelectorAll<HTMLTableCellElement>('tbody td')) {
      const main = cell.querySelector<HTMLElement>(':scope > span');
      if (!main || cell.dataset.veCanonicalText !== undefined) continue;
      cell.dataset.veCanonicalText = main.textContent ?? '';
      cell.dataset.veCanonicalTitle = cell.title;
      cell.dataset.veCanonicalBaseLevel = cell.style.getPropertyValue('--ve-cell-level');
    }
  };

  const restoreCanonicalCells = (): void => {
    if (!veHost) return;
    for (const cell of veHost.querySelectorAll<HTMLTableCellElement>('tbody td')) {
      const main = cell.querySelector<HTMLElement>(':scope > span');
      if (!main || cell.dataset.veCanonicalText === undefined) continue;
      main.textContent = cell.dataset.veCanonicalText;
      cell.title = cell.dataset.veCanonicalTitle ?? '';
      const base = cell.dataset.veCanonicalBaseLevel;
      if (base) cell.style.setProperty('--ve-cell-level', base);
      else cell.style.removeProperty('--ve-cell-level');
    }
  };

  if (veHost) {
    new MutationObserver(captureCanonicalCells).observe(veHost, { childList: true });
    captureCanonicalCells();
  }
  resultView?.addEventListener('change', restoreCanonicalCells, { capture: true });

  return {
    element: root,
    setContext(context: LoggerAnalysisContext) {
      const sameAnalysisContext = sameVeAnalysisContext(lastContext, context);
      lastContext = context;
      if (!sameAnalysisContext) inner.setContext(context);
    },
    setTuneModel(model: TuneModel | undefined, sourceName?: string) {
      const sameTune = lastTuneModel === model && lastTuneSourceName === sourceName;
      lastTuneModel = model;
      lastTuneSourceName = sourceName;
      if (!sameTune) inner.setTuneModel(model, sourceName);
    },
    refresh() {
      inner.refresh();
    },
  };
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
