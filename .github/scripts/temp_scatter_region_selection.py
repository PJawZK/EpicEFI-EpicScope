from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)

# Core analysis helper: region selection always runs over the complete valid pair population.
path = Path('core/analysis/scatter.ts')
text = path.read_text()
text = replace_once(text, """export interface NumericScatterResult {
  /** Source sample indices for every returned point. */
  readonly sampleIndices: Uint32Array;
  readonly xValues: Float64Array;
  readonly yValues: Float64Array;
  readonly inputSampleCount: number;
  readonly validPairSampleCount: number;
  readonly invalidSampleCount: number;
  readonly unavailableSampleCount: number;
  readonly xMin: number | undefined;
  readonly xMax: number | undefined;
  readonly yMin: number | undefined;
  readonly yMax: number | undefined;
}
""", """export interface NumericScatterResult {
  /** Source sample indices for every returned point. */
  readonly sampleIndices: Uint32Array;
  readonly xValues: Float64Array;
  readonly yValues: Float64Array;
  readonly inputSampleCount: number;
  readonly validPairSampleCount: number;
  readonly invalidSampleCount: number;
  readonly unavailableSampleCount: number;
  readonly xMin: number | undefined;
  readonly xMax: number | undefined;
  readonly yMin: number | undefined;
  readonly yMax: number | undefined;
}

export interface NumericScatterRegion {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
}

export interface NumericScatterRegionSelection {
  /** Source sample indices whose valid X/Y pair lies inside the inclusive region. */
  readonly sampleIndices: Uint32Array;
  readonly selectedPairCount: number;
}
""", 'scatter region interfaces')
text += """

/** Select evidence from the complete scatter result, independent of any UI render stride. */
export function selectNumericScatterRegion(
  result: NumericScatterResult,
  region: NumericScatterRegion,
): NumericScatterRegionSelection {
  const xMin = Math.min(region.xMin, region.xMax);
  const xMax = Math.max(region.xMin, region.xMax);
  const yMin = Math.min(region.yMin, region.yMax);
  const yMax = Math.max(region.yMin, region.yMax);
  const selected: number[] = [];

  for (let index = 0; index < result.validPairSampleCount; index += 1) {
    const x = result.xValues[index];
    const y = result.yValues[index];
    const sampleIndex = result.sampleIndices[index];
    if (x === undefined || y === undefined || sampleIndex === undefined) continue;
    if (x < xMin || x > xMax || y < yMin || y > yMax) continue;
    selected.push(sampleIndex);
  }

  return {
    sampleIndices: Uint32Array.from(selected),
    selectedPairCount: selected.length,
  };
}
"""
path.write_text(text)

