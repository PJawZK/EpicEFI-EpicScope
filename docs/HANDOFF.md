# EpicScope Handoff

## Continuation authority

Repository: `PJawZK/EpicEFI-EpicScope`

Authoritative production branch: `main`

Current integration candidate branch:

`integrate/points-2-11-clean`

Current integration PR:

PR #462 — **Integrate Analyzer ownership and correctness fixes through point 11**

Current accepted browser-preview head before this documentation update:

`b435702412642f039a8a7f49d33037c309bef9d8`

Hosted production application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

PR preview:

`https://pjawzk.github.io/EpicEFI-EpicScope/previews/pr-462/`

This file is the present-tense continuation authority. `DOCUMENTATION_MAP.md` defines how to interpret historical/reference documents. If older wording conflicts, use current `main`, this handoff, the relevant subsystem authority and current browser/runtime evidence.

## Current project position — 2026-10-15

- **Logger** — mature functional reference. Broad performance/micro-optimization work remains paused unless a measured regression appears.
- **Histogram** — generic research-parity checkpoint closed for the approved scope. Table Generator, Distribution, Scatter and Math Channels are mature unless field use exposes a concrete correctness gap.
- **Analyzer** — ownership/correctness/performance cleanup through points 1–11 is implemented on PR #462 and has now passed owner browser acceptance on the exact preview head listed above.
- **VE Analyzer** — current Result View source-authority and heat-map regressions are fixed and browser-accepted. Session retention, retained-primary evidence reuse, semantic invalidation, active-domain routing and cooperative analysis all remain intact.
- **Diagnostics / observability** — architecture/research work is documented separately; implementation may begin after PR #462 is merged/reconciled and the baseline is confirmed stable on `main`.
- **MLG v3** — researched compatibility extension, not yet implemented; v1/v2 remain production support.
- **Linux production implementation** — future work after Web maturity/cleanup.

## Repository and branch state

Historical remote-branch cleanup was completed earlier; old branches are not knowledge stores. Recover old implementation detail from Git history/merged PRs when needed.

The current integration work is isolated on `integrate/points-2-11-clean` / PR #462. The branch was reconstructed directly on production `main` instead of merging divergent temporary ancestry wholesale.

The temporary source branch `temp/epicscope-fixes-points-1-2-20261015` remains historical evidence for the points work only.

PR #462 is still draft/open at the time of this handoff update. Do not silently merge it. Merge/reconcile only as an explicit next action after confirming the PR head and CI still correspond to the accepted build or a documentation-only descendant of it.

## Documentation authority map

- `HANDOFF.md` — present-tense continuation authority.
- `FIX_PLAN.md` — consolidated correctness/performance work list and scope boundaries.
- `POINTS_5_11_INTEGRATION_REVIEW.md` — clean-integration review/evidence for points 5–11.
- `OBSERVABILITY.md` — planned observability/flight-recorder architecture authority.
- `research/OBSERVABILITY_PERFORMANCE_IMPLEMENTATION_RESEARCH.md` — efficiency/performance implementation research for observability.
- `DOCUMENTATION_MAP.md` — document authority/history classification.
- `PRODUCT.md` — current product contract.
- `ROADMAP.md` — current sequence/status.
- `ANALYZER.md` — Analyzer family authority.
- `HISTOGRAM.md` — Histogram authority.
- `VE_ANALYZER.md` — VE algorithm/evidence/product contract.
- `VE_ANALYZER_WORKBENCH.md` — VE UI/workflow contract.
- `PREPOPULATED_WORKSPACES.md` / `STARTER_SYSTEM_VALIDATION.md` — Logger starter/workspace authority.
- `TS_SHIM_STATUS.md` — current live-source validation authority.
- `research/STATUS.md` — living research-to-product disposition.

Literal INI/MSQ/channel/table names remain preserved in user-facing behavior. Semantic roles may guide selection internally but must not rename source data.

## Approved visible workflow

Primary:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

Histogram:

