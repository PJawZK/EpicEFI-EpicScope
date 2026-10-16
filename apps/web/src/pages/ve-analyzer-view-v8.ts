import type { TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext } from './logger-page';
import {
  createVeAnalyzerView as createVeAnalyzerViewV7,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v7';
import '../app/font-intensity-settings';
import '../styles/ve-analyzer-polish.css';

export function createVeAnalyzerView(): VeAnalyzerViewController {
  const inner = createVeAnalyzerViewV7();
  const root = inner.element;
  const readiness = root.querySelector<HTMLElement>('[data-ve-analyzer="readiness"]')!;
  const blockerPanel = root.querySelector<HTMLElement>('.ve-run-blocker-panel')!;
  const infoButton = root.querySelector<HTMLButtonElement>('.ve-run-info-button')!;

  // Table layout/header ownership lives entirely in v7. This layer only adds
  // the compact Run Analysis blocker status and global font-intensity support.
  const quickFix = document.createElement('button');
  quickFix.type = 'button';
  quickFix.className = 've-run-quick-fix';
  quickFix.textContent = 'Fix';
  quickFix.hidden = true;

  const status = document.createElement('div');
  status.className = 've-run-status-inline';
  readiness.insertAdjacentElement('beforebegin', status);
  status.append(infoButton, readiness, quickFix);

  const syncQuickFix = (): void => {
    const firstFix = blockerPanel.querySelector<HTMLButtonElement>('.ve-run-blocker-item button');
    quickFix.hidden = !firstFix;
    quickFix.onclick = firstFix ? () => firstFix.click() : null;
  };

  const blockerObserver = new MutationObserver(syncQuickFix);
  blockerObserver.observe(blockerPanel, { childList: true, subtree: true, characterData: true });
  queueMicrotask(syncQuickFix);

  return {
    element: root,
    setActive(active) { inner.setActive(active); },
    editDelayCells(positions, edit) { return inner.editDelayCells(positions, edit); },
    get sessionRevision() { return inner.sessionRevision; },
    getPrimaryAnalysis() { return inner.getPrimaryAnalysis(); },
    onPrimaryAnalysisChange(listener) { return inner.onPrimaryAnalysisChange(listener); },
    setContext(context: LoggerAnalysisContext) {
      const changed = inner.setContext(context);
      if (!changed) return false;
      queueMicrotask(syncQuickFix);
      return true;
    },
    setTuneModel(model: TuneModel | undefined, sourceName?: string) {
      const changed = inner.setTuneModel(model, sourceName);
      if (!changed) return false;
      queueMicrotask(syncQuickFix);
      return true;
    },
    refresh() {
      inner.refresh();
      queueMicrotask(syncQuickFix);
    },
  };
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v7';
