import { isQuotedMsqValue, parseMsq } from '../../../../core/parsers/msq/msq-parser';
import { normalizeMsqTune, type TuneModel } from '../../../../core/tune/tune-model';

/** Prepare a local-file candidate without touching the active tune or analysis owners. */
export function prepareMsqCandidate(source: string): TuneModel {
  const xml = new DOMParser().parseFromString(source, 'application/xml');
  if (xml.querySelector('parsererror') || xml.documentElement.localName.toLowerCase() !== 'msq') {
    throw new Error('Choose a complete, well-formed MSQ XML file.');
  }
  for (const node of xml.querySelectorAll('page > constant, page > pcVariable')) {
    for (const key of ['rows', 'cols']) {
      const raw = node.getAttribute(key);
      if (raw !== null && (!raw.trim() || !Number.isSafeInteger(Number(raw)) || Number(raw) <= 0)) {
        throw new Error(`${node.getAttribute('name') ?? 'Tune entry'}: ${key} must be a positive integer.`);
      }
    }
  }
  const parsed = parseMsq(source);
  if (!parsed.variables.length) throw new Error('The MSQ contains no recognized tune entries.');
  for (const variable of parsed.variables) {
    for (const dimension of [variable.rows, variable.cols]) {
      if (dimension !== undefined && dimension <= 0) throw new Error(`${variable.name}: tune dimensions must be positive.`);
    }
    const dimensioned = variable.rows !== undefined || variable.cols !== undefined;
    const quoted = isQuotedMsqValue(variable.rawText);
    if (dimensioned && !quoted && variable.numericValues === undefined) {
      throw new Error(`${variable.name}: dimensioned numeric values must contain only finite numbers; quote text values explicitly.`);
    }
    if (variable.numericValues && dimensioned
      && variable.numericValues.length !== (variable.rows ?? 1) * (variable.cols ?? 1)) {
      throw new Error(`${variable.name}: numeric values do not match the declared tune dimensions.`);
    }
  }
  return normalizeMsqTune(parsed);
}