> **Scope → Channels → Qualification → analysis-specific controls → evidence → Logger / Export**

VE Analyzer:

> **Load INI + MSQ + Log → select VE/target tables → verify actual mixture/RPM/load → qualify → discover/load lambda delay → activate working delay table → Run Analysis → review evidence/proposal**

Load Data order:

1. Load INI
2. Load MSQ
3. Open Log
4. Unload Log
5. Connect Shim

INI and MSQ are independent application resources and survive source transitions.

## Source/runtime topology

Validated topology:

```text
Mega144H7 USB CDC
      ↓
Pi Zero 2 W
      ↓
ts_shim
      ↓ LAN
EpicScope same-origin Vite proxy
      ↓
Logger / Analyzer / Histogram
```

Stable workspace assignments normalize between canonical `ini:*` identities and matching raw Shim identities. Source transitions must never reapply starter templates, resurrect deleted channels or create raw + `ini:*` duplicate traces.

The Pi Zero 2 W phone-hotspot workflow is validated: Pi and laptop can share the phone hotspot for `ts_shim`, and the Pi returns to the configured home network when the hotspot is disabled.

## Logger checkpoint

Mature behavior includes MLG v1/v2 staged import, CRC/source diagnostics, large-log reuse, INI-backed channel binding, reusable workspaces, multi-pane Logger, A/B ranges, stable recorded/Shim channel identity, semantic starters, unavailable-channel handling and retained-memory/performance/runtime diagnostics.

Starter invariant:

- **Layout** = geometry.
- **Starter template** = semantic recipe.
- **Workspace** = ordinary user-owned state.

A starter resolves once. Later source transitions normalize identities only.

Do not resume broad Logger/performance micro-optimization without a concrete measured problem.

## Histogram checkpoint

Generic Histogram research parity is closed for the approved scope.

Current mature surfaces are Table Generator, Distribution, Scatter and Math Channels. Logger owns the authoritative timeline; Histogram reuses the complete timeline shell.

Point 9 on PR #462 adds explicit, recoverable persistence-failure feedback for saved Histogram/Math state without replacing the existing storage/cache owners.

## Analyzer checkpoint — integrated points 1–11

The integration candidate preserves the current Codex-era ownership model. Do **not** restore older controller files wholesale or roll back the points 5–11 architecture to fix local presentation defects.

### Point 1 — large-log correctness

Complete and already represented on production history before the clean integration reconstruction.

- Removed sample-sized argument spreads in VE, Fueling and Ignition large evidence/segment paths and VE visit extrema.
- >320k continuous-valid-sample regressions are retained in the clean integration.

### Point 2 — VE session authority

Complete.

- Unchanged context/tune updates preserve working delay, retained primary result and proposal.
- Real source/catalog/sample-count/validity/tune/selected-scope changes invalidate conservatively.
- Existing generations reject stale asynchronous completions.
- Logger → Analyzer navigation preserves completed VE session authority.

### Point 3 — retained primary evidence

Complete.

- VE v2 owns `getPrimaryAnalysis()` and publishes borrowed read-only references to the current completed analysis.
- Cell evidence consumes retained primary evidence/proposal instead of performing a second full-log VE analysis.
- No duplicate trace load / qualification / evidence-map / proposal run is required to open a cell.

### Point 4 — semantic detail invalidation

Complete.

- Result View changes are presentation-only with respect to primary-analysis identity.
- Cell-detail cache invalidation follows semantic owner notifications rather than broad root input/change observers.
- Popup detail/strongest-visit work is reusable for the current primary analysis.

### Point 5 — selector / DOM ownership

Complete.

- Analyzer and Histogram document-wide option-decoration scans/observers were removed.
- Existing selector owners create/label/validate their own options.
- VE actual-mixture eligibility/default correction is selector-local.
- No replacement global observer/listener/lifecycle wrapper was introduced.

### Point 6 — active Analyzer routing

Complete.

