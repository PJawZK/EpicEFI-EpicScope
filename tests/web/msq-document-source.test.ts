import { describe, expect, it } from 'vitest';
import { decodeMsqSource } from '../../apps/web/src/adapters/msq-document-source';
const utf8 = (text: string) => new TextEncoder().encode(text).buffer;
const latin1 = (text: string) => Uint8Array.from(text, char => char.charCodeAt(0)).buffer;
describe('retained MSQ source decoding', () => {
  it('retains every original Latin-1 byte, including values Windows-1252 would remap', () => {
    const text = '<?xml version="1.0" encoding="ISO-8859-1"?><msq><!-- åäö ° µ -->\u0080\u0091</msq>';
    const buffer = latin1(text), result = decodeMsqSource(buffer);
    expect(result.text).toBe(text); expect(result.encoding).toBe('iso-8859-1');
    expect(result.bytes.buffer).toBe(buffer); expect(result.utf8Bom).toBe(false);
  });
  it('preserves UTF-8 Unicode and separately retains a BOM', () => {
    const text = '<?xml version="1.0" encoding="UTF-8"?><msq>å漢😀</msq>';
    const plain = new TextEncoder().encode(text), bytes = new Uint8Array(plain.length + 3);
    bytes.set([0xef, 0xbb, 0xbf]); bytes.set(plain, 3);
    const result = decodeMsqSource(bytes.buffer);
    expect(result.text).toBe(text); expect(result.utf8Bom).toBe(true); expect(result.bytes).toEqual(bytes);
  });
  it('defaults to strict UTF-8 when no encoding is declared', () => {
    expect(decodeMsqSource(utf8('<msq>å</msq>')).text).toBe('<msq>å</msq>');
    expect(() => decodeMsqSource(latin1('<msq>å</msq>'))).toThrow('invalid UTF-8');
  });
  it.each(['windows-1252', 'UTF-32', 'shift_jis'])('rejects unsupported %s rather than altering characters', encoding => {
    expect(() => decodeMsqSource(utf8(`<?xml version="1.0" encoding="${encoding}"?><msq/>`))).toThrow('Unsupported MSQ encoding');
  });
  it('rejects conflicting BOM/declaration and UTF-16 explicitly', () => {
    const text = new TextEncoder().encode('<?xml version="1.0" encoding="ISO-8859-1"?><msq/>');
    const bytes = new Uint8Array(text.length + 3); bytes.set([0xef,0xbb,0xbf]); bytes.set(text,3);
    expect(() => decodeMsqSource(bytes.buffer)).toThrow('conflicts');
    expect(() => decodeMsqSource(Uint8Array.from([0xff,0xfe,0x3c,0]).buffer)).toThrow('UTF-16');
  });
  it('decodes a document-sized Latin-1 source without unbounded spreads or truncation', () => {
    const text = '<?xml version="1.0" encoding="ISO-8859-1"?><msq><!--' + 'åäö'.repeat(350000) + '--></msq>';
    expect(decodeMsqSource(latin1(text)).text).toBe(text);
  });
});
