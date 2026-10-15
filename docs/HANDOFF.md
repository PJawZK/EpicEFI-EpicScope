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

### Consolidated list and selector ownership — point 5

Current authoritative list: [FIX_PLAN.md](FIX_PLAN.md). It preserves the original eight points, adds persistence/error-handling work as points 9–10, marks replacement-file transactionality as a review decision (11), and keeps obsolete telemetry conversion handling as an unconfirmed lower-priority candidate (12). Idle/AE event extrema and preparation of rows beyond the displayed 200-row limit extend point 7. Tune changes during pending/hidden analysis extend point 6. These additional static findings have not been browser-reproduced or implemented.

Point 5 is implemented locally above published commit `b3d1709cc7311fc5256c582eaf2c7c4c0d5ea2f4` on `temp/epicscope-fixes-points-1-2-20261015`. No new commit, push/pull, rebase or merge was performed. Stop here before point 6. No usage-limit warning was received; live account usage is not visible to the agent. This is a clean continuation boundary.

- Removed the Analyzer and Histogram global channel catalogs, queued document-wide option-decoration scans and both document-element subtree observers. `suggestAnalyzerChannel` is now pure. Removed Histogram page registration. No replacement observer, global listener or lifecycle wrapper was introduced.
- Shared pure label/metadata comparison helpers live in `channel-option-label.ts`. Analyzer comparison, tune correlation, Boost, suite, Ignition, Fuel/Injector, VE qualification, Histogram table/filter/calculated channels, distribution and scatter label their own options at creation. Labels preserve literal source name plus trimmed unit. Non-channel scopes, presets and MSQ axes/tables are not scanned or rewritten; math/source browser caches remain untouched.
- VE v2 owns strict actual-mixture eligibility/default correction through a selector-scoped helper. Available-option and real-value-transition guards remain, and the helper never dispatches synthetic change events. Valid manual choices survive; incompatible AFR/Lambda/error channels are disabled, canonical defaults apply, and no eligible source leaves an honest empty selection. Target-inferred mixture scale is handled at the existing target/tune boundary. Removed observer-driven gas-scale selection action from app visual refinements; unrelated visual refinement behavior remains unchanged.
- Catalog-equal updates preserve channel controls/options in existing owners. Suite, Ignition and Fuel/Injector refresh their scopes and use their existing analysis paths rather than reconstructing channel controls. Histogram table preserves channel selectors on scope/data-only updates; calculated-field changes continue through existing local refresh/event boundaries. Existing VE conservative source/tune invalidation remains as established in point 2. This pass does not claim hidden-view calculations are fixed; their expensive routing/generation behavior remains point 6.
- Validation: 116 automated files / 592 tests passed; production build including typecheck and diff whitespace checks passed. Existing 26 real-Chromium lifecycle checks passed after replacing obsolete broad-decorator calls with selector-scoped regression checks. Added `tests/web/channel-option-owners.browser.mjs`: 12 passing checks cover ten owners' labels, equivalent-catalog option identity/manual selection, changed metadata, scope-label collision, cross-view isolation, explicit/inferred AFR/Lambda behavior, invalid-only fallback and calculated-channel rename/unit updates retaining IDs. Browser modules are separate from Node Vitest.
- Full-shell Chromium 154 acceptance passed on the synthetic 1,193,829,695-byte / 320,458-record / 1,389-channel MLG: INI → MSQ → MLG → Analyzer comparison → VE; working delay edit, analysis, three evidence cells, all nine Result Views with unchanged open detail/visit nodes, cached reopen, three Logger round trips, comparison-domain/Histogram return and popup reopen. Retained 56 measured proposal cells, 320,418 contributing samples and the 125-ms working edit through navigation. A subsequent 200-ms committed delay edit cleared stale popup detail. Report: 0 ISSUE / 0 WARN. No claim of low-spec performance or validation on the owner's original recording.
- Replay/evidence: `/tmp/epicscope-point5/` and exported `/workspace/epicscope-point5/evidence/` contain lifecycle/ownership runners/results, full-shell `flow.mjs` and `ownership-large.log`, popup CPU profile, screenshot/report, tests/build logs and patch. Temporary fixtures under `/tmp/epicscope-audit/` are not repository dependencies. Source changes and the consolidated list remain uncommitted locally.

Next after review: point 6, active-domain routing and obsolete completion handling at existing controllers. Preserve the pure suggestion/label helpers, local selector eligibility, primary snapshot/semantic popup notifications, per-cell cache and all prior correctness behavior. Do not start point 6 automatically.