# Scatter UI.
path = Path('apps/web/src/pages/scatter-view.ts')
text = path.read_text()
text = replace_once(
    text,
    "import { buildNumericScatter, type NumericScatterResult } from '../../../../core/analysis/scatter';",
    "import { buildNumericScatter, selectNumericScatterRegion, type NumericScatterRegionSelection, type NumericScatterResult } from '../../../../core/analysis/scatter';",
    'scatter import',
)
text = replace_once(text, """interface ScatterPaneState {
  readonly root: HTMLElement;
""", """interface ScatterRegionState {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly selection: NumericScatterRegionSelection;
}

interface ScatterDragState {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  currentX: number;
  currentY: number;
}

interface ScatterPaneState {
  readonly root: HTMLElement;
""", 'scatter state interfaces')
text = replace_once(text, """  readonly pointOpenLogger: HTMLButtonElement;
  readonly pointClear: HTMLButtonElement;
  result: NumericScatterResult | undefined;
""", """  readonly pointOpenLogger: HTMLButtonElement;
  readonly pointClear: HTMLButtonElement;
  readonly regionDragOverlay: HTMLElement;
  result: NumericScatterResult | undefined;
""", 'pane overlay field')
text = replace_once(text, """  plotLayout: ScatterPlotLayout | undefined;
  selectedResultIndex: number | undefined;
}
""", """  plotLayout: ScatterPlotLayout | undefined;
  selectedResultIndex: number | undefined;
  selectedRegion: ScatterRegionState | undefined;
  dragState: ScatterDragState | undefined;
  suppressNextClick: boolean;
}
""", 'pane selection fields')
text = replace_once(text, """      <span class="scatter-pane-z">Heat <strong>Hits / cell</strong></span>
    </div>
    <div class="scatter-pane-stage">
      <canvas class="scatter-pane-chart" aria-label="Scatter plot"></canvas>
      <div class="scatter-pane-title"></div>
    </div>
""", """      <span class="scatter-pane-select">Drag: region</span>
      <span class="scatter-pane-z">Heat <strong>Hits / cell</strong></span>
    </div>
    <div class="scatter-pane-stage">
      <canvas class="scatter-pane-chart" aria-label="Scatter plot"></canvas>
      <div class="scatter-region-drag" hidden></div>
      <div class="scatter-pane-title"></div>
    </div>
""", 'pane region UI')
text = replace_once(text, """  const pointOpenLogger = root.querySelector<HTMLButtonElement>('.scatter-point-open-logger');
  const pointClear = root.querySelector<HTMLButtonElement>('.scatter-point-clear');
  if (!xSelect || !ySelect || !canvas || !title || !status || !pointDetail || !pointLabel || !pointOpenLogger || !pointClear) {
""", """  const pointOpenLogger = root.querySelector<HTMLButtonElement>('.scatter-point-open-logger');
  const pointClear = root.querySelector<HTMLButtonElement>('.scatter-point-clear');
  const regionDragOverlay = root.querySelector<HTMLElement>('.scatter-region-drag');
  if (!xSelect || !ySelect || !canvas || !title || !status || !pointDetail || !pointLabel || !pointOpenLogger || !pointClear || !regionDragOverlay) {
""", 'query region overlay')
text = replace_once(text, """    root, xSelect, ySelect, canvas, title, status, pointDetail, pointLabel, pointOpenLogger, pointClear,
    result: undefined, xTrace: undefined, yTrace: undefined, renderedPointCount: 0, plotLayout: undefined, selectedResultIndex: undefined,
""", """    root, xSelect, ySelect, canvas, title, status, pointDetail, pointLabel, pointOpenLogger, pointClear, regionDragOverlay,
    result: undefined, xTrace: undefined, yTrace: undefined, renderedPointCount: 0, plotLayout: undefined, selectedResultIndex: undefined,
    selectedRegion: undefined, dragState: undefined, suppressNextClick: false,
""", 'initialize selection state')
# Draw persisted region selection after point highlight.
point_block = """    if (pane.selectedResultIndex !== undefined) {
      const xValue = result.xValues[pane.selectedResultIndex];
      const yValue = result.yValues[pane.selectedResultIndex];
      if (xValue !== undefined && yValue !== undefined) {
        const x = padLeft + clamp01((xValue - xMin) / xSpan) * chartWidth;
        const y = padTop + chartHeight - clamp01((yValue - yMin) / ySpan) * chartHeight;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke();
      }
    }
"""
region_draw = point_block + """
    if (pane.selectedRegion) {
      const left = padLeft + clamp01((pane.selectedRegion.xMin - xMin) / xSpan) * chartWidth;
      const right = padLeft + clamp01((pane.selectedRegion.xMax - xMin) / xSpan) * chartWidth;
      const top = padTop + chartHeight - clamp01((pane.selectedRegion.yMax - yMin) / ySpan) * chartHeight;
      const bottom = padTop + chartHeight - clamp01((pane.selectedRegion.yMin - yMin) / ySpan) * chartHeight;
      ctx.fillStyle = 'rgba(139, 200, 237, .10)';
      ctx.fillRect(left, top, Math.max(1, right - left), Math.max(1, bottom - top));
      ctx.strokeStyle = '#8bc8ed';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(left + 0.5, top + 0.5, Math.max(1, right - left - 1), Math.max(1, bottom - top - 1));
      ctx.setLineDash([]);
    }
"""
text = replace_once(text, point_block, region_draw, 'draw region selection')
# Reset selection whenever analysis is rebuilt.
text = replace_once(text, """        pane.result = undefined; pane.xTrace = undefined; pane.yTrace = undefined; pane.plotLayout = undefined; pane.selectedResultIndex = undefined; pane.pointDetail.hidden = true;
""", """        pane.result = undefined; pane.xTrace = undefined; pane.yTrace = undefined; pane.plotLayout = undefined; pane.selectedResultIndex = undefined; pane.selectedRegion = undefined; pane.dragState = undefined; pane.regionDragOverlay.hidden = true; pane.pointDetail.hidden = true;
""", 'empty reset')
text = replace_once(text, """      pane.plotLayout = undefined;
      pane.selectedResultIndex = undefined;
      pane.pointDetail.hidden = true;
""", """      pane.plotLayout = undefined;
      pane.selectedResultIndex = undefined;
      pane.selectedRegion = undefined;
      pane.dragState = undefined;
      pane.regionDragOverlay.hidden = true;
      pane.pointDetail.hidden = true;
""", 'render reset')
# Replace point-only detail helper with combined point/region helper plus coordinate helpers.
old_detail = """  const updatePointDetail = (pane: ScatterPaneState): void => {
    const result = pane.result;
    const xTrace = pane.xTrace;
    const yTrace = pane.yTrace;
    const index = pane.selectedResultIndex;
    if (!result || !xTrace || !yTrace || index === undefined) { pane.pointDetail.hidden = true; return; }
    const sampleIndex = result.sampleIndices[index];
    const xValue = result.xValues[index];
    const yValue = result.yValues[index];
    if (sampleIndex === undefined || xValue === undefined || yValue === undefined) { pane.pointDetail.hidden = true; return; }
    const localIndex = sampleIndex - xTrace.range.startSampleIndex;
    const time = localIndex >= 0 && localIndex < xTrace.range.timeMs.length ? xTrace.range.timeMs[localIndex] : undefined;
    pane.pointLabel.textContent = `${channelLabel(xTrace)} ${formatNumber(xValue)} · ${channelLabel(yTrace)} ${formatNumber(yValue)} · #${sampleIndex.toLocaleString()}${time !== undefined ? ` · ${(time / 1000).toFixed(3)} s` : ''}`;
    pane.pointOpenLogger.disabled = !context.openSamplesInLogger || time === undefined;
    pane.pointDetail.hidden = false;
  };
"""
new_detail = """  const canvasPoint = (pane: ScatterPaneState, event: PointerEvent | MouseEvent): { x: number; y: number } => {
    const rect = pane.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const clampToPlot = (value: number, start: number, length: number): number => Math.max(start, Math.min(start + length, value));

  const regionBoundsFromPixels = (pane: ScatterPaneState, x1: number, y1: number, x2: number, y2: number): Omit<ScatterRegionState, 'selection'> | undefined => {
    const plot = pane.plotLayout;
    if (!plot) return undefined;
    const left = clampToPlot(Math.min(x1, x2), plot.left, plot.width);
    const right = clampToPlot(Math.max(x1, x2), plot.left, plot.width);
    const top = clampToPlot(Math.min(y1, y2), plot.top, plot.height);
    const bottom = clampToPlot(Math.max(y1, y2), plot.top, plot.height);
    const xSpan = Math.max(Number.EPSILON, plot.xMax - plot.xMin);
    const ySpan = Math.max(Number.EPSILON, plot.yMax - plot.yMin);
    return {
      xMin: plot.xMin + ((left - plot.left) / plot.width) * xSpan,
      xMax: plot.xMin + ((right - plot.left) / plot.width) * xSpan,
      yMin: plot.yMax - ((bottom - plot.top) / plot.height) * ySpan,
      yMax: plot.yMax - ((top - plot.top) / plot.height) * ySpan,
    };
  };

  const updateDragOverlay = (pane: ScatterPaneState): void => {
    const drag = pane.dragState;
    const plot = pane.plotLayout;
    if (!drag || !plot) { pane.regionDragOverlay.hidden = true; return; }
    const left = clampToPlot(Math.min(drag.startX, drag.currentX), plot.left, plot.width);
    const right = clampToPlot(Math.max(drag.startX, drag.currentX), plot.left, plot.width);
    const top = clampToPlot(Math.min(drag.startY, drag.currentY), plot.top, plot.height);
    const bottom = clampToPlot(Math.max(drag.startY, drag.currentY), plot.top, plot.height);
    pane.regionDragOverlay.style.left = `${left}px`;
    pane.regionDragOverlay.style.top = `${top}px`;
    pane.regionDragOverlay.style.width = `${Math.max(1, right - left)}px`;
    pane.regionDragOverlay.style.height = `${Math.max(1, bottom - top)}px`;
    pane.regionDragOverlay.hidden = false;
  };

  const updateSelectionDetail = (pane: ScatterPaneState): void => {
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
    const sampleIndex = result.sampleIndices[index];
    const xValue = result.xValues[index];
    const yValue = result.yValues[index];
    if (sampleIndex === undefined || xValue === undefined || yValue === undefined) { pane.pointDetail.hidden = true; return; }
    const localIndex = sampleIndex - xTrace.range.startSampleIndex;
    const time = localIndex >= 0 && localIndex < xTrace.range.timeMs.length ? xTrace.range.timeMs[localIndex] : undefined;
    pane.pointLabel.textContent = `${channelLabel(xTrace)} ${formatNumber(xValue)} · ${channelLabel(yTrace)} ${formatNumber(yValue)} · #${sampleIndex.toLocaleString()}${time !== undefined ? ` · ${(time / 1000).toFixed(3)} s` : ''}`;
    pane.pointOpenLogger.textContent = 'Open point in Logger';
    pane.pointOpenLogger.disabled = !context.openSamplesInLogger || time === undefined;
    pane.pointDetail.hidden = false;
  };
"""
text = replace_once(text, old_detail, new_detail, 'selection detail helpers')
# Replace pane listeners with drag-box + click-point behavior.
old_listeners = """  for (const pane of panes) {
    pane.xSelect.addEventListener('change', () => { if (pane === panes[0]) { fullStartMs = undefined; fullEndMs = undefined; } void render(); });
    pane.ySelect.addEventListener('change', () => { void render(); });
    pane.canvas.addEventListener('click', (event) => {
      const index = nearestRenderedPoint(pane, event);
      if (index === undefined) return;
      pane.selectedResultIndex = index;
      updatePointDetail(pane);
      if (pane.result && pane.xTrace && pane.yTrace) renderPane(pane, pane.result, pane.xTrace, pane.yTrace);
    });
    pane.pointClear.addEventListener('click', () => {
      pane.selectedResultIndex = undefined;
      pane.pointDetail.hidden = true;
      if (pane.result && pane.xTrace && pane.yTrace) renderPane(pane, pane.result, pane.xTrace, pane.yTrace);
    });
    pane.pointOpenLogger.addEventListener('click', () => {
      const result = pane.result;
      const xTrace = pane.xTrace;
      const yTrace = pane.yTrace;
      const index = pane.selectedResultIndex;
      if (!result || !xTrace || !yTrace || index === undefined || !context.openSamplesInLogger) return;
      const sampleIndex = result.sampleIndices[index];
      const xValue = result.xValues[index];
      const yValue = result.yValues[index];
      if (sampleIndex === undefined || xValue === undefined || yValue === undefined) return;
      const localIndex = sampleIndex - xTrace.range.startSampleIndex;
      const time = localIndex >= 0 && localIndex < xTrace.range.timeMs.length ? xTrace.range.timeMs[localIndex] : undefined;
      if (time === undefined) return;
      void context.openSamplesInLogger({ sampleIndices: [sampleIndex], timeMs: [time], label: `${channelLabel(yTrace)} vs ${channelLabel(xTrace)} point` });
    });
  }
"""
new_listeners = """  for (const pane of panes) {
    pane.xSelect.addEventListener('change', () => { if (pane === panes[0]) { fullStartMs = undefined; fullEndMs = undefined; } void render(); });
    pane.ySelect.addEventListener('change', () => { void render(); });

    pane.canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !pane.plotLayout || !pane.result) return;
      const point = canvasPoint(pane, event);
      const plot = pane.plotLayout;
      if (point.x < plot.left || point.x > plot.left + plot.width || point.y < plot.top || point.y > plot.top + plot.height) return;
      pane.dragState = { pointerId: event.pointerId, startX: point.x, startY: point.y, currentX: point.x, currentY: point.y };
      pane.suppressNextClick = false;
      pane.canvas.setPointerCapture(event.pointerId);
    });
    pane.canvas.addEventListener('pointermove', (event) => {
      const drag = pane.dragState;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const point = canvasPoint(pane, event);
      drag.currentX = point.x;
      drag.currentY = point.y;
      if (Math.hypot(drag.currentX - drag.startX, drag.currentY - drag.startY) >= 4) updateDragOverlay(pane);
    });
    const finishRegionDrag = (event: PointerEvent): void => {
      const drag = pane.dragState;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const point = canvasPoint(pane, event);
      drag.currentX = point.x;
      drag.currentY = point.y;
      pane.dragState = undefined;
      pane.regionDragOverlay.hidden = true;
      if (pane.canvas.hasPointerCapture(event.pointerId)) pane.canvas.releasePointerCapture(event.pointerId);
      if (Math.hypot(drag.currentX - drag.startX, drag.currentY - drag.startY) < 6) return;
      const result = pane.result;
      const bounds = regionBoundsFromPixels(pane, drag.startX, drag.startY, drag.currentX, drag.currentY);
      if (!result || !bounds) return;
      pane.suppressNextClick = true;
      pane.selectedResultIndex = undefined;
      pane.selectedRegion = { ...bounds, selection: selectNumericScatterRegion(result, bounds) };
      updateSelectionDetail(pane);
      if (pane.xTrace && pane.yTrace) renderPane(pane, result, pane.xTrace, pane.yTrace);
    };
    pane.canvas.addEventListener('pointerup', finishRegionDrag);
    pane.canvas.addEventListener('pointercancel', (event) => {
      const drag = pane.dragState;
      if (!drag || drag.pointerId !== event.pointerId) return;
      pane.dragState = undefined;
      pane.regionDragOverlay.hidden = true;
    });
    pane.canvas.addEventListener('click', (event) => {
      if (pane.suppressNextClick) { pane.suppressNextClick = false; return; }
      const index = nearestRenderedPoint(pane, event);
      if (index === undefined) return;
      pane.selectedRegion = undefined;
      pane.selectedResultIndex = index;
      updateSelectionDetail(pane);
      if (pane.result && pane.xTrace && pane.yTrace) renderPane(pane, pane.result, pane.xTrace, pane.yTrace);
    });
    pane.pointClear.addEventListener('click', () => {
      pane.selectedResultIndex = undefined;
      pane.selectedRegion = undefined;
      pane.pointDetail.hidden = true;
      if (pane.result && pane.xTrace && pane.yTrace) renderPane(pane, pane.result, pane.xTrace, pane.yTrace);
    });
    pane.pointOpenLogger.addEventListener('click', () => {
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
      if (index === undefined) return;
      const sampleIndex = result.sampleIndices[index];
      const xValue = result.xValues[index];
      const yValue = result.yValues[index];
      if (sampleIndex === undefined || xValue === undefined || yValue === undefined) return;
      const localIndex = sampleIndex - xTrace.range.startSampleIndex;
      const time = localIndex >= 0 && localIndex < xTrace.range.timeMs.length ? xTrace.range.timeMs[localIndex] : undefined;
      if (time === undefined) return;
      void context.openSamplesInLogger({ sampleIndices: [sampleIndex], timeMs: [time], label: `${channelLabel(yTrace)} vs ${channelLabel(xTrace)} point` });
    });
  }
"""
text = replace_once(text, old_listeners, new_listeners, 'pane interaction listeners')
path.write_text(text)

