// Run through Vite in a real browser, separately from Node Vitest.
import { createAnalyzerPage } from '../../apps/web/src/pages/analyzer-page';
import { createTuneTableView } from '../../apps/web/src/pages/tune-table-view';
import { createBoostAnalyzerView } from '../../apps/web/src/pages/boost-analyzer-view';
import { createSpecializedAnalyzerSuiteView } from '../../apps/web/src/pages/specialized-analyzer-suite-view';
import { createIgnitionAnalyzerView } from '../../apps/web/src/pages/ignition-analyzer-view';
import { createFuelInjectorAnalyzerView } from '../../apps/web/src/pages/fuel-injector-analyzer-view';
import { createHistogramTableGeneratorView } from '../../apps/web/src/pages/histogram-table-generator-view';
import { createHistogramDistributionView } from '../../apps/web/src/pages/histogram-distribution-view';
import { createScatterView } from '../../apps/web/src/pages/scatter-view';
import { createVeAnalyzerView } from '../../apps/web/src/pages/ve-analyzer-view';
import { loadHistogramCalculatedFields, saveHistogramCalculatedFields } from '../../apps/web/src/state/histogram-table-storage';
import { normalizeMsqTune } from '../../core/tune/tune-model';
import { parseMsq } from '../../core/parsers/msq/msq-parser';
import { suggestAnalyzerChannel } from '../../apps/web/src/pages/analyzer-channel-roles';
const channels = [
  ['rpm', 'RPM', 'rpm'], ['map', 'MAP', 'kPa'], ['afr', 'AFR', 'AFR'], ['full', 'Scope collision', 'test'],
].map(([id, sourceName, unit]) => ({ id, sourceName, unit, displayName: 'Alias '+id, valueType: 'number' }));
const context = { source: { identity: {}, sampleCount: 0, revision: 0 }, channels, traces: [], loadTraces: async () => [], aTimeMs: 0, bTimeMs: 1000, savedRanges: [] };
const settle = async () => { await new Promise(r=>setTimeout(r,0)); await new Promise(r=>setTimeout(r,0)); };
function assert(ok, message) { if (!ok) throw Error(message); }
export async function runChannelOptionOwnerChecks() {
 const passed=[];
 for(const [name,create] of [['comparison',createAnalyzerPage],['tune correlation',createTuneTableView],['boost',createBoostAnalyzerView],['suite',createSpecializedAnalyzerSuiteView],['ignition',createIgnitionAnalyzerView],['fuel pressure',createFuelInjectorAnalyzerView],['histogram table',createHistogramTableGeneratorView],['distribution',createHistogramDistributionView],['scatter',createScatterView],['VE',createVeAnalyzerView]]) {
  const view=create(),host=document.createElement('section');host.append(view.element);document.body.append(host);
  view.setContext(context);await settle();
  const option=view.element.querySelector('option[value="rpm"]');assert(option?.textContent==='RPM [rpm]',name+': owner label missing');
  const control=option.parentElement;const selected=option.disabled ? [...control.options].find(o=>o.value&&!o.disabled)?.value ?? '' : 'rpm';control.value=selected;
  view.setContext({...context,channels:channels.map(c=>({...c})),aTimeMs:100,bTimeMs:800});await settle();
  assert(view.element.querySelector('option[value="rpm"]')===option && control.value===selected,name+': same catalog replaced selection/options');
  view.setContext({...context,channels:channels.map(c=>c.id==='rpm'?{...c,sourceName:'Engine RPM',unit:'krpm'}:c)});await settle();
  assert(view.element.querySelector('option[value="rpm"]')?.textContent==='Engine RPM [krpm]',name+': changed metadata not updated');
  const scope=view.element.querySelector('select[data-role="scope"] option[value="full"]');
  if(scope)assert(scope.textContent!=='Scope collision [test]',name+': channel labeling rewrote scope');
  // Suggestion calls must not register a foreign catalog or modify another view.
  const local=view.element.querySelector('option[value="rpm"]');suggestAnalyzerChannel('fueling','rpm',[]);await settle();
  assert(view.element.querySelector('option[value="rpm"]')===local && local.textContent==='Engine RPM [krpm]',name+': suggestion mutated a foreign selector');
  passed.push(name+': owned labels, stable options, metadata update and isolation');host.remove();
 }
 const ve=createVeAnalyzerView();
 const mix=[...channels,{id:'gas',sourceName:'afrGasolineScale',displayName:'Gas Scale AFR',unit:'AFR',valueType:'number'},{id:'lambda',sourceName:'lambdaValue',displayName:'Lambda',unit:'lambda',valueType:'number'},{id:'bad',sourceName:'afrError',displayName:'AFR error',unit:'%',valueType:'number'}];
 ve.setContext({...context,channels:mix});await settle();
 const actual=ve.element.querySelector('select[data-role="actual"]');
 assert(actual.value==='gas' && actual.querySelector('option[value="bad"]').disabled && actual.querySelector('option[value="lambda"]').disabled,'VE AFR default/eligibility changed');
 actual.value='afr';actual.dispatchEvent(new Event('change',{bubbles:true}));await settle();assert(actual.value==='afr','VE overwrote eligible manual mapping');
 const scale=ve.element.querySelector('select[data-role="mixture-scale"]');scale.value='lambda';scale.dispatchEvent(new Event('change',{bubbles:true}));await settle();
 assert(actual.value==='lambda' && actual.querySelector('option[value="afr"]').disabled,'VE scale transition failed');
 const empty=createVeAnalyzerView();empty.setContext({...context,channels:[mix.at(-1)]});await settle();assert(empty.element.querySelector('select[data-role="actual"]').value==='','VE selected an ineligible-only source');
 const model=normalizeMsqTune(parseMsq('<msq><page><constant name="veRpmBins" rows="1" cols="2">1000 2000</constant><constant name="veLoadBins" rows="2" cols="1">50 100</constant><constant name="afrRpmBins" rows="1" cols="2">1000 2000</constant><constant name="afrLoadBins" rows="2" cols="1">50 100</constant><constant name="veTable" rows="2" cols="2">70 70 70 70</constant><constant name="afrTable" rows="2" cols="2" units="lambda">1 1 1 1</constant></page></msq>'));
 const inferred=createVeAnalyzerView();inferred.setContext({...context,channels:mix});inferred.setTuneModel(model,'lambda.msq');await settle();assert(inferred.element.querySelector('select[data-role="mixture-scale"]').value==='lambda' && inferred.element.querySelector('select[data-role="actual"]').value==='lambda','Tune-inferred Lambda selection failed');
 passed.push('VE owns defaults, manual overrides, scale/tune eligibility and empty fallback');
 const original=loadHistogramCalculatedFields();
 try {
  saveHistogramCalculatedFields([{id:'ownership-check',name:'Ratio',expression:'[RPM]',unit:'ratio'}]);
  const table=createHistogramTableGeneratorView();table.setContext(context);await settle();
  const option=table.element.querySelector('option[value="formula:ownership-check"]');assert(option?.textContent==='Ratio [ratio]','Calculated option label missing');option.parentElement.value=option.value;
  saveHistogramCalculatedFields([{id:'ownership-check',name:'Renamed ratio',expression:'[RPM]',unit:'%'}]);window.dispatchEvent(new Event('epicscope-histogram-calculated-fields-changed'));await settle();
  const renamed=table.element.querySelector('option[value="formula:ownership-check"]');assert(renamed?.textContent==='Renamed ratio [%]' && renamed.parentElement.value===renamed.value,'Calculated rename/unit update lost label or selection');
  passed.push('calculated-channel labels update locally on rename/unit changes and retain IDs');
 } finally {saveHistogramCalculatedFields(original);}
 return {passed:passed.length,checks:passed};
}
