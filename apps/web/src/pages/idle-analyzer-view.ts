import { summarizeIdlePurposes } from '../../../../core/analysis/idle-region-purpose';
import '../styles/idle-analyzer.css';
import type { LoggerAnalysisContext, LoggerAnalysisTraceContext } from './logger-page';
import { analyzerScopeOptions, analyzerScopeBounds, retainedAnalyzerScopeValue } from './analyzer-scope';
import { analyzerChannelOptionLabel, suggestAnalyzerChannel, idleRoleUnit, idleQualificationRoleUnit } from './analyzer-channel-roles';
import { sameChannelOptionCatalog } from './channel-option-label';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import { analyzeIdleStability, type IdleStabilityResult } from '../../../../core/analysis/idle-stability';
import { discoverIdleCandidates, type IdleCandidateOptions, type IdleRegionBounds } from '../../../../core/analysis/idle-regions';
import { createIdleRegionSession } from './idle-region-session';
import { createIdleRegionManager, type IdleRegionAction } from './idle-region-manager';
import { sliceNumericRangeByTime } from '../../../../core/timeline/viewport-series';
import { assessIdleStability } from '../../../../core/analysis/idle-stability-assessment';
import { presentIdleStabilityAssessment } from './idle-stability-assessment';
import { buildIdleQualificationPlan, type IdleQualificationSettings, type IdleQualificationRole } from './idle-qualification-plan';
import { qualifyIdleSamples, type IdleQualificationResult } from '../../../../core/analysis/idle-qualification';
import { createIdleStabilityPlot, type IdlePlotSeries } from './idle-stability-plot';
import { installAnalyzerRangeInteraction } from './analyzer-range-interaction';
import { createOwnerEvidence } from '../observability/producers/owner';
import type { ObservabilityRecorder } from '../observability/recorder';

type Tab = 'diagnosis' | 'evidence' | 'next';
const EMPTY_CONTEXT: LoggerAnalysisContext = { channels: [], traces: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };
const number = (value: number | undefined, decimals = 2) => value === undefined || !Number.isFinite(value) ? 'Unavailable' : value.toFixed(decimals);
const CONTEXT_ROLES = ['basePosition', 'closedLoop', 'finalPosition'] as const;
type ContextRole = typeof CONTEXT_ROLES[number];
const CONTEXT_LABELS = { basePosition: 'Base request', closedLoop: 'Applied correction', finalPosition: 'Final request' };

