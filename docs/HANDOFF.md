# EpicScope Handoff

## Continuation authority

Repository: `PJawZK/EpicEFI-EpicScope`

Authoritative production branch: `main`

Current production `main` remains the merge authority. Browser-validated candidate branches/PRs may temporarily contain accepted fixes that still require clean integration onto `main`; those are explicitly identified below and must not be confused with production state.

Hosted application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

This file is the present-tense continuation authority. `DOCUMENTATION_MAP.md` defines how to interpret historical/reference docs. If older wording conflicts, use current `main`, this handoff, the relevant subsystem authority and current browser/runtime evidence.

## Current project position — 2026-10-15

- **Logger** — mature functional reference. Broad performance/micro-optimization work remains paused unless a measured regression appears.
- **Histogram** — generic research-parity checkpoint closed for the approved scope. Table Generator, Distribution, Scatter and Math Channels are mature unless field use exposes a concrete correctness gap.
- **Analyzer** — maturity remains uneven. Fueling and non-knock Ignition are mature experimental checkpoints, Boost is strong, Idle/AE are useful but thinner, Fuel / Injector and Trigger / Sync retain targeted maturity gaps.
- **VE Analyzer** — implemented and real-log/browser validated. A browser-tested candidate line now fixes Analyzer-entry looping, Logger → Analyzer result retention, retained cell-evidence reuse and Result View untouched-value preservation; clean integration onto `main` is still required.
- **Runtime cleanup** — remaining approved sequence is DOM ownership → hidden-view routing → measured CPU cleanup → workers/batching only if still justified.
- **Observability** — D-058 / `OBSERVABILITY.md` approve a unified bounded diagnostics/performance/report architecture. Implementation waits for a stable browser-validated baseline after the active cleanup sequence.
- **MLG v3** — researched compatibility extension, not yet implemented; v1/v2 remain production support.
- **Linux production implementation** — future work after Web maturity/cleanup.

## Repository state

Historical branch cleanup completed on 2026-10-15. `main` remains the only production/merge authority. Temporary active development/browser-validation branches may exist while work is in progress; they are not independent product authorities.

Historical branches are no longer knowledge stores. Recover old implementation detail from Git history/merged PRs when needed.

See `BRANCH_CLEANUP_2026-10-15.md`.

## Documentation authority map

- `HANDOFF.md` — present-tense continuation authority.
- `DOCUMENTATION_MAP.md` — document authority/history classification.
- `PRODUCT.md` — current product contract.
- `ROADMAP.md` — current sequence/status.
- `ARCHITECTURE.md` / `FILE_ARCHITECTURE.md` — ownership/dependency authority.
- `OBSERVABILITY.md` — approved diagnostics/performance/report consolidation architecture and implementation plan.
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

## VE Analyzer — current implemented and browser-validation state

Current implemented behavior includes:

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

### Production/browser-known-good boundary

PR #449 restored runtime files to the earlier browser-known-good composition after later wrapper/lifecycle experiments froze Analyzer entry.

Future VE lifecycle/render/input work still requires browser acceptance; green CI alone is insufficient.

### Browser-validated candidate line after #449

The following candidate work has been field-tested successfully but still needs clean integration onto current `main` rather than merging the divergent browser-test PR stack wholesale:

- `dbecb07b1dbee53d24fd023b8d10a417b9d812df` — semantic lifecycle/source revision work plus narrow channel-role decorator loop fix; user confirmed Analyzer entry works and Logger → Analyzer analysis values survive.
- `b3d1709cc7311fc5256c582eaf2c7c4c0d5ea2f4` — retained VE evidence/proposal reused by cell evidence with semantic detail invalidation; user confirmed the broader workflow remains functional.
- PR #459 / `31f6a2954072bb0e60ec32f4b0f6ad7d89b6279e` — Result View untouched/original VE values preserved while selected metrics still drive relevant evidence cells; user confirmed it works correctly in browser.

This candidate state resolves the two originally reported user-visible problems on the tested line:

1. analysis/result state survives Logger → Analyzer navigation;
2. untouched/original VE values survive Result View switching.

Do not merge PR #457/#458/#459 as-is merely because they are browser accepted; cleanly integrate accepted owner-level changes onto current `main` after reconciling the already-merged large-log correctness fix.

### Remaining VE/runtime cleanup

- clean integration of the accepted point-2/point-3/Result View fixes onto `main`;
- broader DOM ownership cleanup (Analyzer/Histogram document-wide decoration ownership);
- route context/tune work only to active Analyzer domains where possible;
- measured CPU cleanup after ownership/lifecycle work;
- workers/batching only if profiling still justifies them;
- later review/application/export/diff maturity.

Never automatically write or Burn to the ECU. Original VE, analyzed evidence/proposal and user-reviewed/application result remain distinct states.

## Broader static findings queued after current cleanup

Read-only audit findings that should remain on the backlog:

- persistence handlers that ignore failed save/delete results should make failure visible and recoverable;
- analysis controllers that await trace/data loading need owned rejection handling so failures do not become unhandled/stale states;
- extend large-input correctness checks to remaining Idle/AE extrema paths that still use spread-style extrema on event arrays;
- bound presentation preparation where full event arrays are formatted even when only a limited row count is rendered;
- review transactional replacement-file loading so a malformed replacement need not discard a valid session before acceptance;
- hidden/pending analyzer work should invalidate correctly when tune/context changes;
- lower-priority Shim telemetry completion hardening should be promoted only with a reproducing deferred-conversion regression test.

These findings do not supersede the active sequence; they are candidates for later targeted fixes.

## Unified observability — approved future track

D-058 and `OBSERVABILITY.md` define the approved replacement/consolidation of current diagnostics, performance and report ownership.

Current repository assets worth preserving include:

- load/validation/binding/workspace/channel timing breakdowns;
- source read/cache counters;
- retained-memory probes;
- parser/source-integrity classification;
- Logger runtime snapshots;
- runtime error/unhandled-rejection capture;
- application/source/environment context used by bug reports.

The architectural problem is fragmentation, not lack of useful measurements.

Target invariant:

> **One bounded correlated observability record/session stream; Health, Performance, Parser / Source Integrity, Resources, Errors, Previous Session and export reports are projections of it.**

Implementation begins only after the active DOM-ownership/hidden-view/CPU cleanup reaches a stable browser-validated baseline. Migration must proceed in stages and delete old redundant collectors/builders after parity rather than stacking a second permanent diagnostics system beside them.

The target system records compact events/metrics/snapshots with session and parent/child operation correlation, supports broad anomaly detection, preserves a bounded previous-session black-box tail, remains local-first, and does not record raw log/tune payloads by default.

## Preserved VE behavioral constraints

Do not regress table-first workflow, spatial/bilinear weighting, starting-table prior authority, cumulative evidence, independent absolute/percentage safeguards, original-vs-proposal separation, transient recovery qualification, correction-layer context, selective review/revert, multiple result views and explicit user review before any tune mutation.

## Current continuation boundary

1. cleanly integrate the browser-accepted VE lifecycle/evidence/Result View fixes onto current `main` without reintroducing wrapper stacks;
2. continue the already-approved runtime cleanup sequence: DOM ownership → hidden-view routing → measured CPU cleanup → workers/batching only if justified;
3. freeze a stable browser-validated baseline;
4. then implement `OBSERVABILITY.md` in staged migration steps, preserving useful current measurements and removing redundant old diagnostics/report ownership after parity;
5. afterwards resume lower-priority Analyzer maturity and compatibility work.
