import { describe, expect, it } from 'vitest';
import type { AfrDelayEvent } from '../../core/analysis/afr-delay-analyzer';
import { buildVeDelayTable, editVeDelayWorkingCell, revertVeDelayWorkingCell } from '../../core/analysis/ve-delay-table';
import { parseVeDelayTableFile, serializeVeDelayTable } from '../../core/analysis/ve-delay-table-storage';

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

describe('VE lambda delay table persistence', () => {
  it('round-trips measured evidence and source-event provenance', () => {
    const table = buildVeDelayTable([
      event(1000, 50, 100),
      event(1000, 50, 120),
      event(1000, 50, 140),
    ], [1000, 2000], [50, 100], { minimumMeasuredEvents: 3, originLabel: 'test-log.mlg' });

    const loaded = parseVeDelayTableFile(serializeVeDelayTable(table), 'saved-delay.json');
    expect(loaded.origin).toBe('saved-file');
    expect(loaded.originLabel).toBe('saved-delay.json');
    expect(loaded.cells[0]?.state).toBe('measured');
    expect(loaded.cells[0]?.workingMs).toBe(120);
    expect(loaded.cells[0]?.workingProvenance).toBe('measured-recommendation');
    expect(loaded.cells[0]?.sourceEvents).toHaveLength(3);
    expect(loaded.cells[0]?.sourceEvents[0]?.rpm).toBe(1000);
  });

  it('preserves user edits distinctly from measured/interpolated evidence', () => {
    const base = buildVeDelayTable([
      event(1000, 50, 100), event(1000, 50, 110), event(1000, 50, 120),
    ], [1000, 2000], [50, 100], { minimumMeasuredEvents: 3 });
    const edited = editVeDelayWorkingCell(base, 0, 0, 175);
    expect(edited.cells[0]?.state).toBe('measured');
    expect(edited.cells[0]?.recommendedMs).toBe(110);
    expect(edited.cells[0]?.workingMs).toBe(175);
    expect(edited.cells[0]?.workingProvenance).toBe('user-edited');

    const loaded = parseVeDelayTableFile(serializeVeDelayTable(edited));
    expect(loaded.cells[0]?.workingMs).toBe(175);
    expect(loaded.cells[0]?.workingProvenance).toBe('user-edited');

    const reverted = revertVeDelayWorkingCell(loaded, 0, 0);
    expect(reverted.cells[0]?.workingMs).toBe(110);
    expect(reverted.cells[0]?.workingProvenance).toBe('measured-recommendation');
  });

  it('allows a user working value in an otherwise insufficient cell and marks it user-edited', () => {
    const base = buildVeDelayTable([], [1000, 2000], [50, 100], { adaptiveGeometry: false });
    const edited = editVeDelayWorkingCell(base, 1, 1, 220);
    expect(edited.cells[3]?.state).toBe('insufficient');
    expect(edited.cells[3]?.recommendedMs).toBeUndefined();
    expect(edited.cells[3]?.workingMs).toBe(220);
    expect(edited.cells[3]?.workingProvenance).toBe('user-edited');
  });

  it('rejects foreign or malformed delay files', () => {
    expect(() => parseVeDelayTableFile('{"kind":"OtherThing","version":1}')).toThrow(/not an EpicScope lambda delay table/i);
    expect(() => parseVeDelayTableFile('not-json')).toThrow(/valid JSON/i);
  });
});
