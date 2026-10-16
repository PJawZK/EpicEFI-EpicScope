# EpicScope Handoff

## Publication checkpoint — targets 1–5 and 15 (2026-10-16)

Continuation branch: `checkpoint/improvements-targets-1-5-15-20261016` ([GitHub branch](https://github.com/PJawZK/EpicEFI-EpicScope/tree/checkpoint/improvements-targets-1-5-15-20261016)), based on main `09f8e3942afde19f5bf64c9570884886d56da9bc`. This branch packages all previously unpublished implementation, tests, synthetic fixtures and documentation for updated targets **1, 2, 3, 15, 4 and 5**. The local-checkpoint sections below are historical; their uncommitted/unpushed statements describe the state before this publication checkpoint. Publication is verified by matching the remote branch head to the local commit; no main merge or PR is included.

Latest validation: **256 browser checks**, **118 automated test files / 616 tests**, production build including typecheck, and clean patch/whitespace checks. Source did not change after those checks; this publication adds only the continuation documentation. Hosted CI has not been verified. Ignored browser output and external audit/evidence directories are not repository files and are not included in the commit; browser fixtures, test runners and modules needed to reproduce checks are included.

**Target 6 has not started.** Next scope is recoverable localStorage acquisition at startup, followed by browser verification of a throwing storage getter and healthy-storage behavior. User last reported 11% quota before requesting publication; live quota remains unavailable to the agent. Assess the remaining quota before implementation. Preserve this checkpoint and stop between targets.

## Local checkpoint — updated target 5 (2026-10-16)

Current branch remains `fix/input-publication-target-1`, based on main `09f8e3942afde19f5bf64c9570884886d56da9bc`. Updated targets 1, 2, 3, 15, 4 and 5 are local, uncommitted and unpushed. Earlier changes remain intact; no GitHub operations were performed. **Stop before target 6** (recoverable localStorage acquisition at startup). User last reported 17% quota before authorizing this target; live usage is not visible to the agent.

- `histogram-math-channels-view.ts` remains the preview owner. Removed numerical preview listeners from name/unit inputs and the extra successful-save preview. Save still validates expression/references and persists all metadata through the existing storage/notification owners; completed preview stats/status survive metadata-only typing and save.
- Formula input and source/helper insertion share a single trailing 180-ms timer. Edit selection, context updates and refresh use that same scheduler, so synchronous context+refresh entry coalesces. Scheduling increments generation immediately, clears the previous timer and stale stats, and marks waiting state; an old read cannot publish during the debounce interval. Reset/new/delete and save validation failures cancel obsolete pending work.
- Added `setActive` at the existing Math controller boundary. Histogram subview routing calls it when selecting/leaving Math; leaving cancels timers and advances generation. Timer dispatch and post-await success/error paths also require a connected element without a hidden ancestor. Hidden/removed views do not start queued preview calculation or accept obsolete completions. The existing page setContext/refresh calls schedule current inputs on entry. No new global listeners, observers, generic lifecycle wrappers or workers were added.
- Preview evaluation is explicitly limited to **the first 10000 loaded anchor samples**. A zero-copy subarray bounds only the first reference range that sizes the existing core evaluator's output; other dependency history remains available and source arrays are untouched. The UI labels the first-N-of-total limit, including no-finite-samples cases. Small previews preserve their complete statistics. Full logical analysis, saved formulas, Table/Distribution/Scatter evaluation and source/cache/storage behavior are unchanged.
- Replaced the preview's intermediate valid-values array plus second statistics pass with one validity-aware count/sum/min/max pass over the bounded result. No calculated sample-array cache is retained.
- Added eight real-browser checks in `histogram-math-preview.browser.mjs`, integrated into `npm run test:browser`: zero extra preview loads for metadata typing/save, one load for a typing burst, immediate stale-read rejection during debounce, obsolete rejection suppression/clear/reset, helper/source insertion, hidden/deferred work plus coalesced entry, 320459-sample bounded preview versus full analysis, and actual Histogram subview exit. The large historical fixture produces 9999 valid preview samples with mean 1 while full analysis retains all 320459 output positions.
- Controlled pre-target-5 replay with only the two production files restored failed the metadata-only regression (`Metadata edits/save recalculated or disturbed a completed preview`). Accepted production files were restored byte-for-byte afterwards. The baseline probe initially encountered a test-cleanup API mismatch because the old controller lacks setActive; cleanup was made optional so it reports the actual metadata-work regression. No production workaround was needed.
- Final validation: **256 browser checks / 128 per staged and forced Worker-disabled fallback import configuration**, including all previous 240 checks, passed with no unhandled exceptions. `npm test -- --maxWorkers=1`: **118 files / 616 tests passed**. `npm run build` including typecheck passed; unit tests ran with browser services stopped. CI workflow is still unpublished and GitHub execution remains unverified.
- Evidence: `/workspace/epicscope-improvements-target5/evidence/` contains final browser/unit/build/typecheck logs, browser results, the expected baseline failure, docs and patches. `targets1-3-15-4-5.patch` is the complete local delta from HEAD including untracked modules/fixtures; `target5.patch` isolates changes since the target-4 local checkpoint. Latest passing generated results also remain under ignored `artifacts/browser/`.
- Limits: debounce reduces repeated work and the cap bounds output samples, not total wall time for arbitrarily complex temporal formulas. Trace loading can still request the current available/A-B data before applying the CPU preview limit; this target does not cancel underlying I/O/decode promises or change Logger caching. Existing saved-field notifications to other Histogram owners remain unchanged. No representative 1.2-GB rerun or wall-time speedup is claimed.

## Local checkpoint — updated target 4 (2026-10-16)

Current branch remains `fix/input-publication-target-1`, based on main `09f8e3942afde19f5bf64c9570884886d56da9bc`. Updated targets 1, 2, 3, 15 and 4 are local, uncommitted and unpushed. Earlier changes remain intact; no GitHub operations were performed. **Stop before target 5** (metadata-only Math edits and preview scheduling).

- Consolidated the three Histogram formula implementations at the existing `histogram-logical-context.ts` boundary. `prepareHistogramFormula` compiles against the request's catalog, resolves physical IDs/source/display names, preserves exact literal names before offset syntax, rejects ambiguous/missing/virtual references, and deduplicates physical dependencies. `evaluateHistogramFormula` binds offsets, delegates numeric/temporal evaluation to the existing core evaluator, and preserves scoped completeness, source color and missing-data behavior. Prepared plans retain only program/reference metadata, not loaded sample data.
- Distribution/Scatter continue using `createHistogramLogicalContext`. Table Generator now delegates its logical-trace materialization there instead of maintaining a separate compiler/resolver/loader/evaluator. Each batch loads unique physical dependencies once and evaluates each requested formula once; duplicate logical requests preserve first-request order. Formula IDs, metadata, scope, qualification, delta arithmetic, aggregation, selectors and persistence owners remain in their existing locations.
- Math preview and both formula-save entry points share the same preparation policy. Math retains its preview generation check immediately after load and before evaluation, its distinct `Channel ...` / `Preview data unavailable ...` errors, and its finite-sample statistics. Table retains its render-generation and user-facing failure handling. No new global listeners, observers, workers, caches of calculated sample arrays or lifecycle wrappers were added. Existing decoded-channel/storage caching was not changed.
- Correctness evidence: before this target, formulas created in Math with `[RPM-1]` worked in preview/Distribution/Scatter but Table Generator's separate resolver rejected them. A controlled replay with only the three production files restored to their exact pre-target-4 checkpoint failed with `Formula channel not found: [RPM-1]`; the accepted files were restored byte-for-byte afterwards. The same regression passes with the unified implementation. Legacy Table formula validation also accepts the shared historical-reference policy now.
- Added six unit regressions (12 logical-context tests total) for literal-offset precedence, physical-only/ambiguous/missing references, nonzero sample indices/validity/history, scoped completeness/color, multi-formula dependency deduplication/order, missing loaded dependencies and load failure propagation. Focused logical/core formula tests: 19 passed.
- Added eight real-browser regressions in `histogram-formula-pipeline.browser.mjs`, wired into the reproducible command. They cover saved historical formulas in Table, formula X/Z/filter plus physical delta, Math preview mean/count, legacy validation, page routing through Distribution/Scatter, missing-data recovery, and rejection of obsolete Math preview loads. Full `npm run test:browser`: **240 checks (120/configuration)** passed with staged and Worker-disabled fallback MLG imports and no unhandled exceptions. Existing 224 checks remain included. The first new browser-test attempt waited for a channel label in the Distribution series header, which displays the scope label; corrected the test to assert the selected channel label and displayed mean. No production change was needed for that test-fixture issue.
- `npm test -- --maxWorkers=1`: **118 files / 616 tests passed**. `npm run build` including typecheck passed. Full unit tests ran after the browser had stopped. CI workflow remains a local edit from target 15; GitHub execution is unverified.
- Evidence: `/workspace/epicscope-improvements-target4/evidence/` contains passing browser/unit/build/focused logs, all browser results, the isolated pre-target-4 expected failure, docs and patches. `targets1-3-15-4.patch` is the complete local delta from HEAD including untracked files; `target4.patch` is the text delta from the target-15 local checkpoint. Current passing generated results also remain under ignored `artifacts/browser/`.
- Limits: this removes divergent processing paths and establishes consistent behavior; no wall-time speedup or large-log benchmark is claimed. There is no new cross-request calculation cache, expanded history loading, preview debouncing, or metadata-edit optimization. Existing synchronous core evaluation and preview scheduling remain for subsequent approved targets/profiling.

## Local checkpoint — updated target 15 (2026-10-16)

Current branch remains `fix/input-publication-target-1`, based on main `09f8e3942afde19f5bf64c9570884886d56da9bc`. Updated targets 1, 2, 3 and 15 are local, uncommitted and unpushed. No GitHub operations were performed. **Stop before target 4**, next in the approved order.

- Added `npm run test:browser` using the existing Vite dependency and Node's built-in WebSocket/CDP transport; no dependency or lockfile changes. The explicit WebSocket flag supports the declared Node 20 engine line as well as Node 22/24. Validated locally on Node 24 with installed Chromium; hosted CI/other Node versions have not been executed here.
- `scripts/browser/run.mjs`, `cdp.mjs` and `acceptance.mjs` replace temporary absolute-workspace replays with repository-relative modules/fixtures. The runner starts its own loopback Vite/Chrome on allocated ports, creates separate incognito staged/fallback sessions, and removes its temporary profile after cleanup. It rejects empty/malformed results, JS exceptions, readiness/DevTools timeouts and interruption; no generic application instrumentation was added.
- Checked in the small generated INI/MSQ/MLG/delay fixtures from targets 1–3 under `tests/fixtures/browser/`; no private log/tune and no large-log benchmark added. Full-shell native file inputs prepare VE analysis, followed by replacement/publication and controller regressions. Native CDP mouse/keyboard interaction complements synthetic component events.
- Corrected `ve-analyzer-result-view.browser.mjs` to assert original base heat only in Proposed VE and neutral `0.5` fallback heat in alternate views. This resolves the pre-target-3 known assertion failure documented below; production Result View code and its accepted policy are unchanged.
- Added a separate Web CI browser job using the same command and installed Ubuntu Chrome, with an always-run results upload. The workflow is edited locally, **not executed on GitHub**. `docs/BROWSER_TESTS.md` documents prerequisites, selected suites, failure artifacts and limits; README links it.
- Final validation: **224 browser checks (112/configuration)**, covering MSQ replacement 17, accepted publication 15, VE lifecycle 26, Logger context 12, Analyzer activity 25, delay editing 15, Result View 1, native pointer/keyboard 1 in each of staged and Worker-disabled fallback imports. No unhandled browser exceptions. `npm test -- --maxWorkers=1`: **118 files / 610 tests passed**. `npm run build` including typecheck passed. CPU-heavy unit tests ran separately from the browser/build.
- Negative verification: deliberately missing Chrome executable exits 1 with actionable guidance and failed summary; SIGINT during INI startup exits 1, captures a screenshot/page snapshot and blocks the following MSQ step. The first interruption probe revealed brief continuation during diagnostics; runner-local cancellation guards and closed/disposed transport rejection corrected it, and the final probe passed. Temporary profiles/services from these runs were cleaned up.
- Results: ignored `artifacts/browser/` holds the latest passing summary, 16 per-suite JSON results and Chrome log. External checkpoint `/workspace/epicscope-improvements-target15/evidence/` preserves results, passing logs, negative probes, docs and patches. `targets1-3-15.patch` is the complete local delta from HEAD, including untracked modules/fixtures; `target15-runtime-tests.patch` isolates this target's runner/test/CI/docs additions (excluding cumulative HANDOFF/FIX_PLAN edits).
- Limits: this is the selected regression suite, not every `.browser.mjs` module, an original-recording acceptance run, or a new 1.2-GB performance profile. CI success remains insufficient to establish all browser behavior. No new production runtime changes were made in target 15.

## Local checkpoint — updated target 3 (2026-10-16)

Current branch remains `fix/input-publication-target-1`, based on main `09f8e3942afde19f5bf64c9570884886d56da9bc`. Updated targets 1–3 are local, uncommitted and unpushed. Earlier implementation/test changes remain intact. No GitHub operations were performed. Stop before target 15, the next item in the user-approved order; do not move directly to target 4.

- New explicit `editDelayCells(positions, edit)` contract at the existing v2 VE owner, forwarded through existing controller layers and the evidence controller. It uses `editVeDelayCells` in the existing core editing module. Core validates the entire batch (including integral coordinates and finite non-negative values), deduplicates positions, and maps the table once. Invalid batches cannot partially commit. Empty/semantic no-ops retain the original table and completed primary authority; displayed-millisecond recommendation/provenance behavior is preserved. Existing single-cell core APIs delegate to the same implementation.
- The v2 owner selects existing working/recommendation authority, publishes the new immutable model only after acceptance, then calls its existing invalidation once. Existing analysis, discovery and delay-file generations advance there. Inactive owners reject edit commands. Raw recommendations/source-event evidence, origin metadata and explicit clear/revert semantics survive. No full-log calculation is triggered by editing.
- v5 owns current inline selection and commits the whole selection through the contract rather than invoking hidden editor callbacks for each cell. Delete now reverts at this same owner; blank commit still clears working values. The superseded v4 bulk UI/selection/event machinery and v9 global Delete handler were removed because they competed with this current flow. v4's unrelated workflow presentation and v9's re-grab behavior remain. Legacy hidden single-cell controls still delegate to the owner contract for compatibility; their broader deletion is not part of target 3.
- Delay rendering was separated from `renderTuneTables`: editing invalidates once, rebuilds VE/target once, and renders the delay table once through existing readiness/discovery presentation. Redundant post-invalidation delay renders were removed from edit, activation and saved-file acceptance. This does not claim every unrelated render/observer path is consolidated; readiness/presentation targets remain later work.
- Inline preview/selection, drag rectangle, touch-tap editing, digit/decimal entry, Backspace, F2/Enter, blur commit, Escape, focus restoration and Delete-to-recommendation are retained. Session revision guards prevent a detached old input from restoring/committing into a replacement tune. Deactivation cancels a still-open preview; ordinary blur commit remains supported. No new global listeners/observers, generic lifecycle wrappers, workers or production instrumentation were added.
- Before/after evidence: the same four-cell browser edit on the target-2 checkpoint advanced revision 4 times, replaced VE/target tables 4 times each, and replaced the delay table 12 times; new behavior is 1 revision and 1 replacement of each table. A 256-cell owner command also does 1 revision/render with zero trace loads. These are operation-count checks, not a large-log latency benchmark. Local fixture-host method spies count commits and are restored afterward; no global DOM method is patched.
- New `tests/web/ve-delay-editing.browser.mjs` passes 15 real-browser checks, including application presentation refinements/reversed rows, no-op authority retention, invalid batches, explicit clear/revert, primary/popup withdrawal, pending file/analysis rejection, successful re-grab, recommendation-review activation, stale previews, Result View source values/neutral fallback heat/working delays, and a 256-cell batch. Native CDP mouse drag and keyboard input independently select/edit all four cells with one revision/render. Touch uses browser PointerEvent fixtures, not a physical-device claim.
- Full staged-worker and forced main-thread-fallback workflow runs each pass 110 checks: 95 existing publication/source-binding/activity/VE lifecycle/MSQ checks plus the 15 new checks. No unhandled browser exceptions were observed in these acceptance runs. Existing small real INI/MSQ/MLG/delay workflow fixtures are used; the 1.2-GB audit was not rerun. Three new automated core cases cover batch evidence/reference preservation, atomic rejection and no-op identity (nine editing tests total). Production build/typecheck and diff checks passed; all 118 automated files / 610 tests passed with one worker. Full-suite logs are in the evidence directory.
- Known pre-existing browser-test failure, explicitly not counted as a pass: `tests/web/ve-analyzer-result-view.browser.mjs` asserts both neutral heat in alternate fallback views and exact original base heat for the same cells. It fails with “change did not restore exact base heat level” on both the target-2 checkpoint and target 3. Unit heat-policy tests, current documentation and owner acceptance require neutral fallback heat. Production Result View behavior was not changed to satisfy this contradictory assertion. Before/after failure logs are retained; target 15 must correct the test and make the complete browser command honest. The new post-edit Result View check passes against the accepted contract.
- Evidence: `/workspace/epicscope-improvements-target3/evidence/`; replay work under `/tmp/epicscope-target3/`. `targets1-3.patch` is the complete current checkpoint relative to main; `target3-runtime-tests.patch` isolates this target's runtime/tests. `/tmp/epicscope-target3/before.patch` and earlier evidence preserve targets 1–2. Services started for target 3 were stopped before automated-suite validation. No automatic usage warning was received; quota percentages remain unavailable.

Next after review: target 15 (browser acceptance runner/CI and the documented contradictory assertion). No automatic implementation, commit or push is authorized by completing this target.

## Local checkpoint — updated target 2 (2026-10-16)

Current branch remains `fix/input-publication-target-1`, based on production main `09f8e3942afde19f5bf64c9570884886d56da9bc`. Updated targets 1–2 are local, uncommitted and unpushed. Target 1 implementation/test files remain intact. No GitHub operations or main-branch changes were performed for target 2. Stop before updated target 3 (batched VE delay edits); the approved order remains in FIX_PLAN.md.

- Confirmed before fixing in real Chromium: a retained Logger analysis context for source A, invoked after installing source B, returned B's values/metadata. `/tmp/epicscope-target2/context-before.log` records the failing regression against target 1's checkpoint.
- The change stays in `logger-page.ts` at `getAnalysisContext`. It captures source reference, sample extent, source revision and the already-available immutable channel definitions at context creation. A metadata-sized map indexes exactly that available catalog. Overview traces, requested-ID filtering, read bounds, post-await metadata resolution and advertised source all use those captured references. Neither the pre-read nor post-read path consults the replacement Logger source, definitions or unavailable set.
- Retained contexts remain bound to their original source, including calls after replacement/unload. A context created without a source remains empty. Live-source full/scoped reads are capped to that context's advertised extent; a fresh context sees newly appended samples. Deduplication, request order, batch reads, completeness checks, colors and original read-error propagation remain unchanged.
- This is source/metadata/extent binding, not a historical copy of sample arrays or CRC-validity masks. Existing source/cache owners may update validity in place, and existing controller revision/generation/activity guards still own invalidation and rejection of obsolete publication. No new cancellation owner, global listeners, observers, lifecycle wrappers, workers, caches or full-log passes were added. Context creation performs no sample reads or data-array copies; only catalog-sized metadata indexing is added. Immutable channel-definition contracts are preserved rather than deep-cloned.
- New `tests/web/logger-analysis-context.browser.mjs`: 12 real-browser Logger-owner checks cover retained and pending reads, single/batch paths, replacement metadata and missing/unavailable channels, new-context authority, no-source and unload cases, live growth/scoped clamping, actual completeness and original error propagation. Deferred fixture promises control replacement ordering without production hooks.
- Browser acceptance: 95 checks pass in each staged-worker and forced main-thread-fallback configuration (12 new source-context + 25 activity/generation + 26 VE lifecycle + 17 MSQ replacement + 15 target-1 publication checks). Full application workflows load the existing small real INI/MSQ/MLG/delay fixtures. No unhandled browser exceptions were observed. The 1.2-GB audit was not rerun.
- Production build/typecheck and diff checks passed; all 118 automated test files / 607 tests passed with one worker. Logs are recorded in the target-2 evidence directory. Browser services were stopped before running the suite to avoid the CPU-contention timeouts seen during target 1. Test timeouts/configuration are unchanged.
- Evidence: `/workspace/epicscope-improvements-target2/evidence/` contains before/after regression logs, staged/fallback browser logs and results, test/build logs, replay scripts, fixtures, current documentation, a target-2 runtime/test patch, and complete `targets1-2.patch` including untracked tests relative to main. `/tmp/epicscope-target2/before.patch` preserves the complete target-1 checkpoint. Earlier evidence is unchanged. Only services started for target 2 were stopped. No automatic usage-limit warning was received; account usage percentages remain unavailable.

Next after review: updated target 3 only. Then target 15 precedes targets 4–5; do not automatically continue or publish.

## Local checkpoint — updated target 1 (2026-10-16)

Production/continuation baseline was freshly fetched `main` at `09f8e3942afde19f5bf64c9570884886d56da9bc`. Current working branch is `fix/input-publication-target-1`, created from that baseline. Target 1 changes are local, uncommitted and unpushed; no GitHub publication or main-branch mutation was performed. The previous temporary branch remains untouched. This checkpoint supersedes the immediate-work ordering below: the user has approved the new sequence in FIX_PLAN.md. Stop before updated target 2 (source-bound analysis loaders).

- Shell ownership: `publishAnalysisInputs` is the common mode-entry/accepted-input publication path. MSQ acceptance publishes a tune-only update; context publications follow accepted INI load/unload and workspace remapping, recorded-log restore/validation and import failure/unload, initial reusable restore, and existing Shim catalog transitions. Existing source formats/loaders, cache tiers and controller boundaries remain separate.
- Only the active page receives new context/calculation work. Hidden pages receive current shell/Logger state on entry. Analyzer's existing inactive tune setter retains deferred tune authority. INI acceptance pauses the Analyzer during workspace remapping and resumes publication after restore. Failed candidate preparation does not publish or invalidate accepted state.
- Histogram now has an explicit tune-only setter at its existing owner. An open Table Generator receives the new tune; Distribution, Scatter and Math retain their computations and defer Table Generator setup until entry. This avoids fixing stale tune display by recalculating unrelated full-log views. Rejected MSQ candidates preserve existing state.
- Restored contexts include final saved ranges/navigation rather than only initial Logger defaults. Staged CRC validity updates publish the final revision; when validation finishes before restore, bookkeeping avoids a duplicate final publication. Restore completions check the current raw-source identity before publishing. Already-accepted unload/log state is still published if restoration fails, with local persistence feedback. The exceptional restore-failure branches were inspected but not separately fault-injected.
- Validation: new `tests/web/accepted-input-publication.browser.mjs` passes 12 full-shell checks plus three focused Histogram checks. Covers open-page MSQ and INI replacement, rejected preparation, hidden deferral, INI unload, MLG replacement while Analyzer remains open, restored saved-scope publication, source unload clearing Histogram results, and zero extra trace loads for tune-only Distribution/Scatter/Math updates. Both real staged-worker and forced main-thread-fallback import configurations pass. Existing 17 MSQ replacement and 26 VE lifecycle checks also pass in each configuration: 58 checks per configuration, with no unhandled browser exceptions observed.
- A separate archived-main browser run reproduces the original failure: the first new regression reports “Open Histogram retained previous tune”. The archive changes only development-server filesystem access for replay, not production runtime code. An early test incorrectly compared the reused Actual Mixture select's identity; it was corrected to compare the rebuilt RPM control. That timeout was a test-oracle problem, not evidence of a browser freeze.
- Automated suite: 118 files / 607 tests passed initially. A concurrent rerun with browser/build activity hit the default 5-second timeout in two existing 320k-sample tests; the final isolated rerun passed all 607 tests, and production build/typecheck passed. Logs are recorded in the evidence directory. No test timeout/configuration was changed. Small real workflow fixtures were used; the 1.2-GB audit was not rerun.
- Scope exclusions: no source-loader closure changes (target 2), delay editor consolidation, formula engine changes, general browser CI infrastructure, new global listeners/observers, worker/batching changes, storage schema changes or cache rewrites. Existing deliberate Open Log/Use Capture navigation behavior is preserved; live recording refresh is not made into a full-analysis refresh loop.
- Evidence and complete tracked/untracked patch relative to main: `/workspace/epicscope-improvements-target1/evidence/`. Temporary browser runners/fixtures are under `/tmp/epicscope-target1/`. Services started by this pass were stopped. Usage percentages are unavailable to the agent; no automatic limit warning was received.

Next only after review: updated target 2. The later target order is in FIX_PLAN.md. Do not confuse updated target 12 (MSQ parser semantics) with the original deferred telemetry point 12, now updated target 18.

## Continuation authority

Repository: `PJawZK/EpicEFI-EpicScope`

Authoritative production and continuation branch: `main`.

PR #462 — **Integrate Analyzer ownership and correctness fixes through point 11** — is merged.

Merge commit:

`2fdce3a4fc2a8759a45058c0ebc06dba0ed4739b`

The exact runtime build accepted in browser before merge was:

`b435702412642f039a8a7f49d33037c309bef9d8`

The later `7d0be605ecd11a35f46ea8552893842fbb1fedb4` commit was documentation-only. The merge commit incorporated that accepted runtime lineage. The observability architecture/research was then ported onto the accepted `main` baseline without runtime changes in `aa92d48f2671a1cd2f75f3b4fbcfb66e4dc35f19`.

Hosted application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

This file is the present-tense continuation authority. If older documentation conflicts, use current `main`, this handoff, the relevant subsystem authority, and current browser/runtime evidence.

## Current project position — 2026-10-16

- **Logger** — mature functional reference. Broad optimization remains paused unless a measured regression appears.
- **Histogram** — generic research-parity checkpoint is closed for the approved scope. Table Generator, Distribution, Scatter and Math Channels are mature unless field use exposes a concrete gap.
- **Analyzer** — ownership/correctness/performance cleanup through points 1–11 is merged into `main` and browser-accepted.
- **VE Analyzer** — stable current maturity checkpoint. The Result View source-authority and heat-map regressions are closed; session retention, retained-primary evidence reuse, semantic invalidation, active-domain routing and cooperative analysis are accepted.
- **UI** — immediate next work is a focused polish/consistency pass. Keep this visual/workflow-focused and avoid reopening accepted ownership architecture without a concrete defect.
- **Diagnostics / observability** — D-058 is approved and the architecture/research now lives on `main`. This is the next substantial implementation track after UI polish.
- **Point 12 telemetry async conversion/socket identity** — still reproduction-gated and lower priority.
- **MLG v3** — researched compatibility extension, not yet implemented; v1/v2 remain production support.
- **Linux production implementation** — future work after Web functional maturity and observability consolidation.

## Accepted Analyzer / VE baseline

Points 1–11 are complete on `main`:

1. large-log correctness and >320k-sample regression coverage;
2. VE session authority and navigation retention;
3. retained-primary evidence reuse;
4. semantic cell-detail invalidation;
5. selector/DOM ownership cleanup;
6. active Analyzer routing and stale hidden-work rejection;
7. measured CPU/correctness cleanup;
8. cooperative VE batching/progress/cancel;
9. visible/recoverable persistence failures;
10. controller-owned analysis trace-load errors;
11. transactional MSQ replacement with latest-generation authority.

Do not restore older controller/wrapper stacks or redo these points from historical branches.

### Result View acceptance

The prior defect used mutable rendered cell text as the source for later Result Views. Current behavior resolves source VE from retained authoritative analysis/model state instead.

Owner browser acceptance confirmed on the exact preview runtime SHA `b435702412642f039a8a7f49d33037c309bef9d8`:

- VE values remain stable through repeated Result View switching;
- Proposed VE uses normal VE heat;
- alternate views scale cells that have a real selected metric;
- untouched/fallback cells in alternate views keep the VE value but use neutral heat;
- Lambda Delay values remain correct;
- weak/evidence-only/no-evidence presentation remains sensible;
- completed VE analysis survives switching analyzers and leaving/re-entering Analyzer;
- no additional trace loading is caused by presentation-only view changes;
- Analyzer responsiveness is substantially improved compared with the problematic pre-Codex state.

### Remaining VE ownership debt

`readDelaySurface()` still reconstructs working delay information from rendered DOM even though the VE owner has authoritative working-delay state. This is later cleanup, not a current blocker. Do not broaden UI polish into this refactor unless a concrete issue makes it worthwhile.

## Approved visible workflows

Primary:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

Histogram:

> **Scope → Channels → Qualification → analysis-specific controls → evidence → Logger / Export**

VE Analyzer:

> **Load INI + MSQ + Log → select VE/target tables → verify actual mixture/RPM/load → qualify → discover/load lambda delay → activate working delay table → Run Analysis → review evidence/proposal**

Load Data order remains:

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

The Pi Zero 2 W phone-hotspot workflow is validated: Pi and laptop can share the phone hotspot for `ts_shim`, and the Pi returns to the configured home network when the hotspot is disabled.

Stable workspace assignments normalize between canonical `ini:*` identities and matching raw Shim identities. Source transitions must never reapply starter templates, resurrect deleted channels or create raw + `ini:*` duplicate traces.

## Observability / diagnostics authority

D-058 establishes one bounded correlated observability/session architecture. Implementation authority is `docs/OBSERVABILITY.md`; performance-first implementation research is `docs/research/OBSERVABILITY_PERFORMANCE_IMPLEMENTATION_RESEARCH.md`.

Core constraints already accepted:

- one authoritative bounded observability/session stream;
- specialized diagnostics/reports are projections rather than parallel durable stores;
- existing useful probes stay in their natural owners;
- packed/efficient hot-path representation and separate critical/detail retention;
- pre-insertion coalescing/backpressure so event storms make recording cheaper rather than worse;
- stable machine IDs and explicit numeric operation correlation;
- owner-provided revisions/fingerprints, never arbitrary full-state hashing;
- event/boundary-driven snapshots, not broad polling;
- O(1)-amortized streaming anomaly state with expensive causal analysis deferred;
- batched/chunked structured persistence rather than one write per event;
- bounded previous-session tail plus anomaly/error context windows;
- recursion/self-observation protection;
- explicit minimal/off versus enabled overhead benchmarks;
- anomaly detection initially reports evidence and does not automatically mutate/repair runtime state;
- local-first behavior with no silent telemetry or raw log/tune upload.

## Repository cleanup state

PR #462 is merged and is the accepted runtime baseline. The old Codex/VE validation PRs and the stale observability PR are historical only and should be closed after their useful content is represented on `main`.

Remote branches are not knowledge stores. Git/merged PR history and current documentation preserve provenance. `browser-previews` remains an infrastructure/deployment branch; `main` is the only product authority.

The GitHub connector available in this session can close PRs and audit refs but does not expose remote-branch deletion. Any branch refs classified as superseded in `BRANCH_CLEANUP_2026-10-15.md` may be deleted manually or by normal Git tooling without losing current authority.

## Immediate continuation order

1. Complete a focused UI polish pass from current `main`: consistency, spacing, control hierarchy, visual rough edges and accessibility/interaction details. Preserve accepted runtime semantics.
2. Run normal CI and browser sanity checks after UI work, especially Logger/Analyzer/Histogram navigation and VE Result Views.
3. Begin D-058 observability implementation from the staged plan in `OBSERVABILITY.md`, starting with benchmark baseline plus record/session/operation/retention contracts rather than UI-first diagnostics work.
4. Migrate existing diagnostics/performance/runtime-error/report paths incrementally; delete old collectors/builders only after parity.
5. Keep point 12 reproduction-gated.
6. Resume lower-priority Analyzer maturity or MLG v3 only when justified after observability consolidation.
7. Perform Web functional maturity review before Linux becomes the primary implementation target.

## Acceptance and safety rules

For VE/Analyzer runtime work, CI is necessary but not sufficient; browser behavior on the integrated build remains acceptance authority.

UI polish must not silently alter analysis semantics, qualification, source/tune authority, persistence, or ECU interaction.

Never automatically write or Burn to the ECU. Original tune/VE data, Analyzer evidence/proposal and any user-reviewed application result remain distinct states.
