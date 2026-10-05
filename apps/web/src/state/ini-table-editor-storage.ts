import type { IniTableEditorDefinition } from '../../../../core/parsers/ini/ini-table-editor-parser';

const STORAGE_KEY = 'epicscope.ini-table-editor-definitions.v1';
export const INI_TABLE_DEFINITIONS_CHANGED_EVENT = 'epicscope-ini-table-definitions-changed';

function isDefinition(value: unknown): value is IniTableEditorDefinition {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<IniTableEditorDefinition>;
  return typeof candidate.tableId === 'string'
    && typeof candidate.xBins === 'string'
    && typeof candidate.yBins === 'string'
    && typeof candidate.zBins === 'string';
}

export function loadIniTableEditorDefinitions(): readonly IniTableEditorDefinition[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isDefinition) : [];
  } catch {
    return [];
  }
}

export function saveIniTableEditorDefinitions(definitions: readonly IniTableEditorDefinition[]): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(definitions));
  } catch {
    // The active INI still works for this session even if browser persistence is unavailable.
  }
  globalThis.window?.dispatchEvent(new Event(INI_TABLE_DEFINITIONS_CHANGED_EVENT));
}
