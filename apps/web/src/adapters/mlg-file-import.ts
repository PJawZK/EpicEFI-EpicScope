import { parseMlg, type ParsedMlgLog } from '../../../../core/parsers/mlg/mlg-parser';
import { BlobByteSource } from './blob-byte-source';

export async function importMlgFile(file: File): Promise<ParsedMlgLog> {
  const source = new BlobByteSource(file);
  return parseMlg(source, {
    id: `file:${file.name}:${file.size}:${file.lastModified}`,
    displayName: file.name,
    format: 'MLG',
    sizeBytes: file.size,
  });
}
