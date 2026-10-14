import type { TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext } from './logger-page';
import { describeVeRunBlocker } from './ve-analyzer-blocker-info';
import {
  createVeAnalyzerView as createVeAnalyzerViewV6,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v6';

interface BlockerEntry {
  readonly message: string;
  readonly fixButton?: HTMLButtonElement;
}

type VeTableLayout = 'side-by-side' | 'single';
type VeTableTab = 've' | 'target';

const VE_TABLE_LAYOUT_STORAGE_KEY = 'epicscope.veAnalyzer.tableLayout';

function storedTableLayout(): VeTableLayout {
  try {
    return localStorage.getItem(VE_TABLE_LAYOUT_STORAGE_KEY) === 'single' ? 'single' : 'side-by-side';
  } catch {
    return 'side-by-side';
  }
}

function storeTableLayout(layout: VeTableLayout): void {
  try {
    localStorage.setItem(VE_TABLE_LAYOUT_STORAGE_KEY, layout);
  } catch {
    // Storage can be unavailable in restricted/private browser contexts.
  }
}

export function createVeAnalyzerView(): VeAnalyzerViewController {
  const inner = createVeAnalyzerViewV6();
  const root = inner.element;
  const workbench = root.querySelector<HTMLElement>('.ve-workbench')!;
  const actionbar = root.querySelector<HTMLElement>('.ve-workbench-actionbar')!;
  const readiness = root.querySelector<HTMLElement>('[data-ve-analyzer="readiness"]')!;
  const blockerPanel = root.querySelector<HTMLElement>('.ve-run-blocker-panel')!;
  const advanced = root.querySelector<HTMLDetailsElement>('.ve-workbench-advanced');
  const advancedControls = advanced?.querySelector<HTMLElement>('[data-ve-analyzer="controls"]');

  const minimumEvidence = root.querySelector<HTMLInputElement>('input[data-role="min-evidence-weight"]');
  const minimumEvidenceCaption = minimumEvidence?.closest('label')?.querySelector('span');
  if (minimumEvidenceCaption) minimumEvidenceCaption.textContent = 'Min evidence weight';

  // Table choice already resolves the matching RPM/load axes. Keep manual mapping
  // available as an Advanced escape hatch for ambiguous/non-standard tune files,
  // but do not spend normal-workflow space on four usually redundant selectors.
  if (advanced && advancedControls) {
    const mapping = document.createElement('section');
    mapping.className = 've-axis-mapping-advanced';
    const heading = document.createElement('div');
    heading.className = 've-axis-mapping-heading';
    heading.innerHTML = '<strong>Table-axis mapping</strong><span>Resolved automatically from the selected VE and target tables. Override only when a tune has ambiguous or non-standard mappings.</span>';
    mapping.append(heading);
    for (const role of ['rpm-axis', 'load-axis', 'target-rpm-axis', 'target-load-axis'] as const) {
      const control = root.querySelector<HTMLSelectElement>(`select[data-role="${role}"]`);
      const label = control?.closest<HTMLLabelElement>('label');
      if (label) mapping.append(label);
    }
    advanced.insertBefore(mapping, advancedControls);
  }

  const vePanel = root.querySelector<HTMLElement>('[data-ve-analyzer="ve-table-view"]')?.closest<HTMLElement>('.ve-workbench-panel');
  const targetPanel = root.querySelector<HTMLElement>('[data-ve-analyzer="target-table-view"]')?.closest<HTMLElement>('.ve-workbench-panel');
  const veHeader = vePanel?.querySelector<HTMLElement>('header');
  const targetHeader = targetPanel?.querySelector<HTMLElement>('header');
  let activeTableTab: VeTableTab = 've';

  const tableLayoutLabel = document.createElement('label');
  const tableLayoutCaption = document.createElement('span');
  tableLayoutCaption.textContent = 'Table view';
  const tableLayoutSelect = document.createElement('select');
  tableLayoutSelect.setAttribute('aria-label', 'VE Analyzer table view');
  tableLayoutSelect.innerHTML = '<option value="side-by-side">Side by side</option><option value="single">Single table</option>';
  tableLayoutSelect.value = storedTableLayout();
  tableLayoutLabel.append(tableLayoutCaption, tableLayoutSelect);
  readiness.insertAdjacentElement('beforebegin', tableLayoutLabel);

  const tableTabs = document.createElement('nav');
  tableTabs.className = 've-workbench-table-tabs';
  tableTabs.setAttribute('aria-label', 'VE Analyzer table');
  const veTabButton = document.createElement('button');
  veTabButton.type = 'button';
  veTabButton.textContent = 'VE table';
  veTabButton.dataset.tableTab = 've';
  veTabButton.setAttribute('role', 'tab');
  const targetTabButton = document.createElement('button');
  targetTabButton.type = 'button';
  targetTabButton.textContent = 'Target table';
  targetTabButton.dataset.tableTab = 'target';
  targetTabButton.setAttribute('role', 'tab');
  tableTabs.append(veTabButton, targetTabButton);

  const applyTableLayout = (): void => {
    const layout = tableLayoutSelect.value === 'single' ? 'single' : 'side-by-side';
    workbench.dataset.tableLayout = layout;
    tableTabs.hidden = layout !== 'single';

    if (layout === 'single') {
      const activeHeader = activeTableTab === 've' ? veHeader : targetHeader;
      activeHeader?.append(tableTabs);
    }

    if (vePanel) vePanel.hidden = layout === 'single' && activeTableTab !== 've';
    if (targetPanel) targetPanel.hidden = layout === 'single' && activeTableTab !== 'target';

    veTabButton.classList.toggle('is-active', activeTableTab === 've');
    targetTabButton.classList.toggle('is-active', activeTableTab === 'target');
    veTabButton.setAttribute('aria-selected', activeTableTab === 've' ? 'true' : 'false');
    targetTabButton.setAttribute('aria-selected', activeTableTab === 'target' ? 'true' : 'false');
  };

  tableLayoutSelect.addEventListener('change', () => {
    const layout: VeTableLayout = tableLayoutSelect.value === 'single' ? 'single' : 'side-by-side';
    storeTableLayout(layout);
    applyTableLayout();
  });

  veTabButton.addEventListener('click', () => {
    activeTableTab = 've';
    applyTableLayout();
  });

  targetTabButton.addEventListener('click', () => {
    activeTableTab = 'target';
    applyTableLayout();
  });

  applyTableLayout();

  actionbar.classList.add('ve-run-info-host');

  const infoButton = document.createElement('button');
  infoButton.type = 'button';
  infoButton.className = 've-run-info-button';
  infoButton.setAttribute('aria-label', 'Why Run Analysis is blocked');
  infoButton.setAttribute('aria-expanded', 'false');
  infoButton.textContent = 'i';
  readiness.insertAdjacentElement('afterend', infoButton);

  const popout = document.createElement('div');
  popout.className = 've-run-info-popout';
  popout.hidden = true;
  popout.setAttribute('role', 'dialog');
  popout.setAttribute('aria-label', 'Run Analysis blockers');
  actionbar.append(popout);

  const blockerEntries = (): BlockerEntry[] => {
    const entries: BlockerEntry[] = [];
    for (const item of blockerPanel.querySelectorAll<HTMLElement>('.ve-run-blocker-item')) {
      const message = item.querySelector('span')?.textContent?.trim() ?? '';
      if (!message) continue;
      const fixButton = item.querySelector<HTMLButtonElement>('button') ?? undefined;
      entries.push(fixButton ? { message, fixButton } : { message });
    }
    return entries;
  };

  const renderPopout = (): void => {
    const entries = blockerEntries();
    infoButton.hidden = entries.length === 0;
    if (entries.length === 0) {
      popout.hidden = true;
      infoButton.setAttribute('aria-expanded', 'false');
      popout.replaceChildren();
      return;
    }

    const header = document.createElement('div');
    header.className = 've-run-info-header';
    const title = document.createElement('strong');
    title.textContent = `Run Analysis blocked · ${entries.length} ${entries.length === 1 ? 'issue' : 'issues'}`;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 've-run-info-close';
    close.setAttribute('aria-label', 'Close Run Analysis information');
    close.textContent = '×';
    close.onclick = () => {
      popout.hidden = true;
      infoButton.setAttribute('aria-expanded', 'false');
      infoButton.focus({ preventScroll: true });
    };
    header.append(title, close);

    const intro = document.createElement('p');
    intro.className = 've-run-info-intro';
    intro.textContent = 'Run Analysis stays disabled until every required item below is valid. Optional blank Min/Max limits use the full available range and do not block analysis.';

    const list = document.createElement('div');
    list.className = 've-run-info-list';
    entries.forEach((entry, index) => {
      const help = describeVeRunBlocker(entry.message);
      const item = document.createElement('section');
      item.className = 've-run-info-item';
      const heading = document.createElement('strong');
      heading.textContent = `${index + 1}. ${entry.message}`;
      const whyLabel = document.createElement('span');
      whyLabel.className = 've-run-info-label';
      whyLabel.textContent = 'Why this blocks analysis';
      const why = document.createElement('p');
      why.textContent = help.why;
      const fixLabel = document.createElement('span');
      fixLabel.className = 've-run-info-label';
      fixLabel.textContent = 'How to fix it';
      const fix = document.createElement('p');
      fix.textContent = help.fix;
      item.append(heading, whyLabel, why, fixLabel, fix);
      if (entry.fixButton) {
        const jump = document.createElement('button');
        jump.type = 'button';
        jump.textContent = 'Fix';
        jump.onclick = () => {
          popout.hidden = true;
          infoButton.setAttribute('aria-expanded', 'false');
          entry.fixButton!.click();
        };
        item.append(jump);
      }
      list.append(item);
    });

    popout.replaceChildren(header, intro, list);
  };

  infoButton.onclick = () => {
    renderPopout();
    popout.hidden = !popout.hidden;
    infoButton.setAttribute('aria-expanded', popout.hidden ? 'false' : 'true');
  };

  const observer = new MutationObserver(() => {
    const wasOpen = !popout.hidden;
    renderPopout();
    if (wasOpen && !infoButton.hidden) {
      popout.hidden = false;
      infoButton.setAttribute('aria-expanded', 'true');
    }
  });
  observer.observe(blockerPanel, { childList: true, subtree: true, characterData: true });

  document.addEventListener('pointerdown', (event) => {
    if (popout.hidden) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (popout.contains(target) || infoButton.contains(target)) return;
    popout.hidden = true;
    infoButton.setAttribute('aria-expanded', 'false');
  });

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || popout.hidden) return;
    popout.hidden = true;
    infoButton.setAttribute('aria-expanded', 'false');
    infoButton.focus({ preventScroll: true });
  });

  queueMicrotask(renderPopout);

  return {
    element: root,
    setContext(context: LoggerAnalysisContext) {
      inner.setContext(context);
      queueMicrotask(renderPopout);
    },
    setTuneModel(model: TuneModel | undefined, sourceName?: string) {
      inner.setTuneModel(model, sourceName);
      queueMicrotask(renderPopout);
    },
    refresh() {
      inner.refresh();
      queueMicrotask(renderPopout);
    },
  };
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v6';
