# EpicScope Handoff

## Continuation authority

Repository: `PJawZK/EpicEFI-EpicScope`

Authoritative production branch: `main`

Current authoritative runtime/product merge baseline:

`49980f6e4e2983fdc9c61539a70737e7530518a1`

That is PR #393, **Order Load Data menu by use sequence**, and it sits on top of the Analyzer/Fuel-Injector, channel-semantic and Histogram selector-unit work through PRs #382–#392.

Hosted application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

This file is the present-tense continuation authority. If older wording elsewhere conflicts, use current `main`, this handoff, `docs/research/STATUS.md`, and current CI/runtime evidence.

## Current project position — 2026-10-14

EpicScope Web remains the functional reference/validation implementation for Logger, Histogram and Analyzer behavior.

The broad project position is now:

- **Logger** — mature functional reference; broad performance/micro-optimization work remains paused unless a measured regression appears.
- **Histogram** — generic research-parity checkpoint reached; Table Generator, Distribution, Scatter and Math Channels are mature for the currently approved scope.
- **Analyzer** — maturity remains uneven. Fueling and non-knock Ignition are mature experimental checkpoints, Boost is strong, Idle/AE are useful but thinner, Fuel / Injector is actively improving, and Trigger / Sync remains a broad-coverage target.
- **VE Analyzer** — researched and specified in `docs/VE_ANALYZER.md`, but not yet implemented as a product surface.
- **MLG v3** — researched as a compatibility extension, but not yet implemented; v1/v2 remain the supported production path.
- **Linux production implementation** — intentionally future work after Web maturity and cleanup.

The preserved research corpus now lives under `docs/research/`. `docs/research/STATUS.md` maps every major research conclusion to current EpicScope implementation state without rewriting the original observations.

## Approved visible workflow

The approved product workflow remains:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

For Histogram:

> **Scope → Channels → Qualification → analysis-specific controls → evidence → Logger / Export**

Load Data menu order is now intentionally:

1. Load INI
2. Load MSQ
3. Open Log
4. Unload Log
5. Connect Shim

INI and MSQ are independent application resources and survive source transitions.

## Validated source/runtime topology

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

Local development command used on JZ-Main:

```bash
cd ~/EpicEFI-EpicScope
EPICSCOPE_SHIM_TARGET='http://192.168.186.181:29002' npm run dev:shim
```

Browser:

`http://localhost:5173/`

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
- INI-backed channel catalog/binding;
- optional MSQ tune enrichment;
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

Do not resume broad Logger/performance micro-optimization without a concrete measured problem.

### Starter/workspace ownership invariant

Layout, starter and workspace remain separate concepts:

- **Layout** — graph geometry only;
- **Starter template** — task-oriented semantic role recipe;
- **Workspace** — ordinary user-owned materialized state.

A starter resolves once into an ordinary editable workspace. Later source transitions normalize channel identity only.

## Histogram checkpoint

Generic Histogram research parity is closed for the currently approved scope.

Current mature surfaces:

- **Table Generator** — Full Log / Current A/B / Saved Range, shared Qualification, physical + Math Channels, tune/custom/automatic geometry, Count/Mean/Median/Min/Max/Sum/StdDev/Variance/Weighted Mean, aligned reference/delta evidence, Logger navigation and CSV/provenance.
- **Distribution** — shared scopes/Qualification/Math Channels, Count/% Samples/Time, Histogram/Cumulative, descriptive statistics, two-scope comparison, saved setups, CSV, exact fixed geometry, explicit outside-geometry provenance and Logger evidence.
- **Scatter** — shared scopes/Qualification/Math Channels, Single/Dual, Dots/Lines, density heat, bounded rendering, point/box evidence, strongest contiguous Logger visit, saved setups and qualified/region CSV export.
- **Math Channels** — saved formulas, arithmetic/comparison/logical expressions, lazy `if()`, historical references and temporal helpers such as `lag()`, `delta()`, moving `avg()` and timestamp-based `rate()`.

