import type { NumericChannelRange } from '../log-model/log-types';
import { mergeIdleRegionBounds, type IdleRegionBounds } from './idle-regions';
import { validateIdleSelection } from './idle-recorded-signal';

export interface IdleRecoverySettings {
  readonly sagRpm: number;
  readonly bandRpm: number;
  readonly dwellMs: number;
  readonly maxGapMs: number;
}
export interface IdleRecoveryEvent {
  /** Stable within the source lifetime; indices are never densely reindexed. */
  readonly id: number;
  readonly onsetMs: number;
  readonly lastBelowMs: number;
  readonly endMs: number;
  readonly minimumRpm: number;
  readonly minimumErrorRpm: number;
  readonly status: 'recovered' | 'censored';
  readonly reason: 'settled' | 'invalid-or-unaligned' | 'selection-boundary' | 'time-discontinuity' | 'source-integrity' | 'end-of-scope';
  readonly settlingMs?: number;
  readonly confirmationMs?: number;
  readonly recoveryMs?: number;
}
export interface IdleRecoveryResult {
  readonly status: 'recorded' | 'missing-target';
  readonly events: readonly IdleRecoveryEvent[];
  readonly validPairs: number;
  readonly invalidPairs: number;
  readonly recoveredCount: number;
  readonly censoredCount: number;
  readonly settings: IdleRecoverySettings;
}
export function validateIdleRecoverySettings(input: IdleRecoverySettings): IdleRecoverySettings {
  const settings={...input};
  if (![settings.sagRpm,settings.bandRpm,settings.dwellMs,settings.maxGapMs].every(Number.isFinite)
    || settings.bandRpm < 0 || settings.sagRpm <= settings.bandRpm || settings.dwellMs < 0 || settings.maxGapMs <= 0) throw new RangeError('Recovery requires sag > band ≥ 0 RPM, dwell ≥ 0 ms and maximum gap > 0 ms.');
  return settings;
}
/** Single forward pass over the accepted, overlap-deduplicated original selection.
 * An invalid retry is conservatively a break: time equality alone cannot prove retry identity.
 * Markers are canonical Logger metadata, never inferred from diagnostic display text. */
export function analyzeIdleRecovery(input: {
  readonly rpm: NumericChannelRange;
  readonly target?: NumericChannelRange | undefined;
  readonly sampleIndices: ArrayLike<number>;
  readonly settings: IdleRecoverySettings;
  readonly regions?: readonly IdleRegionBounds[] | undefined;
  readonly integrity?: readonly {readonly timeMs:number;readonly breaksContinuity:boolean}[] | undefined;
}): IdleRecoveryResult {
  validateIdleSelection(input.sampleIndices);
  const settings = validateIdleRecoverySettings(input.settings);
  const events: IdleRecoveryEvent[] = [];
  let current: {id:number;onsetMs:number;lastBelowMs:number;endMs:number;minimumRpm:number;minimumErrorRpm:number} | undefined;
  let settlingMs: number | undefined, previousIndex: number | undefined, previousTime: number | undefined;
  let validPairs=0,invalidPairs=0,recoveredCount=0;
  const markers=(input.integrity??[]).filter(marker=>marker.breaksContinuity&&Number.isFinite(marker.timeMs)).map(marker=>marker.timeMs).sort((a,b)=>a-b);
  let markerIndex=0, regionIndex=0, previousRegion:number|undefined;
  const regions=input.regions===undefined?undefined:mergeIdleRegionBounds(input.regions);
  const close=(reason:IdleRecoveryEvent['reason'],confirmationMs?:number)=>{
    if(current){
      if(confirmationMs!==undefined&&settlingMs!==undefined){events.push({...current,status:'recovered',reason,settlingMs,confirmationMs,recoveryMs:settlingMs-current.onsetMs});recoveredCount++;}
      else events.push({...current,status:'censored',reason});
    }
    current=undefined;settlingMs=undefined;
  };
  if(input.target) for(let position=0;position<input.sampleIndices.length;position++){
    const index=input.sampleIndices[position]!, local=index-input.rpm.startSampleIndex, other=index-input.target.startSampleIndex;
    const time=input.rpm.timeMs[local], rpm=input.rpm.values[local], target=input.target.values[other];
    if(previousIndex!==undefined&&index!==previousIndex+1)close('selection-boundary');
    if(time!==undefined&&Number.isFinite(time)){
      if(regions){
        if(previousTime===undefined||time<previousTime)regionIndex=0;
        while(regionIndex<regions.length&&regions[regionIndex]!.endMs<time)regionIndex++;
        const region=regions[regionIndex];
        if(!region||time<region.startMs){close('selection-boundary');previousIndex=index;previousTime=undefined;previousRegion=undefined;continue;}
        if(previousRegion!==undefined&&previousRegion!==regionIndex)close('selection-boundary');
        previousRegion=regionIndex;
      }
      if(previousTime!==undefined&&(time<=previousTime||time-previousTime>settings.maxGapMs))close('time-discontinuity');
      // Reposition after a time regression; do not silently miss a later repeated marker.
      if(previousTime!==undefined&&time<previousTime)markerIndex=0;
      let crossed=false;
      while(markerIndex<markers.length&&markers[markerIndex]!<=time){if(previousTime!==undefined&&markers[markerIndex]!>previousTime)crossed=true;markerIndex++;}
      if(crossed)close('source-integrity');
    }
    const valid=time!==undefined&&Number.isFinite(time)&&rpm!==undefined&&Number.isFinite(rpm)&&target!==undefined&&Number.isFinite(target)
      && input.rpm.validity[local]===1&&input.target.validity[other]===1&&input.target.timeMs[other]===time;
    if(!valid){invalidPairs++;close('invalid-or-unaligned');previousIndex=index;previousTime=time!==undefined&&Number.isFinite(time)?time:undefined;continue;}
    validPairs++;
    const error=rpm-target;
    if(!Number.isFinite(error)){invalidPairs++;validPairs--;close('invalid-or-unaligned');previousIndex=index;previousTime=time!==undefined&&Number.isFinite(time)?time:undefined;continue;}
    if(!current&&error<=-settings.sagRpm)current={id:index,onsetMs:time,lastBelowMs:time,endMs:time,minimumRpm:rpm,minimumErrorRpm:error};
    if(current){
      current.endMs=time;current.minimumRpm=Math.min(current.minimumRpm,rpm);current.minimumErrorRpm=Math.min(current.minimumErrorRpm,error);
      if(error<=-settings.sagRpm)current.lastBelowMs=time;
      if(Math.abs(error)<=settings.bandRpm){settlingMs??=time;if(time-settlingMs>=settings.dwellMs)close('settled',time);}
      else settlingMs=undefined;
    }
    previousIndex=index;previousTime=time;
  }
  close('end-of-scope');
  return {status:input.target?'recorded':'missing-target',events,validPairs,invalidPairs,recoveredCount,censoredCount:events.length-recoveredCount,settings};
}
