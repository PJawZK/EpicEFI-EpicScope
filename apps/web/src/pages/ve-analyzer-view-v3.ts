import type { ObservabilityRecorder } from '../observability/recorder';
import { analyzerChannelOptionLabel } from './analyzer-channel-roles';
import type { ChannelDefinition } from '../../../../core/log-model/log-types';
import type { TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext, LoggerAnalysisTraceContext } from './logger-page';
import {
  applyVeQualificationValidityBatch,
  preferredVeQualificationChannel,
  veQualificationChannelCompatible,
  VE_CELL_CHANGE_PRIOR_WEIGHT,
  type VeCellChangeAuthority,
  type VeQuickQualificationSettings,
} from './ve-analyzer-qualification';
import {
  createVeAnalyzerView as createVeAnalyzerViewV2,
  sameVeSourceContext,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v2';

function finiteInput(input: HTMLInputElement | null): number | undefined {
  const raw = input?.value.trim() ?? '';
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function celsiusLike(unit: string | undefined): boolean {
  const normalized = unit?.trim().toLowerCase().replace(/[^a-z°]/g, '') ?? '';
  return normalized === 'c' || normalized === '°c' || normalized.includes('celsius') || normalized.includes('degc');
}

function optionForChannel(channel: ChannelDefinition): HTMLOptionElement {
  return new Option(analyzerChannelOptionLabel(channel), channel.id);
}

export function createVeAnalyzerView(observability?: ObservabilityRecorder): VeAnalyzerViewController {
  const inner = createVeAnalyzerViewV2(observability);
  const root = inner.element;
  let disposed = false;
  const events = new AbortController();
  let sourceContext: LoggerAnalysisContext = {
    traces: [],
    channels: [],
    loadTraces: async () => [],
    aTimeMs: undefined,
    bTimeMs: undefined,
    savedRanges: [],
  };
  let qualificationLoadPending = false;

  const actionbar = root.querySelector<HTMLElement>('.ve-workbench-actionbar')!;
  const quick = root.querySelector<HTMLElement>('.ve-workbench-quick-controls')!;

  const authorityLabel = document.createElement('label');
  authorityLabel.className = 've-cell-change-authority';
  authorityLabel.innerHTML = `
    <span>Cell Change</span>
    <select data-ve-quick="cell-change">
      <option value="responsive">Responsive</option>
      <option value="normal" selected>Normal</option>
      <option value="conservative">Conservative</option>
      <option value="very-conservative">Very conservative</option>
      <option value="custom">Custom numeric prior</option>
    </select>`;
  actionbar.insertBefore(authorityLabel, actionbar.querySelector('.ve-workbench-state'));

  const qualificationHost = document.createElement('div');
  qualificationHost.className = 've-quick-qualification';
  qualificationHost.innerHTML = `
    <label><span>CLT source</span><select data-ve-quick="clt-source"></select></label>
    <label><span>Min CLT</span><input data-ve-quick="min-clt" type="number" step="any"></label>
    <label><span>TPS source</span><select data-ve-quick="tps-source"></select></label>
    <label><span>Min TPS</span><input data-ve-quick="min-tps" type="number" step="any"></label>
    <label><span>Max TPS</span><input data-ve-quick="max-tps" type="number" step="any"></label>
    <span class="ve-quick-qualification-note">Quick qualification is applied before VE evidence; source names are shown exactly as supplied.</span>`;
  quick.append(qualificationHost);

  const authoritySelect = authorityLabel.querySelector<HTMLSelectElement>('select')!;
  const cltSelect = qualificationHost.querySelector<HTMLSelectElement>('[data-ve-quick="clt-source"]')!;
  const minCltInput = qualificationHost.querySelector<HTMLInputElement>('[data-ve-quick="min-clt"]')!;
  const tpsSelect = qualificationHost.querySelector<HTMLSelectElement>('[data-ve-quick="tps-source"]')!;
  const minTpsInput = qualificationHost.querySelector<HTMLInputElement>('[data-ve-quick="min-tps"]')!;
  const maxTpsInput = qualificationHost.querySelector<HTMLInputElement>('[data-ve-quick="max-tps"]')!;

  const invalidate = (): void => {
    const trigger = root.querySelector<HTMLInputElement>('input[data-role="min-rpm"]');
    trigger?.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const settings = (): VeQuickQualificationSettings => {
    const minimumClt = finiteInput(minCltInput);
    const minimumTps = finiteInput(minTpsInput);
    const maximumTps = finiteInput(maxTpsInput);
    return {
      ...(minimumClt !== undefined && cltSelect.value ? { cltChannelId: cltSelect.value } : {}),
      ...(minimumClt !== undefined ? { minimumClt } : {}),
      ...((minimumTps !== undefined || maximumTps !== undefined) && tpsSelect.value ? { tpsChannelId: tpsSelect.value } : {}),
      ...(minimumTps !== undefined ? { minimumTps } : {}),
      ...(maximumTps !== undefined ? { maximumTps } : {}),
    };
  };

  const populateQualificationSources = (): void => {
    const oldClt = cltSelect.value;
    const oldTps = tpsSelect.value;
    const cltChannels = sourceContext.channels.filter((channel) => veQualificationChannelCompatible(channel, 'clt'));
    const tpsChannels = sourceContext.channels.filter((channel) => veQualificationChannelCompatible(channel, 'tps'));
    cltSelect.replaceChildren(new Option('(none)', ''), ...cltChannels.map(optionForChannel));
    tpsSelect.replaceChildren(new Option('(none)', ''), ...tpsChannels.map(optionForChannel));

    const preferredClt = preferredVeQualificationChannel(cltChannels, 'clt');
    const preferredTps = preferredVeQualificationChannel(tpsChannels, 'tps');
    cltSelect.value = oldClt && cltChannels.some((channel) => channel.id === oldClt) ? oldClt : preferredClt?.id ?? '';
    tpsSelect.value = oldTps && tpsChannels.some((channel) => channel.id === oldTps) ? oldTps : preferredTps?.id ?? '';

    if (!minCltInput.dataset.veInitialized) {
      const selected = sourceContext.channels.find((channel) => channel.id === cltSelect.value);
      if (selected && celsiusLike(selected.unit)) minCltInput.value = '70';
      minCltInput.dataset.veInitialized = 'true';
    }
  };

  const syncAuthorityUi = (notify = false): void => {
    const prior = root.querySelector<HTMLInputElement>('input[data-role="prior-weight"]');
    const label = prior?.closest<HTMLLabelElement>('label');
    if (!prior || !label) return;

    if (label.parentElement !== actionbar) authorityLabel.insertAdjacentElement('afterend', label);
    const caption = label.querySelector('span');
    if (caption) caption.textContent = 'Prior weight';

    const mode = authoritySelect.value as VeCellChangeAuthority;
    const custom = mode === 'custom';
    label.hidden = !custom;

    if (!custom) {
      const resolved = String(VE_CELL_CHANGE_PRIOR_WEIGHT[mode]);
      if (prior.value !== resolved) {
        prior.value = resolved;
        if (notify) prior.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    if (prior.dataset.veAuthorityLinked !== 'true') {
      prior.addEventListener('change', () => {
        if (authoritySelect.value !== 'custom') syncAuthorityUi(true);
      }, { signal: events.signal });
      prior.dataset.veAuthorityLinked = 'true';
    }
  };

  const clarifyProposalLabels = (): void => {
    const stable = root.querySelector<HTMLInputElement>('input[data-role="stable-ms"]');
    const stableCaption = stable?.closest('label')?.querySelector('span');
    if (stableCaption) {
      stableCaption.textContent = 'Stable / recovery ms';
      stableCaption.title = 'Required stable trailing window after transient/state changes before VE evidence becomes eligible.';
    }

    const minimumEvidence = root.querySelector<HTMLInputElement>('input[data-role="min-evidence-weight"]');
    const evidenceCaption = minimumEvidence?.closest('label')?.querySelector('span');
    if (evidenceCaption) evidenceCaption.textContent = 'Minimum evidence weight';
  };

  const applyUi = (notifyAuthority = false): void => {
    syncAuthorityUi(notifyAuthority);
    clarifyProposalLabels();
  };

  authoritySelect.addEventListener('change', () => {
    syncAuthorityUi(true);
    invalidate();
  }, { signal: events.signal });

  for (const control of [cltSelect, minCltInput, tpsSelect, minTpsInput, maxTpsInput]) {
    control.addEventListener('change', invalidate, { signal: events.signal });
  }

  root.querySelector<HTMLButtonElement>('.ve-workbench-run')?.addEventListener('click', () => {
    qualificationLoadPending = true;
  }, { capture: true, signal: events.signal });
  root.querySelector<HTMLButtonElement>('[data-ve-analyzer="grab-delay"]')?.addEventListener('click', () => {
    qualificationLoadPending = false;
  }, { capture: true, signal: events.signal });

  const wrappedContext = (next: LoggerAnalysisContext): LoggerAnalysisContext => ({
    ...next,
    source: next.source ?? { identity: next.loadTraces, sampleCount: 0, revision: 0 },
    loadTraces: async (channelIds, startMs, endMs): Promise<readonly LoggerAnalysisTraceContext[]> => {
      const applyQualification = qualificationLoadPending;
      qualificationLoadPending = false;
      if (!applyQualification) return next.loadTraces(channelIds, startMs, endMs);

      const current = settings();
      const extraIds = [current.cltChannelId, current.tpsChannelId].filter((id): id is string => Boolean(id));
      const requested = [...new Set([...channelIds, ...extraIds])];
      const loaded = await next.loadTraces(requested, startMs, endMs);
      const cltTrace = current.cltChannelId ? loaded.find((trace) => trace.channel.id === current.cltChannelId) : undefined;
      const tpsTrace = current.tpsChannelId ? loaded.find((trace) => trace.channel.id === current.tpsChannelId) : undefined;

      const qualified = applyVeQualificationValidityBatch(loaded.map(trace => trace.range), current, cltTrace?.range, tpsTrace?.range);
      return loaded.map((trace, index) => ({ ...trace, range: qualified[index]! }));
    },
  });

  // Resolve the default preset before the inner analyzer performs its first
  // readiness calculation. Preset authority must never depend on a hidden input.
  applyUi(false);

  return {
    element: root,
    dispose() {
      if (disposed) return;
      disposed = true;
      events.abort();
      sourceContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };
      inner.dispose();
    },
    setActive(active) { if (disposed) return; inner.setActive(active); },
    editDelayCells(positions, edit) { return inner.editDelayCells(positions, edit); },
    get sessionRevision() { return inner.sessionRevision; },
    getPrimaryAnalysis() { return inner.getPrimaryAnalysis(); },
    onPrimaryAnalysisChange(listener) { return inner.onPrimaryAnalysisChange(listener); },
    getReadiness() { return inner.getReadiness(); },
    onReadinessChange(listener) { return inner.onReadinessChange(listener); },
    setContext(next) {
      if (disposed) return false;
      const sourceChanged = !sameVeSourceContext(sourceContext, next);
      sourceContext = next;
      if (sourceChanged) populateQualificationSources();
      applyUi(false);
      const changed = inner.setContext(wrappedContext(next));
      if (changed) applyUi(false);
      return changed;
    },
    setTuneModel(model: TuneModel | undefined, sourceName?: string) {
      if (disposed) return false;
      applyUi(false);
      const changed = inner.setTuneModel(model, sourceName);
      if (changed) applyUi(false);
      return changed;
    },
    refresh() {
      if (disposed) return;
      applyUi(false);
      inner.refresh();
      applyUi(false);
    },
  };
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v2';
