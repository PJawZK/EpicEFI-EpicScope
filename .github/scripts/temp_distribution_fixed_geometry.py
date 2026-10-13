from pathlib import Path
ROOT = Path('.')

def replace_once(path, old, new):
    p=ROOT/path; text=p.read_text(); count=text.count(old)
    if count != 1: raise SystemExit(f'{path}: expected one anchor, found {count}')
    p.write_text(text.replace(old,new,1))

(ROOT/'core/analysis/distribution-geometry.ts').write_text(r'''export interface FixedDistributionGeometry {
  readonly min: number;
  readonly max: number;
  readonly width: number;
  readonly binCount: number;
}

export interface FixedDistributionGeometryInput {
  readonly min: number;
  readonly max: number;
  readonly width: number;
  readonly maximumBinCount?: number;
}

export function resolveFixedDistributionGeometry(input: FixedDistributionGeometryInput): FixedDistributionGeometry {
  const { min, max, width } = input;
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(width)) {
    throw new RangeError('Fixed Distribution min, max and width must be finite numbers.');
  }
  if (!(max > min)) throw new RangeError('Fixed Distribution max must be greater than min.');
  if (!(width > 0)) throw new RangeError('Fixed Distribution bin width must be greater than zero.');
  const rawCount = (max - min) / width;
  const binCount = Math.round(rawCount);
  const tolerance = 1e-9 * Math.max(1, Math.abs(rawCount));
  if (Math.abs(rawCount - binCount) > tolerance) {
    throw new RangeError('Fixed Distribution range must be an exact whole number of bin widths.');
  }
  const maximumBinCount = input.maximumBinCount ?? 512;
  if (binCount < 1 || binCount > maximumBinCount) {
    throw new RangeError(`Fixed Distribution geometry must contain 1–${maximumBinCount} bins.`);
  }
  return { min, max, width, binCount };
}

export function distributionValueInsideGeometry(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}
''')

replace_once('apps/web/src/state/histogram-distribution-storage.ts',
"export type HistogramDistributionBinMode = 'auto' | 'manual';",
"export type HistogramDistributionBinMode = 'auto' | 'manual' | 'fixed';")
replace_once('apps/web/src/state/histogram-distribution-storage.ts',
"  readonly binCount: string;\n  readonly display: HistogramDistributionDisplay;",
"  readonly binCount: string;\n  readonly fixedMin?: string;\n  readonly fixedMax?: string;\n  readonly fixedWidth?: string;\n  readonly display: HistogramDistributionDisplay;")
replace_once('apps/web/src/state/histogram-distribution-storage.ts',
"const binModeValues = new Set<HistogramDistributionBinMode>(['auto', 'manual']);",
"const binModeValues = new Set<HistogramDistributionBinMode>(['auto', 'manual', 'fixed']);")
replace_once('apps/web/src/state/histogram-distribution-storage.ts',
"    && isString(value.binCount)\n    && displayValues.has(value.display as HistogramDistributionDisplay)",
"    && isString(value.binCount)\n    && (value.fixedMin === undefined || isString(value.fixedMin))\n    && (value.fixedMax === undefined || isString(value.fixedMax))\n    && (value.fixedWidth === undefined || isString(value.fixedWidth))\n    && displayValues.has(value.display as HistogramDistributionDisplay)")

replace_once('apps/web/src/pages/histogram-distribution-view.ts',
"import type { NumericChannelRange } from '../../../../core/log-model/log-types';",
"import type { NumericChannelRange } from '../../../../core/log-model/log-types';\nimport { distributionValueInsideGeometry, resolveFixedDistributionGeometry } from '../../../../core/analysis/distribution-geometry';")
replace_once('apps/web/src/pages/histogram-distribution-view.ts',
"type DistributionBinMode = 'auto' | 'manual';",
"type DistributionBinMode = 'auto' | 'manual' | 'fixed';")
replace_once('apps/web/src/pages/histogram-distribution-view.ts',
"  readonly qualification: HistogramQualificationState;\n}",
"  readonly qualification: HistogramQualificationState;\n  readonly outsideGeometrySampleCount: number;\n}")
replace_once('apps/web/src/pages/histogram-distribution-view.ts',
"    if (value === undefined || time === undefined || !Number.isFinite(value) || !Number.isFinite(time)) continue;\n    const normalized = Math.max(0, Math.min(1, (value - rangeMin) / span));\n    const binIndex = value === rangeMax ? binCount - 1 : Math.min(binCount - 1, Math.max(0, Math.floor(normalized * binCount)));\n    counts[binIndex] = (counts[binIndex] ?? 0) + 1;\n    validCount += 1;",
"    if (value === undefined || time === undefined || !Number.isFinite(value) || !Number.isFinite(time)) continue;\n    validCount += 1;\n    if (!distributionValueInsideGeometry(value, rangeMin, rangeMax)) continue;\n    const normalized = Math.max(0, Math.min(1, (value - rangeMin) / span));\n    const binIndex = value === rangeMax ? binCount - 1 : Math.min(binCount - 1, Math.max(0, Math.floor(normalized * binCount)));\n    counts[binIndex] = (counts[binIndex] ?? 0) + 1;")

