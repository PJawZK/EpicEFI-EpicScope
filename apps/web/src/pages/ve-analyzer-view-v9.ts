import type { ObservabilityRecorder } from '../observability/recorder';
import type { TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext } from './logger-page';
import {
  createVeAnalyzerView as createVeAnalyzerViewV8,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v8';
import '../styles/ve-analyzer-control-placement.css';

export function createVeAnalyzerView(observability?: ObservabilityRecorder): VeAnalyzerViewController {
  const inner = createVeAnalyzerViewV8(observability);
  const root = inner.element;
  let cancelRegrab: (() => void) | undefined;

  // Table layout/header ownership lives entirely in v7. This layer is limited
  // to refreshing an already-active lambda-delay recommendation.
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

    cancelRegrab?.();
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
    cancelRegrab = () => { completed = true; observer.disconnect(); };
    observer.observe(delayResultTitle, { childList: true, subtree: true, characterData: true });
    observer.observe(useDelayButton, { attributes: true, attributeFilter: ['disabled'] });
    setTimeout(() => observer.disconnect(), 30000);
    queueMicrotask(finishIfReady);
  });

  return {
    element: root,
    setActive(active) { if (!active) cancelRegrab?.(); inner.setActive(active); },
    editDelayCells(positions, edit) { return inner.editDelayCells(positions, edit); },
    get sessionRevision() { return inner.sessionRevision; },
    getPrimaryAnalysis() { return inner.getPrimaryAnalysis(); },
    onPrimaryAnalysisChange(listener) { return inner.onPrimaryAnalysisChange(listener); },
    getReadiness() { return inner.getReadiness(); },
    onReadinessChange(listener) { return inner.onReadinessChange(listener); },
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
