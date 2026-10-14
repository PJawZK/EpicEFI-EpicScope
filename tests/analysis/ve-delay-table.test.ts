import { describe, expect, it } from 'vitest';
import type { AfrDelayEvent } from '../../core/analysis/afr-delay-analyzer';
import { buildVeDelayTable, interpolateVeDelayTable, resetVeDelayWorkingToRecommendation } from '../../core/analysis/ve-delay-table';

function event(rpm: number, load: number, onsetDelayMs: number): AfrDelayEvent {
  return {
    commandSampleIndex: 1,
    responseSampleIndex: 2,
    commandTimeMs: 100,
    responseTimeMs: 100 + onsetDelayMs,
    onsetDelayMs,
    commandDelta: 1,
    baselineAfr: 14,
    responseAfr: 13.5,
    responseDeltaAfr: -0.5,
    peakResponseDeltaAfr: -0.7,
    peakResponseDelayMs: onsetDelayMs + 20,
    t50Ms: onsetDelayMs + 10,
    t90Ms: onsetDelayMs + 30,
    rpm,
    load,
  };
}

describe('VE lambda delay table', () => {
  it('builds robust measured RPM/load cells and preserves event evidence', () => {
    const table = buildVeDelayTable([
      event(1000, 50, 100),
      event(1000, 50, 120),
      event(1000, 50, 900),
    ], [1000, 2000], [50, 100], { minimumMeasuredEvents: 2 });
    const cell = table.cells[0]!;
    expect(cell.state).toBe('measured');
    expect(cell.eventCount).toBe(3);
    expect(cell.recommendedMs).toBe(120);
    expect(cell.workingMs).toBe(120);
    expect(cell.p10Ms).toBeCloseTo(104);
    expect(cell.p90Ms).toBeCloseTo(744);
  });

  it('marks sparse direct evidence insufficient instead of presenting it as measured', () => {
    const table = buildVeDelayTable([event(1000, 50, 100)], [1000, 2000], [50, 100], { minimumMeasuredEvents: 2 });
    expect(table.cells[0]?.state).toBe('insufficient');
    expect(table.cells[0]?.eventCount).toBe(1);
    expect(table.cells[0]?.workingMs).toBeUndefined();
  });

  it('interpolates empty regions only when multiple measured neighbors exist', () => {
    const table = buildVeDelayTable([
      event(1000, 50, 100), event(1000, 50, 110),
      event(2000, 100, 300), event(2000, 100, 310),
    ], [1000, 1500, 2000], [50, 75, 100], { minimumMeasuredEvents: 2 });
    const center = table.cells[1 * table.cols + 1]!;
    expect(center.state).toBe('interpolated');
    expect(center.workingMs).toBeCloseTo(205);
    expect(center.confidence).toBe('limited');
  });

  it('interpolates the working table in RPM/load space without extrapolation', () => {
    const table = buildVeDelayTable([
      event(1000, 50, 100), event(1000, 50, 100),
      event(2000, 50, 200), event(2000, 50, 200),
      event(1000, 100, 300), event(1000, 100, 300),
      event(2000, 100, 400), event(2000, 100, 400),
    ], [1000, 2000], [50, 100], { minimumMeasuredEvents: 2 });
    expect(interpolateVeDelayTable(table, 1500, 75)).toBeCloseTo(250);
    expect(interpolateVeDelayTable(table, 999, 75)).toBeUndefined();
  });

  it('keeps working values separable from recommendation state', () => {
    const table = buildVeDelayTable([
      event(1000, 50, 100), event(1000, 50, 120),
      event(2000, 100, 300), event(2000, 100, 320),
    ], [1000, 2000], [50, 100]);
    const altered = {
      ...table,
      cells: table.cells.map((cell, index) => index === 0 ? { ...cell, workingMs: 250 } : cell),
    };
    expect(altered.cells[0]?.workingMs).toBe(250);
    expect(resetVeDelayWorkingToRecommendation(altered).cells[0]?.workingMs).toBe(table.cells[0]?.recommendedMs);
  });
});
