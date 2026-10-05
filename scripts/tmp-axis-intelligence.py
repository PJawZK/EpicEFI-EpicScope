from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f'missing replacement marker in {path}: {old[:120]!r}')
    text = text.replace(old, new, 1)
    write(path, text)

# --- Core heatmap: explicit irregular axis centers ---
path = 'core/analysis/heatmap.ts'
text = read(path)
text = text.replace(
    "  readonly yMin?: number;\n  readonly yMax?: number;\n  /** Cell statistic. Defaults to sample count/density. */",
    "  readonly yMin?: number;\n  readonly yMax?: number;\n  /** Optional explicit cell-center values. When supplied, irregular midpoint boundaries are used. */\n  readonly xAxisValues?: readonly number[];\n  readonly yAxisValues?: readonly number[];\n  /** Cell statistic. Defaults to sample count/density. */",
    1,
)
text = text.replace(
    "export interface NumericHeatmapAxisBin {\n  readonly index: number;\n  readonly lowerBound: number;\n  readonly upperBound: number;\n  readonly includesUpperBound: boolean;\n}",
    "export interface NumericHeatmapAxisBin {\n  readonly index: number;\n  readonly lowerBound: number;\n  readonly upperBound: number;\n  /** Display/table center. Equals the midpoint for uniform bins and the requested breakpoint for explicit axes. */\n  readonly centerValue: number;\n  readonly includesUpperBound: boolean;\n}",
    1,
)
pattern = re.compile(r"function buildAxisBins\([\s\S]*?\nfunction emptyResult\(", re.M)
replacement = r'''function normalizedAxisValues(values: readonly number[] | undefined, axis: 'x' | 'y'): readonly number[] | undefined {
  if (values === undefined) return undefined;
  if (values.length === 0) throw new RangeError(`heatmap ${axis}AxisValues must not be empty.`);
  const sorted = [...values];
  for (const value of sorted) {
    if (!Number.isFinite(value)) throw new RangeError(`heatmap ${axis}AxisValues must contain only finite values.`);
  }
  sorted.sort((left, right) => left - right);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index] === sorted[index - 1]) throw new RangeError(`heatmap ${axis}AxisValues must be unique.`);
  }
  return sorted;
}

function buildUniformAxisBins(min: number, max: number, requestedCount: number): {
  readonly bins: readonly NumericHeatmapAxisBin[];
  readonly width: number;
} {
  if (min === max) {
    return {
      bins: [{ index: 0, lowerBound: min, upperBound: max, centerValue: min, includesUpperBound: true }],
      width: 0,
    };
  }

  const width = (max - min) / requestedCount;
  const bins: NumericHeatmapAxisBin[] = [];
  for (let index = 0; index < requestedCount; index += 1) {
    const lowerBound = min + width * index;
    const upperBound = index === requestedCount - 1 ? max : min + width * (index + 1);
    bins.push({
      index,
      lowerBound,
      upperBound,
      centerValue: (lowerBound + upperBound) / 2,
      includesUpperBound: index === requestedCount - 1,
    });
  }
  return { bins, width };
}

function buildExplicitAxisBins(
  centers: readonly number[],
  observedMin: number,
  observedMax: number,
): { readonly bins: readonly NumericHeatmapAxisBin[]; readonly width: undefined } {
  if (centers.length === 1) {
    const center = centers[0]!;
    return {
      bins: [{
        index: 0,
        lowerBound: Math.min(center, observedMin),
        upperBound: Math.max(center, observedMax),
        centerValue: center,
        includesUpperBound: true,
      }],
      width: undefined,
    };
  }

  const boundaries: number[] = [];
  boundaries.push(centers[0]! - (centers[1]! - centers[0]!) / 2);
  for (let index = 1; index < centers.length; index += 1) {
    boundaries.push((centers[index - 1]! + centers[index]!) / 2);
  }
  boundaries.push(centers[centers.length - 1]! + (centers[centers.length - 1]! - centers[centers.length - 2]!) / 2);

  return {
    bins: centers.map((centerValue, index) => ({
      index,
      lowerBound: boundaries[index]!,
      upperBound: boundaries[index + 1]!,
      centerValue,
      includesUpperBound: index === centers.length - 1,
    })),
    width: undefined,
  };
}

function buildAxisBins(
  min: number,
  max: number,
  requestedCount: number,
  explicitCenters: readonly number[] | undefined,
): { readonly bins: readonly NumericHeatmapAxisBin[]; readonly width: number | undefined } {
  return explicitCenters
    ? buildExplicitAxisBins(explicitCenters, min, max)
    : buildUniformAxisBins(min, max, requestedCount);
}

function binIndexForBins(value: number, bins: readonly NumericHeatmapAxisBin[]): number | undefined {
  for (let index = 0; index < bins.length; index += 1) {
    const bin = bins[index]!;
    if (value < bin.lowerBound) continue;
    if (value < bin.upperBound || (bin.includesUpperBound && value <= bin.upperBound)) return index;
  }
  return undefined;
}

function emptyResult('''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit('failed to replace heatmap axis builder')
text = text.replace(
    "  const requestedYMax = requestedBound(options.yMax, 'yMax');\n  const scan = scanPairs(xRange, yRange, options.sampleIndices);",
    "  const requestedYMax = requestedBound(options.yMax, 'yMax');\n  const explicitXAxisValues = normalizedAxisValues(options.xAxisValues, 'x');\n  const explicitYAxisValues = normalizedAxisValues(options.yAxisValues, 'y');\n  const scan = scanPairs(xRange, yRange, options.sampleIndices);",
    1,
)
old_block = """  const xLower = requestedXMin ?? scan.xObservedMin!;
  const xUpper = requestedXMax ?? scan.xObservedMax!;
  const yLower = requestedYMin ?? scan.yObservedMin!;
  const yUpper = requestedYMax ?? scan.yObservedMax!;
  const xRangeMin = Math.min(xLower, xUpper);
  const xRangeMax = Math.max(xLower, xUpper);
  const yRangeMin = Math.min(yLower, yUpper);
  const yRangeMax = Math.max(yLower, yUpper);

  const xAxis = buildAxisBins(xRangeMin, xRangeMax, normalizedBinCount(options.xBinCount, 'x'));
  const yAxis = buildAxisBins(yRangeMin, yRangeMax, normalizedBinCount(options.yBinCount, 'y'));
"""
new_block = """  const xLower = requestedXMin ?? scan.xObservedMin!;
  const xUpper = requestedXMax ?? scan.xObservedMax!;
  const yLower = requestedYMin ?? scan.yObservedMin!;
  const yUpper = requestedYMax ?? scan.yObservedMax!;
  const xObservedRangeMin = Math.min(xLower, xUpper);
  const xObservedRangeMax = Math.max(xLower, xUpper);
  const yObservedRangeMin = Math.min(yLower, yUpper);
  const yObservedRangeMax = Math.max(yLower, yUpper);

  const xAxis = buildAxisBins(xObservedRangeMin, xObservedRangeMax, normalizedBinCount(options.xBinCount, 'x'), explicitXAxisValues);
  const yAxis = buildAxisBins(yObservedRangeMin, yObservedRangeMax, normalizedBinCount(options.yBinCount, 'y'), explicitYAxisValues);
  const xRangeMin = xAxis.bins[0]!.lowerBound;
  const xRangeMax = xAxis.bins[xAxis.bins.length - 1]!.upperBound;
  const yRangeMin = yAxis.bins[0]!.lowerBound;
  const yRangeMax = yAxis.bins[yAxis.bins.length - 1]!.upperBound;
"""
if old_block not in text:
    raise SystemExit('missing heatmap range block')
