import type { VeReadinessPresentation } from './ve-analyzer-readiness';
import type { ObservabilityRecorder } from '../observability/recorder';
import type { TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext } from './logger-page';
import {
  createVeAnalyzerView as createVeAnalyzerViewV3,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v3';

export function createVeAnalyzerView(observability?: ObservabilityRecorder, presentation: VeReadinessPresentation = {}): VeAnalyzerViewController {
  const inner = createVeAnalyzerViewV3(observability);
  const root = inner.element;
  let disposed = false;
  const events = new AbortController();
  const actionbar = root.querySelector<HTMLElement>('.ve-workbench-actionbar')!;
  const quick = root.querySelector<HTMLElement>('.ve-workbench-quick-controls')!;
  const readiness = root.querySelector<HTMLElement>('[data-ve-analyzer="readiness"]')!;
  const delayHost = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-table"]')!;
  const delayEditor = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-editor"]')!;

  const delayDetails = [...root.querySelectorAll<HTMLDetailsElement>('details.specialized-analyzer-options')]
    .find((details) => details.querySelector('summary')?.textContent?.trim() === 'Lambda Delay Table');

  if (delayDetails) {
    delayDetails.classList.add('ve-delay-primary-workflow');
    delayDetails.open = true;
    quick.insertAdjacentElement('afterend', delayDetails);
  }

  const workflowState = document.createElement('div');
  workflowState.className = 've-delay-workflow-state';
  workflowState.innerHTML = `
    <strong data-ve-delay-flow="title">Lambda delay required</strong>
    <span data-ve-delay-flow="detail">Grab delays from this log or load a saved working table before Run Analysis.</span>`;
  actionbar.insertBefore(workflowState, readiness);
  const flowTitle = workflowState.querySelector<HTMLElement>('[data-ve-delay-flow="title"]')!;
  const flowDetail = workflowState.querySelector<HTMLElement>('[data-ve-delay-flow="detail"]')!;

  const updateWorkflowState = (): void => {
    const state = inner.getReadiness();
    const mode = state.delayState;
    const recommendationReady = mode === 'recommendation';
    if (mode === 'working') {
      workflowState.dataset.state = 'ready';
      flowTitle.textContent = 'Lambda delay ready';
      flowDetail.textContent = 'A working delay table is active. Run Analysis can proceed once the remaining required inputs are valid.';
    } else if (recommendationReady) {
      workflowState.dataset.state = 'action';
      flowTitle.textContent = 'Lambda delay recommendation ready';
      flowDetail.textContent = 'Press Use recommendation to make it the working delay table, or load a saved working table.';
    } else {
      workflowState.dataset.state = 'required';
      flowTitle.textContent = 'Lambda delay required';
      flowDetail.textContent = 'Grab delays from this log or load a saved working table before Run Analysis.';
    }

  };

  const unsubscribeReadiness = presentation.compactReadiness ? () => {} : inner.onReadinessChange(updateWorkflowState);

  delayHost.insertAdjacentElement('afterend', delayEditor);
  if (!presentation.compactReadiness) updateWorkflowState();

  return {
    element: root,
    dispose() {
      if (disposed) return;
      disposed = true;
      events.abort();
      unsubscribeReadiness();
      inner.dispose();
    },
    setActive(active) { if (disposed) return; inner.setActive(active); },
    editDelayCells(positions, edit) { return inner.editDelayCells(positions, edit); },
    get sessionRevision() { return inner.sessionRevision; },
    getPrimaryAnalysis() { return inner.getPrimaryAnalysis(); },
    onPrimaryAnalysisChange(listener) { return inner.onPrimaryAnalysisChange(listener); },
    getReadiness() { return inner.getReadiness(); },
    onReadinessChange(listener) { return inner.onReadinessChange(listener); },
    setContext(context: LoggerAnalysisContext) {
      if (disposed) return false;
      const changed = inner.setContext(context);
      if (!changed) return false;
      return true;
    },
    setTuneModel(model: TuneModel | undefined, sourceName?: string) {
      if (disposed) return false;
      const changed = inner.setTuneModel(model, sourceName);
      if (!changed) return false;
      return true;
    },
    refresh() {
      if (disposed) return;
      inner.refresh();
    },
  };
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v3';
