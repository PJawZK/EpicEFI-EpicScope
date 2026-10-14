# EpicScope Handoff

## Continuation authority

Repository: `PJawZK/EpicEFI-EpicScope`

Authoritative production branch: `main`

Current authoritative runtime/product merge baseline:

`74b827c062fa601576c3050bd4544a90c01a365b`

That is PR #429, **Declutter VE Analyzer mappings and refine evidence/edit markers**.

Hosted application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

This file is the present-tense continuation authority. If older wording elsewhere conflicts, use current `main`, this handoff, `docs/research/STATUS.md`, `docs/VE_ANALYZER.md`, and current CI/runtime evidence.

## Current project position — 2026-10-14

EpicScope Web remains the functional reference/validation implementation for Logger, Histogram and Analyzer behavior.

The broad project position is now:

- **Logger** — mature functional reference; broad performance/micro-optimization work remains paused unless a measured regression appears.
- **Histogram** — generic research-parity checkpoint reached; Table Generator, Distribution, Scatter and Math Channels are mature for the currently approved scope.
- **Analyzer** — maturity remains uneven. Fueling and non-knock Ignition are mature experimental checkpoints, Boost is strong, Idle/AE are useful but thinner, Fuel / Injector is substantially improved, Trigger / Sync remains a broad-coverage target, and VE Analyzer is now an active implemented workbench rather than planned-only work.
- **VE Analyzer** — implemented, real-log validated, and currently the highest-value active maturity target. The current workbench includes table/target correlation, strict mixture-source semantics, adaptive RPM×load lambda-delay discovery and working tables, robust weighted VE evidence, confidence/spread, qualification controls, explicit Run readiness, direct delay-cell editing, save/load/provenance, and compact evidence visualization. Proposal review/apply lifecycle and result-view maturity remain incomplete.
- **MLG v3** — researched as a compatibility extension, but not yet implemented; v1/v2 remain the supported production path.
- **Linux production implementation** — intentionally future work after Web maturity and cleanup.

The preserved research corpus lives under `docs/research/`. `docs/research/STATUS.md` maps major research conclusions to EpicScope implementation state without rewriting the original observations.

## Approved visible workflow

The approved product workflow remains:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

For Histogram:

> **Scope → Channels → Qualification → analysis-specific controls → evidence → Logger / Export**

For VE Analyzer the current intended normal-use workflow is:

> **Load INI + MSQ + Log → select VE/target tables → verify actual mixture/RPM/load → qualify → discover/load lambda delay → activate working delay table → Run Analysis → review evidence/proposal**

Load Data menu order is intentionally:

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

Analyzer and Histogram channel selectors show units when unit metadata exists, using the shared `Name [unit]` convention.

Logger owns the authoritative timeline component. Histogram surfaces reuse the complete `.timeline-wrap`; do not split `.timeline-shell` from the Hide/Show controls edge toggle.

Future Histogram work should be correctness/regression maintenance or deliberate cleanup unless real field use exposes a concrete gap.

## Analyzer checkpoint

### Shared Analyzer behavior

Analyzer uses semantic channel-role suggestions with manual override, shared scope/Qualification concepts, evidence navigation back to Logger, progressive disclosure, shared event evidence, and explicit unavailable-data handling.

Channel selectors expose units when available. Literal ECU/INI/MSQ source names must be preserved; semantic roles may guide selection internally but must never rename channels/tables/axes in the user-facing UI.

### Fueling

Fueling remains a mature experimental checkpoint and is frozen unless a concrete defect/regression appears. It includes lambda-first mixture semantics, VE/load context, state qualification for DFCO/fuel cuts/AE/decel, trailing-window stability, observed mixture-response delay evidence, correction context, evidence strength, sortable evidence and Logger navigation.

### Ignition

Non-knock Ignition remains a mature experimental checkpoint and is frozen unless a concrete defect/regression appears. It includes final timing/correction/dwell/load context, large-log-safe events, ranked Areas to review, optional MSQ base-table attribution and observational source clues without making knock/safety claims.

### Boost

Boost remains a strong experimental foundation. It is control-mode aware, preserves polarity/plumbing neutrality and supports target-independent open-loop spool evidence plus closed-loop tracking evidence.

### Fuel Pressure / Injector

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

Both are useful foundations but remain later parity/refinement candidates after current VE work and the remaining Fuel / Injector / Trigger / Sync maturity gaps. AE/MAP Predict still benefits from richer event classification/timing/error comparison; Idle from richer phase/settling/headroom and MSQ DC Bias context.