# Scatter styling.
path = Path('apps/web/src/styles/scatter-mlv.css')
text = path.read_text()
text = replace_once(text, """.scatter-pane-toolbar label > span,
.scatter-pane-z {
""", """.scatter-pane-toolbar label > span,
.scatter-pane-z,
.scatter-pane-select {
""", 'toolbar shared text')
text = replace_once(text, """.scatter-pane-z {
  margin-left: auto;
  padding-right: 4px;
}
""", """.scatter-pane-select {
  margin-left: auto;
  color: #91a9b6;
}
.scatter-pane-z {
  margin-left: 0;
  padding-right: 4px;
}
""", 'selection hint styling')
text = replace_once(text, """.scatter-pane-chart {
  width: 100%;
  height: 100%;
  display: block;
}
""", """.scatter-pane-chart {
  width: 100%;
  height: 100%;
  display: block;
  cursor: crosshair;
  touch-action: none;
}

.scatter-region-drag {
  position: absolute;
  z-index: 3;
  box-sizing: border-box;
  border: 1px dashed #8bc8ed;
  background: rgba(139, 200, 237, .12);
  pointer-events: none;
}
.scatter-region-drag[hidden] { display: none !important; }
""", 'region overlay styling')
text = replace_once(text, """  .scatter-pane-z { display: none; }
""", """  .scatter-pane-z,
  .scatter-pane-select { display: none; }
""", 'responsive selection hint')
path.write_text(text)

