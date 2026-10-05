from pathlib import Path


def read(path): return Path(path).read_text(encoding='utf-8')
def write(path, text): Path(path).write_text(text, encoding='utf-8')
def rep(text, old, new, label):
    if old not in text: raise SystemExit(f'missing marker: {label}')
    return text.replace(old, new, 1)

# --- Heatmap core retains exact source sample membership per cell. ---
path = 'core/analysis/heatmap.ts'
s = read(path)
s = rep(s,
"  /** Row-major valid value samples contributing to the cell aggregation. */\n  readonly cellValueSampleCounts: Uint32Array;",
"  /** Row-major valid value samples contributing to the cell aggregation. */\n  readonly cellValueSampleCounts: Uint32Array;\n  /** Exact source sample indices contributing X/Y pairs to each row-major cell. */\n  readonly cellSampleIndices: readonly Uint32Array[];",
'heatmap result cell samples')
s = rep(s,
"    cellValueSampleCounts: new Uint32Array(0),\n    aggregationMethod,",
"    cellValueSampleCounts: new Uint32Array(0),\n    cellSampleIndices: [],\n    aggregationMethod,",
'empty cell samples')
s = rep(s,
"    cellValueSampleCounts,\n    aggregationMethod,",
"    cellValueSampleCounts,\n    cellSampleIndices: cellSampleIndices.map((indices) => Uint32Array.from(indices)),\n    aggregationMethod,",
'final cell samples')
write(path, s)

# Core tests for exact membership.
path = 'tests/analysis/heatmap.test.ts'
s = read(path)
marker = "  it('aligns qualified sample indices across ranges with different local offsets', () => {"
test = """  it('retains exact source sample indices for every populated cell', () => {
    const result = buildNumericHeatmap(
      range(100, [0, 0, 10, 10]),
      range(100, [0, 0, 10, 10]),
      { xBinCount: 2, yBinCount: 2 },
    );

    expect(result.cellSampleIndices).toHaveLength(4);
    expect([...result.cellSampleIndices[0]!]).toEqual([100, 101]);
    expect([...result.cellSampleIndices[1]!]).toEqual([]);
    expect([...result.cellSampleIndices[2]!]).toEqual([]);
    expect([...result.cellSampleIndices[3]!]).toEqual([102, 103]);
  });

"""
if marker not in s: raise SystemExit('missing heatmap test marker')
s = s.replace(marker, test + marker, 1)
write(path, s)

# Histogram context callback boundary.
path = 'apps/web/src/pages/histogram-page.ts'
s = read(path)
s = rep(s,
"  readonly tuneSourceName?: string;\n}",
"""  readonly tuneSourceName?: string;
  readonly openSamplesInLogger?: (request: {
    readonly sampleIndices: readonly number[];
    readonly timeMs: readonly number[];
    readonly label: string;
  }) => void | Promise<void>;
}""",
'histogram callback')
write(path, s)

# Logger public narrow navigation hook.
path = 'apps/web/src/pages/logger-page.ts'
s = read(path)
s = rep(s,
"  getAnalysisContext(): LoggerAnalysisContext;\n  restoreWorkspaceState(state: LoggerWorkspaceState): Promise<void>;",
"  getAnalysisContext(): LoggerAnalysisContext;\n  focusAnalysisTimes(timeMs: readonly number[]): void;\n  restoreWorkspaceState(state: LoggerWorkspaceState): Promise<void>;",
'logger interface focus')
# Insert implementation after viewport helpers where all internals are available.
marker = "  const setActivePane = (paneId: string, emit = true): void => {"
impl = """  const focusAnalysisTimes = (times: readonly number[]): void => {
    if (!viewport) return;
    const finite = [...new Set(times.filter((time) => Number.isFinite(time)))].sort((left, right) => left - right);
    if (finite.length === 0) return;
    const first = finite[0]!;
    const last = finite[finite.length - 1]!;
    const fullSpan = Math.max(1, viewport.fullEndMs - viewport.fullStartMs);
    const hitSpan = Math.max(0, last - first);
    const minimumSpan = Math.min(fullSpan, Math.max(500, fullSpan * 0.002));
    const desiredSpan = Math.min(fullSpan, Math.max(minimumSpan, hitSpan * 1.16));
    const midpoint = (first + last) / 2;
    let visibleStartMs = midpoint - desiredSpan / 2;
    let visibleEndMs = midpoint + desiredSpan / 2;
    if (visibleStartMs < viewport.fullStartMs) {
      visibleEndMs += viewport.fullStartMs - visibleStartMs;
      visibleStartMs = viewport.fullStartMs;
    }
    if (visibleEndMs > viewport.fullEndMs) {
      visibleStartMs -= visibleEndMs - viewport.fullEndMs;
      visibleEndMs = viewport.fullEndMs;
    }
    visibleStartMs = Math.max(viewport.fullStartMs, visibleStartMs);
    visibleEndMs = Math.min(viewport.fullEndMs, visibleEndMs);
    const nextViewport: TimelineViewport = {
      ...viewport,
      visibleStartMs,
      visibleEndMs,
    };
    if (!viewportEquals(viewport, nextViewport)) syncViewport(nextViewport, 'record');
    setCursorWithoutFollow(first);
    emitWorkspaceMutation();
  };

"""
if marker not in s: raise SystemExit('missing logger focus insertion marker')
s = s.replace(marker, impl + marker, 1)
# Return controller: replace known return tail field occurrence.
marker = "    getAnalysisContext,\n    restoreWorkspaceState,"
if marker not in s: raise SystemExit('missing logger return marker')
s = s.replace(marker, "    getAnalysisContext,\n    focusAnalysisTimes,\n    restoreWorkspaceState,", 1)
write(path, s)

