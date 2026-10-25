import type { AcceptedMsqDocument } from './msq-document-loader';
import { decodeMsqSource } from './msq-document-source';
import { prepareMsqCandidate } from './msq-candidate';
import { resolveVeMsqStoragePolicy } from '../../../../core/parsers/ini/ini-msq-write-policy';
import { quantizeVeMsqValue, type VeMsqWriteSnapshot } from '../../../../core/tune/ve-msq-write';
import type { TuneEntry, TuneModel } from '../../../../core/tune/tune-model';

export interface VeMsqWritePlan {
  readonly document: AcceptedMsqDocument;
  readonly snapshot: VeMsqWriteSnapshot;
  readonly bytes: Uint8Array;
  readonly text: string;
  readonly values: readonly number[];
  readonly changedCells: number;
  readonly roundedCells: number;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
function encode(text: string, document: AcceptedMsqDocument): Uint8Array {
  if (document.encoding === 'iso-8859-1') {
    const bytes = new Uint8Array(text.length);
    for (let index = 0; index < text.length; index++) {
      const code = text.charCodeAt(index);
      if (code > 255) throw new Error('MSQ text cannot be represented in its original ISO-8859-1 encoding.');
      bytes[index] = code;
    }
    return bytes;
  }
  const body = new TextEncoder().encode(text);
  if (!document.utf8Bom) return body;
  const bytes = new Uint8Array(body.length + 3); bytes.set([0xef,0xbb,0xbf]); bytes.set(body,3); return bytes;
}
function sameEntry(a: TuneEntry, b: TuneEntry, values = a.numericValues): boolean {
  return a.name === b.name && a.sourceKind === b.sourceKind && a.pageNumber === b.pageNumber && a.kind === b.kind
    && a.rows === b.rows && a.cols === b.cols && a.units === b.units && a.digits === b.digits && a.textValue === b.textValue
    && (values === undefined ? b.numericValues === undefined : b.numericValues !== undefined && values.length === b.numericValues.length && values.every((value,index) => value === b.numericValues![index]));
}
function checkModel(expected: TuneModel, actual: TuneModel, target = -1, values?: readonly number[]): void {
  if (JSON.stringify(expected.identity) !== JSON.stringify(actual.identity) || expected.entries.length !== actual.entries.length
    || expected.entries.some((entry,index) => !sameEntry(entry, actual.entries[index]!, index === target ? values : entry.numericValues))) {
    throw new Error('MSQ validation failed: source identity or unrelated tune content changed.');
  }
}

/** Locate the DOM-selected element in original source, without serializing XML.
 * Quoted > characters, comments, CDATA and processing instructions cannot masquerade as tags.
 * DTDs are deliberately unsupported; no entity expansion or regex-only XML patching.
 */
function contentSpan(source: string, xml: Document, target: Element): readonly [number, number] {
  const elements = xml.getElementsByTagName('*'); let elementIndex = 0, cursor = 0;
  const stack: { node: Element; start: number }[] = [];
  while (cursor < source.length) {
    const start = source.indexOf('<', cursor); if (start < 0) break;
    if (source.startsWith('<!--',start) || source.startsWith('<![CDATA[',start) || source.startsWith('<?',start)) {
      const endMarker = source.startsWith('<!--',start) ? '-->' : source.startsWith('<?',start) ? '?>' : ']]>';
      const end = source.indexOf(endMarker,start + 2); if (end < 0) throw new Error('Unsupported MSQ markup.');
      cursor = end + endMarker.length; continue;
    }
    if (source.startsWith('<!', start)) throw new Error('MSQ documents with DTD/declaration markup cannot be patched.');
    let quote = '', end = start + 1;
    for (; end < source.length; end++) {
      const char = source[end]!;
      if (quote) { if (char === quote) quote = ''; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '>') break;
    }
    if (end === source.length) throw new Error('Unterminated MSQ tag.');
    const tag = source.slice(start + 1,end), closing = tag.startsWith('/');
    const name = /^\/?([^\s/>]+)/.exec(tag)?.[1];
    if (closing) {
      const open = stack.pop(); if (!open || open.node.tagName !== name) throw new Error('MSQ source and parsed structure disagree.');
      if (open.node === target) return [open.start,start];
    } else {
      const node = elements[elementIndex++];
      if (!node || node.tagName !== name) throw new Error('MSQ source and parsed structure disagree.');
      if (!/\/\s*$/.test(tag)) stack.push({ node, start: end + 1 });
    }
    cursor = end + 1;
  }
  throw new Error('Selected VE entry has no supported source content.');
}

/** Prepare and verify bytes only. No filesystem API, download, model mutation or save activation. */
export function prepareVeMsqWrite(document: AcceptedMsqDocument, snapshot: VeMsqWriteSnapshot, iniSource: string): VeMsqWritePlan {
  const { entry, tuneModel } = snapshot;
  if (tuneModel !== document.model || !tuneModel.entries.includes(entry) || snapshot.rows !== entry.rows || snapshot.cols !== entry.cols
    || entry.kind !== 'table' || !entry.numericValues || snapshot.values.length !== entry.rows * entry.cols
    || !tuneModel.entries.includes(snapshot.rpmAxis) || !tuneModel.entries.includes(snapshot.loadAxis)
    || snapshot.rpmAxis.numericValues?.length !== entry.cols || snapshot.loadAxis.numericValues?.length !== entry.rows) throw new Error('Working VE snapshot does not belong to this accepted tune/table geometry.');
  const decoded = decodeMsqSource(document.bytes.slice().buffer);
  if (decoded.text !== document.text || decoded.encoding !== document.encoding || decoded.utf8Bom !== document.utf8Bom
    || !sameBytes(encode(document.text,document),document.bytes)) throw new Error('Retained MSQ bytes/text/encoding disagree.');
  checkModel(tuneModel,prepareMsqCandidate(document.text));
  const policy = resolveVeMsqStoragePolicy(iniSource,tuneModel,entry);
  const xml = new DOMParser().parseFromString(document.text,'application/xml');
  if (xml.doctype) throw new Error('MSQ documents with DTDs cannot be patched.');
  const matches = [...xml.getElementsByTagName('*')].filter(node => node.localName === entry.sourceKind && node.getAttribute('name') === entry.name
    && node.parentElement?.localName === 'page'
    && (node.parentElement.hasAttribute('number') ? Number(node.parentElement.getAttribute('number')) : undefined) === entry.pageNumber);
  if (matches.length !== 1) throw new Error('Selected VE entry is missing or ambiguous in the source MSQ.');
  const [start,end] = contentSpan(document.text,xml,matches[0]!);
  const payload = document.text.slice(start,end);
  if (/[<&]/.test(payload)) throw new Error('VE numeric payload containing markup or entities is not supported for writing.');
  const tokens = [...payload.matchAll(/\S+/g)];
  if (tokens.length !== snapshot.values.length) throw new Error('VE payload token count does not match the working table.');
  const values: number[] = [], pieces: string[] = []; let previous = 0, changedCells = 0, roundedCells = 0;
  tokens.forEach((token,index) => {
    if (Number(token[0]) !== entry.numericValues![index]) throw new Error('VE source tokens disagree with the accepted tune.');
    const quantized = quantizeVeMsqValue(snapshot.values[index],policy);
    if (snapshot.values[index] === entry.numericValues![index] && quantized.value !== entry.numericValues![index]) throw new Error('An unchanged source VE cell disagrees with INI storage precision; resolve it before saving.');
    values.push(quantized.value);
    if (quantized.value !== snapshot.values[index]) roundedCells++;
    if (quantized.value === entry.numericValues![index]) return;
    pieces.push(payload.slice(previous,token.index),quantized.text); previous = token.index + token[0].length; changedCells++;
  });
  pieces.push(payload.slice(previous));
  const text = document.text.slice(0,start) + pieces.join('') + document.text.slice(end);
  const bytes = encode(text,document);
  const verified = decodeMsqSource(bytes.slice().buffer);
  if (verified.text !== text) throw new Error('MSQ output encoding verification failed.');
  checkModel(tuneModel,prepareMsqCandidate(verified.text),tuneModel.entries.indexOf(entry),values);
  return Object.freeze({ document, snapshot, bytes, text, values: Object.freeze(values), changedCells, roundedCells });
}