# Help text.
path = Path('apps/web/src/pages/histogram-help.ts')
text = path.read_text()
text = replace_once(text, """const SCATTER_HEAT_HELP: InlineHelpEntry = {
  title: 'Scatter density heat',
  text: 'Color represents local X/Y sample density. Density is calculated from the full qualified pair set even when the visible point drawing is reduced for browser performance.',
};
""", """const SCATTER_HEAT_HELP: InlineHelpEntry = {
  title: 'Scatter density heat',
  text: 'Color represents local X/Y sample density. Density is calculated from the full qualified pair set even when the visible point drawing is reduced for browser performance.',
};

const SCATTER_SELECTION_HELP: InlineHelpEntry = {
  title: 'Scatter evidence selection',
  text: 'Drag a box inside the plot to select every qualified X/Y pair in that value region, including points omitted from the reduced visible drawing. The region count and bounds remain visible and the full selected evidence can be opened in Logger. A simple click still selects one rendered point.',
};
""", 'scatter selection help')
text = replace_once(text, """  for (const heatHost of root.querySelectorAll<HTMLElement>('.scatter-pane-z')) {
    addInlineHelpButton(heatHost, SCATTER_HEAT_HELP).classList.add('epicscope-info-icon');
  }
""", """  for (const selectionHost of root.querySelectorAll<HTMLElement>('.scatter-pane-select')) {
    addInlineHelpButton(selectionHost, SCATTER_SELECTION_HELP).classList.add('epicscope-info-icon');
  }
  for (const heatHost of root.querySelectorAll<HTMLElement>('.scatter-pane-z')) {
    addInlineHelpButton(heatHost, SCATTER_HEAT_HELP).classList.add('epicscope-info-icon');
  }
""", 'install scatter selection help')
path.write_text(text)

