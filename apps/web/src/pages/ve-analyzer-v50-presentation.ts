import type { LoggerAnalysisContext } from './logger-page';
import type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
import '../styles/ve-analyzer-v50-port.css';

const TABLE_LAYOUT_STORAGE_KEY = 'epicscope.veAnalyzer.tableLayout';

function finiteTimes(context: LoggerAnalysisContext): number[] {
  const times: number[] = [];
  for (const trace of context.traces) {
    const range = trace.range;
    if (range.timeMs.length === 0) continue;
    const first = range.timeMs[0];
    const last = range.timeMs[range.timeMs.length - 1];
    if (first !== undefined && Number.isFinite(first)) times.push(first);
    if (last !== undefined && Number.isFinite(last)) times.push(last);
  }
  return times;
}

function formatScopeTime(timeMs: number | undefined): string {
  if (timeMs === undefined || !Number.isFinite(timeMs)) return '--:--';
  const seconds = Math.max(0, Math.round(timeMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

/**
 * First production slice of the frozen v50 presentation contract.
 *
 * This layer intentionally owns presentation only. It does not replace VE analysis,
 * table/result authority, Lambda Delay authority, readiness, persistence or Logger.
 * It may be removed/rebased after the post-Codex architecture audit without losing
 * any domain state.
 */
export function installVeAnalyzerV50Presentation(inner: VeAnalyzerViewController): VeAnalyzerViewController {
  const root = inner.element;
  root.classList.add('ve-v50-port');

  const workbench = root.querySelector<HTMLElement>('.ve-workbench');
  const quickControls = root.querySelector<HTMLElement>('.ve-workbench-quick-controls');
  const actionbar = root.querySelector<HTMLElement>('.ve-workbench-actionbar');

  // v50's visual hierarchy is table -> scope -> setup -> readiness/action.
  // Preserve the existing nodes and listeners; only change their presentation order.
  if (quickControls && actionbar && quickControls.nextElementSibling !== actionbar) {
    actionbar.parentElement?.insertBefore(quickControls, actionbar);
  }

  // New users start in the v50 single-table presentation. Existing user preference
  // remains authoritative and is not overwritten.
  if (workbench) {
    try {
      if (localStorage.getItem(TABLE_LAYOUT_STORAGE_KEY) === null) {
        const layout = root.querySelector<HTMLSelectElement>('select[aria-label="VE Analyzer table view"]');
        if (layout && layout.value !== 'single') {
          layout.value = 'single';
          layout.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    } catch {
      // Restricted storage must not prevent the page from rendering.
    }
  }

  const scope = document.createElement('section');
  scope.className = 've-analysis-scope-navigator';
  scope.setAttribute('aria-label', 'VE analysis scope overview');
  scope.innerHTML = `
    <div class="ve-analysis-scope-main">
      <div class="ve-analysis-scope-meta">
        <span><strong data-ve-scope-label>Full Log</strong><span data-ve-scope-detail> · source extent</span></span>
        <span><span data-ve-scope-start>--:--</span> — <span data-ve-scope-end>--:--</span></span>
      </div>
      <div class="ve-analysis-scope-strip" data-ve-scope-strip>
        <div class="ve-analysis-scope-range" data-ve-scope-range></div>
        <div class="ve-analysis-scope-marker ve-analysis-scope-marker-a" data-ve-scope-a hidden></div>
        <div class="ve-analysis-scope-marker ve-analysis-scope-marker-b" data-ve-scope-b hidden></div>
      </div>
    </div>`;

  if (workbench?.parentElement) workbench.insertAdjacentElement('afterend', scope);

  const scopeLabel = scope.querySelector<HTMLElement>('[data-ve-scope-label]')!;
  const scopeDetail = scope.querySelector<HTMLElement>('[data-ve-scope-detail]')!;
  const scopeStart = scope.querySelector<HTMLElement>('[data-ve-scope-start]')!;
  const scopeEnd = scope.querySelector<HTMLElement>('[data-ve-scope-end]')!;
  const scopeRange = scope.querySelector<HTMLElement>('[data-ve-scope-range]')!;
  const markerA = scope.querySelector<HTMLElement>('[data-ve-scope-a]')!;
  const markerB = scope.querySelector<HTMLElement>('[data-ve-scope-b]')!;

  const renderScope = (context: LoggerAnalysisContext): void => {
    const times = finiteTimes(context);
    if (times.length === 0) {
      scope.dataset.state = 'empty';
      scopeLabel.textContent = 'Full Log';
      scopeDetail.textContent = ' · source extent unavailable';
      scopeStart.textContent = '--:--';
      scopeEnd.textContent = '--:--';
      scopeRange.style.left = '0%';
      scopeRange.style.width = '100%';
      markerA.hidden = true;
      markerB.hidden = true;
      return;
    }

    const start = Math.min(...times);
    const end = Math.max(...times);
    const span = Math.max(1, end - start);
    const a = context.aTimeMs;
    const b = context.bTimeMs;
    const hasAB = a !== undefined && b !== undefined && Number.isFinite(a) && Number.isFinite(b);
    const selectedStart = hasAB ? Math.min(a, b) : start;
    const selectedEnd = hasAB ? Math.max(a, b) : end;
    const left = Math.max(0, Math.min(100, ((selectedStart - start) / span) * 100));
    const right = Math.max(left, Math.min(100, ((selectedEnd - start) / span) * 100));

    scope.dataset.state = hasAB ? 'ab' : 'full';
    scopeLabel.textContent = hasAB ? 'Current A/B' : 'Full Log';
    scopeDetail.textContent = hasAB ? ` · ${formatScopeTime(selectedStart)}–${formatScopeTime(selectedEnd)}` : ' · entire available source';
    scopeStart.textContent = formatScopeTime(start);
    scopeEnd.textContent = formatScopeTime(end);
    scopeRange.style.left = `${left}%`;
    scopeRange.style.width = `${Math.max(0.2, right - left)}%`;

    const placeMarker = (node: HTMLElement, value: number | undefined): void => {
      node.hidden = value === undefined || !Number.isFinite(value);
      if (!node.hidden) node.style.left = `${Math.max(0, Math.min(100, ((value! - start) / span) * 100))}%`;
    };
    placeMarker(markerA, a);
    placeMarker(markerB, b);
  };

  return {
    element: root,
    setActive(active) { inner.setActive(active); },
    editDelayCells(positions, edit) { return inner.editDelayCells(positions, edit); },
    get sessionRevision() { return inner.sessionRevision; },
    getPrimaryAnalysis() { return inner.getPrimaryAnalysis(); },
    onPrimaryAnalysisChange(listener) { return inner.onPrimaryAnalysisChange(listener); },
    setContext(context: LoggerAnalysisContext) {
      const changed = inner.setContext(context);
      renderScope(context);
      return changed;
    },
    setTuneModel(model, sourceName) { return inner.setTuneModel(model, sourceName); },
    refresh() { inner.refresh(); },
  };
}
