import { describe, expect, it } from 'vitest';
import { quantizeVeMsqValue } from '../../core/tune/ve-msq-write';
import { resolveVeMsqStoragePolicy } from '../../core/parsers/ini/ini-msq-write-policy';
import { normalizeMsqTune } from '../../core/tune/tune-model';
import { parseMsq } from '../../core/parsers/msq/msq-parser';
const model = normalizeMsqTune(parseMsq('<msq><versionInfo signature="test"/><page number="0"><constant name="veTable" rows="2" cols="2" units="%" digits="1">38.19 38.27 38.32 38.36</constant></page></msq>'));
const entry = model.byName.get('veTable')!;
const ini = '[MegaTune]\nsignature="test"\n[Constants]\nveTable=array,U16,0,[2x2],"%",0.01,0,0,650,1\n';
const policy = resolveVeMsqStoragePolicy(ini,model,entry);
describe('VE MSQ storage precision and qualification', () => {
  it.each([[38.19, '38.19'], [47.7375, '47.74'], [1.005, '1.01'], [1.0049, '1'], [38.58 * 1.25, '48.23'], [650, '650'], [0, '0']])('quantizes %s as %s using storage precision, not digits1', (input,text) => {
    expect(quantizeVeMsqValue(input,policy).text).toBe(text);
  });
  it.each([undefined, NaN, Infinity, -1, 650.001])('rejects invalid/out-of-range %s instead of filling/clamping', input => {
    expect(() => quantizeVeMsqValue(input,policy)).toThrow();
  });
  it('does not round away a clearly sub-half input or drift through repeated quantization', () => {
    expect(quantizeVeMsqValue(48.224999,policy).value).toBe(48.22);
    const first=quantizeVeMsqValue(48.225,policy);expect(quantizeVeMsqValue(first.value,policy)).toEqual(first);
  });
  it('accepts conditional display-digit alternatives only when storage fields agree', () => {
    expect(resolveVeMsqStoragePolicy(ini+'#if HUNDREDTH_VE\nveTable=array,U16,0,[2x2],"%",0.01,0,0,650,2\n#endif',model,entry).scale).toBe(.01);
    expect(() => resolveVeMsqStoragePolicy(ini+'veTable=array,U16,0,[2x2],"%",0.1,0,0,650,1',model,entry)).toThrow('disagree');
  });
  it.each([
    ini.replace('"test"','"other"'), ini.replace('[2x2]','[3x2]'), ini.replace('0.01,0','{scale},0'),
    ini.replace('0.01,0','0.01,1'), ini.replace('U16','F32'), ini.replace('"%"','"AFR"'), ini.replace('veTable=','other='),
  ])('refuses uncertain or mismatched INI policy', source => { expect(() => resolveVeMsqStoragePolicy(source,model,entry)).toThrow(); });
  it('checks the representable integer range as well as configured physical limits', () => {
    expect(() => quantizeVeMsqValue(1000,{...policy,maximum:1000})).toThrow('storage type');
  });
});
