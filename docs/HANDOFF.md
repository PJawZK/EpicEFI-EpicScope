# EpicScope Handoff

## Continuation authority

Repository: `PJawZK/EpicEFI-EpicScope`

Authoritative production branch: `main`

Current browser-validated VE runtime baseline before this documentation-only cleanup:

`86357400be6971b1f8edfe98d70816fa55b3bec5`

That is PR #449, **Restore VE Analyzer runtime to browser-known good state**.

The branch-cleanup documentation commit(s) after that baseline are documentation-only and do not alter VE runtime behavior.

Hosted application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

This file is the present-tense continuation authority. If older wording elsewhere conflicts, use current `main`, this handoff, `docs/VE_ANALYZER.md`, `docs/research/STATUS.md`, and current browser/CI evidence.

## Current project position — 2026-10-15

EpicScope Web remains the functional reference/validation implementation for Logger, Histogram and Analyzer behavior.

- **Logger** — mature functional reference. Broad performance/micro-optimization work remains paused unless a measured regression appears.
- **Histogram** — generic research-parity checkpoint is closed for the approved scope. Table Generator, Distribution, Scatter and Math Channels are mature unless field use exposes a concrete correctness gap.
- **Analyzer** — maturity remains uneven. Fueling and non-knock Ignition are mature experimental checkpoints, Boost is strong, Idle/AE are useful but thinner, Fuel / Injector is substantially improved, Trigger / Sync remains a broad-coverage target.
- **VE Analyzer** — implemented, real-log validated, and currently the highest-value active maturity target. The browser regression introduced after the known-good #441 runtime was stopped by PR #449; the project owner confirmed Analyzer entry works again after that rollback.
- **MLG v3** — researched as a compatibility extension, not yet implemented; v1/v2 remain the supported production path.
- **Linux production implementation** — future work after Web maturity and cleanup.

## Repository cleanup state

The repository accumulated roughly 195 remote branches. The 2026-10-15 cleanup proceeded conservatively:

1. branches fully contained by `main` were removed;
2. branches whose patches were already represented in `main` were removed;
3. the remaining branch families were audited against current `main` before deletion was recommended.

The audit covered VE Analyzer, Fuel / Injector, Histogram/Scatter/Distribution/Math/Table Generator, Logger starter workspaces, Inspector filtering, Shim/source-transition work, and preserved research/docs.

No remaining historical branch was found to be required as an authority. Meaningful product behavior, tests, research and decisions are represented in current `main`, generally in later/evolved form. Apparent `git cherry` uniqueness was largely due to refactoring, squash/rebase differences, or temporary transform/workflow commits.

See `docs/BRANCH_CLEANUP_2026-10-15.md` for the cleanup disposition.

## Authority map

- `main` — production authority.
- `docs/HANDOFF.md` — present-tense continuation authority.
- `docs/VE_ANALYZER.md` — VE Analyzer product/behavior contract.
- `docs/research/` — preserved external-tool research and implementation audits.
- `docs/research/STATUS.md` — current research-to-implementation disposition.
- `docs/HISTOGRAM.md` — current Histogram maturity authority.
- `docs/PREPOPULATED_WORKSPACES.md` — Logger starter/workspace product authority.
- `docs/STARTER_SYSTEM_VALIDATION.md` — starter/workspace validation boundary.

Literal INI/MSQ/channel/table names must remain preserved in user-facing behavior. Semantic roles may guide selection internally but must not rename source data.

## Approved visible workflow

Primary workflow:

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

INI and MSQ remain independent application resources and survive source transitions.

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

Source ownership remains:

```text
Recorded MLG + optional INI binding
              ↕
         INI catalog only
              ↕
      ts_shim live/capture
```

Stable workspace assignments normalize between canonical `ini:*` identities and matching raw Shim identities. Source transitions must never reapply a starter template, resurrect deleted channels, or create raw + `ini:*` duplicate traces.

## Logger checkpoint

