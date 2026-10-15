// Browser regression module: with Vite running, import this file through its /@fs/ URL
// in Chromium and await runVeAnalyzerLifecycleChecks(). No DOM emulator is used.
import { createVeAnalyzerView } from '../../apps/web/src/pages/ve-analyzer-view';
import { createVeAnalyzerView as createOwner } from '../../apps/web/src/pages/ve-analyzer-view-v2';
import { parseMsq } from '../../core/parsers/msq/msq-parser';
import { normalizeMsqTune } from '../../core/tune/tune-model';
import { serializeVeDelayTable } from '../../core/analysis/ve-delay-table-storage';
import { updateVeActualMixtureOptions } from '../../apps/web/src/pages/analyzer-channel-roles';

const tune = () => normalizeMsqTune(parseMsq(`<msq><page>
<constant name="veRpmBins" rows="1" cols="2">1000 2000</constant>
<constant name="veLoadBins" rows="2" cols="1">50 100</constant>
<constant name="afrRpmBins" rows="1" cols="2">1000 2000</constant>
<constant name="afrLoadBins" rows="2" cols="1">50 100</constant>
<constant name="veTable" rows="2" cols="2" units="%">70 70 70 70</constant>
<constant name="afrTable" rows="2" cols="2" units="AFR">14 14 14 14</constant>
</page></msq>`));
const channels = [
  ['rpm', 'RPM', 'rpm'], ['map', 'MAP', 'kPa'], ['afr', 'AFR', 'AFR'], ['pw', 'PW', 'ms'],
].map(([id, sourceName, unit]) => ({ id, sourceName, displayName: sourceName, unit, valueType: 'number' }));
const traces = channels.map((channel, index) => ({
  channel, complete: true, color: '#58aef6', range: {
    startSampleIndex: 0, timeMs: Float64Array.from({ length: 60 }, (_, i) => i * 100),
    values: new Float64Array(60).fill([1000, 50, 15, 4][index]), validity: new Uint8Array(60).fill(1),
  },
}));
function delayFile(value = 100) {
  return serializeVeDelayTable({
    rpmBins: [1000, 2000], loadBins: [50, 100], rows: 2, cols: 2, origin: 'saved-file',
    cells: Array.from({ length: 4 }, (_, i) => ({
      row: Math.floor(i / 2), col: i % 2, state: 'measured', workingMs: value,
      recommendedMs: value, workingProvenance: 'measured-recommendation',
      eventCount: 5, confidence: 'moderate', sourceEvents: [],
    })),
  });
}
const settle = async () => { await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0)); };
function assert(ok, message) { if (!ok) throw new Error(message); }
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function change(root, role, value) {
  const control = root.querySelector(`select[data-role="${role}"]`);
  assert(control, `Missing ${role}`); control.value = value;
  control.dispatchEvent(new Event('change', { bubbles: true }));
}
function loadFile(root, text) {
  const input = root.querySelector('[data-ve-analyzer="load-delay-file"]');
  Object.defineProperty(input, 'files', { configurable: true, value: [{ name: 'delays.json', text }] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
async function setup(factory = createVeAnalyzerView, fixture = {}) {
  let gate;
  let loadCount = 0;
  const model = tune();
  const context = {
    source: { identity: {}, sampleCount: fixture.sampleCount ?? 60, revision: 0 }, channels: fixture.channels ?? channels, traces: [],
    loadTraces: async (ids) => { loadCount += 1; return gate ? gate.promise : (fixture.traces ?? traces).filter((trace) => ids.includes(trace.channel.id)); },
    aTimeMs: 0, bTimeMs: 3000, savedRanges: [{ label: 'saved', startMs: 0, endMs: 2000 }],
  };
  const view = factory();
  const host = document.createElement('section'); host.className = 'analyzer-page';
  host.append(view.element); document.body.append(host);
  view.setContext(context); view.setTuneModel(model, 'test.msq');
  change(view.element, 'rpm', 'rpm'); change(view.element, 'load', 'map');
  change(view.element, 'actual', 'afr'); change(view.element, 'fuelCommand', 'pw');
  loadFile(view.element, () => Promise.resolve(delayFile())); await settle();
  const run = () => view.element.querySelector('.ve-workbench-run').click();
  assert(!view.element.querySelector('.ve-workbench-run').disabled, 'Fixture must be ready to run');
  return { view, root: view.element, host, context, model, run, reads: () => loadCount, hold: () => { gate = deferred(); return gate; } };
}
function summary(root) { return root.querySelector('[data-ve-analyzer="summary"]').textContent; }
function measured(root) { return [...root.querySelectorAll('[data-ve-analyzer="ve-table-view"] td')].find((cell) => cell.title.startsWith('Measured proposal')); }


const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate) { const end = performance.now() + 30000; while (!predicate()) { if (performance.now() > end) throw Error('Timed out waiting for VE job'); await pause(0); } }
const phase = s => s.root.querySelector('[data-ve-analyzer="stage"]').textContent;
const cancel = s => s.root.querySelector('[data-ve-analyzer="cancel-analysis"]');
const count = 320459;
const largeTraces = channels.map((channel, index) => ({ channel, complete: true, color: '#58aef6', range: {
  startSampleIndex: 0, timeMs: Float64Array.from({length: count},(_,i)=>i*100),
  values: Float64Array.from({length: count},(_,i)=>index===2?14+(i%37)/100:[1000,50,15,4][index]), validity: new Uint8Array(count).fill(1),
}}));
const large = () => setup(createVeAnalyzerView, { traces: largeTraces, sampleCount: count });
export async function runVeAnalysisBatchingChecks() {
 const passed=[];const check=async(name,run)=>{const start=performance.now();await run();passed.push({name,ms:performance.now()-start});};
 await check('large cached run reports progress and permits browser tasks/painting before publishing authority',async()=>{
  const s=await large();let ticks=0,frames=0,active=true;const gaps=[];let last=performance.now();
  const timer=setInterval(()=>{const now=performance.now();gaps.push(now-last);last=now;ticks++;},10);
  const paint=()=>{if(active){frames++;requestAnimationFrame(paint);}};requestAnimationFrame(paint);
  try {
   s.run();assert(!cancel(s).hidden&&s.root.querySelector('.ve-workbench-run').disabled,'Missing pending controls');
   await until(()=>/Aligning|Matching|Accumulating|Sorting|Estimating|Qualifying/.test(phase(s)));
   assert(!s.view.getPrimaryAnalysis(),'Partial result exposed');
   const resultView=s.root.querySelector('select[aria-label="VE Analyzer result view"]');resultView.value='weight';resultView.dispatchEvent(new Event('change',{bubbles:true}));
   await until(()=>!!s.view.getPrimaryAnalysis());
   assert(ticks>5&&frames>1,'Calculation prevented tasks/painting');
   assert(s.view.getPrimaryAnalysis().evidence.contributingSampleCount>320000,'Large evidence missing');
   assert(cancel(s).hidden&&!s.root.querySelector('.ve-workbench-run').disabled,'Pending controls not reset');
   passed.push({heartbeatTicks:ticks,animationFrames:frames,maxHeartbeatGapMs:gaps.reduce((max, gap) => Math.max(max, gap), 0)});
  } finally {active=false;clearInterval(timer);s.view.setActive(false);s.host.remove();}
 });
 for(const latePhase of ['Aligning mixture delay','Sorting weighted evidence'])await check(`Cancel during ${latePhase} stops computation and permits a new run`,async()=>{
  const s=await large();s.run();await until(()=>phase(s).startsWith(latePhase));
  assert(!cancel(s).hidden&&!s.view.getPrimaryAnalysis(),'Job completed before cancellation');cancel(s).click();const text=phase(s);
  assert(text.includes('cancelled')&&cancel(s).hidden&&!s.root.querySelector('.ve-workbench-run').disabled,'Cancellation state wrong');
  await pause(50);assert(!s.view.getPrimaryAnalysis()&&phase(s)===text,'Cancelled job published or rewrote progress');
  s.run();await until(()=>!!s.view.getPrimaryAnalysis());const primary=s.view.getPrimaryAnalysis();await pause(30);assert(s.view.getPrimaryAnalysis()===primary,'Old job overwrote new authority');s.view.setActive(false);s.host.remove();
 });
 await check('leaving during CPU work rejects completion and preserves the working delay on return',async()=>{
  const s=await large();s.run();await until(()=>phase(s).startsWith('Accumulating cell evidence'));
  s.view.setActive(false);const html=s.root.innerHTML;await pause(50);assert(s.root.innerHTML===html&&!s.view.getPrimaryAnalysis(),'Inactive CPU job changed DOM/authority');s.view.setActive(true);assert(phase(s).includes('cancelled'),'Missing return guidance');
  assert(!s.root.querySelector('[data-ve-analyzer="save-delay"]').disabled,'Cancellation lost working delay');assert(!s.root.querySelector('.ve-workbench-run').disabled,'Cancelled return left Run disabled');s.run();await until(()=>!!s.view.getPrimaryAnalysis());s.view.setActive(false);s.host.remove();
 });
 await check('real settings change cancels an active sort; unchanged context preserves a pending job',async()=>{
  const s=await large();const authority=s.root.querySelector('[data-ve-quick="cell-change"]');authority.value='custom';authority.dispatchEvent(new Event('change',{bubbles:true}));s.run();await until(()=>phase(s).startsWith('Sorting weighted evidence'));
  const prior=s.root.querySelector('[data-role="prior-weight"]');prior.value='50';prior.dispatchEvent(new Event('change',{bubbles:true}));const text=phase(s);
  await pause(50);assert(!s.view.getPrimaryAnalysis()&&phase(s)===text&&cancel(s).hidden,'Semantic invalidation accepted old completion');
  s.run();await until(()=>phase(s).startsWith('Aligning mixture delay'));s.view.setContext({...s.context});
  await until(()=>!!s.view.getPrimaryAnalysis());assert(summary(s.root).includes('Prior weight50'),'Current settings missing');s.view.setActive(false);s.host.remove();
 });
 const checks=passed.filter(p=>p.name);return {passed:checks.length,checks,metrics:passed.filter(p=>!p.name)};
}
