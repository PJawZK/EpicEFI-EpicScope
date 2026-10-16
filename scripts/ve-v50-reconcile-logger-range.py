from pathlib import Path

# Logger: authoritative source extent + explicit range focus contract.
path = Path('apps/web/src/pages/logger-page.ts')
text = path.read_text()
text = text.replace('  LogMarker,\n  ParserDiagnostic,\n', '  LogMarker,\n  LogTimeRange,\n  ParserDiagnostic,\n', 1)
context_anchor = """  readonly openSamplesInLogger?: (request: {
    readonly sampleIndices: readonly number[];
    readonly timeMs: readonly number[];
    readonly label: string;
  }) => void;
"""
context_replacement = context_anchor + """  /** Authoritative whole-source extent captured with this source-bound context. */
  readonly sourceTimeRange?: { readonly startMs: number; readonly endMs: number };
  readonly openRangeInLogger?: (request: {
    readonly startMs: number;
    readonly endMs: number;
    readonly label: string;
  }) => void;
"""
assert context_anchor in text
text = text.replace(context_anchor, context_replacement, 1)
controller_anchor = "  focusAnalysisTimes(timeMs: readonly number[]): void;\n"
assert controller_anchor in text
text = text.replace(controller_anchor, controller_anchor + "  focusAnalysisRange(startMs: number, endMs: number): void;\n", 1)
source_anchor = "  let channelDataSource: NumericChannelDataSource | undefined;\n  let analysisDataRevision = 0;\n"
assert source_anchor in text
text = text.replace(source_anchor, "  let channelDataSource: NumericChannelDataSource | undefined;\n  let analysisSourceTimeRange: LogTimeRange | undefined;\n  let analysisDataRevision = 0;\n", 1)
setlog_anchor = "    integritySource = summary.source;\n    workspaceGeneration += 1;\n"
assert setlog_anchor in text
text = text.replace(setlog_anchor, "    integritySource = summary.source;\n    analysisSourceTimeRange = summary.timeRange ? { ...summary.timeRange } : undefined;\n    workspaceGeneration += 1;\n", 1)
grow_anchor = "    if (!channelDataSource) return;\n    logMarkers = summary.markers;\n"
assert grow_anchor in text
text = text.replace(grow_anchor, "    if (!channelDataSource) return;\n    analysisSourceTimeRange = summary.timeRange ? { ...summary.timeRange } : analysisSourceTimeRange;\n    logMarkers = summary.markers;\n", 1)
error_anchor = "    channelDataSource = undefined;\n    integritySource = undefined;\n"
assert error_anchor in text
text = text.replace(error_anchor, "    channelDataSource = undefined;\n    analysisSourceTimeRange = undefined;\n    integritySource = undefined;\n", 1)
getcontext_anchor = "    const sourceRevision = analysisDataRevision;\n    const channels = analysisChannels();\n"
assert getcontext_anchor in text
text = text.replace(getcontext_anchor, "    const sourceRevision = analysisDataRevision;\n    const sourceTimeRange = analysisSourceTimeRange ? { startMs: analysisSourceTimeRange.startMs, endMs: analysisSourceTimeRange.endMs } : undefined;\n    const channels = analysisChannels();\n", 1)
return_anchor = "      ...(source ? { source: { identity: source, sampleCount: sampleExtent, revision: sourceRevision } } : {}),\n      aTimeMs: analysisStartMs,\n"
assert return_anchor in text
text = text.replace(return_anchor, "      ...(source ? { source: { identity: source, sampleCount: sampleExtent, revision: sourceRevision } } : {}),\n      ...(sourceTimeRange ? { sourceTimeRange } : {}),\n      aTimeMs: analysisStartMs,\n", 1)
focus_insert_anchor = "  const getRuntimeDiagnosticSnapshot = (): LoggerRuntimeDiagnosticSnapshot => {\n"
assert focus_insert_anchor in text
focus_impl = """  const focusAnalysisRange = (startMs: number, endMs: number): void => {
    const sourceRange = analysisSourceTimeRange;
    if (!sourceRange || !Number.isFinite(startMs) || !Number.isFinite(endMs)) return;
    let low = Math.max(sourceRange.startMs, Math.min(startMs, endMs));
    let high = Math.min(sourceRange.endMs, Math.max(startMs, endMs));
    if (high < low) return;
    if (high === low) {
      const padding = Math.max(1, (sourceRange.endMs - sourceRange.startMs) * 0.005);
      low = Math.max(sourceRange.startMs, low - padding);
      high = Math.min(sourceRange.endMs, high + padding);
    }
    if (!(high > low)) return;
    const target = createFullViewport(low, high);
    syncViewport(target, 'record');
    centerCursorInViewport(target);
  };

"""
text = text.replace(focus_insert_anchor, focus_impl + focus_insert_anchor, 1)
controller_return = "    focusAnalysisTimes,\n    restoreWorkspaceState,\n"
assert controller_return in text
text = text.replace(controller_return, "    focusAnalysisTimes,\n    focusAnalysisRange,\n    restoreWorkspaceState,\n", 1)
path.write_text(text)

