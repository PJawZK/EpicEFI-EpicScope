import {
  buildIniChannelCatalog,
  type ChannelCatalog,
} from '../../../../core/channels/channel-catalog';
import { parseIniChannelSections } from '../../../../core/parsers/ini/ini-channel-parser';
import {
  parseIniTableEditorDefinitions,
  type IniTableEditorDefinition,
} from '../../../../core/parsers/ini/ini-table-editor-parser';
import type {
  IniChannelParseResult,
  IniParserDiagnostic,
} from '../../../../core/parsers/ini/ini-types';
import { saveIniTableEditorDefinitions } from '../state/ini-table-editor-storage';

export interface IniImportPerformance {
  readonly fileSizeBytes: number;
  readonly totalMs: number;
  readonly textReadMs: number;
  readonly parseMs: number;
  readonly catalogBuildMs: number;
  readonly lineCount: number;
  readonly outputChannelCount: number;
  readonly datalogEntryCount: number;
  readonly catalogEntryCount: number;
  readonly scalarCount: number;
  readonly bitCount: number;
  readonly expressionCount: number;
  readonly datalogOnlyCount: number;
  readonly outputOnlyCount: number;
  readonly diagnosticCount: number;
}

export interface ImportedIniFile {
  readonly fileName: string;
  readonly parsed: IniChannelParseResult;
  readonly catalog: ChannelCatalog;
  readonly tableDefinitions: readonly IniTableEditorDefinition[];
  readonly diagnostics: readonly IniParserDiagnostic[];
  readonly performance: IniImportPerformance;
}

export async function importIniFile(file: File): Promise<ImportedIniFile> {
  const now = (): number => globalThis.performance?.now() ?? Date.now();
  const totalStart = now();

  const textStart = now();
  const text = await file.text();
  const textReadMs = now() - textStart;

  const parseStart = now();
  const parsed = parseIniChannelSections(text);
  const tableDefinitions = parseIniTableEditorDefinitions(text);
  const parseMs = now() - parseStart;

  const catalogStart = now();
  const catalog = buildIniChannelCatalog(parsed);
  const catalogBuildMs = now() - catalogStart;
  saveIniTableEditorDefinitions(tableDefinitions);

  const outputKeys = new Set(parsed.outputChannels.map((channel) => channel.key));
  const datalogKeys = new Set(parsed.datalogEntries.map((entry) => entry.channelKey));

  let scalarCount = 0;
  let bitCount = 0;
  let expressionCount = 0;
  for (const channel of parsed.outputChannels) {
    if (channel.kind === 'scalar') scalarCount += 1;
    else if (channel.kind === 'bits') bitCount += 1;
    else expressionCount += 1;
  }

  let datalogOnlyCount = 0;
  for (const key of datalogKeys) if (!outputKeys.has(key)) datalogOnlyCount += 1;

  let outputOnlyCount = 0;
  for (const key of outputKeys) if (!datalogKeys.has(key)) outputOnlyCount += 1;

  return {
    fileName: file.name,
    parsed,
    catalog,
    tableDefinitions,
    diagnostics: parsed.diagnostics,
    performance: {
      fileSizeBytes: file.size,
      totalMs: now() - totalStart,
      textReadMs,
      parseMs,
      catalogBuildMs,
      lineCount: text.length === 0 ? 0 : text.split(/\r?\n/).length,
      outputChannelCount: parsed.outputChannels.length,
      datalogEntryCount: parsed.datalogEntries.length,
      catalogEntryCount: catalog.entries.length,
      scalarCount,
      bitCount,
      expressionCount,
      datalogOnlyCount,
      outputOnlyCount,
      diagnosticCount: parsed.diagnostics.length,
    },
  };
}
