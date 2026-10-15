import type { TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext } from './logger-page';
import { describeVeRunBlocker } from './ve-analyzer-blocker-info';
import {
  VE_RESULT_VIEW_OPTIONS,
  parseVeRenderedCellMetrics,
  veResultDisplay,
  type VeResultView,
} from './ve-analyzer-result-view';
import {
  createVeAnalyzerView as createVeAnalyzerViewV6,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v6';

interface BlockerEntry {
  readonly message: string;
  readonly fixButton?: HTMLButtonElement;
}

interface DelaySurface {
  readonly rpmBins: readonly number[];
  readonly loadBins: readonly number[];
  readonly rows: readonly (readonly (number | undefined)[])[];
}

type VeTableLayout = 'side-by-side' | 'single';
type VeTableTab = 've' | 'target';

const VE_TABLE_LAYOUT_STORAGE_KEY = 'epicscope.veAnalyzer.tableLayout';
const VE_RESULT_VIEW_STORAGE_KEY = 'epicscope.veAnalyzer.resultView';

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

function storedResultView(): VeResultView {
  try {
    const stored = localStorage.getItem(VE_RESULT_VIEW_STORAGE_KEY);
    return VE_RESULT_VIEW_OPTIONS.some((option) => option.value === stored) ? stored as VeResultView : 'proposal';
  } catch {
    return 'proposal';
  }
}

function storeResultView(view: VeResultView): void {
  try {
    localStorage.setItem(VE_RESULT_VIEW_STORAGE_KEY, view);
  } catch {
    // Storage can be unavailable in restricted/private browser contexts.
  }
}

function finiteNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readDelaySurface(root: HTMLElement): DelaySurface | undefined {
  const table = root.querySelector<HTMLTableElement>('.ve-delay-table');
  const header = table?.tHead?.rows[0];
  const body = table?.tBodies[0];
  if (!table || !header || !body) return undefined;

  const rpmBins = [...header.cells].slice(1).map((cell) => finiteNumber(cell.textContent?.trim())).filter((value): value is number => value !== undefined);
  if (rpmBins.length === 0) return undefined;

  const rows = [...body.rows].map((row) => {
    const load = finiteNumber(row.cells[0]?.textContent?.trim());
    const values = [...row.cells].slice(1).map((cell) => {
      const td = cell as HTMLTableCellElement;
      return finiteNumber(td.dataset.delayValue) ?? finiteNumber(td.textContent?.trim());
    });
    return load === undefined ? undefined : { load, values };
  }).filter((row): row is { load: number; values: (number | undefined)[] } => row !== undefined)
    .sort((a, b) => a.load - b.load);

  if (rows.length === 0) return undefined;
  return {
    rpmBins,
    loadBins: rows.map((row) => row.load),
    rows: rows.map((row) => row.values),
  };
}

function bracket(value: number, bins: readonly number[]): { low: number; high: number; fraction: number } | undefined {
  if (!Number.isFinite(value) || bins.length === 0 || value < bins[0]! || value > bins[bins.length - 1]!) return undefined;
  if (bins.length === 1 || value === bins[0]) return { low: 0, high: 0, fraction: 0 };
  const last = bins.length - 1;
  if (value === bins[last]) return { low: last, high: last, fraction: 0 };
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const mid = (low + high) >>> 1;
    if (value < bins[mid]!) high = mid;
    else low = mid;
  }
  const span = bins[high]! - bins[low]!;
  return span > 0 ? { low, high, fraction: (value - bins[low]!) / span } : undefined;
}