## VE Analyzer — current implemented state

VE Analyzer is no longer a planned-only feature. The MLV/EMU PRO research is preserved in `docs/research/` and the intended behavior contract remains in `docs/VE_ANALYZER.md`. The implementation should continue to use those references as mature behavioral constraints without copying proprietary architecture.

### Core table / source semantics

Current behavior includes:

- VE table, target mixture table, and their matching axes parsed from MSQ/INI tune metadata;
- normal-use VE/target RPM/load axis selectors removed from the quick area because table selection auto-resolves the matching axes;
- manual axis overrides retained under **Advanced → Table-axis mapping** for ambiguous/non-standard tunes;
- table display orientation corrected so low load starts at the lower-left and increases upward;
- literal table/channel/source names preserved; no arbitrary renaming;
- AFR and Lambda target modes are explicit and scale-aware;
- target-table/unit mismatch and incompatible mixture-source conditions block analysis rather than silently reinterpret values;
- `afrError`, targets, correction/error percentages, table/axis channels and similar derived values are rejected as actual-mixture inputs;
- AFR mode prefers the firmware's Gas Scale AFR source when available, including literal variants such as `Air/Fuel Ratio_Gas Scale [AFR]` / `afrGasolineScale`;
- the earlier invalid `afrError [%]` auto-selection bug is closed.

### Qualification / Run readiness

Current quick qualification includes:

- optional Min/Max RPM and load bounds; blank means full range and must not block analysis;
- optional Min CLT and Min/Max TPS bounds; blank means no bound/full range;
- CLT/TPS source selection only matters when the corresponding qualification is active;
- `Coolant [deg]` is the preferred default CLT source when available;
- other legitimate CLT channels remain selectable;
- coolant-pressure, `cel_*`, Check Engine, diagnostic/fault/warning semantics are excluded from CLT candidates;
- trailing-window stable/recovery qualification;
- Cell Change authority presets mapping to prior authority: Responsive=5, Normal=20, Conservative=50, Very conservative=100; only Custom exposes a manual Prior weight field;
- Minimum evidence weight and Max VE change / Max VE change % proposal-safety controls;
- Run Analysis readiness is explicit and actionable rather than a generic disabled button;
- `Run blocked · N issues` includes a circular information button with per-blocker explanation, why it matters, how to fix it, and a Fix action when the exact control can be focused;
- vague aggregate `Proposal settings` readiness has been removed in favor of specific Prior weight / Minimum evidence weight / Max VE change / Max VE change % rows;
- optional Min/Max operating filters are not confused with required proposal safety limits.

The MSQ-load freeze caused by a self-triggering MutationObserver/readiness render loop was fixed. Do not reintroduce broad subtree observers that mutate the same subtree they watch.

### Lambda-delay model and workflow

The temporary single scalar delay has been replaced with an RPM×load delay model.

Current behavior includes:

- **Grab lambda delays from log** performs explicit discovery; no automatic expensive scan;
- robust event aggregation into an adaptive coarse RPM×load delay table rather than mirroring a full 32×32 VE table;
- recommendation uses measured-event median with P10/P90 spread and confidence;
- delay states: Measured / Interpolated / Insufficient;
- interpolation is local/bounded to supported evidence regions; sparse logs no longer manufacture a full believable surface from a handful of events;
- recommendation and working delay table are separate lifecycle states;
- **Use recommendation** explicitly promotes the reviewed recommendation into the working delay table;
- VE evidence requires a working delay table; a recommendation alone is insufficient;
- per-sample working delay is resolved in RPM/load operating space, then the mixture observation is shifted back in timestamp before engine-state/trim sampling;
- if delay is unavailable for an operating region, evidence is unavailable there rather than silently falling back to one global value;
- saved reusable delay tables use a versioned portable JSON format;
- saved/loaded table origin remains distinct from current-log measured evidence;
- user-edited cells retain explicit user provenance without overwriting raw recommendation/event evidence;
- measured cells retain source delay events for inspection;
- current-log discovery does not destroy an already loaded/saved working table;
- recommendation cells can be reviewed/edited while preserving raw measured recommendation underneath.

### Lambda-delay direct editing

The direct editing interaction has been through several fixes and is currently real-browser validated as working reliably.

Current intended behavior:

