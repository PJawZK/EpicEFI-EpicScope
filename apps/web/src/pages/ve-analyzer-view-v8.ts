import type { ObservabilityRecorder } from '../observability/recorder';
import { focusVeReadinessTarget } from './ve-analyzer-readiness';
import type { TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext } from './logger-page';
import {
  createVeAnalyzerView as createVeAnalyzerViewV7,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v7';
import '../app/font-intensity-settings';
import '../styles/ve-analyzer-polish.css';

export function createVeAnalyzerView(observability?: ObservabilityRecorder): VeAnalyzerViewController {
  const inner = createVeAnalyzerViewV7(observability);
  const root = inner.element;
  const readiness = root.querySelector<HTMLElement>('[data-ve-analyzer="readiness"]')!;
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
    const state = inner.getReadiness();
    const firstFix = state.active && !state.pending ? state.blockers.find(blocker => blocker.targetSelector) : undefined;
    quickFix.hidden = !firstFix;
    quickFix.onclick = firstFix ? () => focusVeReadinessTarget(root, firstFix.targetSelector!) : null;
  };

  inner.onReadinessChange(syncQuickFix);
  queueMicrotask(syncQuickFix);

  return {
    element: root,
    setActive(active) { inner.setActive(active); },
    editDelayCells(positions, edit) { return inner.editDelayCells(positions, edit); },
    get sessionRevision() { return inner.sessionRevision; },
    getPrimaryAnalysis() { return inner.getPrimaryAnalysis(); },
    onPrimaryAnalysisChange(listener) { return inner.onPrimaryAnalysisChange(listener); },
    getReadiness() { return inner.getReadiness(); },
    onReadinessChange(listener) { return inner.onReadinessChange(listener); },
    setContext(context: LoggerAnalysisContext) {
      const changed = inner.setContext(context);
      if (!changed) return false;
      return true;
    },
    setTuneModel(model: TuneModel | undefined, sourceName?: string) {
      const changed = inner.setTuneModel(model, sourceName);
      if (!changed) return false;
      return true;
    },
    refresh() {
      inner.refresh();
    },
  };
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v7';