Mature behavior includes:

- MLG v1/v2 staged import, CRC/source diagnostics and large-log reuse;
- INI-backed channel catalog/binding and optional MSQ enrichment;
- reusable named graph workspaces and exact-log navigation persistence;
- fixed/freeform multi-pane Logger plus Single and Dual layouts;
- A/B ranges, markers and saved ranges;
- stable channel identity across recorded and Shim transitions;
- semantic starter resolution and capability gating;
- 12 generic fresh-state workspaces and 12 capability-gated EpicEFI-specific starters;
- explicit Blank / From template creation;
- fully editable/deletable materialized starter workspaces;
- explicit unavailable-channel handling;
- retained-memory, parser, performance and runtime-health diagnostics.

Starter/workspace ownership invariant:

- **Layout** = graph geometry only.
- **Starter template** = task-oriented semantic role recipe.
- **Workspace** = ordinary user-owned materialized state.

A starter resolves once into an editable workspace. Later source transitions normalize channel identity only.

Do not resume broad Logger/performance micro-optimization without a concrete measured problem.

## Histogram checkpoint

Generic Histogram research parity is closed for the approved scope.

Current mature surfaces:

- **Table Generator** — Full Log / Current A/B / Saved Range, shared Qualification, physical + Math Channels, tune/custom/automatic geometry, Count/Mean/Median/Min/Max/Sum/StdDev/Variance/Weighted Mean, aligned reference/delta evidence, Logger navigation and CSV/provenance.
- **Distribution** — shared scopes/Qualification/Math Channels, Count/% Samples/Time, Histogram/Cumulative, descriptive statistics, two-scope comparison, saved setups, CSV, exact fixed geometry, explicit outside-geometry provenance and Logger evidence.
- **Scatter** — shared scopes/Qualification/Math Channels, Single/Dual, Dots/Lines, density heat, bounded rendering, point/box evidence, strongest contiguous Logger visit, saved setups and qualified/region CSV export.
- **Math Channels** — saved formulas, arithmetic/comparison/logical expressions, lazy `if()`, historical references and temporal helpers such as `lag()`, `delta()`, moving `avg()` and timestamp-based `rate()`.

Logger owns the authoritative timeline component. Histogram surfaces reuse the complete `.timeline-wrap`; do not split `.timeline-shell` from the Hide/Show-controls edge toggle.

Future Histogram work should be correctness/regression maintenance or deliberate cleanup unless real field use exposes a concrete gap.

## Analyzer checkpoint

### Fueling

Mature experimental checkpoint. Includes lambda-first mixture semantics, VE/load context, state qualification for DFCO/fuel cuts/AE/decel, trailing-window stability, observed mixture-response delay evidence, correction context, evidence strength, sortable evidence and Logger navigation.

### Ignition

Mature non-knock checkpoint. Includes final timing/correction/dwell/load context, large-log-safe events, ranked Areas to review, optional MSQ base-table attribution and observational source clues without making knock/safety claims.

### Boost

Strong experimental foundation. Control-mode aware, polarity/plumbing neutral, and supports target-independent open-loop spool evidence plus closed-loop tracking evidence.

### Fuel Pressure / Injector

Established now:

- threshold-event grouping respects actual source-sample continuity;
- event extremes retain exact source sample/time;
- injector duty headroom and ≥100% saturation evidence exist;
- event-context core supports pressure/PW/duty/deadtime/RPM/load evidence at the event extreme;
- calibrated low-side/high-side pressure semantics are separated from raw electrical channels;
- Conventional/port-injection and GDI/high-pressure architecture modes are explicit;
- pressure values/selectors carry unit metadata when available.

Remaining useful work includes visible event-extreme context, sag/recovery characterization, repeatability, pump/prime behavior where logged, voltage/deadtime evidence and stronger direct Logger review/navigation.

### Trigger / Sync

