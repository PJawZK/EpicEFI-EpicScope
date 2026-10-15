# EpicScope Handoff

## Continuation authority

Repository: `PJawZK/EpicEFI-EpicScope`

Authoritative production branch: `main`

Browser-validated VE runtime baseline:

`86357400be6971b1f8edfe98d70816fa55b3bec5`

PR #449 — **Restore VE Analyzer runtime to browser-known good state**.

Documentation commits after that runtime baseline do not intentionally alter VE runtime behavior.

Hosted application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

This file is the present-tense continuation authority. `DOCUMENTATION_MAP.md` defines how to interpret historical/reference docs. If older wording conflicts, use current `main`, this handoff, the relevant subsystem authority and current browser/runtime evidence.

## Current project position — 2026-10-15

- **Logger** — mature functional reference. Broad performance/micro-optimization work remains paused unless a measured regression appears.
- **Histogram** — generic research-parity checkpoint closed for the approved scope. Table Generator, Distribution, Scatter and Math Channels are mature unless field use exposes a concrete correctness gap.
- **Analyzer** — maturity remains uneven. Fueling and non-knock Ignition are mature experimental checkpoints, Boost is strong, Idle/AE are useful but thinner, Fuel / Injector and Trigger / Sync retain targeted maturity gaps.
- **VE Analyzer** — implemented, real-log/browser validated and currently the highest-value active maturity target.
- **MLG v3** — researched compatibility extension, not yet implemented; v1/v2 remain production support.
- **Linux production implementation** — future work after Web maturity/cleanup.

## Repository state

Remote branch cleanup is complete.

The repository had accumulated roughly 195 remote branches. Cleanup removed:

1. branches fully contained by `main`;
2. patch-equivalent branches already represented in `main`;
3. remaining historical branches after family-by-family audit confirmed their useful behavior/research was preserved in current `main` or Git/PR history.

Current remote branch authority is now only:

```text
origin/HEAD -> origin/main
origin/main
```

Historical branches are no longer knowledge stores. Recover old implementation detail from Git history/merged PRs when needed.

See `BRANCH_CLEANUP_2026-10-15.md`.

## Documentation authority map

- `HANDOFF.md` — present-tense continuation authority.
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
- other dated research/decision/plan docs — historical/reference unless explicitly marked current authority.

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

Source ownership:

```text
Recorded MLG + optional INI binding
              ↕
         INI catalog only
              ↕
      ts_shim live/capture
```

Stable workspace assignments normalize between canonical `ini:*` identities and matching raw Shim identities. Source transitions must never reapply starter templates, resurrect deleted channels or create raw + `ini:*` duplicate traces.

The Pi Zero 2 W network/deployment path has also been validated on the phone-hotspot workflow: Pi and laptop on the same hotspot can connect to `ts_shim`, and when the hotspot is disabled the Pi returns to the configured home network without manual reconfiguration.

## Logger checkpoint

Mature behavior includes:

- MLG v1/v2 staged import, CRC/source diagnostics and large-log reuse;
- INI-backed channel catalog/binding and optional MSQ enrichment;
- reusable named graph workspaces and exact-log navigation persistence;
- fixed/freeform multi-pane Logger plus Single/Dual layouts;
- A/B ranges, markers and saved ranges;
- stable channel identity across recorded/Shim transitions;
- semantic starter resolution and capability gating;
- 12 generic fresh-state workspaces and 12 capability-gated EpicEFI-specific starters;
- explicit Blank / From template creation;
- editable/deletable materialized starter workspaces;
- explicit unavailable-channel handling;
- retained-memory, parser, performance and runtime-health diagnostics.

Starter invariant:

- **Layout** = geometry.
- **Starter template** = semantic recipe.
- **Workspace** = ordinary user-owned state.

A starter resolves once. Later source transitions normalize identities only.

Do not resume broad Logger/performance micro-optimization without a concrete measured problem.

## Histogram checkpoint

Generic Histogram research parity is closed for the approved scope.

Current mature surfaces:

- **Table Generator** — shared scopes/Qualification, physical + Math Channels, tune/custom/automatic geometry, Count/Mean/Median/Min/Max/Sum/StdDev/Variance/Weighted Mean, aligned reference/delta evidence, Logger navigation and CSV/provenance.
- **Distribution** — Count/% Samples/Time, Histogram/Cumulative, comparison, saved setups, CSV, exact fixed geometry, outside-geometry provenance and Logger evidence.
- **Scatter** — Single/Dual, Dots/Lines, density heat, bounded rendering, point/box evidence, strongest contiguous Logger visit, saved setups and qualified/region CSV export.
- **Math Channels** — arithmetic/comparison/logical expressions, lazy `if()`, historical references and temporal helpers (`lag()`, `delta()`, moving `avg()`, timestamp-based `rate()`).

Logger owns the authoritative timeline. Histogram reuses the complete `.timeline-wrap`; do not split its timeline shell/edge-toggle positioning context.

## Analyzer checkpoint

### Fueling

Mature experimental checkpoint. Lambda-first semantics, state qualification, trailing-window stability, observed mixture-response delay, correction context, evidence strength and Logger navigation are established.

### Ignition

Mature non-knock checkpoint. Final timing/correction/dwell/load context, large-log-safe events, Areas to review and optional MSQ base-table attribution are established without knock/safety claims.

### Boost

Strong experimental foundation, control-mode aware and plumbing/polarity neutral.

### Fuel Pressure / Injector

Substantially improved. Established behavior includes source-continuity-correct events, exact event extrema, injector headroom/saturation, calibrated low/high pressure semantics, Conventional-vs-GDI modes and event-context core.

Remaining useful work: visible event-extreme context, sag/recovery, repeatability, pump/prime evidence, voltage/deadtime evidence and stronger Logger navigation.

### Trigger / Sync

Still thinner. Later useful work: sync/loss context, glitch-vs-sustained classification, pre/post evidence, RPM/voltage/load context, frequency by RPM band and direct Logger navigation.

### Idle / AE

Useful foundations; later refinement after current VE priorities.

## VE Analyzer — current implemented state

Current behavior includes:

- VE/target tables and matching axes from tune metadata;
- strict actual-mixture semantics and scale-aware AFR/Lambda handling;
- optional operating-range/state qualification and actionable Run readiness;
- **RPM × load lambda-delay table only** as the accepted working model;
- explicit **Grab lambda delays from log** discovery;
- measured/interpolated/insufficient delay provenance;
- recommendation and working delay state separated conceptually;
- direct inline delay-cell editing and reusable saved delay tables;
- timestamp-aligned mixture evidence;
- optional known fuel-correction compensation;
- robust weighted-median VE evidence with P10/P90 spread, cumulative evidence and confidence;
- starting-table prior authority and withheld out-of-authority proposals;
- Result View overlays;
- cell evidence with strongest contiguous visit → Logger.

### Browser-known-good boundary

The last explicitly browser-confirmed good runtime before the regression investigation is the #441 cell-evidence state:

`fd21e4d4a390a4f6607d0290ef273749fc7fd915`

PR #449 restored runtime files to that known-good composition while retaining later audit documentation. The project owner confirmed Analyzer entry works again after rollback.

Do **not** claim a future VE change is fixed merely because CI passes. Browser behavior is acceptance authority for this surface.

### Known remaining VE issues

- Result View fallback/precision behavior remains imperfect.
- VE result/session preservation is implemented locally in point 2 below; duplicate popup analysis and presentation invalidation remain open.
- v2 now owns semantic context/tune invalidation; real source/tune/scope changes intentionally rebuild.
- Cell evidence now consumes retained primary VE state through the point-3 contract below; presentation invalidation and global decoration remain open.
- working delay ownership is still partly reconstructed/controlled through rendered DOM.
- Custom qualification semantics need redesign before advanced formula support.

### Required next sequence

1. preserve the current browser-known-good runtime;
2. fix Result View fallback/precision with one isolated browser-verified change;
3. fix Logger → Analyzer result persistence with one isolated browser-verified change;
4. then expose authoritative VE session/result/proposal/working-delay state;
5. remove duplicate cell-evidence analysis and DOM-derived delay ownership;
6. later refine review/application strength/export/diff behavior.

Never automatically write or Burn to the ECU. Original VE, Analyzer evidence/proposal and user-reviewed/application result remain distinct states.

## Preserved VE behavioral constraints

