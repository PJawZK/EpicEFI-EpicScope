# Group 7C — Completion summary authority and operation feedback

Scope: existing v50 lineage `fix/ve-v50-reviewed-groups-1-7`, after 7A/7B. No main merge, ECU writing or Burn.

## Audit and reproduced defect

The base v2 analysis controller already owns generated evidence, proposal counters, source/configuration metadata and the structured completion rows. The run-strip copies those rows for presentation; it does not derive analytical values from DOM text. Working edits remain distinct. Existing lifecycle tests already exercise failures, cancellation, retries, missing channels and obsolete asynchronous success/error completions.

A remaining synchronous publication race was reproduced in Chromium in both worker modes: a source replacement invoked during `ve-analysis-stage-changed` success invalidated the session and hid the summary, but the old run then dispatched `ve-analysis-complete` and reopened an obsolete summary. Pre-change evidence is in `/workspace/epicscope-v50-next-group7c-validation/reproduction.json` and `reproduction.log`.

The existing generation is now rechecked after primary publication, table rendering, success-stage publication and completion notification. Obsolete work returns through the existing owner completion-rejection path. No extra generation system, lifecycle framework, observer, global listener or analytical recomputation.

## Feedback correction

Previously every accepted analysis displayed only “VE analysis complete”, including entirely weak, withheld or no-evidence proposals. Successful completion now reports generated proposal category counts and explicitly says when no cells qualified. It directs review of evidence/qualification/change limits and states the tune is unchanged. Empty proposals remain successful analytical results, not fabricated errors. This generic pre-change feedback was confirmed by inspection; the preserved pre-change browser reproduction specifically proves the stale-summary publication race.

The message uses retained generated counters in constant time. No additional pass over full-log arrays or evidence recomputation. No proposal acceptance, working-edit publication or numerical-policy change.

## Summary audit and healthy behavior preserved

The existing 27-row schema, category semantics, source/tune/configuration labels, applied fuel-correction basis/counts and coverage metadata remain unchanged. Input samples are the evidence input selection after the existing state-filter pass; they are not advertised as the entire recording count. State-excluded count is separate. Proposal categories partition table cells; contributing samples count each contributing traversal occurrence once, rather than summing cell sample counts; duplicate selected occurrences retain their existing multiplicity.

Tests compare displayed rows with owner-published rows and retained primary counters, independently count proposal states, verify known input/table/tune metadata, and retain distinct working edits. No need to add another summary calculator, cache, storage copy or DOM parser.

Numerical references recorded in the browser evidence:

- Original VE70, actual AFR15, target14: raw candidate `70 × 15 / 14 = 75`.
- Original VE70, on-target AFR14/14, applied trim +5%: raw base-VE candidate `70 × 1.05 = 73.5`.

Both agree within 1e-9. No formula differences were introduced. Broader qualification timing/continuity policy questions recorded in earlier numerical audits are not changed by this presentation/publication correction.

## Regression coverage

`tests/web/ve-completion-summary.browser.mjs` is registered in full acceptance:

- Reentrant source replacement during primary, table-render and success publication (three cases).
- Measured, weak, withheld, no-evidence, partial-coverage and compensated-fuel-correction summaries (six cases).
- Each outcome verifies counter projection, source metadata, independent category partition, factual stage feedback and generated-summary retention through working edits/no-op refresh/context updates, without trace reads or source-tune mutation.

A coverage-only test initially included a selectable trim channel, unintentionally enabling compensation. The fixture was corrected to omit trim in that case; the separate compensated case retains its explicit +5% reference. The failed fixture evidence is preserved in fixture-correction.json. No numerical expectation was loosened.

## Limitations / next checkpoint

Manual UI acceptance remains required. User hardware, original approximately 1.2 GB MLG and frozen v50 HTML were unavailable; no original-file latency or visual-parity claim. 7B's section dialog/background-pointer limitations remain unchanged.

Stop after validation/local commit. Group 7A/7B/7C code checkpoints are complete; Group 8 Logger-authoritative timeline/scope, Group 9 visual parity/precision and Group 10 final/manual acceptance remain separate and require authorization.

## Final validation

- Production build/typecheck passed; existing bundle-size advisory remains.
- 917 unit tests across 136 files passed.
- Full Chromium acceptance passed: 1,102 checks across 134 result groups, 551 per mode. Nine new summary/publication cases per mode are included in that total.
- Focused nine-case runs also passed per mode; these are not additional unique full checks.
- Existing failure/cancel/retry/missing-channel/obsolete-completion, editing, loading, navigation and native keyboard checks passed.
- `git diff --check` passed. No full-gate failure, skip or assertion/timeout relaxation.
- Artifacts: `/workspace/epicscope-v50-next-group7c-validation/`.
