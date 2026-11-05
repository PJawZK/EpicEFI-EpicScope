import { expect, it } from 'vitest';
import { analyzeIdleAirflow } from '../../core/analysis/idle-airflow';
import { idleAirflowValue, presentIdleAirflow } from '../../apps/web/src/pages/idle-airflow-presentation';
const rpm={startSampleIndex:0,timeMs:Float64Array.from([0,100]),values:Float64Array.from([1000,1000]),validity:Uint8Array.from([1,1])};
it('projects retained request facts and independent counts without diagnosing a tune',()=>{
  const result=analyzeIdleAirflow({rpm,sampleIndices:[0,1],basePosition:{range:{...rpm,values:Float64Array.from([20,22])},unit:'%'},closedLoop:{range:{...rpm,values:Float64Array.from([-2,4])},unit:'pp'},finalPosition:{range:{...rpm,values:Float64Array.from([18,26])},unit:'%'}});
  const view=presentIdleAirflow(result,true);expect(view.status).toBe('Recorded request context');expect(view.observed).toContain('Base request mean 21.00 %');expect(idleAirflowValue(result.closedLoop)).toBe('1.00');expect(view.roles[0]!.coverage).toContain('2 valid, 0 invalid, 0 unavailable');expect(view.limits).toContain('not measured physical airflow');expect(presentIdleAirflow(result,false).status).toBe('Limited logged request evidence');
});
it('keeps absent and nonfinite metrics explicitly unavailable, never healthy zero or baseline advice',()=>{
  const result=analyzeIdleAirflow({rpm,sampleIndices:[0,1]});const view=presentIdleAirflow(result,true);expect(view.status).toBe('Logged request evidence unavailable');expect(view.observed).toContain('Unavailable');expect(view.next).toContain('Map compatible');expect(idleAirflowValue(result.closedLoop)).toBe('Unavailable');
  const huge=analyzeIdleAirflow({rpm,sampleIndices:[0,1],closedLoop:{range:{...rpm,values:new Float64Array(2).fill(1e308)},unit:'pp'}});expect(idleAirflowValue(huge.closedLoop)).toBe('Unavailable');expect(presentIdleAirflow(huge,true).roles[1]!.coverage).toContain('nonfinite-metrics');
});

it('does not tell users to remap available channels merely because recovered/invalid attempts were excluded',()=>{
  const invalid={...rpm,validity:Uint8Array.from([0,1])};
  const result=analyzeIdleAirflow({rpm:invalid,sampleIndices:[0,1],basePosition:{range:rpm,unit:'%'},closedLoop:{range:rpm,unit:'pp'},finalPosition:{range:rpm,unit:'%'}});
  const view=presentIdleAirflow(result,true);expect(view.status).toBe('Limited logged request evidence');expect(view.next).toContain('distinguish recovered retries');expect(view.next).not.toContain('Map compatible');expect(view.limits).toContain('do not by themselves establish unrecovered physical loss');
});