# App shell passes callback and switches surface after navigation.
path = 'apps/web/src/app/app-shell.ts'
s = read(path)
old = """        ...(activeTuneModel ? { tuneModel: activeTuneModel } : {}),
        ...(activeTuneSourceName ? { tuneSourceName: activeTuneSourceName } : {}),
      });"""
new = """        ...(activeTuneModel ? { tuneModel: activeTuneModel } : {}),
        ...(activeTuneSourceName ? { tuneSourceName: activeTuneSourceName } : {}),
        openSamplesInLogger: (request) => {
          loggerPage.focusAnalysisTimes(request.timeMs);
          appStatus.textContent = `Logger · ${request.label} · ${request.sampleIndices.length.toLocaleString()} hits`;
          setEpicScopeMode('logger');
        },
      });"""
if old not in s: raise SystemExit('missing app shell histogram callback marker')
s = s.replace(old, new, 1)
write(path, s)

# Table Generator: overlay inspector + click drilldown.
path = 'apps/web/src/pages/histogram-table-generator-view.ts'
s = read(path)
s = rep(s,
'''      <div class="histogram-table-tooltip" hidden></div>
      <div class="histogram-table-status" hidden>''',
'''      <div class="histogram-table-tooltip" hidden></div>
      <aside class="histogram-cell-inspector" hidden>
        <header><div><strong class="histogram-cell-inspector-title">Cell samples</strong><small class="histogram-cell-inspector-subtitle">—</small></div><button type="button" class="histogram-cell-inspector-close" aria-label="Close cell inspector">×</button></header>
        <div class="histogram-cell-inspector-summary"></div>
        <div class="histogram-cell-sample-list"></div>
        <footer><span class="histogram-cell-list-note"></span><button type="button" class="histogram-cell-copy">Copy</button><button type="button" class="histogram-cell-open-logger">Open in Logger</button></footer>
      </aside>
      <div class="histogram-table-status" hidden>''',
'cell inspector html')
s = rep(s,
"  const tooltip = root.querySelector<HTMLElement>('.histogram-table-tooltip');",
"""  const tooltip = root.querySelector<HTMLElement>('.histogram-table-tooltip');
  const cellInspector = root.querySelector<HTMLElement>('.histogram-cell-inspector');
  const cellInspectorTitle = root.querySelector<HTMLElement>('.histogram-cell-inspector-title');
  const cellInspectorSubtitle = root.querySelector<HTMLElement>('.histogram-cell-inspector-subtitle');
  const cellInspectorSummary = root.querySelector<HTMLElement>('.histogram-cell-inspector-summary');
  const cellSampleList = root.querySelector<HTMLElement>('.histogram-cell-sample-list');
  const cellListNote = root.querySelector<HTMLElement>('.histogram-cell-list-note');
  const cellInspectorClose = root.querySelector<HTMLButtonElement>('.histogram-cell-inspector-close');
  const cellCopyButton = root.querySelector<HTMLButtonElement>('.histogram-cell-copy');
  const cellOpenLoggerButton = root.querySelector<HTMLButtonElement>('.histogram-cell-open-logger');""",
'cell inspector queries')
s = rep(s,
"    || !yMinInput || !yMaxInput || !showHitsInput || !exportButton || !empty || !status || !canvas || !tooltip",
"""    || !yMinInput || !yMaxInput || !showHitsInput || !exportButton || !empty || !status || !canvas || !tooltip
    || !cellInspector || !cellInspectorTitle || !cellInspectorSubtitle || !cellInspectorSummary || !cellSampleList || !cellListNote
    || !cellInspectorClose || !cellCopyButton || !cellOpenLoggerButton""",
'cell inspector structure')
# State for selected cell.
s = rep(s,
"  let currentFilterDescription = 'None';\n  let layout: ChartLayout | undefined;",
"""  let currentFilterDescription = 'None';
  let layout: ChartLayout | undefined;
  let selectedCell: { readonly cellIndex: number; readonly xIndex: number; readonly yIndex: number; readonly sampleIndices: readonly number[]; readonly timeMs: readonly number[]; readonly label: string } | undefined;""",
'cell inspector state')
# Helpers inserted before tooltip update; find function marker.
marker = "  const updateTooltip = (event: MouseEvent): void => {"
helpers = """  const cellAtPointer = (event: MouseEvent): { xIndex: number; yIndex: number; cellIndex: number } | undefined => {
    const result = currentResult;
    const currentLayout = layout;
    if (!result || !currentLayout || result.xBins.length === 0 || result.yBins.length === 0) return undefined;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < currentLayout.left || x > currentLayout.left + currentLayout.width || y < currentLayout.top || y > currentLayout.top + currentLayout.height) return undefined;
    const xIndex = Math.min(result.xBins.length - 1, Math.max(0, Math.floor((x - currentLayout.left) / currentLayout.cellWidth)));
    const yFromTop = Math.min(result.yBins.length - 1, Math.max(0, Math.floor((y - currentLayout.top) / currentLayout.cellHeight)));
    const yIndex = result.yBins.length - 1 - yFromTop;
    return { xIndex, yIndex, cellIndex: yIndex * result.xBins.length + xIndex };
  };

  const timeForSourceIndex = (sampleIndex: number): number | undefined => {
    const trace = currentXTrace;
    if (!trace) return undefined;
    const localIndex = sampleIndex - trace.range.startSampleIndex;
    if (!Number.isSafeInteger(localIndex) || localIndex < 0 || localIndex >= trace.range.timeMs.length) return undefined;
    const time = trace.range.timeMs[localIndex];
    return time !== undefined && Number.isFinite(time) ? time : undefined;
  };

  const closeCellInspector = (): void => {
    selectedCell = undefined;
    cellInspector.hidden = true;
  };

  const openCellInspector = (event: MouseEvent): void => {
    const result = currentResult;
    const xTrace = currentXTrace;
    const yTrace = currentYTrace;
    const cell = cellAtPointer(event);
    if (!result || !xTrace || !yTrace || !cell) return;
    const sourceIndices = [...(result.cellSampleIndices[cell.cellIndex] ?? new Uint32Array(0))];
    const times = sourceIndices.flatMap((sampleIndex) => {
      const time = timeForSourceIndex(sampleIndex);
      return time === undefined ? [] : [time];
    });
    const xBin = result.xBins[cell.xIndex]!;
    const yBin = result.yBins[cell.yIndex]!;
    const value = result.cellValues[cell.cellIndex];
    const count = result.counts[cell.cellIndex] ?? 0;
    const label = `${traceLabel(xTrace)} ${formatNumber(xBin.centerValue)} × ${traceLabel(yTrace)} ${formatNumber(yBin.centerValue)}`;
    selectedCell = { cellIndex: cell.cellIndex, xIndex: cell.xIndex, yIndex: cell.yIndex, sampleIndices: sourceIndices, timeMs: times, label };
    cellInspectorTitle.textContent = label;
    cellInspectorSubtitle.textContent = `${aggregationLabel(result.aggregationMethod)} ${formatCellValue(value, result.aggregationMethod, 120)} · ${count.toLocaleString()} hits`;
    cellInspectorSummary.innerHTML = `<span>${traceLabel(xTrace)} ${formatNumber(xBin.lowerBound)}–${formatNumber(xBin.upperBound)}</span><span>${traceLabel(yTrace)} ${formatNumber(yBin.lowerBound)}–${formatNumber(yBin.upperBound)}</span>`;
    const shown = sourceIndices.slice(0, 200);
    cellSampleList.replaceChildren(...shown.map((sampleIndex, index) => {
      const row = document.createElement('div');
      const time = times[index];
      row.innerHTML = `<span>#${sampleIndex.toLocaleString()}</span><strong>${time === undefined ? '—' : `${(time / 1000).toFixed(3)} s`}</strong>`;
      return row;
    }));
    cellListNote.textContent = sourceIndices.length > 200 ? `Showing 200 of ${sourceIndices.length.toLocaleString()} exact hits` : `${sourceIndices.length.toLocaleString()} exact hits`;
    cellOpenLoggerButton.disabled = times.length === 0 || !context.openSamplesInLogger;
    cellCopyButton.disabled = sourceIndices.length === 0;
    cellInspector.hidden = false;
  };

"""
if marker not in s: raise SystemExit('missing tooltip marker')
s = s.replace(marker, helpers + marker, 1)
# Simplify tooltip pointer cell computation to use shared helper but keep rect x/y for placement.
old = """    if (
      x < currentLayout.left || x > currentLayout.left + currentLayout.width
      || y < currentLayout.top || y > currentLayout.top + currentLayout.height
    ) {
      tooltip.hidden = true;
      return;
    }
    const xIndex = Math.min(result.xBins.length - 1, Math.max(0, Math.floor((x - currentLayout.left) / currentLayout.cellWidth)));
    const yFromTop = Math.min(result.yBins.length - 1, Math.max(0, Math.floor((y - currentLayout.top) / currentLayout.cellHeight)));
    const yIndex = result.yBins.length - 1 - yFromTop;
    const cellIndex = yIndex * result.xBins.length + xIndex;
"""
new = """    const cell = cellAtPointer(event);
    if (!cell) {
      tooltip.hidden = true;
      return;
    }
    const { xIndex, yIndex, cellIndex } = cell;
"""
if old not in s: raise SystemExit('missing tooltip cell geometry block')
s = s.replace(old, new, 1)
# Close inspector on new context/render to avoid stale sample identity.
s = rep(s,
"    context = nextContext;\n    refillChannelSelect(xSelect, previousX);",
"    context = nextContext;\n    closeCellInspector();\n    refillChannelSelect(xSelect, previousX);",
'setContext close inspector')
# Listeners.
marker = "  canvas.addEventListener('mousemove', updateTooltip);"
listeners = """  cellInspectorClose.addEventListener('click', closeCellInspector);
  cellCopyButton.addEventListener('click', () => {
    if (!selectedCell) return;
    const lines = selectedCell.sampleIndices.map((sampleIndex, index) => `${sampleIndex}\t${selectedCell!.timeMs[index] ?? ''}`);
    void navigator.clipboard.writeText(['sampleIndex\ttimeMs', ...lines].join('\n'));
  });
  cellOpenLoggerButton.addEventListener('click', () => {
    if (!selectedCell || !context.openSamplesInLogger || selectedCell.timeMs.length === 0) return;
    void context.openSamplesInLogger({ sampleIndices: selectedCell.sampleIndices, timeMs: selectedCell.timeMs, label: selectedCell.label });
  });
  canvas.addEventListener('click', openCellInspector);
"""
if marker not in s: raise SystemExit('missing canvas listener marker')
s = s.replace(marker, listeners + marker, 1)
write(path, s)

