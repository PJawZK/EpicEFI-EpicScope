import type { ParsedMsqDocument, MsqRawVariable } from '../parsers/msq/msq-parser';

export type TuneEntryKind = 'scalar' | 'vector' | 'table' | 'text';

export interface TuneEntry {
  readonly name: string;
  readonly kind: TuneEntryKind;
  readonly sourceKind: MsqRawVariable['kind'];
  readonly pageNumber: number | undefined;
  readonly rows: number;
  readonly cols: number;
  readonly digits: number | undefined;
  readonly units: string | undefined;
  readonly numericValues: readonly number[] | undefined;
  readonly textValue: string | undefined;
}

export interface TuneModel {
  readonly identity: {
    readonly fileFormat: string | undefined;
    readonly firmwareInfo: string | undefined;
    readonly signature: string | undefined;
    readonly writeDate: string | undefined;
    readonly author: string | undefined;
  };
  readonly entries: readonly TuneEntry[];
  readonly byName: ReadonlyMap<string, TuneEntry>;
}

function dimensions(variable: MsqRawVariable): { rows: number; cols: number } {
  const rows = Math.max(1, variable.rows ?? 1);
  const cols = Math.max(1, variable.cols ?? 1);
  return { rows, cols };
}

function classify(variable: MsqRawVariable, rows: number, cols: number): TuneEntryKind {
  if (variable.numericValues === undefined) return 'text';
  if (rows > 1 && cols > 1) return 'table';
  if (rows > 1 || cols > 1 || variable.numericValues.length > 1) return 'vector';
  return 'scalar';
}

export function normalizeMsqTune(document: ParsedMsqDocument): TuneModel {
  const entries: TuneEntry[] = document.variables.map((variable) => {
    const { rows, cols } = dimensions(variable);
    const kind = classify(variable, rows, cols);
    return {
      name: variable.name,
      kind,
      sourceKind: variable.kind,
      pageNumber: variable.pageNumber,
      rows,
      cols,
      digits: variable.digits,
      units: variable.units,
      numericValues: variable.numericValues,
      textValue: variable.numericValues === undefined ? variable.tokens.join(' ') : undefined,
    };
  });

  const byName = new Map<string, TuneEntry>();
  for (const entry of entries) byName.set(entry.name, entry);

  return {
    identity: {
      fileFormat: document.fileFormat,
      firmwareInfo: document.firmwareInfo,
      signature: document.signature,
      writeDate: document.writeDate,
      author: document.author,
    },
    entries,
    byName,
  };
}

export function numericTuneEntry(model: TuneModel, name: string): TuneEntry | undefined {
  const entry = model.byName.get(name);
  return entry?.numericValues === undefined ? undefined : entry;
}
