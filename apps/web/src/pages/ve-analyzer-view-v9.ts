import type { VeReadinessPresentation } from './ve-analyzer-readiness';
import type { ObservabilityRecorder } from '../observability/recorder';
import type { TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext } from './logger-page';
import {
  createVeAnalyzerView as createVeAnalyzerViewV8,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v8';
import '../styles/ve-analyzer-control-placement.css';

export function createVeAnalyzerView(observability?: ObservabilityRecorder, presentation: VeReadinessPresentation = {}): VeAnalyzerViewController {
  const inner = createVeAnalyzerViewV8(observability, presentation);
  const root = inner.element;
  let disposed = false;
  const events = new AbortController();
  // Discovery completion belongs to the analytical owner. Never infer success
  // from rendered status text or an enabled button: either can describe an old
  // recommendation after a failed or superseded request.
  const useDelayButton = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="use-delay"]');
  root.addEventListener('ve-delay-discovery-complete', (event) => {
    if ((event as CustomEvent<{ hadWorkingTable: boolean }>).detail.hadWorkingTable) useDelayButton?.click();
  }, { signal: events.signal });

  return {
    element: root,
    dispose() {
      if (disposed) return;
      disposed = true;
      events.abort();
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
      return inner.setContext(context);
    },
    setTuneModel(model: TuneModel | undefined, sourceName?: string) {
      if (disposed) return false;
      return inner.setTuneModel(model, sourceName);
    },
    refresh() {
      if (disposed) return;
      inner.refresh();
    },
  };
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v8';