- click/tap selects a delay cell;
- click-drag selects a rectangular range;
- typing digits starts in-cell replacement immediately;
- the typed value previews live in the selected cell/range;
- Enter commits; Escape cancels; Backspace edits; Delete clears to explicit no working delay (`—`);
- repeated edits to the same cell work without needing to click elsewhere first;
- focus returns to the selected cell after commit/rerender;
- user edits use a compact corner provenance marker rather than a persistent border so selection remains visually unambiguous;
- clearing a cell that was originally empty returns it to an unedited empty state rather than leaving false `user-edited` provenance;
- the Excel-style crosshair cursor was removed;
- the old external value/apply controls are no longer the visible editing workflow.

A small amount of lag after clearing/editing was reported; PR #429 reduced unnecessary work by removing a redundant delay-focus observer and avoiding Run-readiness recalculation on every digit typed. Further optimization is acceptable if it preserves the now-stable editing behavior.

### VE evidence / proposal behavior

Current implementation includes:

- timestamp-aligned mixture evidence using the working delay model;
- optional known fuel-correction compensation with explicit semantics; e.g. `stftCorrection1 [%]` can be interpreted as percent fuel applied, while unknown semantics remain context-only unless explicitly declared;
- robust weighted VE evidence using a weighted median rather than an outlier-sensitive arithmetic mean;
- retained cumulative weight/sample count;
- P10/P90 correction spread and confidence per cell;
- proposal authority remains anchored to the starting VE table rather than treating log evidence as absolute truth;
- out-of-authority changes are withheld rather than silently clamped;
- compact fixed-size VE cells; detailed evidence stays in hover/click/tap detail instead of resizing cells;
- low-load table orientation starts at the lower-left;
- evidence presence uses the small upper-right dot;
- proposed-change cells use the stronger evidence state styling;
- weak-evidence cells keep the dotted outline and now also receive the same evidence dot;
- withheld evidence uses the compact withheld marker;
- touch/click detail is available in addition to mouse hover;
- real-log analysis has produced plausible small VE proposals after correcting the invalid AFR-source problem.

### Preserved MLV / EMU PRO conclusions

Do not regress these mature behavioral expectations while refining EpicScope:

- table-first workflow;
- spatial/bilinear weighting rather than nearest-cell-only assignment;
- starting-table prior authority;
- cumulative evidence and minimum-evidence qualification;
- independent absolute and percentage proposal safeguards;
- original-vs-proposal separation;
- transient rejection plus recovery/stability qualification;
- STFT/EGO context where meaningful;
- selective edit/revert before acceptance;
- result views for more than only proposed VE;
- explicit user apply strength/review before tune mutation;
- qualification ranges should be practical and visible, but optional bounds must not become artificial blockers.

EpicScope intentionally improves on the references with explicit time-based lambda-delay discovery, measured/interpolated/insufficient delay provenance, robust evidence spread/confidence, saved reusable delay assets, and direct source-event provenance.

### Remaining VE Analyzer maturity work

High-value remaining work, roughly in order:

1. **Result-view switching** in the VE table: Proposed VE, absolute change, % change, mixture error, hits/samples, cumulative weight, confidence/spread, delay used and exclusion/qualification context.
2. **Proposal review lifecycle**: editable VE proposal cells/ranges, revert selected, diff-first review, separate 25/50/75/100/custom apply authority, and export/apply as an explicit transition.
3. **Target-table analysis-only editing** using the same table-native interaction once lambda-delay editing is considered stable enough to reuse.
4. **VE-table direct editing** using the proven table-edit interaction, while preserving original/proposal separation.
5. **Stronger direct Logger navigation** from VE evidence/cells/source events.
6. **Custom filter / clearer time-range qualification** beyond the current preset/quick filter foundation.
7. **Delay estimator validation/refinement** against broader logs, especially very short or very long measured delays, before granting higher automatic authority.
8. Continue reducing wrapper/DOM bridge complexity only when it can be done without destabilizing the working editor.

Do not add an automatic ECU/MSQ Burn/write path. Proposal/application remains an explicit reviewed transition.

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

The recent TunerStudio table-interaction/stability research primarily belongs to EpicHub. For EpicScope the transferable rules are explicit separation between analysis/proposal state and tune/ECU state, diff-first explicit application, direct table editing, stable selection/focus, and no implicit Burn/write semantics.

## Dedicated cleanup/consolidation phase

Do not start a broad cleanup merely because implementation seams are visible.

