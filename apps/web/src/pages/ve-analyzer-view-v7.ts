import { createOwnerEvidence } from '../observability/producers/owner';
import type { ObservabilityRecorder } from '../observability/recorder';
import { veDelayEditOwner } from './ve-analyzer-delay-edit-owner';
import { veProposalEditOwner } from './ve-analyzer-proposal-edit-owner';
import { focusVeReadinessTarget } from './ve-analyzer-readiness';
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

function readDelaySurface(root: HTMLElement): DelaySurface | undefined {
  const snapshot = veDelayEditOwner(root)?.snapshot();
  if (!snapshot || snapshot.rows <= 0 || snapshot.cols <= 0) return undefined;
  if (snapshot.rpmBins.length !== snapshot.cols || snapshot.loadBins.length !== snapshot.rows) return undefined;
  if (snapshot.values.length !== snapshot.rows * snapshot.cols) return undefined;
  if (!snapshot.rpmBins.every(Number.isFinite) || !snapshot.loadBins.every(Number.isFinite)) return undefined;

  const rows = Array.from({ length: snapshot.rows }, (_, row) =>
    snapshot.values.slice(row * snapshot.cols, (row + 1) * snapshot.cols));
  return {
    rpmBins: snapshot.rpmBins,
    loadBins: snapshot.loadBins,
    rows,
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

function finiteValues(values: readonly (number | undefined)[] | undefined): readonly number[] {
  return values?.filter((value): value is number => value !== undefined && Number.isFinite(value)) ?? [];
}

function baseHeatLevel(value: number | undefined, values: readonly (number | undefined)[] | undefined): string | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  const finite = finiteValues(values);
  if (finite.length === 0) return undefined;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (min === max) return '0.5';
  return String(Math.max(0, Math.min(1, (value - min) / (max - min))));
}

export function createVeAnalyzerView(observability?: ObservabilityRecorder): VeAnalyzerViewController {
  const ownerEvidence = createOwnerEvidence(observability, 've-presentation');
  const inner = createVeAnalyzerViewV6(observability);
  const root = inner.element;
  const workbench = root.querySelector<HTMLElement>('.ve-workbench')!;
  const actionbar = root.querySelector<HTMLElement>('.ve-workbench-actionbar')!;
  const readiness = root.querySelector<HTMLElement>('[data-ve-analyzer="readiness"]')!;
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

  const restoreBaseLevel = (cell: HTMLTableCellElement): void => {
    const base = cell.dataset.veBaseLevel;
    if (base) cell.style.setProperty('--ve-cell-level', base);
    else cell.style.removeProperty('--ve-cell-level');
  };

  const applyResultView = (): void => {
    const table = veHost?.querySelector<HTMLTableElement>('.ve-workbench-table');
    if (!table) return;
    const view = VE_RESULT_VIEW_OPTIONS.some((option) => option.value === resultViewSelect.value)
      ? resultViewSelect.value as VeResultView
      : 'proposal';
    table.dataset.veResultView = view;
    if (veHeaderDescription) veHeaderDescription.textContent = resultDescription(view);

    const delaySurface = view === 'delay' ? readDelaySurface(root) : undefined;
    const proposalSnapshot = veProposalEditOwner(root)?.snapshot();
    const primary = inner.getPrimaryAnalysis();
    const semanticSourceValues = primary?.veTable.numericValues ?? proposalSnapshot?.baselineValues;
    const rendered: Array<{ cell: HTMLTableCellElement; value: number; mode: 'magnitude' | 'quality' | 'range' }> = [];

    for (const row of [...(table.tBodies[0]?.rows ?? [])]) {
      for (let col = 1; col < row.cells.length; col += 1) {
        const cell = row.cells[col] as HTMLTableCellElement;
        const main = cell.querySelector<HTMLElement>(':scope > span');
        if (!main) continue;

        const semanticRow = Number(cell.dataset.veRow);
        const semanticCol = Number(cell.dataset.veCol);
        const hasSemanticPosition = Number.isInteger(semanticRow) && Number.isInteger(semanticCol)
          && semanticRow >= 0 && semanticCol >= 0;
        const sourceCols = primary?.veTable.cols ?? proposalSnapshot?.cols;
        const sourceRows = primary?.veTable.rows ?? proposalSnapshot?.rows;
        const insideSource = hasSemanticPosition && sourceCols !== undefined && sourceRows !== undefined
          && semanticRow < sourceRows && semanticCol < sourceCols;
        const sourceIndex = insideSource ? semanticRow * sourceCols + semanticCol : undefined;
        const sourceCurrent = sourceIndex === undefined ? undefined : primary?.veTable.numericValues?.[sourceIndex]
          ?? proposalSnapshot?.baselineValues[sourceIndex];
        const current = sourceCurrent !== undefined && Number.isFinite(sourceCurrent) ? sourceCurrent : undefined;
        const baseLevel = baseHeatLevel(current, semanticSourceValues);
        if (current !== undefined) cell.dataset.veCurrentValue = String(current);
        else delete cell.dataset.veCurrentValue;
        if (baseLevel !== undefined) cell.dataset.veBaseLevel = baseLevel;
        else delete cell.dataset.veBaseLevel;

        const rpm = insideSource ? (primary?.rpmBins[semanticCol] ?? proposalSnapshot?.rpmBins[semanticCol]) : undefined;
        const load = insideSource ? (primary?.loadBins[semanticRow] ?? proposalSnapshot?.loadBins[semanticRow]) : undefined;

        if (view === 'proposal' && proposalSnapshot && insideSource
          && semanticRow < proposalSnapshot.rows && semanticCol < proposalSnapshot.cols) {
          const working = proposalSnapshot.values[semanticRow * proposalSnapshot.cols + semanticCol];
          main.textContent = working === undefined ? '—' : proposalSnapshot.digits === undefined
            ? String(working) : working.toFixed(proposalSnapshot.digits);
          cell.dataset.veResultValue = working === undefined ? '' : String(working);
          cell.classList.toggle('ve-result-missing', working === undefined);
          restoreBaseLevel(cell);
          continue;
        }

        const metrics = parseVeRenderedCellMetrics(cell.title, current === undefined ? '' : String(current));
        const delayMs = view === 'delay' ? interpolateDelay(delaySurface, rpm, load) : undefined;
        const display = veResultDisplay(metrics, view, delayMs);
        main.textContent = display.text;
        cell.dataset.veResultValue = display.numericValue === undefined ? '' : String(display.numericValue);
        cell.classList.toggle('ve-result-missing', display.numericValue === undefined);

        if (view === 'proposal' || display.scaleMode === 'base') {
          // Falling back to original VE restores original VE heat. A valid Delay
          // metric keeps its own range scaling instead of being treated as base.
          restoreBaseLevel(cell);
          continue;
        }
        if (display.numericValue !== undefined) {
          rendered.push({ cell, value: display.numericValue, mode: display.scaleMode });
        } else {
          restoreBaseLevel(cell);
        }
      }
    }

    if (view === 'proposal' || rendered.length === 0) return;
    let min = Infinity;
    let max = -Infinity;
    let maxMagnitude = 0;
    for (const { value } of rendered) {
      if (!Number.isFinite(value)) continue;
      min = Math.min(min, value);
      max = Math.max(max, value);
      maxMagnitude = Math.max(maxMagnitude, Math.abs(value));
    }

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

  // Rebuild notifications and wrapper refreshes can arrive in the same turn.
  // Keep one pending presentation pass, while explicit selection stays immediate.
  let resultViewQueued = false;
  const scheduleResultView = (mutations?: MutationRecord[]): void => {
    ownerEvidence.event('ve.presentation.schedule', { queued: resultViewQueued, mutations: mutations?.length ?? 0 }, { origin: mutations ? 'observer' : 'programmatic' });
    if (resultViewQueued) return;
    resultViewQueued = true;
    queueMicrotask(() => {
      if (!resultViewQueued) return;
      resultViewQueued = false;
      applyResultView();
    });
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

  resultViewSelect.addEventListener('change', (event) => {
    ownerEvidence.event('ve.result-view.changed', { view: resultViewSelect.value }, { origin: event.isTrusted ? 'user' : 'programmatic', stateRevision: inner.sessionRevision });
    const view = resultViewSelect.value as VeResultView;
    storeResultView(view);
    resultViewQueued = false;
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

  const tableObserver = new MutationObserver(scheduleResultView);
  if (veHost) tableObserver.observe(veHost, { childList: true });

  applyTableLayout();
  scheduleResultView();

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

  const renderPopout = (): void => {
    const state = inner.getReadiness();
    const entries = state.active && !state.pending ? state.blockers : [];
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
      const help = describeVeRunBlocker(entry);
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
      if (entry.targetSelector) {
        const jump = document.createElement('button');
        jump.type = 'button';
        jump.textContent = 'Fix';
        jump.onclick = () => {
          popout.hidden = true;
          infoButton.setAttribute('aria-expanded', 'false');
          focusVeReadinessTarget(root, entry.targetSelector!);
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

  inner.onReadinessChange(() => {
    const wasOpen = !popout.hidden;
    renderPopout();
    if (wasOpen && !infoButton.hidden) {
      popout.hidden = false;
      infoButton.setAttribute('aria-expanded', 'true');
    }
  });

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
      queueMicrotask(() => { renderPopout(); syncTableHeaderControls(); });
      scheduleResultView();
      return true;
    },
    setTuneModel(model: TuneModel | undefined, sourceName?: string) {
      const changed = inner.setTuneModel(model, sourceName);
      if (!changed) return false;
      queueMicrotask(() => { renderPopout(); syncTableHeaderControls(); });
      scheduleResultView();
      return true;
    },
    refresh() {
      inner.refresh();
      queueMicrotask(() => { renderPopout(); syncTableHeaderControls(); });
      scheduleResultView();
    },
  };
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v6';
