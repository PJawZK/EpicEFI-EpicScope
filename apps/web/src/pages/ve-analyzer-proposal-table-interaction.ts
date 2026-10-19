import { TableEditHistorySurface } from './ve-table-edit-history';
import { setTableHistoryAvailability } from './ve-table-toolbar-availability';
import type { LoggerAnalysisContext } from './logger-page';
import type { TuneModel } from '../../../../core/tune/tune-model';
import {
  veProposalEditOwner,
  type VeProposalCellValueEdit,
  type VeProposalEditOwner,
  type VeProposalEditSnapshot,
} from './ve-analyzer-proposal-edit-owner';
import { createTableInteractionDomController, hasAddedOrRemovedElement } from './ve-table-interaction-dom';
import {
  TableInteractionSession,
  type TableBrushOptions,
  type TableCellPosition,
  type TableInterpolationOptions,
} from './ve-table-interaction';
import { VE_TABLE_TOOL_ICONS } from './ve-table-icons';
import type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
import '../styles/ve-table-interaction-dom.css';

class VeProposalTableEditSurface extends TableEditHistorySurface<VeProposalEditSnapshot, VeProposalCellValueEdit> {
  constructor(owner: VeProposalEditOwner) {
    super({
      snapshot: () => owner.snapshot(),
      applyValues: edits => owner.applyValues(edits),
      revert: positions => owner.revert(positions),
      normalizeValue: value => Math.max(0, value),
      createEdit: ({ row, col }, value) => ({ row, col, value }),
      editValue: edit => edit.value,
    });
  }

  baselineValueAt(position: TableCellPosition): number | undefined {
    const snapshot = this.currentSnapshot();
    if (!snapshot || position.row < 0 || position.row >= snapshot.rows || position.col < 0 || position.col >= snapshot.cols) return undefined;
    return snapshot.baselineValues[position.row * snapshot.cols + position.col];
  }
}

function currentProposalTable(host: HTMLElement): HTMLTableElement | undefined {
  const table = host.querySelector<HTMLTableElement>('table.ve-workbench-table');
  if (!table) return undefined;
  return !table.dataset.veResultView || table.dataset.veResultView === 'proposal' ? table : undefined;
}

function precisionStep(owner: VeProposalEditOwner): number {
  const digits = owner.snapshot()?.digits;
  return digits !== undefined && Number.isInteger(digits) && digits >= 0 && digits <= 8 ? 1 / 10 ** digits : 0.1;
}

/**
 * Shared v50 edit adapter for the VE Proposal review surface.
 *
 * The source TuneModel remains immutable. All edits are review/working proposal
 * values owned by v2 and flow through the same generic selection/edit engine as
 * Lambda Delay. Alternate Result Views remain read-only metrics.
 */