- Only the selected active Analyzer domain receives expensive work.
- Hidden controllers retain latest pending input and defer calculation until activated.
- Deactivation/real replacement advances existing generations so obsolete completions/errors cannot update a newer session.
- Completed VE authority survives navigation where semantics remain unchanged.

### Point 7 — CPU/correctness cleanup

Complete for the profiled scope.

- VE robust weighted estimates prepare/sort observations once and reuse the sorted input for median/P10/P90.
- Channel-role normalization is cached by immutable definition identity.
- Idle/AE extrema use bounded iteration rather than argument spreads.
- Event-table preparation is capped to the displayed 200 rows while summaries retain full evidence.
- Event-envelope percentiles sort each bin once and reuse it.

No unprofiled rolling-window/recovery rewrite was performed.

### Point 8 — cooperative VE work

Complete for the profiled VE evidence pipeline.

- VE calculation uses cooperative bounded batches/yields rather than adding an unjustified new worker/lifecycle model.
- Progress and explicit Cancel are present.
- Existing generation/activity ownership performs cancellation/stale rejection.
- Browser acceptance reports Analyzer responsiveness is substantially improved versus the earlier pre-Codex regression state.

### Point 9 — persistence failure visibility/recovery

Complete.

- Distribution, Scatter, Table Generator presets/filters and Math Channel save/delete paths surface storage failure.
- Failed changes remain usable in current-session state and expose Retry.
- Existing storage schemas, keys and caches remain authoritative; no automatic retry loop or parallel persistence architecture was added.

### Point 10 — analysis trace-load errors

Complete.

- Range comparison, Tune correlation, Boost, specialized suite, Ignition and Fuel/Injector handle current-generation trace-load rejection at their existing controller boundaries.
- Obsolete/hidden failures remain ignored through point-6 guards.
- Current failures hide stale output, present safe actionable error text and allow retry through the existing control.

### Point 11 — transactional MSQ replacement

Complete.

- The last valid tune/session stays authoritative while a replacement is read, parsed, structurally validated and normalized.
- Failed replacement preserves the old tune and valid VE working delay/result/proposal/evidence.
- Latest selection wins through an app-shell generation token, including when the latest selection fails.
- A successful accepted replacement publishes the new model once through the existing tune owner and invalidates dependent analysis normally.
- This remains a transactional MSQ replacement change only; it is not a general file-loading refactor.

### Point 12 — telemetry async conversion/socket identity

Not implemented. Remains lower-priority and reproduction-gated. Existing ArrayBuffer transport and frame-generation guards reduce exposure. Do not implement without a controlled deferred-conversion/reconnect reproducer.

## VE Result View blocker — RESOLVED and browser-accepted

The earlier blocker was that v7 reparsed mutable visible cell text when switching Result Views. Because the UI refinement layer also rewrites presentation text, one Result View could become the next Result View's source and original VE values could degrade or disappear.

### Source-authority repair

Commit lineage on PR #462 now resolves current VE from retained primary analysis/model coordinates, with stable cell metadata as fallback, instead of treating the currently rendered Result View text as authoritative source state.

Important implementation constraint retained:

- app-level UI refinement reverses rendered load rows;
- model lookup therefore maps RPM/load coordinates back to authoritative axes rather than deriving model index from DOM row position.

The earlier value-loss repair was introduced in commit:

`5608edd00a7a5781d29d488c61fbb5e5bfd07cf3`

A full-stack browser regression module was then added in:

`c23fabeeedf11295cb900ee3d00076f048b5f251`

The regression exercises the VE controller together with `installVeAnalyzerUiRefinements()`, repeated Result View switching, measured/weak/evidence-only/no-evidence presentation classes, retained primary identity, no extra trace loading and valid interpolated Lambda Delay behavior.

### Heat-map behavior

Owner browser testing showed that value retention was fixed but the first repair did not match the intended historical heat-map behavior.

The accepted visual rule is now:

- **Proposed VE** — use the VE-table heat-map.
- **Alternate Result Views** — cells with a real selected metric use that Result View's metric scale.
- **Untouched/fallback cells in alternate views** — show the preserved VE value but use neutral heat, rather than carrying Proposed VE coloring into the metric view.
- **Lambda Delay** — valid interpolated delay remains a real metric and keeps the delay view's metric/range behavior.