# App shell: Analyzer handoff owns mode switching, Logger owns navigation.
path = Path('apps/web/src/app/app-shell.ts')
text = path.read_text()
anchor = """        openSamplesInLogger: (request) => {
          loggerPage.focusAnalysisTimes(request.timeMs);
          appStatus.textContent = `Logger · ${request.label} · ${request.sampleIndices.length.toLocaleString()} evidence point${request.sampleIndices.length === 1 ? '' : 's'}`;
          setEpicScopeMode('logger');
        },
"""
assert anchor in text
text = text.replace(anchor, anchor + """        openRangeInLogger: (request) => {
          loggerPage.focusAnalysisRange(request.startMs, request.endMs);
          appStatus.textContent = `Logger · ${request.label}`;
          setEpicScopeMode('logger');
        },
""", 1)
path.write_text(text)

# v50 scope navigator: authoritative source extent + actual selected Analyzer scope.
path = Path('apps/web/src/pages/ve-analyzer-v50-presentation.ts')
text = path.read_text()
text = text.replace("import type { LoggerAnalysisContext } from './logger-page';\n", "import type { LoggerAnalysisContext } from './logger-page';\nimport { analyzerScopeBounds, selectedAnalyzerScope } from './analyzer-scope';\n", 1)
start = text.index('function finiteTimes(context: LoggerAnalysisContext): number[] {')
end = text.index('\nfunction formatScopeTime', start)
text = text[:start] + text[end+1:]
old_markup = """    <div class="ve-analysis-scope-main">
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
"""
new_markup = """    <div class="ve-analysis-scope-main">
      <div class="ve-analysis-scope-meta">
        <span><strong data-ve-scope-label>Full Log</strong><span data-ve-scope-detail> · source extent</span></span>
        <span><span data-ve-scope-start>--:--</span> — <span data-ve-scope-end>--:--</span></span>
      </div>
      <div class="ve-analysis-scope-strip" data-ve-scope-strip>
        <div class="ve-analysis-scope-range" data-ve-scope-range></div>
        <div class="ve-analysis-scope-marker ve-analysis-scope-marker-a" data-ve-scope-a hidden></div>
        <div class="ve-analysis-scope-marker ve-analysis-scope-marker-b" data-ve-scope-b hidden></div>
      </div>
    </div>
    <button type="button" class="ve-analysis-scope-open" data-ve-scope-open disabled>Open in Logger</button>`;
"""
assert old_markup in text
text = text.replace(old_markup, new_markup, 1)
query_anchor = """  const markerB = scope.querySelector<HTMLElement>('[data-ve-scope-b]')!;

  const renderScope = (context: LoggerAnalysisContext): void => {
"""
query_replacement = """  const markerB = scope.querySelector<HTMLElement>('[data-ve-scope-b]')!;
  const openScope = scope.querySelector<HTMLButtonElement>('[data-ve-scope-open]')!;
  let currentContext: LoggerAnalysisContext | undefined;
  let currentScopeBounds: { startMs: number; endMs: number; label: string } | undefined;

  const renderScope = (context: LoggerAnalysisContext): void => {
"""
assert query_anchor in text
text = text.replace(query_anchor, query_replacement, 1)
start = text.index('  const renderScope = (context: LoggerAnalysisContext): void => {')
end = text.index('\n  const setupGroups', start)
new_render = """  const renderScope = (context: LoggerAnalysisContext): void => {
    currentContext = context;
    const extent = context.sourceTimeRange;
    if (!extent || !Number.isFinite(extent.startMs) || !Number.isFinite(extent.endMs) || extent.endMs < extent.startMs) {
      currentScopeBounds = undefined;
      scope.dataset.state = 'empty';
      scopeLabel.textContent = 'Full Log';
      scopeDetail.textContent = ' · source extent unavailable';
      scopeStart.textContent = '--:--';
      scopeEnd.textContent = '--:--';
      scopeRange.style.left = '0%';
      scopeRange.style.width = '100%';
      markerA.hidden = true;
      markerB.hidden = true;
      openScope.disabled = true;
      return;
    }

    const start = Math.min(extent.startMs, extent.endMs);
    const end = Math.max(extent.startMs, extent.endMs);
    const span = Math.max(1, end - start);
    const scopeSelect = root.querySelector<HTMLSelectElement>('select[data-role="scope"]');
    const selected = scopeSelect ? selectedAnalyzerScope(scopeSelect, context) : undefined;
    const bounds = selected ? analyzerScopeBounds(selected) : {};
    const selectedStart = bounds.startMs ?? start;
    const selectedEnd = bounds.endMs ?? end;
    const left = Math.max(0, Math.min(100, ((selectedStart - start) / span) * 100));
    const right = Math.max(left, Math.min(100, ((selectedEnd - start) / span) * 100));
    const isFull = !selected || selected.kind === 'full';

    currentScopeBounds = { startMs: selectedStart, endMs: selectedEnd, label: selected?.label ?? 'Full Log' };
    scope.dataset.state = isFull ? 'full' : 'range';
    scopeLabel.textContent = selected?.label ?? 'Full Log';
    scopeDetail.textContent = isFull ? ' · entire available source' : ` · ${formatScopeTime(selectedStart)}–${formatScopeTime(selectedEnd)}`;
    scopeStart.textContent = formatScopeTime(start);
    scopeEnd.textContent = formatScopeTime(end);
    scopeRange.style.left = `${left}%`;
    scopeRange.style.width = `${Math.max(0.2, right - left)}%`;

    const placeMarker = (node: HTMLElement, value: number | undefined): void => {
      node.hidden = value === undefined || !Number.isFinite(value);
      if (!node.hidden) node.style.left = `${Math.max(0, Math.min(100, ((value! - start) / span) * 100))}%`;
    };
    placeMarker(markerA, context.aTimeMs);
    placeMarker(markerB, context.bTimeMs);
    openScope.disabled = !context.openRangeInLogger;
  };

  openScope.addEventListener('click', () => {
    const context = currentContext;
    const range = currentScopeBounds;
    if (!context?.openRangeInLogger || !range) return;
    context.openRangeInLogger(range);
  });
"""
text = text[:start] + new_render + text[end:]
listeners_anchor = """    root.addEventListener('change', syncSetupSummaries);
    root.addEventListener('input', syncSetupSummaries);
"""
listeners_replacement = """    root.addEventListener('change', (event) => {
      syncSetupSummaries();
      if (currentContext && event.target instanceof HTMLSelectElement && event.target.matches('select[data-role="scope"]')) renderScope(currentContext);
    });
    root.addEventListener('input', syncSetupSummaries);
"""
assert listeners_anchor in text
text = text.replace(listeners_anchor, listeners_replacement, 1)
path.write_text(text)

