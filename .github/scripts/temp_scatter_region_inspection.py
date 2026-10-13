from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor not found in {path}: {old[:120]!r}')
    if text.count(old) != 1:
        raise SystemExit(f'anchor not unique in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))

# Core: summarize discontiguous region evidence as contiguous visits.
replace_once(
    'core/analysis/scatter.ts',
    "export interface NumericScatterRegionSelection {\n  /** Source sample indices whose valid X/Y pair lies inside the inclusive region. */\n  readonly sampleIndices: Uint32Array;\n  readonly selectedPairCount: number;\n}\n",
    "export interface NumericScatterRegionSelection {\n  /** Source sample indices whose valid X/Y pair lies inside the inclusive region. */\n  readonly sampleIndices: Uint32Array;\n  readonly selectedPairCount: number;\n}\n\nexport interface NumericScatterRegionRun {\n  readonly startSampleIndex: number;\n  readonly endSampleIndex: number;\n  readonly sampleCount: number;\n}\n\nexport interface NumericScatterRegionRunSummary {\n  readonly runs: readonly NumericScatterRegionRun[];\n  readonly runCount: number;\n  readonly strongestRun: NumericScatterRegionRun | undefined;\n}\n"
)

replace_once(
    'core/analysis/scatter.ts',
    "  return {\n    sampleIndices: Uint32Array.from(selected),\n    selectedPairCount: selected.length,\n  };\n}\n",
    "  return {\n    sampleIndices: Uint32Array.from(selected),\n    selectedPairCount: selected.length,\n  };\n}\n\n/** Group selected source samples into contiguous visits through a scatter region. */\nexport function summarizeNumericScatterRegionRuns(\n  selection: NumericScatterRegionSelection,\n  maxGapSamples = 1,\n): NumericScatterRegionRunSummary {\n  const indices = [...selection.sampleIndices].sort((left, right) => left - right);\n  const runs: NumericScatterRegionRun[] = [];\n  const allowedGap = Math.max(1, Math.floor(maxGapSamples));\n  let start: number | undefined;\n  let previous: number | undefined;\n  let count = 0;\n\n  const flush = (): void => {\n    if (start === undefined || previous === undefined || count === 0) return;\n    runs.push({ startSampleIndex: start, endSampleIndex: previous, sampleCount: count });\n  };\n\n  for (const sampleIndex of indices) {\n    if (start === undefined || previous === undefined) {\n      start = sampleIndex; previous = sampleIndex; count = 1; continue;\n    }\n    if (sampleIndex - previous <= allowedGap) {\n      previous = sampleIndex; count += 1; continue;\n    }\n    flush();\n    start = sampleIndex; previous = sampleIndex; count = 1;\n  }\n  flush();\n\n  let strongestRun: NumericScatterRegionRun | undefined;\n  for (const run of runs) {\n    if (!strongestRun || run.sampleCount > strongestRun.sampleCount) strongestRun = run;\n  }\n  return { runs, runCount: runs.length, strongestRun };\n}\n"
)

# Scatter view imports + pane card structure.
replace_once(
    'apps/web/src/pages/scatter-view.ts',
    "import { buildNumericScatter, selectNumericScatterRegion, type NumericScatterRegionSelection, type NumericScatterResult } from '../../../../core/analysis/scatter';",
    "import { buildNumericScatter, selectNumericScatterRegion, summarizeNumericScatterRegionRuns, type NumericScatterRegionSelection, type NumericScatterResult } from '../../../../core/analysis/scatter';"
)

replace_once(
    'apps/web/src/pages/scatter-view.ts',
    "  readonly pointClear: HTMLButtonElement;\n  readonly regionDragOverlay: HTMLElement;\n",
    "  readonly pointClear: HTMLButtonElement;\n  readonly regionDragOverlay: HTMLElement;\n  readonly regionCard: HTMLElement;\n  readonly regionCardCount: HTMLElement;\n  readonly regionCardBounds: HTMLElement;\n  readonly regionCardVisits: HTMLElement;\n  readonly regionOpenLogger: HTMLButtonElement;\n  readonly regionClear: HTMLButtonElement;\n"
)

replace_once(
    'apps/web/src/pages/scatter-view.ts',
    "      <canvas class=\"scatter-pane-chart\" aria-label=\"Scatter plot\"></canvas>\n      <div class=\"scatter-region-drag\" hidden></div>\n      <div class=\"scatter-pane-title\"></div>\n",
    "      <canvas class=\"scatter-pane-chart\" aria-label=\"Scatter plot\"></canvas>\n      <div class=\"scatter-region-drag\" hidden></div>\n      <div class=\"scatter-pane-title\"></div>\n      <aside class=\"scatter-region-card\" hidden aria-live=\"polite\">\n        <strong>Region evidence</strong>\n        <div class=\"scatter-region-card-count\">—</div>\n        <div class=\"scatter-region-card-bounds\">—</div>\n        <div class=\"scatter-region-card-visits\">—</div>\n        <div class=\"scatter-region-card-actions\">\n          <button type=\"button\" class=\"scatter-region-open-logger\">Open strongest visit in Logger</button>\n          <button type=\"button\" class=\"scatter-region-clear\">Clear</button>\n        </div>\n      </aside>\n"
)

replace_once(
    'apps/web/src/pages/scatter-view.ts',
    "  const pointClear = root.querySelector<HTMLButtonElement>('.scatter-point-clear');\n  const regionDragOverlay = root.querySelector<HTMLElement>('.scatter-region-drag');\n  if (!xSelect || !ySelect || !canvas || !title || !status || !pointDetail || !pointLabel || !pointOpenLogger || !pointClear || !regionDragOverlay) {\n",
    "  const pointClear = root.querySelector<HTMLButtonElement>('.scatter-point-clear');\n  const regionDragOverlay = root.querySelector<HTMLElement>('.scatter-region-drag');\n  const regionCard = root.querySelector<HTMLElement>('.scatter-region-card');\n  const regionCardCount = root.querySelector<HTMLElement>('.scatter-region-card-count');\n  const regionCardBounds = root.querySelector<HTMLElement>('.scatter-region-card-bounds');\n  const regionCardVisits = root.querySelector<HTMLElement>('.scatter-region-card-visits');\n  const regionOpenLogger = root.querySelector<HTMLButtonElement>('.scatter-region-open-logger');\n  const regionClear = root.querySelector<HTMLButtonElement>('.scatter-region-clear');\n  if (!xSelect || !ySelect || !canvas || !title || !status || !pointDetail || !pointLabel || !pointOpenLogger || !pointClear || !regionDragOverlay || !regionCard || !regionCardCount || !regionCardBounds || !regionCardVisits || !regionOpenLogger || !regionClear) {\n"
)

replace_once(
    'apps/web/src/pages/scatter-view.ts',
    "    root, xSelect, ySelect, canvas, title, status, pointDetail, pointLabel, pointOpenLogger, pointClear, regionDragOverlay,\n",
    "    root, xSelect, ySelect, canvas, title, status, pointDetail, pointLabel, pointOpenLogger, pointClear, regionDragOverlay,\n    regionCard, regionCardCount, regionCardBounds, regionCardVisits, regionOpenLogger, regionClear,\n"
)

# Hide card on reset paths.
text_path = Path('apps/web/src/pages/scatter-view.ts')
text = text_path.read_text()
text = text.replace("pane.regionDragOverlay.hidden = true; pane.pointDetail.hidden = true;", "pane.regionDragOverlay.hidden = true; pane.regionCard.hidden = true; pane.pointDetail.hidden = true;")
text = text.replace("      pane.regionDragOverlay.hidden = true;\n      pane.pointDetail.hidden = true;", "      pane.regionDragOverlay.hidden = true;\n      pane.regionCard.hidden = true;\n      pane.pointDetail.hidden = true;")
text_path.write_text(text)

# Replace selection detail: region gets prominent card + visit summary; point keeps compact strip.
old = """  const updateSelectionDetail = (pane: ScatterPaneState): void => {
    const result = pane.result;
    const xTrace = pane.xTrace;
    const yTrace = pane.yTrace;
    if (!result || !xTrace || !yTrace) { pane.pointDetail.hidden = true; return; }

    if (pane.selectedRegion) {
      const region = pane.selectedRegion;
      pane.pointLabel.textContent = `${region.selection.selectedPairCount.toLocaleString()} / ${result.validPairSampleCount.toLocaleString()} pairs · ${channelLabel(xTrace)} ${formatNumber(region.xMin)}–${formatNumber(region.xMax)} · ${channelLabel(yTrace)} ${formatNumber(region.yMin)}–${formatNumber(region.yMax)}`;
      pane.pointOpenLogger.textContent = 'Open region in Logger';
      pane.pointOpenLogger.disabled = !context.openSamplesInLogger || region.selection.selectedPairCount === 0;
      pane.pointDetail.hidden = false;
      return;
    }

    const index = pane.selectedResultIndex;
    if (index === undefined) { pane.pointDetail.hidden = true; return; }
"""
new = """  const sampleTime = (trace: HistogramTraceContext, sampleIndex: number): number | undefined => {
    const localIndex = sampleIndex - trace.range.startSampleIndex;
    const time = localIndex >= 0 && localIndex < trace.range.timeMs.length ? trace.range.timeMs[localIndex] : undefined;
    return time !== undefined && Number.isFinite(time) ? time : undefined;
  };

  const updateSelectionDetail = (pane: ScatterPaneState): void => {
    const result = pane.result;
    const xTrace = pane.xTrace;
    const yTrace = pane.yTrace;
    if (!result || !xTrace || !yTrace) { pane.regionCard.hidden = true; pane.pointDetail.hidden = true; return; }

    if (pane.selectedRegion) {
      const region = pane.selectedRegion;
      const visits = summarizeNumericScatterRegionRuns(region.selection);
      const strongest = visits.strongestRun;
      const firstTime = strongest ? sampleTime(xTrace, strongest.startSampleIndex) : undefined;
      const lastTime = strongest ? sampleTime(xTrace, strongest.endSampleIndex) : undefined;
      const duration = firstTime !== undefined && lastTime !== undefined ? Math.max(0, lastTime - firstTime) : undefined;
      const share = result.validPairSampleCount > 0 ? (region.selection.selectedPairCount / result.validPairSampleCount) * 100 : 0;
      pane.regionCardCount.textContent = `${region.selection.selectedPairCount.toLocaleString()} of ${result.validPairSampleCount.toLocaleString()} pairs · ${share.toFixed(1)}%`;
      pane.regionCardBounds.textContent = `${channelLabel(xTrace)} ${formatNumber(region.xMin)}–${formatNumber(region.xMax)}${xTrace.channel.unit ? ` ${xTrace.channel.unit}` : ''} · ${channelLabel(yTrace)} ${formatNumber(region.yMin)}–${formatNumber(region.yMax)}${yTrace.channel.unit ? ` ${yTrace.channel.unit}` : ''}`;
      pane.regionCardVisits.textContent = `${visits.runCount.toLocaleString()} contiguous visit${visits.runCount === 1 ? '' : 's'}${strongest ? ` · strongest ${strongest.sampleCount.toLocaleString()} samples${duration !== undefined ? ` · ${(duration / 1000).toFixed(duration >= 1000 ? 2 : 3)} s` : ''}` : ''}`;
      pane.regionOpenLogger.disabled = !context.openSamplesInLogger || !strongest;
      pane.regionCard.hidden = false;
      pane.pointDetail.hidden = true;
      return;
    }

    pane.regionCard.hidden = true;
    const index = pane.selectedResultIndex;
    if (index === undefined) { pane.pointDetail.hidden = true; return; }
"""
replace_once('apps/web/src/pages/scatter-view.ts', old, new)

# Clicking a point should close region card; clearing point also closes it.
replace_once(
    'apps/web/src/pages/scatter-view.ts',
    "      pane.selectedRegion = undefined;\n      pane.selectedResultIndex = index;\n",
    "      pane.selectedRegion = undefined;\n      pane.regionCard.hidden = true;\n      pane.selectedResultIndex = index;\n"
)
replace_once(
    'apps/web/src/pages/scatter-view.ts',
    "      pane.selectedRegion = undefined;\n      pane.pointDetail.hidden = true;\n",
    "      pane.selectedRegion = undefined;\n      pane.regionCard.hidden = true;\n      pane.pointDetail.hidden = true;\n"
)

# Region clear + strongest contiguous visit navigation. Remove region branch from point button.
old = """    pane.pointOpenLogger.addEventListener('click', () => {
      const result = pane.result;
      const xTrace = pane.xTrace;
      const yTrace = pane.yTrace;
      if (!result || !xTrace || !yTrace || !context.openSamplesInLogger) return;

      if (pane.selectedRegion) {
        const sampleIndices: number[] = [];
        const timeMs: number[] = [];
        for (const sampleIndex of pane.selectedRegion.selection.sampleIndices) {
          const localIndex = sampleIndex - xTrace.range.startSampleIndex;
          const time = localIndex >= 0 && localIndex < xTrace.range.timeMs.length ? xTrace.range.timeMs[localIndex] : undefined;
          if (time === undefined || !Number.isFinite(time)) continue;
          sampleIndices.push(sampleIndex);
          timeMs.push(time);
        }
        if (timeMs.length === 0) return;
        void context.openSamplesInLogger({
          sampleIndices,
          timeMs,
          label: `${channelLabel(yTrace)} vs ${channelLabel(xTrace)} region · ${sampleIndices.length.toLocaleString()} pairs`,
        });
        return;
      }

      const index = pane.selectedResultIndex;
"""
new = """    pane.regionClear.addEventListener('click', () => {
      pane.selectedRegion = undefined;
      pane.regionCard.hidden = true;
      if (pane.result && pane.xTrace && pane.yTrace) renderPane(pane, pane.result, pane.xTrace, pane.yTrace);
    });
    pane.regionOpenLogger.addEventListener('click', () => {
      const region = pane.selectedRegion;
      const xTrace = pane.xTrace;
      const yTrace = pane.yTrace;
      if (!region || !xTrace || !yTrace || !context.openSamplesInLogger) return;
      const strongest = summarizeNumericScatterRegionRuns(region.selection).strongestRun;
      if (!strongest) return;
      const sampleIndices: number[] = [];
      const timeMs: number[] = [];
      for (const sampleIndex of region.selection.sampleIndices) {
        if (sampleIndex < strongest.startSampleIndex || sampleIndex > strongest.endSampleIndex) continue;
        const time = sampleTime(xTrace, sampleIndex);
        if (time === undefined) continue;
        sampleIndices.push(sampleIndex);
        timeMs.push(time);
      }
      if (timeMs.length === 0) return;
      void context.openSamplesInLogger({
        sampleIndices,
        timeMs,
        label: `${channelLabel(yTrace)} vs ${channelLabel(xTrace)} region · strongest visit · ${sampleIndices.length.toLocaleString()} pairs`,
      });
    });
    pane.pointOpenLogger.addEventListener('click', () => {
      const result = pane.result;
      const xTrace = pane.xTrace;
      const yTrace = pane.yTrace;
      if (!result || !xTrace || !yTrace || !context.openSamplesInLogger) return;
      const index = pane.selectedResultIndex;
"""
replace_once('apps/web/src/pages/scatter-view.ts', old, new)

# CSS: prominent in-plot card.
replace_once(
    'apps/web/src/styles/scatter-mlv.css',
    ".scatter-region-drag[hidden] { display: none !important; }\n",
    ".scatter-region-drag[hidden] { display: none !important; }\n\n.scatter-region-card {\n  position: absolute;\n  z-index: 4;\n  top: 44px;\n  left: 74px;\n  width: min(360px, calc(100% - 160px));\n  box-sizing: border-box;\n  padding: 9px 10px 8px;\n  border: 1px solid #4e849f;\n  border-radius: 4px;\n  background: rgba(5, 16, 24, .94);\n  box-shadow: 0 4px 18px rgba(0, 0, 0, .42);\n  color: #dce9ef;\n  font-size: 10px;\n  line-height: 1.35;\n}\n.scatter-region-card[hidden] { display: none !important; }\n.scatter-region-card > strong { display: block; margin-bottom: 4px; color: #f4f8fa; font-size: 12px; }\n.scatter-region-card-count { color: #bfe3f7; font-size: 11px; font-weight: 800; }\n.scatter-region-card-bounds { margin-top: 3px; color: #d0dde4; }\n.scatter-region-card-visits { margin-top: 3px; color: #91a9b6; }\n.scatter-region-card-actions { display: flex; gap: 6px; margin-top: 8px; }\n.scatter-region-card button {\n  min-height: 27px;\n  border: 1px solid #31566b;\n  border-radius: 3px;\n  background: #0f2533;\n  color: #e2edf2;\n  padding: 0 9px;\n  font-size: 9px;\n}\n.scatter-region-card button:hover:not(:disabled) { background: #163447; }\n.scatter-region-card button:disabled { opacity: .5; }\n"
)

replace_once(
    'apps/web/src/styles/scatter-mlv.css',
    "  .scatter-point-label { display: none; }\n}",
    "  .scatter-point-label { display: none; }\n  .scatter-region-card { left: 62px; width: calc(100% - 128px); }\n}\n"
)

# Help wording.
replace_once(
    'apps/web/src/pages/histogram-help.ts',
    "  text: 'Drag a box inside the plot to select every qualified X/Y pair in that value region, including points omitted from the reduced visible drawing. The region count and bounds remain visible and the full selected evidence can be opened in Logger. A simple click still selects one rendered point.',",
    "  text: 'Drag a box inside the plot to select every qualified X/Y pair in that value region, including points omitted from the reduced visible drawing. A prominent card shows pair share, X/Y bounds and how many contiguous visits crossed the region. Open strongest visit focuses Logger on the densest continuous occurrence instead of fitting every scattered hit across the whole log. A simple click still selects one rendered point.',"
)

# Tests for run grouping.
replace_once(
    'tests/analysis/scatter.test.ts',
    "import { buildNumericScatter, selectNumericScatterRegion } from '../../core/analysis/scatter';",
    "import { buildNumericScatter, selectNumericScatterRegion, summarizeNumericScatterRegionRuns } from '../../core/analysis/scatter';"
)
replace_once(
    'tests/analysis/scatter.test.ts',
    "  it('returns an empty evidence set when no pair lies inside the region', () => {\n",
    "  it('groups discontiguous region hits into visits and identifies the strongest visit', () => {\n    const summary = summarizeNumericScatterRegionRuns({\n      sampleIndices: Uint32Array.from([10, 11, 12, 20, 21, 30]),\n      selectedPairCount: 6,\n    });\n\n    expect(summary.runCount).toBe(3);\n    expect(summary.runs).toEqual([\n      { startSampleIndex: 10, endSampleIndex: 12, sampleCount: 3 },\n      { startSampleIndex: 20, endSampleIndex: 21, sampleCount: 2 },\n      { startSampleIndex: 30, endSampleIndex: 30, sampleCount: 1 },\n    ]);\n    expect(summary.strongestRun).toEqual({ startSampleIndex: 10, endSampleIndex: 12, sampleCount: 3 });\n  });\n\n  it('returns an empty visit summary for an empty region selection', () => {\n    const summary = summarizeNumericScatterRegionRuns({ sampleIndices: new Uint32Array(), selectedPairCount: 0 });\n    expect(summary.runCount).toBe(0);\n    expect(summary.strongestRun).toBeUndefined();\n  });\n\n  it('returns an empty evidence set when no pair lies inside the region', () => {\n"
)

# Docs clarify navigation semantics.
replace_once(
    'docs/HISTOGRAM.md',
    "- selected-region sample count/provenance;\n- selected-region → Logger navigation.\n",
    "- selected-region sample count/provenance;\n- prominent in-plot region summary with pair share, X/Y bounds and contiguous-visit count;\n- selected-region → Logger navigation focused on the strongest contiguous visit instead of the full first-to-last hit envelope.\n"
)

print('scatter region inspection transform complete')
