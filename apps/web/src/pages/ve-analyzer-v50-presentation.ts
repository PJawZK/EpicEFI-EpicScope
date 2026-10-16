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

function selectedText(control: HTMLSelectElement | null | undefined, fallback = 'Auto'): string {
  return control?.selectedOptions[0]?.textContent?.trim() || fallback;
}

function inputText(control: HTMLInputElement | null | undefined, fallback = 'Full'): string {
  return control?.value.trim() || fallback;
}

function shortText(value: string, max = 28): string {
  return value.length <= max ? value : `${value.slice(0, Math.max(1, max - 1))}…`;
}

interface SetupGroup {
  readonly details: HTMLDetailsElement;
  readonly body: HTMLElement;
  readonly summaryValue: HTMLElement;
}

function createSetupGroup(id: string, title: string): SetupGroup {
  const details = document.createElement('details');
  details.className = 've-v50-setup-group';
  details.dataset.veV50Setup = id;

  const summary = document.createElement('summary');
  const label = document.createElement('strong');
  label.textContent = title;
  const value = document.createElement('span');
  value.dataset.veV50Summary = id;
  summary.append(label, value);

  const body = document.createElement('div');
  body.className = 've-v50-setup-body';
  details.append(summary, body);
  return { details, body, summaryValue: value };
}

function labelFor(root: HTMLElement, selector: string): HTMLLabelElement | undefined {
  return root.querySelector<HTMLElement>(selector)?.closest<HTMLLabelElement>('label') ?? undefined;
}

function moveLabel(body: HTMLElement, label: HTMLLabelElement | undefined): void {
  if (label) body.append(label);
}