Do not regress table-first workflow, spatial/bilinear weighting, starting-table prior authority, cumulative evidence, independent absolute/percentage safeguards, original-vs-proposal separation, transient recovery qualification, correction-layer context, selective review/revert, multiple result views and explicit user review before any tune mutation.

## Current continuation boundary

The documentation/remote-branch consolidation is complete. Continue product work from current `main`; do not resurrect old historical branches or stale planned-only VE wording as authority.

### Large-log correctness pass — point 1 of the approved eight-pass sequence

Point 1 is implemented in the current working tree on top of `f517a0aaf5c210d7fe30005dae29639142aab747`; it has not been committed or published. Point 1 was reviewed; point 2 is now implemented below.

- Replaced sample-sized function-argument spreads in VE evidence, Fueling operating-map and Ignition review-region segment accumulation with individual pushes. Replaced VE evidence-visit timestamp extrema spreads with bounded iteration. Sample order, qualification, stability and proposal semantics remain unchanged.
- Added eight regressions using 320,459 samples: VE/Fueling/Ignition with both zero and 300-ms stability windows, working-delay-aligned VE, and a large VE evidence visit whose extrema are not just its endpoint timestamps. All eight reproduced stack overflows before the fix. The analysis tests have a local 30-second correctness-test budget; this is not a responsiveness target or a global timeout change.
- Validation: 115 test files / 586 tests passed with `npm test -- --maxWorkers=4`; `npm run build` passed, including typecheck; `git diff --check` passed.
- Chromium 154, 1366×645, DPR 1: loaded the synthetic 1,193,829,695-byte / 320,458-record / 1,389-channel MLG with its matching INI/MSQ and saved 100-ms delay table. Full-log VE completed with 320,418 contributing samples (10 delay-unavailable and 30 stability-rejected), and a measured-cell evidence popup opened. Full-log Fueling completed with 320,428 stable samples; Ignition completed with RPM/load context. Report showed 0 ISSUE / 0 WARN. The large-visit helper also completed in Chromium with all 320,459 samples retained and the expected duration. These checks use synthetic data, not the owner's original recording, and do not establish performance on low-spec hardware.
- Local browser evidence/replay script: `/tmp/epicscope-point1/browser-check.mjs`, `browser-check.log`, `ve-full-log.png`, and `runtime-report.txt`. The replay uses the existing generated fixtures under `/tmp/epicscope-audit/`; these temporary files are not repository dependencies.

Point 2 follows below. Points 3–8 remain unimplemented. Duplicate popup calculation, presentation invalidation, option-decoration, hidden-view and CPU issues remain open; do not infer their resolution from these correctness checks.

### VE authority pass — point 2 of the approved eight-pass sequence

Implemented locally, uncommitted and unpublished. Stop after this pass; do not start point 3 without the owner's continuation. No GitHub push/pull was performed. No usage-limit warning was reported during this pass.

- Logger supplies stable numeric-source identity plus sample count and validity revision. The existing v2 VE owner compares source/catalog and effective selected scope; unchanged callbacks, equivalent catalog objects, unused A/B changes, and the same tune model/source name preserve working delay, primary result and proposal. Real source, catalog, sample-count, validity, tune or selected-scope changes rebuild conservatively. Tune identity assumes the existing immutable model replacement contract; in-place model mutation is not detected.
- Existing controller layers forward whether setters changed semantic inputs, avoiding their selection resets/table redraws on unchanged updates. This adds no lifecycle wrapper, global listener or observer.
- The owner advances analysis/discovery/file-load generations during invalidation and rebuild. Old asynchronous results and errors cannot populate a replacement session. Delay-file selection rejects older reads. The existing re-grab observer checks owner revision before automatic recommendation application. Popup loading uses its existing cache boundary to reject stale completion and close stale detail; primary-result reuse remains point 3 and broad presentation invalidation remains point 4.
- Added six source-comparison unit tests and `tests/web/ve-analyzer-lifecycle.browser.mjs`: 13 real-Chromium checks exercising both the v2 owner and full controller chain, edited-delay/result preservation, A/B and saved scope changes, source/catalog/count/validity/tune replacement, stale analysis/discovery/file/popup completion and stale rejection. Run the browser module through Vite's `/@fs/` URL and await `runVeAnalyzerLifecycleChecks()`; it is separate from the Node Vitest suite.
- Validation: 116 test files / 592 tests passed with `npm test -- --maxWorkers=4`; `npm run build` (including typecheck) and `git diff --check` passed. Browser regression result: 13/13 passed. Local replay/evidence: `/tmp/epicscope-point2/regressions.mjs`, `regressions.log`, `lifecycle-result.json`, `navigation.mjs`, `navigation.log`, `tests.log`, `build.log`.
- Initial end-to-end validation gap (resolved by the controlled investigation below): the 1.2-GB / 1,389-channel fixture loaded and CRC validation completed, but the application stopped answering browser evaluations after Analyzer entry, before VE selection. A 16-channel derivative with 320,458 samples and a short 2,000-sample derivative also did not complete Analyzer entry. The first derivative was initially malformed by the temporary fixture generator; its header was corrected before the latter attempts. These are incomplete checks, not acceptance passes; the source of the entry stall was not established. Do not claim overall browser freezes are resolved or that this stall is proven pre-existing. Keep this validation gap explicit when reviewing point 2. Passing controller-level browser checks do not establish shell navigation correctness. The short fixture currently occupies `/tmp/epicscope-point2/navigation.mlg`; logs are `navigation.log`, `navigation-small.log`, `navigation-shell.log`. The small-log script retains the original large-log label, which is not reliable record-count evidence.


