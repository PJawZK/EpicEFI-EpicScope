import {idleContractMlg} from '../fixtures/idle/mlg-contract';
import {importMlgFile} from '../../apps/web/src/adapters/mlg-file-import';
import {importMlgFileStaged} from '../../apps/web/src/adapters/mlg-staged-import';
import {getTimeQueryIndex} from '../../core/log-model/time-query-index';
import {buildRawViewportSeries,buildViewportEnvelope,buildViewportEnvelopeFromBlocks,buildEnvelopeBlockSummary,nearestNumericSample,sliceNumericRangeByTime} from '../../core/timeline/viewport-series';
import {summarizeNumericRange} from '../../core/analysis/range-statistics';
import {interpolateNumericRangeAtTime} from '../../core/analysis/ve-evidence-map';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
export async function runNonmonotonicQueryChecks(){
 const checks=[],records=[{counter:0,timestamp:0,rpm:900},{counter:1,timestamp:1000,rpm:910},{counter:2,timestamp:2000,rpm:920},{counter:3,timestamp:500,rpm:930},{counter:4,timestamp:1000,rpm:940,valid:false},{counter:4,timestamp:1000,rpm:940},{counter:5,timestamp:3000,rpm:950,valid:false},{counter:6,timestamp:4000,rpm:960}],file=new File([idleContractMlg(records)],'query-regression.mlg');
 const parsed=await importMlgFile(file),id=parsed.summary.channels[0].id,r=await parsed.channelData.readChannelRange(id,0,8),index=getTimeQueryIndex(r.timeMs),before=[...r.timeMs];
 assert(JSON.stringify(buildRawViewportSeries(r,4,11).map(p=>p.value))===JSON.stringify([910,930,940]),'Narrow raw query lost original regressed/recovered observations');checks.push('actual fallback parser/range/viewport query includes regressed and recovered observations while excluding bad CRC attempts');
 const cover=parsed.channelData.sampleRangeForTime(4,6);assert(cover.startSampleIndex<=3&&cover.startSampleIndex+cover.sampleCount>3,'Source fetch cover omits regressed record');
 const sliced=sliceNumericRangeByTime(r,4,11);assert(sliced.startSampleIndex===1&&buildRawViewportSeries(sliced,4,11).length===3,'Idle slice cover lost original identity/membership');checks.push('source fetch cover and Idle zero-copy slice preserve original indices across disjoint time matches');
 const direct=buildViewportEnvelope(r,4,11,100),blocks=buildEnvelopeBlockSummary(r.values,r.timeMs,r.validity);assert(direct.validSampleCount===3&&JSON.stringify(buildViewportEnvelopeFromBlocks(r,blocks,4,11,100))===JSON.stringify(direct),'Direct/block membership differs');assert(direct.columns.some(c=>c.sourceRun===1),'Dense presentation dropped run provenance');checks.push('direct and block-backed envelopes include identical membership and retain separate source runs');
 assert(nearestNumericSample(r,5).sampleIndex===3&&index.nearest(10)===1,'Cursor tie/nearest identity incorrect');assert(JSON.stringify(r.timeMs)===JSON.stringify(Float64Array.from(before)),'Queries rewrote canonical timestamps');checks.push('nearest lookup is deterministic by distance/time/original index and does not repair timestamps');
 const stats=summarizeNumericRange(r,4,11);assert(stats.validCount===3&&stats.mean===(910+930+940)/3,'Range mean does not include every qualifying original observation');
 const interpolation=interpolateNumericRangeAtTime(r,3,3);assert(interpolation===undefined,'Delay interpolation crossed a backward boundary');checks.push('scope statistics include all trusted members while anchored temporal lookup rejects cross-run history');
 if(typeof Worker!=='undefined'){
  const handle=importMlgFileStaged(file),indexed=await handle.indexed;handle.startValidation();const validated=await handle.validated,other=await indexed.channelData.readChannelRange(id,0,8);
  assert(JSON.stringify([...indexed.recordIndex.timeMs])===JSON.stringify(before)&&JSON.stringify([...indexed.recordIndex.crcValid])===JSON.stringify([...parsed.recordIndex.crcValid]),'Worker changed time/CRC authority');assert(JSON.stringify(validated.diagnostics)===JSON.stringify(parsed.summary.diagnostics),'Worker retry diagnostics differ');assert(JSON.stringify(buildRawViewportSeries(other,4,11))===JSON.stringify(buildRawViewportSeries(r,4,11)),'Worker/sidecar query result differs');checks.push('staged worker/sidecar and fallback retain identical timestamps, CRC/retry classification and exact query results');
 }else checks.push('Worker-disabled import exercises the corrected fallback query path');
 return {passed:checks.length,checks};
}
