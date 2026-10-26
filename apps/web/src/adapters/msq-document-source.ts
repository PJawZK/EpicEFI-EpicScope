/** Keep the exact source bytes: decoded analytical text is not a round-trip writer. */
export interface DecodedMsqSource {
  readonly bytes: Uint8Array;
  readonly text: string;
  readonly encoding: 'utf-8' | 'iso-8859-1';
  readonly declaredEncoding: string | undefined;
  readonly utf8Bom: boolean;
}

export function decodeMsqSource(buffer: ArrayBuffer): DecodedMsqSource {
  const bytes = new Uint8Array(buffer);
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)
    || (bytes[0] === 0 && bytes[1] === 0x3c) || (bytes[0] === 0x3c && bytes[1] === 0)) {
    throw new Error('UTF-16 MSQ files are not supported. Use a UTF-8 or ISO-8859-1 MSQ.');
  }
  const utf8Bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const offset = utf8Bom ? 3 : 0;
  // XML encoding names and the declaration are ASCII; no lossy whole-file decode.
  let prefix = '';
  for (let index = offset; index < Math.min(bytes.length, offset + 1024); index++) prefix += String.fromCharCode(bytes[index]!);
  const declaration = /^<\?xml\s+([\s\S]*?)\?>/i.exec(prefix);
  if (prefix.startsWith('<?xml ') && !declaration) throw new Error('MSQ XML declaration is incomplete or exceeds 1024 bytes.');
  const declaredEncoding = /\bencoding\s*=\s*["']([^"']+)["']/i.exec(declaration?.[1] ?? '')?.[1];
  const label = declaredEncoding?.trim().toLowerCase();
  const encoding = !label || label === 'utf-8' || label === 'utf8' ? 'utf-8'
    : label === 'iso-8859-1' || label === 'iso_8859-1' || label === 'latin1' ? 'iso-8859-1' : undefined;
  if (!encoding) throw new Error(`Unsupported MSQ encoding: ${declaredEncoding}. Use UTF-8 or ISO-8859-1.`);
  if (utf8Bom && encoding !== 'utf-8') throw new Error('MSQ encoding declaration conflicts with its UTF-8 byte-order mark.');
  let text: string;
  if (encoding === 'utf-8') {
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new Error('MSQ contains invalid UTF-8 bytes. Check its XML encoding declaration.'); }
  } else {
    // WHATWG TextDecoder("iso-8859-1") maps to Windows-1252, not true Latin-1.
    // Decode actual ISO bytes explicitly, with bounded chunks and no array spread.
    const chunks: string[] = [];
    for (let start = 0; start < bytes.length; start += 8192) {
      let chunk = '';
      for (let index = start; index < Math.min(bytes.length, start + 8192); index++) chunk += String.fromCharCode(bytes[index]!);
      chunks.push(chunk);
    }
    text = chunks.join('');
  }
  return { bytes, text, encoding, declaredEncoding, utf8Bom };
}