Next pass after review: point 3, expose retained primary VE analysis/evidence/proposal through the existing controller contract and remove popup full-log recomputation. Keep the current v2 authority and its invalidation semantics. Points 3–8 are not implemented.

### Controlled Analyzer-entry investigation — follow-up to point 2

The initial shell validation gap above is now resolved for the tested synthetic workflows. See [VE_ANALYZER_ENTRY_INVESTIGATION.md](VE_ANALYZER_ENTRY_INVESTIGATION.md) for the controlled comparison, call path, evidence and remaining limits.

- Point 1 entered Analyzer/VE normally with the same short fixture. Point 2 stalled before VE selection. The unchanged-tune path exposed a latent global decorator loop: a preferred AFR ID absent from the hidden VE selector was assigned, leaving the actual value empty, but a synthetic change still invalidated/rebuilt VE. Child-list mutations retriggered the document-wide decorator indefinitely. Trace stack: global decoration → mixture enforcement → change → v2 invalidate → renderTables → DOM mutations → decoration. This was CPU/DOM feedback after file loading, not additional file I/O.
- Narrow fix in `analyzer-channel-roles.ts`: restrict fallback preference to options present in the selector; dispatch change only after a real value transition. This preserves point-2 state retention and introduces no observer, global listener or lifecycle wrapper. Do not restore unconditional tune rebuilds as a workaround. Point-5 global scan/catalog ownership cleanup remains open.
- Direct old/new browser comparison: two decoration attempts advanced original VE revision 1 → 3 → 5 while leaving its selector empty; the fix preserved revision 1. Added two permanent browser regressions, bringing the separate lifecycle suite to 15 passing checks. All 116 Vitest files / 592 tests passed again, and production build/typecheck/diff checks passed.
- Full application browser acceptance now passed with both 2,000 records / 16 channels and the original synthetic 1.2-GB / 320,458-record / 1,389-channel MLG: INI/MSQ/MLG → Analyzer comparison → VE, edited working delay 125 ms, Run Analysis, three Logger round trips, another Analyzer domain and Histogram return. The large run retained all 56 measured proposal cells and 320,418 contributing samples; summaries, delay and proposal titles were unchanged after navigation. Both Report checks: 0 ISSUE / 0 WARN.
- The infinite loop is fixed for these reproduction paths, but large-log calculation and navigation still have multi-second costs. Do not claim overall responsiveness is solved. No original owner recording or low-spec hardware was tested.
- Evidence/scripts/profiles/screenshots exported to `/workspace/epicscope-investigation/evidence/` and `/workspace/epicscope-investigation/epicscope-analyzer-entry-evidence.zip`. Local comparison copies and temporary Vite/browser processes used `/tmp/epicscope-investigation/`. All product changes remain uncommitted in `/workspace/EpicEFI-EpicScope`; no push/pull was performed. No usage-limit warning was received. Stop here before point 3.