The accepted preview head containing this heat-map correction is:

`b435702412642f039a8a7f49d33037c309bef9d8`

Web CI run `38813570272` passed type-check, tests and production build for that head.

### Owner browser acceptance on exact preview head

The owner tested the exact PR preview build at `b435702412642f039a8a7f49d33037c309bef9d8` with the normal real-data workflow and confirmed:

- VE values remain stable through repeated Result View switching;
- heat-map behavior now matches the intended pre-regression behavior;
- Lambda Delay table values remain correct;
- completed VE analysis survives switching to other analyzers and leaving/re-entering Analyzer;
- weak cells remain sensible;
- no noticeable Result View/session regression remains;
- Analyzer responsiveness is substantially better than the problematic pre-Codex state.

Therefore the Result View blocker is **closed** and the points 1–11 integration is **browser-accepted at the exact preview head above**.

A documentation-only descendant of that accepted head does not require repeating the runtime browser test if no runtime/build source changes are introduced. Any subsequent runtime code change before merge requires fresh CI and exact-head browser acceptance proportional to the change.

## Remaining VE ownership debt

`readDelaySurface()` still reconstructs the working delay surface from rendered DOM headers/cells/datasets even though the VE owner has authoritative working-delay state.

This is **not** the cause of the resolved Result View bug and must not block PR #462. Treat it as later ownership cleanup, not as justification for widening the accepted integration before merge.

## Observability / diagnostics continuation

A separate planned feature track consolidates current Diagnostics, Performance and Report systems into one bounded observability/flight-recorder architecture.

Implementation authority: `docs/OBSERVABILITY.md`.

Performance-specific research: `docs/research/OBSERVABILITY_PERFORMANCE_IMPLEMENTATION_RESEARCH.md`.

Established constraints include:

- one authoritative bounded observability/session stream;
- specialized reports as projections rather than parallel stores;
- packed/efficient hot-path representation, separate critical/detail retention, pre-insertion coalescing and backpressure;
- numeric stable IDs for common fields, monotonic timestamps and primitive operation IDs;
- owner-provided revisions/fingerprints; no arbitrary state hashing;
- event/boundary-driven snapshots, not broad polling;
- O(1) streaming anomaly state; expensive causal analysis deferred;
- batched/chunked persistence rather than per-event writes;
- previous-session black-box tail plus anomaly/error context windows;
- recursion/self-observation protection;
- explicit observability-on versus minimal/off overhead benchmarks;
- no automatic runtime mutation/repair from anomaly detection initially.

Do not begin a broad observability implementation by disturbing the now-accepted PR #462 runtime baseline. Merge/reconcile the accepted integration first unless a concrete merge blocker appears.

## Immediate continuation order

1. Confirm PR #462 current head is the accepted runtime head `b435702412642f039a8a7f49d33037c309bef9d8` or only a documentation-only descendant with passing CI.
2. Merge/reconcile PR #462 with `main` when explicitly requested/approved.
3. After merge, verify `main` contains the accepted points 1–11 integration and Result View fixes; do not redo already accepted work.
4. Point 12 remains reproduction-gated and lower priority.
5. The DOM-derived Lambda Delay surface remains a later ownership-cleanup candidate, not a current blocker.
6. After the correctness/performance baseline is stable on `main`, begin the observability implementation plan from its documented step 1 or continue the next explicitly chosen EpicScope maturity target.

## Acceptance rule

For VE/Analyzer runtime work, CI is necessary but not sufficient. Browser behavior on the actual integrated build is the acceptance authority.

The Result View source-authority and heat-map repairs are accepted for preview SHA `b435702412642f039a8a7f49d33037c309bef9d8`.

Never automatically write or Burn to the ECU. Original VE/tune data, Analyzer evidence/proposal and any user-reviewed application result remain distinct states.