/** Native first slice. The session owns selection/results; Logger owns recorded bytes and source loading. */
export function createIdleAnalyzerView(observability?: ObservabilityRecorder) {
  const owner = createOwnerEvidence(observability, 'idle-analyzer-view');
  const events = new AbortController();
  let context = EMPTY_CONTEXT;
  let pendingContext: LoggerAnalysisContext | undefined;
  let active = false;
  let disposed = false;
  let generation = 0;
  let pendingKey: string | undefined;
  let pendingSource: object | undefined;
  let accepted: { source: object; key: string; result: IdleStabilityResult; qualification: (IdleQualificationResult & { description: string }) | undefined; evidenceKey: string; rpm: LoggerAnalysisTraceContext; target: LoggerAnalysisTraceContext | undefined; traces: readonly LoggerAnalysisTraceContext[] } | undefined;
  const regionSession = createIdleRegionSession();
  let focusId = 'overview';
  let regionEvidence: { source: object; key: string; traces: readonly LoggerAnalysisTraceContext[] } | undefined;
  let renderedPlot: { traces: readonly LoggerAnalysisTraceContext[]; key: string } | undefined;
  let rpmId = '';
  let targetId = '';
  let contextIds: Record<ContextRole, string> = { basePosition: '', closedLoop: '', finalPosition: '' };
  let qualificationIds: Record<IdleQualificationRole,string> = {coolant:'',pedal:'',physicalTps:''};
  const qualificationRoles = ['coolant','pedal','physicalTps'] as const;
  let committingRange = false;
  let scopeValue = 'full';
  let manualId: string | undefined;
  let discoveryGeneration = 0;
  let discovery: { source: object; key: string; result: ReturnType<typeof discoverIdleCandidates> } | undefined;
  let discoveryPending = false;
  let tab: Tab = 'diagnosis';
  const root = document.createElement('section');
  root.className = 'idle-analyzer-view';
  root.hidden = true;
  root.innerHTML = `
    <div class="idle-toolbar"><label>Mode <select aria-label="Idle diagnostic mode" data-idle="mode"><option>Stability</option>
      <option disabled>Base Airflow — not integrated</option><option disabled>RPM PID — not integrated</option><option disabled>DC Valve Tracking — not integrated</option>
      <option disabled>DC Bias / Position PID — not integrated</option><option disabled>Ignition — not integrated</option><option disabled>Load Recovery — not integrated</option><option disabled>Compare — not integrated</option></select></label>
      <label>Analysis scope <select data-idle="scope" aria-label="Idle analysis scope"></select></label>
      <label data-idle="focus-control" hidden>Graph focus <select data-idle="focus" aria-label="Viewed Idle region"></select></label><span class="idle-toolbar-spacer"></span><button type="button" data-idle="manage-regions">Manage regions</button><button type="button" data-idle="qualification-settings">Qualification</button><button type="button" data-idle="settings">Channels / region</button><button type="button" data-idle="logger">↗ Logger</button></div>
    <div class="idle-discovery-feedback" data-idle="discovery-feedback" hidden role="status" aria-live="polite"><span data-idle="discovery-message"></span><button type="button" data-idle="review-candidates" hidden>Review candidates</button></div>
    <div class="idle-workspace"><div class="idle-main"><div class="idle-analysis-authority"><strong data-idle="metrics-scope">Metrics: Full Log</strong><span data-idle="scope-application"></span><button type="button" data-idle="apply-included" hidden>Analyze included regions</button></div><p class="idle-qualification-state" data-idle="qualification-state">Qualification off</p><div class="idle-metrics" aria-label="Stability measurements">
      <div><strong data-idle="sigma">—</strong><span>RPM σ · sample</span></div><div><strong data-idle="rmse">—</strong><span>RPM error RMSE</span></div>
      <div><strong data-idle="in-band">—</strong><span>Within ±40 RPM</span></div><div><strong data-idle="samples">—</strong><span>Valid RPM samples</span></div></div>
      <p class="idle-focus-explanation" data-idle="focus-explanation" hidden></p><div data-idle="plot"></div><div class="idle-plot-tools"><span>Wheel zoom · drag pan · Shift-drag zoom · hover for recorded values</span>
      <button type="button" data-idle="zoom-in" aria-label="Zoom Idle graph in">+</button><button type="button" data-idle="zoom-out" aria-label="Zoom Idle graph out">−</button><button type="button" data-idle="fit">Fit region</button></div>
      <section class="idle-region-evidence"><strong>Recorded operating window</strong><button type="button" data-idle="region-focus"><span data-idle="region-label">Select a region</span><span data-idle="region-evidence">No accepted analysis.</span></button></section></div>
      <aside class="idle-assessment"><header><strong>Diagnostic assessment</strong><span data-idle="status" role="status" aria-live="polite">Load a recording.</span></header>
        <nav aria-label="Idle assessment"><button type="button" data-idle-tab="diagnosis">Diagnosis</button><button type="button" data-idle-tab="evidence">Evidence</button><button type="button" data-idle-tab="next">Next Test</button></nav>
        <div data-idle="assessment"></div></aside></div>
    <section class="idle-timeline" aria-label="Idle recorded-source timeline"><div class="idle-timeline-meta"><strong>Log timeline</strong><span data-idle="timeline-bounds">Source unavailable</span></div>
      <div data-idle="range-track" class="idle-range-track" aria-label="Select Idle analysis range" title="Drag to select a Logger A/B range; drag handles or band to adjust. Shift-drag replaces the range.">
        <span data-idle="region-markers" class="idle-region-markers"></span><span data-idle="scope-band" class="idle-range-band"></span><span data-idle="edit-band" class="idle-range-band idle-range-edit" hidden></span>
        <span data-idle="range-a" class="idle-range-handle" role="slider" aria-label="Idle range start A in milliseconds" tabindex="0" hidden></span>
        <span data-idle="range-b" class="idle-range-handle" role="slider" aria-label="Idle range end B in milliseconds" tabindex="0" hidden></span></div></section>
    <div class="idle-region-key" data-idle="region-key" hidden>Included · green / Excluded · gray / Viewed · blue outline. View does not change analysis. Shift-drag selects Logger A/B. ↗ Logger opens the viewed interval.</div><div class="idle-actionbar"><label>Auto-detect ≤ <input type="number" min="1" step="50" value="1200" data-idle="candidate-rpm" aria-label="Candidate maximum RPM"> RPM</label><label>Min <input type="number" min="0.1" step="1" value="8" data-idle="candidate-duration" aria-label="Candidate minimum duration in seconds"> s</label>
      <button type="button" data-idle="discover">Find candidates</button><select data-idle="candidates" aria-label="Review RPM candidate region" disabled><option value="">No discovered candidates</option></select>
      <span data-idle="scope-note">RPM-only candidates require review; not automatically idle-qualified.</span><span class="idle-readonly">Read only</span><button type="button" data-idle="run">▶ Run Analysis</button></div>
    <details class="idle-qualification" data-idle="qualification-setup"><summary>Recorded qualification conditions</summary><div class="idle-qualification-body">
      <label><input type="checkbox" data-idle="qual-enabled"> Apply selected conditions to discovery and analysis</label>
      <label><input type="checkbox" data-idle="qual-warm" checked> Require coolant ≥</label><input type="number" data-idle="qual-temperature" aria-label="Minimum coolant °C" value="70" step="any"> °C
      <label>Coolant <select data-idle="qual-coolant" aria-label="Qualification coolant channel"></select></label>
      <label><input type="checkbox" data-idle="qual-closed"> Require closed-input condition</label>
      <select data-idle="qual-input" aria-label="Closed-input meaning"><option value="pedal">Driver pedal position (released reference)</option><option value="physicalTps">Physical TPS position limit only</option></select>
      <input type="number" min="0" max="100" step="any" value="3" data-idle="qual-percent" aria-label="Closed-input maximum percent"> %
      <label>Pedal <select data-idle="qual-pedal" aria-label="Qualification driver pedal channel"></select></label><label>Physical TPS <select data-idle="qual-physicalTps" aria-label="Qualification physical TPS channel"></select></label>
      <label><input type="checkbox" data-idle="qual-bypass"> Manual/edited-bounds regions bypass conditions</label>
      <p>Enabled conditions include the RPM ceiling shown below. Defaults are references, not firmware limits. Physical TPS never proves pedal intent. Discovery never bypasses conditions. Minimum duration affects discovery only. Renaming never enables bypass. Bypass never bypasses source validity; Full Log and Logger scopes still use conditions. Graphs retain recorded samples, including excluded measurements. Firmware idle-controller and stationary/load state are not established.</p>
    </div></details>
    <details class="idle-setup" data-idle="setup"><summary>Channels and manual region</summary><div class="idle-setup-body">
      <span data-idle="source">Load a recorded MLG through Open Log.</span><label>RPM <select data-idle="rpm" aria-label="Idle RPM channel"></select></label>
      <label>Idle target <select data-idle="target" aria-label="Idle target channel"></select></label>
      <label>Base request <select data-idle="basePosition" aria-label="Idle base request channel"></select></label>
      <label>Applied correction <select data-idle="closedLoop" aria-label="Idle applied correction channel"></select></label>
      <label>Final request <select data-idle="finalPosition" aria-label="Idle final request channel"></select></label>
      <label>Region start (s)<input type="number" step="any" data-idle="start"></label><label>Region end (s)<input type="number" step="any" data-idle="end"></label>
      <button type="button" data-idle="apply-region">Use manual region</button><p data-idle="mapping-note"></p>
    </div></details>`;
  const field = <T extends HTMLElement = HTMLElement>(name: string) => root.querySelector<T>(`[data-idle="${name}"]`)!;
  const rpmSelect = field<HTMLSelectElement>('rpm');
  const targetSelect = field<HTMLSelectElement>('target');
  const contextSelects = Object.fromEntries(CONTEXT_ROLES.map(role => [role, field<HTMLSelectElement>(role)])) as Record<ContextRole, HTMLSelectElement>;
  const scopeSelect = field<HTMLSelectElement>('scope');
  const startInput = field<HTMLInputElement>('start');
  const endInput = field<HTMLInputElement>('end');
  const runButton = field<HTMLButtonElement>('run');
  const loggerButton = field<HTMLButtonElement>('logger');
  const plot = createIdleStabilityPlot();
  field('plot').append(plot.element);
  const status = (text: string) => { field('status').textContent = text; };
  const qualificationSettings = (): IdleQualificationSettings => ({
    enabled:field<HTMLInputElement>('qual-enabled').checked,requireWarm:field<HTMLInputElement>('qual-warm').checked,
    requireClosed:field<HTMLInputElement>('qual-closed').checked,closedSource:field<HTMLSelectElement>('qual-input').value as 'pedal'|'physicalTps',
    minimumCelsius:field<HTMLInputElement>('qual-temperature').value.trim() ? Number(field<HTMLInputElement>('qual-temperature').value) : NaN,
    maximumPercent:field<HTMLInputElement>('qual-percent').value.trim() ? Number(field<HTMLInputElement>('qual-percent').value) : NaN,
    maximumRpm:field<HTMLInputElement>('candidate-rpm').value.trim() ? Number(field<HTMLInputElement>('candidate-rpm').value) : NaN,
    manualBypass:field<HTMLInputElement>('qual-bypass').checked,ids:{...qualificationIds},
  });
  const qualificationPlan = (discovery = false) => buildIdleQualificationPlan(qualificationSettings(),context.channels,rpmId,{kind:scopeValue,manualId,regions:regionSession.regions},discovery);
  const renderQualificationControls = () => {
    const settings = qualificationSettings();
    for (const name of ['qual-warm','qual-closed','qual-bypass']) field<HTMLInputElement>(name).disabled = !settings.enabled;
    field<HTMLInputElement>('qual-temperature').disabled = !settings.enabled || !settings.requireWarm;
    for (const name of ['qual-input','qual-percent']) field<HTMLInputElement>(name).disabled = !settings.enabled || !settings.requireClosed;
    try { field('qualification-state').textContent = qualificationPlan().description; }
    catch(error) { field('qualification-state').textContent = error instanceof Error ? error.message : 'Qualification unavailable'; }
  };
  const mappingDescription = () => ['rpm', 'target', ...CONTEXT_ROLES].map(role => {
      const id = role === 'rpm' ? rpmId : role === 'target' ? targetId : contextIds[role as ContextRole];
      const channel = context.channels.find(item => item.id === id); const unit = channel && idleRoleUnit(channel, role as 'rpm' | 'target' | ContextRole);
      return `${role}: ${channel ? channel.sourceName + ' [' + unit?.unit + '] · ' + (unit?.authority === 'canonical-role' ? 'canonical role; source unit unspecified' : 'recorded/catalog unit') : 'unavailable'}`;
    }).join('; ');
  const syncMappingNote = () => { field('mapping-note').textContent = mappingDescription(); };
  const manager = createIdleRegionManager(events.signal, action => { if (active && !disposed) manageRegion(action); });
  root.append(manager.element);
  const selectedBounds = (): IdleRegionBounds | undefined => {
    if (scopeValue === 'regions') {
      const included = regionSession.includedBounds();
      return included.length ? { startMs: included[0]!.startMs, endMs: included.at(-1)!.endMs } : context.sourceTimeRange;
    }
    if (scopeValue === 'manual') return regionSession.regions.find(region => region.id === manualId);
    const scope = analyzerScopeOptions(context).find(option => option.value === scopeValue);
    if (!scope) return undefined;
    return scope.kind === 'full' ? context.sourceTimeRange : analyzerScopeBounds(scope) as { startMs: number; endMs: number };
  };
  const displayBounds = () => {
    const region = regionSession.regions.find(region => region.id === focusId);
    if (region) return region;
    if (focusId === 'logger' && context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs) return { startMs: Math.min(context.aTimeMs, context.bTimeMs), endMs: Math.max(context.aTimeMs, context.bTimeMs) };
    return selectedBounds();
  };
  const renderRegionControls = () => {
    const regions = regionSession.regions;
    if (focusId.startsWith('region:') && !regions.some(region => region.id === focusId)) focusId = 'overview';
    const select = field<HTMLSelectElement>('focus');
    select.replaceChildren(new Option('Analysis overview', 'overview'));
    if (context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs) select.add(new Option('Logger A/B', 'logger'));
    if (focusId === 'logger' && ![...select.options].some(option => option.value === 'logger')) focusId = 'overview';
    for (const region of regions) select.add(new Option(`${region.label} · ${region.included ? 'included' : 'excluded'} · ${(region.startMs/1000).toFixed(2)}–${(region.endMs/1000).toFixed(2)} s`, region.id));
    select.value = focusId;
    field('focus-control').hidden = !regions.length; field('region-key').hidden = !regions.length;
    const included = regions.filter(region => region.included).length;
    const scopeLabel = scopeValue === 'regions' ? `Combined included regions (${included})` : scopeValue === 'manual' ? 'Manual region' : analyzerScopeOptions(context).find(option => option.value === scopeValue)?.label ?? 'Unavailable';
    field('metrics-scope').textContent = `Metrics: ${scopeLabel}`;
    field('scope-application').textContent = scopeValue === 'regions' ? 'Overlapping samples count once.' : included ? `${included} checked region${included === 1 ? ' is' : 's are'} not applied to these metrics.` : '';
    field('apply-included').hidden = scopeValue === 'regions' || !included;
    const viewed = regions.find(region => region.id === focusId);
    const explanation = field('focus-explanation'); explanation.hidden = !regions.length && !qualificationSettings().enabled;
    explanation.textContent = viewed ? `Graph focus: ${viewed.label} (${viewed.included ? 'included' : 'excluded'}). Metrics remain ${scopeLabel}.`
      : focusId === 'logger' ? `Graph focus: Logger A/B. Metrics remain ${scopeLabel}.` : scopeValue === 'regions' ? 'Graph overview spans the included intervals and the gaps between them. Gap samples are excluded from the combined metrics.' : `Graph overview: ${scopeLabel}.`;
    if(qualificationSettings().enabled)explanation.textContent+=' Graphs retain recorded measurements, including samples excluded by conditions.';
    manager.update(regions, focusId, context.sourceTimeRange, scopeLabel, scopeValue === 'regions');
  };
  const semanticEvidenceKey = (qualificationChannels: readonly string[] = []) => JSON.stringify([context.source?.revision, context.source?.sampleCount, context.source?.descriptor, context.channels, rpmId, targetId, contextIds, qualificationChannels]);
  const renderPlot = () => {
    if (!active || !accepted) return;
    const bounds = displayBounds(); if (!bounds) return;
    const retained = regionEvidence;
    const traces = regionSession.regions.length && retained && retained.source === context.source?.identity && retained.key === accepted.evidenceKey ? retained.traces : accepted.traces;
    const key = JSON.stringify([bounds, rpmId, targetId, contextIds]);
    if (renderedPlot?.traces === traces && renderedPlot.key === key) return;
    const entries: IdlePlotSeries[] = [];
    for (const [id, label, unit, pane, color] of [[rpmId, 'Engine RPM', 'RPM', 0, '#61b8ed'], [targetId, 'RPM target', 'RPM', 0, '#7bd2b1'], ...CONTEXT_ROLES.map((role, index) => [contextIds[role], CONTEXT_LABELS[role], role === 'closedLoop' ? 'pp' : '%', 1, ['#b29af2', '#e8b46d', '#68ccac'][index]])] as const) {
      const trace = traces.find(trace => trace.channel.id === id); if (!trace) continue;
      entries.push({ label: String(label), range: sliceNumericRangeByTime(trace.range, bounds.startMs, bounds.endMs), unit: String(unit), pane: pane as 0 | 1, color: String(color) });
    }
    plot.setData(entries, bounds.startMs, bounds.endMs); renderedPlot = { traces, key };
  };
  const renderCoverage = () => {
    if (!accepted) return;
    const bounds = selectedBounds(); if (!bounds) return;
    const regions = scopeValue === 'regions' ? regionSession.includedBounds() : undefined;
    const stats = accepted.result.analysis;
    field('region-evidence').textContent = regions && !regions.length ? '0 included regions · No analysis samples. Graph view only.'
      : `${regions ? `${regionSession.regions.filter(region => region.included).length} included regions · ${regions.length} disjoint intervals · overlaps counted once · ` : ''}${(bounds.startMs / 1000).toFixed(3)}–${(bounds.endMs / 1000).toFixed(3)} s · ${stats.rpm.validSampleCount} valid RPM samples · ${stats.tracking?.sampleCount ?? 0} valid target pairs · ${stats.complete ? 'Complete requested coverage' : 'Partial returned coverage'}.`;
  };
  const manageRegion = (action: IdleRegionAction) => {
    try {
      if (context.source?.descriptor?.format !== 'MLG') throw new Error('Load a recorded MLG before managing regions.');
      if (action.type === 'focus') {
        focusId = action.id; renderRegionControls(); renderTimeline(); renderPlot(); return;
      }
      if ((action.type === 'split' || action.type === 'merge') && scopeValue === 'manual' && (manualId === action.id || action.type === 'merge' && manualId === action.targetId)) throw new Error('Choose Analyze included regions before splitting or merging the active single manual scope. Previous regions retained.');
      if (action.type === 'purpose') { regionSession.setPurpose(action.id, action.purpose); renderRegionControls(); renderAssessment(); manager.message('Declared purpose updated. Interpretation changes; recorded measurements, qualification and graph scope are unchanged.'); return; }
      if (action.type === 'add') regionSession.add(action.bounds, action.label, action.purpose);
      if (action.type === 'edit') regionSession.edit(action.id, action.bounds, action.label);
      if (action.type === 'include') regionSession.include(action.id, action.included);
      if (action.type === 'remove') regionSession.remove(action.id);
      if (action.type === 'split') regionSession.split(action.id, action.timeMs);
      if (action.type === 'merge') { const merged = regionSession.merge(action.id, action.targetId); if (focusId === action.targetId) focusId = merged.id; }
      if (action.type === 'analyze') scopeValue = 'regions';
      configure(context); renderPlot(); void analyze(); if (accepted) { renderCoverage(); renderAssessment(); }
      manager.message(action.type === 'analyze' ? 'Included regions selected. Overlapping samples count once.' : action.type === 'split' || action.type === 'merge' ? 'Region partition changed. Included sample union and manual-bypass policy preserved; shared endpoints count once.' : 'Region change accepted. Included scope updates analysis; View changes only graph focus.');
    } catch (error) { manager.message(error instanceof Error ? error.message : 'Region change rejected.'); }
  };
  const showDiscovery = (message: string, review = false) => {
    field('discovery-feedback').hidden = false; field('discovery-message').textContent = message; field('review-candidates').hidden = !review;
  };
  const resetDiscovery = (settingsChanged = false) => {
    discoveryGeneration += 1; discoveryPending = false; discovery = undefined;
    field('discovery-feedback').hidden = true; field('review-candidates').hidden = true;
    if (settingsChanged) showDiscovery('Discovery settings changed. Find candidates to refresh suggestions; existing managed regions are retained.');
    field<HTMLButtonElement>('discover').disabled = false;
    field<HTMLSelectElement>('candidates').replaceChildren(new Option('No discovered candidates', ''));
    field<HTMLSelectElement>('candidates').disabled = true;
    field('scope-note').textContent = 'RPM-only candidates require review; not automatically idle-qualified.';
  };
  const candidateOptions = (): IdleCandidateOptions | undefined => {
    const rpm = field<HTMLInputElement>('candidate-rpm'), duration = field<HTMLInputElement>('candidate-duration');
    const maximumRpm = Number(rpm.value), minimumDurationMs = Number(duration.value) * 1000;
    return rpm.value.trim() && duration.value.trim() && Number.isFinite(maximumRpm) && maximumRpm > 0 && Number.isFinite(minimumDurationMs) && minimumDurationMs > 0
      ? { maximumRpm, minimumDurationMs, maximumGapMs: 250 } : undefined;
  };
  const discoveryKey = (options: IdleCandidateOptions) => {const plan=qualificationPlan(true);return JSON.stringify([context.source?.revision,context.source?.sampleCount,context.channels,rpmId,options,plan.enabled?[plan.conditions,plan.description]:false]);};
  const renderTimeline = () => {
    const extent = context.sourceTimeRange, bounds = selectedBounds();
    const track = field('range-track'), band = field('scope-band'), edit = field('edit-band');
    const usable = context.source?.descriptor?.format === 'MLG' && !!extent && Number.isFinite(extent.startMs) && Number.isFinite(extent.endMs) && extent.endMs > extent.startMs;
    track.setAttribute('aria-disabled', String(!usable || !context.setAnalysisRange));
    field('timeline-bounds').textContent = usable ? `${(extent!.startMs / 1000).toFixed(2)}–${(extent!.endMs / 1000).toFixed(2)} s · ${scopeSelect.selectedOptions[0]?.textContent ?? 'Full Log'}` : 'Source unavailable';
    band.hidden = !usable || !bounds; edit.hidden = true;
    const ab = scopeValue === 'ab' && context.aTimeMs !== undefined && context.bTimeMs !== undefined;
    if (usable && bounds) {
      const span = extent!.endMs - extent!.startMs;
      band.style.left = `${(bounds.startMs - extent!.startMs) / span * 100}%`; band.style.width = `${(bounds.endMs - bounds.startMs) / span * 100}%`; band.dataset.kind = scopeValue === 'full' ? 'full' : scopeValue === 'ab' ? 'ab' : 'saved';
      if (ab) { band.hidden = true; edit.hidden = false; edit.style.left = band.style.left; edit.style.width = band.style.width; }
      for (const [node, value] of [[field('range-a'), bounds.startMs], [field('range-b'), bounds.endMs]] as const) {
        node.hidden = !ab; node.style.left = `${(value - extent!.startMs) / span * 100}%`; node.setAttribute('aria-valuemin', String(extent!.startMs)); node.setAttribute('aria-valuemax', String(extent!.endMs)); node.setAttribute('aria-valuenow', String(value)); node.setAttribute('aria-disabled', track.getAttribute('aria-disabled')!);
      }
    } else { field('range-a').hidden = true; field('range-b').hidden = true; }
    if (scopeValue === 'regions') band.hidden = true;
    const markers = field('region-markers'); markers.replaceChildren();
    if (usable) for (const region of regionSession.regions) {
      const node = document.createElement('button'); node.type = 'button'; node.dataset.regionId = region.id;
      node.className = `idle-region-marker ${region.included ? 'is-included' : 'is-excluded'}${focusId === region.id ? ' is-focused' : ''}`;
      node.style.left = `${(region.startMs - extent!.startMs) / (extent!.endMs - extent!.startMs) * 100}%`;
      node.style.width = `${(region.endMs - region.startMs) / (extent!.endMs - extent!.startMs) * 100}%`;
      node.title = `${region.label} · ${region.included ? 'included' : 'excluded'} · ${(region.startMs/1000).toFixed(2)}–${(region.endMs/1000).toFixed(2)} s · View only`;
      node.setAttribute('aria-label', node.title); markers.append(node);
    }
    if (focusId === 'logger' && usable && context.aTimeMs !== undefined && context.bTimeMs !== undefined) {
      const node = document.createElement('span'); node.className = 'idle-region-marker is-focused';
      node.style.left = `${(Math.min(context.aTimeMs,context.bTimeMs) - extent!.startMs) / (extent!.endMs - extent!.startMs) * 100}%`;
      node.style.width = `${Math.abs(context.bTimeMs-context.aTimeMs) / (extent!.endMs - extent!.startMs) * 100}%`; markers.append(node);
    }
    const viewed = regionSession.regions.find(region => region.id === focusId);
    field('region-label').textContent = `${scopeValue === 'regions' ? `Analysis: ${regionSession.regions.filter(region => region.included).length} included regions` : scopeSelect.selectedOptions[0]?.textContent ?? 'Recorded region'}${viewed ? ` · View: ${viewed.label} (${viewed.included ? 'included' : 'excluded'})` : focusId === 'logger' ? ' · View: Logger A/B' : ''}`;
  };
  const commitRange = (captured: LoggerAnalysisContext, a: number, b: number) => {
    const previous = scopeValue; scopeValue = previous === 'regions' ? 'regions' : 'ab'; committingRange = true;
    let committed = false;
    try { committed = captured.setAnalysisRange?.({ startMs: a, endMs: b }) ?? false; }
    finally { committingRange = false; }
    if (!committed) { scopeValue = previous; status('Logger could not accept this range. Previous region retained.'); }
    if (committed && previous === 'regions') focusId = 'logger';
    configure(context); if (committed) { renderPlot(); void analyze(); }
    return committed;
  };
  const rangeInteraction = installAnalyzerRangeInteraction({
    track: field('range-track'), band: field('edit-band'), start: field('range-a'), end: field('range-b'), signal: events.signal,
    getState: () => active && !disposed && context.source?.descriptor?.format === 'MLG' ? { context, editing: scopeValue === 'ab' } : undefined,
    render: () => { if (active && !disposed) renderTimeline(); },
    commit: commitRange,
  });
  const section = (title: string, text: string) => {
    const element = document.createElement('section');
    const heading = document.createElement('h3'); heading.textContent = title;
    const paragraph = document.createElement('p'); paragraph.textContent = text;
    element.append(heading, paragraph); return element;
  };
  const renderAssessment = () => {
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-idle-tab]')) button.setAttribute('aria-pressed', String(button.dataset.idleTab === tab));
    const panel = field('assessment'); panel.replaceChildren();
    if (!accepted) { panel.append(section('Recorded evidence required', 'Choose an RPM channel and a recorded region, then run analysis. Target-dependent metrics remain unavailable without a compatible target channel.')); return; }
    const { analysis, inBandPercent } = accepted.result;
    const purposes = scopeValue === 'regions' ? regionSession.regions.filter(region => region.included) : scopeValue === 'manual' ? regionSession.regions.filter(region => region.id === manualId) : [];
    const assessment = assessIdleStability(accepted.result, summarizeIdlePurposes(purposes.map(region => region.purpose)));
    const presentation = presentIdleStabilityAssessment(assessment, accepted.qualification);
    panel.append(section('Declared test purpose', presentation.purpose));
    if (accepted.qualification) panel.append(section('Applied qualification', `${accepted.qualification.description}. ${accepted.qualification.eligible}/${accepted.qualification.input} original records eligible; ${accepted.qualification.rejected} value-rejected, ${accepted.qualification.invalid} invalid, ${accepted.qualification.unavailable} unavailable; ${accepted.qualification.manualBypassed} valid records manually bypassed. Invalid counts may include recovered retry attempts and do not by themselves establish physical data loss.`));
    if (scopeValue === 'regions') panel.append(section('Analysis scope', `${regionSession.regions.filter(region => region.included).length} included regions; overlapping recorded samples count once. Graph focus can show an excluded interval and does not affect these measurements.`));
    if (tab === 'diagnosis') {
      panel.append(section('Evidence status', presentation.status), section('Observed behavior', presentation.observed));
      for (const finding of presentation.findings) {
        const item = section(finding.title, finding.text); item.dataset.idleFinding = finding.code; panel.append(item);
      }
      panel.append(section('Limits of inference', presentation.limits), section('Next test', presentation.next));
    }
    else if (tab === 'evidence') panel.append(
      section('Source and channels', `${context.source?.descriptor?.displayName ?? 'Source metadata unavailable'} · RPM: ${accepted.rpm.channel.sourceName} [${idleRoleUnit(accepted.rpm.channel, 'rpm')?.unit ?? 'unavailable'}] · Target: ${accepted.target?.channel.sourceName ?? 'unavailable'}. Original source sample indices are retained.`),
      section('Measurement coverage', `RPM valid ${analysis.rpm.validSampleCount}, invalid ${analysis.rpm.invalidSampleCount}, unavailable ${analysis.rpm.unavailableSampleCount}. Paired RPM/target valid ${analysis.tracking?.sampleCount ?? 0}, invalid ${analysis.tracking?.invalidSampleCount ?? 0}, unavailable ${analysis.tracking?.unavailableSampleCount ?? 0}.`),
      section('Evidence eligibility', `${presentation.status}. Findings: ${presentation.findings.map(finding => finding.title).join('; ') || 'none'}. Warm/closed-throttle idle state: not established. Target range uses ${assessment.facts.validTarget} target-valid samples; paired metrics use ${assessment.facts.paired} aligned valid pairs.`),
      section('Unit authority', mappingDescription()),
      section('Definitions', `σ uses n−1, consistent with production Range Statistics. Error is actual−target RPM. In-band ±40 RPM: ${inBandPercent === undefined ? 'Unavailable' : number(inBandPercent) + '%' }. Each valid pair has equal weight; gaps are not evidence of settled idle.`));
    else panel.append(section('Recommended action', presentation.next), section('Hold constant', presentation.holdConstant), section('What would support it?', presentation.supports), section('What would contradict it?', presentation.contradicts), section('Limits of inference', presentation.limits));
  };
  const clear = () => {
    accepted = undefined; renderedPlot = undefined; plot.clear();
    for (const key of ['sigma', 'rmse', 'in-band', 'samples']) field(key).textContent = '—';
    field('region-evidence').textContent = 'No accepted analysis for this source and region.';
    renderAssessment();
  };
  const configure = (next: LoggerAnalysisContext) => {
    rangeInteraction.contextChanged(next);
    const sourceChanged = context.source?.identity !== next.source?.identity;
    const catalogChanged = !sameChannelOptionCatalog(context.channels, next.channels);
    if (sourceChanged || catalogChanged || context.source?.revision !== next.source?.revision || context.source?.sampleCount !== next.source?.sampleCount) resetDiscovery();
    if (regionSession.bind(next.source?.identity, next.source?.revision, next.sourceTimeRange)) { regionEvidence = undefined; focusId = 'overview'; manager.close(); manager.resetDrafts(); }
    if (catalogChanged) regionEvidence = undefined;
    if (sourceChanged) { scopeValue = 'full'; manualId = undefined; }
    else scopeValue = retainedAnalyzerScopeValue(scopeValue, context, next);
    context = next;
    if (sourceChanged || catalogChanged || !rpmSelect.options.length) {
      const initialized = rpmSelect.options.length > 0;
      const choices = [[rpmSelect, 'rpm', rpmId], [targetSelect, 'target', targetId], ...CONTEXT_ROLES.map(role => [contextSelects[role], role, contextIds[role]] as const)] as const;
      for (const [select, role, old] of choices) {
        const channels = context.channels.filter(channel => idleRoleUnit(channel, role));
        select.replaceChildren(new Option(role === 'rpm' ? 'Select RPM channel' : 'Unavailable / not selected', ''));
        for (const channel of channels) {
          const unit = idleRoleUnit(channel, role)!;
          select.add(new Option(`${analyzerChannelOptionLabel(channel)}${unit.authority === 'canonical-role' ? ` [${unit.unit} · canonical role]` : ''}`, channel.id));
        }
        select.value = !sourceChanged && initialized ? channels.some(channel => channel.id === old) ? old : '' : suggestAnalyzerChannel('idle', role, channels)?.id ?? '';
      }
      contextIds = Object.fromEntries(CONTEXT_ROLES.map(role => [role, contextSelects[role].value])) as Record<ContextRole, string>;
      rpmId = rpmSelect.value; targetId = targetSelect.value;
    }
    if (manualId && !regionSession.regions.some(region => region.id === manualId)) { manualId = undefined; if (scopeValue === 'manual') scopeValue = 'regions'; }
    if (sourceChanged || catalogChanged || !field<HTMLSelectElement>('qual-coolant').options.length) {
      for (const role of qualificationRoles) {
        const select=field<HTMLSelectElement>(`qual-${role}`),old=qualificationIds[role];
        const channels=context.channels.filter(channel=>idleQualificationRoleUnit(channel,role));
        select.replaceChildren(new Option('Unavailable / not selected',''),...channels.map(channel=>new Option(analyzerChannelOptionLabel(channel),channel.id)));
        select.value=!sourceChanged ? channels.some(channel=>channel.id===old) ? old : '' : suggestAnalyzerChannel('idle',role,channels)?.id ?? '';
        qualificationIds[role]=select.value;
      }
    }
    const options = [...analyzerScopeOptions(context), { value: 'regions', kind: 'range' as const, label: 'Included regions' }];
    if (!options.some(option => option.value === scopeValue) && scopeValue !== 'manual') scopeValue = 'full';
    scopeSelect.replaceChildren(...options.map(option => new Option(option.label, option.value)));
    if (manualId) scopeSelect.add(new Option('Manual region', 'manual'));
    scopeSelect.value = scopeValue;
    const bounds = selectedBounds();
    startInput.value = bounds ? String(bounds.startMs / 1000) : '';
    endInput.value = bounds ? String(bounds.endMs / 1000) : '';
    const descriptor = context.source?.descriptor;
    field('source').textContent = descriptor ? `${descriptor.displayName} · ${descriptor.format} · ${context.source!.sampleCount.toLocaleString()} indexed records` : 'Load a recorded MLG through Open Log (source metadata unavailable).';
    loggerButton.disabled = !context.openRangeInLogger || !bounds;
    syncMappingNote(); renderQualificationControls();
    renderRegionControls(); renderTimeline();
  };
  const analyze = async () => {
    if (!active || disposed) return;
    const source = context.source;
    const bounds = selectedBounds();
    if (!source || source.descriptor?.format !== 'MLG' || !bounds || !Number.isFinite(bounds.startMs) || !Number.isFinite(bounds.endMs) || bounds.endMs <= bounds.startMs || !rpmId) {
      generation += 1; pendingKey = undefined; clear(); runButton.disabled = false;
      status('Load a recorded source with RPM units and select a nonzero region.'); return;
    }
    const regions = scopeValue === 'regions' ? regionSession.includedBounds() : undefined;
    const managed = regionSession.regions.length > 0;
    if (scopeValue === 'regions' && !managed) {
      generation += 1; pendingKey = undefined; clear(); runButton.disabled = false; field('samples').textContent = '0';
      status('No included regions. Add regions or review discovered candidates.'); return;
    }
    let plan: ReturnType<typeof qualificationPlan>;
    try { plan = qualificationPlan(); }
    catch(error) { generation++; pendingKey=undefined; clear();runButton.disabled=false;status(error instanceof Error?error.message:'Qualification unavailable');return; }
    const needsFullEvidence=managed||plan.enabled;
    const evidenceKey = semanticEvidenceKey();
    const key = JSON.stringify([evidenceKey, bounds, regions, plan.enabled ? [plan.conditions,plan.bypass,plan.description] : false]);
    if (accepted?.source === source.identity && accepted.key === key
      && (!needsFullEvidence || (regionEvidence?.source === source.identity && regionEvidence.key === evidenceKey))) { if (managed) renderPlot(); return; }
    if (pendingKey === key && pendingSource === source.identity) return;
    const mayReuseEvidence=needsFullEvidence||accepted?.qualification!==undefined;
    const request = ++generation;
    const captured = context;
    const requestedRpm = rpmId;
    const requestedTarget = targetId;
    const requestedContext = { ...contextIds };
    pendingKey = key; pendingSource = source.identity; clear(); status('Loading recorded evidence…'); runButton.disabled = true;
    owner.event('idle.stability.request', { generation: request, startMs: bounds.startMs, endMs: bounds.endMs });
    try {
      const readBounds = needsFullEvidence ? captured.sourceTimeRange! : bounds;
      const requestedIds = [...new Set([requestedRpm,requestedTarget,...Object.values(requestedContext),...plan.ids].filter(Boolean))];
      const retained = mayReuseEvidence && regionEvidence?.source === source.identity && regionEvidence.key === evidenceKey
        && requestedIds.every(id=>regionEvidence!.traces.some(trace=>trace.channel.id===id&&(trace.complete||numericRangeCoversTime(trace.range,readBounds.startMs,readBounds.endMs)))) ? regionEvidence.traces : undefined;
      const traces = retained ?? await captured.loadTraces(requestedIds, readBounds.startMs, readBounds.endMs);
      if (!active || disposed || request !== generation) return;
      const rpm = traces.find(trace => trace.channel.id === requestedRpm);
      const target = traces.find(trace => trace.channel.id === requestedTarget);
      if (!rpm) throw new Error('RPM data unavailable. Retry Run Analysis or choose another channel.');
      if (requestedTarget && !target) throw new Error('Selected target data unavailable. Retry or explicitly choose no target.');
      const complete = [rpm, ...(target ? [target] : [])].every(trace => trace.complete || numericRangeCoversTime(trace.range, bounds.startMs, bounds.endMs));
      if (captured.sourceTimeRange && readBounds.startMs <= captured.sourceTimeRange.startMs && readBounds.endMs >= captured.sourceTimeRange.endMs && traces.every(trace => trace.complete || numericRangeCoversTime(trace.range, readBounds.startMs, readBounds.endMs))) regionEvidence = { source: source.identity, key: evidenceKey, traces };
      const qualification = plan.enabled ? { ...qualifyIdleSamples({referenceId:requestedRpm,channels:new Map(traces.map(trace=>[trace.channel.id,{range:trace.range,complete:trace.complete}])),conditions:plan.conditions,scope:regions??[bounds],bypass:plan.bypass}), description:plan.description } : undefined;
      const result = analyzeIdleStability(rpm.range, target?.range, { ...bounds, ...(regions ? { regions } : {}), ...(qualification ? {eligibility:qualification.eligibility} : {}), complete:complete && (qualification?.complete??true) });
      accepted = { source: source.identity, key, result, qualification, evidenceKey, rpm, target, traces };
      const stats = result.analysis;
      field('sigma').textContent = number(stats.rpm.standardDeviation);
      field('rmse').textContent = number(stats.tracking?.rmse);
      field('in-band').textContent = result.inBandPercent === undefined ? 'Unavailable' : `${number(result.inBandPercent, 1)}%`;
      field('samples').textContent = stats.rpm.validSampleCount.toLocaleString();
      renderCoverage();
      renderPlot();
      status(qualification && !qualification.eligible && qualification.input ? !qualification.rejected&&(qualification.invalid||qualification.unavailable) ? 'Qualification evidence unavailable or misaligned.' : 'No records match selected qualification conditions.' : regions && !regions.length ? 'No included regions. Graph focus is excluded from analysis.' : stats.rpm.validSampleCount ? complete ? 'Recorded evidence' : 'Partial recorded evidence' : 'No valid RPM evidence');
      renderAssessment();
      owner.event('idle.stability.accepted', { generation: request, samples: stats.rpm.validSampleCount });
    } catch (error) {
      if (!active || disposed || request !== generation) return;
      clear(); status(error instanceof Error ? error.message : 'Could not load recorded evidence. Retry Run Analysis.');
    } finally {
      if (request === generation) { pendingKey = undefined; runButton.disabled = false; }
    }
  };
  const discover = async () => {
    if (!active || disposed || discoveryPending) return;
    const options = candidateOptions(), source = context.source, bounds = context.sourceTimeRange;
    if (!options) { showDiscovery('Enter a positive RPM ceiling and minimum duration.'); return; }
    if (!source || source.descriptor?.format !== 'MLG' || !bounds || !rpmId) { showDiscovery('Load recorded RPM evidence before discovering candidates.'); return; }
    let plan:ReturnType<typeof qualificationPlan>;
    try {plan=qualificationPlan(true);}catch(error){showDiscovery(error instanceof Error?error.message:'Qualification unavailable');return;}
    const key = discoveryKey(options);
    if (discovery?.source === source.identity && discovery.key === key) { showDiscovery(discovery.result.totalCount ? `${discovery.result.totalCount} current ${plan.enabled?'condition-matching':'RPM'} candidate${discovery.result.totalCount === 1 ? '' : 's'}. Review inclusion in Manage regions; existing choices are retained.` : 'No candidates match the current settings. Try a higher RPM ceiling or shorter minimum duration; managed regions are retained.', discovery.result.totalCount > 0); return; }
    const captured = context, requestedRpm = rpmId, request = ++discoveryGeneration;
    discoveryPending = true; field<HTMLButtonElement>('discover').disabled = true; showDiscovery(plan.enabled?'Finding condition-matching candidate intervals…':'Finding RPM-only candidate intervals…');
    try {
      const requested=[rpmId,...plan.ids],retained=regionEvidence?.source===source.identity?regionEvidence.traces:undefined;
      const reusable=retained && requested.every(id=>retained.some(trace=>trace.channel.id===id&&(trace.complete||numericRangeCoversTime(trace.range,bounds.startMs,bounds.endMs))));
      const traces=reusable?retained:await captured.loadTraces([...new Set(requested)],bounds.startMs,bounds.endMs);
      if (!active || disposed || request !== discoveryGeneration) return;
      const trace=traces.find(trace=>trace.channel.id===requestedRpm);
      if (!trace || !(trace.complete || numericRangeCoversTime(trace.range, bounds.startMs, bounds.endMs))) throw new Error('Full-source RPM coverage is required for discovery. Existing analysis retained.');
      const qualification=plan.enabled?qualifyIdleSamples({referenceId:requestedRpm,channels:new Map(traces.map(trace=>[trace.channel.id,{range:trace.range,complete:trace.complete}])),conditions:plan.conditions,scope:[bounds],bypass:[]}):undefined;
      if(qualification&&!qualification.complete)throw new Error('Discovery requires complete aligned qualification-channel coverage. No RPM-only fallback was applied.');
      if(qualification&&qualification.input>0&&!qualification.eligible&&!qualification.rejected&&(qualification.invalid||qualification.unavailable))throw new Error('Qualification evidence unavailable or misaligned. Check required channels and source integrity; no RPM-only fallback was applied.');
      const result = discoverIdleCandidates(trace.range, { ...options,...(qualification?{eligibility:qualification.eligibility}:{}) });
      discovery = { source: source.identity, key, result };
      const added = regionSession.addCandidates(result.regions);
      if (added) { configure(context); void analyze(); }
      const select = field<HTMLSelectElement>('candidates');
      select.replaceChildren(new Option(result.totalCount ? 'Review candidate…' : 'No matching candidate intervals', ''));
      result.regions.forEach((region, index) => select.add(new Option(`${index + 1}: ${(region.startMs / 1000).toFixed(2)}–${(region.endMs / 1000).toFixed(2)} s`, String(index))));
      select.disabled = !result.regions.length;
      field('scope-note').textContent = `${result.totalCount} ${plan.enabled?'condition-matching':'RPM-only'} candidates${result.totalCount > result.regions.length ? '; first 200 listed' : ''} · 0 < RPM ≤ ${options.maximumRpm} · ≥ ${options.minimumDurationMs / 1000} s · gaps ≤ 250 ms. Review throttle, temperature and loads.${plan.enabled ? ` Conditions: ${plan.description}.` : ''}`;
      showDiscovery(result.totalCount ? `${result.totalCount} ${plan.enabled?'condition-matching':'RPM'} candidate${result.totalCount === 1 ? '' : 's'} found${result.totalCount > result.regions.length ? '; first 200 listed' : ''}. ${added} new excluded region${added === 1 ? '' : 's'} added for review; existing inclusion choices are retained.`
        : 'No candidates match these settings. Try a higher RPM ceiling or shorter minimum duration. Existing managed regions are unchanged.', result.totalCount > 0);
    } catch (error) {
      if (active && !disposed && request === discoveryGeneration) showDiscovery(error instanceof Error ? error.message : 'Candidate discovery failed; existing analysis retained.');
    } finally {
      if (request === discoveryGeneration) { discoveryPending = false; field<HTMLButtonElement>('discover').disabled = false; }
    }
  };
  const listen = (node: HTMLElement, action: () => void, event = 'click') => node.addEventListener(event, () => {
    if (active && !disposed) action();
  }, { signal: events.signal });
  listen(rpmSelect, () => { resetDiscovery(); rpmId = rpmSelect.value; syncMappingNote(); void analyze(); }, 'change');
  for (const role of CONTEXT_ROLES) listen(contextSelects[role], () => { contextIds[role] = contextSelects[role].value; syncMappingNote(); void analyze(); }, 'change');
  listen(field('manage-regions'), () => { renderRegionControls(); manager.open(); });
  listen(field('focus'), () => { focusId = field<HTMLSelectElement>('focus').value; renderRegionControls(); renderTimeline(); renderPlot(); }, 'change');
  field('region-markers').addEventListener('pointerdown', event => { if (!event.shiftKey) event.stopPropagation(); }, { signal: events.signal });
  field('region-markers').addEventListener('click', event => {
    const node = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-region-id]') : null;
    if (active && !disposed && node && !(event as MouseEvent).shiftKey) manageRegion({ type: 'focus', id: node.dataset.regionId! });
  }, { signal: events.signal });
  const qualificationChanged = (affectsDiscovery=true) => { generation++;pendingKey=undefined;if(affectsDiscovery)resetDiscovery(true);renderQualificationControls();renderRegionControls();void analyze(); };
  listen(field('qualification-settings'),()=>{const opening=!field<HTMLDetailsElement>('qualification-setup').open;field<HTMLDetailsElement>('qualification-setup').open=opening;if(opening)field<HTMLDetailsElement>('setup').open=false;});
  listen(field('qual-enabled'),qualificationChanged,'change');
  for(const name of ['qual-warm','qual-closed','qual-input','qual-temperature','qual-percent'])listen(field(name),()=>{if(qualificationSettings().enabled)qualificationChanged();},'change');
  listen(field('qual-bypass'),()=>{if(qualificationSettings().enabled)qualificationChanged(false);},'change');
  for(const role of qualificationRoles)listen(field(`qual-${role}`),()=>{qualificationIds[role]=field<HTMLSelectElement>(`qual-${role}`).value;const settings=qualificationSettings();if(settings.enabled&&(role==='coolant'?settings.requireWarm:settings.requireClosed&&settings.closedSource===role))qualificationChanged();else renderQualificationControls();},'change');
  listen(field('apply-included'), () => manageRegion({ type: 'analyze' }));
  listen(field('review-candidates'), () => { renderRegionControls(); manager.open(); });
  listen(field('discover'), () => { void discover(); });
  for (const name of ['candidate-rpm', 'candidate-duration']) listen(field(name), () => {if(name==='candidate-rpm'&&qualificationSettings().enabled)qualificationChanged();else resetDiscovery(true);}, 'change');
  listen(field('candidates'), () => {
    const select = field<HTMLSelectElement>('candidates'), options = candidateOptions();
    let currentKey:string;try{if(!options)return;currentKey=discoveryKey(options);}catch{return;}
    if (!select.value || discovery?.source !== context.source?.identity || discovery?.key !== currentKey) return;
    const region = discovery.result.regions[Number(select.value)];
    if (region && !commitRange(context, region.startMs, region.endMs)) select.value = '';
  }, 'change');
  listen(field('settings'), () => { const opening=!field<HTMLDetailsElement>('setup').open;field<HTMLDetailsElement>('setup').open=opening;if(opening)field<HTMLDetailsElement>('qualification-setup').open=false; });
  listen(field('region-focus'), plot.fit);
  listen(field('zoom-in'), () => plot.zoom(.8));
  listen(field('zoom-out'), () => plot.zoom(1.25));
  listen(targetSelect, () => { targetId = targetSelect.value; syncMappingNote(); void analyze(); }, 'change');
  listen(scopeSelect, () => { scopeValue = scopeSelect.value; const bounds = selectedBounds(); startInput.value = bounds ? String(bounds.startMs / 1000) : ''; endInput.value = bounds ? String(bounds.endMs / 1000) : ''; renderRegionControls(); renderTimeline(); renderPlot(); void analyze(); }, 'change');
  listen(field('apply-region'), () => {
    const startMs = Number(startInput.value) * 1000;
    const endMs = Number(endInput.value) * 1000;
    const extent = context.sourceTimeRange;
    if (!startInput.value.trim() || !endInput.value.trim() || !Number.isFinite(startMs) || !Number.isFinite(endMs) || !extent || startMs < extent.startMs || endMs > extent.endMs || endMs <= startMs) {
      status('Enter a finite start < end inside the recorded source extent. Previous region retained.'); return;
    }
    try {
      if (context.source?.descriptor?.format !== 'MLG') throw new Error('Load a recorded MLG before adding a manual region.');
      const region = regionSession.add({ startMs, endMs }); manualId = region.id; focusId = region.id;
      scopeValue = 'manual'; configure(context); void analyze();
    } catch (error) { status(error instanceof Error ? error.message : 'Manual region rejected.'); }
  });
  listen(runButton, () => { if (accepted) { accepted = undefined; } void analyze(); });
  listen(field('fit'), plot.fit);
  listen(loggerButton, () => { const bounds = displayBounds(); if (bounds) context.openRangeInLogger?.({ ...bounds, label: 'Idle stability region' }); });
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-idle-tab]')) listen(button, () => { tab = button.dataset.idleTab as Tab; renderAssessment(); });
  renderAssessment();
  return {
    element: root,
    setActive(next: boolean) {
      if (disposed || active === next) return;
      active = next; plot.setActive(next);
      if (!next) { manager.close(); rangeInteraction.cancel(); generation += 1; discoveryGeneration += 1; discoveryPending = false; field<HTMLButtonElement>('discover').disabled = false; pendingKey = undefined; return; }
      if (pendingContext) { const nextContext = pendingContext; pendingContext = undefined; configure(nextContext); }
      void analyze();
    },
    setContext(next: LoggerAnalysisContext) {
      if (disposed) return;
      if (!active) { pendingContext = next; return; }
      configure(next); if (!committingRange) void analyze();
    },
    refresh() { void analyze(); },
    dispose() { disposed = true; active = false; generation += 1; discoveryGeneration += 1; discovery = undefined; regionEvidence = undefined; manager.close(); accepted = undefined; pendingContext = undefined; rangeInteraction.cancel(); events.abort(); plot.dispose(); },
  };
}