### VE popup reuse — point 3 of the approved eight-pass sequence

Point 3 is implemented locally on `temp/epicscope-fixes-points-1-2-20261015`, above commit `dbecb07b1dbee53d24fd023b8d10a417b9d812df`. The branch was previously pushed with points 1–2; point-3 changes are uncommitted and have NOT been pushed. Stop here before point 4. No GitHub operations were performed during point 3. No usage-limit warning was received; this is a clean continuation boundary.

- Existing v2 remains the authority. Its explicit `getPrimaryAnalysis()` controller contract returns borrowed read-only references to the completed run's evidence, proposal, VE table/axes, qualified actual-mixture range and qualification metadata. All existing controller layers forward the contract. No full-log arrays are cloned for this contract. Consumers must not mutate borrowed references.
- The owner withdraws the snapshot on invalidation, rebuild and accepted rerun start, then publishes a new snapshot only after generation-checked evidence/proposal calculation. Unchanged updates/navigation preserve its identity. Existing stale-analysis/source/tune/scope protection remains in place.
- Cell evidence now consumes that snapshot synchronously. Removed its duplicate trace load, quick-qualification pass, state-filter pass, delay-table reconstruction from DOM, evidence calculation, proposal calculation and redundant asynchronous analysis cache/generations. Before a valid primary run (including during reruns), opening a cell displays run guidance and performs no loading or implicit calculation. Rendered cell headers are still used to map the clicked cell to retained axes; the popup no longer derives analysis settings from DOM.
- Popup metrics, sample counts, proposal state and strongest Logger visit use the same qualified evidence/range as the primary table. The per-cell strongest-visit helper still sorts/groups contributing indices; this is not a claim that all popup work is constant-time.
- Existing broad change/input/delay-DOM invalidation still hides detail. Narrowing that behavior is point 4, not part of point 3. Global decoration, hidden-domain routing, weighted sorting/normalization and worker/batching passes remain points 5–8.
- Browser suite `tests/web/ve-analyzer-lifecycle.browser.mjs`: 18 checks passed. Added exact-reference/no-extra-trace-read checks, no implicit analysis before a primary run, pending-rerun withdrawal/replacement, CLT/TPS-qualified evidence and Logger visit callback checks. The earlier pending-popup-load test now checks synchronous reuse and closing on replacement, since popup trace loading no longer exists. Prior context/generation regression checks also assert absence or identity of the retained snapshot.
- Validation: 116 Vitest files / 592 tests passed; production build including typecheck and `git diff --check` passed. Chromium 154 full-shell acceptance used the synthetic 1,193,829,695-byte / 320,458-record / 1,389-channel MLG. VE retained 320,418 contributing samples and 56 measured proposal cells. Three distinct evidence cells opened; actual click-handler work measured about 7–10 ms in this one run (DevTools command round trips 72–147 ms). A popup-only CPU profile sampled the visit helper and contained no `buildVeEvidenceMapWithDelayTable`, `buildVeProposal`, `applyVeQualificationValidity`, `stateFilteredIndices` or `runAnalysis` frames; static removal and browser trace-read counts are stronger reuse guarantees than absence from a sampled profile alone.
- Three Logger round trips, comparison-domain return and Histogram return preserved the entire primary summary, edited 125-ms delay and all proposal cell titles. Evidence popup reopened afterward with matching metrics. Report: 0 ISSUE / 0 WARN. Multi-second analysis/navigation costs remain; synthetic acceptance does not establish low-spec performance or behavior on the owner's original recording.
- Local replay/evidence: `/tmp/epicscope-point3/flow.mjs`, `lifecycle.mjs`, `cdp.mjs`, `retained-large.log`, `retained-large-popups.cpuprofile`, `retained-large-report.txt`, screenshot, `lifecycle-result.json`, `tests.log`, `build.log`. Exported copies: `/workspace/epicscope-point3/evidence/`. Scripts reference existing temporary synthetic fixtures under `/tmp/epicscope-audit/`; these are not repository dependencies.

Next authorized pass after review: point 4, presentation invalidation cleanup. Keep Result View changes presentation-only and narrow popup detail invalidation to semantic changes at existing boundaries. Preserve v2 ownership, the new retained-primary contract and the selector-loop guard. Do not start points 4–8 without the owner's continuation.