# Scope action styling.
path = Path('apps/web/src/styles/ve-analyzer-v50-port.css')
text = path.read_text()
text += """

.ve-v50-port .ve-analysis-scope-navigator {
  grid-template-columns: minmax(0, 1fr) auto;
}

.ve-v50-port .ve-analysis-scope-open {
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid #31505f;
  border-radius: 3px;
  background: #0b1b24;
  color: #b9cbd4;
  font-size: 9px;
  white-space: nowrap;
  cursor: pointer;
}

.ve-v50-port .ve-analysis-scope-open:hover:not(:disabled) {
  border-color: #3479ae;
  background: #102437;
}

.ve-v50-port .ve-analysis-scope-open:disabled {
  opacity: .45;
  cursor: default;
}
"""
path.write_text(text)

# Browser ownership regressions.
path = Path('tests/web/logger-analysis-context.browser.mjs')
text = path.read_text()
anchor = """    assert(old.source.identity === a.source && loaded[0]?.range.values[0] === 100 && loaded[0].channel === a.channels[0] && b.calls.length === before, 'Retained context used replacement source or metadata');
    checks.push('retained context invoked after replacement reads only its advertised source/metadata');
"""
assert anchor in text
text = text.replace(anchor, anchor + """    assert(old.sourceTimeRange?.startMs === 0 && old.sourceTimeRange?.endMs === 500, 'Retained context lost its authoritative source time extent');
    checks.push('analysis context captures authoritative whole-source time extent with its source lifetime');
""", 1)
path.write_text(text)

