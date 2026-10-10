import type { ChannelDefinition } from '../../../../core/log-model/log-types';

export type InspectorVisibilityFilter = 'all' | 'active' | 'favorites' | 'recent';

export interface InspectorFilterContext {
  readonly query: string;
  readonly selectedGroup: string;
  readonly visibility: InspectorVisibilityFilter;
  readonly activeChannelIds: ReadonlySet<string>;
  readonly favoriteChannelIds: ReadonlySet<string>;
  readonly recentChannelIds: readonly string[];
}

interface NormalizedChannelSearchText {
  readonly sourceName: string;
  readonly displayName: string;
  readonly unit: string | undefined;
}

let lastQuerySource: string | undefined;
let lastNormalizedQuery = '';
const normalizedChannelSearchText = new WeakMap<ChannelDefinition, NormalizedChannelSearchText>();

function normalizeFilterQuery(query: string): string {
  if (query === lastQuerySource) return lastNormalizedQuery;
  lastQuerySource = query;
  lastNormalizedQuery = query.trim().toLocaleLowerCase();
  return lastNormalizedQuery;
}

function searchableText(channel: ChannelDefinition): NormalizedChannelSearchText {
  const cached = normalizedChannelSearchText.get(channel);
  if (cached) return cached;

  const normalized = {
    sourceName: channel.sourceName.toLocaleLowerCase(),
    displayName: channel.displayName.toLocaleLowerCase(),
    unit: channel.unit?.toLocaleLowerCase(),
  };
  normalizedChannelSearchText.set(channel, normalized);
  return normalized;
}

export function channelMatchesInspectorFilters(
  channel: ChannelDefinition,
  context: InspectorFilterContext,
): boolean {
  const query = normalizeFilterQuery(context.query);
  let matchesText = true;
  if (query.length > 0) {
    const text = searchableText(channel);
    matchesText = text.sourceName.includes(query)
      || text.displayName.includes(query)
      || (text.unit?.includes(query) ?? false);
  }

  const matchesGroup = context.selectedGroup === ''
    || (context.selectedGroup === '__ungrouped__'
      ? !channel.category?.trim()
      : channel.category === context.selectedGroup);

  const matchesVisibility = context.visibility === 'all'
    || (context.visibility === 'active' && context.activeChannelIds.has(channel.id))
    || (context.visibility === 'favorites' && context.favoriteChannelIds.has(channel.id))
    || (context.visibility === 'recent' && context.recentChannelIds.includes(channel.id));

  return matchesText && matchesGroup && matchesVisibility;
}

function normalizedUnit(unit: string | undefined): string | undefined {
  const value = unit?.trim();
  if (!value) return undefined;
  const lower = value.toLocaleLowerCase();
  if (lower === 'lambda' || lower === 'lam' || value === 'λ') return 'λ';
  if (lower === 'percent' || lower === 'pct') return '%';
  if (lower === 'rpm') return 'rpm';
  if (lower === 'degc' || lower === 'celsius') return '°C';
  if (lower === 'degf' || lower === 'fahrenheit') return '°F';
  if (lower === 'degrees' || lower === 'degree' || lower === 'deg') return '°';
  return value;
}

export function formatInspectorChannelValue(
  channel: ChannelDefinition,
  value: number | undefined,
): string {
  if (value === undefined || !Number.isFinite(value)) return '—';

  const precision = Math.min(6, Math.max(0, channel.precision ?? 2));
  const number = value.toFixed(precision);
  const unit = normalizedUnit(channel.unit);
  if (!unit) return number;
  if (unit === 'λ') return `λ ${number}`;
  return `${number} ${unit}`;
}
