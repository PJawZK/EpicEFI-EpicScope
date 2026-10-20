import { TableEditHistorySurface } from './ve-table-edit-history';
import { setTableHistoryAvailability } from './ve-table-toolbar-availability';
import { veDelayPresentationOwner } from './ve-analyzer-delay-presentation-owner';
import type { TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext } from './logger-page';
import { veDelayEditOwner, type VeDelayCellValueEdit, type VeDelayEditOwner, type VeDelayEditSnapshot } from './ve-analyzer-delay-edit-owner';
import { createTableInteractionDomController, hasAddedOrRemovedElement } from './ve-table-interaction-dom';
import { TableInteractionSession, type TableCellPosition } from './ve-table-interaction';
import type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
import {
  brushOptions,
  interpolationOptions,
  loadVeTableToolPreferences,
  resetVeTableToolPreferences,
  saveVeTableToolPreferences,
  type VeTableToolPreferences,
} from '../state/ve-table-tool-preferences';
import '../styles/ve-table-interaction-dom.css';

class VeDelayTableEditSurface extends TableEditHistorySurface<VeDelayEditSnapshot, VeDelayCellValueEdit> {
  #baseline: readonly (number | undefined)[] | undefined;
  #baselineRows = 0;
  #baselineCols = 0;

  constructor(owner: VeDelayEditOwner) {
    super({
      snapshot: () => owner.snapshot(),
      applyValues: edits => owner.applyValues(edits),
      revert: positions => owner.revert(positions),
      normalizeValue: (value, label) => label === 'direct-edit' && value < 0 ? undefined : Math.max(0, value),
      createEdit: ({ row, col }, value) => ({ row, col, workingMs: value }),
      editValue: edit => edit.workingMs,
    });
  }