replace_once('apps/web/src/pages/histogram-distribution-view.ts',
"      <label><span>Bins</span><select class=\"distribution-bin-mode\"><option value=\"auto\">Auto</option><option value=\"manual\">Manual</option></select></label>\n      <input class=\"distribution-bin-count\" type=\"number\" min=\"1\" max=\"512\" step=\"1\" value=\"20\" aria-label=\"Manual bin count\" hidden />",
"      <label><span>Bins</span><select class=\"distribution-bin-mode\"><option value=\"auto\">Auto</option><option value=\"manual\">Count</option><option value=\"fixed\">Fixed</option></select></label>\n      <input class=\"distribution-bin-count\" type=\"number\" min=\"1\" max=\"512\" step=\"1\" value=\"20\" aria-label=\"Manual bin count\" title=\"Manual bin count\" hidden />\n      <label class=\"distribution-fixed-control\" hidden><span>Min</span><input class=\"distribution-fixed-min\" type=\"number\" step=\"any\" value=\"0\" /></label>\n      <label class=\"distribution-fixed-control\" hidden><span>Max</span><input class=\"distribution-fixed-max\" type=\"number\" step=\"any\" value=\"100\" /></label>\n      <label class=\"distribution-fixed-control\" hidden><span>Width</span><input class=\"distribution-fixed-width\" type=\"number\" min=\"0\" step=\"any\" value=\"5\" /></label>")
replace_once('apps/web/src/pages/histogram-distribution-view.ts',
"  const binCountInput = root.querySelector<HTMLInputElement>('.distribution-bin-count')!;\n  const displaySelect",
"  const binCountInput = root.querySelector<HTMLInputElement>('.distribution-bin-count')!;\n  const fixedControls = [...root.querySelectorAll<HTMLElement>('.distribution-fixed-control')];\n  const fixedMinInput = root.querySelector<HTMLInputElement>('.distribution-fixed-min')!;\n  const fixedMaxInput = root.querySelector<HTMLInputElement>('.distribution-fixed-max')!;\n  const fixedWidthInput = root.querySelector<HTMLInputElement>('.distribution-fixed-width')!;\n  const displaySelect")
replace_once('apps/web/src/pages/histogram-distribution-view.ts',
"    binCount: binCountInput.value,\n    display,",
"    binCount: binCountInput.value,\n    fixedMin: fixedMinInput.value,\n    fixedMax: fixedMaxInput.value,\n    fixedWidth: fixedWidthInput.value,\n    display,")

# Add a single visibility synchronizer before preset application.
replace_once('apps/web/src/pages/histogram-distribution-view.ts',
"  const setSelectIfAvailable = (select: HTMLSelectElement, value: string): void => {",
"  const syncBinGeometryControls = (): void => {\n    binCountInput.hidden = binMode !== 'manual';\n    for (const control of fixedControls) control.hidden = binMode !== 'fixed';\n  };\n\n  const setSelectIfAvailable = (select: HTMLSelectElement, value: string): void => {")

# Render stats makes fixed-range exclusion explicit.
replace_once('apps/web/src/pages/histogram-distribution-view.ts',
"        <header><i style=\"--series-color:${item.color}\"></i><strong>${item.label}</strong><small>${item.stats.count.toLocaleString()} samples · eligible ${item.qualification.eligibleSampleCount.toLocaleString()} / ${item.qualification.inputSampleCount.toLocaleString()}</small></header>",
"        <header><i style=\"--series-color:${item.color}\"></i><strong>${item.label}</strong><small>${item.stats.count.toLocaleString()} samples · eligible ${item.qualification.eligibleSampleCount.toLocaleString()} / ${item.qualification.inputSampleCount.toLocaleString()}${item.outsideGeometrySampleCount > 0 ? ` · outside geometry ${item.outsideGeometrySampleCount.toLocaleString()}` : ''}</small></header>")

# Build series counts qualified finite samples that fixed geometry intentionally excludes.
replace_once('apps/web/src/pages/histogram-distribution-view.ts',
"    return {\n      label: scope.label,\n      trace,\n      localIndices,\n      stats: statsFor(trace.range, localIndices),\n      binValues: metricBins(trace, localIndices, binCount, rangeMin, rangeMax, metric),\n      color,\n      qualification,\n    };",
"    let outsideGeometrySampleCount = 0;\n    for (const localIndex of localIndices) {\n      const value = trace.range.values[localIndex];\n      if (trace.range.validity[localIndex] !== 1 || value === undefined || !Number.isFinite(value)) continue;\n      if (!distributionValueInsideGeometry(value, rangeMin, rangeMax)) outsideGeometrySampleCount += 1;\n    }\n    return {\n      label: scope.label,\n      trace,\n      localIndices,\n      stats: statsFor(trace.range, localIndices),\n      binValues: metricBins(trace, localIndices, binCount, rangeMin, rangeMax, metric),\n      color,\n      qualification,\n      outsideGeometrySampleCount,\n    };")

