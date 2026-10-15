import type { TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext } from './logger-page';
import { sameVeAnalysisContext } from './ve-analyzer-session-retention';
import {
  createVeAnalyzerView as createVeAnalyzerViewV9,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v9';

function formatTuneValue(value: number, digits?: number): string {
  if (!Number.isFinite(value)) return '—';
  const precision = Math.max(0, Math.min(6, digits ?? (Math.abs(value) < 20 ? 2 : 1)));
  return value.toFixed(precision).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

export function createVeAnalyzerView(): VeAnalyzerViewController {
  const inner = createVeAnalyzerViewV9();
  const root = inner.element;
  const veHost = root.querySelector<HTMLElement>('[data-ve-analyzer="ve-table-view"]');
  const resultView = root.querySelector<HTMLSelectElement>('[aria-label="VE Analyzer result view"]');
  const veSelect = root.querySelector<HTMLSelectElement>('select[data-role="ve-table"]');
  const stage = root.querySelector<HTMLElement>('[data-ve-analyzer="stage"]');

  let lastContext: LoggerAnalysisContext | undefined;
  let lastTuneModel: TuneModel | undefined;
  let lastTuneSourceName: string | undefined;

  const hasCalculatedSession = (): boolean => /Guarded VE proposal calculated/i.test(stage?.textContent ?? '');

  // Result View is presentation only. v7 intentionally rewrites cell text for
  // alternate views, so restore the authoritative current value straight from
  // the loaded tune before v7 parses/render the next view. This avoids using a
  // previous overlay (Samples/Change/etc.) as input and guarantees untouched
  // cells always come from the original veTable value.
  const restoreCurrentVeValues = (): void => {
    if (!veHost || !veSelect || !lastTuneModel) return;
    const entry = lastTuneModel.byName.get(veSelect.value);
    if (!entry || entry.kind !== 'table' || !entry.numericValues) return;
    const table = veHost.querySelector<HTMLTableElement>('.ve-workbench-table');
    const body = table?.tBodies[0];
    if (!body) return;

    for (let row = 0; row < body.rows.length && row < entry.rows; row += 1) {
      const rowElement = body.rows[row]!;
      for (let col = 1; col < rowElement.cells.length && col <= entry.cols; col += 1) {
        const value = entry.numericValues[row * entry.cols + (col - 1)];
        const main = (rowElement.cells[col] as HTMLTableCellElement | undefined)?.querySelector<HTMLElement>(':scope > span');
        if (!main) continue;
        main.textContent = value !== undefined && Number.isFinite(value) ? formatTuneValue(value, entry.digits) : '—';
      }
    }
  };

  resultView?.addEventListener('change', restoreCurrentVeValues, { capture: true });

  return {
    element: root,
    setContext(context: LoggerAnalysisContext) {
      const sameAnalysisContext = sameVeAnalysisContext(lastContext, context);
      lastContext = context;
      if (!sameAnalysisContext) inner.setContext(context);
    },
    setTuneModel(model: TuneModel | undefined, sourceName?: string) {
      const sameTune = lastTuneModel === model && lastTuneSourceName === sourceName;
      lastTuneModel = model;
      lastTuneSourceName = sourceName;
      if (!sameTune) inner.setTuneModel(model, sourceName);
    },
    refresh() {
      // App-shell refreshes Analyzer whenever the user returns from Logger.
      // If no invalidating lifecycle setter ran and a calculated VE session is
      // still present, refreshing is presentation-only work and must not risk
      // replacing that reviewed session. Real context/tune changes already flow
      // through the setters above and rebuild before this point.
      if (hasCalculatedSession()) return;
      inner.refresh();
    },
  };
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