### Active Analyzer routing and completion ownership — point 6

Point 6 is complete locally above published `b3d1709cc7311fc5256c582eaf2c7c4c0d5ea2f4` on `temp/epicscope-fixes-points-1-2-20261015`. The current uncommitted diff contains BOTH points 5 and 6 plus `docs/FIX_PLAN.md` and their browser tests. Neither point 5 nor point 6 has been committed/pushed. No GitHub operations were performed during point 6. Stop here before point 7. No usage-limit warning was received; the agent cannot read the live account usage meter.

- Added explicit `setActive` control at the existing Analyzer page/domain controller boundaries. The shell starts Analyzer inactive, stages current context/tune while entering, activates it once, and deactivates it on leaving for Logger/Histogram. This adds no global event listener, MutationObserver, generic instrumentation or lifecycle wrapper.
- The Analyzer page retains latest context/tune and routes them only to the selected active domain. It no longer forwards every context update to the hidden specialized suite or tune updates to multiple hidden controllers. Comparison selectors are prepared only when comparison is selected. Tune-independent comparison/Boost/suite domains do not recalculate just because an MSQ changes. A/B comparison navigation now issues one request, rather than starting a default comparison before immediately replacing it.
- Each existing non-VE controller stores only its latest pending inputs while inactive. Activation applies queued context/tune/domain updates with calculation suppressed during that input application, then performs one analysis. Standalone controllers retain active-by-default compatibility; the page explicitly deactivates its owned children until selected. This controls activity without inferring it from document mutations or visibility observers.
- Deactivation advances the existing calculation generations; old trace resolutions and rejections return before calculation or UI updates, including after reactivation into a newer session. Tune correlation and Ignition now invalidate pending work on actual tune replacement; Ignition also calculates the changed tune when active. Existing current-generation load errors remain the separate point-10 error-handling task; this pass only ignores obsolete errors.
- Unchanged context updates to a still-active VE view preserve in-flight work. Actual navigation cancels pending VE analysis/discovery/file reads through existing generations while preserving completed primary authority, working delay and per-cell detail caches. Returning after cancelled analysis gives explicit Run Analysis guidance, not an implicit full-log rerun. Real hidden source/tune replacements are applied on activation and withdraw old authority normally. The existing v9 temporary re-grab observer is explicitly disconnected on leaving; no observer was added.
- Cancellation is cooperative at controller await boundaries. Shared trace/decode reads can still finish and warm their existing caches; no source/storage cache was disabled or cleared to implement routing. Already-running synchronous CPU loops cannot be preempted by navigation; worker/bounded-chunk cancellation remains conditional point 8 after point 7. Histogram's separate internal routing was not redesigned by this Analyzer-domain pass.
- Validation: 116 Vitest files / 592 tests passed, production build/typecheck passed, and `git diff --check` passed. Real-browser suites passed: 26 VE lifecycle checks + 12 selector-owner checks + 25 new `tests/web/analyzer-activity.browser.mjs` checks = 63. The activity suite covers all Analyzer domains, zero hidden loads/rebuilds, one load on activation, late success/error rejection, resumed-session protection, current tune replacement, VE re-grab/file cancellation, completed VE preservation, hidden real input replacement, unchanged active VE input updates, unrelated tune changes and single-request comparison navigation. Its CDP runner also checks for unhandled browser exceptions during obsolete-error scenarios. Browser modules remain separate from Node Vitest.
- Full-shell Chromium 154 acceptance passed again on the synthetic 1,193,829,695-byte / 320,458-record / 1,389-channel MLG: INI/MSQ/MLG → comparison → VE; 320,418 contributing samples / 56 measured proposal cells, edited 125-ms working delay, three evidence cells, all nine Result Views with unchanged open detail, cached reopen, three Logger round trips, comparison-domain/Histogram return and popup reopen. Summary/delay/proposal titles stayed identical through navigation. A later 200-ms committed delay edit cleared stale popup detail. Report: 0 ISSUE / 0 WARN. Synthetic runs do not establish performance on low-spec hardware or the original owner recording.
- Local evidence/replay: `/tmp/epicscope-point6/` (`activity.mjs`, `lifecycle.mjs`, `owners.mjs`, `flow.mjs`, `cdp.mjs`, corresponding results/logs, `active-large.log`, popup profile, report/screenshot, tests/build logs). Exported to `/workspace/epicscope-point6/evidence/`. `before.patch` is the tracked point-5 diff at this pass's start; the complete point-5 checkpoint including its new files remains `/workspace/epicscope-point5/evidence/point5.patch`. The exported combined patch includes all tracked edits and new files for points 5–6. Temporary synthetic fixtures remain under `/tmp/epicscope-audit/` and are not repository dependencies.

