import { parseMlg, type ParsedMlgLog } from '../../../../core/parsers/mlg/mlg-parser';
import { BlobByteSource, type BlobByteSourceStats } from './blob-byte-source';

export interface ImportedMlgFile extends ParsedMlgLog {
  readonly sourceStats: BlobByteSourceStats;
  readonly importTotalMs: number;
}

export async function importMlgFile(file: File): Promise<ImportedMlgFile> {
  const now = (): number => globalThis.performance?.now() ?? Date.now();
  const started = now();
  const source = new BlobByteSource(file);
  const parsed = await parseMlg(source, {
    id: `file:${file.name}:${file.size}:${file.lastModified}`,
    displayName: file.name,
    format: 'MLG',
    sizeBytes: file.size,
  });
  return {
    ...parsed,
    sourceStats: source.stats(),
    importTotalMs: now() - started,
  };
}
