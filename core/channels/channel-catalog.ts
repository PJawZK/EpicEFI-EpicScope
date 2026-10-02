import type { ChannelValueType } from '../log-model/log-types';
import type {
  IniChannelParseResult,
  IniDatalogEntry,
  IniOutputChannelDefinition,
} from '../parsers/ini/ini-types';

export type ChannelCatalogAvailability =
  | 'known-no-data'
  | 'known-with-data'
  | 'log-only';

export interface ChannelCatalogEntry {
  /** Stable logical identity from the INI output-channel key. */
  readonly logicalKey: string;
  readonly sourceName: string;
  readonly displayName: string;
  readonly valueType: ChannelValueType;
  readonly unit?: string;
  readonly precision?: number;
  readonly availability: ChannelCatalogAvailability;
  readonly provenance: {
    readonly kind: 'ini';
    readonly outputLineNumber?: number;
    readonly datalogLineNumber?: number;
  };
  readonly iniDefinitionKind?: IniOutputChannelDefinition['kind'];
  readonly iniDataType?: string;
  readonly iniByteOffset?: number;
  readonly iniScale?: number;
  readonly iniTranslate?: number;
  readonly datalogValueType?: string;
  readonly datalogFormat?: string;
}

export interface ChannelCatalog {
  readonly entries: readonly ChannelCatalogEntry[];
  readonly byLogicalKey: ReadonlyMap<string, ChannelCatalogEntry>;
}

function normalizedValueType(
  definition: IniOutputChannelDefinition | undefined,
  datalog: IniDatalogEntry | undefined,
): ChannelValueType {
  if (definition?.kind === 'bits') return 'bitfield';

  const datalogType = datalog?.valueType.toLowerCase();
  if (datalogType === 'int' || datalogType === 'integer') return 'integer';

  const dataType = definition?.dataType?.toUpperCase();
  if (dataType && !dataType.startsWith('F')) return 'integer';

  return 'number';
}

export function buildIniChannelCatalog(parsed: IniChannelParseResult): ChannelCatalog {
  const definitions = new Map(parsed.outputChannels.map((item) => [item.key, item] as const));
  const datalog = new Map(parsed.datalogEntries.map((item) => [item.channelKey, item] as const));

  // Datalog is the user-facing logged-channel list. Include output definitions
  // that are not explicitly logged too, because they remain useful stable
  // channel identities for future source binding and live/tune-aware contexts.
  const keys = new Set<string>([
    ...definitions.keys(),
    ...datalog.keys(),
  ]);

  const entries: ChannelCatalogEntry[] = [];
  for (const logicalKey of keys) {
    const definition = definitions.get(logicalKey);
    const logEntry = datalog.get(logicalKey);
    const unit = definition?.unit?.trim();
    const displayName = logEntry?.label.trim() || logicalKey;

    entries.push({
      logicalKey,
      sourceName: logicalKey,
      displayName,
      valueType: normalizedValueType(definition, logEntry),
      ...(unit ? { unit } : {}),
      ...(logEntry?.precision !== undefined ? { precision: logEntry.precision } : {}),
      availability: 'known-no-data',
      provenance: {
        kind: 'ini',
        ...(definition ? { outputLineNumber: definition.lineNumber } : {}),
        ...(logEntry ? { datalogLineNumber: logEntry.lineNumber } : {}),
      },
      ...(definition ? { iniDefinitionKind: definition.kind } : {}),
      ...(definition?.dataType ? { iniDataType: definition.dataType } : {}),
      ...(definition?.byteOffset !== undefined ? { iniByteOffset: definition.byteOffset } : {}),
      ...(definition?.scale !== undefined ? { iniScale: definition.scale } : {}),
      ...(definition?.translate !== undefined ? { iniTranslate: definition.translate } : {}),
      ...(logEntry ? { datalogValueType: logEntry.valueType, datalogFormat: logEntry.format } : {}),
    });
  }

  // Preserve deterministic source order here. Presentation layers already
  // perform their own sorting/filtering, so locale-aware sorting in core is
  // redundant and unnecessarily expensive for large INI catalogs.
  return {
    entries,
    byLogicalKey: new Map(entries.map((entry) => [entry.logicalKey, entry] as const)),
  };
}
