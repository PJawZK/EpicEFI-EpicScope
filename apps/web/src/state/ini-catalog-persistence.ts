import type { ChannelCatalog, ChannelCatalogEntry } from '../../../../core/channels/channel-catalog';
import {
  parseVersionedArtifact,
  serializeVersionedArtifact,
  type VersionedArtifactEnvelope,
} from '../../../../core/persistence/versioned-artifact';

export const WEB_INI_CATALOG_SCHEMA = 'epicscope.web-ini-channel-catalog';
export const WEB_INI_CATALOG_VERSION = 1;
export const MAX_WEB_INI_CATALOG_ARTIFACT_LENGTH = 4_000_000;

export interface PersistedIniCatalogEntry {
  readonly logicalKey: string;
  readonly sourceName: string;
  readonly displayName: string;
  readonly valueType: 'number' | 'integer' | 'bitfield';
  readonly unit?: string;
  readonly precision?: number;
}

export interface PersistedIniCatalogPayload {
  readonly sourceName: string;
  readonly entries: readonly PersistedIniCatalogEntry[];
}

function isCatalogEntry(value: unknown): value is PersistedIniCatalogEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.logicalKey === 'string'
    && item.logicalKey.length > 0
    && item.logicalKey.length <= 512
    && typeof item.sourceName === 'string'
    && item.sourceName.length <= 512
    && typeof item.displayName === 'string'
    && item.displayName.length <= 1024
    && (item.valueType === 'number' || item.valueType === 'integer' || item.valueType === 'bitfield')
    && (item.unit === undefined || (typeof item.unit === 'string' && item.unit.length <= 256))
    && (
      item.precision === undefined
      || (Number.isInteger(item.precision) && (item.precision as number) >= 0 && (item.precision as number) <= 12)
    )
  );
}

function isCatalogPayload(value: unknown): value is PersistedIniCatalogPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.sourceName === 'string'
    && payload.sourceName.length <= 1024
    && Array.isArray(payload.entries)
    && payload.entries.length <= 25_000
    && payload.entries.every(isCatalogEntry)
  );
}

export function serializeIniCatalog(
  sourceName: string,
  catalog: ChannelCatalog,
): string {
  return serializeVersionedArtifact(
    WEB_INI_CATALOG_SCHEMA,
    WEB_INI_CATALOG_VERSION,
    {
      sourceName,
      entries: catalog.entries.map((entry) => ({
        logicalKey: entry.logicalKey,
        sourceName: entry.sourceName,
        displayName: entry.displayName,
        valueType: entry.valueType,
        ...(entry.unit ? { unit: entry.unit } : {}),
        ...(entry.precision !== undefined ? { precision: entry.precision } : {}),
      })),
    } satisfies PersistedIniCatalogPayload,
  );
}

export function parseIniCatalog(
  serialized: string,
): VersionedArtifactEnvelope<PersistedIniCatalogPayload> {
  return parseVersionedArtifact(serialized, {
    schema: WEB_INI_CATALOG_SCHEMA,
    version: WEB_INI_CATALOG_VERSION,
    validatePayload: isCatalogPayload,
    maxSerializedLength: MAX_WEB_INI_CATALOG_ARTIFACT_LENGTH,
  });
}

export function restoreIniCatalog(
  payload: PersistedIniCatalogPayload,
): ChannelCatalog {
  const entries: ChannelCatalogEntry[] = payload.entries.map((entry) => ({
    logicalKey: entry.logicalKey,
    sourceName: entry.sourceName,
    displayName: entry.displayName,
    valueType: entry.valueType,
    ...(entry.unit ? { unit: entry.unit } : {}),
    ...(entry.precision !== undefined ? { precision: entry.precision } : {}),
    availability: 'known-no-data',
    provenance: { kind: 'ini' },
  }));

  return {
    entries,
    byLogicalKey: new Map(entries.map((entry) => [entry.logicalKey, entry] as const)),
  };
}
