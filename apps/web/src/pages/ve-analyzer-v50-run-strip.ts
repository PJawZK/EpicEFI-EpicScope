import type { MsqSaveState } from '../msq-save-contract';
import { focusVeReadinessTarget } from './ve-analyzer-readiness';
import type { LoggerAnalysisContext } from './logger-page';
import type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
import type { VeDelayDiscoveryStatus } from './ve-analyzer-view-v2';
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


  // The analysis owner publishes structured, read-only completion rows. Do not
  // derive proposal semantics by parsing visible table cells or summary DOM.
  const dialog = document.createElement('section');
  dialog.className = 've-v50-completion-dialog';
  dialog.hidden = true;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'VE Analysis Complete');
  const dialogHeading = document.createElement('strong');
  dialogHeading.textContent = 'VE Analysis Complete';
  const closeIcon = document.createElement('button');
  closeIcon.type = 'button';
  closeIcon.className = 've-v50-completion-x';
  closeIcon.textContent = '×';
  closeIcon.setAttribute('aria-label', 'Close analysis summary');
  const dialogHead = document.createElement('header');
  dialogHead.append(dialogHeading, closeIcon);
  const dialogRows = document.createElement('div');
  dialogRows.className = 've-v50-completion-rows';
  const closeAction = document.createElement('button');
  closeAction.type = 'button';
  closeAction.textContent = 'Close';
  const viewAction = document.createElement('button');
  viewAction.type = 'button';
  viewAction.textContent = 'View Proposal';
  viewAction.className = 've-v50-completion-view';
  const dialogFoot = document.createElement('footer');
  dialogFoot.append(closeAction, viewAction);
  dialog.append(dialogHead, dialogRows, dialogFoot);
  const summaryAction = document.createElement('button');
  summaryAction.type = 'button';
  summaryAction.className = 've-v50-status-chip ve-v50-summary-action';
  summaryAction.textContent = 'Summary';
  summaryAction.hidden = true;
  let completedRows: readonly [string, string][] | undefined;
  let summaryOpener: HTMLElement | undefined;
  const dismissSummary = (): void => {
    const hadFocus = dialog.contains(document.activeElement);
    dialog.hidden = true;
    const opener = summaryOpener;
    summaryOpener = undefined;
    if (!hadFocus || !active || disposed) return;
    const canFocus = (element: HTMLElement | null | undefined): element is HTMLElement => Boolean(element?.isConnected
      && element.getClientRects().length && !element.matches(':disabled'));
    if (canFocus(opener)) opener.focus();
    else if (canFocus(runButton)) runButton.focus();
  };
  const showSummary = (): void => {
    if (!completedRows || disposed || !active) return;
    if (dialog.hidden) summaryOpener = document.activeElement instanceof HTMLElement && root.contains(document.activeElement)
      ? document.activeElement : runButton ?? undefined;
    dialog.hidden = false;
    closeIcon.focus();
  };
  for (const button of [closeIcon, closeAction]) {
    button.addEventListener('click', dismissSummary, { signal: events.signal });
  }
  viewAction.addEventListener('click', () => {
    // v7 owns the active table tab. Selecting a result metric alone can leave
    // Target visible in single-table layout, even when proposal is already set.
    root.querySelector<HTMLButtonElement>('[data-table-tab="ve"]')?.click();
    const resultView = root.querySelector<HTMLSelectElement>('select[aria-label="VE Analyzer result view"]');
    if (resultView && resultView.value !== 'proposal') {
      resultView.value = 'proposal';
      resultView.dispatchEvent(new Event('change', { bubbles: true }));
    }
    dismissSummary();
  }, { signal: events.signal });
  summaryAction.addEventListener('click', showSummary, { signal: events.signal });
  root.addEventListener('ve-analysis-complete', (event) => {
    if (disposed) return;
    const rows = (event as CustomEvent<{ rows: readonly [string, string][] }>).detail.rows;
    completedRows = rows.map(([label, value]) => [label, value]);
    dialogRows.replaceChildren(...completedRows.map(([label, value]) => {
      const row = document.createElement('div');
      const key = document.createElement('span');
      key.textContent = label;
      const text = document.createElement('strong');
      text.textContent = value;
      row.append(key, text);
      return row;
    }));
    summaryAction.hidden = false;
    showSummary();
  }, { signal: events.signal });
  root.addEventListener('ve-analysis-stage-changed', (event) => {
    const state = (event as CustomEvent<{ state: string }>).detail.state;
    if (state === 'success') return;
    dismissSummary();
    if (state !== 'pending' && state !== 'idle') return;
    completedRows = undefined;
    summaryAction.hidden = true;
  }, { signal: events.signal });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismissSummary(); }
    if (event.key !== 'Tab') return;
    // The owner creates exactly these three focusable actions. Leave interior
    // traversal to the browser and wrap only at the two boundaries.
    if (event.shiftKey && document.activeElement === closeIcon) {
      event.preventDefault(); viewAction.focus();
    } else if (!event.shiftKey && document.activeElement === viewAction) {
      event.preventDefault(); closeIcon.focus();
    }
  }, { signal: events.signal });
  root.append(dialog);

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
  chips.append(inputs, delay, grab, use, summaryAction, info, blocker, fix);
  const save = document.createElement('button');
  save.type='button';save.className='ve-v50-save-proposal';save.textContent='Save MSQ';save.disabled=true;
  save.title='Load a writable MSQ and matching INI before saving.';save.setAttribute('aria-label','Save Working VE to loaded MSQ');
  const saveFeedback=document.createElement('div');saveFeedback.className='ve-v50-msq-feedback';saveFeedback.hidden=true;saveFeedback.setAttribute('role','status');saveFeedback.setAttribute('aria-live','polite');
  const saveText=document.createElement('span'),reload=document.createElement('button');reload.type='button';reload.textContent='Reload MSQ';reload.hidden=true;saveFeedback.append(saveText,reload);
  const enableAccess=document.createElement('button');enableAccess.type='button';enableAccess.dataset.msqEnableAccess='';enableAccess.textContent='Enable saving to this MSQ';enableAccess.hidden=true;saveFeedback.append(enableAccess);
  enableAccess.addEventListener('click',()=>root.dispatchEvent(new CustomEvent('ve-msq-enable-access-request',{bubbles:true})),{signal:events.signal});
  const confirmReload=document.createElement('dialog');confirmReload.className='ve-msq-reload-confirm';
  confirmReload.innerHTML='<p>Reload the changed MSQ? This replaces the loaded tune and discards the current VE working edits and analysis after the file is accepted.</p><button type="button" data-msq-keep>Keep working edits</button><button type="button" data-msq-reload>Reload and discard VE edits</button>';
  root.append(confirmReload);
  reload.addEventListener('click',()=>{if(!confirmReload.open)confirmReload.showModal();},{signal:events.signal});
  confirmReload.querySelector('[data-msq-keep]')!.addEventListener('click',()=>confirmReload.close(),{signal:events.signal});
  confirmReload.querySelector('[data-msq-reload]')!.addEventListener('click',()=>{confirmReload.close();root.dispatchEvent(new CustomEvent('ve-msq-reload-request',{bubbles:true}));},{signal:events.signal});
  save.addEventListener('pointerdown',event=>{if(!root.dispatchEvent(new CustomEvent('ve-msq-save-preflight',{cancelable:true})))event.preventDefault();},{signal:events.signal});
  save.addEventListener('click',()=>root.dispatchEvent(new CustomEvent('ve-msq-save-request',{bubbles:true,cancelable:true})),{signal:events.signal});
  let blockedSaveMessage: string | undefined;
  let saveState: MsqSaveState={available:false,busy:false,outcome:'idle',message:save.title,reload:false};
  const syncSave=():void=>{
    enableAccess.hidden=!saveState.enableAccess;enableAccess.disabled=saveState.busy||!!saveState.accessPending;
    save.disabled=!saveState.available||saveState.busy||inner.getReadiness().pending;
    save.textContent=saveState.busy?'Saving MSQ…':'Save MSQ';save.title=saveState.message;
    saveFeedback.hidden=saveState.outcome==='idle'&&!saveState.message;
    saveText.textContent=blockedSaveMessage??saveState.message;saveFeedback.hidden=!blockedSaveMessage&&saveFeedback.hidden;saveFeedback.dataset.state=blockedSaveMessage?'issue':saveState.outcome;reload.hidden=!saveState.reload;reload.disabled=saveState.busy;
  };
  root.addEventListener('ve-msq-save-state',event=>{saveState=(event as CustomEvent<MsqSaveState>).detail;blockedSaveMessage=undefined;syncSave();},{signal:events.signal});
  root.addEventListener('ve-msq-save-blocked',event=>{blockedSaveMessage=(event as CustomEvent<string>).detail;syncSave();},{signal:events.signal});
  if (runButton) {actionbar.insertBefore(chips,runButton);actionbar.insertBefore(save,runButton);}else actionbar.append(chips,save);
  actionbar.insertAdjacentElement('afterend',saveFeedback);

  let active = true;
  let discoveryPending = false;
  const delayFeedback = document.createElement('div');
  delayFeedback.className = 've-v50-delay-feedback'; delayFeedback.hidden = true;
  delayFeedback.setAttribute('role', 'status'); delayFeedback.setAttribute('aria-live', 'polite'); delayFeedback.setAttribute('aria-atomic', 'true');
  actionbar.insertAdjacentElement('afterend', delayFeedback);
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
    syncSave();
    const grabDisabled = !semanticGrab || semanticGrab.disabled || state.pending || discoveryPending;
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
  root.addEventListener('ve-delay-discovery-status', event => {
    if (!active || disposed) return;
    const status = (event as CustomEvent<VeDelayDiscoveryStatus>).detail;
    discoveryPending = status.state === 'pending';
    const label = discoveryPending ? 'Grabbing lambda delays…' : 'Grab lambda delays from log';
    if (grab.textContent !== label) grab.textContent = label;
    delayFeedback.hidden = status.state === 'idle';
    delayFeedback.dataset.state = status.state;
    if (delayFeedback.textContent !== status.message) delayFeedback.textContent = status.message;
    delayFeedback.title = status.message;
    scheduleSync();
  }, { signal: events.signal });
  scheduleSync();

  return {
    element: root,
    dispose() {
      if (disposed) return;
      disposed = true;
      events.abort();
      dialog.remove();
      delayFeedback.remove();saveFeedback.remove();confirmReload.close();confirmReload.remove();
      active = false; unsubscribeReadiness();
      inner.dispose();
    },
    setActive(nextActive) { if (disposed) return;
      active = nextActive;
      if (!nextActive) {
        dismissSummary(); confirmReload.close(); discoveryPending = false; delayFeedback.hidden = true;
        grab.textContent = 'Grab lambda delays from log';
      }
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
