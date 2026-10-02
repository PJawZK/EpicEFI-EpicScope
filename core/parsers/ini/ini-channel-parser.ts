import type {
  IniChannelParseOptions,
  IniChannelParseResult,
  IniDatalogEntry,
  IniOutputChannelDefinition,
  IniParserDiagnostic,
} from './ini-types';

const DEFAULT_MAX_TEXT_LENGTH = 16 * 1024 * 1024;
const DEFAULT_MAX_LINES = 250_000;
const DEFAULT_MAX_ENTRIES_PER_SECTION = 25_000;
const DEFAULT_MAX_LINE_LENGTH = 128 * 1024;

function stripInlineComment(line: string): string {
  let quote: '"' | "'" | undefined;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if ((char === '"' || char === "'") && line[index - 1] !== '\\') {
      if (quote === char) quote = undefined;
      else if (!quote) quote = char;
      continue;
    }
    if (char === ';' && !quote) return line.slice(0, index);
  }
  return line;
}

function splitCommaFields(value: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quote: '"' | "'" | undefined;
  let depth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? '';
    if ((char === '"' || char === "'") && value[index - 1] !== '\\') {
      if (quote === char) quote = undefined;
      else if (!quote) quote = char;
      current += char;
      continue;
    }

    if (!quote) {
      if (char === '[' || char === '(' || char === '{') depth += 1;
      else if (char === ']' || char === ')' || char === '}') depth = Math.max(0, depth - 1);
      else if (char === ',' && depth === 0) {
        fields.push(current.trim());
        current = '';
        continue;
      }
    }
    current += char;
  }

  fields.push(current.trim());
  return fields;
}

function unquote(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function finiteNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatPrecision(format: string): number | undefined {
  const match = format.match(/%[^%]*?\.(\d+)[a-zA-Z]/);
  if (!match?.[1]) return undefined;
  const precision = Number(match[1]);
  return Number.isSafeInteger(precision) && precision >= 0 && precision <= 12
    ? precision
    : undefined;
}

function parseOutputDefinition(
  key: string,
  value: string,
  lineNumber: number,
): IniOutputChannelDefinition | undefined {
  const trimmed = value.trim();

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return {
      key,
      kind: 'expression',
      lineNumber,
      rawDefinition: trimmed,
      expression: trimmed.slice(1, -1).trim(),
    };
  }

  const fields = splitCommaFields(trimmed);
  const kind = fields[0]?.toLowerCase();
  if (kind === 'scalar') {
    const byteOffset = finiteNumber(fields[2]);
    const unit = unquote(fields[3]);
    const scale = finiteNumber(fields[4]);
    const translate = finiteNumber(fields[5]);
    return {
      key,
      kind: 'scalar',
      lineNumber,
      rawDefinition: trimmed,
      ...(fields[1] ? { dataType: fields[1] } : {}),
      ...(byteOffset !== undefined ? { byteOffset } : {}),
      ...(unit !== undefined ? { unit } : {}),
      ...(scale !== undefined ? { scale } : {}),
      ...(translate !== undefined ? { translate } : {}),
    };
  }

  if (kind === 'bits') {
    const byteOffset = finiteNumber(fields[2]);
    return {
      key,
      kind: 'bits',
      lineNumber,
      rawDefinition: trimmed,
      ...(fields[1] ? { dataType: fields[1] } : {}),
      ...(byteOffset !== undefined ? { byteOffset } : {}),
      ...(fields[3] ? { bitRange: fields[3] } : {}),
    };
  }

  return undefined;
}

function parseDatalogEntry(
  value: string,
  lineNumber: number,
): IniDatalogEntry | undefined {
  const fields = splitCommaFields(value);
  const channelKey = fields[0]?.trim();
  const label = unquote(fields[1]);
  const valueType = fields[2]?.trim();
  const format = unquote(fields[3]);

  if (!channelKey || !label || !valueType || !format) return undefined;

  const precision = formatPrecision(format);
  return {
    channelKey,
    label,
    valueType,
    format,
    ...(precision !== undefined ? { precision } : {}),
    lineNumber,
  };
}

export function parseIniChannelSections(
  text: string,
  options: IniChannelParseOptions = {},
): IniChannelParseResult {
  const maxTextLength = options.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH;
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  const maxEntriesPerSection = options.maxEntriesPerSection ?? DEFAULT_MAX_ENTRIES_PER_SECTION;
  const maxLineLength = options.maxLineLength ?? DEFAULT_MAX_LINE_LENGTH;

  if (text.length > maxTextLength) {
    throw new RangeError(
      `INI text exceeds the ${maxTextLength.toLocaleString()} character parser limit.`,
    );
  }

  const lines = text.split(/\r?\n/);
  if (lines.length > maxLines) {
    throw new RangeError(
      `INI contains ${lines.length.toLocaleString()} lines; limit is ${maxLines.toLocaleString()}.`,
    );
  }

  const outputChannels: IniOutputChannelDefinition[] = [];
  const datalogEntries: IniDatalogEntry[] = [];
  const diagnostics: IniParserDiagnostic[] = [];
  let section = '';

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const lineNumber = lineIndex + 1;
    const sourceLine = lines[lineIndex] ?? '';

    if (sourceLine.length > maxLineLength) {
      diagnostics.push({
        code: 'ini-line-too-long',
        severity: 'warning',
        message: `Skipped line longer than ${maxLineLength.toLocaleString()} characters.`,
        lineNumber,
      });
      continue;
    }

    const line = stripInlineComment(sourceLine).trim();
    if (!line || line.startsWith('#')) continue;

    const sectionMatch = line.match(/^\[([^\]]+)\]\s*$/);
    if (sectionMatch?.[1]) {
      section = sectionMatch[1].trim().toLowerCase();
      continue;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex <= 0) continue;
    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim();

    if (section === 'outputchannels') {
      if (outputChannels.length >= maxEntriesPerSection) {
        throw new RangeError(
          `[OutputChannels] exceeds the ${maxEntriesPerSection.toLocaleString()} entry limit.`,
        );
      }
      const definition = parseOutputDefinition(key, value, lineNumber);
      if (definition) outputChannels.push(definition);
      continue;
    }

    if (section === 'datalog' && key.toLowerCase() === 'entry') {
      if (datalogEntries.length >= maxEntriesPerSection) {
        throw new RangeError(
          `[Datalog] exceeds the ${maxEntriesPerSection.toLocaleString()} entry limit.`,
        );
      }
      const entry = parseDatalogEntry(value, lineNumber);
      if (entry) {
        datalogEntries.push(entry);
      } else {
        diagnostics.push({
          code: 'ini-datalog-entry-unparsed',
          severity: 'warning',
          message: 'Could not parse Datalog entry; source text was preserved only in the INI file.',
          lineNumber,
        });
      }
    }
  }

  if (outputChannels.length === 0) {
    diagnostics.push({
      code: 'ini-output-channels-empty',
      severity: 'warning',
      message: 'No supported scalar, bits, or expression definitions were found in [OutputChannels].',
    });
  }
  if (datalogEntries.length === 0) {
    diagnostics.push({
      code: 'ini-datalog-empty',
      severity: 'warning',
      message: 'No supported entries were found in [Datalog].',
    });
  }

  return {
    outputChannels,
    datalogEntries,
    diagnostics,
  };
}
