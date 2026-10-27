import type { ChannelDefinition } from '../../../../core/log-model/log-types';
import type { NumericQualificationCondition } from '../../../../core/analysis/sample-qualification';
import { idleCoolantThreshold } from '../../../../core/analysis/idle-qualification';
import { mergeIdleRegionBounds, type IdleRegionBounds } from '../../../../core/analysis/idle-regions';
import { idleQualificationRoleUnit } from './analyzer-channel-roles';
import { idleRegionAllowsBypass, type IdleManagedRegion } from './idle-region-session';
export type IdleQualificationRole = 'coolant' | 'pedal' | 'physicalTps';
export interface IdleQualificationSettings {
  enabled: boolean; requireWarm: boolean; requireClosed: boolean; closedSource: 'pedal' | 'physicalTps';
  minimumCelsius: number; maximumPercent: number; maximumRpm: number; manualBypass: boolean;
  ids: Record<IdleQualificationRole, string>;
}
/** Compile declared mappings/units and manual policy at the existing view boundary. */
export function buildIdleQualificationPlan(settings: IdleQualificationSettings, channels: readonly ChannelDefinition[], rpmId: string,
  scope: { kind: string; manualId: string | undefined; regions: readonly IdleManagedRegion[] }, discovery = false) {
  const conditions: NumericQualificationCondition[] = [], ids: string[] = [];
  if (!settings.enabled) return { enabled: false, conditions, ids, bypass: [] as IdleRegionBounds[], description: 'Qualification off. Discovery uses RPM only; analysis uses the selected recorded scope.' };
  if (!Number.isFinite(settings.maximumRpm) || settings.maximumRpm <= 0) throw new Error('Enter a positive qualification RPM ceiling.');
  if (settings.requireWarm && (!Number.isFinite(settings.minimumCelsius) || settings.minimumCelsius < -273.15)) throw new Error('Enter a finite coolant threshold in °C (at least −273.15).');
  if (settings.requireClosed && (!Number.isFinite(settings.maximumPercent) || settings.maximumPercent < 0 || settings.maximumPercent > 100)) throw new Error('Enter a closed-input limit from 0 to 100%.');
  const included = scope.regions.filter(region => region.included);
  const isManual = idleRegionAllowsBypass;
  const bypass = !discovery && settings.manualBypass ? mergeIdleRegionBounds(scope.kind === 'manual' ? scope.regions.filter(region => region.id === scope.manualId).map(region => ({startMs:region.startMs,endMs:region.endMs}))
    : scope.kind === 'regions' ? included.filter(isManual).map(region => ({startMs:region.startMs,endMs:region.endMs})) : []) : [];
  const allBypassed = bypass.length > 0 && (scope.kind === 'manual' || (scope.kind === 'regions' && JSON.stringify(mergeIdleRegionBounds(included)) === JSON.stringify(bypass)));
  conditions.push({channelId:rpmId,operator:'gt',value:0},{channelId:rpmId,operator:'lte',value:settings.maximumRpm});
  const description = [`0 < RPM ≤ ${settings.maximumRpm}`];
  const requireRole = (role: IdleQualificationRole) => {
    if(allBypassed)return undefined;
    const channel = channels.find(channel => channel.id === settings.ids[role]);
    const unit = channel && idleQualificationRoleUnit(channel,role);
    if (!channel || !unit) {
      if (allBypassed) return undefined;
      throw new Error(`Qualification unavailable: select a ${role === 'coolant' ? 'coolant channel with declared °C/°F' : role === 'pedal' ? 'driver pedal-position channel with declared % (physical TPS is not pedal intent)' : 'physical TPS channel with declared %'}, or disable that condition.`);
    }
    ids.push(channel.id);return {channel,unit};
  };
  if (settings.requireWarm) {
    const mapped = requireRole('coolant');
    if (mapped) {
      const rawThreshold = idleCoolantThreshold(settings.minimumCelsius,mapped.unit.unit as '°C'|'°F');
      conditions.push({channelId:mapped.channel.id,operator:'gte',value:rawThreshold});
      description.push(`coolant ${mapped.channel.sourceName} ≥ ${settings.minimumCelsius} °C${mapped.unit.unit === '°F' ? ` (${rawThreshold.toFixed(2)} °F source)` : ''}`);
    } else description.push('coolant condition bypassed for manual bounds');
  }
  if (settings.requireClosed) {
    const mapped = requireRole(settings.closedSource);
    if (mapped) {
      conditions.push({channelId:mapped.channel.id,operator:'gte',value:0},{channelId:mapped.channel.id,operator:'lte',value:settings.maximumPercent});
      description.push(`${settings.closedSource === 'pedal' ? 'driver pedal position' : 'physical TPS position only'} ${mapped.channel.sourceName} 0–${settings.maximumPercent}%`);
    } else description.push('closed-input condition bypassed for manual bounds');
  }
  description.push(discovery ? 'discovery never bypasses conditions' : allBypassed ? 'all selected bounds bypass conditions; source validity still applies' : settings.manualBypass ? 'manual/edited managed regions may bypass conditions' : 'manual bypass off');
  return { enabled: true, conditions, ids: [...new Set(ids)], bypass, description: description.join('; ') };
}