Next after review: point 7, evidence quantile sorting reuse and role normalization cache per catalog generation, with event-extrema/row-preparation follow-ups from FIX_PLAN.md. Preserve explicit Analyzer activity boundaries, source/cache behavior, selector ownership, retained primary authority and semantic popup notifications. Do not begin point 7 automatically.


## Point 7 completed locally — stop before point 8 (2026-10-15)

Current branch remains `temp/epicscope-fixes-points-1-2-20261015`, published HEAD `b3d1709cc7311fc5256c582eaf2c7c4c0d5ea2f4`. Points 5–7 are local, uncommitted/unpushed. Existing changes were preserved. No GitHub transfer, commit, merge or pull was performed. The coherent status list is `docs/FIX_PLAN.md`. Do not start point 8 automatically. Live account usage is not available to the agent; no usage-limit warning was received.

- `core/analysis/ve-evidence-statistics.ts`: robust estimates filter/sort observations and sum weights once; a private sorted-input quantile helper reuses that preparation for median/P10/P90. The public standalone quantile still prepares its own arbitrary input. Filtering, weighted threshold semantics, total weight, observation counts, input immutability and spread are preserved. No retained full-log cache was added.
- `apps/web/src/pages/analyzer-channel-roles.ts`: a WeakMap keyed by immutable ChannelDefinition objects retains normalized names, exact lowercase identities, unit and tie-break metadata across role/mixture checks. Replacement definitions/catalog generations (including reused IDs with different names/units) get fresh entries. Weak keys do not retain obsolete catalogs; no global current-catalog registration, observer, event listener or catalog owner was introduced. Existing matching priorities, eligibility and ties remain unchanged.
- `specialized-analyzer-suite-view.ts`: Idle/AE extrema use bounded iteration over all events, not argument spreads. Idle window/worst sag and AE lean/rich peaks retain original defaults and empty behavior. Event formatting and navigation allocation now happen for only the first 200 displayed rows, while summaries/counts retain all events. This covers Idle, AE, mixture-delay, knock, pressure/duty and trigger/sync tables. Combined pressure/duty tables preserve low-pressure-first order, total counts and original Logger source indices without building full temporary event arrays. Operating-map tables and full analysis/evidence data were not truncated.
- After the initial changes, a targeted profile of the existing event-aligned evidence renderer (320,458 samples, 3,200 aligned events, two series, 101 bins) showed repeated percentile sorting dominating much of redraw time. `analyzer-event-evidence.ts` now sorts each owned bin once and reuses it for the existing interpolated median/P10/P90. This removes three copies and two extra sorts per bin without changing interpolation or sampling. Before/after canvas PNG hashes match exactly: `39a4404eb3eadb6b4739fa1e75d288f46fa56ac95cef783467fbd0dc7670ea2f`.
- Browser evidence: cached full-log VE rerun profile elapsed 3,866.7 ms before / 1,886.7 ms final after; sampled time attributed to weighted-statistics source fell from about 1,263 ms to about 377 ms. These are individual synthetic development-build measurements, not general speed guarantees. The initial post-change profile (`after-analysis.cpuprofile`, 11.8 seconds) overlapped Vitest and is excluded from performance conclusions. One intermediate final run was interrupted by development-server reload during a test-file edit; it was rerun with source files untouched and passed. No application failure is inferred from that tooling interruption.
- An alternating before/after browser microbenchmark on 320,459 unsorted, nonuniformly weighted observations produced identical estimates in all five comparisons. Median elapsed was 219.2 ms before / 142.5 ms after. The direct event renderer redraw measured 1,653.9 ms before / 552.9 ms after, with identical pixels. Browser profiler overhead/environment variation applies. No file I/O or decode was included in these focused measurements; full-shell file load timings are recorded separately.
- Further rolling-window/recovery rewrites were not made. The final VE profile sampled slope at about 99 ms of 1,887 ms total; the tested Idle fixture settles immediately and does not establish worst-case recovery cost. The known nested recovery search and event-envelope per-event sampling remain potential scaling limits needing representative profiles. Synchronous VE still takes roughly two seconds in this fixture, so point 8 remains a real review candidate; no worker/batching or architectural boundary changes were introduced early. Existing decoded-channel/storage caching, primary analysis ownership, hidden-view routing and semantic detail invalidation remain intact.
- Validation: 116 Vitest files / 595 tests passed; production build/typecheck passed; whitespace diff check passed. Added weighted-statistics edge/threshold/immutability and >320k observation regressions plus reused-ID role metadata regression. Real Chromium suites passed: 26 VE lifecycle + 12 selector-owner + 25 activity + 5 new CPU/event component checks = 68. The new suite (`tests/web/analyzer-cpu.browser.mjs`) checks 320,459 unsorted observations, catalog replacement, 320,001 Idle events / 640,002 samples, 320,001 AE events / 320,002 samples, extrema occurring beyond the displayed rows, full event totals, 200-row caps, row selection and original Logger navigation, plus combined pressure/duty ordering across the cap. Large event component roots are deliberately detached to isolate summary/table correctness from expensive envelope drawing; the separate visible-canvas profile validates the actual renderer. The four legacy Idle/AE spread expressions all throw Chromium RangeError at that event count (`legacy-extrema-overflow.json`).
- Full-shell Chromium acceptance passed with the synthetic 1,193,829,695-byte / 320,458-record / 1,389-channel MLG and matching INI/MSQ: analysis and cached rerun, three evidence cells, all nine Result Views, cached reopen, three Logger round trips, comparison/Histogram return, popup reopening and semantic delay invalidation. Before/final summaries and sampled popup metrics match, with 320,418 contributing samples, 56 measured proposal cells and the 125-ms edit preserved through navigation. Report: 0 ISSUE / 0 WARN. These are synthetic checks, not the owner's original log or low-spec hardware acceptance.
- Evidence/replay: `/workspace/epicscope-point7/evidence/` exports focused profiles, images, before/final workflow logs/reports, benchmark results, regression results and combined `points5-7.patch` including new files. Replay scripts and source fixtures remain under `/tmp/epicscope-point7/` and `/tmp/epicscope-audit/`. Points 5–6 checkpoints remain in their existing directories. Patch base is published commit b3d1709; no main-branch integration has been attempted.

