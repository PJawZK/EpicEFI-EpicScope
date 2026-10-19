import { focusVeReadinessTarget } from './ve-analyzer-readiness';
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
  let disposed = false;
  const events = new AbortController();
  const actionbar = root.querySelector<HTMLElement>('.ve-workbench-actionbar');
  if (!actionbar || root.querySelector('.ve-v50-run-chips')) return inner;

  const legacyStatus = actionbar.querySelector<HTMLElement>('.ve-run-status-inline');
  const legacyDelay = actionbar.querySelector<HTMLElement>('.ve-delay-workflow-state');
  legacyStatus?.classList.add('ve-v50-legacy-run-status');
  legacyDelay?.classList.add('ve-v50-legacy-run-status');

  const semanticGrab = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="grab-delay"]');
  const semanticUse = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="use-delay"]');
  const infoButton = actionbar.querySelector<HTMLButtonElement>('.ve-run-info-button');
  const runButton = actionbar.querySelector<HTMLButtonElement>('.ve-workbench-run');

  // Move the existing owner's output intact. Readiness describes prerequisites;
  // operation progress/failure must remain visible independently of those chips.
  const stage = root.querySelector<HTMLElement>('[data-ve-analyzer="stage"]');
  if (stage) {
    stage.classList.add('ve-v50-operation-status');
    stage.setAttribute('role', 'status');
    stage.setAttribute('aria-live', 'polite');
    stage.setAttribute('aria-atomic', 'true');
    actionbar.insertAdjacentElement('afterend', stage);
  }


  const chips = document.createElement('div');
  chips.className = 've-v50-run-chips';

  const inputs = document.createElement('button');
  inputs.type = 'button';
  inputs.className = 've-v50-status-chip';
  inputs.addEventListener('click', () => {
    root.querySelector<HTMLButtonElement>('.ve-v50-advanced-button:not(.ve-v50-exclusions-button)')?.click();
  }, { signal: events.signal });

  const delay = document.createElement('button');
  delay.type = 'button';
  delay.className = 've-v50-status-chip';
  delay.addEventListener('click', () => {
    root.querySelector<HTMLElement>('.ve-v50-lambda-tool-trigger')?.click();
  }, { signal: events.signal });

  const grab = document.createElement('button');
  grab.type = 'button';
  grab.className = 've-v50-status-chip ve-v50-grab-delay';
  grab.textContent = 'Grab lambda delays from log';
  grab.addEventListener('click', () => {
    if (!semanticGrab || semanticGrab.disabled) return;
    // Discovery results live in the Lambda Delay owner. Reveal that surface
    // before invoking discovery so progress/errors are visible to the user.
    const trigger = root.querySelector<HTMLElement>('.ve-v50-lambda-tool-trigger');
    const surface = root.querySelector<HTMLElement>('.ve-v50-tool-surface:has(.ve-v50-tool-lambda)');
    if (surface?.hidden) trigger?.click();
    semanticGrab.click();
  }, { signal: events.signal });

  const use = document.createElement('button');
  use.type = 'button';
  use.className = 've-v50-status-chip ve-v50-use-delay';
  use.textContent = 'Use recommendation';
  use.addEventListener('click', () => semanticUse?.click(), { signal: events.signal });

  const blocker = document.createElement('span');
  blocker.className = 've-v50-run-blocker';
  blocker.setAttribute('role', 'status');
  const info = document.createElement('button');
  info.type = 'button';
  info.className = 've-v50-run-info';
  info.title = 'Explain analysis readiness';
  info.setAttribute('aria-label', 'Analysis readiness information');
  info.textContent = 'ⓘ';
  info.addEventListener('click', () => {
    if (infoButton) infoButton.click();
    else inputs.click();
  }, { signal: events.signal });
  const fix = document.createElement('button');
  fix.type = 'button';
  fix.className = 've-v50-run-fix';
  fix.textContent = 'Fix';
  fix.addEventListener('click', () => {
    if (inner.getReadiness().delayState === 'recommendation' && !use.disabled) use.click();
    else {
      const target = inner.getReadiness().blockers.find(entry => entry.targetSelector)?.targetSelector;
      if (target) focusVeReadinessTarget(root, target);
      else inputs.click();
    }
  }, { signal: events.signal });
  chips.append(inputs, delay, grab, use, info, blocker, fix);
  if (runButton) {
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 've-v50-save-proposal';
    save.textContent = 'Save to MSQ / Shim';
    save.disabled = true;
    save.title = 'Unavailable: reviewed proposal export and safe ECU/shim write reconciliation are not implemented.';
    save.setAttribute('aria-label', 'Save proposal to MSQ or shim (not yet available)');
    actionbar.insertBefore(chips, runButton);
    actionbar.insertBefore(save, runButton);
  } else actionbar.append(chips);

  let active = true;
  let syncQueued = false;
  const scheduleSync = (): void => {
    if (!active || disposed || syncQueued) return;
    syncQueued = true;
    queueMicrotask(() => {
      syncQueued = false;
      if (active && !disposed) sync();
    });
  };
  let renderedState: ReturnType<VeAnalyzerViewController['getReadiness']> | undefined;
  let renderedGrabDisabled: boolean | undefined;
  let renderedUseDisabled: boolean | undefined;
  const sync = (): void => {
    if (!active || disposed) return;
    const state = inner.getReadiness();
    const grabDisabled = !semanticGrab || semanticGrab.disabled || state.pending;
    const useDisabled = !semanticUse || semanticUse.disabled || state.pending;
    if (renderedState === state && renderedGrabDisabled === grabDisabled && renderedUseDisabled === useDisabled) return;
    renderedState = state; renderedGrabDisabled = grabDisabled; renderedUseDisabled = useDisabled;
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

    grab.disabled = grabDisabled;
    use.hidden = state.delayState !== 'recommendation';
    use.disabled = useDisabled;
    const firstBlocker = state.blockers[0];
    blocker.textContent = state.active && firstBlocker ? firstBlocker.message : '';
    blocker.hidden = !blocker.textContent;
    info.hidden = !blocker.textContent;
    fix.hidden = !blocker.textContent;
    fix.disabled = state.pending;
    fix.title = state.delayState === 'recommendation'
      ? 'Activate the recommended Lambda Delay table'
      : 'Go to the first unresolved input';
  };

  const unsubscribeReadiness = inner.onReadinessChange(scheduleSync);
  scheduleSync();

  return {
    element: root,
    dispose() {
      if (disposed) return;
      disposed = true;
      events.abort();
      active = false; unsubscribeReadiness();
      inner.dispose();
    },
    setActive(nextActive) { if (disposed) return;
      active = nextActive;
      inner.setActive(nextActive);
      if (nextActive) scheduleSync();
    },
    editDelayCells(positions, edit) {
      const changed = inner.editDelayCells(positions, edit);
      scheduleSync();
      return changed;
    },
    get sessionRevision() { return inner.sessionRevision; },
    getPrimaryAnalysis() { return inner.getPrimaryAnalysis(); },
    onPrimaryAnalysisChange(listener) { return inner.onPrimaryAnalysisChange(listener); },
    getReadiness() { return inner.getReadiness(); },
    onReadinessChange(listener) { return inner.onReadinessChange(listener); },
    setContext(context: LoggerAnalysisContext) {
      if (disposed) return false;
      const changed = inner.setContext(context);
      if (active) scheduleSync();
      return changed;
    },
    setTuneModel(model, sourceName) {
      if (disposed) return false;
      const changed = inner.setTuneModel(model, sourceName);
      if (active) scheduleSync();
      return changed;
    },
    refresh() {
      if (disposed) return;
      inner.refresh();
      if (active) scheduleSync();
    },
  };
}