path = Path('tests/web/ve-shared-table-interaction.browser.mjs')
text = path.read_text()
context_anchor = """  try {
    view.setContext({
      source: { identity: {}, sampleCount: 60, revision: 0 }, channels, traces: [], aTimeMs: 0, bTimeMs: 3000, savedRanges: [],
      loadTraces: async (ids) => traces.filter((trace) => ids.includes(trace.channel.id)),
    });
"""
context_replacement = """  try {
    let openedRange;
    view.setContext({
      source: { identity: {}, sampleCount: 60, revision: 0 }, sourceTimeRange: { startMs: 0, endMs: 5900 },
      channels, traces: [], aTimeMs: 0, bTimeMs: 3000, savedRanges: [],
      loadTraces: async (ids) => traces.filter((trace) => ids.includes(trace.channel.id)),
      openRangeInLogger: (request) => { openedRange = request; },
    });
"""
assert context_anchor in text
text = text.replace(context_anchor, context_replacement, 1)
check_anchor = "    checks.push('compact setup summaries resync after controller-driven/programmatic changes');\n\n"
assert check_anchor in text
text = text.replace(check_anchor, check_anchor + """    const scopeSelect = root.querySelector('select[data-role="scope"]');
    scopeSelect.value = 'ab';
    scopeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    const scopeNavigator = root.querySelector('.ve-analysis-scope-navigator');
    const scopeOpen = root.querySelector('[data-ve-scope-open]');
    assert(scopeNavigator?.dataset.state === 'range' && root.querySelector('[data-ve-scope-start]')?.textContent === '00:00' && root.querySelector('[data-ve-scope-end]')?.textContent === '00:06',
      'Scope navigator did not use authoritative source extent with the selected Analyzer range');
    scopeOpen.click();
    assert(openedRange?.startMs === 0 && openedRange?.endMs === 3000 && openedRange?.label === 'Current A/B', 'Scope handoff did not send the selected semantic range to Logger');
    checks.push('scope navigator uses authoritative source extent and explicit selected-range Logger handoff');

""", 1)
path.write_text(text)