/**
 * First production slices of the frozen v50 presentation contract.
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

  const setupGroups = new Map<string, SetupGroup>();
  let syncSetupSummaries = (): void => {};
  const scheduleSetupSummaries = (): void => queueMicrotask(syncSetupSummaries);

  // Slice 2: collapse the existing production controls into the v50 compact setup
  // vocabulary. Controls are moved, not cloned, so all current listeners/state owners
  // remain authoritative. Native <details> provides disclosure without a parallel
  // popup/window framework.
  if (quickControls) {
    const qualification = createSetupGroup('qualification', 'Qualification');
    const scopeGroup = createSetupGroup('scope', 'Scope');
    const range = createSetupGroup('range', 'Operating Range');
    const guards = createSetupGroup('guards', 'Guards');
    const cellChange = createSetupGroup('cell-change', 'Cell Change');
    const mixture = createSetupGroup('mixture', 'Mixture');
    for (const group of [qualification, scopeGroup, range, guards, cellChange, mixture]) {
      setupGroups.set(group.details.dataset.veV50Setup!, group);
    }

    moveLabel(qualification.body, labelFor(root, 'select[data-role="preset"]'));
    moveLabel(qualification.body, labelFor(root, 'select[data-ve-quick="clt-source"]'));
    moveLabel(qualification.body, labelFor(root, 'input[data-ve-quick="min-clt"]'));
    moveLabel(qualification.body, labelFor(root, 'select[data-ve-quick="tps-source"]'));
    moveLabel(qualification.body, labelFor(root, 'input[data-ve-quick="min-tps"]'));
    moveLabel(qualification.body, labelFor(root, 'input[data-ve-quick="max-tps"]'));
    const qualificationNote = root.querySelector<HTMLElement>('.ve-quick-qualification-note');
    if (qualificationNote) qualification.body.append(qualificationNote);
    root.querySelector<HTMLElement>('.ve-quick-qualification')?.remove();

    moveLabel(scopeGroup.body, labelFor(root, 'select[data-role="scope"]'));

    for (const role of ['min-rpm', 'max-rpm', 'min-load', 'max-load'] as const) {
      moveLabel(range.body, labelFor(root, `input[data-role="${role}"]`));
    }

    moveLabel(guards.body, labelFor(root, 'input[data-role="stable-ms"]'));
    moveLabel(guards.body, labelFor(root, 'input[data-role="min-evidence-weight"]'));

    moveLabel(cellChange.body, labelFor(root, 'select[data-ve-quick="cell-change"]'));
    moveLabel(cellChange.body, labelFor(root, 'input[data-role="prior-weight"]'));
    moveLabel(cellChange.body, labelFor(root, 'input[data-role="max-absolute-change"]'));
    moveLabel(cellChange.body, labelFor(root, 'input[data-role="max-percent-change"]'));

    moveLabel(mixture.body, labelFor(root, 'select[data-role="mixture-scale"]'));
    moveLabel(mixture.body, labelFor(root, 'select[data-role="actual"]'));
    moveLabel(mixture.body, labelFor(root, 'select[data-role="stft"]'));
    moveLabel(mixture.body, labelFor(root, 'select[data-role="fuel-correction-mode"]'));

    const leftovers = [...quickControls.children];
    const extra = leftovers.length > 0 ? createSetupGroup('additional', 'Additional') : undefined;
    if (extra) {
      for (const child of leftovers) extra.body.append(child);
      setupGroups.set('additional', extra);
    }

    quickControls.replaceChildren(
      qualification.details,
      scopeGroup.details,
      range.details,
      guards.details,
      cellChange.details,
      mixture.details,
      ...(extra ? [extra.details] : []),
    );

    const advanced = root.querySelector<HTMLDetailsElement>('.ve-workbench-advanced');
    if (advanced) {
      const advancedButton = document.createElement('button');
      advancedButton.type = 'button';
      advancedButton.className = 've-v50-advanced-button';
      advancedButton.textContent = 'Advanced';
      advancedButton.addEventListener('click', () => {
        advanced.open = true;
        advanced.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
      quickControls.append(advancedButton);
    }

    syncSetupSummaries = (): void => {
      const summary = (id: string, text: string): void => {
        const node = setupGroups.get(id)?.summaryValue;
        if (node) node.textContent = text;
      };

      summary('qualification', selectedText(root.querySelector<HTMLSelectElement>('select[data-role="preset"]'), 'Recommended'));
      summary('scope', selectedText(root.querySelector<HTMLSelectElement>('select[data-role="scope"]'), 'Full Log'));

      const minRpm = inputText(root.querySelector<HTMLInputElement>('input[data-role="min-rpm"]'));
      const maxRpm = inputText(root.querySelector<HTMLInputElement>('input[data-role="max-rpm"]'));
      const minLoad = inputText(root.querySelector<HTMLInputElement>('input[data-role="min-load"]'));
      const maxLoad = inputText(root.querySelector<HTMLInputElement>('input[data-role="max-load"]'));
      summary('range', `RPM ${minRpm}–${maxRpm} · Load ${minLoad}–${maxLoad}`);

      const stable = inputText(root.querySelector<HTMLInputElement>('input[data-role="stable-ms"]'), '0');
      const evidence = inputText(root.querySelector<HTMLInputElement>('input[data-role="min-evidence-weight"]'), '0');
      summary('guards', `Stable ${stable} ms · Evidence ≥${evidence}`);

      const authority = selectedText(root.querySelector<HTMLSelectElement>('select[data-ve-quick="cell-change"]'), 'Normal');
      const maxAbs = inputText(root.querySelector<HTMLInputElement>('input[data-role="max-absolute-change"]'), '—');
      const maxPct = inputText(root.querySelector<HTMLInputElement>('input[data-role="max-percent-change"]'), '—');
      summary('cell-change', `${authority} · ±${maxAbs} / ${maxPct}%`);

      const scale = selectedText(root.querySelector<HTMLSelectElement>('select[data-role="mixture-scale"]'), 'AFR');
      const actual = shortText(selectedText(root.querySelector<HTMLSelectElement>('select[data-role="actual"]'), 'Auto'));
      const fuelMode = root.querySelector<HTMLSelectElement>('select[data-role="fuel-correction-mode"]')?.value ?? 'auto';
      const fuel = fuelMode === 'off' ? 'Context' : fuelMode === 'percent' ? 'STFT %' : 'STFT Auto';
      summary('mixture', `${scale} · ${actual} · ${fuel}`);
    };

    root.addEventListener('change', syncSetupSummaries);
    root.addEventListener('input', syncSetupSummaries);
    scheduleSetupSummaries();
  }

  return {
    element: root,
    setActive(active) {
      inner.setActive(active);
      if (active) scheduleSetupSummaries();
    },
    editDelayCells(positions, edit) {
      const changed = inner.editDelayCells(positions, edit);
      scheduleSetupSummaries();
      return changed;
    },
    get sessionRevision() { return inner.sessionRevision; },
    getPrimaryAnalysis() { return inner.getPrimaryAnalysis(); },
    onPrimaryAnalysisChange(listener) { return inner.onPrimaryAnalysisChange(listener); },
    getReadiness() { return inner.getReadiness(); },
    onReadinessChange(listener) { return inner.onReadinessChange(listener); },
    setContext(context: LoggerAnalysisContext) {
      const changed = inner.setContext(context);
      renderScope(context);
      scheduleSetupSummaries();
      return changed;
    },
    setTuneModel(model, sourceName) {
      const changed = inner.setTuneModel(model, sourceName);
      scheduleSetupSummaries();
      return changed;
    },
    refresh() {
      inner.refresh();
      scheduleSetupSummaries();
    },
  };
}