After broader Analyzer coverage and VE proposal/review maturity are achieved, run a deliberate cleanup pass to:

- remove dormant duplicate editor paths;
- reduce analyzer-local/shared DOM enhancement layers;
- remove unnecessary MutationObservers;
- replace remaining DOM state bridges/synthetic interaction bridges with explicit controller/state contracts;
- consolidate shared table/event/help/rendering infrastructure;
- centralize canvas sizing/resize ownership;
- simplify CSS/runtime UI surgery;
- remove dead/unreachable compatibility paths;
- re-profile representative large logs.

The lambda-delay editor history demonstrated why this cleanup matters: stacked wrapper/focus/legacy-editor layers produced intermittent editing failures. Preserve working behavior over internal tidiness until an explicit cleanup slice is chosen.

## Validation status

Established validation includes:

- full type-check/test/production-build CI across the current PR series;
- real-browser fresh workspace seeding;
- real large-log Table Generator, Distribution and Math Channel validation;
- Logger/Table Generator/Distribution/Scatter timeline docking confirmation;
- real MLG + INI ↔ `ts_shim` source-transition validation;
- real-browser Fuel / Injector semantic validation;
- automated regression coverage for semantic channel roles, source continuity, fuel-pressure architecture, calibrated/raw pressure separation, unit-aware selector labels and Load Data ordering;
- real-browser VE Analyzer validation with matching INI/MSQ/MLG data;
- corrected Gas Scale AFR actual-mixture selection validated against real tune/log semantics;
- lambda-delay discovery → recommendation → working-table → Run Analysis workflow exercised in browser;
- adaptive sparse delay table behavior visually validated against real log evidence;
- direct lambda-delay single-cell/repeated edit/clear/range interaction validated after the #428 fixes;
- Run Analysis blocker/readiness flow validated after prior-authority and CLT semantic fixes;
- PR #429 CI: type-check, tests and build all green.

Historical representative workload remains the ~1.19 GB `2026-07-14_22.07.05.mlg` with 320,458 records and 1,389 log channels plus `mainController.ini`. VE Analyzer validation also used a matching INI/MSQ pair and a large downloadable real log from the user's Library. Known CRC/counter diagnostics in source logs are source-log properties rather than EpicScope regressions.

## Recent VE Analyzer merge chain

Useful checkpoints from the current implementation sequence:

- #408 — fuel-correction compensation;
- #409 — robust weighted VE evidence;
- #410 — confidence/spread visibility;
- #411 — compact VE cell geometry;
- #412 — strict actual-mixture validation;
- #413 — top-bar/help cleanup + Gas Scale AFR preference;
- #414 — RPM×load delay-table core;
- #415 — full per-sample 2D delay integration;
- #416 — adaptive coarse delay grid, bounded interpolation, table orientation and touch detail;
- #417 — delay save/load, provenance, user edits, source-event inspection, MLV/EMU audit preservation;
- #418 — Min CLT/TPS qualification and Cell Change authority presets;
- #419–#423 — lambda-delay workflow prominence, direct in-cell editing, readiness guidance, optional-bound semantics and editing-focus fixes;
- #424 — MSQ-load freeze / MutationObserver feedback-loop fix;
- #425–#427 — generic Run-blocker information, specific proposal readiness, CLT semantic exclusions and direct Cell Change prior-authority resolution;
- #428 — stable repeated lambda-delay editing/focus path;
- #429 — decluttered axis mappings, weak-evidence dot, user-edit marker simplification, `Coolant [deg]` preference and reduced edit/readiness overhead.

## Recommended continuation order

1. keep this handoff and research/status mapping synchronized with current `main`;
2. continue VE Analyzer maturity from the current #429 checkpoint, beginning with result views and then proposal review/edit/revert/apply/export lifecycle;
3. validate delay estimator behavior on additional broad logs before granting more automatic authority;
4. finish Fuel / Injector practical maturity;
5. bring Trigger / Sync to comparable evidence/navigation maturity;
6. add MLG v3 compatibility when remaining type mapping is sufficiently verified or a real need appears;
7. address remaining AE / MAP Predict and Idle maturity gaps;
8. run the dedicated cleanup/consolidation phase;
9. perform the Web functional maturity review;
10. only then move toward Linux production implementation.

## Local continuation

```bash
cd ~/EpicEFI-EpicScope
git switch main
git pull
npm run typecheck
npm test
npm run build
```