  presentationSnapshot() {
    const snapshot = this.synchronizeHistory();
    if (!snapshot) return undefined;
    if (!this.#baseline || this.#baselineRows !== snapshot.rows || this.#baselineCols !== snapshot.cols) {
      this.#baseline = [...snapshot.values];
      this.#baselineRows = snapshot.rows;
      this.#baselineCols = snapshot.cols;
    }
    return { ...snapshot, baselineValues: this.#baseline };
  }

  baselineValueAt(position: TableCellPosition): number | undefined {
    const snapshot = this.presentationSnapshot();
    if (!snapshot || position.row < 0 || position.row >= snapshot.rows || position.col < 0 || position.col >= snapshot.cols) return undefined;
    return snapshot.baselineValues[position.row * snapshot.cols + position.col];
  }

  resetBaseline(): void {
    this.#baseline = undefined;
    this.#baselineRows = 0;
    this.#baselineCols = 0;
  }

  protected override authorityReplaced(): void { this.resetBaseline(); }
}

function currentDelayTable(host: HTMLElement): HTMLTableElement | undefined {
  return host.querySelector<HTMLTableElement>('table.ve-delay-table') ?? undefined;
}

/**
 * Bind the production Lambda Delay owner to the shared v50 table interaction stack.
 *
 * Values come only from the semantic owner registered by the base VE controller.
 * The rendered table is used solely for hit-testing/focus/decoration. One shared
 * interaction transaction becomes one owner applyValues() call and one VE session
 * invalidation, including Brush strokes and interpolation. Fractional working
 * values remain semantic authority; presentation may round them without changing
 * the retained working value.
 */
export function installVeAnalyzerDelayTableInteraction(inner: VeAnalyzerViewController): VeAnalyzerViewController {
  const root = inner.element;
  let disposed = false;
  const events = new AbortController();
  const owner = veDelayEditOwner(root);
  const delayHost = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-table"]');
  if (!owner || !delayHost) return inner;

  delayHost.dataset.tableInteractionOwner = 'shared';
  const legacyEditor = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-editor"]');
  if (legacyEditor) legacyEditor.hidden = true;
  delayHost.addEventListener('click', (event) => {
    if (!(event.target instanceof Element) || !event.target.closest('td[data-delay-row][data-delay-col]')) return;
    event.preventDefault();
    event.stopPropagation();
  }, { capture: true, signal: events.signal });

  const surface = new VeDelayTableEditSurface(owner);
  const session = new TableInteractionSession(surface);
  let toolPreferences = loadVeTableToolPreferences('delay');
  const saveToolPreferences = (next: VeTableToolPreferences): void => {
    toolPreferences = saveVeTableToolPreferences('delay', next);
  };
  const resetToolPreference = (kind: 'step' | 'smooth' | 'interpolation' | 'brush'): void => {
    const defaults = resetVeTableToolPreferences('delay');
    if (kind === 'step') saveToolPreferences({ ...toolPreferences, adjustmentStep: defaults.adjustmentStep });
    else if (kind === 'smooth') saveToolPreferences({ ...toolPreferences, smoothStrength: defaults.smoothStrength });
    else if (kind === 'interpolation') saveToolPreferences({ ...toolPreferences, interpolation: defaults.interpolation });
    else saveToolPreferences({ ...toolPreferences, brush: defaults.brush });
  };
  const dom = createTableInteractionDomController(session, {
    adjustmentStep: () => toolPreferences.adjustmentStep,
    smoothStrength: () => toolPreferences.smoothStrength,
    interpolation: () => interpolationOptions(toolPreferences, 'both'),
    brush: () => brushOptions(toolPreferences),
    readValue: (position) => surface.valueAt(position),
    baselineValue: (position) => surface.baselineValueAt(position),
    readValues: () => surface.presentationSnapshot(),
    formatPreviewValue: (_position, value) => String(Math.round(value)),
    adjustBrushRadius: (delta) => saveToolPreferences({
      ...toolPreferences,
      brush: { ...toolPreferences.brush, radius: Math.max(1, Math.min(8, toolPreferences.brush.radius + delta)) },
    }),
    configuration: {
      label: 'Lambda Delay',
      adjustmentStep: () => toolPreferences.adjustmentStep,
      setAdjustmentStep: (value) => saveToolPreferences({ ...toolPreferences, adjustmentStep: value }),
      smoothStrength: () => toolPreferences.smoothStrength,
      setSmoothStrength: (value) => saveToolPreferences({ ...toolPreferences, smoothStrength: value }),
      interpolation: () => interpolationOptions(toolPreferences, 'both'),
      setInterpolation: (value) => saveToolPreferences({
        ...toolPreferences,
        interpolation: {
          method1d: value.method1d ?? toolPreferences.interpolation.method1d,
          method2d: value.method2d ?? toolPreferences.interpolation.method2d,
          strength: value.strength ?? toolPreferences.interpolation.strength,
          clamp: value.clamp ?? toolPreferences.interpolation.clamp,
        },
      }),
      brush: () => brushOptions(toolPreferences),
      setBrush: (value) => saveToolPreferences({
        ...toolPreferences,
        brush: {
          delta: value.delta,
          radius: value.radius,
          strength: value.strength ?? toolPreferences.brush.strength,
          falloff: value.falloff ?? toolPreferences.brush.falloff,
        },
      }),
      reset: resetToolPreference,
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

  dom.toolbar.classList.add('ve-delay-shared-toolbar');
  delayHost.insertAdjacentElement('beforebegin', dom.toolbar);

  let active = true;
  let boundTable: HTMLTableElement | undefined;
  const bind = (): void => {
    if (disposed) return;
    boundTable = active && veDelayPresentationOwner(root)?.visible !== false ? currentDelayTable(delayHost) : undefined;
    dom.bindTable(boundTable);
    setTableHistoryAvailability(dom.toolbar, surface);
  };
  const resetInteractionSession = (): void => {
    dom.cancelActiveInteraction();
    dom.setBrushActive(false);
    session.clearSelection();
    session.clearPins();
    surface.resetHistory();
    surface.resetBaseline();
    setTableHistoryAvailability(dom.toolbar, surface);
  };
  const observer = new MutationObserver((records) => {
    if (active && hasAddedOrRemovedElement(records, 'table.ve-delay-table') && currentDelayTable(delayHost) !== boundTable) bind();
  });
  // Existing fallback follows real table replacement, not preview text. The
  // tool visibility boundary binds revealed tables synchronously and unbinds
  // hidden tables without withdrawing their semantic working authority.
  const observe = (): void => observer.observe(delayHost, { childList: true, subtree: true });
  observe();
  root.addEventListener('ve-delay-table-visibility-changed', () => {
    if (veDelayPresentationOwner(root)?.visible === false) dom.setBrushActive(false);
    bind();
  }, { signal: events.signal });

  root.querySelector<HTMLButtonElement>('[data-ve-analyzer="grab-delay"]')
    ?.addEventListener('click', () => dom.cancelActiveInteraction(), { capture: true, signal: events.signal });
  root.querySelector<HTMLButtonElement>('[data-ve-analyzer="use-delay"]')
    ?.addEventListener('click', resetInteractionSession, { capture: true, signal: events.signal });
  // The loading owner notifies only after parsing/validation and stale-load
  // checks accept a replacement. Picker changes and rejected reads must not
  // destroy the current draft, selection, pins or history.
  root.addEventListener('ve-delay-file-accepted', resetInteractionSession, { signal: events.signal });
  bind();

  return {
    element: root,
    dispose() {
      if (disposed) return;
      disposed = true;
      events.abort();
      active = false; observer.disconnect(); dom.destroy(); surface.resetHistory(); surface.resetBaseline();
      inner.dispose();
    },
    setActive(nextActive) { if (disposed) return;
      active = nextActive;
      if (!active) {
        dom.cancelActiveInteraction();
        dom.setBrushActive(false);
        observer.disconnect();
        bind();
      }
      inner.setActive(active);
      if (active) {
        observe();
        queueMicrotask(bind);
      }
    },
    editDelayCells(positions, edit) {
      dom.cancelActiveInteraction();
      const changed = inner.editDelayCells(positions, edit);
      if (changed) {
        surface.resetHistory();
        queueMicrotask(bind);
      }
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
      if (changed) {
        resetInteractionSession();
        queueMicrotask(bind);
      }
      return changed;
    },
    setTuneModel(model: TuneModel | undefined, sourceName?: string) {
      if (disposed) return false;
      const changed = inner.setTuneModel(model, sourceName);
      if (changed) {
        resetInteractionSession();
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