import { veAnalysisAxisIssue } from './ve-axis-validation';
import type {
  VeDelayConfidence,
  VeDelaySourceEvent,
  VeDelayTable,
  VeDelayTableCell,
  VeDelayCellState,
  VeDelayWorkingProvenance,
} from './ve-delay-table';

export const VE_DELAY_TABLE_FILE_KIND = 'EpicScopeLambdaDelayTable';
export const VE_DELAY_TABLE_FILE_VERSION = 1;

export interface SavedVeDelayTableFile {
  readonly kind: typeof VE_DELAY_TABLE_FILE_KIND;
  readonly version: typeof VE_DELAY_TABLE_FILE_VERSION;
  readonly savedAtIso: string;
  readonly sourceLabel?: string;
  readonly rpmBins: readonly number[];
  readonly loadBins: readonly number[];
  readonly rows: number;
  readonly cols: number;
  readonly cells: readonly {
    readonly row: number;
    readonly col: number;
    readonly state: VeDelayCellState;
    readonly recommendedMs?: number;
    readonly workingMs?: number;
    readonly workingProvenance?: VeDelayWorkingProvenance;
    readonly eventCount: number;
    readonly p10Ms?: number;
    readonly p90Ms?: number;
    readonly spreadMs?: number;
    readonly confidence: VeDelayConfidence;
    readonly sourceEvents: readonly VeDelaySourceEvent[];
  }[];
}

function finiteArray(values: unknown, label: string): number[] {
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error(`${label} must be a non-empty finite numeric array.`);
  }
  return [...values] as number[];
}

