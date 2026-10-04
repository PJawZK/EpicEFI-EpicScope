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

export function channelMatchesInspectorFilters(
  channel: ChannelDefinition,
  context: InspectorFilterContext,
): boolean {
  const query = context.query.trim().toLocaleLowerCase();
  const matchesText = query.length === 0
    || channel.sourceName.toLocaleLowerCase().includes(query)
    || channel.displayName.toLocaleLowerCase().includes(query)
    || (channel.unit?.toLocaleLowerCase().includes(query) ?? false);

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
