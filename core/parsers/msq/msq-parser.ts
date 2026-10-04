export interface MsqRawVariable {
  readonly kind: 'constant' | 'pcVariable';
  readonly name: string;
  readonly pageNumber: number | undefined;
  readonly rows: number | undefined;
  readonly cols: number | undefined;
  readonly digits: number | undefined;
  readonly units: string | undefined;
  readonly rawText: string;
  readonly tokens: readonly string[];
  readonly numericValues: readonly number[] | undefined;
}

export interface ParsedMsqDocument {
  readonly fileFormat: string | undefined;
  readonly firmwareInfo: string | undefined;
  readonly signature: string | undefined;
  readonly writeDate: string | undefined;
  readonly author: string | undefined;
  readonly variables: readonly MsqRawVariable[];
}

function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function attributes(source: string): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  const pattern = /([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const name = match[1];
    const value = match[2] ?? match[3];
    if (name && value !== undefined) result[name] = decodeXml(value);
  }
  return result;
}

function optionalInteger(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function tokenizeValue(rawText: string): readonly string[] {
  const trimmed = decodeXml(rawText).trim();
  if (!trimmed) return [];
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return [trimmed.slice(1, -1)];
  }
  return trimmed.split(/\s+/).filter(Boolean);
}

function numericTokens(tokens: readonly string[]): readonly number[] | undefined {
  if (tokens.length === 0) return [];
  const values = tokens.map((token) => Number(token));
  return values.every(Number.isFinite) ? values : undefined;
}

export function parseMsq(source: string): ParsedMsqDocument {
  if (typeof source !== 'string' || !/<msq\b/i.test(source)) {
    throw new Error('MSQ parser expected an <msq> XML document.');
  }

  const cleaned = source.replace(/<!--([\s\S]*?)-->/g, '');
  const versionMatch = /<versionInfo\b([^>]*?)(?:\/?>)/i.exec(cleaned);
  const bibliographyMatch = /<bibliography\b([^>]*?)(?:\/?>)/i.exec(cleaned);
  const version = attributes(versionMatch?.[1] ?? '');
  const bibliography = attributes(bibliographyMatch?.[1] ?? '');
  const variables: MsqRawVariable[] = [];

  const pagePattern = /<page\b([^>]*)>([\s\S]*?)<\/page>/gi;
  let pageMatch: RegExpExecArray | null;
  while ((pageMatch = pagePattern.exec(cleaned)) !== null) {
    const pageAttrs = attributes(pageMatch[1] ?? '');
    const pageNumber = optionalInteger(pageAttrs.number);
    const body = pageMatch[2] ?? '';
    const variablePattern = /<(constant|pcVariable)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
    let variableMatch: RegExpExecArray | null;
    while ((variableMatch = variablePattern.exec(body)) !== null) {
      const kind = variableMatch[1] as 'constant' | 'pcVariable';
      const attrs = attributes(variableMatch[2] ?? '');
      const name = attrs.name?.trim();
      if (!name) continue;
      const rawText = decodeXml(variableMatch[3] ?? '').trim();
      const tokens = tokenizeValue(rawText);
      variables.push({
        kind,
        name,
        pageNumber,
        rows: optionalInteger(attrs.rows),
        cols: optionalInteger(attrs.cols),
        digits: optionalInteger(attrs.digits),
        units: attrs.units?.trim() || undefined,
        rawText,
        tokens,
        numericValues: numericTokens(tokens),
      });
    }
  }

  return {
    fileFormat: version.fileFormat,
    firmwareInfo: version.firmwareInfo,
    signature: version.signature,
    writeDate: bibliography.writeDate,
    author: bibliography.author,
    variables,
  };
}