text = text.replace(old_block, new_block, 1)
text = text.replace(
    "    const xIndex = binIndex(pair.x, xRangeMin, xRangeMax, xAxis.width, xAxis.bins.length);\n    const yIndex = binIndex(pair.y, yRangeMin, yRangeMax, yAxis.width, yAxis.bins.length);\n    const cellIndex = yIndex * xAxis.bins.length + xIndex;",
    "    const xIndex = binIndexForBins(pair.x, xAxis.bins);\n    const yIndex = binIndexForBins(pair.y, yAxis.bins);\n    if (xIndex === undefined || yIndex === undefined) { outsideRangeSampleCount += 1; continue; }\n    const cellIndex = yIndex * xAxis.bins.length + xIndex;",
    1,
)
write(path, text)

# Tests for irregular explicit axes.
path = 'tests/analysis/heatmap.test.ts'
text = read(path)
marker = "  it('rejects non-finite configuration values', () => {"
test = r'''  it('uses explicit irregular axis centers with midpoint cell boundaries', () => {
    const result = buildNumericHeatmap(
      range(0, [900, 1100, 1900, 2500, 3900, 4100]),
      range(0, [45, 55, 70, 95, 105, 120]),
      { xAxisValues: [4000, 1000, 2000], yAxisValues: [50, 100] },
    );

    expect(result.xBins.map((bin) => bin.centerValue)).toEqual([1000, 2000, 4000]);
    expect(result.yBins.map((bin) => bin.centerValue)).toEqual([50, 100]);
    expect(result.xBins[0]).toMatchObject({ lowerBound: 500, upperBound: 1500 });
    expect(result.xBins[1]).toMatchObject({ lowerBound: 1500, upperBound: 3000 });
    expect(result.xBins[2]).toMatchObject({ lowerBound: 3000, upperBound: 5000, includesUpperBound: true });
    expect([...result.counts].reduce((sum, value) => sum + value, 0)).toBe(6);
    expect(result.xBinWidth).toBeUndefined();
    expect(result.yBinWidth).toBeUndefined();
  });

  it('rejects duplicate explicit axis centers', () => {
    expect(() => buildNumericHeatmap(
      range(0, [1, 2]),
      range(0, [3, 4]),
      { xAxisValues: [1, 1] },
    )).toThrow(/must be unique/);
  });

'''
if marker not in text:
    raise SystemExit('missing heatmap test insertion marker')