# Inspector overlay styling.
path = 'apps/web/src/styles/histogram-table-generator.css'
s = read(path)
s += r'''

.histogram-cell-inspector {
  position: absolute;
  z-index: 28;
  top: 10px;
  right: 10px;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  width: min(330px, 36vw);
  max-height: calc(100% - 42px);
  overflow: hidden;
  border: 1px solid #355164;
  border-radius: 4px;
  background: rgba(9, 22, 31, .97);
  box-shadow: 0 10px 28px rgba(0, 0, 0, .42);
  color: #dce9ef;
}
.histogram-cell-inspector[hidden] { display: none; }
.histogram-cell-inspector header,
.histogram-cell-inspector footer { display: flex; align-items: center; gap: 7px; padding: 7px 9px; }
.histogram-cell-inspector header { border-bottom: 1px solid #263d4b; }
.histogram-cell-inspector header > div { min-width: 0; display: grid; gap: 2px; }
.histogram-cell-inspector-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; }
.histogram-cell-inspector-subtitle { color: #8299a7; font-size: 8px; }
.histogram-cell-inspector-close { margin-left: auto; }
.histogram-cell-inspector-summary { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; padding: 6px 9px; color: #8ea5b2; font-size: 8px; border-bottom: 1px solid #1f3340; }
.histogram-cell-sample-list { min-height: 70px; overflow: auto; padding: 3px 0; }
.histogram-cell-sample-list > div { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 3px 9px; border-bottom: 1px solid rgba(34, 54, 66, .45); font-size: 8px; font-variant-numeric: tabular-nums; }
.histogram-cell-sample-list span { color: #718a99; }
.histogram-cell-sample-list strong { text-align: right; font-weight: 600; }
.histogram-cell-inspector footer { border-top: 1px solid #263d4b; }
.histogram-cell-list-note { flex: 1; color: #718a99; font-size: 8px; }
.histogram-cell-inspector button { min-height: 25px; border: 1px solid #2b4554; border-radius: 3px; background: #0f1d27; color: #dce9ef; font-size: 8px; padding: 0 7px; }
.histogram-cell-inspector button:disabled { opacity: .45; }
'''
write(path, s)

Path('scripts/tmp-cell-drilldown.py').unlink(missing_ok=True)
