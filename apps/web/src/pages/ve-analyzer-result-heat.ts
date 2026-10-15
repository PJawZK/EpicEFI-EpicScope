import {
  parseVeRenderedCellMetrics,
  veResultDisplay,
  type VeResultView,
} from './ve-analyzer-result-view';
import type { VeAnalyzerViewController } from './ve-analyzer-view-v9';

function finiteNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Alternate Result Views are overlays. Cells that do not have the selected
 * metric should remain visibly neutral rather than carrying Proposed VE heat
 * into an unrelated metric view. Proposed VE keeps the base VE heat, while
 * Lambda Delay keeps v7's interpolated range heat.
 */
export function veResultViewUsesNeutralFallback(
  title: string,
  current: number,
  view: VeResultView,
): boolean {
  if (view === 'proposal' || view === 'delay') return false;
  const metrics = parseVeRenderedCellMetrics(title, String(current));
  return veResultDisplay(metrics, view).scaleMode === 'base';
}

function applyFallbackHeat(root: HTMLElement): void {
  const select = root.querySelector<HTMLSelectElement>('select[aria-label="VE Analyzer result view"]');
  const table = root.querySelector<HTMLTableElement>('[data-ve-analyzer="ve-table-view"] .ve-workbench-table');
  if (!select || !table) return;

  const view = select.value as VeResultView;
  if (view === 'proposal' || view === 'delay') return;

  for (const cell of table.querySelectorAll<HTMLTableCellElement>('tbody td')) {
    const current = finiteNumber(cell.dataset.veCurrentValue);
    if (current === undefined) continue;
    if (veResultViewUsesNeutralFallback(cell.title, current, view)) {
      cell.style.setProperty('--ve-cell-level', '0.5');
    }
  }
}

/**
 * v7 remains the Result View owner. This small post-render policy restores the
 * pre-continuity visual contract for fallback heat without touching values,
 * evidence, delay interpolation, or retained-analysis authority.
 */
export function installVeAnalyzerResultHeat(inner: VeAnalyzerViewController): VeAnalyzerViewController {
  const root = inner.element;
  const select = root.querySelector<HTMLSelectElement>('select[aria-label="VE Analyzer result view"]');
  const veHost = root.querySelector<HTMLElement>('[data-ve-analyzer="ve-table-view"]');
  let queued = false;

  const schedule = (): void => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      applyFallbackHeat(root);
    });
  };

  select?.addEventListener('change', schedule);
  if (veHost) new MutationObserver(schedule).observe(veHost, { childList: true });
  schedule();
  return inner;
}
