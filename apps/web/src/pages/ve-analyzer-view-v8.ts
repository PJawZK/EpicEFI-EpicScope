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
  const tableLayoutSelect = root.querySelector<HTMLSelectElement>('select[aria-label="VE Analyzer table view"]');
  const tableLayoutLabel = tableLayoutSelect?.closest<HTMLLabelElement>('label');
  const tabs = root.querySelector<HTMLElement>('.ve-workbench-table-tabs');
  const veSelect = root.querySelector<HTMLSelectElement>('select[data-role="ve-table"]');
  const targetSelect = root.querySelector<HTMLSelectElement>('select[data-role="target-table"]');
  const vePanel = root.querySelector<HTMLElement>('[data-ve-analyzer="ve-table-view"]')?.closest<HTMLElement>('.ve-workbench-panel');
  const targetPanel = root.querySelector<HTMLElement>('[data-ve-analyzer="target-table-view"]')?.closest<HTMLElement>('.ve-workbench-panel');
  const veHeader = vePanel?.querySelector<HTMLElement>('header');
  const targetHeader = targetPanel?.querySelector<HTMLElement>('header');

  const ensureControls = (header: HTMLElement | null | undefined): HTMLElement | undefined => {
    if (!header) return undefined;
    let controls = header.querySelector<HTMLElement>('.ve-table-header-controls');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 've-table-header-controls';
      header.append(controls);
    }
    return controls;
  };

  const veControls = ensureControls(veHeader);
  const targetControls = ensureControls(targetHeader);

  const syncTableControls = (): void => {
    if (!tableLayoutSelect || !tableLayoutLabel || !tabs || !veSelect || !targetSelect || !veControls || !targetControls) return;
    const single = tableLayoutSelect.value === 'single';
    const activeVe = !vePanel?.hidden;
    veControls.replaceChildren();
    targetControls.replaceChildren();

    if (!single) {
      veControls.append(tableLayoutLabel, veSelect);
      targetControls.append(targetSelect);
      return;
    }

    const activeControls = activeVe ? veControls : targetControls;
    activeControls.append(tabs, tableLayoutLabel, activeVe ? veSelect : targetSelect);
    (activeVe ? targetControls : veControls).append(activeVe ? targetSelect : veSelect);
  };

  tableLayoutSelect?.addEventListener('change', () => queueMicrotask(syncTableControls));
  tabs?.addEventListener('click', () => queueMicrotask(syncTableControls));
  queueMicrotask(syncTableControls);

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
    setContext(context: LoggerAnalysisContext) {
      inner.setContext(context);
      queueMicrotask(() => { syncTableControls(); syncQuickFix(); });
    },
    setTuneModel(model: TuneModel | undefined, sourceName?: string) {
      inner.setTuneModel(model, sourceName);
      queueMicrotask(() => { syncTableControls(); syncQuickFix(); });
    },
    refresh() {
      inner.refresh();
      queueMicrotask(() => { syncTableControls(); syncQuickFix(); });
    },
  };
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v7';