### Presentation invalidation cleanup — point 4 of the approved eight-pass sequence

Point 4 is complete locally, alongside the uncommitted point-3 changes, on `temp/epicscope-fixes-points-1-2-20261015` above `dbecb07b1dbee53d24fd023b8d10a417b9d812df`. Neither point 3 nor point 4 has been committed or pushed. No GitHub operations were performed during this pass. Stop here before point 5. No usage-limit warning was received; handoff is complete for continuation after the owner's review/reset.

- Added an owner-local `onPrimaryAnalysisChange` subscription to the existing VE controller contract. The existing v2 owner publishes only when retained primary authority is withdrawn or replaced; existing controller layers forward it. Notifications are not global DOM events and add no global listener, observer or lifecycle wrapper. Subscribers can unsubscribe; the popup subscription shares the existing view's lifetime.
- Replaced popup-wide input/change invalidation and its delay-DOM MutationObserver with that semantic owner notification. Removed that observer entirely. Presentation changes, unchanged context/tune updates, layout changes, refreshes and recommendation-discovery settings that leave the working analysis intact no longer discard detail. Source/tune/scope/qualification/committed working-delay changes and accepted reruns withdraw primary authority and clear/hide stale detail.
- Cache rendered metrics/actions and strongest-visit results by cell index for the current primary analysis. Reopening a cached cell reuses the detail nodes and visit calculation. A new primary result or withdrawal clears the cache and removes old popup body nodes, releasing the old cached actions/visit references. Logger callbacks remain current: callback-only context updates adjust action availability without invalidating analysis or recomputing visits.
- All nine Result Views remain presentation-only. Browser checks assert exact primary identity, no extra trace reads, no primary notifications and stable open detail/visit DOM across every Result View. The same cache survives layouts, refresh, recommendation-only settings and close/reopen. Semantic invalidation tests cover qualification, working-delay edit, asynchronous delay-file load, scope, tune, source and rerun withdrawal/replacement; listener unsubscription also works.
- Validation: 26 real-Chromium lifecycle checks passed (18 previous plus 8 new), 116 Vitest files / 592 tests passed, production build including typecheck passed, `git diff --check` passed. The browser module remains separate from Node Vitest.
- Full-shell Chromium 154 acceptance with the synthetic 1,193,829,695-byte / 320,458-record / 1,389-channel MLG passed: VE analysis, three distinct evidence cells, all nine Result Views while keeping identical open detail/visit nodes and values, cached-cell reopening, three Logger round trips, comparison-domain and Histogram return, and popup reopening. Summary, edited 125-ms delay and all 56 measured proposal titles remained unchanged across navigation. A subsequent committed delay edit to 200 ms immediately closed and cleared the open detail. Report: 0 ISSUE / 0 WARN. Remaining large-log navigation/DOM costs are not resolved by this pass.
- Local evidence/replay: `/tmp/epicscope-point4/` (`flow.mjs`, `lifecycle.mjs`, `cdp.mjs`, `presentation-large.log`, popup CPU profile, report/screenshot, `lifecycle-result.json`, `tests.log`, `build.log`). Exported evidence and combined uncommitted patch: `/workspace/epicscope-point4/evidence/`. `/tmp/epicscope-point4/before.patch` preserves the point-3-only patch before this pass; the combined working diff contains points 3 and 4. Temporary synthetic fixtures still live under `/tmp/epicscope-audit/` and are not repository dependencies.

Next pass after review: point 5, remove document-wide channel-option decoration rescans and place catalog/label/eligibility updates with existing selector owners. No new observers. Preserve the mixture-selector guard from the Analyzer-entry investigation, primary-result reuse, semantic notifications and presentation-only Result Views. Points 5–8 are not implemented.

### Publication update — points 3 and 4

The point-3 and point-4 changes described above are committed together in the commit containing this update, on `temp/epicscope-fixes-points-1-2-20261015`. Earlier references to uncommitted/unpushed status describe the completion checkpoints before publication. Main is not merged or rebased. Prior validation remains 592 automated tests, production build/typecheck and 26 real-browser lifecycle checks, including the large-log acceptance workflow. Point 5 remains unimplemented; the next activity is a read-only ownership map and implementation plan.
