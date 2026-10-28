import type { TuneModel } from '../../../../core/tune/tune-model';
import { createIdleTuneContextView } from './idle-tune-context-view';
import { idleRecordedCoverage } from './idle-recorded-presentation';
import { analyzeIdleRecovery, validateIdleRecoverySettings, type IdleRecoveryResult } from '../../../../core/analysis/idle-recovery';
import { analyzeIdleIgnition, type IdleIgnitionResult } from '../../../../core/analysis/idle-ignition';
import { presentIdleIgnition } from './idle-ignition-presentation';
import { analyzeIdlePositionPid, type IdlePositionPidResult } from '../../../../core/analysis/idle-position-pid';
import { presentIdlePositionPid } from './idle-position-pid-presentation';
import { analyzeIdleRpmPid, type IdleRpmPidResult } from '../../../../core/analysis/idle-rpm-pid';
import { presentIdleRpmPid } from './idle-rpm-pid-presentation';
import { analyzeIdleValvePosition, withIdleMotorReference, type IdleValvePositionResult, type IdleValveTrackingResult } from '../../../../core/analysis/idle-valve-tracking';
import { presentIdleValveTracking } from './idle-valve-presentation';
import { analyzeIdleAirflow, type IdleAirflowResult } from '../../../../core/analysis/idle-airflow';
import { idleAirflowValue, presentIdleAirflow } from './idle-airflow-presentation';
import { summarizeIdlePurposes } from '../../../../core/analysis/idle-region-purpose';
import '../styles/idle-analyzer.css';
import type { LoggerAnalysisContext, LoggerAnalysisTraceContext } from './logger-page';
import { analyzerScopeOptions, analyzerScopeBounds, retainedAnalyzerScopeValue } from './analyzer-scope';
import { analyzerChannelOptionLabel, suggestAnalyzerChannel, idleRoleUnit, idlePidRoleUnit, idlePositionPidRoleUnit, idleIgnitionRoleUnit, preferredIdleIgnitionLambda, idleQualificationRoleUnit } from './analyzer-channel-roles';
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
const VALVE_ROLES = ['dcTarget', 'dcPosition', 'dcOutput'] as const;
const PID_ROLES = ['p','i','d','pidOutput'] as const;
const BIAS_ROLES = ['dcBiasOutput','dcP','dcI','dcD'] as const;
const IGNITION_ROLES = ['ignitionAdvance','ignitionCorrection','ignitionLambda'] as const;
type IgnitionRole = typeof IGNITION_ROLES[number];
const IGNITION_LABELS = {ignitionAdvance:'Logged ignition advance',ignitionCorrection:'Logged signed idle timing correction',ignitionLambda:'Actual lambda'};
type BiasRole = typeof BIAS_ROLES[number];
const BIAS_LABELS = {dcBiasOutput:'Logged feed-forward · actuator unverified',dcP:'Inner position P',dcI:'Inner position I',dcD:'Inner position D'};
type PidRole = typeof PID_ROLES[number];
const PID_LABELS = {p:'Logged RPM P',i:'Logged RPM I',d:'Logged RPM D',pidOutput:'Logged PID output · stage unverified'};
type ValveRole = typeof VALVE_ROLES[number];
const VALVE_LABELS = { dcTarget: 'Valve requested', dcPosition: 'Valve measured', dcOutput: 'Signed motor duty' };
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
  let mode: 'stability' | 'airflow' | 'valve' | 'pid' | 'bias' | 'ignition' | 'recovery' = 'stability';
  let controllerRequest = 0, controllerPendingKey: string | undefined, controllerError: string | undefined;
  let valveIds: Record<ValveRole, string> = { dcTarget: '', dcPosition: '', dcOutput: '' };
  // At most one last-loaded mapping per role; clearing a mapping can be undone
  // without retaining every channel ever selected in a large catalog. Not analysis authority.
  let retainedValveIds = { ...valveIds };
  let pidIds: Record<PidRole,string> = {p:'',i:'',d:'',pidOutput:''};
  let retainedPidIds = {...pidIds};
  let biasIds: Record<BiasRole,string>={dcBiasOutput:'',dcP:'',dcI:'',dcD:''};
  let retainedBiasIds={...biasIds};
  let ignitionIds: Record<IgnitionRole,string>={ignitionAdvance:'',ignitionCorrection:'',ignitionLambda:''};
  let retainedIgnitionIds={...ignitionIds};
  let recoveryEventIndex=0, recoveryEventFocus=false;
  let accepted: { recoveryEvents?: {key:string;result:IdleRecoveryResult}; recovery?: {key:string;result:IdleRecoveryResult;position:IdleValvePositionResult;traces:readonly LoggerAnalysisTraceContext[]}; regions: readonly IdleRegionBounds[]; ignition?: {key:string;result:IdleIgnitionResult;traces:readonly LoggerAnalysisTraceContext[]}; position?: {key:string;result:IdleValvePositionResult}; bias?: {key:string;result:IdlePositionPidResult;traces:readonly LoggerAnalysisTraceContext[]}; pid?: {key:string;result:IdleRpmPidResult;traces:readonly LoggerAnalysisTraceContext[]}; valve?: { key: string; result: IdleValveTrackingResult; traces: readonly LoggerAnalysisTraceContext[] }; airflow?: IdleAirflowResult; contextMapping: Record<ContextRole, string>; source: object; key: string; result: IdleStabilityResult; qualification: (IdleQualificationResult & { description: string }) | undefined; evidenceKey: string; rpm: LoggerAnalysisTraceContext; target: LoggerAnalysisTraceContext | undefined; traces: readonly LoggerAnalysisTraceContext[] } | undefined;
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
    <div class="idle-toolbar"><label>Mode <select aria-label="Idle diagnostic mode" data-idle="mode"><option value="stability">Stability</option>
      <option value="airflow">Base Airflow</option><option value="pid">RPM PID</option><option value="valve">DC Valve Tracking</option>
      <option value="bias">DC Bias / Position PID</option><option value="ignition">Ignition</option><option value="recovery">Load Recovery</option><option disabled>Compare — not integrated</option></select></label>
      <label>Analysis scope <select data-idle="scope" aria-label="Idle analysis scope"></select></label>
      <label data-idle="focus-control" hidden><span data-idle="focus-label">Graph focus</span> <select data-idle="focus" aria-label="Viewed Idle region"></select></label><span class="idle-toolbar-spacer"></span><button type="button" data-idle="tune-tables">Tune tables</button><button type="button" data-idle="manage-regions">Manage regions</button><button type="button" data-idle="qualification-settings">Qualification</button><button type="button" data-idle="recovery-references" hidden>Recovery references</button><button type="button" data-idle="settings">Channels / region</button><button type="button" data-idle="logger">↗ Logger</button></div>
    <div class="idle-discovery-feedback" data-idle="discovery-feedback" hidden role="status" aria-live="polite"><span data-idle="discovery-message"></span><button type="button" data-idle="review-candidates" hidden>Review candidates</button></div>
    <div class="idle-workspace"><div class="idle-main"><div class="idle-analysis-authority"><strong data-idle="metrics-scope">Metrics: Full Log</strong><span data-idle="scope-application"></span><button type="button" data-idle="apply-included" hidden>Analyze included regions</button></div><p class="idle-qualification-state" data-idle="qualification-state">Qualification off</p><div class="idle-metrics" data-idle="stability-metrics" aria-label="Stability measurements">
      <div><strong data-idle="sigma">—</strong><span>RPM σ · sample</span></div><div><strong data-idle="rmse">—</strong><span>RPM error RMSE</span></div>
      <div><strong data-idle="in-band">—</strong><span>Within ±40 RPM</span></div><div><strong data-idle="samples">—</strong><span>Valid RPM samples</span></div></div>
      <div class="idle-metrics" data-idle="airflow-metrics" aria-label="Base Airflow logged request measurements" hidden><div><strong data-idle="airflow-base">—</strong><span>Mean base request · %</span></div><div><strong data-idle="airflow-correction">—</strong><span>Mean applied correction · pp</span></div><div><strong data-idle="airflow-final">—</strong><span>Mean final request · %</span></div><div><strong data-idle="airflow-rms">—</strong><span>Applied correction RMS · pp</span></div></div>
      <div class="idle-metrics" data-idle="valve-metrics" aria-label="Recorded DC valve tracking measurements" hidden><div><strong data-idle="valve-rmse">—</strong><span>Position error RMSE · pp</span></div><div><strong data-idle="valve-error">—</strong><span>Mean measured − requested · pp</span></div><div><strong data-idle="valve-motor">—</strong><span>Mean signed motor duty · %</span></div><div><strong data-idle="valve-reference">—</strong><span data-idle="valve-reference-label">Motor reference coverage</span></div></div>
      <div class="idle-metrics" data-idle="pid-metrics" aria-label="Recorded RPM PID measurements" hidden><div><strong data-idle="pid-p">—</strong><span data-idle="pid-p-label">Logged P RMS</span></div><div><strong data-idle="pid-i">—</strong><span data-idle="pid-i-label">Logged I mean</span></div><div><strong data-idle="pid-d">—</strong><span data-idle="pid-d-label">Logged D RMS</span></div><div><strong data-idle="pid-applied">—</strong><span>Applied correction mean · pp</span></div></div>
      <div class="idle-metrics" data-idle="bias-metrics" aria-label="Recorded inner position PID and feed-forward measurements" hidden><div><strong data-idle="bias-i">—</strong><span data-idle="bias-i-label">Inner position I mean</span></div><div><strong data-idle="bias-feed">—</strong><span data-idle="bias-feed-label">Logged feed-forward mean</span></div><div><strong data-idle="bias-motor">—</strong><span>Mean signed motor duty · %</span></div><div><strong data-idle="bias-tracking">—</strong><span>Position error RMSE · pp</span></div></div>
      <div class="idle-metrics" data-idle="ignition-metrics" aria-label="Recorded ignition and supporting context measurements" hidden><div><strong data-idle="ignition-advance">—</strong><span>Mean logged advance · °</span></div><div><strong data-idle="ignition-correction">—</strong><span>Mean signed idle correction · °</span></div><div><strong data-idle="ignition-rmse">—</strong><span>RPM error RMSE · RPM</span></div><div><strong data-idle="ignition-lambda">—</strong><span>Mean actual lambda · λ</span></div></div>
      <div class="idle-metrics" data-idle="recovery-metrics" hidden><div><strong data-idle="recovery-count">—</strong><span>Recorded sag events</span></div><div><strong data-idle="recovery-low">—</strong><span>Lowest RPM</span></div><div><strong data-idle="recovery-worst">—</strong><span>Worst |actual−target| · RPM</span></div><div><strong data-idle="recovery-tracking">—</strong><span>Valve tracking RMSE · pp</span></div></div>
      <div data-idle="recovery-events" class="idle-plot-tools" hidden><span data-idle="recovery-summary"></span><label>Event <input type="number" min="1" step="1" value="1" data-idle="recovery-event" aria-label="Recovery event number"></label><button type="button" data-idle="recovery-view">View event</button><button type="button" data-idle="recovery-all">View region</button><span data-idle="recovery-view-note">Event view changes graphs only; metrics use the selected analysis scope.</span></div>
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
      <button type="button" data-idle="discover">Find candidates</button><select data-idle="candidates" aria-label="Use discovered candidate as Logger A/B" disabled><option value="">No discovered candidates</option></select>
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
    <details class="idle-setup" data-idle="recovery-settings" hidden><summary>Recovery references</summary><div class="idle-setup-body">
      <label>Sag threshold (RPM)<input type="number" data-idle="recovery-sag" value="100" min="0" step="any"></label><label>Settled band ± RPM<input type="number" data-idle="recovery-band" value="40" min="0" step="any"></label><label>Settling dwell (ms)<input type="number" data-idle="recovery-dwell" value="500" min="0" step="any"></label><label>Maximum observation gap (ms)<input type="number" data-idle="recovery-gap" value="150" min="0" step="any"></label>
      <p>User references, not firmware limits. Recovery is onset to first in-band observation of a confirmed sampled dwell. Invalid data, scope boundaries, time discontinuities and physical-loss markers break runs. Incomplete events remain censored. A recorded sag does not prove an external load.</p></div></details>
    <details class="idle-setup" data-idle="setup"><summary>Channels and manual region</summary><div class="idle-setup-body">
      <span data-idle="source">Load a recorded MLG through Open Log.</span><label>RPM <select data-idle="rpm" aria-label="Idle RPM channel"></select></label>
      <label>Idle target <select data-idle="target" aria-label="Idle target channel"></select></label>
      <label>Base request <select data-idle="basePosition" aria-label="Idle base request channel"></select></label>
      <label>Applied correction <select data-idle="closedLoop" aria-label="Idle applied correction channel"></select></label>
      <label>Final request <select data-idle="finalPosition" aria-label="Idle final request channel"></select></label>
      <label>RPM P <select data-idle="p" aria-label="Outer RPM P channel"></select></label><label>RPM I <select data-idle="i" aria-label="Outer RPM I channel"></select></label><label>RPM D <select data-idle="d" aria-label="Outer RPM D channel"></select></label><label>Logged PID output <select data-idle="pidOutput" aria-label="Logged outer RPM PID output channel"></select></label>
      <label>Logged feed-forward (actuator unverified) <select data-idle="dcBiasOutput" aria-label="Logged feed-forward channel"></select></label><label>Inner position P <select data-idle="dcP" aria-label="Inner position P channel"></select></label><label>Inner position I <select data-idle="dcI" aria-label="Inner position I channel"></select></label><label>Inner position D <select data-idle="dcD" aria-label="Inner position D channel"></select></label>
      <label>Logged ignition advance <select data-idle="ignitionAdvance" aria-label="Logged ignition advance channel"></select></label><label>Signed idle timing correction <select data-idle="ignitionCorrection" aria-label="Signed idle timing correction channel"></select></label><label>Actual lambda (optional) <select data-idle="ignitionLambda" aria-label="Actual lambda context channel"></select></label>
      <label>Valve requested <select data-idle="dcTarget" aria-label="DC requested position channel"></select></label><label>Valve measured <select data-idle="dcPosition" aria-label="DC measured position channel"></select></label><label>Signed motor duty <select data-idle="dcOutput" aria-label="DC signed motor duty channel"></select></label>
      <label>Motor |duty| reference <input data-idle="motor-reference" type="number" min="0.01" max="100" step="any" value="95" aria-label="Motor duty reference percent"> % (user reference, not firmware limit)</label>
      <label>Region start (s)<input type="number" step="any" data-idle="start"></label><label>Region end (s)<input type="number" step="any" data-idle="end"></label>
      <button type="button" data-idle="apply-region">Use manual region</button><p data-idle="mapping-note"></p>
    </div></details>`;
  const field = <T extends HTMLElement = HTMLElement>(name: string) => root.querySelector<T>(`[data-idle="${name}"]`)!;
  const rpmSelect = field<HTMLSelectElement>('rpm');
  const targetSelect = field<HTMLSelectElement>('target');
  const contextSelects = Object.fromEntries(CONTEXT_ROLES.map(role => [role, field<HTMLSelectElement>(role)])) as Record<ContextRole, HTMLSelectElement>;
  const valveSelects = Object.fromEntries(VALVE_ROLES.map(role => [role, field<HTMLSelectElement>(role)])) as Record<ValveRole, HTMLSelectElement>;
  const pidSelects = Object.fromEntries(PID_ROLES.map(role=>[role,field<HTMLSelectElement>(role)])) as Record<PidRole,HTMLSelectElement>;
  const biasSelects=Object.fromEntries(BIAS_ROLES.map(role=>[role,field<HTMLSelectElement>(role)])) as Record<BiasRole,HTMLSelectElement>;
  const ignitionSelects=Object.fromEntries(IGNITION_ROLES.map(role=>[role,field<HTMLSelectElement>(role)])) as Record<IgnitionRole,HTMLSelectElement>;
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
  const qualificationPlan = (discovery = false) => buildIdleQualificationPlan(qualificationSettings(),context.channels,rpmId,{kind:scopeValue,manualId,viewedId:focusId,regions:regionSession.regions},discovery);
  const renderQualificationControls = () => {
    const settings = qualificationSettings();
    for (const name of ['qual-warm','qual-closed','qual-bypass']) field<HTMLInputElement>(name).disabled = !settings.enabled;
    field<HTMLInputElement>('qual-temperature').disabled = !settings.enabled || !settings.requireWarm;
    for (const name of ['qual-input','qual-percent']) field<HTMLInputElement>(name).disabled = !settings.enabled || !settings.requireClosed;
    try { field('qualification-state').textContent = qualificationPlan().description; }
    catch(error) { field('qualification-state').textContent = error instanceof Error ? error.message : 'Qualification unavailable'; }
  };
  const mappingDescription = () => ['rpm', 'target', ...CONTEXT_ROLES, ...VALVE_ROLES, ...PID_ROLES, ...BIAS_ROLES, ...IGNITION_ROLES].map(role => {
      const id = role === 'rpm' ? rpmId : role === 'target' ? targetId : IGNITION_ROLES.includes(role as IgnitionRole) ? ignitionIds[role as IgnitionRole] : BIAS_ROLES.includes(role as BiasRole) ? biasIds[role as BiasRole] : PID_ROLES.includes(role as PidRole) ? pidIds[role as PidRole] : VALVE_ROLES.includes(role as ValveRole) ? valveIds[role as ValveRole] : contextIds[role as ContextRole];
      const channel = context.channels.find(item => item.id === id); const unit = channel && (IGNITION_ROLES.includes(role as IgnitionRole) ? idleIgnitionRoleUnit(channel,role as IgnitionRole) : BIAS_ROLES.includes(role as BiasRole) ? idlePositionPidRoleUnit(channel,role as BiasRole) : PID_ROLES.includes(role as PidRole) ? idlePidRoleUnit(channel,role as PidRole) : idleRoleUnit(channel, role as 'rpm' | 'target' | ContextRole | ValveRole));
      return `${role}: ${channel ? channel.sourceName + ' [' + unit?.unit + (IGNITION_ROLES.includes(role as IgnitionRole)&&channel.unit?'; declared source unit '+channel.unit:'') + '] · ' + (unit?.authority === 'canonical-role' ? 'canonical role; source unit unspecified' : unit?.authority === 'unspecified' ? 'engineering unit unspecified; raw controller values only' : 'recorded/catalog unit') : 'unavailable'}`;
    }).join('; ');
  const syncMappingNote = () => { field('mapping-note').textContent = mappingDescription(); };
  const manager = createIdleRegionManager(events.signal, action => { if (active && !disposed) manageRegion(action); });
  root.append(manager.element);
  const tuneContext=createIdleTuneContextView(events.signal,()=>owner.event('idle.tune.projected'));root.append(tuneContext.element);
  const selectedBounds = (): IdleRegionBounds | undefined => {
    if (scopeValue === 'regions') {
      const included = regionSession.includedBounds();
      return included.length ? { startMs: included[0]!.startMs, endMs: included.at(-1)!.endMs } : context.sourceTimeRange;
    }
    if (scopeValue === 'manual' || scopeValue === 'viewed') { const region = regionSession.regions.find(region => region.id === (scopeValue === 'viewed' ? focusId : manualId)); return region ? { startMs: region.startMs, endMs: region.endMs } : undefined; }
    const scope = analyzerScopeOptions(context).find(option => option.value === scopeValue);
    if (!scope) return undefined;
    return scope.kind === 'full' ? context.sourceTimeRange : analyzerScopeBounds(scope) as { startMs: number; endMs: number };
  };
  const displayBounds = () => {
    if (scopeValue === 'viewed') return selectedBounds();
    const region = regionSession.regions.find(region => region.id === focusId);
    if (region) return { startMs: region.startMs, endMs: region.endMs };
    if (focusId === 'logger' && context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs) return { startMs: Math.min(context.aTimeMs, context.bTimeMs), endMs: Math.max(context.aTimeMs, context.bTimeMs) };
    return selectedBounds();
  };
  const analysisScopeLabel = () => {
    if (scopeValue === 'viewed') {
      const region = regionSession.regions.find(region => region.id === focusId);
      return region ? `Viewed region: ${region.label} · ${(region.startMs/1000).toFixed(2)}–${(region.endMs/1000).toFixed(2)} s` : 'Viewed region: select a managed region';
    }
    if (scopeValue === 'regions') return `Combined included regions (${regionSession.regions.filter(region => region.included).length})`;
    return scopeValue === 'manual' ? 'Manual region' : analyzerScopeOptions(context).find(option => option.value === scopeValue)?.label ?? 'Unavailable';
  };
  const renderRegionControls = () => {
    const regions = regionSession.regions;
    if (focusId.startsWith('region:') && !regions.some(region => region.id === focusId)) focusId = 'overview';
    const select = field<HTMLSelectElement>('focus');
    select.replaceChildren(new Option(scopeValue === 'viewed' ? 'Select a managed region' : 'Analysis overview', 'overview'));
    select.options[0]!.disabled = scopeValue === 'viewed';
    if (context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs) select.add(new Option('Logger A/B', 'logger'));
    if (focusId === 'logger' && ![...select.options].some(option => option.value === 'logger')) focusId = 'overview';
    for (const region of regions) select.add(new Option(`${region.label} · ${region.included ? 'included' : 'excluded'} · ${(region.startMs/1000).toFixed(2)}–${(region.endMs/1000).toFixed(2)} s`, region.id));
    if (scopeValue === 'viewed') for (const option of select.options) if (option.value === 'logger') option.disabled = true;
    select.value = focusId;
    field('focus-label').textContent = scopeValue === 'viewed' ? 'Viewed region' : 'Graph focus';
    field('region-key').textContent = `Included · green / Excluded · gray / Viewed · blue outline. ${scopeValue === 'viewed' ? 'View selects the region for analysis.' : 'View does not change analysis.'} Shift-drag selects Logger A/B. ↗ Logger opens the viewed interval.`;
    field('focus-control').hidden = !regions.length && scopeValue !== 'viewed'; field('region-key').hidden = !regions.length;
    loggerButton.disabled = !context.openRangeInLogger || !displayBounds();
    const included = regions.filter(region => region.included).length;
    const scopeLabel = analysisScopeLabel();
    field('metrics-scope').textContent = `Metrics: ${scopeLabel}`;
    field('scope-application').textContent = scopeValue === 'regions' ? 'Overlapping samples count once.' : scopeValue === 'viewed' ? 'Checkboxes apply only to combined analysis.' : included ? `${included} checked region${included === 1 ? ' is' : 's are'} not applied to these metrics.` : '';
    field('apply-included').hidden = scopeValue === 'regions' || !included;
    const viewed = regions.find(region => region.id === focusId);
    const explanation = field('focus-explanation'); explanation.hidden = !regions.length && !qualificationSettings().enabled;
    explanation.textContent = scopeValue === 'viewed' ? viewed ? 'Graphs, metrics and assessment use this region. Inclusion checkboxes affect combined analysis only.' : 'Select a managed region to analyze; no Full Log fallback is applied.' : viewed ? `Graph focus: ${viewed.label} (${viewed.included ? 'included' : 'excluded'}). Metrics remain ${scopeLabel}.`
      : focusId === 'logger' ? `Graph focus: Logger A/B. Metrics remain ${scopeLabel}.` : scopeValue === 'regions' ? 'Graph overview spans the included intervals and the gaps between them. Gap samples are excluded from the combined metrics.' : `Graph overview: ${scopeLabel}.`;
    if(qualificationSettings().enabled)explanation.textContent+=' Graphs retain recorded measurements, including samples excluded by conditions.';
    manager.update(regions, focusId, context.sourceTimeRange, scopeLabel, scopeValue === 'regions');
  };
  const semanticEvidenceKey = (qualificationChannels: readonly string[] = []) => JSON.stringify([context.source?.revision, context.source?.sampleCount, context.source?.descriptor, context.sourceIntegrity?.filter(marker=>marker.breaksContinuity).map(marker=>marker.timeMs), context.channels, rpmId, targetId, contextIds, qualificationChannels]);
  // Only callers that requested/verified whole-source columns publish here. Scoped
  // accepted traces must never be promoted just because their own request completed.
  const retainFullEvidence = (source: object, key: string, traces: readonly LoggerAnalysisTraceContext[]) => {
    const allowed = new Set([rpmId,targetId,...Object.values(contextIds),...Object.values(qualificationIds),...Object.values(valveIds),...Object.values(retainedValveIds),...Object.values(pidIds),...Object.values(retainedPidIds),...Object.values(biasIds),...Object.values(retainedBiasIds),...Object.values(ignitionIds),...Object.values(retainedIgnitionIds)].filter(Boolean));
    const all = new Map(regionEvidence?.source === source && regionEvidence.key === key ? regionEvidence.traces.map(trace => [trace.channel.id,trace] as const) : []);
    for (const trace of traces) all.set(trace.channel.id,trace);
    for (const id of all.keys()) if (!allowed.has(id)) all.delete(id);
    regionEvidence = {source,key,traces:[...all.values()]};
  };
  const renderPlot = () => {
    if (!active || !accepted) return;
    let bounds = displayBounds(); if (!bounds) return;
    const recovery=mode==='recovery'?accepted.recovery:undefined;
    if(mode==='recovery'&&!recovery){plot.clear();renderedPlot=undefined;return;}
    const event=recovery?.result.events[recoveryEventIndex];
    if(event&&recoveryEventFocus){const sourceBounds=context.sourceTimeRange??bounds;bounds={startMs:Math.max(sourceBounds.startMs,event.onsetMs-500),endMs:Math.min(sourceBounds.endMs,event.endMs+500)};}
    const retained = regionEvidence;
    const traces = regionSession.regions.length && retained && retained.source === context.source?.identity && retained.key === accepted.evidenceKey ? retained.traces : accepted.traces;
    const valve = mode === 'valve' ? accepted.valve : undefined;
    const pid = mode === 'pid' ? accepted.pid : undefined;
    const bias=mode==='bias'?accepted.bias:undefined;
    const ignition=mode==='ignition'?accepted.ignition:undefined;
    if(mode==='ignition'&&!ignition){plot.clear();renderedPlot=undefined;return;}
    if(mode==='bias'&&!bias){plot.clear();renderedPlot=undefined;return;}
    if (mode === 'pid' && !pid) { plot.clear(); renderedPlot=undefined; return; }
    if (mode === 'valve' && !valve) { plot.clear(); renderedPlot = undefined; return; }
    const key = JSON.stringify([bounds, rpmId, targetId, contextIds, mode === 'valve' ? valve?.key : mode === 'pid' ? pid?.key : mode==='bias'?bias?.key:mode==='ignition'?ignition?.key:mode==='recovery'?recovery?.key:'rpm']);
    if (renderedPlot?.traces === traces && renderedPlot.key === key) return;
    const entries: IdlePlotSeries[] = [];
    if (!valve && !bias) for (const [id, label, unit, pane, color] of [[rpmId, 'Engine RPM', 'RPM', 0, '#61b8ed'], [targetId, 'RPM target', 'RPM', 0, '#7bd2b1'], ...(pid || ignition || recovery ? [] : CONTEXT_ROLES).map((role, index) => [contextIds[role], CONTEXT_LABELS[role], role === 'closedLoop' ? 'pp' : '%', 1, ['#b29af2', '#e8b46d', '#68ccac'][index]])] as const) {
      const trace = traces.find(trace => trace.channel.id === id); if (!trace) continue;
      entries.push({ label: String(label), range: sliceNumericRangeByTime(trace.range, bounds.startMs, bounds.endMs), unit: String(unit), pane: pane as 0 | 1, color: String(color) });
    }
    if (valve) {
      for (const [role, pane, color] of [['dcTarget', 0, '#61b8ed'], ['dcPosition', 0, '#7bd2b1'], ['dcOutput', 1, '#b29af2']] as const) {
        const trace = valve.traces.find(trace => trace.channel.id === valveIds[role]);
        if (trace) entries.push({label: VALVE_LABELS[role], range: sliceNumericRangeByTime(trace.range,bounds.startMs,bounds.endMs), unit:'%',pane,color,...(role==='dcOutput'?{axis:'right' as const}:{})});
      }
      if (valve.result.error) entries.push({label:'Error · measured − requested',range:sliceNumericRangeByTime(valve.result.error,bounds.startMs,bounds.endMs),unit:'pp',pane:1,color:'#e8b46d'});
    }
    if (pid) {
      for (const role of PID_ROLES) {
        const metric=role==='pidOutput'?pid.result.output:pid.result[role], trace=pid.traces.find(trace=>trace.channel.id===pidIds[role]);
        if (trace && metric.status==='available' && metric.unit===pid.result.termPlotUnit) entries.push({label:PID_LABELS[role],range:sliceNumericRangeByTime(trace.range,bounds.startMs,bounds.endMs),unit:metric.unit==='raw'?'raw (units unspecified)':'pp',pane:1,color:{p:'#61b8ed',i:'#e8b46d',d:'#b29af2',pidOutput:'#e78db4'}[role]});
      }
      const applied=accepted.traces.find(trace=>trace.channel.id===accepted!.contextMapping.closedLoop);
      if(applied && pid.result.applied.status==='available') entries.push({label:'Applied correction',range:sliceNumericRangeByTime(applied.range,bounds.startMs,bounds.endMs),unit:'pp',pane:1,axis:'right',color:'#7bd2b1'});
    }
    if(bias){
      for(const [role,color]of [['dcTarget','#61b8ed'],['dcPosition','#7bd2b1']] as const){
        const trace=bias.traces.find(trace=>trace.channel.id===valveIds[role]);
        if(trace)entries.push({label:VALVE_LABELS[role],range:sliceNumericRangeByTime(trace.range,bounds.startMs,bounds.endMs),unit:'%',pane:0,color});
      }
      for(const role of BIAS_ROLES){
        const metric=role==='dcBiasOutput'?bias.result.feedForward:role==='dcP'?bias.result.p:role==='dcI'?bias.result.i:bias.result.d;
        const trace=bias.traces.find(trace=>trace.channel.id===biasIds[role]);
        if(trace&&metric.status==='available'&&metric.unit===bias.result.termPlotUnit)entries.push({label:BIAS_LABELS[role],range:sliceNumericRangeByTime(trace.range,bounds.startMs,bounds.endMs),unit:metric.unit==='raw'?'raw (units unspecified)':`${metric.unit} duty contribution`,pane:1,color:{dcBiasOutput:'#e78db4',dcP:'#61b8ed',dcI:'#e8b46d',dcD:'#b29af2'}[role]});
      }
      const motor=bias.traces.find(trace=>trace.channel.id===valveIds.dcOutput);
      if(motor&&bias.result.position.motor.status==='available')entries.push({label:'Signed motor duty',range:sliceNumericRangeByTime(motor.range,bounds.startMs,bounds.endMs),unit:'%',pane:1,axis:'right',color:'#7bd2b1'});
    }
    if(ignition){
      for(const [role,color]of [['ignitionAdvance','#e8b46d'],['ignitionCorrection','#b29af2']] as const){
        const metric=role==='ignitionAdvance'?ignition.result.advance:ignition.result.correction;
        const trace=ignition.traces.find(trace=>trace.channel.id===ignitionIds[role]);
        if(trace&&metric.status==='available')entries.push({label:IGNITION_LABELS[role],range:sliceNumericRangeByTime(trace.range,bounds.startMs,bounds.endMs),unit:'°',pane:1,color});
      }
    }
    if(recovery)for(const [role,color]of [['dcTarget','#e8b46d'],['dcPosition','#7bd2b1'],['dcOutput','#b29af2']] as const){
      const trace=recovery.traces.find(trace=>trace.channel.id===valveIds[role]);
      const metric=role==='dcTarget'?recovery.position.requested:role==='dcPosition'?recovery.position.measured:recovery.position.motor;
      if(trace&&metric.status==='available')entries.push({label:VALVE_LABELS[role],range:sliceNumericRangeByTime(trace.range,bounds.startMs,bounds.endMs),unit:'%',pane:1,color,...(role==='dcOutput'?{axis:'right' as const}:{})});
    }
    const options = recovery ? {titles:['RPM SAG AND RECOVERY · actual / target','DC VALVE RESPONSE · left (%) / MOTOR DUTY · right (%)'] as const,ariaLabel:'Recorded RPM response, requested/measured valve position and separate signed motor-duty axis. Event recovery requires confirmed sampled dwell.'} : valve ? {titles:['DC VALVE · requested / measured (%)','POSITION ERROR · left (pp) / MOTOR DUTY · right (%)'] as const,ariaLabel:'Recorded requested and measured DC valve position, measured minus requested error, and signed motor duty.'}
      : pid ? {titles:['RPM CONTROL RESPONSE · actual / target',`LOGGED TERMS · left (${pid.result.termPlotUnit==='raw'?'raw; units unspecified':pid.result.termPlotUnit ?? 'mixed/missing units'}) / APPLIED · right (pp)`] as const,ariaLabel:'Recorded RPM response and independent logged outer RPM PID terms, output and applied correction. Raw units are not inferred percentage points.'} : bias ? {titles:['DC POSITION CONTROL · requested / measured (%)',`INNER TERMS · left (${bias.result.termPlotUnit==='raw'?'raw; units unspecified':bias.result.termPlotUnit?bias.result.termPlotUnit+' duty contribution':'mixed/missing units'}) / MOTOR · right (%)`] as const,ariaLabel:'Recorded requested/measured position and independent logged feed-forward, inner position PID terms and signed motor duty. Tune-derived bias is unavailable.'} : ignition ? {titles:['RPM RESPONSE · actual / target','IGNITION · absolute advance / signed idle correction (°)'] as const,ariaLabel:'Recorded RPM response, absolute ignition advance and separately logged signed idle timing correction in degrees. No causal torque inference.'} : {};
    plot.setData(entries,bounds.startMs,bounds.endMs,{...options,preserveViewport:true}); renderedPlot={traces,key};
  };
  const renderCoverage = () => {
    if (!accepted) return;
    const bounds = selectedBounds(); if (!bounds) return;
    const regions = scopeValue === 'regions' ? regionSession.includedBounds() : undefined;
    const stats = accepted.result.analysis;
    field('region-evidence').textContent = regions && !regions.length ? '0 included regions · No analysis samples. Graph view only.'
      : `${regions ? `${regionSession.regions.filter(region => region.included).length} included regions · ${regions.length} disjoint intervals · overlaps counted once · ` : ''}${(bounds.startMs / 1000).toFixed(3)}–${(bounds.endMs / 1000).toFixed(3)} s · ${stats.rpm.validSampleCount} valid RPM samples · ${stats.tracking?.sampleCount ?? 0} valid RPM/idle-target pairs · ${stats.complete ? 'Complete requested coverage' : 'Partial returned coverage'}.`;
  };
  const manageRegion = (action: IdleRegionAction) => {
    try {
      if (context.source?.descriptor?.format !== 'MLG') throw new Error('Load a recorded MLG before managing regions.');
      if (action.type === 'focus') {
        focusId = action.id; renderRegionControls(); renderTimeline();
        if (scopeValue === 'viewed') {
          const bounds = selectedBounds();
          startInput.value = bounds ? String(bounds.startMs / 1000) : '';
          endInput.value = bounds ? String(bounds.endMs / 1000) : '';
          void analyze();
        } else renderPlot();
        return;
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
      manager.message(action.type === 'analyze' ? 'Included regions selected. Overlapping samples count once.' : action.type === 'split' || action.type === 'merge' ? 'Region partition changed. Included sample union and manual-bypass policy preserved; shared endpoints count once.' : 'Region change accepted. Included scope updates analysis; View changes analysis only in Viewed region scope.');
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
    if (committed && (previous === 'regions' || previous === 'viewed')) focusId = 'logger';
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
  const retainedAirflow = () => {
    if (!accepted || !active || disposed) return undefined;
    if (!accepted.airflow) {
      const bind = (role: ContextRole) => {
        const trace = accepted!.traces.find(trace => trace.channel.id === accepted!.contextMapping[role]);
        return trace ? { range: trace.range, unit: idleRoleUnit(trace.channel, role)?.unit ?? '' } : undefined;
      };
      const basePosition = bind('basePosition'), closedLoop = bind('closedLoop'), finalPosition = bind('finalPosition');
      accepted.airflow = analyzeIdleAirflow({ rpm: accepted.rpm.range, sampleIndices: accepted.result.sampleIndices, ...(basePosition ? {basePosition} : {}), ...(closedLoop ? {closedLoop} : {}), ...(finalPosition ? {finalPosition} : {}) });
    }
    return accepted.airflow;
  };
  const invalidateModeEvidence = (kind: 'valve'|'pid'|'bias'|'ignition', positionChanged=false, referenceOnly=false) => {
    const preservePositionPlot=referenceOnly&&kind==='valve'&&!!accepted?.position&&!!renderedPlot;
    if (accepted) { delete accepted[kind]; if(positionChanged){delete accepted.position;delete accepted.bias;delete accepted.recovery;} }
    if (regionEvidence) retainFullEvidence(regionEvidence.source,regionEvidence.key,[]);
    syncMappingNote();
    if (mode === kind || positionChanged && (mode==='bias'||mode==='recovery')) {
      controllerRequest++; controllerPendingKey=undefined; controllerError=undefined;
      renderAssessment(); if(!preservePositionPlot)renderPlot(); void ensureModeEvidence(preservePositionPlot);
    }
  };
  // Native recorded modes share this existing source/request boundary. Each
  // accepted result keeps its own facts; no second controller/session framework.
  const ensureModeEvidence = async (preservePositionPlot=false) => {
    if (!active || disposed || (mode !== 'valve' && mode !== 'pid' && mode!=='bias' && mode!=='ignition' && mode!=='recovery') || !accepted) return;
    const kind=mode, base=accepted, captured=context, source=captured.source;
    if (!source || source.identity !== base.source || !captured.sourceTimeRange) return;
    const reference=kind==='valve'?Number(field<HTMLInputElement>('motor-reference').value.trim()||NaN):undefined;
    const recoverySettings=kind==='recovery'?{sagRpm:Number(field<HTMLInputElement>('recovery-sag').value.trim()||NaN),bandRpm:Number(field<HTMLInputElement>('recovery-band').value.trim()||NaN),dwellMs:Number(field<HTMLInputElement>('recovery-dwell').value.trim()||NaN),maxGapMs:Number(field<HTMLInputElement>('recovery-gap').value.trim()||NaN)}:undefined;
    const mapping: Record<string,string>={...(kind==='valve'||kind==='recovery'?valveIds:kind==='bias'?{...valveIds,...biasIds}:kind==='ignition'?ignitionIds:pidIds)}, key=JSON.stringify([base.key,kind,mapping,reference,recoverySettings]);
    if(base[kind]?.key===key){renderPlot();return;}
    if(controllerPendingKey===key)return;
    const request=++controllerRequest, baseGeneration=generation;
    const current=()=>active&&!disposed&&mode===kind&&accepted===base&&generation===baseGeneration&&controllerRequest===request;
    controllerPendingKey=key;controllerError=undefined;delete base[kind];renderAssessment();if(!preservePositionPlot)renderPlot();
    try {
      if(recoverySettings)validateIdleRecoverySettings(recoverySettings);
      if(kind==='valve'&&(reference===undefined||!Number.isFinite(reference)||reference<=0||reference>100))throw new Error('Enter a motor-duty reference above 0 and at most 100%.');
      const ids=[...new Set(Object.values(mapping).filter(Boolean))], bounds=captured.sourceTimeRange;
      const cached=regionEvidence?.source===base.source&&regionEvidence.key===base.evidenceKey?regionEvidence.traces:[];
      const reusable=(trace:LoggerAnalysisTraceContext)=>trace.complete||numericRangeCoversTime(trace.range,bounds.startMs,bounds.endMs);
      const missing=ids.filter(id=>!cached.some(trace=>trace.channel.id===id&&reusable(trace)));
      const loaded=missing.length?await captured.loadTraces(missing,bounds.startMs,bounds.endMs):[];
      if(!current())return;
      const traces=ids.flatMap(id=>{const trace=loaded.find(trace=>trace.channel.id===id)??cached.find(trace=>trace.channel.id===id&&reusable(trace));return trace?[trace]:[];});
      const bind=(role:ValveRole|PidRole|BiasRole|IgnitionRole)=>{const trace=traces.find(trace=>trace.channel.id===mapping[role]);return trace?{range:trace.range,unit:(IGNITION_ROLES.includes(role as IgnitionRole)?idleIgnitionRoleUnit(trace.channel,role as IgnitionRole):PID_ROLES.includes(role as PidRole)?idlePidRoleUnit(trace.channel,role as PidRole):BIAS_ROLES.includes(role as BiasRole)?idlePositionPidRoleUnit(trace.channel,role as BiasRole):idleRoleUnit(trace.channel,role as ValveRole))?.unit??''}:undefined;};
      owner.event(`idle.${kind}.request`,{samples:base.result.sampleIndices.length});
      if(kind==='valve'||kind==='bias'||kind==='recovery'){
        const positionKey=JSON.stringify([base.key,{dcTarget:mapping.dcTarget,dcPosition:mapping.dcPosition,dcOutput:mapping.dcOutput}]);
        if(base.position?.key!==positionKey){
          owner.event('idle.position.request',{samples:base.result.sampleIndices.length});
          base.position={key:positionKey,result:analyzeIdleValvePosition({rpm:base.rpm.range,sampleIndices:base.result.sampleIndices,requested:bind('dcTarget'),measured:bind('dcPosition'),motor:bind('dcOutput')})};
        }
        if(kind==='valve')base.valve={key,result:withIdleMotorReference(base.position.result,reference!),traces};
        else if(kind==='recovery'){
          const eventKey=JSON.stringify([base.key,recoverySettings]);
          if(base.recoveryEvents?.key!==eventKey){owner.event('idle.recovery.events.request',{samples:base.result.sampleIndices.length});base.recoveryEvents={key:eventKey,result:analyzeIdleRecovery({rpm:base.rpm.range,target:base.target?.range,sampleIndices:base.result.sampleIndices,regions:base.regions,settings:recoverySettings!,integrity:captured.sourceIntegrity})};recoveryEventIndex=0;recoveryEventFocus=false;}
          base.recovery={key,result:base.recoveryEvents.result,position:base.position.result,traces};
        }
        else base.bias={key,result:analyzeIdlePositionPid({position:base.position.result,feedForward:bind('dcBiasOutput'),p:bind('dcP'),i:bind('dcI'),d:bind('dcD')}),traces};
        for(const role of VALVE_ROLES)if(mapping[role]&&traces.some(trace=>trace.channel.id===mapping[role]))retainedValveIds[role]=mapping[role]!;
        if(kind==='bias')for(const role of BIAS_ROLES)if(mapping[role]&&traces.some(trace=>trace.channel.id===mapping[role]))retainedBiasIds[role]=mapping[role]!;
      }else if(kind==='ignition'){
        base.ignition={key,result:analyzeIdleIgnition({rpm:base.rpm.range,sampleIndices:base.result.sampleIndices,advance:bind('ignitionAdvance'),correction:bind('ignitionCorrection'),lambda:bind('ignitionLambda')}),traces};
        for(const role of IGNITION_ROLES)if(mapping[role]&&traces.some(trace=>trace.channel.id===mapping[role]))retainedIgnitionIds[role]=mapping[role]!;
      }else{
        const trace=base.traces.find(trace=>trace.channel.id===base.contextMapping.closedLoop);
        const applied=trace?{range:trace.range,unit:idleRoleUnit(trace.channel,'closedLoop')?.unit??''}:undefined;
        const result=analyzeIdleRpmPid({rpm:base.rpm.range,sampleIndices:base.result.sampleIndices,p:bind('p'),i:bind('i'),d:bind('d'),output:bind('pidOutput'),applied});
        base.pid={key,result,traces};
        for(const role of PID_ROLES)if(mapping[role]&&traces.some(trace=>trace.channel.id===mapping[role]))retainedPidIds[role]=mapping[role]!;
      }
      if(traces.every(reusable))retainFullEvidence(base.source,base.evidenceKey,traces);
      renderAssessment();renderPlot();
      const tracking=base.valve?.result.tracking;
      owner.event(`idle.${kind}.accepted`,{samples:kind==='valve'?tracking&&'statistics' in tracking?tracking.statistics.validSampleCount:0:base.result.sampleIndices.length});
    }catch(error){
      if(!current())return;
      controllerError=error instanceof Error?error.message:'Could not load recorded mode evidence. Retry Run Analysis.';
    }finally{if(current()){controllerPendingKey=undefined;renderAssessment();}}
  };
  const renderAssessment = () => {
    field<HTMLSelectElement>('mode').value = mode;
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-idle-tab]')) button.setAttribute('aria-pressed', String(button.dataset.idleTab === tab));
    field('recovery-references').hidden=mode!=='recovery';field('recovery-metrics').hidden=mode!=='recovery';field('recovery-settings').hidden=mode!=='recovery';field('recovery-events').hidden=mode!=='recovery';
    const recovery=mode==='recovery'?accepted?.recovery?.result:undefined;
    const event=recovery?.events[recoveryEventIndex];
    field('recovery-count').textContent=recovery?.status==='recorded'?String(recovery.events.length):'Unavailable';
    for(const [name,value]of [['recovery-low',accepted?.result.analysis.rpm.min],['recovery-worst',accepted?.result.analysis.tracking?Math.max(Math.abs(accepted.result.analysis.tracking.maxNegativeError??NaN),Math.abs(accepted.result.analysis.tracking.maxPositiveError??NaN)):undefined]] as const)field(name).textContent=number(value);
    field('recovery-tracking').textContent=mode==='recovery'&&accepted?.recovery?idleAirflowValue(accepted.recovery.position.tracking,'rootMeanSquare'):'—';
    field('recovery-summary').textContent=recovery?`${recovery.recoveredCount} confirmed · ${recovery.censoredCount} censored · ${recovery.validPairs} valid aligned pairs`:controllerError??'Recovery evidence required';
    field<HTMLInputElement>('recovery-event').max=String(recovery?.events.length??0);field<HTMLInputElement>('recovery-event').value=String(recoveryEventIndex+1);field<HTMLInputElement>('recovery-event').disabled=!recovery?.events.length;field<HTMLButtonElement>('recovery-view').disabled=!event;
    field('stability-metrics').hidden = mode !== 'stability'; field('airflow-metrics').hidden = mode !== 'airflow'; field('valve-metrics').hidden = mode !== 'valve'; field('pid-metrics').hidden = mode !== 'pid'; field('bias-metrics').hidden=mode!=='bias'; field('ignition-metrics').hidden=mode!=='ignition';
    const ignition=mode==='ignition'&&accepted?.ignition?presentIdleIgnition(accepted.ignition.result,accepted.result.analysis.complete&&(accepted.qualification?.complete??true)):undefined;
    for(const [name,value]of [['ignition-advance',ignition?.advanceMean],['ignition-correction',ignition?.correctionMean],['ignition-lambda',ignition?.lambdaMean]] as const)field(name).textContent=value??'—';
    field('ignition-rmse').textContent=accepted?number(accepted.result.analysis.tracking?.rmse):'—';
    const bias=mode==='bias'&&accepted?.bias?presentIdlePositionPid(accepted.bias.result,accepted.result.analysis.complete&&(accepted.qualification?.complete??true)):undefined;
    for(const [name,value]of [['bias-i',bias?.iMean],['bias-feed',bias?.feedMean],['bias-motor',bias?.motorMean],['bias-tracking',bias?.trackingRms]] as const)field(name).textContent=value??'—';
    field('bias-i-label').textContent='Inner position I mean'+(bias?` · ${bias.roles[2]!.unit}`:'');
    field('bias-feed-label').textContent='Logged feed-forward mean'+(bias?` · ${bias.roles[0]!.unit}`:'');
    const pid=mode==='pid'&&accepted?.pid ? presentIdleRpmPid(accepted.pid.result,accepted.result.analysis.complete&&(accepted.qualification?.complete??true)) : undefined;
    for(const [name,value]of [['pid-p',pid?.pRms],['pid-i',pid?.iMean],['pid-d',pid?.dRms],['pid-applied',pid?.appliedMean]] as const)field(name).textContent=value??'—';
    for(const [role,label,index]of [['p','Logged P RMS',0],['i','Logged I mean',1],['d','Logged D RMS',2]] as const)field(`pid-${role}-label`).textContent=label+(pid?` · ${pid.roles[index]!.unit}`:'');
    const valve = mode === 'valve' && accepted?.valve ? presentIdleValveTracking(accepted.valve.result, accepted.result.analysis.complete && (accepted.qualification?.complete ?? true)) : undefined;
    for (const [name, value] of [['valve-rmse',valve?.rmse],['valve-error',valve?.signedError],['valve-motor',valve?.motorMean],['valve-reference',valve?.reference]] as const) field(name).textContent = value ?? '—';
    field('valve-reference-label').textContent = `|Motor duty| ≥ ${field<HTMLInputElement>('motor-reference').value}% · reference`;
    const airflow = mode === 'airflow' ? retainedAirflow() : undefined;
    for (const [name, metric, value] of [['airflow-base', airflow?.basePosition, 'mean'], ['airflow-correction', airflow?.closedLoop, 'mean'], ['airflow-final', airflow?.finalPosition, 'mean'], ['airflow-rms', airflow?.closedLoop, 'rootMeanSquare']] as const) field(name).textContent = metric ? idleAirflowValue(metric, value) : '—';
    const panel = field('assessment'); panel.replaceChildren();
    if (!accepted) { panel.append(section('Recorded evidence required', 'Choose an RPM channel and a recorded region, then run analysis. Target-dependent metrics remain unavailable without a compatible target channel.')); return; }
    const { analysis, inBandPercent } = accepted.result;
    const purposes = scopeValue === 'regions' ? regionSession.regions.filter(region => region.included) : scopeValue === 'manual' || scopeValue === 'viewed' ? regionSession.regions.filter(region => region.id === (scopeValue === 'viewed' ? focusId : manualId)) : [];
    const assessment = assessIdleStability(accepted.result, summarizeIdlePurposes(purposes.map(region => region.purpose)));
    const presentation = presentIdleStabilityAssessment(assessment, accepted.qualification);
    panel.append(section('Declared test purpose', presentation.purpose));
    if (accepted.qualification) panel.append(section('Applied qualification', `${accepted.qualification.description}. ${accepted.qualification.eligible}/${accepted.qualification.input} original records eligible; ${accepted.qualification.rejected} value-rejected, ${accepted.qualification.invalid} invalid, ${accepted.qualification.unavailable} unavailable; ${accepted.qualification.manualBypassed} valid records manually bypassed. Invalid counts may include recovered retry attempts and do not by themselves establish physical data loss.`));
    if (scopeValue === 'regions') panel.append(section('Analysis scope', `${regionSession.regions.filter(region => region.included).length} included regions; overlapping recorded samples count once. Graph focus can show an excluded interval and does not affect these measurements.`));
    if (scopeValue === 'viewed') panel.append(section('Analysis scope', analysisScopeLabel() + '. Inclusion checkboxes do not change this selection.'));
    if(mode==='recovery'){
      if(!recovery){panel.append(section('Recovery evidence required',controllerError??'Run analysis with compatible recorded RPM and idle target.'));return;}
      const limits='Sampled dwell is not proof of continuous unobserved settling. No load cause, ECU controller cadence, gain or tuning improvement is inferred. Invalid attempts (including retries without verified replacement identity) conservatively break runs. Events at boundaries are censored; no recovery outside the accepted scope is borrowed. Graphs may retain unqualified recorded context.';
      const policy=`Sag ≥ ${recovery.settings.sagRpm} RPM below target; band ±${recovery.settings.bandRpm} RPM; dwell ${recovery.settings.dwellMs} ms; maximum gap ${recovery.settings.maxGapMs} ms. References are user-selected, not firmware limits.`;
      panel.append(section('Recovery evidence',recovery.status==='missing-target'?'Target unavailable; event detection is unavailable, not zero events.':`${recovery.events.length} sag events; ${recovery.recoveredCount} confirmed, ${recovery.censoredCount} censored. ${recovery.validPairs} valid aligned pairs; ${recovery.invalidPairs} invalid/unavailable pairs. ${analysis.complete?'Complete':'Partial'} requested coverage.`));
      if(tab!=='next'){
        panel.append(section('Detection and settling references',policy));
        if(event)panel.append(section(`Event ${recoveryEventIndex+1} · original sample ${event.id}`,`Onset ${(event.onsetMs/1000).toFixed(3)} s; last below threshold ${(event.lastBelowMs/1000).toFixed(3)} s; minimum ${number(event.minimumRpm)} RPM; deepest actual−target ${number(event.minimumErrorRpm)} RPM. ${event.status==='recovered'?`Recovery ${number(event.recoveryMs)} ms from onset; first settled observation ${(event.settlingMs!/1000).toFixed(3)} s; confirmed at ${(event.confirmationMs!/1000).toFixed(3)} s.`:`Censored (${event.reason}); recovery unavailable.`}`));
        else if(recovery.status==='recorded')panel.append(section('No detected sag','No threshold crossing in valid selected observations; this does not establish healthy idle or absence of an unrecorded event.'));
        if(tab==='evidence')for(const [label,metric]of [['Requested valve',accepted.recovery!.position.requested],['Measured valve',accepted.recovery!.position.measured],['Signed motor duty',accepted.recovery!.position.motor],['Measured−requested tracking',accepted.recovery!.position.tracking]] as const)panel.append(section(label,idleRecordedCoverage(metric)));
        if(tab==='evidence')panel.append(section('Source authority',`${context.source?.descriptor?.displayName??'Source unavailable'}. ${mappingDescription()}. Overlapping selected regions count once. Canonical source-integrity markers break runs; display text is not analytical authority.`));
      }else panel.append(section('Recommended action','Inspect the selected event against recorded RPM/target and load context. Repeat matched temperature and loads. Review censored events and missing coverage before comparing recovery.'),section('Hold constant',presentation.holdConstant));
      panel.append(section('Limits of inference',limits));return;
    }
    if(mode==='ignition'){
      if(!ignition){panel.append(section('Ignition evidence required',controllerError??(controllerPendingKey?'Loading recorded ignition evidence…':'Map compatible recorded degree channels and optional actual lambda.')));return;}
      const next=assessment.findings.includes('purpose-review')?presentation.next+' '+ignition.next:ignition.next;
      if(tab==='diagnosis')panel.append(section('Evidence status',ignition.status),section('Recorded ignition behavior',ignition.observed),section('RPM context',`${analysis.rpm.validSampleCount} valid RPM records; logged-target RMSE ${number(analysis.tracking?.rmse)} RPM.`),section('Limits of inference',ignition.limits),section('Next test',next));
      else if(tab==='evidence'){
        panel.append(section('Source and unit authority',`${context.source?.descriptor?.displayName??'Source unavailable'}. ${mappingDescription()}. The original source angle signs/reference are retained; no ATDC or radians conversion is applied.`));
        for(const role of ignition.roles)panel.append(section(role.label,`Mean ${role.mean}, RMS ${role.rms} ${role.unit}; ${role.coverage}`));
        panel.append(section('RPM context',`${analysis.rpm.validSampleCount} valid RPM records; logged-target RMSE ${number(analysis.tracking?.rmse)} RPM.`),section('Limits of inference',ignition.limits));
      }else panel.append(section('Recommended action',next),section('Hold constant',presentation.holdConstant),section('What would support it?',ignition.supports),section('What would contradict it?',ignition.contradicts),section('Limits of inference',ignition.limits));
      return;
    }
    if(mode==='bias'){
      if(!bias){panel.append(section('Position PID evidence required',controllerError??(controllerPendingKey?'Loading recorded position-controller evidence…':'Map logged inner position terms and feed-forward.')));return;}
      const next=assessment.findings.includes('purpose-review')?presentation.next+' '+bias.next:bias.next;
      if(tab==='diagnosis')panel.append(section('Evidence status',bias.status),section('Recorded position-controller behavior',bias.observed),section('Limits of inference',bias.limits),section('Next test',next));
      else if(tab==='evidence'){
        panel.append(section('Source and unit authority',`${context.source?.descriptor?.displayName??'Source unavailable'}. ${mappingDescription()}. Original indices and exact timestamps remain authoritative.`));
        for(const role of bias.roles)panel.append(section(role.label,`Mean ${role.mean}, RMS ${role.rms} ${role.unit}; ${role.coverage}`));
        for(const gate of bias.gates)panel.append(section(gate.label,gate.value));
        if(!accepted.bias?.result.termPlotUnit)panel.append(section('Term graph eligibility','Missing or mixed term units cannot share one axis; individual measurements remain available above. Motor duty keeps its own axis.'));
        panel.append(section('Limits of inference',bias.limits));
      }else panel.append(section('Recommended action',next),section('Hold constant',presentation.holdConstant),section('What would support it?',bias.supports),section('What would contradict it?',bias.contradicts),section('Limits of inference',bias.limits));
      return;
    }
    if(mode==='pid') {
      if(!pid){panel.append(section('RPM PID evidence required',controllerError??(controllerPendingKey?'Loading logged RPM PID evidence…':'Map compatible logged outer-controller terms.')));return;}
      const next=assessment.findings.includes('purpose-review')?presentation.next+' '+pid.next:pid.next;
      if(tab==='diagnosis')panel.append(section('Evidence status',pid.status),section('Recorded RPM PID behavior',pid.observed),section('Limits of inference',pid.limits),section('Next test',next));
      else if(tab==='evidence'){
        panel.append(section('Source and unit authority',`${context.source?.descriptor?.displayName??'Source unavailable'}. ${mappingDescription()}. Each role retains exact original-index/time alignment and its own valid denominator.`));
        for(const role of pid.roles)panel.append(section(role.label,`Mean ${role.mean}, RMS ${role.rms} ${role.unit}; ${role.coverage}`));
        for(const gate of pid.gates)panel.append(section(gate.label,gate.value));
        if(!accepted.pid?.result.termPlotUnit)panel.append(section('Term graph eligibility','Missing or mixed term units cannot share one axis. Independent numerical evidence remains above; applied correction stays on its own axis.'));
        panel.append(section('RPM context',`${analysis.rpm.validSampleCount} valid RPM samples; logged-target RMSE ${number(analysis.tracking?.rmse)} RPM.`),section('Limits of inference',pid.limits));
      }else panel.append(section('Recommended action',next),section('Hold constant',presentation.holdConstant),section('What would support it?',pid.supports),section('What would contradict it?',pid.contradicts),section('Limits of inference',pid.limits));
      return;
    }
    if (mode === 'valve') {
      if (!valve) { panel.append(section('Valve evidence required', controllerError ?? (controllerPendingKey ? 'Loading recorded valve evidence…' : 'Select compatible recorded requested/measured position channels.'))); return; }
      const next = assessment.findings.includes('purpose-review') ? presentation.next + ' ' + valve.next : valve.next;
      if (tab === 'diagnosis') panel.append(section('Evidence status',valve.status),section('Recorded valve behavior',valve.observed),section('Limits of inference',valve.limits),section('Next test',next));
      else if (tab === 'evidence') {
        panel.append(section('Source and unit authority',`${context.source?.descriptor?.displayName ?? 'Source unavailable'}. ${mappingDescription()}. Exact original-index and timestamp alignment is required.`));
        for (const role of valve.roles) panel.append(section(role.label,`${role.value}; ${role.coverage}`));
        panel.append(section('Motor reference coverage',valve.observed),section('Limits of inference',valve.limits));
      } else panel.append(section('Recommended action',next),section('Hold constant',presentation.holdConstant),section('What would support it?',valve.supports),section('What would contradict it?',valve.contradicts),section('Limits of inference',valve.limits));
      return;
    }
    if (airflow) {
      const view = presentIdleAirflow(airflow, analysis.complete && (accepted.qualification?.complete ?? true));
      const next = !analysis.rpm.validSampleCount || ['source', 'coverage', 'known-idle', 'longer-region'].includes(assessment.nextTest) || assessment.findings.includes('purpose-review') ? presentation.next : view.next;
      const limits = view.limits + ' ' + presentation.limits;
      if (tab === 'diagnosis') {
        panel.append(section('Evidence status', view.status), section('Recorded request behavior', view.observed));
        for (const role of view.roles) panel.append(section(role.label + ' coverage', role.coverage));
        panel.append(section('Limits of inference', limits), section('Next test', next));
      } else if (tab === 'evidence') {
        panel.append(section('Source and unit authority', `${context.source?.descriptor?.displayName ?? 'Source unavailable'}. ${mappingDescription()}. Original indices and exact timestamps are retained; each request uses its own valid aligned denominator.`));
        for (const role of view.roles) panel.append(section(role.label, `${role.value}; ${role.coverage}`));
        panel.append(section('RPM context', `${analysis.rpm.validSampleCount} valid RPM samples; sample sigma ${number(analysis.rpm.standardDeviation)} RPM; logged-target RMSE ${number(analysis.tracking?.rmse)} RPM. ${analysis.complete ? 'Complete requested RPM coverage' : 'Partial requested RPM coverage'}. Physical source-integrity warnings remain in Diagnostics.`), section('Limits of inference', limits));
      } else panel.append(section('Recommended action', next), section('Hold constant', presentation.holdConstant), section('What would support it?', view.supports), section('What would contradict it?', view.contradicts), section('Limits of inference', limits));
      return;
    }
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
    controllerRequest++; controllerPendingKey = undefined; controllerError = undefined;
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
    if (sourceChanged || catalogChanged) { retainedValveIds = {dcTarget:'',dcPosition:'',dcOutput:''}; retainedPidIds={p:'',i:'',d:'',pidOutput:''}; retainedBiasIds={dcBiasOutput:'',dcP:'',dcI:'',dcD:''}; retainedIgnitionIds={ignitionAdvance:'',ignitionCorrection:'',ignitionLambda:''}; }
    if (catalogChanged) regionEvidence = undefined;
    if (sourceChanged) { if (scopeValue !== 'viewed') scopeValue = 'full'; manualId = undefined; }
    else scopeValue = retainedAnalyzerScopeValue(scopeValue, context, next);
    context = next;
    tuneContext.setRecording(next.source?.descriptor?.displayName??'No recording');
    if (sourceChanged || catalogChanged || !rpmSelect.options.length) {
      const initialized = rpmSelect.options.length > 0;
      const choices = [[rpmSelect, 'rpm', rpmId], [targetSelect, 'target', targetId], ...CONTEXT_ROLES.map(role => [contextSelects[role], role, contextIds[role]] as const), ...VALVE_ROLES.map(role => [valveSelects[role],role,valveIds[role]] as const), ...PID_ROLES.map(role=>[pidSelects[role],role,pidIds[role]] as const), ...BIAS_ROLES.map(role=>[biasSelects[role],role,biasIds[role]] as const), ...IGNITION_ROLES.map(role=>[ignitionSelects[role],role,ignitionIds[role]] as const)] as const;
      for (const [select, role, old] of choices) {
        const unitFor=(channel: typeof context.channels[number])=>IGNITION_ROLES.includes(role as IgnitionRole)?idleIgnitionRoleUnit(channel,role as IgnitionRole):BIAS_ROLES.includes(role as BiasRole)?idlePositionPidRoleUnit(channel,role as BiasRole):PID_ROLES.includes(role as PidRole)?idlePidRoleUnit(channel,role as PidRole):idleRoleUnit(channel,role as 'rpm'|'target'|ContextRole|ValveRole);
        const channels = context.channels.filter(channel => unitFor(channel));
        select.replaceChildren(new Option(role === 'rpm' ? 'Select RPM channel' : 'Unavailable / not selected', ''));
        for (const channel of channels) {
          const unit = unitFor(channel)!;
          select.add(new Option(`${analyzerChannelOptionLabel(channel)}${unit.authority === 'canonical-role' ? ` [${unit.unit} · canonical role]` : unit.authority==='unspecified' ? ' [raw · engineering unit unspecified]' : ''}`, channel.id));
        }
        select.value = !sourceChanged && initialized ? channels.some(channel => channel.id === old) ? old : '' : (role==='ignitionLambda'?preferredIdleIgnitionLambda(channels):suggestAnalyzerChannel('idle',role,channels))?.id ?? '';
      }
      contextIds = Object.fromEntries(CONTEXT_ROLES.map(role => [role, contextSelects[role].value])) as Record<ContextRole, string>;
      ignitionIds=Object.fromEntries(IGNITION_ROLES.map(role=>[role,ignitionSelects[role].value])) as Record<IgnitionRole,string>;
      biasIds=Object.fromEntries(BIAS_ROLES.map(role=>[role,biasSelects[role].value])) as Record<BiasRole,string>;
      pidIds=Object.fromEntries(PID_ROLES.map(role=>[role,pidSelects[role].value])) as Record<PidRole,string>;
      valveIds = Object.fromEntries(VALVE_ROLES.map(role => [role,valveSelects[role].value])) as Record<ValveRole,string>;
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
    const options = [...analyzerScopeOptions(context), { value: 'regions', kind: 'range' as const, label: 'Included regions combined' }, { value: 'viewed', kind: 'range' as const, label: 'Viewed region' }];
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
      status(scopeValue === 'viewed' && !bounds ? 'Select a managed region for Viewed region analysis.' : 'Load a recorded source with RPM units and select a nonzero region.'); return;
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
      && (!needsFullEvidence || (regionEvidence?.source === source.identity && regionEvidence.key === evidenceKey))) { if (managed) renderPlot(); renderCoverage(); renderAssessment(); if (mode === 'valve' || mode === 'pid' || mode==='bias' || mode==='ignition' || mode==='recovery') void ensureModeEvidence(); return; }
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
      if (captured.sourceTimeRange && readBounds.startMs <= captured.sourceTimeRange.startMs && readBounds.endMs >= captured.sourceTimeRange.endMs && traces.every(trace => trace.complete || numericRangeCoversTime(trace.range, readBounds.startMs, readBounds.endMs))) retainFullEvidence(source.identity, evidenceKey, traces);
      const qualification = plan.enabled ? { ...qualifyIdleSamples({referenceId:requestedRpm,channels:new Map(traces.map(trace=>[trace.channel.id,{range:trace.range,complete:trace.complete}])),conditions:plan.conditions,scope:regions??[bounds],bypass:plan.bypass}), description:plan.description } : undefined;
      const result = analyzeIdleStability(rpm.range, target?.range, { ...bounds, ...(regions ? { regions } : {}), ...(qualification ? {eligibility:qualification.eligibility} : {}), complete:complete && (qualification?.complete??true) });
      accepted = { regions:regions??[bounds], contextMapping: requestedContext, source: source.identity, key, result, qualification, evidenceKey, rpm, target, traces };
      const stats = result.analysis;
      field('sigma').textContent = number(stats.rpm.standardDeviation);
      field('rmse').textContent = number(stats.tracking?.rmse);
      field('in-band').textContent = result.inBandPercent === undefined ? 'Unavailable' : `${number(result.inBandPercent, 1)}%`;
      field('samples').textContent = stats.rpm.validSampleCount.toLocaleString();
      renderCoverage();
      renderPlot();
      status(qualification && !qualification.eligible && qualification.input ? !qualification.rejected&&(qualification.invalid||qualification.unavailable) ? 'Qualification evidence unavailable or misaligned.' : 'No records match selected qualification conditions.' : regions && !regions.length ? 'No included regions. Graph focus is excluded from analysis.' : stats.rpm.validSampleCount ? complete ? 'Recorded evidence' : 'Partial recorded evidence' : 'No valid RPM evidence');
      renderAssessment(); if (mode === 'valve' || mode === 'pid' || mode==='bias' || mode==='ignition' || mode==='recovery') void ensureModeEvidence();
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
      select.replaceChildren(new Option(result.totalCount ? 'Use candidate as Logger A/B…' : 'No matching candidate intervals', ''));
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
  for(const name of ['sag','band','dwell','gap'])listen(field(`recovery-${name}`),()=>{
    controllerError=undefined;
    if(mode==='recovery'){renderAssessment();renderPlot();void ensureModeEvidence();}
  },'change');
  listen(field('recovery-event'),()=>{const value=Number(field<HTMLInputElement>('recovery-event').value);if(Number.isInteger(value)&&value>=1&&value<=(accepted?.recovery?.result.events.length??0)){recoveryEventIndex=value-1;renderAssessment();if(recoveryEventFocus)renderPlot();}},'change');
  listen(field('tune-tables'),()=>tuneContext.open(mode==='pid'?'rpmPid':mode==='bias'||mode==='valve'?'bias':mode==='ignition'?'spark':'base'));
  listen(field('recovery-references'),()=>{field<HTMLDetailsElement>('recovery-settings').open=!field<HTMLDetailsElement>('recovery-settings').open;});
  listen(field('recovery-view'),()=>{recoveryEventFocus=true;renderPlot();});
  listen(field('recovery-all'),()=>{recoveryEventFocus=false;renderPlot();});
  listen(field('mode'), () => { const value = field<HTMLSelectElement>('mode').value; if (value === 'stability' || value === 'airflow' || value === 'valve' || value === 'pid' || value==='bias' || value==='ignition'||value==='recovery') { controllerRequest++; controllerPendingKey=undefined; mode = value; renderAssessment(); renderPlot(); if(mode==='valve'||mode==='pid'||mode==='bias'||mode==='ignition' || mode==='recovery')void ensureModeEvidence(); } }, 'change');
  for (const role of VALVE_ROLES) listen(valveSelects[role], () => { valveIds[role]=valveSelects[role].value; invalidateModeEvidence('valve',true); }, 'change');
  for(const role of IGNITION_ROLES)listen(ignitionSelects[role],()=>{ignitionIds[role]=ignitionSelects[role].value;invalidateModeEvidence('ignition');},'change');
  for(const role of BIAS_ROLES)listen(biasSelects[role],()=>{biasIds[role]=biasSelects[role].value;invalidateModeEvidence('bias');},'change');
  listen(field('motor-reference'),()=>invalidateModeEvidence('valve',false,true),'change');
  for(const role of PID_ROLES)listen(pidSelects[role],()=>{pidIds[role]=pidSelects[role].value;invalidateModeEvidence('pid');},'change');
  listen(rpmSelect, () => { resetDiscovery(); rpmId = rpmSelect.value; syncMappingNote(); void analyze(); }, 'change');
  for (const role of CONTEXT_ROLES) listen(contextSelects[role], () => { contextIds[role] = contextSelects[role].value; syncMappingNote(); void analyze(); }, 'change');
  listen(field('manage-regions'), () => { renderRegionControls(); manager.open(); });
  listen(field('focus'), () => manageRegion({ type: 'focus', id: field<HTMLSelectElement>('focus').value }), 'change');
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
      active = next; plot.setActive(next);tuneContext.setActive(next);
      if (!next) { controllerRequest++; controllerPendingKey=undefined; manager.close(); rangeInteraction.cancel(); generation += 1; discoveryGeneration += 1; discoveryPending = false; field<HTMLButtonElement>('discover').disabled = false; pendingKey = undefined; return; }
      if (pendingContext) { const nextContext = pendingContext; pendingContext = undefined; configure(nextContext); }
      void analyze();
    },
    setTuneModel(model:TuneModel|undefined,sourceName?:string){if(!disposed)tuneContext.setTuneModel(model,sourceName);},
    setContext(next: LoggerAnalysisContext) {
      if (disposed) return;
      if (!active) { pendingContext = next; return; }
      configure(next); if (!committingRange) void analyze();
    },
    refresh() { void analyze(); },
    dispose() { tuneContext.dispose();disposed = true; active = false; generation += 1; discoveryGeneration += 1; discovery = undefined; regionEvidence = undefined; manager.close(); accepted = undefined; pendingContext = undefined; rangeInteraction.cancel(); events.abort(); plot.dispose(); },
  };
}
