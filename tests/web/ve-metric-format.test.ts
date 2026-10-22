import { describe, expect, it } from 'vitest';
import { formatVeMetric, formatSignedVeMetric } from '../../apps/web/src/pages/ve-metric-format';
import { veResultDisplay } from '../../apps/web/src/pages/ve-analyzer-result-view';
describe('VE presentation precision', () => {
 it('uses bounded tune digits and trims redundant decimal zeros',()=>{
  expect(formatVeMetric(123.456789)).toBe('123.46');expect(formatVeMetric(123.456789,0)).toBe('123');
  expect(formatVeMetric(70,2)).toBe('70');expect(formatVeMetric(1.23456,3)).toBe('1.235');
  expect(formatVeMetric(1.23456,NaN)).toBe('1.23');expect(formatVeMetric(70,200)).toBe('70');
 });
 it('never presents rounded signed zero as a change',()=>{
  expect(formatSignedVeMetric(-0.004,1,'%')).toBe('0%');expect(formatSignedVeMetric(0.004,1,'%')).toBe('0%');
  expect(formatSignedVeMetric(0.056,1,'%')).toBe('+0.1%');expect(formatSignedVeMetric(-0.056,1,'%')).toBe('-0.1%');
  expect(formatVeMetric(-0)).toBe('0');
 });
 it('keeps unavailable and nonfinite values unavailable',()=>{
  for(const value of [undefined,NaN,Infinity,-Infinity]){expect(formatVeMetric(value)).toBe('—');expect(formatSignedVeMetric(value,1,'%')).toBe('—');}
 });
 it('shares weight and percentage display without rounding analytical authority',()=>{
  const metrics={state:'measured' as const,current:70,proposed:71,evidenceCandidate:72,changeValue:1,changePercent:0.004,correctionPercent:-0.004,spreadPercent:1.23456,confidence:'strong' as const,weight:12.3456789,samples:42};
  expect(veResultDisplay(metrics,'weight')).toMatchObject({text:'12.346',numericValue:12.3456789});
  expect(veResultDisplay(metrics,'change-percent').text).toBe('0%');expect(veResultDisplay(metrics,'mixture-error').text).toBe('0%');
  expect(veResultDisplay(metrics,'proposal',undefined,0).text).toBe('71');
  expect(veResultDisplay({...metrics,current:70.123456,weight:undefined},'weight',undefined,4).text).toBe('70.1235');
  expect(metrics.weight).toBe(12.3456789);expect(metrics.correctionPercent).toBe(-0.004);
 });
});