text = text.replace(marker, test + marker, 1)
write(path, text)

# Histogram context receives optional loaded tune model.
path = 'apps/web/src/pages/histogram-page.ts'
text = read(path)
text = text.replace(
    "import type { ChannelDefinition, NumericChannelRange } from '../../../../core/log-model/log-types';",
    "import type { ChannelDefinition, NumericChannelRange } from '../../../../core/log-model/log-types';\nimport type { TuneModel } from '../../../../core/tune/tune-model';",
    1,
)
text = text.replace(
    "  readonly savedRanges?: readonly import('../state/workspace-state').SavedTimelineRangeState[];\n}",
    "  readonly savedRanges?: readonly import('../state/workspace-state').SavedTimelineRangeState[];\n  readonly tuneModel?: TuneModel;\n  readonly tuneSourceName?: string;\n}",
    1,
)
write(path, text)

# Pass the already-loaded MSQ tune context into Histogram mode.
path = 'apps/web/src/app/app-shell.ts'
text = read(path)
old = "      histogramPage.setContext(loggerPage.getAnalysisContext());"
new = """      histogramPage.setContext({
        ...loggerPage.getAnalysisContext(),
        ...(activeTuneModel ? { tuneModel: activeTuneModel } : {}),
        ...(activeTuneSourceName ? { tuneSourceName: activeTuneSourceName } : {}),
      });"""
if old not in text:
    raise SystemExit('missing histogram app-shell context marker')
text = text.replace(old, new, 1)
write(path, text)

