import type { TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext } from './logger-page';
import {
  createVeAnalyzerView as createVeAnalyzerViewV8,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v8';
import '../styles/ve-analyzer-control-placement.css';

interface DelayCellPosition {
  readonly row: string;
  readonly col: string;
}

export function createVeAnalyzerView(): VeAnalyzerViewController {
  const inner = createVeAnalyzerViewV8();
  const root = inner.element;

  // Table layout/header ownership lives entirely in v7. This layer is limited
  // to the lambda-delay interaction fixes introduced in the known-good baseline.
  const delayHost = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-table"]');
  const delayHint = root.querySelector<HTMLElement>('.ve-delay-inline-hint');
  const legacyWorking = root.querySelector<HTMLInputElement>('[data-ve-analyzer="delay-cell-working"]');
  const legacyRevert = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="delay-cell-revert"]');
  if (delayHint) {
    delayHint.textContent = 'Select a cell and type to replace its value. Drag to select a range. Delete reverts selected cells to the generated recommendation. Enter/F2 edits the current value · Esc cancels.';
  }

  const selectedDelayPositions = (): DelayCellPosition[] => {
    if (!delayHost) return [];
    return [...delayHost.querySelectorAll<HTMLTableCellElement>('td[data-delay-selected="true"][data-delay-row][data-delay-col]')]
      .map((cell) => ({ row: cell.dataset.delayRow!, col: cell.dataset.delayCol! }));
  };

  const revertSelectedDelayCells = (positions: readonly DelayCellPosition[]): void => {
    if (!delayHost || !legacyWorking || !legacyRevert) return;
    for (const position of positions) {
      const cell = delayHost.querySelector<HTMLTableCellElement>(`td[data-delay-row="${position.row}"][data-delay-col="${position.col}"]`);
      if (!cell) continue;
      cell.onclick?.call(cell, new PointerEvent('click'));
      legacyRevert.onclick?.call(legacyRevert, new PointerEvent('click'));
    }
  };

  const windowTarget = root.ownerDocument.defaultView;
  windowTarget?.addEventListener('keydown', (event) => {
    if (event.key !== 'Delete') return;
    const target = event.target;
    if (!(target instanceof Node) || !root.contains(target)) return;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
    const positions = selectedDelayPositions();
    if (positions.length === 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    revertSelectedDelayCells(positions);
  }, { capture: true });

  const grabDelayButton = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="grab-delay"]');
  const useDelayButton = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="use-delay"]');
  const saveDelayButton = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="save-delay"]');
  const delayResultTitle = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-result-title"]');

  grabDelayButton?.addEventListener('click', () => {
    // Initial discovery remains an explicit recommendation that still requires
    // Use recommendation. If a working table already exists, however, re-grab is
    // a deliberate refresh and should replace prior user edits with the newly
    // log-derived recommendation.
    const hadWorkingTable = saveDelayButton ? !saveDelayButton.disabled : false;
    if (!hadWorkingTable || !useDelayButton || !delayResultTitle) return;

    const revision = inner.sessionRevision;
    let completed = false;
    const finishIfReady = (): void => {
      if (completed) return;
      if (revision !== inner.sessionRevision) { completed = true; observer.disconnect(); return; }
      const analyzing = /^Analyzing current-log delay evidence/i.test(delayResultTitle.textContent?.trim() ?? '');
      if (analyzing || useDelayButton.disabled) return;
      completed = true;
      observer.disconnect();
      useDelayButton.click();
    };
    const observer = new MutationObserver(finishIfReady);
    observer.observe(delayResultTitle, { childList: true, subtree: true, characterData: true });
    observer.observe(useDelayButton, { attributes: true, attributeFilter: ['disabled'] });
    setTimeout(() => observer.disconnect(), 30000);
    queueMicrotask(finishIfReady);
  });

  return {
    element: root,
    get sessionRevision() { return inner.sessionRevision; },
    getPrimaryAnalysis() { return inner.getPrimaryAnalysis(); },
    onPrimaryAnalysisChange(listener) { return inner.onPrimaryAnalysisChange(listener); },
    setContext(context: LoggerAnalysisContext) {
      return inner.setContext(context);
    },
    setTuneModel(model: TuneModel | undefined, sourceName?: string) {
      return inner.setTuneModel(model, sourceName);
    },
    refresh() {
      inner.refresh();
    },
  };
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v8';