function interpolateDelay(surface: DelaySurface | undefined, rpm: number | undefined, load: number | undefined): number | undefined {
  if (!surface || rpm === undefined || load === undefined) return undefined;
  const x = bracket(rpm, surface.rpmBins);
  const y = bracket(load, surface.loadBins);
  if (!x || !y) return undefined;
  const at = (row: number, col: number) => surface.rows[row]?.[col];
  const v00 = at(y.low, x.low);
  if (v00 === undefined) return undefined;
  if (x.low === x.high && y.low === y.high) return v00;
  const v10 = at(y.low, x.high);
  const v01 = at(y.high, x.low);
  const v11 = at(y.high, x.high);
  if (v10 === undefined || v01 === undefined || v11 === undefined) return undefined;
  const top = x.low === x.high ? v00 : v00 + (v10 - v00) * x.fraction;
  const bottom = x.low === x.high ? v01 : v01 + (v11 - v01) * x.fraction;
  return y.low === y.high ? top : top + (bottom - top) * y.fraction;
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

  const veHost = root.querySelector<HTMLElement>('[data-ve-analyzer="ve-table-view"]');
  const targetHost = root.querySelector<HTMLElement>('[data-ve-analyzer="target-table-view"]');
  const vePanel = veHost?.closest<HTMLElement>('.ve-workbench-panel');
  const targetPanel = targetHost?.closest<HTMLElement>('.ve-workbench-panel');
  const veHeader = vePanel?.querySelector<HTMLElement>('header');
  const targetHeader = targetPanel?.querySelector<HTMLElement>('header');
  const veHeaderDescription = veHeader?.querySelector<HTMLElement>(':scope > div > span');
  const baseVeHeaderDescription = veHeaderDescription?.textContent ?? '';
  const veSelect = root.querySelector<HTMLSelectElement>('select[data-role="ve-table"]');
  const targetSelect = root.querySelector<HTMLSelectElement>('select[data-role="target-table"]');
  let activeTableTab: VeTableTab = 've';

  // v7 is the single owner of table layout, result-view selection and table-header controls.
  // Later enhancement layers must not re-parent these nodes.
  const veControls = document.createElement('div');
  veControls.className = 've-table-header-controls';
  const targetControls = document.createElement('div');
  targetControls.className = 've-table-header-controls';
  veHeader?.prepend(veControls);
  targetHeader?.prepend(targetControls);

  const tableLayoutLabel = document.createElement('label');
  tableLayoutLabel.className = 've-table-layout-control';
  const tableLayoutSelect = document.createElement('select');
  tableLayoutSelect.setAttribute('aria-label', 'VE Analyzer table view');
  tableLayoutSelect.innerHTML = '<option value="side-by-side">Side by side</option><option value="single">Single table</option>';
  tableLayoutSelect.value = storedTableLayout();
  tableLayoutLabel.append(tableLayoutSelect);

  const resultViewLabel = document.createElement('label');
  resultViewLabel.className = 've-result-view-control';
  const resultViewSelect = document.createElement('select');
  resultViewSelect.setAttribute('aria-label', 'VE Analyzer result view');
  resultViewSelect.replaceChildren(...VE_RESULT_VIEW_OPTIONS.map((option) => new Option(option.label, option.value)));
  resultViewSelect.value = storedResultView();
  resultViewLabel.append(resultViewSelect);

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

  const resultDescription = (view: VeResultView): string => {
    switch (view) {
      case 'proposal': return baseVeHeaderDescription;
      case 'change': return 'VE change from the original table; weak/withheld cells show the raw evidence candidate for review.';
      case 'change-percent': return 'VE change in percent; weak/withheld cells show the raw evidence candidate for review.';
      case 'mixture-error': return 'Robust target-vs-actual correction evidence after the configured fuel-correction handling.';
      case 'samples': return 'Contributing sample count retained by each VE node.';
      case 'weight': return 'Cumulative spatial evidence weight retained by each VE node.';
      case 'confidence': return 'Evidence confidence derived from weight, repeat observations and correction spread.';
      case 'spread': return 'P10-to-P90 correction spread; lower spread means the retained evidence agrees more closely.';
      case 'delay': return 'Working RPM × load lambda-delay table interpolated at each VE-table node.';
    }
  };

  const applyResultView = (): void => {
    const table = veHost?.querySelector<HTMLTableElement>('.ve-workbench-table');
    if (!table) return;
    const view = VE_RESULT_VIEW_OPTIONS.some((option) => option.value === resultViewSelect.value)
      ? resultViewSelect.value as VeResultView
      : 'proposal';
    table.dataset.veResultView = view;
    if (veHeaderDescription) veHeaderDescription.textContent = resultDescription(view);

    const rpmBins = [...(table.tHead?.rows[0]?.cells ?? [])].slice(1).map((cell) => finiteNumber(cell.textContent?.trim()));
    const delaySurface = view === 'delay' ? readDelaySurface(root) : undefined;
    const rendered: Array<{ cell: HTMLTableCellElement; value: number; mode: 'magnitude' | 'quality' | 'range' }> = [];

    for (const row of [...(table.tBodies[0]?.rows ?? [])]) {
      const load = finiteNumber(row.cells[0]?.textContent?.trim());
      for (let col = 1; col < row.cells.length; col += 1) {
        const cell = row.cells[col] as HTMLTableCellElement;
        const main = cell.querySelector<HTMLElement>(':scope > span');
        if (!main) continue;
        if (cell.dataset.veBaseLevel === undefined) cell.dataset.veBaseLevel = cell.style.getPropertyValue('--ve-cell-level');
        const metrics = parseVeRenderedCellMetrics(cell.title, main.textContent ?? '');
        const delayMs = view === 'delay' ? interpolateDelay(delaySurface, rpmBins[col - 1], load) : undefined;
        const display = veResultDisplay(metrics, view, delayMs);
        main.textContent = display.text;
        cell.dataset.veResultValue = display.numericValue === undefined ? '' : String(display.numericValue);
        cell.classList.toggle('ve-result-missing', display.numericValue === undefined);

        if (view === 'proposal') {
          const base = cell.dataset.veBaseLevel;
          if (base) cell.style.setProperty('--ve-cell-level', base);
          else cell.style.removeProperty('--ve-cell-level');
          continue;
        }
        if (display.numericValue !== undefined && display.scaleMode !== 'base') {
          rendered.push({ cell, value: display.numericValue, mode: display.scaleMode });
        } else {
          cell.style.setProperty('--ve-cell-level', '0.5');
        }
      }
    }

    if (view === 'proposal' || rendered.length === 0) return;
    const values = rendered.map((entry) => entry.value);
    const finite = values.filter(Number.isFinite);
    const min = finite.length ? Math.min(...finite) : 0;
    const max = finite.length ? Math.max(...finite) : 1;
    const maxMagnitude = finite.length ? Math.max(...finite.map((value) => Math.abs(value))) : 1;

    for (const entry of rendered) {
      let level = 0.5;
      if (entry.mode === 'magnitude') {
        level = maxMagnitude > 0 ? Math.abs(entry.value) / maxMagnitude : 0;
      } else {
        const normalized = max > min ? (entry.value - min) / (max - min) : 1;
        level = entry.mode === 'quality' ? 1 - normalized : normalized;
      }
      entry.cell.style.setProperty('--ve-cell-level', String(Math.max(0, Math.min(1, level))));
    }
  };

  const syncTableHeaderControls = (): void => {
    if (!veSelect || !targetSelect) return;
    veControls.replaceChildren();
    targetControls.replaceChildren();

    const single = tableLayoutSelect.value === 'single';
    if (!single) {
      veControls.append(tableLayoutLabel, resultViewLabel, veSelect);
      targetControls.append(targetSelect);
      return;
    }

    // Single-table mode keeps all dropdowns together, then the separately styled tab group.
    const activeControls = activeTableTab === 've' ? veControls : targetControls;
    activeControls.append(tableLayoutLabel, resultViewLabel, veSelect, targetSelect, tableTabs);
  };

  const applyTableLayout = (): void => {
    const layout = tableLayoutSelect.value === 'single' ? 'single' : 'side-by-side';
    workbench.dataset.tableLayout = layout;
    tableTabs.hidden = layout !== 'single';

    if (vePanel) vePanel.hidden = layout === 'single' && activeTableTab !== 've';
    if (targetPanel) targetPanel.hidden = layout === 'single' && activeTableTab !== 'target';

    veTabButton.classList.toggle('is-active', activeTableTab === 've');
    targetTabButton.classList.toggle('is-active', activeTableTab === 'target');
    veTabButton.setAttribute('aria-selected', activeTableTab === 've' ? 'true' : 'false');
    targetTabButton.setAttribute('aria-selected', activeTableTab === 'target' ? 'true' : 'false');
    syncTableHeaderControls();
  };

  tableLayoutSelect.addEventListener('change', () => {
    const layout: VeTableLayout = tableLayoutSelect.value === 'single' ? 'single' : 'side-by-side';
    storeTableLayout(layout);
    applyTableLayout();
  });

  resultViewSelect.addEventListener('change', () => {
    const view = resultViewSelect.value as VeResultView;
    storeResultView(view);
    applyResultView();
  });

  veTabButton.addEventListener('click', () => {
    activeTableTab = 've';
    applyTableLayout();
  });

  targetTabButton.addEventListener('click', () => {
    activeTableTab = 'target';
    applyTableLayout();
  });

  const tableObserver = new MutationObserver(() => queueMicrotask(applyResultView));
  if (veHost) tableObserver.observe(veHost, { childList: true });

  applyTableLayout();
  queueMicrotask(applyResultView);

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
    get sessionRevision() { return inner.sessionRevision; },
    setContext(context: LoggerAnalysisContext) {
      const changed = inner.setContext(context);
      if (!changed) return false;
      queueMicrotask(() => { renderPopout(); syncTableHeaderControls(); applyResultView(); });
      return true;
    },
    setTuneModel(model: TuneModel | undefined, sourceName?: string) {
      const changed = inner.setTuneModel(model, sourceName);
      if (!changed) return false;
      queueMicrotask(() => { renderPopout(); syncTableHeaderControls(); applyResultView(); });
      return true;
    },
    refresh() {
      inner.refresh();
      queueMicrotask(() => { renderPopout(); syncTableHeaderControls(); applyResultView(); });
    },
  };
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v6';
