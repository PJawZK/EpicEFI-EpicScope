import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
import { veDelayEditOwner } from '../../apps/web/src/pages/ve-analyzer-delay-edit-owner';
const assert = (ok, message) => { if (!ok) throw Error(message); };
const near = (a, b, message) => assert(Math.abs(a - b) < 1e-8, `${message}: ${a} != ${b}`);
const settle = async () => { await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0)); };
const definitions = [
  ['rpm', 'RPM', 'rpm', () => 1500], ['map', 'MAP', 'kPa', () => 75], ['afr', 'AFR', 'AFR', i => i < 40 ? 21 : 14], ['pw', 'PW', 'ms', () => 4],
  ['flag', 'DFCO', '', i => i < 40 ? 1 : 0], ['clt', 'CLT', 'C', i => i < 40 ? 30 : 90], ['tps', 'TPS', '%', i => i < 40 ? 0 : 20],
  ['trim', 'stftCorrection1', '%', () => 10], ['unknownTrim', 'unknown', '%', () => 10], ['other', 'context', '%', () => 999],
  ['rpm2', 'RPM alternate', 'rpm', () => 2000], ['map2', 'MAP alternate', 'kPa', () => 100], ['afr2', 'AFR alternate', 'AFR', () => 14],
];
const channels = definitions.map(([id, sourceName, unit]) => ({ id, sourceName, displayName: sourceName, unit, valueType: 'number' }));
const traces = channels.map((channel, index) => ({ channel, complete: true, color: '#fff', range: { startSampleIndex: 0, timeMs: Float64Array.from({ length: 60 }, (_, i) => i * 100), values: Float64Array.from({ length: 60 }, (_, i) => definitions[index][3](i)), validity: new Uint8Array(60).fill(1) } }));
export async function runVeSettingsEffectsChecks() {
  const checks = [], s = await setupVeLifecycleFixture(undefined, { channels, traces }); s.root.hidden = false;
  const field = key => s.root.querySelector(`[data-role="${key}"], [data-ve-quick="${key}"]`);
  const change = (key, value) => { const control = field(key); assert(control, `Missing setting ${key}`); if (control.value !== String(value)) { control.value = String(value); control.dispatchEvent(new Event('change', { bubbles: true })); } };
  const run = async () => { s.run(); const end = performance.now() + 10000; while (!s.view.getPrimaryAnalysis() || s.view.getReadiness().pending) { assert(performance.now() < end, 'Settings fixture analysis failed: ' + JSON.stringify(s.view.getReadiness())); await settle(); } return s.view.getPrimaryAnalysis(); };
  const reset = () => {
    for (const [key, value] of Object.entries({ preset: 'recommended', rpm: 'rpm', load: 'map', actual: 'afr', dfco: '', fuelCutReason: '', aeActive: '', decelActive: '', stft: '', 'fuel-correction-mode': 'off', 'min-clt': '', 'min-tps': '', 'max-tps': '', 'clt-source': 'clt', 'tps-source': 'tps', 'min-rpm': 500, 'max-rpm': 8500, 'min-load': '', 'max-load': '', 'stable-ms': 0, 'cell-change': 'custom', 'prior-weight': 0, 'min-evidence-weight': 0, 'max-absolute-change': 1000, 'max-percent-change': 1000, scope: 'full' })) change(key, value);
  };
  const check = async (name, edit, verify) => {
    reset(); await run(); const reads = s.reads(); edit();
    assert(!s.view.getPrimaryAnalysis() && s.reads() === reads, `${name}: change did not invalidate or started automatic calculation`);
    const primary = await run(); verify(primary); checks.push(name);
  };
  try {
    reset(); const baseline = await run(); near(baseline.proposal.cells[0].proposedValue, 105, 'Independent baseline70×21/14');
    assert(baseline.evidence.contributingSampleCount === 59, '100ms delay reference must withhold the first observation');
    assert(field('preset').options.length === 2 && [...field('preset').options].every(o => o.textContent.includes('State exclusions')), 'Analysis Mode still advertises nonfunctional threshold presets');
    checks.push('Mode exposes only actual state-exclusion choices; baseline numerical reference agrees');
    for (const role of ['dfco', 'fuelCutReason', 'aeActive', 'decelActive']) {
      await check(`${role} mapping excludes flagged samples and changes proposal`, () => change(role, 'flag'), p => { assert(p.stateExcludedCount === 40 && p.evidence.contributingSampleCount === 20, 'State flags not consumed'); near(p.proposal.cells[0].proposedValue, 70, 'Unflagged actual equals target'); });
    }
    reset(); change('dfco', 'flag'); await run(); change('preset', 'custom');
    let p = await run(); assert(p.stateExcludedCount === 0 && p.evidence.contributingSampleCount === 59, 'Disabled exclusions still filtering'); near(p.proposal.cells[0].proposedValue, 105, 'State toggle must expose flagged lean evidence');
    change('min-clt', 70); p = await run(); assert(p.evidence.contributingSampleCount > 0 && p.evidence.contributingSampleCount < 59, 'State toggle bypassed independent CLT filter'); near(p.proposal.cells[0].proposedValue, 70, 'CLT must select hot/on-target evidence');
    checks.push('Disabling state exclusions changes output while independent CLT qualification stays active');
    await check('Removing a state mapping restores otherwise eligible observations', () => { change('dfco', 'flag'); change('dfco', ''); }, p => assert(p.stateExcludedCount === 0 && p.evidence.contributingSampleCount === 59, 'Unmapped state still filters'));
    await check('Min CLT uses the selected temperature trace', () => change('min-clt', 70), p => { assert(p.evidence.contributingSampleCount < 59, 'CLT ignored'); near(p.proposal.cells[0].proposedValue, 70, 'CLT selection'); });
    await check('Min TPS filters closed-throttle lean samples', () => change('min-tps', 10), p => { assert(p.evidence.contributingSampleCount < 59, 'Min TPS ignored'); near(p.proposal.cells[0].proposedValue, 70, 'TPS selection'); });
    await check('Max TPS filters higher-throttle samples', () => change('max-tps', 10), p => { assert(p.evidence.contributingSampleCount === 39, 'Max TPS ignored'); near(p.proposal.cells[0].proposedValue, 105, 'Max TPS retains lean evidence'); });
    await check('Enabled CLT threshold with no source fails closed', () => { change('min-clt', 70); change('clt-source', ''); }, p => assert(p.evidence.contributingSampleCount === 0, 'Missing CLT source silently disabled threshold'));
    for (const [key, value] of [['min-rpm', 1600], ['max-rpm', 1400], ['min-load', 80], ['max-load', 70]]) {
      await check(`${key} reaches physical range qualification`, () => change(key, value), p => assert(p.evidence.rangeRejectedSampleCount > 0 && p.evidence.contributingSampleCount === 0, `${key} ignored`));
    }
    await check('Stable/recovery duration changes eligible evidence', () => change('stable-ms', 10000), p => assert(p.evidence.contributingSampleCount === 0 && p.evidence.transientRejectedSampleCount > 0, 'Stability duration ignored'));
    await check('Custom prior weight shrinks proposals toward source', () => change('prior-weight', 20), p => assert(p.proposal.cells[0].proposedValue > 70 && p.proposal.cells[0].proposedValue < 105, 'Prior ignored'));
    let previous = 106;
    for (const mode of ['responsive', 'normal', 'conservative', 'very-conservative']) {
      await check(`Cell Change ${mode} applies its numeric prior`, () => {
        const revision = s.view.sessionRevision; change('cell-change', mode);
        assert(s.view.sessionRevision === revision + 1, 'Cell Change cascaded through duplicate invalidation');
      }, p => { const value = p.proposal.cells[0].proposedValue; assert(value > 70 && value < previous, 'Cell Change priors not increasingly conservative'); previous = value; });
    }
    await check('Minimum evidence weight withholds weak nodes', () => change('min-evidence-weight', 1000), p => assert(p.proposal.weakCellCount === 4 && p.proposal.measuredCellCount === 0, 'Minimum weight ignored'));
    for (const key of ['max-absolute-change', 'max-percent-change']) await check(`${key} withholds raw candidates before prior blend`, () => change(key, 1), p => assert(p.proposal.withheldCellCount === 4 && p.proposal.measuredCellCount === 0, `${key} ignored`));
    await check('Actual-mixture mapping changes numerical correction', () => change('actual', 'afr2'), p => near(p.proposal.cells[0].proposedValue, 70, 'Actual mapping ignored'));
    for (const [key, id] of [['rpm', 'rpm2'], ['load', 'map2']]) await check(`${key} mapping changes node evidence geometry`, () => change(key, id), p => assert(p.evidence.cells[0].totalWeight === 0 && p.evidence.contributingSampleCount === 59, `${key} mapping ignored`));
    for (const [mode, id, expected] of [['auto', 'trim', 115.5], ['off', 'trim', 105], ['percent', 'unknownTrim', 115.5], ['auto', 'unknownTrim', 105]]) {
      await check(`Fuel correction ${mode}/${id} respects semantic authority`, () => { change('stft', id); change('fuel-correction-mode', mode); }, p => near(p.proposal.cells[0].proposedValue, expected, 'Fuel correction contract'));
    }
    for (const role of ['target', 've', 'totalCorrection', 'ltft']) {
      await check(`${role} is explicitly context-only and cannot silently alter VE`, () => change(role, 'other'), p => near(p.proposal.cells[0].proposedValue, 105, 'Context-only mapping entered numerical authority'));
    }
    reset(); change('mixture-scale', 'lambda'); assert(s.view.getReadiness().ready === false && s.root.querySelector('.ve-workbench-run').disabled, 'AFR target accepted as Lambda without conversion'); change('mixture-scale', 'afr');
    checks.push('Mixture-scale mismatch blocks a run rather than fabricating conversion');
    reset(); await run(); const held = s.hold(); s.run(); await settle(); change('min-rpm', 1600); held.resolve(traces); await settle();
    assert(!s.view.getPrimaryAnalysis() && !s.view.getReadiness().pending, 'Superseded settings run published stale evidence');
    checks.push('Setting changes reject an already pending async completion');
    assert(s.model.byName.get('veTable').numericValues.every(v => v === 70), 'Settings changed original tune');
    assert(traces.every(trace => trace.range.validity.every(value => value === 1)), 'Qualification mutated cached source validity');
  } finally { s.view.dispose(); s.host.remove(); }

  const discoveryTraces = traces.slice(0, 4).map((trace, index) => ({ ...trace, range: { ...trace.range, values: Float64Array.from({ length: 60 }, (_, i) => index === 0 ? 1000 : index === 1 ? 50 : index === 2 ? i < 12 ? 15 : i < 32 ? 14 : 13 : i < 10 ? 4 : i < 30 ? 5 : 6) } }));
  const d = await setupVeLifecycleFixture(undefined, { channels: channels.slice(0, 4), traces: discoveryTraces });
  try {
    d.view.setTuneModel({ ...d.model }, 'discovery.msq');
    const settings = { 'delay-command-threshold': 0.2, 'delay-response-threshold': 0.2, 'delay-search-window': 1200, 'delay-event-spacing': 250, 'delay-min-events': 2 };
    const field = key => d.root.querySelector(`[data-role="${key}"]`);
    const set = (key, value) => { field(key).value = String(value); field(key).dispatchEvent(new Event('change', { bubbles: true })); };
    const grab = async () => { d.root.querySelector('[data-ve-analyzer="grab-delay"]').click(); await settle(); return veDelayEditOwner(d.root).snapshot(); };
    for (const [key, rejectedValue] of [['delay-command-threshold', 10], ['delay-response-threshold', 10], ['delay-search-window', 100], ['delay-event-spacing', 5000], ['delay-min-events', 3]]) {
      for (const [role, value] of Object.entries(settings)) set(role, value);
      const accepted = await grab(); assert(accepted?.values[0] === 200, 'Discovery reference: two isolated200ms responses must produce measured delay');
      set(key, rejectedValue); const rejected = await grab();
      assert(!rejected || rejected.values.every(value => value === undefined), `${key} did not affect accepted discovery events`);
      checks.push(`${key} changes discovery eligibility at its existing owner`);
    }
  } finally { d.view.dispose(); d.host.remove(); }
  return { passed: checks.length, checks };
}