# Table Generator: custom/MSQ axis source controls.
path = 'apps/web/src/pages/histogram-table-generator-view.ts'
text = read(path)
text = text.replace(
    "import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';",
    "import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';\nimport { createTuneTable2D } from '../../../../core/tune/table-correlation';",
    1,
)
text = text.replace(
    "        <div class=\"histogram-table-options-popover\">\n          <label><span>X columns</span><input class=\"histogram-table-x-bins\" type=\"number\" min=\"1\" max=\"64\" step=\"1\" value=\"16\" /></label>",
    """        <div class=\"histogram-table-options-popover\">
          <label><span>Axis source</span><select class=\"histogram-table-axis-source\"><option value=\"auto\">Auto bins</option><option value=\"custom\">Custom breakpoints</option><option value=\"msq\">Loaded MSQ table</option></select></label>
          <div class=\"histogram-table-axis-custom\" hidden>
            <label><span>X breakpoints</span><input class=\"histogram-table-x-breakpoints\" type=\"text\" placeholder=\"800, 1200, 1600, …\" /></label>
            <label><span>Y breakpoints</span><input class=\"histogram-table-y-breakpoints\" type=\"text\" placeholder=\"30, 50, 70, …\" /></label>
          </div>
          <div class=\"histogram-table-axis-msq\" hidden>
            <label><span>MSQ table</span><select class=\"histogram-table-msq-table\"></select></label>
            <label><span>X axis</span><select class=\"histogram-table-msq-x-axis\"></select></label>
            <label><span>Y axis</span><select class=\"histogram-table-msq-y-axis\"></select></label>
          </div>
          <label><span>X columns</span><input class=\"histogram-table-x-bins\" type=\"number\" min=\"1\" max=\"64\" step=\"1\" value=\"16\" /></label>""",
    1,
)
text = text.replace(
    "  const addFilterButton = root.querySelector<HTMLButtonElement>('.histogram-add-filter');\n  const xBinsInput = root.querySelector<HTMLInputElement>('.histogram-table-x-bins');",
    """  const addFilterButton = root.querySelector<HTMLButtonElement>('.histogram-add-filter');
  const axisSourceSelect = root.querySelector<HTMLSelectElement>('.histogram-table-axis-source');
  const customAxisFields = root.querySelector<HTMLElement>('.histogram-table-axis-custom');
  const xBreakpointsInput = root.querySelector<HTMLInputElement>('.histogram-table-x-breakpoints');
  const yBreakpointsInput = root.querySelector<HTMLInputElement>('.histogram-table-y-breakpoints');
  const msqAxisFields = root.querySelector<HTMLElement>('.histogram-table-axis-msq');
  const msqTableSelect = root.querySelector<HTMLSelectElement>('.histogram-table-msq-table');
  const msqXAxisSelect = root.querySelector<HTMLSelectElement>('.histogram-table-msq-x-axis');
  const msqYAxisSelect = root.querySelector<HTMLSelectElement>('.histogram-table-msq-y-axis');
  const xBinsInput = root.querySelector<HTMLInputElement>('.histogram-table-x-bins');""",
    1,
)
text = text.replace(
    "    || !filterCount || !filterList || !addFilterButton || !xBinsInput || !yBinsInput || !xMinInput || !xMaxInput\n    || !yMinInput || !yMaxInput || !showHitsInput || !exportButton || !empty || !status || !canvas || !tooltip",
    """    || !filterCount || !filterList || !addFilterButton || !axisSourceSelect || !customAxisFields || !xBreakpointsInput || !yBreakpointsInput
    || !msqAxisFields || !msqTableSelect || !msqXAxisSelect || !msqYAxisSelect || !xBinsInput || !yBinsInput || !xMinInput || !xMaxInput
    || !yMinInput || !yMaxInput || !showHitsInput || !exportButton || !empty || !status || !canvas || !tooltip""",
    1,
)
# Insert axis helpers before updateFilterCount.
marker = "  const updateFilterCount = (): void => {"
helpers = r'''  const parseBreakpointList = (input: HTMLInputElement): readonly number[] | undefined => {
    const raw = input.value.trim();
    if (!raw) return undefined;
    const values = raw.split(/[\s,;]+/).filter(Boolean).map(Number);
    if (values.length === 0 || values.some((value) => !Number.isFinite(value))) return undefined;
    return values;
  };

  const populateMsqAxisSelectors = (): void => {
    const previousTable = msqTableSelect.value;
    const previousX = msqXAxisSelect.value;
    const previousY = msqYAxisSelect.value;
    msqTableSelect.replaceChildren();
    msqXAxisSelect.replaceChildren();
    msqYAxisSelect.replaceChildren();
    const model = context.tuneModel;
    if (!model) {
      msqTableSelect.add(new Option('No MSQ loaded', ''));
      msqXAxisSelect.add(new Option('—', ''));
      msqYAxisSelect.add(new Option('—', ''));
      return;
    }
    const tables = model.entries.filter((entry) => entry.kind === 'table' && entry.numericValues);
    for (const table of tables) msqTableSelect.add(new Option(table.name, table.name));
    if (previousTable && tables.some((table) => table.name === previousTable)) msqTableSelect.value = previousTable;
    const table = model.byName.get(msqTableSelect.value) ?? tables[0];
    if (!table) return;
    const numeric = model.entries.filter((entry) => entry.numericValues);
    const xCandidates = numeric.filter((entry) => entry.numericValues?.length === table.cols);
    const yCandidates = numeric.filter((entry) => entry.numericValues?.length === table.rows);
    for (const entry of xCandidates) msqXAxisSelect.add(new Option(entry.name, entry.name));
    for (const entry of yCandidates) msqYAxisSelect.add(new Option(entry.name, entry.name));
    if (previousX && xCandidates.some((entry) => entry.name === previousX)) msqXAxisSelect.value = previousX;
    if (previousY && yCandidates.some((entry) => entry.name === previousY)) msqYAxisSelect.value = previousY;
  };

  const updateAxisControls = (): void => {
    const mode = axisSourceSelect.value;
    customAxisFields.hidden = mode !== 'custom';
    msqAxisFields.hidden = mode !== 'msq';
    const fixed = mode !== 'auto';
    xBinsInput.disabled = fixed;
    yBinsInput.disabled = fixed;
    xMinInput.disabled = fixed;
    xMaxInput.disabled = fixed;
    yMinInput.disabled = fixed;
    yMaxInput.disabled = fixed;
  };

  const resolveExplicitAxes = (): { xAxisValues?: readonly number[]; yAxisValues?: readonly number[]; error?: string } => {
    if (axisSourceSelect.value === 'auto') return {};
    if (axisSourceSelect.value === 'custom') {
      const xAxisValues = parseBreakpointList(xBreakpointsInput);
      const yAxisValues = parseBreakpointList(yBreakpointsInput);
      if (!xAxisValues || !yAxisValues) return { error: 'Custom X and Y breakpoints must both contain finite numeric values.' };
      return { xAxisValues, yAxisValues };
    }
    const model = context.tuneModel;
    if (!model) return { error: 'Load an MSQ file before using MSQ table axes.' };
    if (!msqTableSelect.value || !msqXAxisSelect.value || !msqYAxisSelect.value) return { error: 'Choose an MSQ table and matching X/Y axes.' };
    try {
      const table = createTuneTable2D(model, {
        tableName: msqTableSelect.value,
        xAxisName: msqXAxisSelect.value,
        yAxisName: msqYAxisSelect.value,
      });
      return { xAxisValues: table.xAxis, yAxisValues: table.yAxis };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unable to resolve MSQ table axes.' };
    }
  };

'''
if marker not in text:
    raise SystemExit('missing table generator axis helper marker')