function optionalFinite(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be finite when present.`);
  return value;
}

function isState(value: unknown): value is VeDelayCellState {
  return value === 'measured' || value === 'interpolated' || value === 'insufficient';
}

function isConfidence(value: unknown): value is VeDelayConfidence {
  return value === 'none' || value === 'limited' || value === 'moderate' || value === 'strong';
}

function isWorkingProvenance(value: unknown): value is VeDelayWorkingProvenance {
  return value === 'measured-recommendation' || value === 'interpolated-recommendation' || value === 'user-edited';
}

function parseSourceEvents(value: unknown): VeDelaySourceEvent[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`sourceEvents[${index}] is invalid.`);
    const source = item as Record<string, unknown>;
    const commandTimeMs = optionalFinite(source.commandTimeMs, `sourceEvents[${index}].commandTimeMs`);
    const responseTimeMs = optionalFinite(source.responseTimeMs, `sourceEvents[${index}].responseTimeMs`);
    const onsetDelayMs = optionalFinite(source.onsetDelayMs, `sourceEvents[${index}].onsetDelayMs`);
    const commandDelta = optionalFinite(source.commandDelta, `sourceEvents[${index}].commandDelta`);
    const responseDeltaAfr = optionalFinite(source.responseDeltaAfr, `sourceEvents[${index}].responseDeltaAfr`);
    if (commandTimeMs === undefined || responseTimeMs === undefined || onsetDelayMs === undefined || commandDelta === undefined || responseDeltaAfr === undefined) {
      throw new Error(`sourceEvents[${index}] is missing required numeric fields.`);
    }
    return {
      commandTimeMs,
      responseTimeMs,
      onsetDelayMs,
      rpm: optionalFinite(source.rpm, `sourceEvents[${index}].rpm`),
      load: optionalFinite(source.load, `sourceEvents[${index}].load`),
      commandDelta,
      responseDeltaAfr,
    };
  });
}

export function serializeVeDelayTable(table: VeDelayTable, sourceLabel?: string): string {
  const payload: SavedVeDelayTableFile = {
    kind: VE_DELAY_TABLE_FILE_KIND,
    version: VE_DELAY_TABLE_FILE_VERSION,
    savedAtIso: new Date().toISOString(),
    ...(sourceLabel || table.originLabel ? { sourceLabel: sourceLabel ?? table.originLabel } : {}),
    rpmBins: [...table.rpmBins],
    loadBins: [...table.loadBins],
    rows: table.rows,
    cols: table.cols,
    cells: table.cells.map((cell) => ({
      row: cell.row,
      col: cell.col,
      state: cell.state,
      ...(cell.recommendedMs !== undefined ? { recommendedMs: cell.recommendedMs } : {}),
      ...(cell.workingMs !== undefined ? { workingMs: cell.workingMs } : {}),
      ...(cell.workingProvenance !== undefined ? { workingProvenance: cell.workingProvenance } : {}),
      eventCount: cell.eventCount,
      ...(cell.p10Ms !== undefined ? { p10Ms: cell.p10Ms } : {}),
      ...(cell.p90Ms !== undefined ? { p90Ms: cell.p90Ms } : {}),
      ...(cell.spreadMs !== undefined ? { spreadMs: cell.spreadMs } : {}),
      confidence: cell.confidence,
      sourceEvents: [...cell.sourceEvents],
    })),
  };
  return JSON.stringify(payload, null, 2);
}

export function parseVeDelayTableFile(text: string, fileLabel?: string): VeDelayTable {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Lambda delay table file is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Lambda delay table file is invalid.');
  const source = parsed as Record<string, unknown>;
  if (source.kind !== VE_DELAY_TABLE_FILE_KIND) throw new Error('File is not an EpicScope lambda delay table.');
  if (source.version !== VE_DELAY_TABLE_FILE_VERSION) throw new Error(`Unsupported lambda delay table version: ${String(source.version)}.`);

  const rpmBins = finiteArray(source.rpmBins, 'rpmBins');
  const loadBins = finiteArray(source.loadBins, 'loadBins');
  for (const [name, values] of [['rpmBins', rpmBins], ['loadBins', loadBins]] as const) {
    const issue = veAnalysisAxisIssue(values);
    if (issue) throw new Error(`${name}: ${issue}`);
  }
  const rows = source.rows;
  const cols = source.cols;
  if (typeof rows !== 'number' || typeof cols !== 'number' || !Number.isInteger(rows) || !Number.isInteger(cols) || rows !== loadBins.length || cols !== rpmBins.length) {
    throw new Error('Lambda delay table geometry does not match its axes.');
  }
  if (!Array.isArray(source.cells) || source.cells.length !== rows * cols) throw new Error('Lambda delay table cell count does not match its geometry.');

  const cells: VeDelayTableCell[] = source.cells.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`cells[${index}] is invalid.`);
    const cell = item as Record<string, unknown>;
    const row = cell.row;
    const col = cell.col;
    const eventCount = cell.eventCount;
    if (typeof row !== 'number' || typeof col !== 'number' || !Number.isInteger(row) || !Number.isInteger(col) || row !== Math.floor(index / cols) || col !== index % cols) throw new Error(`cells[${index}] has invalid coordinates.`);
    if (!isState(cell.state)) throw new Error(`cells[${index}].state is invalid.`);
    if (!isConfidence(cell.confidence)) throw new Error(`cells[${index}].confidence is invalid.`);
    if (typeof eventCount !== 'number' || !Number.isInteger(eventCount) || eventCount < 0) throw new Error(`cells[${index}].eventCount is invalid.`);
    if (cell.workingProvenance !== undefined && !isWorkingProvenance(cell.workingProvenance)) throw new Error(`cells[${index}].workingProvenance is invalid.`);
    const workingMs = optionalFinite(cell.workingMs, `cells[${index}].workingMs`);
    if (workingMs !== undefined && workingMs < 0) throw new Error(`cells[${index}].workingMs must be non-negative.`);
    return {
      row,
      col,
      state: cell.state,
      recommendedMs: optionalFinite(cell.recommendedMs, `cells[${index}].recommendedMs`),
      workingMs,
      workingProvenance: cell.workingProvenance,
      eventCount,
      p10Ms: optionalFinite(cell.p10Ms, `cells[${index}].p10Ms`),
      p90Ms: optionalFinite(cell.p90Ms, `cells[${index}].p90Ms`),
      spreadMs: optionalFinite(cell.spreadMs, `cells[${index}].spreadMs`),
      confidence: cell.confidence,
      sourceEvents: parseSourceEvents(cell.sourceEvents),
    };
  });

  const sourceLabel = typeof source.sourceLabel === 'string' && source.sourceLabel.trim() ? source.sourceLabel.trim() : undefined;
  const originLabel = fileLabel ?? sourceLabel;
  const base: VeDelayTable = {
    rpmBins,
    loadBins,
    rows,
    cols,
    cells,
    origin: 'saved-file',
  };
  return originLabel ? { ...base, originLabel } : base;
}