Next: review point 7 and decide point 8 based on the remaining synchronous cost. Preserve source/tune/scope generation checks and explicit progress/cancellation if work is moved or chunked. The independent persistence/current-error/replacement-file/socket candidates remain points 9–12 in FIX_PLAN.md.

## Point 8 completed locally — stop before point 9 (2026-10-15)

Branch remains `temp/epicscope-fixes-points-1-2-20261015`, published HEAD `b3d1709cc7311fc5256c582eaf2c7c4c0d5ea2f4`. Points 5–8 remain local, uncommitted/unpushed. Existing edits and untracked files were preserved. No GitHub commit, push, pull, rebase or merge was performed. Stop here; point 9 is not authorized by this pass. Live account usage is unavailable to the agent; no automatic limit warning was received.

### Selected boundary and implementation

Point-7 profiles still showed a roughly two-second synchronous cached VE calculation. The existing workers own MLG import/CRC/storage, not VE analysis. This pass therefore uses cooperative batches at the existing VE owner rather than introducing a worker/lifecycle layer or coupling analysis to importer workers.

- New `core/analysis/ve-analysis-work.ts` provides per-job generator execution, a target 8-ms execution slice with task-boundary yielding, 2,048-item checkpoints (32 window ends for steady-state qualification), cancellation checks before/after suspension and completion, and disposal of partial generator state. There are no global jobs, listeners, observers, DOM dependencies or retained source caches in the executor.
- Delay alignment and evidence-map calculation share generator steps with the existing synchronous APIs. Browser VE uses the new async delay-aligned entry point. Steps cover alignment, scope preparation, stable-segment scans (including inside wide slope scans), accepted-sample retention, evidence accumulation, and weighted estimation. Short bounded slope windows retain direct scalar execution; wide windows use generator checkpoints with the same arithmetic order. This changes scheduling, not the rolling-window algorithm or numeric formulas. Already ordered scope indices skip sorting; arbitrary unsorted/duplicate scope inputs preserve the previous ordering semantics.
- Large weighted observation sorts use stable merges of bounded native-sorted runs; validation, merging, weight summation and quantile scans yield checkpoints. Equal-value observation order and floating weight accumulation order match native stable sorting. Standalone synchronous weighted statistics retain the native-sort path from point 7. No full-log observation cache was added.
- VE v2 remains authoritative. Its existing run generation and activity flag cancel CPU jobs on real input invalidation, explicit cancellation, navigation or replacement sessions. The pending flag now spans both channel loading and calculation. Run is disabled while pending, a local Cancel analysis button is available, and current progress is displayed without rebuilding tables. The first report of each phase is immediate; repeated reports are limited globally to roughly 10 Hz to avoid retriggering presentation work at every batch. Result/proposal assignment and primary publication occur together only after a current-generation completed calculation. Cancellation leaves the working delay intact and does not publish partial evidence. Shared pending source reads may finish into their existing caches and are rejected at the owner afterward.
- Browser validation exposed a pre-existing ownership gap: the presentation chain moves Prior weight out of the quick-controls container before the owner first binds its changes. VE now binds its existing semantic numeric settings explicitly by role, independent of container placement, so custom prior changes cancel/invalidate correctly. No replacement event layer was added.
- The full-shell cancellation test also caught a pending-button state introduced during implementation: navigation cancellation reset the job flag but return left Run disabled. The existing cancelled-return branch now refreshes readiness; the regression verifies both preserved delay and successful rerun. This is fixed, not an outstanding issue.

