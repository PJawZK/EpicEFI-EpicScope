import { closeVeAnalyzerSetupDisclosures } from './ve-analyzer-v50-setup-disclosure';
import type { LoggerAnalysisContext } from './logger-page';
import { analyzerScopeBounds, analyzerScopeOptions, selectedAnalyzerScope } from './analyzer-scope';
import type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
import '../styles/ve-analyzer-v50-port.css';

const TABLE_LAYOUT_STORAGE_KEY = 'epicscope.veAnalyzer.tableLayout';

function formatScopeTime(timeMs: number | undefined): string {
  if (timeMs === undefined || !Number.isFinite(timeMs)) return '--:--';
  const seconds = Math.max(0, Math.round(timeMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
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
  let disposed = false;
  const events = new AbortController();
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
      <button type="button" class="ve-analysis-scope-strip ve-timeline-choice" data-ve-scope-strip data-ve-timeline-scope="full" aria-label="Full Log" aria-pressed="true">
        <span class="ve-timeline-label">Full Log</span>
        <span class="ve-timeline-lane">
        <span class="ve-analysis-scope-range ve-timeline-band" data-scope-kind="full" data-ve-scope-range></span>
        </span>
      </button>
      <div class="ve-timeline-choice ve-timeline-edit-row">
        <button type="button" class="ve-timeline-label" data-ve-timeline-scope="ab" disabled>Selected Range (A–B)</button>
        <div class="ve-timeline-lane ve-timeline-edit-track" data-ve-range-track aria-label="Select VE analysis range" title="Drag to select; Shift-drag replaces any range. Drag A/B to adjust or the band to move. Focus A/B and use arrows (Shift for fine steps), Home or End.">
          <span class="ve-timeline-band" data-scope-kind="ab" data-ve-edit-range hidden></span>
          <span class="ve-analysis-scope-marker ve-analysis-scope-marker-a" data-ve-scope-a data-ve-range-handle="a" role="slider" aria-label="VE range start A in milliseconds" aria-orientation="horizontal" tabindex="0" hidden></span>
          <span class="ve-analysis-scope-marker ve-analysis-scope-marker-b" data-ve-scope-b data-ve-range-handle="b" role="slider" aria-label="VE range end B in milliseconds" aria-orientation="horizontal" tabindex="0" hidden></span>
        </div>
      </div>
      <div class="ve-analysis-scope-ranges" data-ve-timeline-ranges></div>
    </div>
    <button type="button" class="ve-analysis-scope-open" data-ve-scope-open disabled>Open in Logger</button>`;

  if (workbench?.parentElement) workbench.insertAdjacentElement('afterend', scope);

  const scopeLabel = scope.querySelector<HTMLElement>('[data-ve-scope-label]')!;
  const scopeDetail = scope.querySelector<HTMLElement>('[data-ve-scope-detail]')!;
  const scopeStart = scope.querySelector<HTMLElement>('[data-ve-scope-start]')!;
  const scopeEnd = scope.querySelector<HTMLElement>('[data-ve-scope-end]')!;
  const scopeRange = scope.querySelector<HTMLElement>('[data-ve-scope-range]')!;
  const markerA = scope.querySelector<HTMLElement>('[data-ve-scope-a]')!;
  const markerB = scope.querySelector<HTMLElement>('[data-ve-scope-b]')!;
  const openScope = scope.querySelector<HTMLButtonElement>('[data-ve-scope-open]')!;
  const timelineRanges = scope.querySelector<HTMLElement>('[data-ve-timeline-ranges]')!;
  const fullScopeButton = scope.querySelector<HTMLButtonElement>('[data-ve-timeline-scope="full"]')!;
  const rangeButton = scope.querySelector<HTMLButtonElement>('[data-ve-timeline-scope="ab"]')!;
  const rangeTrack = scope.querySelector<HTMLElement>('[data-ve-range-track]')!;
  const editRange = scope.querySelector<HTMLElement>('[data-ve-edit-range]')!;
  let timelineKey: string | undefined;
  let currentContext: LoggerAnalysisContext | undefined;
  let currentScopeBounds: { startMs: number; endMs: number; label: string } | undefined;

  const renderScope = (context: LoggerAnalysisContext): void => {
    currentContext = context;
    const extent = context.sourceTimeRange;
    const scopeSelect = root.querySelector<HTMLSelectElement>('select[data-role="scope"]');
    const selected = scopeSelect ? selectedAnalyzerScope(scopeSelect, context) : undefined;
    const extentValid = Boolean(extent && Number.isFinite(extent.startMs) && Number.isFinite(extent.endMs) && extent.endMs >= extent.startMs);
    const options = analyzerScopeOptions(context).filter(option => option.kind === 'range' && option.value !== 'ab');
    const hasRange = context.aTimeMs !== undefined && context.bTimeMs !== undefined && Number.isFinite(context.aTimeMs) && Number.isFinite(context.bTimeMs) && context.aTimeMs !== context.bTimeMs;
    rangeButton.disabled = !hasRange;
    rangeTrack.setAttribute('aria-disabled', String(!extentValid || !extent || extent.endMs <= extent.startMs || !context.setAnalysisRange));
    editRange.hidden = !extentValid || !hasRange;
    if (!editRange.hidden && extent) {
      const start = Math.max(extent.startMs, Math.min(context.aTimeMs!, context.bTimeMs!));
      const end = Math.min(extent.endMs, Math.max(context.aTimeMs!, context.bTimeMs!));
      editRange.style.left = `${(start - extent.startMs) / Math.max(1, extent.endMs - extent.startMs) * 100}%`;
      editRange.style.width = `${Math.max(0, end - start) / Math.max(1, extent.endMs - extent.startMs) * 100}%`;
    }
    const key = JSON.stringify(options);
    if (key !== timelineKey) {
      timelineKey = key;
      timelineRanges.replaceChildren(...options.map(option => {
        const button = document.createElement('button'); button.type = 'button';
        button.className = 've-timeline-choice'; button.dataset.veTimelineScope = option.value;
        button.dataset.scopeKind = option.value === 'ab' ? 'ab' : 'saved';
        const label = document.createElement('span'); label.className = 've-timeline-label'; label.textContent = option.label;
        const lane = document.createElement('span'); lane.className = 've-timeline-lane';
        const band = document.createElement('span'); band.className = 've-timeline-band'; band.dataset.scopeKind = button.dataset.scopeKind;
        const bounds = analyzerScopeBounds(option);
        button.title = `${option.label}: ${bounds.startMs}–${bounds.endMs} ms`;
        lane.append(band); button.append(label, lane); return button;
      }));
    }
    options.forEach((option, index) => {
      const bounds = analyzerScopeBounds(option);
      const band = timelineRanges.children[index]!.querySelector<HTMLElement>('.ve-timeline-band')!;
      band.hidden = !extentValid;
      if (extentValid && extent) {
        const span = Math.max(1, extent.endMs - extent.startMs);
        const left = Math.max(0, Math.min(100, ((bounds.startMs! - extent.startMs) / span) * 100));
        const right = Math.max(0, Math.min(100, ((bounds.endMs! - extent.startMs) / span) * 100));
        band.hidden = bounds.endMs! < extent.startMs || bounds.startMs! > extent.endMs;
        band.style.left = `${left}%`; band.style.width = `${Math.max(0, right - left)}%`;
      }
    });
    for (const button of scope.querySelectorAll<HTMLButtonElement>('[data-ve-timeline-scope]')) {
      button.setAttribute('aria-pressed', String(button.dataset.veTimelineScope === scopeSelect?.value));
    }
    scopeRange.hidden = !extentValid;
    fullScopeButton.title = extentValid ? 'Analyze the entire available Logger source' : 'Full Log — source extent unavailable';
    if (!extent || !Number.isFinite(extent.startMs) || !Number.isFinite(extent.endMs) || extent.endMs < extent.startMs) {
      const bounds = selected ? analyzerScopeBounds(selected) : {};
      currentScopeBounds = bounds.startMs !== undefined && bounds.endMs !== undefined ? { startMs: bounds.startMs, endMs: bounds.endMs, label: selected!.label } : undefined;
      scope.dataset.state = 'empty';
      scopeLabel.textContent = selected?.label ?? 'Full Log';
      scopeDetail.textContent = ' · source extent unavailable';
      scopeStart.textContent = '--:--';
      scopeEnd.textContent = '--:--';
      scopeRange.style.left = '0%';
      scopeRange.style.width = '100%';
      markerA.hidden = true;
      markerB.hidden = true;
      openScope.disabled = !currentScopeBounds || !context.openRangeInLogger;
      return;
    }

    const start = Math.min(extent.startMs, extent.endMs);
    const end = Math.max(extent.startMs, extent.endMs);
    const span = Math.max(1, end - start);
    const bounds = selected ? analyzerScopeBounds(selected) : {};
    const selectedStart = bounds.startMs ?? start;
    const selectedEnd = bounds.endMs ?? end;
    const isFull = !selected || selected.kind === 'full';

    currentScopeBounds = { startMs: selectedStart, endMs: selectedEnd, label: selected?.label ?? 'Full Log' };
    scope.dataset.state = isFull ? 'full' : 'range';
    scopeLabel.textContent = scopeSelect?.value === 'ab' ? 'Selected Range (A–B)' : selected?.label ?? 'Full Log';
    scopeDetail.textContent = isFull ? ' · entire available source' : ` · ${formatScopeTime(selectedStart)}–${formatScopeTime(selectedEnd)}`;
    scopeStart.textContent = formatScopeTime(start);
    scopeEnd.textContent = formatScopeTime(end);
    scopeRange.style.left = '0%';
    scopeRange.style.width = '100%';

    const placeMarker = (node: HTMLElement, value: number | undefined): void => {
      node.hidden = value === undefined || !Number.isFinite(value);
      if (!node.hidden) node.style.left = `${Math.max(0, Math.min(100, ((value! - start) / span) * 100))}%`;
      node.tabIndex = context.setAnalysisRange ? 0 : -1;
      node.setAttribute('aria-valuemin', String(start)); node.setAttribute('aria-valuemax', String(end));
      node.setAttribute('aria-valuenow', String(value ?? start));
      node.setAttribute('aria-disabled', rangeTrack.getAttribute('aria-disabled')!);
    };
    placeMarker(markerA, context.aTimeMs);
    placeMarker(markerB, context.bTimeMs);
    openScope.disabled = !context.openRangeInLogger;
  };

  // The gesture owns preview geometry only. Logger accepts a single commit and
  // republishes its context before the existing scope selector is changed.
  type RangeGesture = { pointerId: number; context: LoggerAnalysisContext; origin: number; a: number; b: number; mode: 'new' | 'a' | 'b' | 'move' };
  let rangeGesture: RangeGesture | undefined;
  const gestureBounds = (gesture: RangeGesture, time: number): readonly [number, number] => {
    if (gesture.mode === 'a') return [time, gesture.b];
    if (gesture.mode === 'move') {
      const extent = gesture.context.sourceTimeRange!;
      const delta = Math.max(extent.startMs - gesture.a, Math.min(extent.endMs - gesture.b, time - gesture.origin));
      return [gesture.a + delta, gesture.b + delta];
    }
    return [gesture.a, time];
  };
  const cancelRangeGesture = (): void => {
    const gesture = rangeGesture; rangeGesture = undefined;
    if (!gesture) return;
    if (rangeTrack.hasPointerCapture(gesture.pointerId)) rangeTrack.releasePointerCapture(gesture.pointerId);
    if (active && !disposed && currentContext) renderScope(currentContext);
  };
  const rangeTime = (clientX: number): number | undefined => {
    const extent = currentContext?.sourceTimeRange, rect = rangeTrack.getBoundingClientRect();
    if (!extent || !Number.isFinite(extent.startMs) || !Number.isFinite(extent.endMs) || rect.width <= 0 || !(extent.endMs > extent.startMs)) return undefined;
    return extent.startMs + Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * (extent.endMs - extent.startMs);
  };
  const selectAcceptedRange = (context: LoggerAnalysisContext, a: number, b: number): void => {
    if (!active || disposed || !Number.isFinite(a) || !Number.isFinite(b) || a === b) return;
    if (!context.setAnalysisRange?.({ startMs: Math.min(a, b), endMs: Math.max(a, b) })) return;
    const select = root.querySelector<HTMLSelectElement>('select[data-role="scope"]');
    if (select && select.value !== 'ab' && [...select.options].some(option => option.value === 'ab')) {
      select.value = 'ab'; select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (currentContext) renderScope(currentContext);
  };
  rangeTrack.addEventListener('pointerdown', event => {
    const context = currentContext, time = rangeTime(event.clientX);
    if (!active || disposed || rangeGesture || event.button !== 0 || !context?.setAnalysisRange || time === undefined) return;
    event.preventDefault();
    const handle = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-ve-range-handle]')?.dataset.veRangeHandle : undefined;
    const hasRange = context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs;
    const mode = event.shiftKey ? 'new' : handle === 'a' || handle === 'b' ? handle : hasRange && event.target === editRange ? 'move' : 'new';
    rangeGesture = { pointerId: event.pointerId, context, origin: time,
      a: mode === 'new' ? time : mode === 'move' ? Math.min(context.aTimeMs!, context.bTimeMs!) : context.aTimeMs!,
      b: mode === 'new' ? time : mode === 'move' ? Math.max(context.aTimeMs!, context.bTimeMs!) : context.bTimeMs!, mode };
    if (mode === 'a' || mode === 'b') (mode === 'a' ? markerA : markerB).focus({ preventScroll: true });
    rangeTrack.setPointerCapture(event.pointerId);
  }, { signal: events.signal });
  rangeTrack.addEventListener('pointermove', event => {
    const gesture = rangeGesture, time = rangeTime(event.clientX), extent = gesture?.context.sourceTimeRange;
    if (!gesture || gesture.pointerId !== event.pointerId || time === undefined || !extent) return;
    const [a, b] = gestureBounds(gesture, time);
    const span = extent.endMs - extent.startMs;
    editRange.hidden = false; editRange.style.left = `${(Math.min(a, b) - extent.startMs) / span * 100}%`; editRange.style.width = `${Math.abs(b - a) / span * 100}%`;
    for (const [node, value] of [[markerA, a], [markerB, b]] as const) { node.hidden = false; node.style.left = `${(value - extent.startMs) / span * 100}%`; }
  }, { signal: events.signal });
  rangeTrack.addEventListener('pointerup', event => {
    const gesture = rangeGesture, time = rangeTime(event.clientX);
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const [a, b] = time === undefined ? [gesture.a, gesture.b] : gestureBounds(gesture, time);
    cancelRangeGesture();
    if (time !== undefined && currentContext === gesture.context) selectAcceptedRange(gesture.context, a, b);
  }, { signal: events.signal });
  for (const event of ['pointercancel', 'lostpointercapture'] as const) rangeTrack.addEventListener(event, cancelRangeGesture, { signal: events.signal });
  rangeTrack.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); cancelRangeGesture(); return; }
    const context = currentContext, extent = context?.sourceTimeRange;
    const handle = event.target instanceof HTMLElement ? event.target.dataset.veRangeHandle : undefined;
    if (!active || disposed || !context?.setAnalysisRange || !extent || !handle || context.aTimeMs === undefined || context.bTimeMs === undefined || rangeTrack.getAttribute('aria-disabled') === 'true') return;
    const step = Math.max(1, (extent.endMs - extent.startMs) / (event.shiftKey ? 1000 : 100));
    const current = handle === 'a' ? context.aTimeMs : context.bTimeMs;
    const value = event.key === 'Home' ? extent.startMs : event.key === 'End' ? extent.endMs : event.key === 'ArrowLeft' ? current - step : event.key === 'ArrowRight' ? current + step : undefined;
    if (value === undefined) return;
    event.preventDefault(); cancelRangeGesture();
    const bounded = Math.max(extent.startMs, Math.min(extent.endMs, value));
    selectAcceptedRange(context, handle === 'a' ? bounded : context.aTimeMs, handle === 'b' ? bounded : context.bTimeMs);
  }, { signal: events.signal });

  scope.addEventListener('click', event => {
    if (disposed || !active || !(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('[data-ve-timeline-scope]');
    const select = root.querySelector<HTMLSelectElement>('select[data-role="scope"]');
    if (!button || !select || select.value === button.dataset.veTimelineScope) return;
    if (![...select.options].some(option => option.value === button.dataset.veTimelineScope)) return;
    select.value = button.dataset.veTimelineScope!;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, { signal: events.signal });

  openScope.addEventListener('click', () => {
    if (disposed || !active) return;
    const context = currentContext;
    const range = currentScopeBounds;
    if (!context?.openRangeInLogger || !range) return;
    context.openRangeInLogger(range);
  }, { signal: events.signal });

  let active = true;
  const setupGroups = new Map<string, SetupGroup>();
  let syncSetupSummaries = (): void => {};
  let syncScopeChoices = (): void => {};
  let setupQueued = false;
  const scheduleSetupSummaries = (): void => {
    if (!active || disposed || setupQueued) return;
    setupQueued = true;
    queueMicrotask(() => {
      setupQueued = false;
      if (!active || disposed) return;
      syncScopeChoices();
      syncSetupSummaries();
    });
  };

  const positionSetupDisclosure = (details: HTMLDetailsElement): void => {
    if (!active || disposed || !details.open) return;
    const body = details.querySelector<HTMLElement>('.ve-v50-setup-body');
    const summary = details.querySelector<HTMLElement>(':scope > summary');
    if (!body || !summary) return;

    // Setup groups are always viewport-fixed in v50. Measure each group and
    // prefer opening inward above the bottom setup strip, toward the table.
    body.style.left = '';
    body.style.right = '';
    body.style.top = '';
    body.style.bottom = '';
    details.dataset.openDirection = 'down';
    const summaryRect = summary.getBoundingClientRect();
    const groupRect = details.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const pad = 8;
    const gap = 5;
    const roomBelow = window.innerHeight - summaryRect.bottom;
    const roomAbove = summaryRect.top;
    const direction = roomAbove >= bodyRect.height + gap + pad ? 'up'
      : roomBelow >= bodyRect.height + gap + pad ? 'down'
      : roomAbove >= roomBelow ? 'up' : 'down';
    details.dataset.openDirection = direction;

    const fixed = getComputedStyle(body).position === 'fixed';
    const maximumLeft = Math.max(pad, window.innerWidth - bodyRect.width - pad);
    const desiredViewportLeft = Math.max(pad, Math.min(summaryRect.left, maximumLeft));

    if (fixed) {
      body.style.left = `${desiredViewportLeft}px`;
      body.style.right = 'auto';
      body.style.top = `${direction === 'up'
        ? Math.max(pad, summaryRect.top - bodyRect.height - gap)
        : Math.min(window.innerHeight - bodyRect.height - pad, summaryRect.bottom + gap)}px`;
      body.style.bottom = 'auto';
      return;
    }

    // Wide-screen absolute positioning: translate the desired viewport location
    // into the local details coordinate system, then correct against the measured
    // result so flex/grid border-box differences cannot leak a few pixels outside.
    body.style.left = `${desiredViewportLeft - groupRect.left}px`;
    const placed = body.getBoundingClientRect();
    let correction = 0;
    if (placed.left < pad) correction += pad - placed.left;
    if (placed.right + correction > window.innerWidth - pad) {
      correction -= placed.right + correction - (window.innerWidth - pad);
    }
    if (Math.abs(correction) > 0.01) {
      const currentLeft = Number.parseFloat(body.style.left) || 0;
      body.style.left = `${currentLeft + correction}px`;
    }
  };

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

    const semanticScopeSelect = root.querySelector<HTMLSelectElement>('select[data-role="scope"]');
    const semanticScopeLabel = semanticScopeSelect?.closest<HTMLLabelElement>('label');
    if (semanticScopeLabel) {
      semanticScopeLabel.hidden = true;
      scopeGroup.body.append(semanticScopeLabel);
    }
    const scopeChoices = document.createElement('div');
    scopeChoices.className = 've-v50-scope-choice-list';
    scopeGroup.body.append(scopeChoices);
    let scopeOptionsKey: string | undefined;
    let selectedScope: string | undefined;
    syncScopeChoices = (): void => {
      if (!semanticScopeSelect) return;
      const options = [...semanticScopeSelect.options].map(option => ({ value: option.value, textContent: option.value === 'ab' ? 'Selected Range (A–B)' : option.textContent, disabled: option.disabled }));
      if (!options.some(option => option.value === 'ab')) options.splice(1, 0, { value: 'ab', textContent: 'Selected Range (A–B)', disabled: true });
      const key = JSON.stringify(options.map(option => [option.value, option.textContent?.trim() || option.value, option.disabled]));
      if (key !== scopeOptionsKey) {
        scopeOptionsKey = key;
        selectedScope = undefined;
        scopeChoices.replaceChildren(...options.map(option => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 've-v50-scope-choice';
          button.textContent = option.textContent?.trim() || option.value;
          button.dataset.scopeValue = option.value;
          button.disabled = option.disabled;
          button.addEventListener('click', () => {
            if (semanticScopeSelect.value !== option.value) {
              semanticScopeSelect.value = option.value;
              semanticScopeSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
            syncScopeChoices();
            scopeGroup.details.open = false;
          }, { signal: events.signal });
          return button;
        }));
      }
      if (selectedScope === semanticScopeSelect.value) return;
      selectedScope = semanticScopeSelect.value;
      for (const button of scopeChoices.querySelectorAll<HTMLButtonElement>('button')) {
        const selected = button.dataset.scopeValue === selectedScope;
        button.dataset.selected = String(selected);
        button.setAttribute('aria-pressed', String(selected));
      }
    };

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

    for (const group of setupGroups.values()) {
      group.details.addEventListener('toggle', () => {
        if (group.details.open) requestAnimationFrame(() => positionSetupDisclosure(group.details));
      }, { signal: events.signal });
    }
    window.addEventListener('resize', () => {
      for (const group of setupGroups.values()) if (group.details.open) positionSetupDisclosure(group.details);
    }, { signal: events.signal });

    const advanced = root.querySelector<HTMLDetailsElement>('.ve-workbench-advanced');
    if (advanced) {
      const advancedButton = document.createElement('button');
      advancedButton.type = 'button';
      advancedButton.className = 've-v50-advanced-button';
      advancedButton.textContent = 'Advanced';
      advancedButton.onclick = () => {
        closeVeAnalyzerSetupDisclosures(root);
        advanced.open = true;
        advanced.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      };
      quickControls.append(advancedButton);
    }

    syncSetupSummaries = (): void => {
      const summary = (id: string, text: string): void => {
        const node = setupGroups.get(id)?.summaryValue;
        if (node && node.textContent !== text) node.textContent = text;
      };

      summary('qualification', 'Analysis Mode');
      summary('scope', 'Log Scope');

      summary('range', 'RPM / Load Range');
      summary('guards', 'Stability Filter');
      summary('cell-change', 'Change Filter');
      summary('mixture', 'Mixture Source');
    };

    root.addEventListener('change', (event) => {
      scheduleSetupSummaries();
      if (currentContext && event.target instanceof HTMLSelectElement && event.target.matches('select[data-role="scope"]')) renderScope(currentContext);
    }, { signal: events.signal });
    root.addEventListener('input', scheduleSetupSummaries, { signal: events.signal });
    scheduleSetupSummaries();
  }

  return {
    element: root,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelRangeGesture();
      events.abort();
      active = false; currentContext = undefined; currentScopeBounds = undefined;
      closeVeAnalyzerSetupDisclosures(root);
      inner.dispose();
    },
    setActive(next) { if (disposed) return;
      active = next;
      if (!next) cancelRangeGesture();
      inner.setActive(next);
      if (next) { if (currentContext) renderScope(currentContext); scheduleSetupSummaries(); }
      else closeVeAnalyzerSetupDisclosures(root);
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
      if (disposed) return false;
      if (rangeGesture && rangeGesture.context !== context) cancelRangeGesture();
      const changed = inner.setContext(context);
      currentContext = context;
      if (active) renderScope(context);
      scheduleSetupSummaries();
      return changed;
    },
    setTuneModel(model, sourceName) {
      if (disposed) return false;
      const changed = inner.setTuneModel(model, sourceName);
      scheduleSetupSummaries();
      return changed;
    },
    refresh() {
      if (disposed) return;
      inner.refresh();
      scheduleSetupSummaries();
    },
  };
}
