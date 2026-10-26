# Group 7A — View Proposal navigation

Scope: completion action navigation only, on `fix/ve-v50-reviewed-groups-1-7`. Dialog focus/keyboard behavior (7B) and summary/general operation feedback (7C) remain separate.

## Reproduced defect

The completion dialog's View Proposal action selected Result View `proposal` and dismissed the dialog, but never selected the VE table tab. In single-table layout with Target active, Target therefore remained visible. This also failed when Result View was already `proposal`, because there was no Result View change to dispatch.

Real Chromium reproduced the single/proposal case before correction in staged-worker and Worker-disabled fallback modes. Evidence: `/workspace/epicscope-v50-next-group7a-validation/reproduction.json` and `reproduction.log`.

## Correction and ownership

The existing run-strip action now delegates to the existing `[data-table-tab="ve"]` button before selecting the Result View and dismissing the dialog. v7 remains the sole owner of active tab, layout, panel visibility and header-control placement. This is the same navigation route already used by the v50 table-header adapter.

No new navigation state, controller, listener, observer, lifecycle wrapper or DOM visibility mutation is introduced. Side-by-side/single layout preference remains unchanged. The action selects Working VE (existing key `proposal`); it does not regenerate or accept a proposal, mutate original tune data or publish working edits.

## Regression coverage

`tests/web/ve-view-proposal.browser.mjs`, registered in the full acceptance runner, checks four combinations:

- Single-table / already-selected Working VE.
- Single-table / analysis weight Result View.
- Side-by-side / already-selected Working VE.
- Side-by-side / analysis weight Result View.

Each starts with Target active, completes actual analysis, retains a fractional working edit, and invokes View Proposal. Assertions cover visible VE panel, selected VE tab, Working VE Result View, unchanged layout preference, dismissed summary, unchanged source tune, retained working edit/generation, identical primary analysis, stable session revision, unchanged table identity and no extra trace reads. Each repeats the action after returning to Target with `proposal` already selected.

The test checks rendered state only as presentation evidence; production numerical authority never comes from DOM text.

## Limits and next checkpoint

Manual UI acceptance remains required. No native keyboard-focus acceptance is claimed; focus containment, Escape and restoration belong to 7B. Summary math and broader operation feedback belong to 7C. Frozen v50 HTML, user hardware and the original approximately 1.2 GB MLG were unavailable. No large-log latency claim or numerical policy change.

Stop after validation and local commit. No push or merge into main.

## Final validation

- Production build/typecheck passed; existing bundle-size advisory remains.
- 917 unit tests across 136 files passed.
- Full real Chromium acceptance passed: 1,070 checks across 128 result groups, 535 per mode. The four new View Proposal cases per mode are included in that total.
- Focused Chromium also passed four cases per mode; those are not additional unique full checks.
- `git diff --check` passed. No full-gate failure, skip or assertion/timeout relaxation.
- Artifacts: `/workspace/epicscope-v50-next-group7a-validation/`.
