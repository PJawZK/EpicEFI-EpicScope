import { splitCommaFields, stripInlineComment } from './ini-channel-parser';
import type { TuneEntry, TuneModel } from '../../tune/tune-model';
import type { VeMsqStoragePolicy } from '../../tune/ve-msq-write';

const integerTypes: Readonly<Record<string, readonly [number, number]>> = {
  U08: [0, 255], S08: [-128, 127], U16: [0, 65535], S16: [-32768, 32767], U32: [0, 4294967295], S32: [-2147483648, 2147483647],
};
const literal = (text: string | undefined): number => text && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text) ? Number(text) : NaN;

/** Conservative resolver: conditional alternatives must agree on all storage fields.
 * This is not a new INI preprocessor. Display-digit-only alternatives are harmless.
 */
export function resolveVeMsqStoragePolicy(source: string, tuneModel: TuneModel, entry: TuneEntry): VeMsqStoragePolicy {
  if (source.length > 16 * 1024 * 1024) throw new Error('INI exceeds the supported write-policy size.');
  if (!tuneModel.identity.signature || entry.sourceKind !== 'constant' || entry.kind !== 'table') throw new Error('A signed tune and a numeric constant table are required for MSQ writing.');
  let section = '';
  const signatures: string[] = [], alternatives: string[] = [];
  let policy: VeMsqStoragePolicy | undefined;
  for (const raw of source.split(/\r?\n/)) {
    const line = stripInlineComment(raw).trim();
    const header = /^\[([^\]]+)\]$/.exec(line);
    if (header) { section = header[1]!.toLowerCase(); continue; }
    const assignment = /^([\w.-]+)\s*=\s*(.*)$/.exec(line);
    if (!assignment) continue;
    if ((section === 'megatune' || section === 'tunerstudio') && assignment[1] === 'signature') {
      const value = /^"([^"]+)"$/.exec(assignment[2]!); if (!value) throw new Error('INI signature is not a supported literal.');
      signatures.push(value[1]!);
    }
    if (section !== 'constants' || assignment[1] !== entry.name) continue;
    const fields = splitCommaFields(assignment[2]!);
    const shape = /^\[(\d+)x(\d+)\]$/i.exec(fields[3] ?? '');
    const range = integerTypes[fields[1] ?? ''];
    const scale = literal(fields[5]), translate = literal(fields[6]), minimum = literal(fields[7]), maximum = literal(fields[8]);
    if (fields[0] !== 'array' || !range || !shape || Number(shape[1]) !== entry.cols || Number(shape[2]) !== entry.rows
      || fields[4] !== JSON.stringify(entry.units ?? '') || !(scale > 0) || !Number.isFinite(scale) || translate !== 0
      || !Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum > maximum) throw new Error(`Unsupported or mismatched INI storage definition for ${entry.name}.`);
    alternatives.push(JSON.stringify([fields[1],fields[2],fields[3],fields[4],scale,translate,minimum,maximum]));
    policy = { tuneModel, entry, scale, minimum, maximum, rawMinimum: range[0], rawMaximum: range[1] };
  }
  if (!signatures.length || signatures.some(signature => signature !== tuneModel.identity.signature)) throw new Error('INI firmware signature does not match the accepted MSQ.');
  if (!policy) throw new Error(`No supported INI storage definition for ${entry.name}.`);
  if (new Set(alternatives).size !== 1) throw new Error(`Conditional INI storage definitions disagree for ${entry.name}.`);
  return Object.freeze(policy);
}
