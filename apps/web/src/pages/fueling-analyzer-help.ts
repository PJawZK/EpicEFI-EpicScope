import { addInlineHelpButton, createInlineHelpPresenter, matchingInlineHelp, type InlineHelpEntry } from '../components/inline-help';

const CONTROL_HELP: readonly [RegExp, InlineHelpEntry][] = [
  [/^Actual mixture/i, { title: 'Actual mixture', text: 'Measured exhaust mixture. EpicScope prefers Lambda because it is independent of the configured fuel stoichiometric ratio. Gas-scale AFR is the next fallback, then generic AFR. Fuel-cut and transient state channels are used separately so intentional lean readings are not mistaken for VE error.' }],
  [/^Target mixture/i, { title: 'Target mixture', text: 'The commanded mixture target. Keep this on the same scale as Actual mixture: Lambda with target lambda, or matching AFR channels. Steady-state error is actual minus target, so positive error is lean and negative error is rich.' }],
  [/^Current VE$/i, { title: 'Current VE', text: 'The live effective VE value used by the ECU at the current operating point. It is a scalar result after table interpolation and configured VE blending/modifiers; it is not the editable VE table itself and it is not Fuel: Tuned VE.' }],
  [/^Fuel command \/ injector PW/i, { title: 'Fuel command / injector pulse width', text: 'The command used to detect observed mixture-response delay. EpicEFI/JZ defaults to Fuel: Last inj pulse width. A larger selected value must mean more commanded fuel; VE is intentionally not used as a fallback because crossing VE cells can create ambiguous delay events.' }],
  [/^RPM$/i, { title: 'RPM', text: 'Engine speed used for steady-state binning and response-event context. Fueling conclusions are more useful when tied to the RPM/load region where they occurred.' }],
  [/^VE table load axis$/i, { title: 'VE table load axis', text: 'The load value actually used on the VE table Y axis. EpicEFI/JZ prefers veTableYAxis instead of assuming MAP or TPS, so the operating-point map lines up with the calibration axis the ECU used.' }],
  [/^DFCO active$/i, { title: 'DFCO active', text: 'Dedicated deceleration fuel-cut state. DFCO intentionally zeros injection, so a wideband will read very lean. When this channel is available, DFCO-active samples are shown as context and excluded from steady VE-error analysis and mixture-delay events.' }],
  [/^Fuel cut code$/i, { title: 'Fuel cut code', text: 'Reason for non-DFCO fuel cuts such as RPM limit, boost cut, lambda protection, maximum injector duty or fuel-pressure protection. Nonzero fuel-cut samples are excluded from normal mixture-error and delay evidence and the observed reason codes are summarized.' }],
  [/^TPS AE active$/i, { title: 'TPS acceleration enrichment active', text: 'Shows when TPS acceleration enrichment detection is active. Those samples are transient fueling evidence rather than steady VE evidence, so EpicScope excludes them from the steady calibration map while still allowing them in response-delay analysis.' }],
  [/^TPS Decel active$/i, { title: 'TPS deceleration active', text: 'Shows TPS deceleration detection/enleanment state. It is separate from DFCO: decel enleanment shapes fueling while DFCO is a hard fuel cut. Decel-active samples are excluded from steady VE evidence.' }],
  [/^Total fuel correction$/i, { title: 'Total fuel correction', text: 'The aggregate running fuel-correction multiplier reported by the ECU. It helps show when the observed mixture is being produced with correction layers on top of base VE rather than by VE alone.' }],
  [/^STFT Bank 1$/i, { title: 'STFT Bank 1', text: 'Short-term closed-loop fuel correction. A persistent nonzero trim can mask a base-fueling error, so EpicScope reports it as context instead of assuming measured target tracking proves the VE table is correct.' }],
  [/^LTFT Bank 1$/i, { title: 'LTFT Bank 1', text: 'Long-term fuel correction currently being applied. Like STFT, LTFT can hide errors in VE, injector flow/deadtime or stoichiometric setup. It is context for diagnosis, not a VE correction recommendation by itself.' }],
  [/^Scope$/i, { title: 'Scope', text: 'Selects the source interval analyzed: Full Log, Current A/B or a Saved Range. All cut/transient counts and steady-state evidence are calculated inside this scope.' }],
  [/^Mixture error deadband$/i, { title: 'Mixture error deadband', text: 'Errors inside ± this value count as within-band. Leave blank for the scale-aware default: 0.015 lambda or 0.20 AFR. The setting affects lean/rich classification, not the raw measured values.' }],
  [/^Map RPM bin size$/i, { title: 'RPM bin size', text: 'Width of each steady-state RPM operating-point bin. Smaller bins retain more detail but need more samples; larger bins are more stable but can blur calibration changes.' }],
  [/^Map load bin size$/i, { title: 'Load bin size', text: 'Width of each VE-table-load operating-point bin in the selected load channel native unit. Choose a size that matches the resolution of the calibration axis.' }],
  [/^Map minimum samples \/ bin$/i, { title: 'Minimum samples per bin', text: 'Suppresses steady operating-point bins with too little evidence. A missing bin means it did not meet the evidence threshold after context and stability qualification.' }],
  [/^Map max RPM rate \/ s$/i, { title: 'Maximum RPM rate', text: 'Largest RPM change per second still accepted while building steady-state evidence. Faster movement resets the settling period so a transient is not treated as a stable calibration point.' }],
  [/^Map max load rate \/ s$/i, { title: 'Maximum load rate', text: 'Largest VE-load change per second accepted as stable. Faster movement resets the settling period.' }],
  [/^Map stable settling ms$/i, { title: 'Stable settling time', text: 'How long RPM and load must remain inside their rate limits before samples are admitted to the steady-state map. This intentionally rejects transition-adjacent mixture readings affected by transport delay.' }],
  [/^Delay command Δ threshold$/i, { title: 'Delay command-change threshold', text: 'Minimum injector-PW/fuel-command step that can start a response-delay event. Raise it to focus on clearer events; lower it when useful changes are smaller.' }],
  [/^Delay mixture response threshold$/i, { title: 'Delay mixture-response threshold', text: 'Minimum mixture movement used to identify response onset. Leave blank for the scale-aware default: 0.010 lambda or 0.15 AFR.' }],
  [/^Delay search window ms$/i, { title: 'Delay search window', text: 'Maximum time after an isolated fuel-command transition to look for the expected mixture response. The observed delay can include combustion, exhaust transport, wideband/controller response, filtering and logging latency.' }],
  [/^Delay min event spacing ms$/i, { title: 'Minimum delay-event spacing', text: 'Minimum separation between candidate fuel-command transitions. It reduces overlapping events that would make the response timing ambiguous.' }],
];