text = text.replace(marker, helpers + marker, 1)
# Use centerValue for axis labels.
text = text.replace("formatNumber((bin.lowerBound + bin.upperBound) / 2, 1)", "formatNumber(bin.centerValue, 1)")
# Resolve axes before building heatmap and surface validation errors.
old = """    const valueRange = aggregation === 'count'
      ? undefined
      : deltaTrace && zTrace ? subtractNumericRanges(zTrace.range, deltaTrace.range) : zTrace!.range;

    const result = buildNumericHeatmap(xTrace.range, yTrace.range, {
      sampleIndices: qualified.eligibleSampleIndices,
      xBinCount: normalizedBinCount(xBinsInput, 16),
      yBinCount: normalizedBinCount(yBinsInput, 16),
      ...(parseOptionalFinite(xMinInput) !== undefined ? { xMin: parseOptionalFinite(xMinInput) } : {}),
      ...(parseOptionalFinite(xMaxInput) !== undefined ? { xMax: parseOptionalFinite(xMaxInput) } : {}),
      ...(parseOptionalFinite(yMinInput) !== undefined ? { yMin: parseOptionalFinite(yMinInput) } : {}),
      ...(parseOptionalFinite(yMaxInput) !== undefined ? { yMax: parseOptionalFinite(yMaxInput) } : {}),
      aggregation,
      ...(valueRange ? { valueRange } : {}),
    });
"""
new = """    const valueRange = aggregation === 'count'
      ? undefined
      : deltaTrace && zTrace ? subtractNumericRanges(zTrace.range, deltaTrace.range) : zTrace!.range;
    const explicitAxes = resolveExplicitAxes();
    if (explicitAxes.error) {
      currentResult = undefined;
      currentXTrace = xTrace;
      currentYTrace = yTrace;
      currentZTrace = zTrace;
      currentDeltaTrace = deltaTrace;
      currentScope = scope;
      chartLayout = undefined;
      empty.hidden = false;
      empty.querySelector('strong')!.textContent = 'Table axis configuration is incomplete.';
      empty.querySelector('span')!.textContent = explicitAxes.error;
      canvas.hidden = true;
      status.hidden = true;
      exportButton.disabled = true;
      return;
    }

    const result = buildNumericHeatmap(xTrace.range, yTrace.range, {
      sampleIndices: qualified.eligibleSampleIndices,
      ...(explicitAxes.xAxisValues ? { xAxisValues: explicitAxes.xAxisValues } : { xBinCount: normalizedBinCount(xBinsInput, 16) }),
      ...(explicitAxes.yAxisValues ? { yAxisValues: explicitAxes.yAxisValues } : { yBinCount: normalizedBinCount(yBinsInput, 16) }),
      ...(!explicitAxes.xAxisValues && parseOptionalFinite(xMinInput) !== undefined ? { xMin: parseOptionalFinite(xMinInput)! } : {}),
      ...(!explicitAxes.xAxisValues && parseOptionalFinite(xMaxInput) !== undefined ? { xMax: parseOptionalFinite(xMaxInput)! } : {}),
      ...(!explicitAxes.yAxisValues && parseOptionalFinite(yMinInput) !== undefined ? { yMin: parseOptionalFinite(yMinInput)! } : {}),
      ...(!explicitAxes.yAxisValues && parseOptionalFinite(yMaxInput) !== undefined ? { yMax: parseOptionalFinite(yMaxInput)! } : {}),
      aggregation,
      ...(valueRange ? { valueRange } : {}),
    });
"""
if old not in text:
    raise SystemExit('missing table generator heatmap call block')
