import { splitCommaFields, stripInlineComment } from './ini-channel-parser';
import type { TuneEntry, TuneModel } from '../../tune/tune-model';
import type { VeMsqStoragePolicy } from '../../tune/ve-msq-write';

const integerTypes: Readonly<Record<string, readonly [number, number]>> = {
  U08: [0, 255], S08: [-128, 127], U16: [0, 65535], S16: [-32768, 32767], U32: [0, 4294967295], S32: [-2147483648, 2147483647],
};
const literal = (text: string | undefined): number => text && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text) ? Number(text) : NaN;

export interface IniMsqWriteCatalog {
  readonly signatures: readonly string[];
  readonly definitions: Readonly<Record<string, readonly (readonly string[])[]>>;
  readonly issue: string | undefined;
}

/** Parse once at INI acceptance; retain only signature and array-related definitions. */
export function parseIniMsqWriteCatalog(source: string): IniMsqWriteCatalog {
  if (source.length > 16 * 1024 * 1024) return { signatures: [], definitions: {}, issue: 'INI exceeds the supported write-policy size.' };
  let section = '', issue: string | undefined;
  const signatures: string[] = [], assignments: [string, string[]][] = [];
  const arrayNames = new Set<string>();
  for (const raw of source.split(/\r?\n/)) {
    const line = stripInlineComment(raw).trim(), header = /^\[([^\]]+)\]$/.exec(line);
    if (header) { section = header[1]!.toLowerCase(); continue; }
    const assignment = /^([\w.-]+)\s*=\s*(.*)$/.exec(line); if (!assignment) continue;
    if ((section === 'megatune' || section === 'tunerstudio') && assignment[1] === 'signature') {
      const value = /^"([^"]+)"$/.exec(assignment[2]!);
      if (value) signatures.push(value[1]!); else issue = 'INI signature is not a supported literal.';
    }
    if (section !== 'constants') continue;
    const fields = splitCommaFields(assignment[2]!); assignments.push([assignment[1]!,fields]);
    if (fields[0] === 'array') arrayNames.add(assignment[1]!);
  }
  const definitions: Record<string, (readonly string[])[]> = Object.create(null) as Record<string, (readonly string[])[]>;
  for (const [name,fields] of assignments) if (arrayNames.has(name)) (definitions[name] ??= []).push(Object.freeze(fields));
  return Object.freeze({ signatures: Object.freeze(signatures), definitions: Object.freeze(definitions), issue });
}

/** Conditional alternatives must agree; never guess preprocessor branches. */
export function resolveVeMsqStoragePolicy(source: string | IniMsqWriteCatalog, tuneModel: TuneModel, entry: TuneEntry): VeMsqStoragePolicy {
  if (!tuneModel.identity.signature || entry.sourceKind !== 'constant' || entry.kind !== 'table') throw new Error('A signed tune and a numeric constant table are required for MSQ writing.');
  const catalog = typeof source === 'string' ? parseIniMsqWriteCatalog(source) : source;
  if (catalog.issue) throw new Error(catalog.issue);
  if (!catalog.signatures.length || catalog.signatures.some(s => s !== tuneModel.identity.signature)) throw new Error('INI firmware signature does not match the accepted MSQ.');
  let policy: VeMsqStoragePolicy | undefined;
  const alternatives: string[] = [];
  for (const fields of catalog.definitions[entry.name] ?? []) {
    const shape = /^\[(\d+)x(\d+)\]$/i.exec(fields[3] ?? ''), range = integerTypes[fields[1] ?? ''];
    const scale = literal(fields[5]), translate = literal(fields[6]), minimum = literal(fields[7]), maximum = literal(fields[8]);
    if (fields[0] !== 'array' || !range || !shape || Number(shape[1]) !== entry.cols || Number(shape[2]) !== entry.rows
      || fields[4] !== JSON.stringify(entry.units ?? '') || !(scale > 0) || !Number.isFinite(scale) || translate !== 0
      || !Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum > maximum) throw new Error(`Unsupported or mismatched INI storage definition for ${entry.name}.`);
    alternatives.push(JSON.stringify([fields[1],fields[2],fields[3],fields[4],scale,translate,minimum,maximum]));
    policy = { tuneModel, entry, scale, minimum, maximum, rawMinimum: range[0], rawMaximum: range[1] };
  }
  if (!policy) throw new Error(`No supported INI storage definition for ${entry.name}.`);
  if (new Set(alternatives).size !== 1) throw new Error(`Conditional INI storage definitions disagree for ${entry.name}.`);
  return Object.freeze(policy);
}
