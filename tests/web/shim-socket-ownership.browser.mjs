import { socketOwnershipScenario, currentSocketConversionScenario } from '../fixtures/shim-socket-ownership';
export async function runShimSocketOwnershipChecks(){
 const checks=[],observed=[];
 for(const replace of ['reconnect','disconnect'])for(const kind of ['success','reject','corrupt']){
  const result=await socketOwnershipScenario(kind,replace);observed.push({replace,kind,...result});
  if(result.lateTypes.length||result.stateAfterLate!==(replace==='reconnect'?'ready':'disconnected')||(replace==='reconnect'&&JSON.stringify(result.currentValues)!=='[222]'))throw Error(`Obsolete ${kind} after ${replace}: ${JSON.stringify(result)}`);
  checks.push(`native Blob deferred ${kind} after ${replace} cannot publish telemetry/errors or mutate current connection state`);
 }
 const result=await socketOwnershipScenario('corrupt','reconnect',5);
 if(result.lateTypes.length||result.stateAfterLate!=='ready'||JSON.stringify(result.currentValues)!=='[222]')throw Error('Obsolete corrupt conversion bypassed transport ownership with changed generation');
 checks.push('changed protocol generation still rejects obsolete corrupt bytes before decode while accepting the new stream');
 for(const kind of ['success','reject']){
  const current=await currentSocketConversionScenario(kind);
  if(kind==='success'?(current.state!=='ready'||current.errors!==0||JSON.stringify(current.values)!=='[333]'):(current.state!=='error'||current.errors!==1||current.values.length))throw Error(`Current transport ${kind} behavior changed: ${JSON.stringify(current)}`);
  checks.push(`current native Blob ${kind} retains its normal telemetry/protocol-error behavior`);
 }
 return {passed:checks.length,checks,observed};
}