### Validation and limits

- Full automated suite: 117 files / 601 tests passed with `--maxWorkers=2`; production build/typecheck and `git diff --check` passed. After the final outer qualification checkpoint adjustment, all 26 focused analysis regressions also passed. Six new unit tests cover exact sync/async full-pipeline equality on 320,459 continuous samples concentrated in one cell (including fuel correction), stable weighted ordering, malformed observations, unsorted/duplicate scopes and gaps, cancellation before input access, suspended-generator disposal, cancellation during weighted sorting and inside a wide slope window. Input arrays remain unchanged.
- One four-worker rerun timed out in four tests, including two unchanged blob-cache tests. The same assertions/timeouts passed with two workers and no application-source changes between those runs. Its log is preserved as `tests-parallel-timeouts.log`; no test was skipped, disabled or weakened to pass.
- Real-browser suites: 73 checks passed (5 new batching + 5 CPU/event + 25 activity + 12 selector-owner + 26 VE lifecycle). New tests exercise painting/task progress during a 320,459-sample job, Result View changes while pending, cancellation during alignment and weighted sorting, stale-completion rejection, rerun after Cancel, leaving during CPU work, rerun after cancelled return, preservation of working delay, invalidation on a custom prior change during sorting, and unchanged-context preservation of pending work. Existing positive lifecycle assertions now wait for completed primary authority instead of assuming exactly two event-loop turns; deliberate pending/obsolete cases remain pending and keep their original rejection assertions.
- Focused component heartbeat results varied by run/environment load (roughly 47–352 ms maximum observed gap during development); the final component run recorded 85 timer ticks, 57 animation frames and a 76.7-ms maximum gap while the job was active. These are observations, not a hard frame-latency guarantee. The 8-ms slice is a cooperative target: allocations, garbage collection, individual batch cost, browser scheduling, existing qualification and final rendering can still exceed it.
- Full-shell acceptance passed on the 1,193,829,695-byte / 320,458-record / 1,389-channel synthetic MLG, matching INI/MSQ and saved working delay: analysis and cached rerun, three evidence cells, all nine Result Views, cached reopen, three Logger round trips, comparison/Histogram return, real navigation during CPU work, cancellation guidance, successful rerun after return and semantic delay invalidation. Summary and all three sampled popup metric strings exactly match point 7: 320,418 contributing samples, 56 measured cells and the edited 125-ms delay preserved. Report: 0 ISSUE / 0 WARN. The final cached run took 2,040.1 ms wall time with 128 timer ticks, 107 animation frames and a 199.5-ms maximum observed heartbeat gap. Point 7 measured about 1,887 ms without yielding: this is a responsiveness/cancellation improvement, not a claim of lower total latency. Some long tasks remain. An intermediate implementation took 5.7 seconds with a 645.5-ms heartbeat gap; its profile identified excessive short-window generator delegation and repeated presentation callbacks. The scalar short-window path and progress report gating above address that added overhead; the intermediate profile/log are retained for transparency. Synthetic data are not the owner's original log or a low-spec hardware benchmark.
- Scope is the profiled VE evidence pipeline. MLG import/CRC workers and decoded/raw/storage caches are unchanged. Initial source loading/qualification, small tune proposal construction, final DOM rendering, delay discovery and other domains' synchronous algorithms were not moved wholesale. Idle recovery remains algorithmically unchanged. Event-envelope percentile preparation retains point-7 sorting reuse; its full rendering is still synchronous. Further work should follow profiles rather than treating this pass as removal of every possible long task.

