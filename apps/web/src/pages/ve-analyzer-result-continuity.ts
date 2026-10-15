import type { TuneEntry, TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext } from './logger-page';
import {
  VE_RESULT_VIEW_OPTIONS,
  parseVeRenderedCellMetrics,
  veResultDisplay,
  type VeRenderedCellMetrics,
  type VeResultView,
} from './ve-analyzer-result-view';
import type { VeAnalyzerViewController } from './ve-analyzer-view-v9';

function finite(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function tableEntry(model: TuneModel | undefined, name: string): TuneEntry | undefined {
  const entry = model?.byName.get(name);
  return entry?.kind === 'table' && entry.numericValues !== undefined ? entry : undefined;
}

function axisValues(model: TuneModel | undefined, name: string): readonly number[] | undefined {
  return model?.byName.get(name)?.numericValues;
}

function rangeSignature(context: LoggerAnalysisContext): string {
  const traces = context.traces.map((trace) => {
    const times = trace.range.timeMs;
    const first = times.length > 0 ? times[0] : undefined;
    const last = times.length > 0 ? times[times.length - 1] : undefined;
    return [
      trace.channel.id,
      trace.range.startSampleIndex,
      trace.range.values.length,
      first ?? '',
      last ?? '',
      trace.complete ? 1 : 0,
    ].join(':');
  }).join('|');
  const channels = context.channels.map((channel) => channel.id).join('|');
  const savedRanges = context.savedRanges.map((range) => JSON.stringify(range)).join('|');
  return `${context.aTimeMs ?? ''};${context.bTimeMs ?? ''};${channels};${traces};${savedRanges}`;
}

/**
 * Logger focus/viewport changes do not alter VE analysis authority. Returning
 * from Logger must therefore not rebuild the analyzer unless its actual source
 * context changed (log/channel/range/A-B authority).
 */
export function sameVeAnalysisContext(left: LoggerAnalysisContext | undefined, right: LoggerAnalysisContext): boolean {
  return left !== undefined && rangeSignature(left) === rangeSignature(right);
}

export interface VeCanonicalCellText {
  readonly currentText: string;
  readonly proposalText?: string;
}

/** Preserve exactly what the authoritative VE renderer showed, including its precision. */
export function parseVeCanonicalCellText(renderedText: string): VeCanonicalCellText | undefined {
  const parts = renderedText.split('→').map((part) => part.trim());
  const currentText = parts[0];
  if (!currentText || finite(currentText) === undefined) return undefined;
  const proposalText = parts[1];
  return proposalText && finite(proposalText) !== undefined
    ? { currentText, proposalText }
    : { currentText };
}

function selectedCoordinates(
  root: HTMLElement,
  cell: HTMLTableCellElement,
  model: TuneModel | undefined,
): { row: number; col: number; current: number } | undefined {
  const table = cell.closest<HTMLTableElement>('table');
  const rowElement = cell.parentElement as HTMLTableRowElement | null;
  const header = table?.tHead?.rows[0];
  if (!table || !rowElement || !header) return undefined;

  const rpm = finite(header.cells[cell.cellIndex]?.textContent?.trim());
  const load = finite(rowElement.cells[0]?.textContent?.trim());
  if (rpm === undefined || load === undefined) return undefined;

  const veName = root.querySelector<HTMLSelectElement>('select[data-role="ve-table"]')?.value ?? '';
  const rpmAxisName = root.querySelector<HTMLSelectElement>('select[data-role="rpm-axis"]')?.value ?? '';
  const loadAxisName = root.querySelector<HTMLSelectElement>('select[data-role="load-axis"]')?.value ?? '';
  const entry = tableEntry(model, veName);
  const rpmBins = axisValues(model, rpmAxisName);
  const loadBins = axisValues(model, loadAxisName);
  if (!entry?.numericValues || !rpmBins || !loadBins) return undefined;

  const col = rpmBins.findIndex((value) => Math.abs(value - rpm) < 1e-9);
  const row = loadBins.findIndex((value) => Math.abs(value - load) < 1e-9);
  if (row < 0 || col < 0) return undefined;
  const current = entry.numericValues[row * entry.cols + col];
  if (current === undefined || !Number.isFinite(current)) return undefined;
  return { row, col, current };
}

export function veMetricsWithCanonicalCurrent(
  metrics: VeRenderedCellMetrics,
  current: number,
): VeRenderedCellMetrics {
  const candidate = metrics.state === 'measured' ? metrics.proposed : metrics.evidenceCandidate;
  return {
    ...metrics,
    current,
    changeValue: candidate === undefined ? undefined : candidate - current,
  };
}

function selectedResultView(root: HTMLElement): VeResultView {
  const value = root.querySelector<HTMLSelectElement>('select[aria-label="VE Analyzer result view"]')?.value;
  return VE_RESULT_VIEW_OPTIONS.some((option) => option.value === value) ? value as VeResultView : 'proposal';
}

function currentBaseScale(model: TuneModel | undefined, root: HTMLElement): { min: number; max: number } | undefined {
  const name = root.querySelector<HTMLSelectElement>('select[data-role="ve-table"]')?.value ?? '';
  const entry = tableEntry(model, name);
  const values = entry?.numericValues?.filter((value): value is number => value !== undefined && Number.isFinite(value));
  if (!values || values.length === 0) return undefined;
  return { min: Math.min(...values), max: Math.max(...values) };
}

function baseLevel(value: number, scale: { min: number; max: number } | undefined): number {
  if (!scale || scale.max === scale.min) return 0.5;
  return Math.max(0, Math.min(1, (value - scale.min) / (scale.max - scale.min)));
}

function cellKey(root: HTMLElement, cell: HTMLTableCellElement): string | undefined {
  const table = cell.closest<HTMLTableElement>('table');
  const row = cell.parentElement as HTMLTableRowElement | null;
  const header = table?.tHead?.rows[0];
  if (!table || !row || !header || cell.cellIndex <= 0) return undefined;
  const rpm = header.cells[cell.cellIndex]?.textContent?.trim();
  const load = row.cells[0]?.textContent?.trim();
  const veName = root.querySelector<HTMLSelectElement>('select[data-role="ve-table"]')?.value ?? '';
  return rpm && load ? `${veName}\u0000${load}\u0000${rpm}` : undefined;
}

/**
 * Keeps result-view rendering non-destructive. v7 remains the control/layout
 * owner; this layer only re-resolves displayed values from immutable tune data
 * after v7 has switched presentation.
 */
export function installVeAnalyzerResultContinuity(inner: VeAnalyzerViewController): VeAnalyzerViewController {
  const root = inner.element;
  const veHost = root.querySelector<HTMLElement>('[data-ve-analyzer="ve-table-view"]');
  const resultSelect = root.querySelector<HTMLSelectElement>('select[aria-label="VE Analyzer result view"]');
  const canonicalText = new Map<string, VeCanonicalCellText>();
  let tuneModel: TuneModel | undefined;
  let tuneSourceName: string | undefined;
  let previousContext: LoggerAnalysisContext | undefined;
  let sameContextForReentry = false;
  let suppressNextRefresh = false;
  let renderQueued = false;

  const captureCanonicalText = (clear = false): void => {
    const table = veHost?.querySelector<HTMLTableElement>('.ve-workbench-table');
    if (!table) return;
    if (clear) canonicalText.clear();
    for (const row of [...(table.tBodies[0]?.rows ?? [])]) {
      for (let index = 1; index < row.cells.length; index += 1) {
        const cell = row.cells[index] as HTMLTableCellElement;
        const main = cell.querySelector<HTMLElement>(':scope > span');
        const key = cellKey(root, cell);
        if (!main || !key) continue;
        const parsed = parseVeCanonicalCellText(main.textContent ?? '');
        if (!parsed) continue;
        const previous = canonicalText.get(key);
        canonicalText.set(key, {
          currentText: parsed.currentText,
          ...(parsed.proposalText ? { proposalText: parsed.proposalText } : previous?.proposalText ? { proposalText: previous.proposalText } : {}),
        });
        if (!cell.title.startsWith('Measured proposal') && !parsed.proposalText) {
          canonicalText.set(key, { currentText: parsed.currentText });
        }
      }
    }
  };

  const applyStablePresentation = (): void => {
    renderQueued = false;
    const table = veHost?.querySelector<HTMLTableElement>('.ve-workbench-table');
    if (!table || !tuneModel) return;
    const view = selectedResultView(root);
    const baseScale = currentBaseScale(tuneModel, root);
    const rendered: Array<{ cell: HTMLTableCellElement; value: number; mode: 'magnitude' | 'quality' | 'range' }> = [];

    for (const row of [...(table.tBodies[0]?.rows ?? [])]) {
      for (let index = 1; index < row.cells.length; index += 1) {
        const cell = row.cells[index] as HTMLTableCellElement;
        const main = cell.querySelector<HTMLElement>(':scope > span');
        if (!main) continue;
        const coordinates = selectedCoordinates(root, cell, tuneModel);
        const key = cellKey(root, cell);
        if (!coordinates || !key) continue;

        const parsed = parseVeRenderedCellMetrics(cell.title, '');
        const metrics = veMetricsWithCanonicalCurrent(parsed, coordinates.current);
        const v7DelayValue = view === 'delay' ? finite(cell.dataset.veResultValue) : undefined;
        const display = veResultDisplay(metrics, view, v7DelayValue);
        const canonical = canonicalText.get(key);

        if (view === 'proposal') {
          const exactText = metrics.state === 'measured'
            ? canonical?.proposalText
            : canonical?.currentText;
          main.textContent = exactText ?? display.text;
          cell.dataset.veResultValue = display.numericValue === undefined ? String(coordinates.current) : String(display.numericValue);
          delete cell.dataset.veResultFallback;
          cell.classList.remove('ve-result-missing');
          cell.style.setProperty('--ve-cell-level', String(baseLevel(coordinates.current, baseScale)));
          continue;
        }

        if (display.numericValue === undefined) {
          // Alternate views are overlays. A cell without that metric still
          // shows the exact immutable source VE text instead of a rounded none/fallback.
          main.textContent = canonical?.currentText ?? String(coordinates.current);
          cell.dataset.veResultValue = String(coordinates.current);
          cell.dataset.veResultFallback = 'base-ve';
          cell.classList.remove('ve-result-missing');
          cell.style.setProperty('--ve-cell-level', String(baseLevel(coordinates.current, baseScale)));
          continue;
        }

        main.textContent = display.text;
        cell.dataset.veResultValue = String(display.numericValue);
        delete cell.dataset.veResultFallback;
        cell.classList.remove('ve-result-missing');
        if (display.scaleMode !== 'base') {
          rendered.push({ cell, value: display.numericValue, mode: display.scaleMode });
        }
      }
    }

    if (view === 'proposal' || rendered.length === 0) return;
    const values = rendered.map((entry) => entry.value).filter(Number.isFinite);
    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 1;
    const maxMagnitude = values.length > 0 ? Math.max(...values.map((value) => Math.abs(value))) : 1;
    for (const entry of rendered) {
      let level = 0.5;
      if (entry.mode === 'magnitude') level = maxMagnitude > 0 ? Math.abs(entry.value) / maxMagnitude : 0;
      else {
        const normalized = max > min ? (entry.value - min) / (max - min) : 1;
        level = entry.mode === 'quality' ? 1 - normalized : normalized;
      }
      entry.cell.style.setProperty('--ve-cell-level', String(Math.max(0, Math.min(1, level))));
    }
  };

  const scheduleStablePresentation = (): void => {
    if (renderQueued) return;
    renderQueued = true;
    queueMicrotask(applyStablePresentation);
  };

  resultSelect?.addEventListener('change', scheduleStablePresentation);
  if (veHost) {
    new MutationObserver(() => {
      // Direct children change only when the authoritative table renderer replaces
      // the table. Capture its exact text before continuity overlays are reapplied.
      captureCanonicalText();
      scheduleStablePresentation();
    }).observe(veHost, { childList: true });
  }

  return {
    element: root,
    setContext(next) {
      const same = sameVeAnalysisContext(previousContext, next);
      previousContext = next;
      sameContextForReentry = same;
      suppressNextRefresh = false;
      if (same) {
        scheduleStablePresentation();
        return;
      }
      canonicalText.clear();
      inner.setContext(next);
      captureCanonicalText();
      scheduleStablePresentation();
    },
    setTuneModel(model, sourceName) {
      const sameTune = model === tuneModel && sourceName === tuneSourceName;
      tuneModel = model;
      tuneSourceName = sourceName;
      if (sameTune) {
        // app-shell calls setContext -> setTuneModel -> refresh whenever Analyzer
        // is reopened. Suppress only that redundant final refresh.
        suppressNextRefresh = sameContextForReentry;
        scheduleStablePresentation();
        return;
      }
      suppressNextRefresh = false;
      canonicalText.clear();
      inner.setTuneModel(model, sourceName);
      captureCanonicalText();
      scheduleStablePresentation();
    },
    refresh() {
      if (suppressNextRefresh) {
        suppressNextRefresh = false;
        sameContextForReentry = false;
        scheduleStablePresentation();
        return;
      }
      inner.refresh();
      captureCanonicalText();
      sameContextForReentry = false;
      scheduleStablePresentation();
    },
  };
}
