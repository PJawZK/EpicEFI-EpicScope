import type { TuneEntry, TuneModel } from './tune-model';
import { createTuneTable2D, locateTuneTablePoint, type TuneTable2D } from './table-correlation';

/** Explicit related-entry catalogue; no fuzzy table/actuator or flashed-tune inference. */
export const IDLE_TUNE_PANELS = [
  {id:'base',label:'Base airflow',names:['cltIdleCorrBins','rpmIdleCorrBins','cltIdleCorrTable'],table:'cltIdleCorrTable',x:'cltIdleCorrBins',y:'rpmIdleCorrBins'},
  {id:'target',label:'RPM target',names:['cltIdleRpmBins','cltIdleRpm'],table:'cltIdleRpm',x:'cltIdleRpmBins'},
  {id:'rpmPid',label:'Outer RPM PID',names:['idleRpmPid_pFactor','idleRpmPid_iFactor','idleRpmPid_dFactor','idleRpmPid_offset','idleRpmPid_periodMs','idleRpmPid_minValue','idleRpmPid_maxValue','idlerpmpid_iTermMin','idlerpmpid_iTermMax','idlePidDeactivationTpsThreshold','idlePidRpmUpperLimit']},
  {id:'multiplier',label:'RPM PID multiplier',names:['useIacPidMultTable','iacPidMultRpmBins','iacPidMultLoadBins','iacPidMultTable'],table:'iacPidMultTable',x:'iacPidMultRpmBins',y:'iacPidMultLoadBins'},
  {id:'bias',label:'DC idle bias',names:['dcIdleBiasBins','dcIdleBiasValues','etbFunctions1','etbFunctions2','hybridDcIdle_mode'],table:'dcIdleBiasValues',x:'dcIdleBiasBins'},
  {id:'positionPid',label:'DC position PID',names:['dcIdlePositionPid_pFactor','dcIdlePositionPid_iFactor','dcIdlePositionPid_dFactor','dcIdlePositionPid_offset','dcIdlePositionPid_periodMs','dcIdlePositionPid_minValue','dcIdlePositionPid_maxValue','dcIdle_iTermMin','dcIdle_iTermMax','dcIdleMinimumPosition','dcIdleMaximumPosition']},
  {id:'etbBias',label:'ETB bias (separate actuator)',names:['etbBiasBins','etbBiasValues'],table:'etbBiasValues',x:'etbBiasBins'},
  {id:'spark',label:'Idle ignition advance',names:['useSeparateAdvanceForIdle','idleAdvanceBins','idleAdvance'],table:'idleAdvance',x:'idleAdvanceBins'},
  {id:'sparkError',label:'Idle timing error adjustment',names:['useIdleTimingTargetError','idleTimingTargetErrorBins','idleTimingTargetErrorValues'],table:'idleTimingTargetErrorValues',x:'idleTimingTargetErrorBins'},
  {id:'timingPid',label:'Idle timing PID',names:['useIdleTimingPidControl','idleTimingPid_pFactor','idleTimingPid_iFactor','idleTimingPid_dFactor','idleTimingPid_minValue','idleTimingPid_maxValue','idleTimingPid_periodMs']},
] as const;
export type IdleTunePanelId=typeof IDLE_TUNE_PANELS[number]['id'];
export interface IdleTuneEntryContext {readonly name:string;readonly status:'available'|'missing'|'ambiguous'|'invalid';readonly reason:string;readonly entry?:TuneEntry;}
export interface IdleTunePanelContext {readonly id:IdleTunePanelId;readonly label:string;readonly entries:readonly IdleTuneEntryContext[];readonly geometry?:TuneTable2D;readonly geometryReason:string;readonly xUnit:string;readonly yUnit:string;}
export const IDLE_TUNE_AUTHORITY = 'Loaded MSQ reference only. Recording association, INI/firmware compatibility and flashed identity are unverified. No runtime clamp/fade, actuator assignment or bias-mismatch result follows from this view.';
const MAX_CELLS=1024;
function validEntry(entry:TuneEntry):boolean{
  if(!Number.isSafeInteger(entry.rows)||!Number.isSafeInteger(entry.cols)||entry.rows<1||entry.cols<1||entry.rows*entry.cols>MAX_CELLS)return false;
  if(entry.numericValues)return entry.numericValues.length===entry.rows*entry.cols&&entry.numericValues.every(Number.isFinite);
  return entry.kind==='text'&&entry.rows===1&&entry.cols===1&&typeof entry.textValue==='string';
}
function increasing(axis:readonly number[]):boolean{return axis.length>0&&axis.every((v,i)=>Number.isFinite(v)&&(i===0||v>axis[i-1]!));}
/** Project once per accepted immutable tune. Never consult byName to resolve duplicate pages. */
export function projectIdleTune(model:TuneModel|undefined):readonly IdleTunePanelContext[]{
  const names=new Map<string,TuneEntry[]>();
  const wanted=new Set<string>(IDLE_TUNE_PANELS.flatMap(panel=>[...panel.names]));
  for(const entry of model?.entries??[])if(wanted.has(entry.name)){const found=names.get(entry.name)??[];found.push(entry);names.set(entry.name,found);}
  return IDLE_TUNE_PANELS.map(panel=>{
    const entries:IdleTuneEntryContext[]=panel.names.map(name=>{
      const found=names.get(name)??[];
      if(!found.length)return {name,status:'missing',reason:'Not supplied by loaded MSQ.'};
      if(found.length!==1)return {name,status:'ambiguous',reason:'Duplicate name across MSQ entries/pages; no automatic authority.'};
      const entry=found[0]!;
      return validEntry(entry)?{name,status:'available',reason:'Exact loaded MSQ entry; runtime association unverified.',entry}:{name,status:'invalid',reason:'Invalid dimensions, nonfinite/value-count mismatch or more than 1024 cells.'};
    });
    const get=(name:string)=>entries.find(item=>item.name===name)?.entry;
    let geometry:TuneTable2D|undefined,geometryReason='Scalar settings only; no table lookup.',xUnit='unspecified',yUnit='unspecified';
    if('table'in panel){
      try{
        const table=get(panel.table),x=get(panel.x),y='y'in panel?get(panel.y):undefined;
        xUnit=x?.units||'unspecified';yUnit=y?.units||'unspecified';
        if(!table?.numericValues||!x?.numericValues||('y'in panel&&!y?.numericValues))throw Error('Required unique numeric table/axis entries unavailable.');
        if(x.kind!=='vector'||!increasing(x.numericValues)||('y'in panel&&(y?.kind!=='vector'||!increasing(y.numericValues!))))throw Error('Lookup requires finite, strictly increasing vector axes; raw values are retained for inspection.');
        if('y'in panel){
          // Use the shared table geometry owner after unique entry resolution; never last-name-wins.
          const byName=new Map(entries.flatMap(item=>item.entry?[[item.name,item.entry] as const]:[]));
          geometry=createTuneTable2D({...model!,byName},{tableName:panel.table,xAxisName:panel.x,yAxisName:panel.y});
        }else{
          if(table.kind!=='vector'||(table.rows!==1&&table.cols!==1)||(x.rows!==1&&x.cols!==1)||table.numericValues.length!==x.numericValues.length)throw Error('Curve requires matching one-dimensional axis/value geometry.');
          geometry={name:table.name,units:table.units,xAxisName:x.name,yAxisName:'No second axis',xAxis:x.numericValues,yAxis:[0],values:table.numericValues,rows:1,cols:table.numericValues.length};
        }
        geometryReason='Loaded reference geometry validated; firmware lookup policy and runtime association unverified.';
      }catch(error){geometryReason=error instanceof Error?error.message:'Lookup unavailable.';}
    }
    return {id:panel.id,label:panel.label,entries,...(geometry?{geometry}:{}),geometryReason,xUnit,yUnit};
  });
}
/** Explicit user-coordinate reference query, not log-derived or a firmware prediction.
 * Shared linear/bilinear policy clamps at endpoints. Reject derived overflow. */
export function lookupIdleTuneReference(panel:IdleTunePanelContext,x:number,y=0):number|undefined{
  if(!panel.geometry||!Number.isFinite(x)||!Number.isFinite(y))return undefined;
  const value=locateTuneTablePoint(panel.geometry,x,y).interpolatedTuneValue;
  return Number.isFinite(value)?value:undefined;
}