Evidence/replay and combined local patch: `/workspace/epicscope-point8/evidence/`; temporary scripts under `/tmp/epicscope-point8/`; synthetic fixtures under `/tmp/epicscope-audit/`. The combined `points5-8.patch` includes tracked edits and all new files relative to published b3d1709. Earlier checkpoints remain in place.

Next after review: point 9 (persistence failures), with points 10–12 still pending in FIX_PLAN.md. No further changes should be started automatically.


## Point 9 completed locally — stop before point 10 (2026-10-15)

Branch remains `temp/epicscope-fixes-points-1-2-20261015`, published HEAD `b3d1709cc7311fc5256c582eaf2c7c4c0d5ea2f4`. Points 5–9 remain uncommitted/unpushed. No GitHub commit, push, pull, merge or rebase was performed. Existing changes/untracked files were preserved. Stop here before point 10. Account usage is not visible to the agent; no automatic usage warning was received.

- Affected owners: Distribution and Scatter presets; Table Generator presets and saved filters; the visible Math Channels page; the retained, intentionally hidden Table Generator formula editor. The visible Math page has separate handlers from the legacy formula controls; both are covered without exposing or reviving the legacy UI.
- Every affected save/delete handler now consumes its existing storage helper's boolean result. Manager-local status text distinguishes durable success from changes retained only for the current session. Failed deletion explicitly warns that the item may return after reload. A Retry saving button retries without another prompt or requiring the user to re-enter work; repeated failure keeps the warning/action available.
- `local-persistence-feedback.ts` and its small scoped stylesheet provide only presentation and the local Retry click handler. There are no global listeners, observers, storage polling, automatic retry loops or new lifecycle/persistence ownership layers. Each owner supplies its existing storage functions. Status uses a local role=status element; success clears the failure action. Math formula validation remains separate from persistence feedback so preview/reset or a successful retry cannot leave a contradictory disk-save warning.
- Retry reads the storage module's current in-memory collection through its existing cached load function before persisting. It does not capture the failed snapshot or perform a fresh localStorage read. This prevents Retry from resurrecting stale records after another writer changes the session cache. Save/delete/session semantics remain unchanged: edits survive a failed write in memory; failed deletions remain deleted for the session rather than silently rolling back.
- Storage modules, keys, schemas, validation, cache population and serialization are untouched. No decoded-log, raw-page, MLG sidecar, role-normalization or analysis cache changes were made. Existing Math Channels semantic notifications remain unchanged; Retry performs no semantic notification or analysis work because it only persists the already-current session state.
- Programmatic selection after creating a Table preset, filter set or legacy calculated field now immediately updates its existing Apply/Delete availability. Previously population evaluated the old empty selection, then code assigned the new ID without a change event, leaving actions disabled. No synthetic event was introduced. This also makes failed-save session items usable/deletable immediately.
- Validation: full 117 Vitest files / 601 tests passed with two workers; production build/typecheck and whitespace diff check passed. New `tests/web/local-persistence.browser.mjs` passed 12 real-Chromium scenarios (six owners × QuotaExceededError/SecurityError fault injection). Each checks retained session item/selection, unchanged durable data after failure, repeat failure, successful retry, deletion retained in session with the reload warning, successful deletion retry, latest-cache retry safety and normal save confirmation. Visible owners are checked in a 1366×900 viewport with their actual controls/popovers; the legacy editor remains intentionally hidden and gets handler/state checks, while the real Math page gets visible-feedback checks. Browser fault injection is test-only and restores Storage.prototype/setItem and prompt in finally.
- A real page reload rebuilt all five unique storage collections from persisted data and matched expected records exactly. The existing 12 selector-owner browser regressions also passed, including calculated-channel identity and rename/unit propagation. Total focused browser acceptance: 12 persistence scenarios + actual reload + 12 owner regressions = 25 checks, with no unhandled browser exceptions. The component fault tests use small fixtures; the large-log audit and point-8 performance measurements were not rerun because this pass changes persistence feedback/actions, not analysis or I/O.
- Evidence/replay: `/workspace/epicscope-point9/evidence/` contains final test/build/browser logs, persistence/reload/selector results, replay scripts and combined `points5-9.patch` including new files relative to published b3d1709. `/tmp/epicscope-point9/before.patch` preserves the complete points-5–8 checkpoint. Earlier artifacts remain in their existing directories. Only the Vite/Chromium services started for this pass were stopped.

