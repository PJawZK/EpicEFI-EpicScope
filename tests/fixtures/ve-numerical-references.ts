import type { NumericChannelRange } from '../../core/log-model/log-types';
import { analyzeAfrDelay, type AfrDelayEvent } from '../../core/analysis/afr-delay-analyzer';
import { buildVeEvidenceMap, interpolateNumericRangeAtTime, interpolateVeTable, type VeEvidenceInputs } from '../../core/analysis/ve-evidence-map';
import { buildVeEvidenceMapWithDelayTable, buildVeEvidenceMapWithDelayTableAsync } from '../../core/analysis/ve-delay-aligned-evidence';
import { buildVeDelayTable, interpolateVeDelayTable, type VeDelayTable } from '../../core/analysis/ve-delay-table';
import { parseVeDelayTableFile, serializeVeDelayTable } from '../../core/analysis/ve-delay-table-storage';
import { editVeDelayCellValues } from '../../core/analysis/ve-delay-table-editing';
import { buildVeProposal } from '../../core/analysis/ve-proposal';
import { robustWeightedEstimate, robustWeightedEstimateSteps } from '../../core/analysis/ve-evidence-statistics';
import { finishVeAnalysis } from '../../core/analysis/ve-analysis-work';
import { TableInteractionSession, type TableEditSurface } from '../../apps/web/src/pages/ve-table-interaction';
import { applyVeQualificationValidity } from '../../apps/web/src/pages/ve-analyzer-qualification';
import { veResultDisplay } from '../../apps/web/src/pages/ve-analyzer-result-view';
import { projectVeTable } from '../../apps/web/src/pages/ve-analyzer-table-projection';

/** Literal/rational reference results are derived in docs/VE_V50_NUMERICAL_AUDIT.md.
 * This file is shared with the real-browser probe; it has no Vitest/DOM dependency.
 * Known issues assert the intended mathematical boundary, not today's bad output.
 */
export interface VeNumericalReference {
  readonly id: string;
  readonly title: string;
  readonly expected: unknown;
  readonly run: () => unknown | Promise<unknown>;
  readonly knownIssue?: string;
}

function range(values: readonly number[], times?: readonly number[], startSampleIndex = 0): NumericChannelRange {
  return { startSampleIndex, values: Float64Array.from(values), validity: new Uint8Array(values.length).fill(1),
    timeMs: Float64Array.from(times ?? values.map((_, i) => i * 100)) };
}
function inputs(count = 20, actual = 15.4, target = 14): VeEvidenceInputs {
  return { actualMixture: range(new Array<number>(count).fill(actual)), rpm: range(new Array<number>(count).fill(1000)),
    load: range(new Array<number>(count).fill(50)), target: { rpmBins: [1000], loadBins: [50], rows: 1, cols: 1, values: [target] },
    veRpmBins: [1000], veLoadBins: [50] };
}
function delay(values: readonly (number | undefined)[], rpmBins: readonly number[] = [1000, 2000], loadBins: readonly number[] = [50]): VeDelayTable {
  return { rpmBins, loadBins, rows: loadBins.length, cols: rpmBins.length, origin: 'saved-file', cells: values.map((workingMs, i) => ({
    row: Math.floor(i / rpmBins.length), col: i % rpmBins.length, workingMs, recommendedMs: workingMs,
    state: workingMs === undefined ? 'insufficient' : 'measured', workingProvenance: workingMs === undefined ? undefined : 'measured-recommendation',
    eventCount: workingMs === undefined ? 0 : 3, p10Ms: workingMs, p90Ms: workingMs, spreadMs: workingMs === undefined ? undefined : 0,
    confidence: workingMs === undefined ? 'none' : 'moderate', sourceEvents: [],
  })) };
}
function event(onsetDelayMs: number, rpm = 1000): AfrDelayEvent {
  return { commandSampleIndex: 0, responseSampleIndex: 1, commandTimeMs: 0, responseTimeMs: onsetDelayMs, onsetDelayMs,
    commandDelta: 1, baselineAfr: 14, responseAfr: 13, responseDeltaAfr: -1, peakResponseDeltaAfr: -1,
    peakResponseDelayMs: onsetDelayMs, t50Ms: onsetDelayMs, t90Ms: onsetDelayMs, rpm, load: 50 };
}
function proposal(current = 70, actual = 15.4, count = 20, priorWeight = 20, maximumAbsoluteChange = 100, maximumPercentChange = 100) {
  const evidence = buildVeEvidenceMap(inputs(count, actual), { minimumStableDurationMs: 0 });
  return buildVeProposal([current], 1, 1, evidence, { priorWeight, minimumEvidenceWeight: 8, maximumAbsoluteChange, maximumPercentChange }).cells[0]!;
}
function interpolateEdit(initial: readonly number[], xs: readonly number[], ys: readonly number[], options: Parameters<TableInteractionSession['interpolate']>[0], pins: readonly { row: number; col: number }[] = [], selection?: readonly [{ row: number; col: number }, { row: number; col: number }]) {
  let values = [...initial];
  let commits = 0;
  const surface: TableEditSurface = { rows: ys.length, cols: xs.length, get: (r, c) => values[r * xs.length + c]!,
    colCoordinate: c => xs[c]!, rowCoordinate: r => ys[r]!, beginTransaction: () => {
      const draft = [...values];
      return { get: (r, c) => draft[r * xs.length + c]!, set: (r, c, v) => { draft[r * xs.length + c] = v; },
        cancel: () => {}, commit: () => { if (draft.every((v, i) => Object.is(v, values[i]))) return false; values = draft; commits++; return true; } };
    } };
  const session = new TableInteractionSession(surface);
  if (pins.length) { session.setSelection(pins); session.togglePinsForSelection(); }
  session.setRectangle(...(selection ?? [{ row: 0, col: 0 }, { row: ys.length - 1, col: xs.length - 1 }]));
  session.interpolate(options);
  return { values, commits };
}

