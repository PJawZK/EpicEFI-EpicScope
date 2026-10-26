import '../styles/idle-analyzer.css';
import type { LoggerAnalysisContext, LoggerAnalysisTraceContext } from './logger-page';
import { analyzerScopeOptions, analyzerScopeBounds, retainedAnalyzerScopeValue } from './analyzer-scope';
import { analyzerChannelOptionLabel, suggestAnalyzerChannel } from './analyzer-channel-roles';
import { sameChannelOptionCatalog } from './channel-option-label';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import { analyzeIdleStability, type IdleStabilityResult } from '../../../../core/analysis/idle-stability';
import { createIdleStabilityPlot } from './idle-stability-plot';
import { createOwnerEvidence } from '../observability/producers/owner';
import type { ObservabilityRecorder } from '../observability/recorder';

type Tab = 'diagnosis' | 'evidence' | 'next';
const EMPTY_CONTEXT: LoggerAnalysisContext = { channels: [], traces: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };
const number = (value: number | undefined, decimals = 2) => value === undefined || !Number.isFinite(value) ? 'Unavailable' : value.toFixed(decimals);
const rpmCompatible = (channel: LoggerAnalysisContext['channels'][number]) => channel.valueType !== 'bitfield' && ['rpm', 'rev/min'].includes(channel.unit?.trim().toLowerCase() ?? '');

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
  let accepted: { source: object; key: string; result: IdleStabilityResult; rpm: LoggerAnalysisTraceContext; target: LoggerAnalysisTraceContext | undefined } | undefined;
  let rpmId = '';
  let targetId = '';
  let scopeValue = 'full';
  let manual: { startMs: number; endMs: number } | undefined;
  let tab: Tab = 'diagnosis';
  const root = document.createElement('section');
  root.className = 'idle-analyzer-view';
  root.hidden = true;
  root.innerHTML = `
    <header class="idle-toolbar"><label>Mode <select aria-label="Idle diagnostic mode" data-idle="mode"><option>Stability</option>
      <option disabled>Base Airflow — not integrated</option><option disabled>RPM PID — not integrated</option><option disabled>DC Valve Tracking — not integrated</option>
      <option disabled>DC Bias / Position PID — not integrated</option><option disabled>Ignition — not integrated</option><option disabled>Load Recovery — not integrated</option><option disabled>Compare — not integrated</option></select></label>
      <span data-idle="source">Load a recorded MLG through Open Log.</span><strong class="idle-readonly">READ ONLY · NATIVE STABILITY</strong>
      <button type="button" data-idle="logger">↗ Logger</button></header>
    <div class="idle-workspace"><div class="idle-main"><div class="idle-metrics" aria-label="Stability measurements">
      <div><strong data-idle="sigma">—</strong><span>RPM σ · sample</span></div><div><strong data-idle="rmse">—</strong><span>RPM error RMSE</span></div>
      <div><strong data-idle="in-band">—</strong><span>Within ±40 RPM</span></div><div><strong data-idle="samples">—</strong><span>Valid RPM samples</span></div></div>
      <div data-idle="plot"></div><div class="idle-plot-tools"><span>Actual RPM · Target RPM / Error · min/max envelope for dense recordings</span>
      <button type="button" data-idle="fit">Fit region</button></div><p>Wheel / + −: zoom · drag / arrows: pan · Home / double-click: fit. Graph navigation does not change analysis scope.</p>
      <section class="idle-region-evidence"><strong>Recorded region evidence</strong><p data-idle="region-evidence">No accepted analysis.</p></section></div>
      <aside class="idle-assessment"><header><strong>Diagnostic assessment</strong><span data-idle="status" role="status" aria-live="polite">Load a recording.</span></header>
        <nav aria-label="Idle assessment"><button type="button" data-idle-tab="diagnosis">Diagnosis</button><button type="button" data-idle-tab="evidence">Evidence</button><button type="button" data-idle-tab="next">Next Test</button></nav>
        <div data-idle="assessment"></div></aside></div>
    <section class="idle-setup" aria-label="Idle source and region"><label>RPM <select data-idle="rpm" aria-label="Idle RPM channel"></select></label>
      <label>Idle target <select data-idle="target" aria-label="Idle target channel"></select></label>
      <label>Log Scope <select data-idle="scope" aria-label="Idle analysis scope"></select></label>
      <label>Region start (s)<input type="number" step="any" data-idle="start"></label><label>Region end (s)<input type="number" step="any" data-idle="end"></label>
      <button type="button" data-idle="apply-region">Use manual region</button><button type="button" data-idle="run">▶ Run Analysis</button>
      <p class="idle-scope-note">Recorded-region statistics only. Idle-state discovery/qualification is not yet integrated. No tune or ECU values are changed.</p></section>`;
  const field = <T extends HTMLElement = HTMLElement>(name: string) => root.querySelector<T>(`[data-idle="${name}"]`)!;
  const rpmSelect = field<HTMLSelectElement>('rpm');
  const targetSelect = field<HTMLSelectElement>('target');
  const scopeSelect = field<HTMLSelectElement>('scope');
  const startInput = field<HTMLInputElement>('start');
  const endInput = field<HTMLInputElement>('end');
  const runButton = field<HTMLButtonElement>('run');
  const loggerButton = field<HTMLButtonElement>('logger');
  const plot = createIdleStabilityPlot();
  field('plot').append(plot.element);
  const status = (text: string) => { field('status').textContent = text; };
  const selectedBounds = () => {
    if (scopeValue === 'manual') return manual;
    const scope = analyzerScopeOptions(context).find(option => option.value === scopeValue);
    if (!scope) return undefined;
    return scope.kind === 'full' ? context.sourceTimeRange : analyzerScopeBounds(scope) as { startMs: number; endMs: number };
  };
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
    if (tab === 'diagnosis') panel.append(
      section('Observed behavior', `${analysis.rpm.validSampleCount} valid RPM samples; sample standard deviation ${number(analysis.rpm.standardDeviation)} RPM. Target error RMSE ${number(analysis.tracking?.rmse)} RPM.`),
      section('Possible explanation', 'RPM variability describes the selected recording. It does not isolate airflow, ignition, fueling, actuator response or changing mechanical load.'),
      section('Limits of inference', 'This region is selected, not automatically idle-qualified. No gain recommendation, controller timing or causal tuning improvement is inferred.'),
      section('Next test', 'Select a known stable idle region and repeat with matched target RPM, coolant temperature, electrical and mechanical loads.'));
    else if (tab === 'evidence') panel.append(
      section('Source and channels', `${context.source?.descriptor?.displayName ?? 'Source metadata unavailable'} · RPM: ${accepted.rpm.channel.sourceName} [${accepted.rpm.channel.unit}] · Target: ${accepted.target?.channel.sourceName ?? 'unavailable'}. Original source sample indices are retained.`),
      section('Measurement coverage', `RPM valid ${analysis.rpm.validSampleCount}, invalid ${analysis.rpm.invalidSampleCount}, unavailable ${analysis.rpm.unavailableSampleCount}. Paired RPM/target valid ${analysis.tracking?.sampleCount ?? 0}, invalid ${analysis.tracking?.invalidSampleCount ?? 0}, unavailable ${analysis.tracking?.unavailableSampleCount ?? 0}.`),
      section('Definitions', `σ uses n−1, consistent with production Range Statistics. Error is actual−target RPM. In-band ±40 RPM: ${number(inBandPercent)}%. Each valid pair has equal weight; gaps are not evidence of settled idle.`));
    else panel.append(section('Recommended recording', 'Record repeated steady idle at comparable temperature and load, keeping the RPM target and tune version unchanged. Capture the entire region and record intentional load changes.'), section('What would support a change?', 'Repeatable like-for-like measurements with verified source/tune association. The present read-only stability view does not establish a tuning instruction.'));
  };
  const clear = () => {
    accepted = undefined; plot.clear();
    for (const key of ['sigma', 'rmse', 'in-band', 'samples']) field(key).textContent = '—';
    field('region-evidence').textContent = 'No accepted analysis for this source and region.';
    renderAssessment();
  };
  const configure = (next: LoggerAnalysisContext) => {
    const sourceChanged = context.source?.identity !== next.source?.identity;
    const catalogChanged = !sameChannelOptionCatalog(context.channels, next.channels);
    if (sourceChanged) { scopeValue = 'full'; manual = undefined; }
    else scopeValue = retainedAnalyzerScopeValue(scopeValue, context, next);
    context = next;
    if (sourceChanged || catalogChanged || !rpmSelect.options.length) {
      const channels = context.channels.filter(rpmCompatible);
      const initialized = rpmSelect.options.length > 0;
      for (const [select, role, old] of [[rpmSelect, 'rpm', rpmId], [targetSelect, 'target', targetId]] as const) {
        select.replaceChildren(new Option(role === 'rpm' ? 'Select RPM channel' : 'Unavailable / no target', ''));
        for (const channel of channels) select.add(new Option(analyzerChannelOptionLabel(channel), channel.id));
        select.value = !sourceChanged && initialized
          ? channels.some(channel => channel.id === old) ? old : ''
          : suggestAnalyzerChannel('idle', role, channels)?.id ?? '';
      }
      rpmId = rpmSelect.value; targetId = targetSelect.value;
    }
    const options = analyzerScopeOptions(context);
    if (!options.some(option => option.value === scopeValue) && scopeValue !== 'manual') scopeValue = 'full';
    scopeSelect.replaceChildren(...options.map(option => new Option(option.label, option.value)));
    if (manual) scopeSelect.add(new Option('Manual region', 'manual'));
    scopeSelect.value = scopeValue;
    const bounds = selectedBounds();
    startInput.value = bounds ? String(bounds.startMs / 1000) : '';
    endInput.value = bounds ? String(bounds.endMs / 1000) : '';
    const descriptor = context.source?.descriptor;
    field('source').textContent = descriptor ? `${descriptor.displayName} · ${descriptor.format} · ${context.source!.sampleCount.toLocaleString()} indexed records` : 'Load a recorded MLG through Open Log (source metadata unavailable).';
    loggerButton.disabled = !context.openRangeInLogger || !bounds;
  };
  const analyze = async () => {
    if (!active || disposed) return;
    const source = context.source;
    const bounds = selectedBounds();
    if (!source || source.descriptor?.format !== 'MLG' || !bounds || !Number.isFinite(bounds.startMs) || !Number.isFinite(bounds.endMs) || bounds.endMs <= bounds.startMs || !rpmId) {
      generation += 1; pendingKey = undefined; clear(); runButton.disabled = false;
      status('Load a recorded source with RPM units and select a nonzero region.'); return;
    }
    const key = JSON.stringify([source.revision, source.sampleCount, source.descriptor, context.channels, rpmId, targetId, bounds]);
    if (accepted?.source === source.identity && accepted.key === key) return;
    if (pendingKey === key && pendingSource === source.identity) return;
    const request = ++generation;
    const captured = context;
    const requestedRpm = rpmId;
    const requestedTarget = targetId;
    pendingKey = key; pendingSource = source.identity; clear(); status('Loading recorded evidence…'); runButton.disabled = true;
    owner.event('idle.stability.request', { generation: request, startMs: bounds.startMs, endMs: bounds.endMs });
    try {
      const traces = await captured.loadTraces([...new Set([requestedRpm, requestedTarget].filter(Boolean))], bounds.startMs, bounds.endMs);
      if (!active || disposed || request !== generation) return;
      const rpm = traces.find(trace => trace.channel.id === requestedRpm);
      const target = traces.find(trace => trace.channel.id === requestedTarget);
      if (!rpm) throw new Error('RPM data unavailable. Retry Run Analysis or choose another channel.');
      if (requestedTarget && !target) throw new Error('Selected target data unavailable. Retry or explicitly choose no target.');
      const complete = [rpm, ...(target ? [target] : [])].every(trace => trace.complete || numericRangeCoversTime(trace.range, bounds.startMs, bounds.endMs));
      const result = analyzeIdleStability(rpm.range, target?.range, { ...bounds, complete });
      accepted = { source: source.identity, key, result, rpm, target };
      const stats = result.analysis;
      field('sigma').textContent = number(stats.rpm.standardDeviation);
      field('rmse').textContent = number(stats.tracking?.rmse);
      field('in-band').textContent = result.inBandPercent === undefined ? 'Unavailable' : `${number(result.inBandPercent, 1)}%`;
      field('samples').textContent = stats.rpm.validSampleCount.toLocaleString();
      field('region-evidence').textContent = `${(bounds.startMs / 1000).toFixed(3)}–${(bounds.endMs / 1000).toFixed(3)} s · ${stats.rpm.validSampleCount} valid RPM samples · ${stats.tracking?.sampleCount ?? 0} valid target pairs · ${complete ? 'Complete requested coverage' : 'Partial returned coverage'}.`;
      plot.setData(rpm.range, stats.target?.validSampleCount ? target?.range : undefined,
        stats.tracking?.sampleCount ? result.error : undefined, bounds.startMs, bounds.endMs);
      status(stats.rpm.validSampleCount ? complete ? 'Recorded evidence' : 'Partial recorded evidence' : 'No valid RPM evidence');
      renderAssessment();
      owner.event('idle.stability.accepted', { generation: request, samples: stats.rpm.validSampleCount });
    } catch (error) {
      if (!active || disposed || request !== generation) return;
      clear(); status(error instanceof Error ? error.message : 'Could not load recorded evidence. Retry Run Analysis.');
    } finally {
      if (request === generation) { pendingKey = undefined; runButton.disabled = false; }
    }
  };
  const listen = (node: HTMLElement, action: () => void, event = 'click') => node.addEventListener(event, () => {
    if (active && !disposed) action();
  }, { signal: events.signal });
  listen(rpmSelect, () => { rpmId = rpmSelect.value; void analyze(); }, 'change');
  listen(targetSelect, () => { targetId = targetSelect.value; void analyze(); }, 'change');
  listen(scopeSelect, () => { scopeValue = scopeSelect.value; const bounds = selectedBounds(); startInput.value = bounds ? String(bounds.startMs / 1000) : ''; endInput.value = bounds ? String(bounds.endMs / 1000) : ''; void analyze(); }, 'change');
  listen(field('apply-region'), () => {
    const startMs = Number(startInput.value) * 1000;
    const endMs = Number(endInput.value) * 1000;
    const extent = context.sourceTimeRange;
    if (!startInput.value.trim() || !endInput.value.trim() || !Number.isFinite(startMs) || !Number.isFinite(endMs) || !extent || startMs < extent.startMs || endMs > extent.endMs || endMs <= startMs) {
      status('Enter a finite start < end inside the recorded source extent. Previous region retained.'); return;
    }
    manual = { startMs, endMs }; scopeValue = 'manual'; configure(context); void analyze();
  });
  listen(runButton, () => { if (accepted) { accepted = undefined; } void analyze(); });
  listen(field('fit'), plot.fit);
  listen(loggerButton, () => { const bounds = selectedBounds(); if (bounds) context.openRangeInLogger?.({ ...bounds, label: 'Idle stability region' }); });
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-idle-tab]')) listen(button, () => { tab = button.dataset.idleTab as Tab; renderAssessment(); });
  renderAssessment();
  return {
    element: root,
    setActive(next: boolean) {
      if (disposed || active === next) return;
      active = next; plot.setActive(next);
      if (!next) { generation += 1; pendingKey = undefined; return; }
      if (pendingContext) { const nextContext = pendingContext; pendingContext = undefined; configure(nextContext); }
      void analyze();
    },
    setContext(next: LoggerAnalysisContext) {
      if (disposed) return;
      if (!active) { pendingContext = next; return; }
      configure(next); void analyze();
    },
    refresh() { void analyze(); },
    dispose() { disposed = true; active = false; generation += 1; accepted = undefined; pendingContext = undefined; events.abort(); plot.dispose(); },
  };
}