Next after review: point 10, actionable handling of current-generation trace-load rejections at existing controller boundaries. Preserve point-6 obsolete-error guards and point-8 cancellation/progress; do not start point 10 automatically. Points 11–12 remain review/candidate work as recorded in FIX_PLAN.md.


## Point 10 completed locally — stop before point 11 (2026-10-15)

Branch remains `temp/epicscope-fixes-points-1-2-20261015`, published HEAD `b3d1709cc7311fc5256c582eaf2c7c4c0d5ea2f4`. Points 5–10 are local and uncommitted/unpushed. No GitHub commit, push, pull, rebase or merge was performed. Existing edits and untracked files were preserved. Stop here before point 11. Account usage is unavailable to the agent; no automatic limit warning was received.

- Original point-10 owners: Tune correlation, Fuel/Injector and Ignition. Inspection also found the identical current-generation load-error rethrow in Range comparison, Boost and the specialized Analyzer suite. All six existing controller boundaries now handle current trace-load rejection locally; their callers still use the existing explicit Analyze/Refresh and routing paths.
- Existing active/generation/domain guards execute before any error-state mutation. Obsolete or inactive errors return silently as established in point 6. Current failures hide stale content and show a load-specific title, safe plain-text error detail (including string reasons or a fallback for undefined/empty reasons), and guidance to retry using the existing control or reload the source/change scope if it continues failing. No global rejection listener, observer, automatic retry, lifecycle wrapper or shared error framework was introduced.
- Owners with retained currentResult (comparison, Tune and Boost) clear it on current load failure. Ignition also clears retained event/series and the restore-all evidence callback and hides its review area; the suite withdraws its restore-all callback. Hidden old DOM is not presented as a new result. Existing calculation/error-handling paths are otherwise unchanged; this pass is specifically about rejected trace acquisition, not treating every runtime exception as a load error.
- Analyze/Refresh remains usable after a load failure. A local failure flag restores the owner's original setup title/hint only when a subsequent active request begins, so recovery or missing/replaced inputs cannot keep an old source-read error. Resetting error presentation does not add work to ordinary successful renders. The comparison activity/domain guard runs before resetting this presentation state, preserving hidden-view ownership.
- Validation: full 117 Vitest files / 601 tests passed with two workers; production build/typecheck and `git diff --check` passed. New `tests/web/analyzer-load-errors.browser.mjs` passed 42 real-Chromium scenarios: six owners × seven cases. Three rejection shapes (Error containing markup, string, undefined) are injected after a successful result; tests verify stale content is hidden, a rendered error area appears, markup remains text, the existing control issues exactly one retry, and successful retry restores the same result. Remaining cases cover older failure after newer success, older success after newer failure, rejection while hidden plus successful resume, and missing/replaced inputs restoring setup guidance. These are controlled browser fixture rejections, not claims of reproducing a particular physical-disk fault.
- The existing 25 activity/stale-completion and 12 selector-owner checks also passed: 79 focused browser checks total, with the CDP runner observing no unhandled browser exceptions. New failure tests mount visible controllers at 1366×900. Deferred promises make completion races explicit; no production instrumentation is installed. The unchanged calculation/storage/large-log audit was not rerun for this error-presentation pass. Source decoding, cache population, storage schemas, tune authority, VE cancellation/progress and calculations are untouched.
- Evidence/replay: `/workspace/epicscope-point10/evidence/` contains final test/build/browser logs, all three browser result files, replay scripts and combined `points5-10.patch` including new files relative to published b3d1709. `/tmp/epicscope-point10/before.patch` preserves the complete points-5–9 checkpoint. Earlier checkpoints remain in place. Only this pass's Vite and Chromium services were stopped.

Next after review: point 11 is a transactional replacement-file behavior decision (preserving the last valid MSQ/session while a replacement is validated). Review policy and failure cases before changing it; do not start it automatically. Point 12 remains an unconfirmed, lower-priority telemetry conversion candidate.


