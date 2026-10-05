import { analyzeBoost, type BoostAnalyzerResult } from '../../../../core/analysis/boost-analyzer';
import { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import type { LoggerAnalysisContext, LoggerAnalysisTraceContext } from './logger-page';

export interface BoostAnalyzerViewController {
  readonly element: HTMLElement;
  setContext(context: LoggerAnalysisContext): void;
  refresh(): void;
}

function formatNumber(value: number | undefined, precision = 3): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  return value.toFixed(precision).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function optionalNumber(input: HTMLInputElement): number | undefined {
  if (input.value.trim() === '') return undefined;
  const value = Number(input.value);
  return Number.isFinite(value) ? value : undefined;
}

export function createBoostAnalyzerView(): BoostAnalyzerViewController {
  let context: LoggerAnalysisContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };
  let currentResult: BoostAnalyzerResult | undefined;

  const root = document.createElement('section');
  root.className = 'boost-analyzer-view';
  root.hidden = true;
  root.innerHTML = `
    <div class="boost-analyzer-banner"><strong>Boost · Experimental</strong><span>Capability-driven analysis. Select the channels that represent measured pressure, target, RPM and wastegate duties in this log.</span></div>
    <div class="boost-analyzer-controls">
      <label><span>Measured pressure</span><select class="boost-measured"></select></label>
      <label><span>Target pressure</span><select class="boost-target"></select></label>
      <label><span>RPM</span><select class="boost-rpm"></select></label>
      <label><span>Upper duty</span><select class="boost-upper"></select></label>
      <label><span>Lower duty</span><select class="boost-lower"></select></label>
      <label><span>Scope</span><select class="boost-scope"></select></label>
      <button type="button" class="boost-refresh">Analyze</button>
    </div>
    <details class="boost-analysis-options">
      <summary>Spool / steady-state detection</summary>
      <div class="boost-analysis-options-grid">
        <label class="boost-option-toggle"><input type="checkbox" class="boost-spool-enabled" /><span>Detect spool</span></label>
        <label><span>Spool start pressure</span><input type="number" step="any" class="boost-spool-start" /></label>
        <label><span>Minimum target pressure</span><input type="number" step="any" class="boost-spool-target" /></label>
        <label><span>Completion fraction</span><input type="number" step="0.01" min="0.01" max="1" value="0.90" class="boost-spool-fraction" /></label>
        <label><span>Min spool duration ms</span><input type="number" step="1" min="0" value="0" class="boost-spool-duration" /></label>
        <label class="boost-option-toggle"><input type="checkbox" class="boost-steady-enabled" /><span>Detect steady state</span></label>
        <label><span>Max target rate / s</span><input type="number" step="any" min="0" class="boost-steady-target-rate" /></label>
        <label><span>Max measured rate / s</span><input type="number" step="any" min="0" class="boost-steady-measured-rate" /></label>
        <label><span>Min steady duration ms</span><input type="number" step="1" min="0" value="500" class="boost-steady-duration" /></label>
      </div>
    </details>
    <div class="boost-analyzer-empty">
      <strong>Boost analysis needs a measured-pressure channel available in the log and a valid scope.</strong>
      <span>Target/RPM/wastegate duty channels are optional. Spool and steady-state detection require a target channel and explicit thresholds.</span>
    </div>
    <div class="boost-analyzer-content" hidden>
      <div class="boost-analyzer-summary">
        <div><span>Scope</span><strong data-boost="scope">—</strong></div>
        <div><span>Coverage</span><strong data-boost="coverage">—</strong></div>
        <div><span>Measured mean</span><strong data-boost="measured-mean">—</strong></div>
        <div><span>Measured max</span><strong data-boost="measured-max">—</strong></div>
        <div><span>Target mean</span><strong data-boost="target-mean">—</strong></div>
        <div><span>Mean error</span><strong data-boost="mean-error">—</strong></div>
        <div><span>Mean abs error</span><strong data-boost="mae">—</strong></div>
        <div><span>RMSE</span><strong data-boost="rmse">—</strong></div>
        <div><span>Max overshoot</span><strong data-boost="overshoot">—</strong></div>
        <div><span>Max undershoot</span><strong data-boost="undershoot">—</strong></div>
        <div><span>Upper duty mean</span><strong data-boost="upper-duty">—</strong></div>
        <div><span>Lower duty mean</span><strong data-boost="lower-duty">—</strong></div>
      </div>
      <div class="boost-evidence">
        <span>Input <strong data-boost="input">0</strong></span>
        <span>Tracking valid <strong data-boost="tracking-valid">0</strong></span>
        <span>Tracking invalid <strong data-boost="tracking-invalid">0</strong></span>
        <span>Tracking unavailable <strong data-boost="tracking-unavailable">0</strong></span>
      </div>
      <section class="boost-result-section">
        <header><strong>Spool events</strong><span data-boost="spool-count">0</span></header>
        <div class="boost-table-wrap"><table class="boost-table boost-spool-table"><thead><tr><th>#</th><th>Start</th><th>End</th><th>Duration</th><th>Start P</th><th>End P</th><th>Target</th><th>Start RPM</th><th>End RPM</th></tr></thead><tbody></tbody></table></div>
      </section>
      <section class="boost-result-section">
        <header><strong>Steady-state windows</strong><span data-boost="steady-count">0</span></header>
        <div class="boost-table-wrap"><table class="boost-table boost-steady-table"><thead><tr><th>#</th><th>Start</th><th>End</th><th>Duration</th><th>Samples</th><th>Target mean</th><th>Measured mean</th><th>Mean error</th><th>Overshoot</th><th>Undershoot</th></tr></thead><tbody></tbody></table></div>
      </section>
    </div>
  `;

  const measuredSelect = root.querySelector<HTMLSelectElement>('.boost-measured');
  const targetSelect = root.querySelector<HTMLSelectElement>('.boost-target');
  const rpmSelect = root.querySelector<HTMLSelectElement>('.boost-rpm');
  const upperSelect = root.querySelector<HTMLSelectElement>('.boost-upper');
  const lowerSelect = root.querySelector<HTMLSelectElement>('.boost-lower');
  const scopeSelect = root.querySelector<HTMLSelectElement>('.boost-scope');
  const refreshButton = root.querySelector<HTMLButtonElement>('.boost-refresh');
  const spoolEnabled = root.querySelector<HTMLInputElement>('.boost-spool-enabled');
  const spoolStart = root.querySelector<HTMLInputElement>('.boost-spool-start');
  const spoolTarget = root.querySelector<HTMLInputElement>('.boost-spool-target');
  const spoolFraction = root.querySelector<HTMLInputElement>('.boost-spool-fraction');
  const spoolDuration = root.querySelector<HTMLInputElement>('.boost-spool-duration');
  const steadyEnabled = root.querySelector<HTMLInputElement>('.boost-steady-enabled');
  const steadyTargetRate = root.querySelector<HTMLInputElement>('.boost-steady-target-rate');
  const steadyMeasuredRate = root.querySelector<HTMLInputElement>('.boost-steady-measured-rate');
  const steadyDuration = root.querySelector<HTMLInputElement>('.boost-steady-duration');
  const empty = root.querySelector<HTMLElement>('.boost-analyzer-empty');
  const content = root.querySelector<HTMLElement>('.boost-analyzer-content');
  const spoolBody = root.querySelector<HTMLTableSectionElement>('.boost-spool-table tbody');
  const steadyBody = root.querySelector<HTMLTableSectionElement>('.boost-steady-table tbody');
  if (!measuredSelect || !targetSelect || !rpmSelect || !upperSelect || !lowerSelect || !scopeSelect || !refreshButton || !spoolEnabled || !spoolStart || !spoolTarget || !spoolFraction || !spoolDuration || !steadyEnabled || !steadyTargetRate || !steadyMeasuredRate || !steadyDuration || !empty || !content || !spoolBody || !steadyBody) {
    throw new Error('Boost Analyzer view structure is incomplete.');
  }

  const field = (name: string): HTMLElement => {
    const node = root.querySelector<HTMLElement>(`[data-boost="${name}"]`);
    if (!node) throw new Error(`Boost Analyzer field is missing: ${name}`);
    return node;
  };

  const selectedScope = (): { label: string; startMs: number; endMs: number } | undefined => {
    if (scopeSelect.value === 'ab') {
      if (context.aTimeMs === undefined || context.bTimeMs === undefined || context.aTimeMs === context.bTimeMs) return undefined;
      return { label: 'Current A/B', startMs: context.aTimeMs, endMs: context.bTimeMs };
    }
    if (!scopeSelect.value.startsWith('saved:')) return undefined;
    const index = Number(scopeSelect.value.slice(6));
    const saved = Number.isInteger(index) ? context.savedRanges[index] : undefined;
    return saved ? { label: saved.label, startMs: saved.startMs, endMs: saved.endMs } : undefined;
  };

  const addOptionalTraceOptions = (select: HTMLSelectElement, preferred: string): void => {
    select.replaceChildren(new Option('(none)', ''));
    for (const channel of context.channels) select.add(new Option(channel.displayName || channel.sourceName, channel.id));
    if ([...select.options].some((option) => option.value === preferred)) select.value = preferred;
  };

  const fillScope = (preferred: string): void => {
    scopeSelect.replaceChildren();
    if (context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs) scopeSelect.add(new Option('Current A/B', 'ab'));
    context.savedRanges.forEach((range, index) => scopeSelect.add(new Option(range.label, `saved:${index}`)));
    if ([...scopeSelect.options].some((option) => option.value === preferred)) scopeSelect.value = preferred;
  };

  const render = async (): Promise<void> => {
    const measuredId = measuredSelect.value || context.channels[0]?.id;
    const targetId = targetSelect.value || undefined;
    const rpmId = rpmSelect.value || undefined;
    const upperId = upperSelect.value || undefined;
    const lowerId = lowerSelect.value || undefined;
    const scope = selectedScope();
    if (!measuredId || !scope) {
      currentResult = undefined;
      empty.hidden = false;
      content.hidden = true;
      refreshButton.disabled = true;
      return;
    }

    const startMs = Math.min(scope.startMs, scope.endMs);
    const endMs = Math.max(scope.startMs, scope.endMs);
    const loaded = await context.loadTraces([measuredId, targetId, rpmId, upperId, lowerId].filter((id): id is string => id !== undefined), startMs, endMs);
    const byId = new Map(loaded.map((trace) => [trace.channel.id, trace]));
    const measured = byId.get(measuredId);
    const target = targetId ? byId.get(targetId) : undefined;
    const rpm = rpmId ? byId.get(rpmId) : undefined;
    const upper = upperId ? byId.get(upperId) : undefined;
    const lower = lowerId ? byId.get(lowerId) : undefined;
    if (!measured) { empty.hidden = false; content.hidden = true; return; }
    const channels = new Map([[measured.channel.id, { range: measured.range, complete: measured.complete }]]);
    const scoped = qualifyNumericSamples({
      referenceChannelId: measured.channel.id,
      channels,
      conditions: [],
      timeRange: { startMs, endMs },
    });
    const selectedTraces = [measured, target, rpm, upper, lower].filter((trace): trace is LoggerAnalysisTraceContext => trace !== undefined);
    const complete = scoped.complete && selectedTraces.every((trace) => trace.complete || numericRangeCoversTime(trace.range, startMs, endMs));

    const spoolStartValue = optionalNumber(spoolStart);
    const spoolTargetValue = optionalNumber(spoolTarget);
    const steadyTargetRateValue = optionalNumber(steadyTargetRate);
    let spool;
    if (spoolEnabled.checked && target && spoolStartValue !== undefined && spoolTargetValue !== undefined) {
      spool = {
        startPressure: spoolStartValue,
        minimumTargetPressure: spoolTargetValue,
        completionFraction: optionalNumber(spoolFraction) ?? 0.9,
        minimumDurationMs: optionalNumber(spoolDuration) ?? 0,
      };
    }
    let steadyState;
    if (steadyEnabled.checked && target && steadyTargetRateValue !== undefined) {
      const measuredRate = optionalNumber(steadyMeasuredRate);
      steadyState = {
        maxTargetRatePerSecond: steadyTargetRateValue,
        ...(measuredRate !== undefined ? { maxMeasuredRatePerSecond: measuredRate } : {}),
        minimumDurationMs: optionalNumber(steadyDuration) ?? 500,
      };
    }

    try {
      currentResult = analyzeBoost({
        measuredPressure: measured.range,
        ...(target ? { targetPressure: target.range } : {}),
        ...(rpm ? { rpm: rpm.range } : {}),
        ...(upper ? { upperDuty: upper.range } : {}),
        ...(lower ? { lowerDuty: lower.range } : {}),
      }, {
        sampleIndices: scoped.eligibleSampleIndices,
        complete,
        ...(spool ? { spool } : {}),
        ...(steadyState ? { steadyState } : {}),
      });
    } catch (error) {
      currentResult = undefined;
      empty.hidden = false;
      content.hidden = true;
      empty.querySelector('strong')!.textContent = error instanceof Error ? error.message : 'Boost analysis configuration is invalid.';
      refreshButton.disabled = false;
      return;
    }

    empty.hidden = true;
    content.hidden = false;
    refreshButton.disabled = false;
    field('scope').textContent = `${scope.label} · ${((endMs - startMs) / 1000).toFixed(3)} s`;
    field('coverage').textContent = currentResult.complete ? 'Complete' : 'Partial decoded';
    field('measured-mean').textContent = formatNumber(currentResult.measured.mean);
    field('measured-max').textContent = formatNumber(currentResult.measured.max);
    field('target-mean').textContent = formatNumber(currentResult.target?.mean);
    field('mean-error').textContent = formatNumber(currentResult.tracking?.meanError);
    field('mae').textContent = formatNumber(currentResult.tracking?.meanAbsoluteError);
    field('rmse').textContent = formatNumber(currentResult.tracking?.rootMeanSquareError);
    field('overshoot').textContent = formatNumber(currentResult.tracking?.maxOvershoot);
    field('undershoot').textContent = formatNumber(currentResult.tracking?.maxUndershoot);
    field('upper-duty').textContent = formatNumber(currentResult.upperDuty?.mean);
    field('lower-duty').textContent = formatNumber(currentResult.lowerDuty?.mean);
    field('input').textContent = currentResult.inputSampleCount.toLocaleString();
    field('tracking-valid').textContent = (currentResult.tracking?.sampleCount ?? 0).toLocaleString();
    field('tracking-invalid').textContent = (currentResult.tracking?.invalidSampleCount ?? 0).toLocaleString();
    field('tracking-unavailable').textContent = (currentResult.tracking?.unavailableSampleCount ?? 0).toLocaleString();
    field('spool-count').textContent = currentResult.spoolEvents.length.toLocaleString();
    field('steady-count').textContent = currentResult.steadyStateWindows.length.toLocaleString();

    spoolBody.replaceChildren(...currentResult.spoolEvents.map((event, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${index + 1}</td><td>${(event.startTimeMs / 1000).toFixed(3)}</td><td>${(event.endTimeMs / 1000).toFixed(3)}</td><td>${event.durationMs.toFixed(0)} ms</td><td>${formatNumber(event.startPressure)}</td><td>${formatNumber(event.endPressure)}</td><td>${formatNumber(event.endTargetPressure)}</td><td>${formatNumber(event.startRpm, 0)}</td><td>${formatNumber(event.endRpm, 0)}</td>`;
      return row;
    }));
    steadyBody.replaceChildren(...currentResult.steadyStateWindows.map((window, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${index + 1}</td><td>${(window.startTimeMs / 1000).toFixed(3)}</td><td>${(window.endTimeMs / 1000).toFixed(3)}</td><td>${window.durationMs.toFixed(0)} ms</td><td>${window.sampleCount.toLocaleString()}</td><td>${formatNumber(window.meanTargetPressure)}</td><td>${formatNumber(window.meanMeasuredPressure)}</td><td>${formatNumber(window.meanError)}</td><td>${formatNumber(window.maxOvershoot)}</td><td>${formatNumber(window.maxUndershoot)}</td>`;
      return row;
    }));
  };

  const setContext = (nextContext: LoggerAnalysisContext): void => {
    const previousMeasured = measuredSelect.value;
    const previousTarget = targetSelect.value;
    const previousRpm = rpmSelect.value;
    const previousUpper = upperSelect.value;
    const previousLower = lowerSelect.value;
    const previousScope = scopeSelect.value;
    context = nextContext;
    measuredSelect.replaceChildren(...context.channels.map((channel) => new Option(channel.displayName || channel.sourceName, channel.id)));
    if (context.channels.some((channel) => channel.id === previousMeasured)) measuredSelect.value = previousMeasured;
    addOptionalTraceOptions(targetSelect, previousTarget);
    addOptionalTraceOptions(rpmSelect, previousRpm);
    addOptionalTraceOptions(upperSelect, previousUpper);
    addOptionalTraceOptions(lowerSelect, previousLower);
    fillScope(previousScope);
    void render();
  };

  for (const select of [measuredSelect, targetSelect, rpmSelect, upperSelect, lowerSelect, scopeSelect]) select.addEventListener('change', () => { void render(); });
  for (const input of [spoolEnabled, spoolStart, spoolTarget, spoolFraction, spoolDuration, steadyEnabled, steadyTargetRate, steadyMeasuredRate, steadyDuration]) input.addEventListener('change', () => { void render(); });
  refreshButton.addEventListener('click', () => { void render(); });

  return { element: root, setContext, refresh: () => { void render(); } };
}
