import { describe, expect, it } from 'vitest';

import type { ChannelDefinition } from '../../core/log-model/log-types';
import {
  channelMatchesInspectorFilters,
  formatInspectorChannelValue,
} from '../../apps/web/src/panels/inspector-channel-view';

const channel = (
  id: string,
  sourceName: string,
  displayName: string,
  unit?: string,
  category?: string,
  precision = 2,
): ChannelDefinition => ({
  id,
  sourceName,
  displayName,
  ...(unit ? { unit } : {}),
  ...(category ? { category } : {}),
  precision,
});

const rpm = channel('ini:RPMValue', 'RPMValue', 'Engine Speed', 'rpm', 'Engine', 0);
const tps = channel('ini:TPSValue', 'TPSValue', 'Throttle Position', '%', 'Engine', 1);
const lambda = channel('ini:lambdaValue', 'lambdaValue', 'Lambda', 'lambda', 'Fuel', 3);
const ungrouped = channel('mlg:1', 'rawValue', 'Raw Value');

describe('inspector channel filters', () => {
  const base = {
    query: '',
    selectedGroup: '',
    activeChannelIds: new Set<string>(),
    favoriteChannelIds: new Set<string>(),
    recentChannelIds: [] as string[],
  };

  it('shows only active channels when Active traces is selected', () => {
    const activeChannelIds = new Set([rpm.id, lambda.id]);
    expect(channelMatchesInspectorFilters(rpm, { ...base, visibility: 'active', activeChannelIds })).toBe(true);
    expect(channelMatchesInspectorFilters(tps, { ...base, visibility: 'active', activeChannelIds })).toBe(false);
    expect(channelMatchesInspectorFilters(lambda, { ...base, visibility: 'active', activeChannelIds })).toBe(true);
  });

  it('combines active filtering with search and group filters', () => {
    const activeChannelIds = new Set([rpm.id, lambda.id]);
    const context = {
      ...base,
      visibility: 'active' as const,
      activeChannelIds,
      query: 'lambda',
      selectedGroup: 'Fuel',
    };
    expect(channelMatchesInspectorFilters(lambda, context)).toBe(true);
    expect(channelMatchesInspectorFilters(rpm, context)).toBe(false);
  });

  it('keeps favorites and recent independent from active state', () => {
    expect(channelMatchesInspectorFilters(tps, {
      ...base,
      visibility: 'favorites',
      favoriteChannelIds: new Set([tps.id]),
    })).toBe(true);
    expect(channelMatchesInspectorFilters(rpm, {
      ...base,
      visibility: 'recent',
      recentChannelIds: [rpm.id],
    })).toBe(true);
  });

  it('supports explicit ungrouped filtering', () => {
    expect(channelMatchesInspectorFilters(ungrouped, {
      ...base,
      visibility: 'all',
      selectedGroup: '__ungrouped__',
    })).toBe(true);
    expect(channelMatchesInspectorFilters(rpm, {
      ...base,
      visibility: 'all',
      selectedGroup: '__ungrouped__',
    })).toBe(false);
  });
});

describe('inspector current value formatting', () => {
  it('uses conventional units without a bar', () => {
    expect(formatInspectorChannelValue(rpm, 847.6)).toBe('848 rpm');
    expect(formatInspectorChannelValue(tps, 2.14)).toBe('2.1 %');
  });

  it('uses the lambda symbol when the channel unit identifies lambda', () => {
    expect(formatInspectorChannelValue(lambda, 0.9874)).toBe('λ 0.987');
  });

  it('normalizes common textual unit aliases', () => {
    expect(formatInspectorChannelValue(channel('clt', 'clt', 'Coolant', 'degC', 'Engine', 1), 82.24)).toBe('82.2 °C');
    expect(formatInspectorChannelValue(channel('ign', 'ign', 'Ignition', 'deg', 'Ignition', 1), 15.76)).toBe('15.8 °');
  });

  it('shows an em dash for missing or invalid values', () => {
    expect(formatInspectorChannelValue(rpm, undefined)).toBe('—');
    expect(formatInspectorChannelValue(rpm, Number.NaN)).toBe('—');
  });
});