Analyzer and Histogram channel selectors now show units when unit metadata exists, using a shared `Name [unit]` convention.

Logger owns the authoritative timeline component. Histogram surfaces reuse the complete `.timeline-wrap`; do not split `.timeline-shell` from the Hide/Show controls edge toggle.

Future Histogram work should be correctness/regression maintenance or deliberate cleanup unless real field use exposes a concrete gap.

## Analyzer checkpoint

### Shared Analyzer behavior

Analyzer uses semantic channel-role suggestions with manual override, shared scope/Qualification concepts, evidence navigation back to Logger, progressive disclosure, shared event evidence, and explicit unavailable data handling.

Channel selectors now expose units when available.

### Fueling

Fueling remains a mature experimental checkpoint and is frozen unless a concrete defect/regression appears. It includes lambda-first mixture semantics, VE/load context, state qualification for DFCO/fuel cuts/AE/decel, trailing-window stability, observed mixture-response delay evidence, correction context, evidence strength, sortable evidence and Logger navigation.

### Ignition

Non-knock Ignition remains a mature experimental checkpoint and is frozen unless a concrete defect/regression appears. It includes final timing/correction/dwell/load context, large-log-safe events, ranked Areas to review, optional MSQ base-table attribution and observational source clues without making knock/safety claims.

### Boost

Boost remains a strong experimental foundation. It is control-mode aware, preserves polarity/plumbing neutrality and supports target-independent open-loop spool evidence plus closed-loop tracking evidence.

### Fuel Pressure / Injector — current state after PRs #382–#390

This analyzer has moved substantially beyond its earlier thin state.

Established now:

- threshold-event grouping respects actual source-sample continuity;
- event extremes retain exact source sample/time;
- injector duty headroom and ≥100% saturation evidence exist;
- event-context core supports pressure/PW/duty/deadtime/RPM/load evidence at the event extreme;
- decision-facing summary cards are present;
- Check Engine Light (`cel_*`) channels are excluded from fuel-pressure roles;
- `rawLowFuelPressure` / `rawHighFuelPressure` electrical channels are excluded from calibrated pressure roles;
- canonical `fuelPressure_low` / `fuelPressure_high` are preferred calibrated roles;
- low-side conventional pressure and high-side/GDI pressure are distinct semantic domains;
- explicit fuel-system architecture mode separates Conventional / port injection from GDI / high-pressure behavior;
- conventional mode uses rail differential as active pressure evidence;
- GDI mode uses high-side rail pressure as active evidence and keeps low-side supply as context;
- pressure values/selectors carry unit metadata when available.

Remaining high-value maturity work:

- wire full event-extreme context into the visible event table/evidence view;
- pressure sag magnitude and recovery characterization;
- repeated-event/repeatability summaries;
- pump/prime recovery behavior where logged;
- voltage/deadtime evidence and deadtime-calibration comparison;
- stronger direct Logger review/navigation comparable to mature Fueling/Ignition.

### Trigger / Sync

Trigger / Sync remains thinner. Next useful work:

- sync state / trigger error / loss counter/reason context;
- distinguish isolated one-sample glitches from sustained sync loss;
- RPM/voltage/load context at events;
- pre/post evidence;
- frequency by RPM band;
- direct Logger navigation and ranked review areas.

A future waveform-style Trigger Logger (crank/cam/TDC/injection/ignition relationship view) is separate from the statistical Trigger / Sync analyzer and should be scoped deliberately before implementation.

### AE / MAP Predict and Idle

Both are useful foundations but remain later parity/refinement candidates after Fuel / Injector and Trigger / Sync. AE/MAP Predict still benefits from richer event classification/timing/error comparison; Idle from richer phase/settling/headroom and MSQ DC Bias context.

## VE Analyzer — planned major feature

The MLV/EMU PRO research is now preserved on the authoritative documentation branch and the intended behavior contract lives in `docs/VE_ANALYZER.md`.

The feature is not implemented yet.

Key planned invariants:

- evidence-first recommendations, not silent tune mutation;
- semantic VE-analysis qualification presets;
- separate lambda-delay-discovery qualification;
- single / RPM-curve / RPM×load delay models;
- explicit **Grab lambda delays from log** rather than automatic expensive scans;
- timestamp-based delay alignment;
- bilinear VE-node evidence geometry;
- confidence/prior authority;
- Measured / Interpolated / Weak / Withheld / No-evidence result states;
- source-sample provenance and Logger navigation;
- recommendation authority separate from user apply percentage;
- out-of-authority proposals withheld rather than silently clamped;
- original tune preserved until explicit review/apply/export.

Reuse existing Fueling, AFR-delay, Table Generator weighting, Qualification, scope, semantic role and MSQ foundations rather than building parallel infrastructure.

## MLG v3 compatibility

`docs/research/MLG_V3_RESEARCH.md` preserves the bounded TunerStudio/MLV investigation.

Current production status:

- v1/v2 supported;
- v3 not yet supported;
- v3 is expected to extend the v2-style container rather than require a parser rewrite;
- little-endian scalar IDs 9..14 are experimentally confirmed;
- descriptor IDs 8 and 15 must not be guessed as F64;
- extended bitfield mapping still requires fixture validation.

Current EpicEFI logs observed under a v3-capable TunerStudio can still remain v2, so v3 is a compatibility expansion rather than a current blocker.

## Research preservation policy

`docs/research/` contains external behavioral research records. Preserve them as historical observations.

Do not rewrite research notes merely because EpicScope later chose a different or stronger behavior. Update `docs/research/STATUS.md` to record whether a finding is Implemented, Improved in EpicScope, Partial, Planned, Deferred, or Not applicable to EpicScope.

The recent TunerStudio table-interaction/stability research primarily belongs to EpicHub. For EpicScope the transferable rules are explicit separation between analysis/proposal state and tune/ECU state, diff-first explicit application, and no implicit Burn/write semantics.

## Dedicated cleanup/consolidation phase

Do not start a broad cleanup merely because implementation seams are visible.

After broader Analyzer coverage is achieved, run a deliberate cleanup pass to:

- remove dormant duplicate editor paths;
- reduce analyzer-local/shared DOM enhancement layers;
- remove unnecessary MutationObservers;
- replace direct DOM state bridges with explicit contracts;
- consolidate shared table/event/help/rendering infrastructure;
- centralize canvas sizing/resize ownership;
- simplify CSS/runtime UI surgery;
- remove dead/unreachable compatibility paths;
- re-profile representative large logs.

Preserve working behavior over internal tidiness until then.

## Validation status

Established validation includes:

- full type-check/test/production-build CI across the current PR series;
- real-browser fresh workspace seeding;
- real large-log Table Generator, Distribution and Math Channel validation;
- Logger/Table Generator/Distribution/Scatter timeline docking confirmation;
- real MLG + INI ↔ `ts_shim` source-transition validation;
- real-browser Fuel / Injector semantic validation on the representative July log;
- automated regression coverage for semantic channel roles, source continuity, fuel-pressure architecture, calibrated/raw pressure separation, unit-aware selector labels and Load Data ordering.

Representative workload remains the ~1.19 GB `2026-07-14_22.07.05.mlg` with 320,458 records and 1,389 log channels plus `mainController.ini`. Known CRC/counter diagnostics are source-log properties rather than EpicScope regressions.

## Recommended continuation order

1. keep the synchronized research/documentation state current;
2. finish Fuel / Injector practical maturity;
3. bring Trigger / Sync to comparable evidence/navigation maturity;
4. implement VE Analyzer from `docs/VE_ANALYZER.md`;
5. add MLG v3 compatibility when remaining type mapping is sufficiently verified or a real need appears;
6. address remaining AE / MAP Predict and Idle maturity gaps;
7. run the dedicated cleanup/consolidation phase;
8. perform the Web functional maturity review;
9. only then move toward Linux production implementation.

## Local continuation

```bash
cd ~/EpicEFI-EpicScope
git switch main
git pull
npm run typecheck
npm test
```
