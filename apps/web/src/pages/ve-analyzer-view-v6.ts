import type { ObservabilityRecorder } from '../observability/recorder';
import type { TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext } from './logger-page';
import { VE_CELL_CHANGE_PRIOR_WEIGHT, type VeCellChangeAuthority } from './ve-analyzer-qualification';
import { focusVeReadinessTarget } from './ve-analyzer-readiness';
import {
  createVeAnalyzerView as createVeAnalyzerViewV4,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v4';

const OPTIONAL_BOUND_ROLES = [
  'min-rpm',
  'max-rpm',
  'min-load',
  'max-load',
] as const;

export function createVeAnalyzerView(observability?: ObservabilityRecorder): VeAnalyzerViewController {
  // v5 was the transitional Lambda Delay gesture/editor owner. The shared
  // table-interaction adapter now has browser parity and is the sole production
  // input owner, so do not install the superseded v5 listeners/observer here.
  const inner = createVeAnalyzerViewV4(observability);
  const root = inner.element;
  const actionbar = root.querySelector<HTMLElement>('.ve-workbench-actionbar')!;

  const blockerPanel = document.createElement('div');
  blockerPanel.className = 've-run-blocker-panel';
  blockerPanel.hidden = true;
  actionbar.insertAdjacentElement('afterend', blockerPanel);

  const annotateOptionalBounds = (): void => {
    for (const role of OPTIONAL_BOUND_ROLES) {
      const field = root.querySelector<HTMLInputElement>(`input[data-role="${role}"]`);
      if (!field) continue;
      field.placeholder = 'Full range';
      field.title = 'Optional. Leave blank to use the full available range.';
      field.dataset.veOptionalBound = 'true';
    }
    for (const selector of ['min-clt', 'min-tps', 'max-tps'] as const) {
      const field = root.querySelector<HTMLInputElement>(`input[data-ve-quick="${selector}"]`);
      if (!field) continue;
      field.placeholder = 'Full range';
      field.title = 'Optional. Leave blank to disable this limit and use the full available range.';
      field.dataset.veOptionalBound = 'true';
    }
  };

  const syncPriorAuthority = (): void => {
    const authority = root.querySelector<HTMLSelectElement>('select[data-ve-quick="cell-change"]');
    const prior = root.querySelector<HTMLInputElement>('input[data-role="prior-weight"]');
    if (!authority || !prior) return;
    const mode = authority.value as VeCellChangeAuthority;
    if (mode === 'custom' || prior.value.trim() !== '') return;
    prior.value = String(VE_CELL_CHANGE_PRIOR_WEIGHT[mode]);
    prior.dispatchEvent(new Event('change', { bubbles: true }));
  };

  let renderQueued = false;
  const scheduleRenderBlockers = (): void => {
    if (renderQueued) return;
    renderQueued = true;
    queueMicrotask(() => {
      renderQueued = false;
      renderBlockers();
    });
  };

  const renderBlockers = (): void => {
    annotateOptionalBounds();
    const state = inner.getReadiness();
    const blockers = state.blockers;
    if (!state.active || state.pending || blockers.length === 0) {
      blockerPanel.hidden = true;
      if (blockerPanel.childNodes.length > 0) blockerPanel.replaceChildren();
      delete blockerPanel.dataset.renderKey;
      return;
    }
    const renderKey = JSON.stringify(blockers);
    blockerPanel.hidden = false;
    if (blockerPanel.dataset.renderKey !== renderKey) {
      blockerPanel.dataset.renderKey = renderKey;
      blockerPanel.replaceChildren();
      const heading = document.createElement('strong');
      heading.textContent = `Run Analysis needs ${blockers.length} ${blockers.length === 1 ? 'fix' : 'fixes'}`;
      blockerPanel.append(heading);
      for (const entry of blockers) {
        const item = document.createElement('div');
        item.className = 've-run-blocker-item';
        const text = document.createElement('span');
        text.textContent = entry.message;
        item.append(text);
        if (entry.targetSelector) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = 'Fix';
          button.onclick = () => focusVeReadinessTarget(root, entry.targetSelector!);
          item.append(button);
        }
        blockerPanel.append(item);
      }
    }
  };

  inner.onReadinessChange(scheduleRenderBlockers);
  root.addEventListener('change', syncPriorAuthority);
  root.addEventListener('input', event => {
    if (event.target instanceof Element && event.target.closest('.ve-delay-inline-input')) return;
    syncPriorAuthority();
  });

  scheduleRenderBlockers();

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
      scheduleRenderBlockers();
      return true;
    },
    setTuneModel(model: TuneModel | undefined, sourceName?: string) {
      const changed = inner.setTuneModel(model, sourceName);
      if (!changed) return false;
      scheduleRenderBlockers();
      return true;
    },
    refresh() {
      inner.refresh();
      scheduleRenderBlockers();
    },
  };
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v4';