## Point 11 completed locally — stop before point 12 (2026-10-15)

Branch remains `temp/epicscope-fixes-points-1-2-20261015`, published HEAD `b3d1709cc7311fc5256c582eaf2c7c4c0d5ea2f4`. Points 5–11 remain local and uncommitted/unpushed. No GitHub operations were performed. Prior edits/untracked files were preserved. Account usage is not visible to the agent; no automatic limit warning was received. Stop here.

- User-approved policy: keep the current valid tune and VE session authoritative while reading, parsing, validating and normalizing a replacement. Publish only an accepted candidate. Rejecting a candidate must preserve working delay, result, proposal and retained evidence. Latest file selection wins even if that newer candidate fails; an older completion must never become authoritative afterward.
- `apps/web/src/adapters/msq-candidate.ts` prepares an isolated candidate. Browser DOMParser checks XML/root validity; the adapter rejects empty supported-entry sets, invalid declared positive-integer dimensions and numeric payload/dimension mismatches before normalization. Namespaced MSQ, text metadata, inferred vectors and tunes without VE-specific tables remain supported. This is structural acceptance, not complete firmware/schema/safety validation. Core parser/normalizer behavior is unchanged.
- `app-shell.ts` owns the replacement-load generation token beside its existing active tune. Stale reads return before parsing or touching UI/state; stale errors are ignored. The picker stays available while a read is pending. A no-file change is a no-op. File.text reads are not physically aborted; obsolete results are discarded. Canceling the picker does not constitute a new replacement request.
- Candidate failure shows the actual error, identifies the retained tune (or says no tune is loaded), and directs the user to choose a file to retry. It never calls setTuneModel(undefined). Successful acceptance replaces the shell model/source and calls the existing Analyzer setTuneModel path: new model identity advances existing owner generations and invalidates dependent state, including deferred hidden owners. No redundant global tune revision or new lifecycle wrapper was introduced. An explicitly accepted replacement with identical contents is still a new accepted model identity.
- A synchronous Analyzer presentation exception after acceptance is reported separately as an accepted tune with a display-update failure; it is not mislabeled as a rejected candidate or a rollback. That exceptional presentation path was not fault-injected. Existing INI/MLG loading, storage/decoded-channel caches, calculations and worker boundaries are unchanged.
- Validation: full 117 Vitest files / 601 tests passed; production build/typecheck and git diff --check passed. New `tests/web/msq-replacement.browser.mjs` passed 17 real-Chromium checks in the full application: structural acceptance/rejections, no-file change, read/parse/shape failures preserving VE state and cached popup DOM identity, navigation after failure, overlapping success/failure ordering, failure during an active VE calculation, successful replacement invalidation and navigation authority. The existing 26 VE lifecycle checks also passed (43 browser checks total), with no unhandled browser exceptions observed by the CDP runner.
- Browser fixtures loaded actual INI/MSQ/MLG files and edited a working 125-ms delay before testing replacement. Deferred test File.text promises controlled overlap without production instrumentation, global listeners or observers. These are small workflow fixtures, not a rerun of the 1.2-GB performance audit. Existing earlier large-log findings are unchanged.
- Evidence/replay: `/workspace/epicscope-point11/evidence/` contains final logs, replacement/lifecycle results, replay scripts, current plan/handoff and combined `points5-11.patch` including tracked and untracked files relative to published b3d1709. `/tmp/epicscope-point11/before.patch` preserves the prior combined checkpoint. Earlier artifacts remain available. Only this pass's Vite/Chromium services were stopped.

Next after review: point 12 remains an unconfirmed lower-priority telemetry async-conversion/socket-identity candidate. Begin with a controlled read-only reproduction if authorized; do not automatically implement it or broaden point 11 into a file-loading refactor.


## Publication checkpoint — points 5–11 (2026-10-15)

The user authorized committing and pushing all outstanding repository changes to the existing temporary branch, `temp/epicscope-fixes-points-1-2-20261015`. This checkpoint includes points 5–11, their regression tests, FIX_PLAN.md and this handoff. Earlier “local/uncommitted/unpushed” statements describe their historical checkpoints and are superseded by this publication commit once pushed. No main-branch merge is requested. External audit/evidence directories remain local; the repository browser regression modules and documentation are included. No implementation changes or repeated audit are part of publication. Existing validation from point 11 remains applicable: 601 tests, build/typecheck and 43 browser checks passed. Point 12 is explicitly deferred.
