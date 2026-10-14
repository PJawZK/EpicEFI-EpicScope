import { describe, expect, it } from 'vitest';
import type { AfrDelayEvent } from '../../core/analysis/afr-delay-analyzer';
import { buildVeDelayTable } from '../../core/analysis/ve-delay-table';
import {
  activateVeDelayRecommendation,
  revertVeDelayCellToRecommendation,
  setVeDelayWorkingCell,
} from '../../core/analysis/ve-delay-table-editing';

function event(onsetDelayMs: number): AfrDelayEvent {
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
    rpm: 1000,
    load: 50,
  };
}

describe('VE lambda delay direct editing', () => {
  it('supports repeated edits while retaining raw recommendation evidence', () => {
    const base = buildVeDelayTable([event(100), event(120), event(140)], [1000], [50], {
      minimumMeasuredEvents: 3,
      adaptiveGeometry: false,
    });
    const first = setVeDelayWorkingCell(base, 0, 0, 175);
    const second = setVeDelayWorkingCell(first, 0, 0, 190);

    expect(second.cells[0]?.recommendedMs).toBe(120);
    expect(second.cells[0]?.workingMs).toBe(190);
    expect(second.cells[0]?.workingProvenance).toBe('user-edited');
    expect(second.cells[0]?.sourceEvents).toHaveLength(3);
  });

  it('supports an explicit empty working cell without erasing recommendation evidence', () => {
    const base = buildVeDelayTable([event(100), event(120), event(140)], [1000], [50], {
      minimumMeasuredEvents: 3,
      adaptiveGeometry: false,
    });
    const cleared = setVeDelayWorkingCell(base, 0, 0, undefined);

    expect(cleared.cells[0]?.recommendedMs).toBe(120);
    expect(cleared.cells[0]?.workingMs).toBeUndefined();
    expect(cleared.cells[0]?.workingProvenance).toBe('user-edited');

    const reverted = revertVeDelayCellToRecommendation(cleared, 0, 0);
    expect(reverted.cells[0]?.workingMs).toBe(120);
    expect(reverted.cells[0]?.workingProvenance).toBe('measured-recommendation');
  });

  it('returns an originally empty cell to untouched provenance when it is cleared again', () => {
    const base = buildVeDelayTable([], [1000], [50], {
      minimumMeasuredEvents: 3,
      adaptiveGeometry: false,
    });
    const edited = setVeDelayWorkingCell(base, 0, 0, 175);
    expect(edited.cells[0]?.workingProvenance).toBe('user-edited');

    const cleared = setVeDelayWorkingCell(edited, 0, 0, undefined);
    expect(cleared.cells[0]?.recommendedMs).toBeUndefined();
    expect(cleared.cells[0]?.workingMs).toBeUndefined();
    expect(cleared.cells[0]?.workingProvenance).toBeUndefined();
  });

  it('removes user-edit provenance when the generated value is entered again', () => {
    const base = buildVeDelayTable([event(100), event(120), event(140)], [1000], [50], {
      minimumMeasuredEvents: 3,
      adaptiveGeometry: false,
    });
    const edited = setVeDelayWorkingCell(base, 0, 0, 175);
    expect(edited.cells[0]?.workingProvenance).toBe('user-edited');

    const restored = setVeDelayWorkingCell(edited, 0, 0, 120);
    expect(restored.cells[0]?.workingMs).toBe(120);
    expect(restored.cells[0]?.workingProvenance).toBe('measured-recommendation');
  });

  it('treats the displayed whole-millisecond recommendation as a revert', () => {
    const base = buildVeDelayTable([event(100.2), event(120.4), event(140.6)], [1000], [50], {
      minimumMeasuredEvents: 3,
      adaptiveGeometry: false,
    });
    const recommended = base.cells[0]?.recommendedMs;
    expect(recommended).toBeDefined();
    const restored = setVeDelayWorkingCell(base, 0, 0, Math.round(recommended!));
    expect(restored.cells[0]?.workingMs).toBe(recommended);
    expect(restored.cells[0]?.workingProvenance).toBe('measured-recommendation');
  });

  it('keeps reviewed recommendation edits when promoted to working authority', () => {
    const base = buildVeDelayTable([event(100), event(120), event(140)], [1000], [50], {
      minimumMeasuredEvents: 3,
      adaptiveGeometry: false,
    });
    const reviewed = setVeDelayWorkingCell(base, 0, 0, 165);
    const active = activateVeDelayRecommendation(reviewed);

    expect(active.cells[0]?.recommendedMs).toBe(120);
    expect(active.cells[0]?.workingMs).toBe(165);
    expect(active.cells[0]?.workingProvenance).toBe('user-edited');
  });
});
