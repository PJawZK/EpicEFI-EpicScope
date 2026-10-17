import type { LoggerAnalysisContext } from './logger-page';
import type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
import './ve-analyzer-v50-run-strip.css';

function isDelayRow(name: string): boolean {
  return /lambda\s*[- ]?delay/i.test(name);
}

/**
 * Presents the existing structured readiness owner using the frozen v50 status
 * vocabulary. No readiness state is duplicated: the chips are projections of
 * getReadiness(), and actions delegate to the existing production controls.
 */
export function installVeAnalyzerV50RunStrip(inner: VeAnalyzerViewController): VeAnalyzerViewController {
  const root = inner.element;
  const actionbar = root.querySelector<HTMLElement>('.ve-workbench-actionbar');
  if (!actionbar || root.querySelector('.ve-v50-run-chips')) return inner;

  const legacyStatus = actionbar.querySelector<HTMLElement>('.ve-run-status-inline');
  const legacyDelay = actionbar.querySelector<HTMLElement>('.ve-delay-workflow-state');
  legacyStatus?.classList.add('ve-v50-legacy-run-status');
  legacyDelay?.classList.add('ve-v50-legacy-run-status');

  const semanticGrab = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="grab-delay"]');
  const runButton = actionbar.querySelector<HTMLButtonElement>('.ve-workbench-run');

  const chips = document.createElement('div');
  chips.className = 've-v50-run-chips';

  const inputs = document.createElement('button');
  inputs.type = 'button';
  inputs.className = 've-v50-status-chip';
  inputs.addEventListener('click', () => {
    root.querySelector<HTMLButtonElement>('.ve-v50-advanced-button:not(.ve-v50-exclusions-button)')?.click();
  });

  const delay = document.createElement('button');
  delay.type = 'button';
  delay.className = 've-v50-status-chip';
  delay.addEventListener('click', () => {
    root.querySelector<HTMLElement>('.ve-v50-lambda-tool-trigger')?.click();
  });

  const grab = document.createElement('button');
  grab.type = 'button';
  grab.className = 've-v50-status-chip ve-v50-grab-delay';
  grab.textContent = 'Grab lambda delays from log';
  grab.addEventListener('click', () => semanticGrab?.click());

  chips.append(inputs, delay, grab);
  if (runButton) actionbar.insertBefore(chips, runButton);
  else actionbar.append(chips);

  let active = true;
  const sync = (): void => {
    if (!active) return;
    const state = inner.getReadiness();
    const requiredInputRows = state.rows.filter((row) => row.required && !isDelayRow(row.name));
    const inputsReady = requiredInputRows.length > 0 && requiredInputRows.every((row) => row.valid);

    inputs.textContent = inputsReady ? '✓ Inputs ready' : 'Inputs need attention';
    inputs.dataset.state = inputsReady ? 'good' : 'bad';
    inputs.title = inputsReady ? 'Required VE Analyzer inputs are resolved.' : 'Open Advanced inputs and readiness.';

    if (state.delayState === 'working') {
      delay.textContent = '✓ Lambda delay ready';
      delay.dataset.state = 'good';
      delay.title = 'A working lambda-delay table is active.';
    } else if (state.delayState === 'recommendation') {
      delay.textContent = 'Lambda delay recommendation ready';
      delay.dataset.state = 'warn';
      delay.title = 'Open Lambda Delay to review and activate the recommendation.';
    } else {
      delay.textContent = 'Lambda delay required';
      delay.dataset.state = 'bad';
      delay.title = 'Open Lambda Delay to discover or load a working table.';
    }

    grab.disabled = !semanticGrab || semanticGrab.disabled || state.pending;
  };

  inner.onReadinessChange(sync);
  queueMicrotask(sync);

  return {
    element: root,
    setActive(nextActive) {
      active = nextActive;
      inner.setActive(nextActive);
      if (nextActive) queueMicrotask(sync);
    },
    editDelayCells(positions, edit) {
      const changed = inner.editDelayCells(positions, edit);
      queueMicrotask(sync);
      return changed;
    },
    get sessionRevision() { return inner.sessionRevision; },
    getPrimaryAnalysis() { return inner.getPrimaryAnalysis(); },
    onPrimaryAnalysisChange(listener) { return inner.onPrimaryAnalysisChange(listener); },
    getReadiness() { return inner.getReadiness(); },
    onReadinessChange(listener) { return inner.onReadinessChange(listener); },
    setContext(context: LoggerAnalysisContext) {
      const changed = inner.setContext(context);
      if (active) queueMicrotask(sync);
      return changed;
    },
    setTuneModel(model, sourceName) {
      const changed = inner.setTuneModel(model, sourceName);
      if (active) queueMicrotask(sync);
      return changed;
    },
    refresh() {
      inner.refresh();
      if (active) queueMicrotask(sync);
    },
  };
}