const SUMMARY_HELP: Readonly<Record<string, InlineHelpEntry>> = {
  'Coverage': { title: 'Coverage', text: 'Complete means the selected decoded evidence covers the scope. Partial decoded means one or more selected traces do not fully cover it.' },
  'Calibration eligible / scoped': { title: 'Calibration eligibility', text: 'Samples remaining after Fueling context qualification. DFCO, other fuel cuts, TPS AE and TPS decel are excluded before the steady mixture/VE analysis. Stability/settling filters are applied after this stage.' },
  'Delay eligible / scoped': { title: 'Delay eligibility', text: 'Samples available to the response-delay detector after hard fuel cuts are removed. AE and decel are retained here because transient fuel-command changes are useful delay evidence.' },
  'DFCO status': { title: 'DFCO status', text: 'Shows whether deceleration fuel cut occurred in the selected scope and how many scoped samples were affected. DFCO intentionally produces a lean exhaust reading and is not counted as a VE lean error.' },
  'Other fuel cuts': { title: 'Other fuel cuts', text: 'Non-DFCO fuel-cut samples reported by Fuel: Cut Code. These may include RPM/boost/pressure/protection cuts and are removed from normal mixture-error analysis.' },
  'Fuel cut reasons': { title: 'Fuel cut reasons', text: 'Observed nonzero Fuel: Cut Code values summarized by reason. This helps explain lean or zero-fuel regions without attributing them to VE.' },
  'AE / decel excluded': { title: 'Transient fueling excluded', text: 'TPS acceleration-enrichment and TPS-deceleration samples excluded from the steady calibration path. They remain available to transient-specific analysis where appropriate.' },
  'Context invalid / unavailable': { title: 'Context evidence gaps', text: 'Samples where a selected DFCO/cut/transient context channel was invalid or unavailable. EpicScope conservatively leaves those samples out rather than assuming no cut/transient was active.' },
  'Total fuel correction mean': { title: 'Total fuel correction mean', text: 'Average ECU total-fuel correction across calibration-eligible samples. A value away from the neutral multiplier indicates correction layers are influencing the delivered fuel.' },
  'STFT Bank 1 mean': { title: 'STFT Bank 1 mean', text: 'Average short-term trim across calibration-eligible samples. Persistent trim can make measured mixture look correct while base fueling is not.' },
  'LTFT Bank 1 mean': { title: 'LTFT Bank 1 mean', text: 'Average long-term trim across calibration-eligible samples. Interpret it as correction context, not proof that VE itself is wrong.' },
  'Mean error': { title: 'Mean mixture error', text: 'Average actual minus target mixture on the selected compatible scale. Positive is lean; negative is rich. Opposing errors can cancel, so use MAE and the operating-point distribution too.' },
  'MAE': { title: 'Mean absolute mixture error', text: 'Average absolute distance from target. Lean and rich errors cannot cancel in this metric.' },
  'Steady map bins': { title: 'Steady operating-point bins', text: 'RPM × VE-load bins that passed context qualification, stability settling and the minimum-sample requirement. These are the primary base-fueling calibration evidence.' },
  'Observed mixture delay median': { title: 'Observed mixture response delay', text: 'Median onset delay across usable isolated fuel-command events. This is observed system response timing, not a claim of pure wideband sensor latency.' },
  'Delay evidence strength': { title: 'Delay evidence strength', text: 'A coarse indication of how much usable event evidence supports the delay estimate. Always interpret it together with event count and P10–P90 spread.' },
};

function ownLabelText(host: HTMLElement): string {
  const textNode = [...host.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
  return textNode?.textContent?.trim() ?? host.textContent?.trim() ?? '';
}

export function ensureFuelingAnalyzerHelp(root: HTMLElement): void {
  const guidance = root.querySelector<HTMLElement>('.specialized-analyzer-guidance');
  const title = root.querySelector<HTMLElement>('[data-specialized="guidance-title"]');
  const text = root.querySelector<HTMLElement>('[data-specialized="guidance-text"]');
  if (!guidance || !title || !text) return;
  const show = createInlineHelpPresenter(guidance, title, text);

  for (const span of root.querySelectorAll<HTMLElement>('.specialized-analyzer-controls label > span, .specialized-analyzer-options-grid label > span')) {
    const help = matchingInlineHelp(ownLabelText(span), CONTROL_HELP);
    if (help) addInlineHelpButton(span, help, show);
  }

  for (const item of root.querySelectorAll<HTMLElement>('.specialized-analyzer-summary > div')) {
    const label = item.querySelector<HTMLElement>('span');
    if (!label) continue;
    const help = SUMMARY_HELP[ownLabelText(label)];
    if (help) addInlineHelpButton(label, help, show);
  }
}