export function installVeAnalyzerProposalTableInteraction(inner: VeAnalyzerViewController): VeAnalyzerViewController {
  const root = inner.element;
  let disposed = false;
  const events = new AbortController();
  const owner = veProposalEditOwner(root);
  const veHost = root.querySelector<HTMLElement>('[data-ve-analyzer="ve-table-view"]');
  if (!owner || !veHost) return inner;

  const surface = new VeProposalTableEditSurface(owner);
  const session = new TableInteractionSession(surface);
  let active = true;
  let boundPending: boolean | undefined;
  let step: number | undefined;
  let previewDigits = owner.snapshot()?.digits;
  let smoothStrength = 0.5;
  let interpolation: TableInterpolationOptions = { axis: 'both', method1d: 'linear', method2d: 'bilinear', strength: 1, clamp: true };
  let brush: TableBrushOptions = { delta: precisionStep(owner), radius: 2, strength: 0.7, falloff: 'soft' };
  const currentStep = (): number => step ?? precisionStep(owner);
  const resetTool = (kind: 'step' | 'smooth' | 'interpolation' | 'brush'): void => {
    if (kind === 'step') step = undefined;
    else if (kind === 'smooth') smoothStrength = 0.5;
    else if (kind === 'interpolation') interpolation = { axis: 'both', method1d: 'linear', method2d: 'bilinear', strength: 1, clamp: true };
    else brush = { delta: precisionStep(owner), radius: 2, strength: 0.7, falloff: 'soft' };
  };

  const dom = createTableInteractionDomController(session, {
    adjustmentStep: currentStep,
    smoothStrength: () => smoothStrength,
    interpolation: () => interpolation,
    brush: () => brush,
    readValue: (position) => surface.valueAt(position),
    baselineValue: (position) => surface.baselineValueAt(position),
    readValues: () => owner.snapshot(),
    formatPreviewValue: (_position, value) => previewDigits === undefined ? String(Math.round(value * 1000) / 1000) : value.toFixed(previewDigits),
    adjustBrushRadius: (delta) => { brush = { ...brush, radius: Math.max(1, Math.min(8, brush.radius + delta)) }; },
    configuration: {
      label: 'VE Proposal',
      adjustmentStep: currentStep,
      setAdjustmentStep: (value) => { step = value; },
      smoothStrength: () => smoothStrength,
      setSmoothStrength: (value) => { smoothStrength = value; },
      interpolation: () => interpolation,
      setInterpolation: (value) => { interpolation = { ...value, axis: 'both' }; },
      brush: () => brush,
      setBrush: (value) => { brush = value; },
      reset: resetTool,
    },
  }, {
    undo: () => surface.undo(),
    redo: () => surface.redo(),
    revertSelection: (positions) => surface.revert(positions),
    clearSelection: (positions) => surface.replaceWithUndefined(positions),
    blankSelection: (positions) => surface.replaceWithUndefined(positions),
    deleteSelection: (positions) => surface.replaceWithUndefined(positions),
    afterEdit: () => queueMicrotask(bind),
  });

  dom.toolbar.classList.add('ve-proposal-shared-toolbar');
  let evidencePosition: TableCellPosition | undefined;
  const rememberEvidencePosition = (event: PointerEvent): void => {
    const cell = event.target instanceof Element
      ? event.target.closest<HTMLTableCellElement>('td[data-ve-row][data-ve-col]')
      : null;
    if (!cell || !veHost.contains(cell)) return;
    const row = Number(cell.dataset.veRow);
    const col = Number(cell.dataset.veCol);
    if (Number.isInteger(row) && Number.isInteger(col)) evidencePosition = { row, col };
  };
  // Evidence selection is semantic and independent from editability. Alternate
  // Result Views remain read-only, but clicking a VE node still selects the node
  // that the explicit Cell Evidence action will inspect.
  veHost.addEventListener('pointerdown', rememberEvidencePosition, { capture: true, signal: events.signal });

  const evidence = document.createElement('button');
  evidence.type = 'button';
  evidence.innerHTML = VE_TABLE_TOOL_ICONS.cell;
  evidence.title = 'Cell Evidence';
  evidence.setAttribute('aria-label', 'Cell Evidence');
  evidence.addEventListener('click', () => {
    const position = evidencePosition ?? session.selectedPositions()[0];
    if (!position) {
      evidence.title = 'Select a VE cell to inspect its evidence';
      evidence.dispatchEvent(new CustomEvent('ve-cell-evidence-unavailable', { bubbles: true }));
      return;
    }
    const cell = veHost.querySelector<HTMLTableCellElement>(`td[data-ve-row="${position.row}"][data-ve-col="${position.col}"]`)
      ?? veHost.querySelector<HTMLTableCellElement>(`td[data-table-row="${position.row}"][data-table-col="${position.col}"]`);
    if (!cell) return;
    root.dispatchEvent(new CustomEvent('ve-cell-evidence-open', { bubbles: false, detail: { cell } }));
  }, { signal: events.signal });
  dom.toolbar.append(evidence);

  // Keep the edit toolbar outside the semantic selector host.
  const panelHeader = veHost.closest<HTMLElement>('.ve-workbench-panel')?.querySelector<HTMLElement>('header')
    ?? root.querySelector<HTMLElement>('.ve-workbench-panel header');
  panelHeader?.append(dom.toolbar);

  let boundRenderedTable: HTMLTableElement | undefined;
  let boundEditableTable: HTMLTableElement | undefined;
  const bind = (): void => {
    if (!active) return;
    previewDigits = owner.snapshot()?.digits;
    const renderedTable = veHost.querySelector<HTMLTableElement>('table.ve-workbench-table') ?? undefined;
    const pending = inner.getReadiness().pending;
    boundPending = pending;
    const table = pending ? undefined : currentProposalTable(veHost);
    boundRenderedTable = renderedTable;
    boundEditableTable = table;
    if (pending) dom.setBrushActive(false);
    dom.bindTable(table);
    setTableHistoryAvailability(dom.toolbar, surface);
    // Keep the explicit Evidence action available for alternate read-only result
    // views while hiding edit commands that would mutate proposal review values.
    for (const button of [...dom.toolbar.querySelectorAll<HTMLButtonElement>('button')]) {
      if (button !== evidence) {
        button.hidden = false;
        button.disabled = !table;
        button.title = pending ? 'Proposal editing is unavailable while analysis is running'
          : !table ? 'Editing applies to Proposed VE; switch Result View to Proposed VE' : button.getAttribute('aria-label') ?? '';
      }
    }
    evidence.hidden = !renderedTable;
    dom.toolbar.hidden = !renderedTable;
  };
  const observer = new MutationObserver((records) => {
    if (!active || (!records.some(record => record.type === 'attributes')
      && !hasAddedOrRemovedElement(records, 'table.ve-workbench-table'))) return;
    const rendered = veHost.querySelector<HTMLTableElement>('table.ve-workbench-table') ?? undefined;
    const editable = inner.getReadiness().pending ? undefined : currentProposalTable(veHost);
    // The synchronous render event may already have bound this exact table.
    if (rendered !== boundRenderedTable || editable !== boundEditableTable) bind();
  });
  const observe = (): void => observer.observe(veHost, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ve-result-view'] });
  root.addEventListener('ve-proposal-table-rendered', bind, { signal: events.signal });
  const unsubscribeReadiness = inner.onReadinessChange(() => {
    // Only the pending transition changes editability. Other readiness updates
    // must not add another whole-table refresh to their existing render paths.
    if (inner.getReadiness().pending !== boundPending) bind();
  });
  observe();
  bind();

  const resetInteraction = (): void => {
    dom.cancelActiveInteraction();
    dom.setBrushActive(false);
    session.clearSelection();
    session.clearPins();
    surface.resetHistory();
    evidencePosition = undefined;
    setTableHistoryAvailability(dom.toolbar, surface);
  };

  return {
    element: root,
    dispose() {
      if (disposed) return;
      disposed = true;
      events.abort();
      active = false; observer.disconnect(); unsubscribeReadiness(); dom.destroy(); surface.resetHistory();
      inner.dispose();
    },
    setActive(nextActive) { if (disposed) return;
      active = nextActive;
      if (!active) {
        dom.cancelActiveInteraction();
        dom.setBrushActive(false);
        observer.disconnect();
      }
      inner.setActive(active);
      if (active) {
        observe();
        queueMicrotask(bind);
      }
    },
    editDelayCells(positions, edit) { return inner.editDelayCells(positions, edit); },
    get sessionRevision() { return inner.sessionRevision; },
    getPrimaryAnalysis() { return inner.getPrimaryAnalysis(); },
    onPrimaryAnalysisChange(listener) { return inner.onPrimaryAnalysisChange(listener); },
    getReadiness() { return inner.getReadiness(); },
    onReadinessChange(listener) { return inner.onReadinessChange(listener); },
    setContext(context: LoggerAnalysisContext) {
      if (disposed) return false;
      const changed = inner.setContext(context);
      if (changed) {
        resetInteraction();
        queueMicrotask(bind);
      }
      return changed;
    },
    setTuneModel(model: TuneModel | undefined, sourceName?: string) {
      if (disposed) return false;
      const changed = inner.setTuneModel(model, sourceName);
      if (changed) {
        resetInteraction();
        queueMicrotask(bind);
      }
      return changed;
    },
    refresh() {
      if (disposed) return;
      inner.refresh();
      queueMicrotask(bind);
    },
  };
}
