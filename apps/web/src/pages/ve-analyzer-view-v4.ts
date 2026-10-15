import type { TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext } from './logger-page';
import { veProposalSettingIssues } from './ve-analyzer-readiness';
import {
  createVeAnalyzerView as createVeAnalyzerViewV3,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v3';

type DelayCellKey = `${number}:${number}`;

function keyFor(row: number, col: number): DelayCellKey {
  return `${row}:${col}`;
}

function parseKey(key: DelayCellKey): { row: number; col: number } {
  const [row, col] = key.split(':').map(Number);
  return { row: row!, col: col! };
}

function inputValue(root: HTMLElement, role: string): string {
  return root.querySelector<HTMLInputElement>(`input[data-role="${role}"]`)?.value ?? '';
}

function proposalSettingBlockers(root: HTMLElement): string[] {
  return veProposalSettingIssues({
    priorWeight: inputValue(root, 'prior-weight'),
    minimumEvidenceWeight: inputValue(root, 'min-evidence-weight'),
    maximumAbsoluteChange: inputValue(root, 'max-absolute-change'),
    maximumPercentChange: inputValue(root, 'max-percent-change'),
  });
}

function requiredBlockers(root: HTMLElement): string[] {
  const body = root.querySelector<HTMLTableSectionElement>('[data-ve-analyzer="readiness-body"]');
  if (!body) return [];
  const blockers: string[] = [];
  for (const row of body.rows) {
    const cells = [...row.cells].map((cell) => cell.textContent?.trim() ?? '');
    const [name, , requirement, source, status] = cells;
    if (requirement !== 'Required') continue;
    const bad = !source || source === '—' || /missing|mismatch|unavailable|required source unavailable|enter non-negative|discover\/use recommendation|load a saved/i.test(status ?? '');
    if (!bad || !name) continue;
    if (name === 'Proposal settings') {
      const issues = proposalSettingBlockers(root);
      blockers.push(...(issues.length > 0 ? issues : ['Proposal settings contain an invalid value']));
    } else {
      blockers.push(name);
    }
  }
  return blockers;
}

export function createVeAnalyzerView(): VeAnalyzerViewController {
  const inner = createVeAnalyzerViewV3();
  const root = inner.element;
  const actionbar = root.querySelector<HTMLElement>('.ve-workbench-actionbar')!;
  const quick = root.querySelector<HTMLElement>('.ve-workbench-quick-controls')!;
  const runButton = root.querySelector<HTMLButtonElement>('.ve-workbench-run')!;
  const readiness = root.querySelector<HTMLElement>('[data-ve-analyzer="readiness"]')!;
  const delayHost = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-table"]')!;
  const grabDelay = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="grab-delay"]')!;
  const useDelay = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="use-delay"]')!;
  const loadDelay = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="load-delay"]')!;
  const delayEditor = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-editor"]')!;
  const delayWorking = root.querySelector<HTMLInputElement>('[data-ve-analyzer="delay-cell-working"]')!;
  const delayApply = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="delay-cell-apply"]')!;
  const delayRevert = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="delay-cell-revert"]')!;
  const delayResultTitle = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-result-title"]')!;

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

  const bulkEditor = document.createElement('div');
  bulkEditor.className = 've-delay-bulk-editor';
  bulkEditor.innerHTML = `
    <button type="button" data-ve-delay-edit="multi">Select multiple</button>
    <span><strong data-ve-delay-edit="count">0</strong> selected</span>
    <label><span>Working delay ms</span><input data-ve-delay-edit="value" type="number" min="0" step="1"></label>
    <button type="button" data-ve-delay-edit="apply" disabled>Apply to selected</button>
    <button type="button" data-ve-delay-edit="revert" disabled>Revert selected</button>
    <button type="button" data-ve-delay-edit="clear" disabled>Clear selection</button>
    <span class="ve-delay-edit-note">Tap a cell to select it. Enable Select multiple to toggle several cells on touch; Ctrl/Cmd-click also toggles.</span>`;
  delayHost.insertAdjacentElement('afterend', bulkEditor);

  const multiButton = bulkEditor.querySelector<HTMLButtonElement>('[data-ve-delay-edit="multi"]')!;
  const selectionCount = bulkEditor.querySelector<HTMLElement>('[data-ve-delay-edit="count"]')!;
  const bulkValue = bulkEditor.querySelector<HTMLInputElement>('[data-ve-delay-edit="value"]')!;
  const bulkApply = bulkEditor.querySelector<HTMLButtonElement>('[data-ve-delay-edit="apply"]')!;
  const bulkRevert = bulkEditor.querySelector<HTMLButtonElement>('[data-ve-delay-edit="revert"]')!;
  const bulkClear = bulkEditor.querySelector<HTMLButtonElement>('[data-ve-delay-edit="clear"]')!;

  const selected = new Set<DelayCellKey>();
  let multiMode = false;
  let bulkApplying = false;

  const visibleDelayCells = (): HTMLTableCellElement[] =>
    [...delayHost.querySelectorAll<HTMLTableCellElement>('td[data-delay-row][data-delay-col]')];

  const refreshSelection = (): void => {
    const visibleKeys = new Set<DelayCellKey>();
    for (const cell of visibleDelayCells()) {
      const row = Number(cell.dataset.delayRow);
      const col = Number(cell.dataset.delayCol);
      const key = keyFor(row, col);
      visibleKeys.add(key);
      cell.dataset.delaySelected = selected.has(key) ? 'true' : 'false';
      cell.tabIndex = 0;
      cell.setAttribute('aria-selected', selected.has(key) ? 'true' : 'false');
    }
    for (const key of [...selected]) if (!visibleKeys.has(key)) selected.delete(key);
    selectionCount.textContent = String(selected.size);
    bulkApply.disabled = selected.size === 0 || !Number.isFinite(Number(bulkValue.value)) || Number(bulkValue.value) < 0;
    bulkRevert.disabled = selected.size === 0;
    bulkClear.disabled = selected.size === 0;
  };

  const selectCell = (cell: HTMLTableCellElement, toggle: boolean): void => {
    const row = Number(cell.dataset.delayRow);
    const col = Number(cell.dataset.delayCol);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return;
    const key = keyFor(row, col);
    if (!toggle) selected.clear();
    if (toggle && selected.has(key)) selected.delete(key);
    else selected.add(key);
    refreshSelection();
  };

  delayHost.addEventListener('click', (event) => {
    if (bulkApplying) return;
    const cell = (event.target as HTMLElement).closest<HTMLTableCellElement>('td[data-delay-row][data-delay-col]');
    if (!cell) return;
    const mouse = event as MouseEvent;
    selectCell(cell, multiMode || mouse.ctrlKey || mouse.metaKey);
  }, { capture: true });

  delayHost.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const cell = (event.target as HTMLElement).closest<HTMLTableCellElement>('td[data-delay-row][data-delay-col]');
    if (!cell) return;
    event.preventDefault();
    selectCell(cell, multiMode || event.ctrlKey || event.metaKey);
    cell.click();
  });

  multiButton.onclick = () => {
    multiMode = !multiMode;
    multiButton.dataset.active = multiMode ? 'true' : 'false';
    multiButton.textContent = multiMode ? 'Selecting multiple' : 'Select multiple';
  };
  bulkValue.addEventListener('input', refreshSelection);
  bulkClear.onclick = () => { selected.clear(); refreshSelection(); };

  const invokeCellEditor = (key: DelayCellKey, action: 'apply' | 'revert', value?: number): void => {
    const { row, col } = parseKey(key);
    const cell = delayHost.querySelector<HTMLTableCellElement>(`td[data-delay-row="${row}"][data-delay-col="${col}"]`);
    if (!cell) return;
    cell.click();
    if (action === 'apply') {
      if (value === undefined) return;
      delayWorking.value = String(value);
      delayApply.click();
    } else {
      delayRevert.click();
    }
  };

  bulkApply.onclick = () => {
    const value = Number(bulkValue.value);
    if (!Number.isFinite(value) || value < 0 || selected.size === 0) return;
    const keys = [...selected];
    bulkApplying = true;
    try {
      for (const key of keys) invokeCellEditor(key, 'apply', value);
    } finally {
      bulkApplying = false;
      refreshSelection();
    }
  };

  bulkRevert.onclick = () => {
    if (selected.size === 0) return;
    const keys = [...selected];
    bulkApplying = true;
    try {
      for (const key of keys) invokeCellEditor(key, 'revert');
    } finally {
      bulkApplying = false;
      refreshSelection();
    }
  };

  const updateWorkflowState = (): void => {
    const mode = delayHost.dataset.mode ?? 'none';
    const recommendationReady = !useDelay.disabled;
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

    const blockers = requiredBlockers(root);
    if (runButton.disabled && mode === 'working' && blockers.length > 0) {
      readiness.textContent = `Run blocked: ${blockers.join(' · ')}`;
      readiness.title = `Resolve: ${blockers.join('; ')}`;
    } else if (runButton.disabled && mode !== 'working') {
      readiness.textContent = recommendationReady ? 'Run blocked: activate lambda delay recommendation' : 'Run blocked: lambda delay required';
      readiness.title = flowDetail.textContent ?? '';
    }
    refreshSelection();
  };

  for (const button of [grabDelay, useDelay, loadDelay]) {
    button.addEventListener('click', () => queueMicrotask(updateWorkflowState));
  }
  delayResultTitle.addEventListener('DOMSubtreeModified', updateWorkflowState);

  const observer = new MutationObserver(updateWorkflowState);
  observer.observe(delayHost, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-mode'] });
  const readinessBody = root.querySelector<HTMLElement>('[data-ve-analyzer="readiness-body"]');
  if (readinessBody) observer.observe(readinessBody, { childList: true, subtree: true });

  bulkEditor.insertAdjacentElement('afterend', delayEditor);
  updateWorkflowState();

  return {
    element: root,
    get sessionRevision() { return inner.sessionRevision; },
    getPrimaryAnalysis() { return inner.getPrimaryAnalysis(); },
    onPrimaryAnalysisChange(listener) { return inner.onPrimaryAnalysisChange(listener); },
    setContext(context: LoggerAnalysisContext) {
      const changed = inner.setContext(context);
      if (!changed) return false;
      queueMicrotask(updateWorkflowState);
      return true;
    },
    setTuneModel(model: TuneModel | undefined, sourceName?: string) {
      const changed = inner.setTuneModel(model, sourceName);
      if (!changed) return false;
      queueMicrotask(updateWorkflowState);
      return true;
    },
    refresh() {
      inner.refresh();
      queueMicrotask(updateWorkflowState);
    },
  };
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v3';