const references: VeNumericalReference[] = [
  { id: 'R01', title: 'Lean AFR correction and equal prior/evidence blend', expected: [77, 73.5, 3.5, 5, 'measured'], run: () => {
    const p = proposal(); return [p.evidenceCandidate, p.proposedValue, p.changeValue, p.changePercent, p.state];
  } },
  { id: 'R02', title: 'Rich AFR correction lowers VE', expected: [63, 66.5, -3.5, -5], run: () => {
    const p = proposal(70, 12.6); return [p.evidenceCandidate, p.proposedValue, p.changeValue, p.changePercent];
  } },
  { id: 'R03', title: 'Common AFR-to-Lambda scale cancels in correction ratio', expected: [1.1, 1.1], run: () => {
    return [buildVeEvidenceMap(inputs(1, 15.4, 14), { minimumStableDurationMs: 0 }).cells[0]!.correctionRatio,
      buildVeEvidenceMap(inputs(1, 1.1, 1), { minimumStableDurationMs: 0 }).cells[0]!.correctionRatio];
  } },
  { id: 'R04', title: 'Positive applied fuel trim multiplies base-VE correction', expected: 1.155, run: () =>
    buildVeEvidenceMap({ ...inputs(1), fuelCorrectionPercent: range([5]) }, { minimumStableDurationMs: 0, compensateFuelCorrectionPercent: true }).cells[0]!.correctionRatio },
  { id: 'R05', title: 'Negative trim and invalid -100 percent boundary', expected: [0.99, 1, 0], run: () => {
    const valid = buildVeEvidenceMap({ ...inputs(1), fuelCorrectionPercent: range([-10]) }, { minimumStableDurationMs: 0, compensateFuelCorrectionPercent: true });
    const invalid = buildVeEvidenceMap({ ...inputs(1), fuelCorrectionPercent: range([-100]) }, { minimumStableDurationMs: 0, compensateFuelCorrectionPercent: true });
    return [valid.cells[0]!.correctionRatio, invalid.fuelCorrectionUnavailableSampleCount, invalid.contributingSampleCount];
  } },
  { id: 'R06', title: 'Zero prior follows eligible evidence', expected: 77, run: () => proposal(70, 15.4, 20, 0).proposedValue },
  { id: 'R07', title: 'Current policy: raw candidate limits precede prior shrinkage', expected: ['withheld-limit', 105, undefined], run: () => {
    const p = proposal(70, 21, 1, 100, 20, 20); return [p.state, p.evidenceCandidate, p.proposedValue];
  } },
  { id: 'R08', title: 'Below evidence threshold is withheld as weak', expected: ['weak-evidence', undefined], run: () => {
    const p = proposal(70, 15.4, 7); return [p.state, p.proposedValue];
  } },
  { id: 'R09', title: 'Current policy: zero source VE is protected by undefined relative change', expected: 'withheld-limit', run: () => proposal(0).state },
  { id: 'R10', title: 'Weighted inverse-CDF median and percentile boundary', expected: [2, 1, 2, 1, 10, 3], run: () => {
    const e = robustWeightedEstimate([{ value: 4, weight: 1 }, { value: 1, weight: 1 }, { value: 2, weight: 8 }]);
    return [e.median, e.p10, e.p90, e.spread, e.totalWeight, e.observationCount];
  } },
  { id: 'R11', title: 'Weighted median convention does not average even middle observations', expected: 100, run: () =>
    robustWeightedEstimate([0, 100, 200, 300].map(value => ({ value, weight: 1 }))).median },
  { id: 'R12', title: 'Robust estimator filters nonfinite values and nonpositive weights', expected: [2, 3, 1], run: () => {
    const e = robustWeightedEstimate([{ value: NaN, weight: 1 }, { value: 1, weight: 0 }, { value: 2, weight: 3 }, { value: 3, weight: -1 }, { value: 4, weight: Infinity }]);
    return [e.median, e.totalWeight, e.observationCount];
  } },
  { id: 'R13', title: 'Cooperative weighted estimator matches the independent quantile case', expected: [2, 1, 2], run: () => {
    const e = finishVeAnalysis(robustWeightedEstimateSteps([{ value: 4, weight: 1 }, { value: 1, weight: 1 }, { value: 2, weight: 8 }])); return [e.median, e.p10, e.p90];
  } },
  { id: 'R14', title: 'Evidence confidence thresholds include weight and spread', expected: ['limited', 'moderate', 'strong'], run: () =>
    [7, 8, 20].map(n => buildVeEvidenceMap(inputs(n), { minimumStableDurationMs: 0 }).cells[0]!.confidence) },
  { id: 'R15', title: 'Quarter-cell influence conserves one observation weight', expected: [0.5625, 0.1875, 0.1875, 0.0625], run: () => {
    const i = inputs(1); return buildVeEvidenceMap({ ...i, rpm: range([1250]), load: range([62.5]), veRpmBins: [1000, 2000], veLoadBins: [50, 100],
      target: { ...i.target, rpmBins: [1000, 2000], loadBins: [50, 100], rows: 2, cols: 2, values: [14, 14, 14, 14] } }, { minimumStableDurationMs: 0 }).cells.map(c => c.totalWeight);
  } },
  { id: 'R16', title: 'Irregular timestamps interpolate physical time rather than record offset', expected: [1400, undefined, undefined], run: () => {
    const r = range([1000, 1200, 1600, 2000], [0, 70, 210, 400]);
    const a = interpolateNumericRangeAtTime(r, 140); r.validity[2] = 0;
    return [a, interpolateNumericRangeAtTime(r, 140), interpolateNumericRangeAtTime(r, -1)];
  } },
  { id: 'R17', title: 'Target lookup uses physical bilinear fractions and refuses extrapolation', expected: [15, undefined], run: () => {
    const table = { rpmBins: [1000, 3000], loadBins: [40, 80], rows: 2, cols: 2, values: [0, 20, 40, 60] };
    return [interpolateVeTable(table, 1500, 50), interpolateVeTable(table, 999, 50)];
  } },
  { id: 'R18', title: 'Delay lookup bilinearly interpolates working values, not recommendation labels', expected: 150, run: () =>
    interpolateVeDelayTable(delay([0, 200, 400, 600], [1000, 3000], [40, 80]), 1500, 50) },
  { id: 'R19', title: 'Delay event quantiles use interpolated order statistics', expected: [150, 30, 270, 240], run: () => {
    const c = buildVeDelayTable([0, 100, 200, 300].map(v => event(v)), [1000], [50], { minimumMeasuredEvents: 1 }).cells[0]!;
    return [c.workingMs, c.p10Ms, c.p90Ms, c.spreadMs];
  } },
  { id: 'R20', title: 'Sparse recommendation interpolation preserves absence of direct events', expected: ['interpolated', 200, 0, 0], run: () => {
    const c = buildVeDelayTable([event(100, 1000), event(300, 3000)], [1000, 2000, 3000], [50], { minimumMeasuredEvents: 1, maximumInterpolationDistance: 0.6 }).cells[1]!;
    return [c.state, c.workingMs, c.eventCount, c.sourceEvents.length];
  } },
  { id: 'R21', title: 'Constant delay aligns target and trim to engine time, retaining observed source index', expected: [1, 1.1, [10]], run: () => {
    const i = inputs(11, 14); const r = buildVeEvidenceMapWithDelayTable({ ...i, fuelCorrectionPercent: range(Array.from({ length: 11 }, (_, index) => index === 9 ? 10 : 0)),
      sampleIndices: [10], delayTable: delay([100], [1000]) }, { minimumStableDurationMs: 0, compensateFuelCorrectionPercent: true });
    return [r.contributingSampleCount, r.cells[0]!.correctionRatio, [...r.cells[0]!.sampleIndices]];
  } },
  { id: 'R22', title: 'Delay boundary before available engine history is unavailable', expected: [1, 0], run: () => {
    const r = buildVeEvidenceMapWithDelayTable({ ...inputs(1), delayTable: delay([100], [1000]) }, { minimumStableDurationMs: 0 });
    return [r.delayUnavailableSampleCount, r.contributingSampleCount];
  } },
  { id: 'R23', title: 'Current policy: one delay refinement is an approximation, not a fixed-point solver', expected: [0.16, 0.84], run: () => {
    const i = inputs(11, 14); return buildVeEvidenceMapWithDelayTable({ ...i, rpm: range(Array.from({ length: 11 }, (_, n) => 1000 + n * 100)),
      target: { ...i.target, rpmBins: [1000, 2000], cols: 2, values: [14, 14] }, veRpmBins: [1000, 2000], sampleIndices: [10], delayTable: delay([0, 200]) },
    { minimumStableDurationMs: 0 }).cells.map(c => c.totalWeight);
  } },
  { id: 'R24', title: 'Asynchronous delay-aligned calculation preserves reference arithmetic', expected: [1.1, 20], run: async () => {
    const r = await buildVeEvidenceMapWithDelayTableAsync({ ...inputs(), delayTable: delay([0], [1000]) }, { minimumStableDurationMs: 0 }, { yieldControl: async () => {} });
    return [r.cells[0]!.correctionRatio, r.cells[0]!.totalWeight];
  } },
  { id: 'R25', title: 'Delay discovery onset and t50/t90 are first observed threshold crossings', expected: [1, 100, 200, 300], run: () => {
    const r = analyzeAfrDelay({ actualAfr: range([14, 14, 13.8, 13, 12, 12]), fuelCommand: range([1, 2, 2, 2, 2, 2]) }, { commandDeltaThreshold: 0.5, afrResponseThreshold: 0.1 });
    return [r.usableEventCount, r.events[0]!.onsetDelayMs, r.events[0]!.t50Ms, r.events[0]!.t90Ms];
  } },
  { id: 'R26', title: 'Invalid samples prevent delay response discovery across a gap', expected: [0, 1], run: () => {
    const actualAfr = range([14, 14, 13, 12]); actualAfr.validity[2] = 0;
    const r = analyzeAfrDelay({ actualAfr, fuelCommand: range([1, 2, 2, 2]) }, { commandDeltaThreshold: 0.5, afrResponseThreshold: 0.1 }); return [r.usableEventCount, r.rejectedGapCount];
  } },
  { id: 'R27', title: 'Qualification includes threshold equality and does not mutate source validity', expected: [[0, 1, 1], [1, 1, 1]], run: () => {
    const source = range([1, 2, 3]); const r = applyVeQualificationValidity(source, { minimumClt: 70, maximumTps: 90 }, range([69, 70, 71]), range([20, 90, 89]));
    return [[...r.validity], [...source.validity]];
  } },
  { id: 'R28', title: 'Current policy: steady regression rate can cancel an RPM excursion', expected: 1, run: () => {
    const i = inputs(3); return buildVeEvidenceMap({ ...i, rpm: range([1000, 2000, 1000]), target: { ...i.target, rpmBins: [1000, 2000], cols: 2, values: [14, 14] } },
      { minimumStableDurationMs: 200, maximumRpmRatePerSecond: 100 }).eligibleSampleCount;
  } },
  { id: 'R29', title: 'Current policy: elapsed timestamp gap has no maximum interpolation duration', expected: [2000, 1], run: () => {
    const i = inputs(2); const times = [0, 10000];
    const r = buildVeEvidenceMap({ ...i, actualMixture: range([14, 14], times), rpm: range([1000, 1000], times), load: range([50, 50], times) }, { minimumStableDurationMs: 300 });
    return [interpolateNumericRangeAtTime(range([1000, 3000], times), 5000), r.eligibleSampleCount];
  } },
  { id: 'R30', title: 'Nonuniform edit interpolation uses physical RPM spacing', expected: { values: [10, 12.5, 20], commits: 1 }, run: () =>
    interpolateEdit([10, 99, 20], [1000, 1500, 3000], [50], { axis: 'horizontal', method1d: 'linear', strength: 1 }) },
  { id: 'R31', title: 'Reversing physical axes preserves the same geometric interpolation', expected: { values: [20, 12.5, 10], commits: 1 }, run: () =>
    interpolateEdit([20, 99, 10], [3000, 1500, 1000], [50], { axis: 'horizontal', strength: 1 }) },
  { id: 'R32', title: 'Pinned interior anchor divides the linear interpolation into segments', expected: { values: [0, 10, 20, 30, 40], commits: 1 }, run: () =>
    interpolateEdit([0, 99, 20, 99, 40], [0, 1, 2, 3, 4], [0], { axis: 'horizontal', strength: 1 }, [{ row: 0, col: 2 }]) },
  { id: 'R33', title: 'PCHIP reference from rational harmonic-mean slopes', expected: 63 / 34, run: () =>
    interpolateEdit([0, 1, 999, 3, 6], [0, 1, 2, 3, 4], [0], { axis: 'horizontal', method1d: 'shape', strength: 1 }, [], [{ row: 0, col: 1 }, { row: 0, col: 3 }]).values[2] },
  { id: 'R34', title: 'Physical bilinear editing fills sparse interior from four corners', expected: 15, run: () =>
    interpolateEdit([0, NaN, 20, NaN, NaN, NaN, 40, NaN, 60], [0, 1, 4], [0, 1, 4], { axis: 'both', method2d: 'bilinear', strength: 1 }).values[4] },
  { id: 'R35', title: 'Boundary surface equals bilinear base plus weighted edge deviations', expected: 20, run: () =>
    interpolateEdit([0, 8, 20, 12, 999, 32, 40, 48, 60], [0, 1, 4], [0, 1, 4], { axis: 'both', method2d: 'boundary', strength: 1 }).values[4] },
  { id: 'R36', title: 'Current policy: clamp is applied after strength blend', expected: [78.125, 20], run: () => [false, true].map(clamp =>
    interpolateEdit([10, 100, 20], [1000, 1500, 3000], [50], { axis: 'horizontal', strength: 0.25, clamp }).values[1]) },
  { id: 'R37', title: 'Presentation rounding retains full numerical proposal authority', expected: ['73.78', 2730 / 37, '5.4%', 200 / 37], run: () => {
    const p = buildVeProposal([70], 1, 1, buildVeEvidenceMap(inputs(), { minimumStableDurationMs: 0 }), { priorWeight: 17, minimumEvidenceWeight: 8, maximumAbsoluteChange: 100, maximumPercentChange: 100 });
    const m = projectVeTable([70], 1, 1, undefined, undefined, undefined, p).cells[0]!;
    const v = veResultDisplay(m, 'proposal'), c = veResultDisplay(m, 'change-percent'); return [v.text, v.numericValue, c.text.replace('+', ''), c.numericValue];
  } },
  { id: 'R38', title: 'Equality at raw absolute/relative limits remains eligible', expected: ['measured', 100], run: () => {
    const p = proposal(80, 17.5, 20, 0, 20, 25); return [p.state, p.proposedValue];
  } },
  { id: 'R39', title: 'Cooperative merge-sort quantiles cross bounded-run boundaries correctly', expected: [1, 1, 2, 4099], run: () => {
    const e = finishVeAnalysis(robustWeightedEstimateSteps(Array.from({ length: 4099 }, (_, n) => ({ value: n % 2 ? 2 : 1, weight: 1 }))));
    return [e.median, e.p10, e.p90, e.totalWeight];
  } },
  { id: 'R40', title: 'Filtering small node contributions does not renormalize remaining weight', expected: [0.5625, 0, 0, 0], run: () => {
    const i = inputs(1); return buildVeEvidenceMap({ ...i, rpm: range([1250]), load: range([62.5]), veRpmBins: [1000, 2000], veLoadBins: [50, 100],
      target: { ...i.target, rpmBins: [1000, 2000], loadBins: [50, 100], rows: 2, cols: 2, values: [14, 14, 14, 14] } },
    { minimumStableDurationMs: 0, minimumIndividualWeight: 0.2 }).cells.map(c => c.totalWeight);
  } },
  { id: 'R41', title: 'Current policy: same displayed millisecond snaps a delay edit to recommendation', expected: [100.1, 'measured-recommendation'], run: () => {
    const c = editVeDelayCellValues(delay([100.1], [1000]), [{ row: 0, col: 0, workingMs: 100.4 }]).cells[0]!;
    return [c.workingMs, c.workingProvenance];
  } },
  { id: 'R42', title: 'An explicitly invalid observation resets the trailing stable window', expected: [1, 1, [6]], run: () => {
    const i = inputs(7); i.actualMixture.validity[2] = 0;
    const r = buildVeEvidenceMap(i, { minimumStableDurationMs: 300 });
    return [r.invalidSampleCount, r.eligibleSampleCount, [...r.cells[0]!.sampleIndices]];
  } },
  { id: 'N01', title: 'An exact sparse delay node must not depend on a zero-weight neighbor', expected: 200,
    knownIssue: 'interpolateVeDelayTable requires unused bracket corners at an exact interior node', run: () => interpolateVeDelayTable(delay([100, 200, undefined], [1000, 2000, 3000]), 2000, 50) },
  { id: 'N02', title: 'Unavailable engine-point delay must withhold rather than retain observed-point delay', expected: [0, 2],
    knownIssue: 'delay refinement silently retains the observed-point delay when refined lookup is unavailable', run: () => {
      const i = inputs(2, 14); const r = buildVeEvidenceMapWithDelayTable({ ...i, rpm: range([1000, 2000]), veRpmBins: [1000, 2000],
        target: { ...i.target, rpmBins: [1000, 2000], cols: 2, values: [14, 14] }, delayTable: delay([undefined, 100, 100], [1000, 2000, 3000]) }, { minimumStableDurationMs: 0 });
      return [r.contributingSampleCount, r.delayUnavailableSampleCount];
    } },
  { id: 'N03', title: 'Timestamp alignment must preserve the observation array sample-index origin', expected: 2,
    knownIssue: 'aligned RPM/load arrays inherit the input engine range startSampleIndex instead of the actual-mixture origin', run: () => {
      const i = inputs(2, 14); const r = buildVeEvidenceMapWithDelayTable({ ...i, actualMixture: range([14, 14], [100, 200], 10),
        rpm: range([1000, 1000, 1000], [0, 100, 200]), load: range([50, 50, 50], [0, 100, 200]), delayTable: delay([0], [1000]) }, { minimumStableDurationMs: 0 });
      return r.contributingSampleCount;
    } },
  { id: 'N05', title: 'Delay-unavailable counts must be restricted to the selected input samples', expected: [1, 0, 1],
    knownIssue: 'delay alignment counts unavailable observations outside the selected sample set', run: () => {
      const r = buildVeEvidenceMapWithDelayTable({ ...inputs(3, 14), sampleIndices: [2], delayTable: delay([100], [1000]) }, { minimumStableDurationMs: 0 });
      return [r.inputSampleCount, r.delayUnavailableSampleCount, r.contributingSampleCount];
    } },
];
for (const [id, axes] of [['N04a', [3000, 2000, 1000]], ['N04b', [1000, 1000, 3000]], ['N04c', [1000, 3000, 2000]]] as const) {
  references.push({ id, title: 'Saved delay axes must be strictly increasing: ' + axes.join(','), expected: 'rejected',
    knownIssue: 'saved-delay parser accepts axes incompatible with ascending binary lookup', run: () => {
      try { parseVeDelayTableFile(serializeVeDelayTable(delay([100, 200, 300], axes))); return 'accepted'; }
      catch { return 'rejected'; }
    } });
}

export const VE_NUMERICAL_REFERENCES: readonly VeNumericalReference[] = references;