# Resolve either data-driven extent or exact fixed geometry.
replace_once('apps/web/src/pages/histogram-distribution-view.ts',
"    const resolvedBinCount = binMode === 'manual'\n      ? Math.max(1, Math.min(512, Math.floor(Number(binCountInput.value) || 20)))\n      : autoBinCountFromValues(allValues);\n    binCountInput.value = String(resolvedBinCount);\n\n    const series = available.map((item) => buildSeries(item.trace, item.request.scope, item.qualification, resolvedBinCount, extent.min, extent.max, item.request.color));",
"    let rangeMin = extent.min;\n    let rangeMax = extent.max;\n    let resolvedBinCount: number;\n    if (binMode === 'fixed') {\n      try {\n        const geometry = resolveFixedDistributionGeometry({\n          min: Number(fixedMinInput.value),\n          max: Number(fixedMaxInput.value),\n          width: Number(fixedWidthInput.value),\n          maximumBinCount: 512,\n        });\n        rangeMin = geometry.min;\n        rangeMax = geometry.max;\n        resolvedBinCount = geometry.binCount;\n      } catch (error) {\n        empty.hidden = false;\n        empty.querySelector('strong')!.textContent = 'Fixed Distribution geometry is invalid.';\n        empty.querySelector('span')!.textContent = error instanceof Error ? error.message : String(error);\n        canvas.hidden = true; statsPanel.replaceChildren(); legend.replaceChildren(); return;\n      }\n    } else {\n      resolvedBinCount = binMode === 'manual'\n        ? Math.max(1, Math.min(512, Math.floor(Number(binCountInput.value) || 20)))\n        : autoBinCountFromValues(allValues);\n      binCountInput.value = String(resolvedBinCount);\n    }\n\n    const series = available.map((item) => buildSeries(item.trace, item.request.scope, item.qualification, resolvedBinCount, rangeMin, rangeMax, item.request.color));")
replace_once('apps/web/src/pages/histogram-distribution-view.ts',
"    lastRangeMin = extent.min;\n    lastRangeMax = extent.max;",
"    lastRangeMin = rangeMin;\n    lastRangeMax = rangeMax;")
replace_once('apps/web/src/pages/histogram-distribution-view.ts',
"    renderChart(series, extent.min, extent.max);",
"    renderChart(series, rangeMin, rangeMax);")

# Presets restore fixed values/visibility.
replace_once('apps/web/src/pages/histogram-distribution-view.ts',
"    binMode = preset.binMode; binModeSelect.value = binMode; binCountInput.value = preset.binCount; binCountInput.hidden = binMode !== 'manual';",
"    binMode = preset.binMode; binModeSelect.value = binMode; binCountInput.value = preset.binCount;\n    fixedMinInput.value = preset.fixedMin ?? fixedMinInput.value;\n    fixedMaxInput.value = preset.fixedMax ?? fixedMaxInput.value;\n    fixedWidthInput.value = preset.fixedWidth ?? fixedWidthInput.value;\n    syncBinGeometryControls();")
# CSV exposes outside count.
replace_once('apps/web/src/pages/histogram-distribution-view.ts',
"        rejectedSampleCount: series.qualification.rejectedSampleCount,\n      })),",
"        rejectedSampleCount: series.qualification.rejectedSampleCount,\n        outsideGeometrySampleCount: series.outsideGeometrySampleCount,\n      })),")
# Events and initial control sync.
replace_once('apps/web/src/pages/histogram-distribution-view.ts',
"  binModeSelect.addEventListener('change', () => { binMode = binModeSelect.value === 'manual' ? 'manual' : 'auto'; binCountInput.hidden = binMode !== 'manual'; void render(); });\n  binCountInput.addEventListener('change', () => { void render(); });",
"  binModeSelect.addEventListener('change', () => { binMode = binModeSelect.value === 'manual' ? 'manual' : binModeSelect.value === 'fixed' ? 'fixed' : 'auto'; syncBinGeometryControls(); void render(); });\n  binCountInput.addEventListener('change', () => { void render(); });\n  fixedMinInput.addEventListener('change', () => { void render(); });\n  fixedMaxInput.addEventListener('change', () => { void render(); });\n  fixedWidthInput.addEventListener('change', () => { void render(); });")
replace_once('apps/web/src/pages/histogram-distribution-view.ts',
"  populateHistogramQualificationSelect(qualificationSelect, qualificationSets, context.channels);\n  refreshScopeSelectors();",
"  populateHistogramQualificationSelect(qualificationSelect, qualificationSets, context.channels);\n  syncBinGeometryControls();\n  refreshScopeSelectors();")

