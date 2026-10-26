# Group 6B — Lambda Delay discovery and activation workflow

Scope: development lineage `fix/ve-v50-reviewed-groups-1-7`; no main merge, ECU write or automatic Burn. Group 6A's transactional saved-file replacement remains intact.

## Findings and corrections

The v9 re-grab adapter inferred discovery completion by observing the result title and Use button, checking for a literal “Analyzing…” prefix and waiting up to 30 seconds. Failed discovery changed the title while an older recommendation still enabled Use. That observer then activated the older recommendation and overwrote newer working edits. Real Chromium reproduced this failure in both staged-worker and Worker-disabled modes before the correction; see `/workspace/epicscope-v50-next-group6b-validation/reproduction.json`.

The base v2 discovery owner now emits a root-local completion notification only after successful current-generation discovery and readiness publication. The notification carries whether working authority existed when the request began. v9 preserves its accepted re-grab policy by delegating activation through the existing Use control only for that notification. No rendered text or button state is used to infer success. The old observer, timeout, cancellation closure and queued completion check are removed. The listener uses v9's existing AbortController.

The base owner also retains pending/error presentation keyed to its existing delay generation, so refresh cannot replace progress/errors with an older recommendation's guidance. Missing actual-mixture/fuel-command traces produce an actionable discovery error and republish readiness, including withdrawing recommendation-only readiness when its recommendation is cleared. These additional feedback/readiness paths were confirmed by inspection and covered by post-change Chromium regressions; the preserved pre-change browser reproduction specifically demonstrates the failed-re-grab overwrite.

Guidance now states the accepted behavior truthfully: initial discovery requires explicit Use; successful re-grab with an active working table replaces its values/edits, while failed or unusable discovery leaves them authoritative. Previously several messages promised discovery would never replace working values, contradicting v9's accepted policy.

## Ownership and healthy behavior preserved

- v2 owns reading traces, numerical discovery, recommendation, working-delay publication, generations and readiness. No additional full-log calculation or decoding is introduced.
- v9 retains re-grab activation policy; it consumes explicit successful completion rather than interpreting presentation.
- Initial recommendation remains separate until Use. A completed search with no usable recommendation cannot replace working edits.
- Successful re-grab still activates fresh evidence and invalidates dependent analysis once through the existing Use owner. Source/tune/edit/navigation/disposal generations still reject stale work.
- Shared table editing/Brush and Group 6A history semantics are unchanged.
- Runtime Load Data ordering is already INI, MSQ, Open Log, Unload Log, Connect Shim. `source-transition.ts` owns ordering, and Shim integration follows it. Verified in the running shell; no second reorder implementation added.
- No new global listener, observer, lifecycle framework, worker or storage operation. One existing observer and its timeout are removed.

## Regression coverage

`tests/web/ve-delay-workflow.browser.mjs`, registered in the full acceptance runner:

1. Failed re-grab preserves working edits/generation/revision and retains an actionable error through refresh.
2. Refresh during pending discovery cannot activate old evidence or erase progress; eventual fresh success replaces edits exactly once.
3. A search with no usable recommendation leaves working values unchanged.
4. Missing scoped channels retain working authority and show an error through refresh.
5. Missing scoped channels withdraw recommendation-only readiness.
6. Actual shell Load Data order follows the existing owner.

The existing full browser suite additionally covers initial activation, accepted re-grab, editing/history, file replacement and stale discovery/lifecycle behavior.

## Limits

Manual UI acceptance remains required. Native OS file dialogs, user hardware and the original approximately 1.2 GB MLG were unavailable. These corrections establish authority and workflow behavior, not original-file loading latency or large-log timing. Frozen v50 HTML remains unavailable; no speculative visual parity changes were made.

Stop after Group 6B. Group 7 completion summary/View Proposal/general operation feedback is separate, followed by timeline scope, visual parity and final acceptance work.

## Final validation

- Production build/typecheck passed; existing bundle-size advisory remains.
- 917 unit tests across 136 files passed.
- Full Chromium acceptance passed: 1,062 checks across 126 result groups, 531 per mode. Six new workflow cases per mode are included in that total.
- Focused Chromium also passed six cases per mode; those are not additional unique checks.
- `git diff --check` passed. No full-gate failure, skipped case or assertion/timeout relaxation.
- Full artifacts: `/workspace/epicscope-v50-next-group6b-validation/`.