text = text.replace(old, new, 1)
# Set context refreshes MSQ controls.
text = text.replace(
    "    populateScopeOptions();\n    updateValueControls();\n    scheduleRender();",
    "    populateScopeOptions();\n    populateMsqAxisSelectors();\n    updateAxisControls();\n    updateValueControls();\n    scheduleRender();",
    1,
)
# Add listeners.
listener_marker = "  xBinsInput.addEventListener('input', () => scheduleRender(120));"
listeners = """  axisSourceSelect.addEventListener('change', () => { updateAxisControls(); scheduleRender(); });
  xBreakpointsInput.addEventListener('input', () => scheduleRender(180));
  yBreakpointsInput.addEventListener('input', () => scheduleRender(180));
  msqTableSelect.addEventListener('change', () => { populateMsqAxisSelectors(); scheduleRender(); });
  msqXAxisSelect.addEventListener('change', () => scheduleRender());
  msqYAxisSelect.addEventListener('change', () => scheduleRender());
"""
if listener_marker not in text:
    raise SystemExit('missing table generator listener marker')
text = text.replace(listener_marker, listeners + listener_marker, 1)
text = text.replace(
    "  populateScopeOptions();\n  updateFilterCount();\n  updateValueControls();",
    "  populateScopeOptions();\n  populateMsqAxisSelectors();\n  updateAxisControls();\n  updateFilterCount();\n  updateValueControls();",
    1,
)
write(path, text)

# Style custom/MSQ axis rows inside the existing compact popover.
path = 'apps/web/src/styles/histogram-table-generator.css'
text = read(path)
text += r'''

.histogram-table-axis-custom,
.histogram-table-axis-msq {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 7px;
  padding: 7px;
  border: 1px solid rgba(52, 78, 94, .7);
  border-radius: 3px;
  background: rgba(7, 17, 25, .58);
}

.histogram-table-axis-msq {
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr);
}

.histogram-table-axis-custom[hidden],
.histogram-table-axis-msq[hidden] {
  display: none;
}

.histogram-table-axis-custom input,
.histogram-table-axis-msq select {
  width: 100%;
  min-width: 0;
}
'''
write(path, text)

# Remove this patch script from the feature result; workflow executes it before git add.
Path('scripts/tmp-axis-intelligence.py').unlink(missing_ok=True)
