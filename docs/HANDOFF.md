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
- VE result/session state is lost on Logger → Analyzer round-trip.
- v2 `setContext` / `setTuneModel` remain destructive rebuild paths.
- cell evidence still duplicates VE analysis instead of consuming retained primary result state.
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
