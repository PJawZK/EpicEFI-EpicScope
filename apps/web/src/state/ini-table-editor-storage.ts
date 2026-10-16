import type { ObservabilityRecorder } from '../observability/recorder';
import type { IniTableEditorDefinition } from '../../../../core/parsers/ini/ini-table-editor-parser';

const STORAGE_KEY = 'epicscope.ini-table-editor-definitions.v1';
let definitionsCache: readonly IniTableEditorDefinition[] | undefined;

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
  if (definitionsCache !== undefined) return definitionsCache;
  definitionsCache = [];
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return definitionsCache;
    const parsed: unknown = JSON.parse(raw);
    definitionsCache = Array.isArray(parsed) ? parsed.filter(isDefinition) : [];
  } catch {
    // Hydrate at most once; an accepted INI can replace this empty snapshot.
  }
  return definitionsCache;
}

export function saveIniTableEditorDefinitions(definitions: readonly IniTableEditorDefinition[], recorder?: ObservabilityRecorder): void {
  // Session authority precedes best-effort persistence, including an empty INI
  // or explicit unload. Consumers must never read stale disk data after this.
  definitionsCache = definitions;
  let outcome: 'success' | 'failure' | 'unavailable' = 'unavailable';
  try {
    const storage = globalThis.localStorage;
    if (storage) { storage.setItem(STORAGE_KEY, JSON.stringify(definitions)); outcome = 'success'; }
  } catch {
    outcome = 'failure';
    // The active INI still works for this session even if browser persistence is unavailable.
  }
  recorder?.record({ recordKind: 'event', subsystem: 'persistence', component: 'ini-table-definitions', name: 'persistence.result', origin: 'programmatic', severity: outcome === 'failure' ? 'warning' : 'info', metadata: { action: 'save', outcome, definitions: definitions.length, acceptedInMemory: true } });
  const ownerWindow = globalThis.window;
  if (ownerWindow) {
    recorder?.record({ recordKind: 'event', subsystem: 'owners', component: 'ini-table-definitions', name: 'ini-definitions.dispatch', origin: 'programmatic', priority: 'detail', metadata: { definitions: definitions.length } });
    ownerWindow.dispatchEvent(new Event(INI_TABLE_DEFINITIONS_CHANGED_EVENT));
  }
}