# CSV provenance for clipped fixed geometry.
replace_once('apps/web/src/pages/histogram-distribution-csv.ts',
"  readonly rejectedSampleCount: number;\n}",
"  readonly rejectedSampleCount: number;\n  readonly outsideGeometrySampleCount?: number;\n}")
replace_once('apps/web/src/pages/histogram-distribution-csv.ts',
"    'input_samples', 'eligible_samples', 'rejected_samples',\n",
"    'input_samples', 'eligible_samples', 'rejected_samples', 'outside_geometry_samples',\n")
replace_once('apps/web/src/pages/histogram-distribution-csv.ts',
"        '', '', '', '', '', '', '', '', '', '', '', '', '',\n",
"        '', '', '', '', '', '', '', '', '', '', '', '', '', '',\n")
replace_once('apps/web/src/pages/histogram-distribution-csv.ts',
"      series.inputSampleCount, series.eligibleSampleCount, series.rejectedSampleCount,\n",
"      series.inputSampleCount, series.eligibleSampleCount, series.rejectedSampleCount, series.outsideGeometrySampleCount ?? 0,\n")

# Compact fixed geometry controls.
replace_once('apps/web/src/styles/histogram-distribution.css',
".distribution-bin-count { width: 58px; padding: 0 6px; }",
".distribution-bin-count { width: 58px; padding: 0 6px; }\n.distribution-fixed-control[hidden] { display: none !important; }\n.distribution-fixed-control input { width: 66px; padding: 0 6px; }")

# Tests.
(ROOT/'tests/analysis/distribution-geometry.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import { distributionValueInsideGeometry, resolveFixedDistributionGeometry } from '../../core/analysis/distribution-geometry';

describe('fixed Distribution geometry', () => {
  it('resolves exact repeatable min/max/width geometry', () => {
    expect(resolveFixedDistributionGeometry({ min: 0, max: 250, width: 5 })).toEqual({ min: 0, max: 250, width: 5, binCount: 50 });
    expect(resolveFixedDistributionGeometry({ min: -1, max: 1, width: .1 }).binCount).toBe(20);
  });

  it('rejects ambiguous partial-width or excessive geometry', () => {
    expect(() => resolveFixedDistributionGeometry({ min: 0, max: 10, width: 3 })).toThrow(/whole number/i);
    expect(() => resolveFixedDistributionGeometry({ min: 0, max: 1000, width: 1, maximumBinCount: 512 })).toThrow(/1–512/);
  });

  it('treats both fixed endpoints as inside the requested geometry', () => {
    expect(distributionValueInsideGeometry(0, 0, 100)).toBe(true);
    expect(distributionValueInsideGeometry(100, 0, 100)).toBe(true);
    expect(distributionValueInsideGeometry(-.001, 0, 100)).toBe(false);
    expect(distributionValueInsideGeometry(100.001, 0, 100)).toBe(false);
  });
});
''')

# Extend storage tests by broad replacement of example and assertions only if anchors exist.
replace_once('tests/web/histogram-distribution-storage.test.ts',
"      binCount: '24',\n      display: 'cumulative',",
"      binCount: '24',\n      fixedMin: '0',\n      fixedMax: '250',\n      fixedWidth: '5',\n      display: 'cumulative',")
# CSV test expects new provenance column/value.
replace_once('tests/web/histogram-distribution-csv.test.ts',
"        rejectedSampleCount: 5,\n      }],",
"        rejectedSampleCount: 5,\n        outsideGeometrySampleCount: 3,\n      }],")
replace_once('tests/web/histogram-distribution-csv.test.ts',
"    expect(exported.csv).toContain('100,95,5');",
"    expect(exported.csv).toContain('100,95,5,3');")

replace_once('docs/HISTOGRAM.md',
"- automatic/manual bin count;",
"- automatic/manual bin count plus explicit fixed min/max/bin-width geometry for reproducible repeated tests;")
replace_once('docs/HISTOGRAM.md',
"The setup-persistence and export maturity pass is complete. Remaining improvements are narrower:\n\n- explicit fixed min/max/bin-width geometry for reproducible repeated tests;\n- deeper consolidation around shared histogram-core primitives where that reduces duplicate definitions without changing behavior.",
"The research-driven Distribution maturity pass is complete, including reproducible fixed geometry. Remaining work is implementation cleanup only, such as deeper consolidation around shared histogram-core primitives where that reduces duplicate definitions without changing behavior.")