# Analysis tests.
path = Path('tests/analysis/scatter.test.ts')
text = path.read_text()
text = replace_once(text, "import { buildNumericScatter } from '../../core/analysis/scatter';", "import { buildNumericScatter, selectNumericScatterRegion } from '../../core/analysis/scatter';", 'scatter test import')
text = replace_once(text, """  it('treats selected indices outside either decoded range as unavailable', () => {
    const result = buildNumericScatter(
      range(20, [1, 2]),
      range(20, [3, 4]),
      { sampleIndices: [19, 20, 21, 22] },
    );

    expect(result.inputSampleCount).toBe(4);
    expect(result.validPairSampleCount).toBe(2);
    expect(result.unavailableSampleCount).toBe(2);
  });
""", """  it('treats selected indices outside either decoded range as unavailable', () => {
    const result = buildNumericScatter(
      range(20, [1, 2]),
      range(20, [3, 4]),
      { sampleIndices: [19, 20, 21, 22] },
    );

    expect(result.inputSampleCount).toBe(4);
    expect(result.validPairSampleCount).toBe(2);
    expect(result.unavailableSampleCount).toBe(2);
  });

  it('selects every valid pair inside an inclusive X/Y region', () => {
    const result = buildNumericScatter(
      range(100, [1, 2, 3, 4, 5]),
      range(100, [50, 40, 30, 20, 10]),
    );
    const selected = selectNumericScatterRegion(result, { xMin: 2, xMax: 4, yMin: 20, yMax: 40 });

    expect(selected.selectedPairCount).toBe(3);
    expect([...selected.sampleIndices]).toEqual([101, 102, 103]);
  });

  it('normalizes reversed region bounds and selects from the complete result', () => {
    const values = Array.from({ length: 12 }, (_, index) => index);
    const result = buildNumericScatter(range(0, values), range(0, values.map((value) => value * 2)));
    const selected = selectNumericScatterRegion(result, { xMin: 9, xMax: 3, yMin: 18, yMax: 6 });

    expect(selected.selectedPairCount).toBe(7);
    expect([...selected.sampleIndices]).toEqual([3, 4, 5, 6, 7, 8, 9]);
  });

  it('returns an empty evidence set when no pair lies inside the region', () => {
    const result = buildNumericScatter(range(0, [1, 2, 3]), range(0, [10, 20, 30]));
    const selected = selectNumericScatterRegion(result, { xMin: 100, xMax: 200, yMin: 100, yMax: 200 });

    expect(selected.selectedPairCount).toBe(0);
    expect([...selected.sampleIndices]).toEqual([]);
  });
""", 'scatter region tests')
path.write_text(text)