Still thinner. Useful next work includes sync state/error/loss context, isolated-glitch vs sustained-loss classification, pre/post evidence, RPM/voltage/load context, frequency by RPM band and direct Logger navigation.

### AE / MAP Predict and Idle

Useful foundations but later refinement candidates after current VE work and remaining Fuel / Injector / Trigger / Sync maturity gaps.

## VE Analyzer — current implemented state

VE Analyzer is implemented and real-log validated. The MLV/EMU PRO research remains preserved under `docs/research/`, and `docs/VE_ANALYZER.md` remains the intended behavioral contract.

Current behavior includes:

- VE table, target table and matching axes from MSQ/INI tune metadata;
- strict actual-mixture semantics and scale-aware AFR/Lambda handling;
- optional operating-range qualification and state exclusions;
- explicit actionable Run readiness;
- RPM×load lambda-delay discovery and working-table lifecycle;
- measured/interpolated/insufficient delay provenance;
- direct inline delay-cell editing and saved reusable delay tables;
- timestamp-aligned mixture evidence;
- optional known fuel-correction compensation with explicit semantics;
- robust weighted VE evidence using weighted median plus P10/P90 spread;
- cumulative evidence weight/sample count and confidence;
- starting-table prior authority;
- out-of-authority proposals withheld rather than silently clamped;
- compact proposal/evidence states;
- Result View modes;
- cell evidence with strongest contiguous visit → Logger.

### Browser-known-good boundary

The last explicitly browser-confirmed good runtime before the rollback is the #441 cell-evidence state, commit `fd21e4d4a390a4f6607d0290ef273749fc7fd915`.

PR #449 restored the VE runtime files to that known-good composition while retaining later audit documentation. The project owner subsequently confirmed Analyzer entry works again on the restored runtime.

Do **not** claim a future VE change is fixed merely because CI passes. Browser behavior is the acceptance authority for this surface.

### Known remaining VE issues

- Result View fallback/precision behavior remains imperfect.
- VE analysis/result state is lost on Logger → Analyzer round-trip.
- v2 `setContext` / `setTuneModel` remain destructive rebuild paths.
- cell evidence still duplicates VE analysis instead of consuming retained authoritative result state.
- the working delay table should eventually have an explicit state API rather than DOM reconstruction/synthetic handler calls.
- Custom qualification semantics need redesign before advanced formula work so selecting Custom does not silently disable normal state exclusions.

### Required next architecture direction

Future VE work should proceed from the current browser-known-good runtime one structural change at a time, with browser verification after each change.

Preferred sequence:

1. expose authoritative VE session/result/proposal/working-delay state from the core/controller;
2. make cell evidence consume retained primary results instead of recomputing analysis;
3. remove delay-table reconstruction from rendered DOM;
4. replace hidden one-shot qualification/load state with explicit analysis request/session configuration;
5. only then address Result View state ownership and Logger round-trip persistence;
6. later add review/apply workflow, application strength and diff-first explicit export/apply behavior.

Never automatically write or Burn to the ECU. Original VE, Analyzer proposal/evidence, and user-reviewed result must remain distinct states.

## Preserved behavioral constraints

Do not regress these mature VE expectations:

- table-first workflow;
- spatial/bilinear weighting rather than nearest-cell-only assignment;
- starting-table prior authority;
- cumulative evidence and minimum-evidence qualification;
- independent absolute and percentage proposal safeguards;
- original-vs-proposal separation;
- transient rejection plus recovery/stability qualification;
- STFT/EGO context where meaningful;
- selective edit/revert before acceptance;
- result views beyond only proposed VE;
- explicit user review before any tune mutation;
- practical qualification ranges without turning optional bounds into blockers.

## Branch cleanup continuation

Historical remote branches that were audited as superseded/integrated do not need to remain as active knowledge stores. Git history and merged PRs preserve provenance, while current authority lives in `main` and the documents listed above.

If a future investigation needs an old implementation, recover it from Git history/PR commits rather than treating an old branch as current authority.