# Histogram docs move region selection into current behavior.
path = Path('docs/HISTOGRAM.md')
text = path.read_text()
text = replace_once(text, """- rendered point selection and point → Logger navigation;
- shared Logger timeline.

### Scatter worthwhile future work

The strongest remaining functionality gap is richer evidence selection:

- box/lasso or similar region selection;
- selected-region sample count/provenance;
- selected-region → Logger navigation.

Other useful later additions:
""", """- rendered point selection and point → Logger navigation;
- drag-box region selection evaluated against the full qualified pair population, not only rendered/downsampled points;
- selected-region pair count and X/Y bounds;
- selected-region → Logger navigation with the complete selected source evidence;
- shared Logger timeline.

### Scatter worthwhile future work

The initial richer evidence-selection slice is complete with box selection. Useful later additions include:
""", 'Histogram scatter docs')
text = replace_once(text, """Current evidence navigation:

- Table Generator cell → Logger;
- Distribution bin → Logger;
- Scatter point → Logger.

Richer Scatter region selection remains the obvious next extension.
""", """Current evidence navigation:

- Table Generator cell → Logger;
- Distribution bin → Logger;
- Scatter point → Logger;
- Scatter selected region → Logger.

Scatter region selection deliberately uses the complete qualified pair population even when visible plotting is stride-reduced.
""", 'Histogram evidence docs')
text = replace_once(text, """1. **saved setups/presets for Distribution and Scatter**;
2. **exports for Distribution and Scatter**;
3. **richer Scatter region selection/evidence navigation**;
4. eventually replace the remaining Scatter timeline text bridge with direct state propagation;
5. later cleanup/consolidation of dormant duplicate/runtime-refinement code.
""", """1. **saved setups/presets for Distribution and Scatter**;
2. **exports for Distribution and Scatter**;
3. optional further Scatter selection ergonomics (for example additive or freeform/lasso selection) only if field use justifies them;
4. eventually replace the remaining Scatter timeline text bridge with direct state propagation;
5. later cleanup/consolidation of dormant duplicate/runtime-refinement code.
""", 'Histogram priorities')
path.write_text(text)
