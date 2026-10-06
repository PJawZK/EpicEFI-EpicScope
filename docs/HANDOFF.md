# EpicScope Handoff

## Continuation authority

Repository: `PJawZK/EpicEFI-EpicScope`

Authoritative branch: `main`

Current application baseline at this handoff refresh:

`df75cac2dcdb26c4fa89d087ed20a99f7bb2a79d`

That commit is the merge of PR #238, **Separate Idle Analyzer control systems**.

Hosted application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

Normal owner testing is browser/GitHub-Pages based and must not require a local clone, Node.js or npm.

This file is the present-tense continuation authority. If older current-state wording elsewhere conflicts with this handoff, use this handoff plus current `main`/CI state.

## Current project position

**Phases 1 through 4 remain complete for the originally approved scope.** Current work is a deliberate refinement pass, now centered on making Analyzer genuinely useful for tuning work rather than merely displaying aggregate summaries.

Do not begin Phase 5 unless the project owner explicitly asks.

Approved workflow remains:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

Logger, Histogram and Analyzer are all real active EpicScope modes. The EpicScope logo dropdown is the top-level mode switcher. Analyzer and Histogram each use their own compact secondary selector.

## Current real EpicScope modes

### Logger

Recorded-log viewing/navigation and source context:

- MLG v1/v2 loading, indexing and deferred/full CRC validation;
- optional INI channel catalog/binding;
- reusable named graph workspaces/presets;
- multi-pane fixed/freeform graph layouts;
- full available-channel browser plus on-demand analysis catalog;
- shared viewport/cursor/timeline;
- A/B selection, markers and saved ranges;
- exact-log persistence separated from reusable workspace state;
- session/cache/OPFS large-log architecture;
- Report health status badge.

**Graph preset invariant:** every available channel assigned to a currently visible pane must be active/rendered. Unavailable channels remain assigned but are not falsely activated. This now applies to workspace switching/restoration, Single→multi-pane layout changes, Freeform visibility changes and duplicated presets.

Internal synchronization must treat assignment state as authoritative. Avoid using a user-style toggle as an `ensure active`/`ensure absent` primitive.

Freeform currently exposes five panes; out-of-layout pane geometry is guarded so hidden pane 6 cannot cause the earlier undefined-geometry `.x` exception.

### Histogram

Current selectable surfaces:

- **Table Generator** — primary binned/table analysis surface and default;
- **Distribution**;
- **Scatter**;
- **Math Channels**.

The former Heatmap and Dual Heatmap views are not separate user-facing modes; their useful role is owned by Table Generator/Scatter.

### Analyzer

Current selectable surfaces:

- Range Compare;
- Tune Table;
- Boost · Experimental;
- Idle · Experimental;
- AE / MAP Predict · Experimental;
- Fueling · Experimental;
- Ignition · Experimental;
- Fuel / Injector · Experimental;
- Trigger / Sync · Experimental.

Current active product work is **Analyzer refinement**.

## UI system refinements since the previous handoff

The prior handoff stopped around PR #215. Important UI changes since then:

- PR #217 — removed the separate Table Generator Size button; remaining control is **Table Size**;
- PR #218 — visible `MLV weighted mean` wording became **Weighted Mean**; removed redundant active-mode chip; Analyzer mode buttons became a dropdown;
- PR #219 — unified Logger Layout menu; Reset/Clear moved into it; compact split Undo/Redo; Settings grouped by context;
- PR #220–#223 — Scatter expanded to Range/Full Log, Single/Dual, Dots/Lines, density heat coloring, shared Logger timeline and shared Hide/Show controls;
- PR #224 — Distribution became a real statistical workspace;
- PR #225 — Report gained live health status.

Do not restore removed/redundant controls unless a new requirement justifies them.

## Histogram / Table Generator — current authority

### Naming and controls

- visible weighted statistic label is **Weighted Mean**;
- the standalone **Size** button is removed;
- the remaining geometry control is **Table Size**;
- the Table Size popover owns Auto/custom/MSQ geometry settings.

### Channel/data authority

- X, Y, Z, optional Z Delta and filters can use the full available loaded-log channel catalog;
- only channels requested by the active analysis are decoded/read;
- Whole Log, A/B and saved-range scopes are supported;
- source-sample alignment and invalid/unavailable/filter evidence remain authoritative.

### Geometry

Axis sources:

- Auto bins;
- Custom breakpoints;
- Loaded MSQ table.

Custom/MSQ breakpoints are real table nodes.

**Loaded MSQ table is geometry-only.** It supplies X/Y breakpoint vectors and therefore rows/columns. It must not silently rewrite selected runtime X/Y/Z channels.

### Weighted Mean

PR #213 breakpoint-node weighting remains authoritative:

- samples between adjacent X nodes contribute linearly to both;
- samples between adjacent Y nodes contribute linearly to both;
- combined weight = X weight × Y weight;
- outer values clamp to the outer node;
- weighted contributing-hit count and total hit weight remain visible evidence.

The previously observed 19-hit difference on the large 1800/0 comparison cell remains a compatibility footnote, not an active task.

### Presets / filters / Math Channels

- presets retain complete reusable Table Generator setups;
- grouped filters support A/B/C grouping plus ALL/ANY semantics;
- Math Channels have a dedicated editor and safe evaluator;
- saved formulas/filter/preset records are validated before use;
- localStorage failure now preserves usable in-memory state for the session and reports persistence failure rather than silently claiming success.

Dynamic file/saved labels must be written as text, not interpolated as executable HTML.

## Distribution — current state

Distribution is now a proper single-channel statistical/frequency workspace:

- Range A/B and Full Log scopes;
- shared Logger timeline;
- Count / % Samples / Time Y-axis modes;
- automatic Freedman–Diaconis binning with fallback, plus manual bin count;
- Histogram and Cumulative views;
- mean, median, standard deviation, min/max and percentile statistics;
- saved-range A-vs-B comparison using shared bin boundaries;
- clickable bins with exact evidence and **Open bin in Logger**.

## Scatter — current state

Scatter now supports:

- Range A/B or Full Log;
- Single or Dual plots;
- Dots or Lines viewing;
- density heat coloring/legend;
- shared Logger timeline below Scatter;
- shared Hide/Show controls edge tab;
- current A/B and saved-range interaction without jumping back to Logger.

Stale results are cleared when a newly selected channel cannot load; old plots must never masquerade as the new selection.

## Logger correctness / graph presets

PRs #225–#230 addressed the multi-pane/preset trace-loading issue. The key lesson was that initial workspace restore may legitimately load only the panes visible at that moment; later layout/preset transitions must explicitly reconcile channels assigned to newly visible panes.

Current rule:

> **Visible pane + assigned available channel = active rendered trace.**

Reconciliation understands active vs pending/loading traces so it does not toggle an in-flight activation back off. Removing an assignment suppresses/cancels pending activation so an unassigned trace cannot arrive later.

## Correctness/safety audit status

PR #231 implemented the accepted Codex read-only audit findings:

- dynamic external/saved text no longer executes through `innerHTML` in the identified paths;
- channel removal/loading race fixed;
- histogram formula/filter/preset persistence failures retain session state and report failure;
- malformed stored histogram records are validated/skipped;
- Scatter clears stale result/canvas state on unavailable/rejected loads;
- pre-log Report health no longer describes assignments as unavailable in a nonexistent log.

## Retained-memory investigation

PR #232 added retained-memory instrumentation. PR #233 extended it across all still-live log-source instances using weak references/finalization tracking so diagnostics do not keep old sources alive themselves.

Test performed in one browser page:

1. load `2026-10-02_13.27.46.mlg` (~295 MB);
2. without page reload, load `2026-07-14_22.07.05.mlg` (~1.2 GB).

Observed after replacement:

- one current live source;
- zero previous live sources;
- one collected previous source;
- therefore no evidence of a cross-log strong-reference retention leak.

For the active ~1.2 GB log, one representative run with 22 retained channels reported approximately:

- persistent decoded columns: **56.4 MB**;
- bound full-channel ranges: **119.9 MB**;
- active graph ranges: **38.1 MB**.

These layers overlap and must **not** be summed as independent process memory.

No new LRU/byte budget was imposed. A future single-log stress test that browses many hundreds of channels may justify one, but do not add eviction merely because the counters exist.

## Analyzer — current architecture and state

Analyzer is being changed from summary-only screens into evidence-driven tuning tools.

### Shared foundation (PR #235)

Specialized analyzers now have:

- semantic channel-role suggestions instead of blindly selecting the first available channel;
- visible manual overrides;
- Full Log, Current A/B and Saved Range scope support;
- event rows that can route back to the source evidence in Logger.

### Event evidence (PR #237)

Idle and AE / MAP Predict now use a reusable event-evidence renderer:

- events aligned at `t=0`;
- aggregate median trace;
- 10–90% event envelope;
- click row to inspect one event in Analyzer;
- **All events** to return to aggregate evidence;
- double-click or Enter to open the event in Logger.

Current evidence graphs independently scale signals to emphasize response shape/timing; they are not yet a shared absolute-value Y-axis plot.

### Idle systems (PR #238)

Idle is now explicitly subsystem-aware.

Common required inputs:

- **RPM**;
- **Idle Target**.

Canonical runtime RPM matching strongly prefers `RPMValue` before fuzzy RPM matches.

Idle system selector:

- Combined;
- DC Idle;
- IAC Valve;
- ETB;
- Ignition.

System-specific roles are shown only when relevant. Combined can show interaction across systems.

**DC Bias distinction:** the calibration DC Bias curve/table is not a scalar logged channel. Analyzer only offers **DC Bias output (runtime)** when there is an actual logged runtime contribution/output. Calibration-curve analysis belongs to tune/MSQ context and is not implemented yet.

Idle Analyze semantics are explicit:

- **Sag threshold RPM** = how far actual RPM must fall below Idle Target to start a sag event;
- **Settled band RPM** = ±RPM band around target that ends recovery.

Idle evidence currently includes subsystem-relevant runtime traces and summary metrics such as worst sag and median recovery when available.

### AE / MAP Predict

Current event evidence includes available TPS, measured MAP, predicted MAP and AFR channels. Current richer metrics include mean/MAE prediction error and peak lean/rich excursion.

The intended next maturity step is broader event qualification/comparison and more complete transient-error timing metrics, not another separate UI architecture.

## Analyzer direction — next work

The agreed Analyzer principle is:

> **An analyzer should find relevant operating events, show the evidence that caused the result, quantify repeatability/error, and let the user move directly between analysis and the source log.**

Next shared implementation priorities:

1. **Comparison + qualification infrastructure**
   - compare two ranges/event sets;
   - reusable operating-condition filters (RPM/MAP/TPS/CLT/state/ranges);
   - stable-state qualification where appropriate;
   - sample/event coverage and confidence/repeatability indicators.

2. **Idle + AE/MAP refinement**
   - use the shared comparison/qualification layer;
   - add richer phase/timing metrics and aligned-event comparisons;
   - eventually integrate tune/MSQ calibration context where necessary, especially the actual DC Bias curve/current operating point.

3. **Boost + Fueling**
   - Boost: RPM×TPS×upper/lower duty, measured/target curves, spool 10/50/90%, overshoot/settling, duty saturation/contribution and repeated-pull comparison;
   - Fueling: stable-state RPM×MAP/TPS analysis, actual-target/lambda error, transient/AE/DFCO qualification, confidence and correction proposals.

4. **Fuel/Injector + Ignition + Trigger/Sync + upgraded Range Compare**
   - reuse the same evidence graph, event navigation, qualification and comparison framework.

Tune Table's useful tune-awareness should converge with the mature Table Generator rather than creating two competing cell-analysis systems.

## Analysis provenance rules — authoritative

Analysis must not silently discard or invent evidence. Where applicable retain/expose:

- input sample count;
- valid/invalid/unavailable sample counts;
- rejected/outside-range counts;
- source sample indices;
- selected time/range scope;
- complete vs partial decoded coverage;
- explicit channel/role/filter semantics;
- explicit aggregation/event method;
- event thresholds/configuration;
- weighted hit count/weight where relevant.

If a trace does not fully cover the requested scope, do not present the result as complete.

## Current PR sequence after the previous handoff

Relevant merged sequence after #215:

- #216 — docs handoff refresh;
- #217 — Table Size toolbar cleanup;
- #218 — streamlined navigation / Analyzer dropdown / Weighted Mean wording;
- #219 — Layout/history/settings UI consolidation;
- #220–#223 — Scatter expansion and shared timeline/hide control;
- #224 — Distribution analysis workspace;
- #225–#230 — Logger trace reconciliation, layout/preset activation and preset invariant;
- #231 — Codex correctness/safety audit fixes;
- #232 — retained-memory instrumentation;
- #233 — all-live-source memory instrumentation;
- #234 — Freeform hidden-pane geometry fix;
- #235 — Analyzer shared foundation;
- #237 — aligned evidence graphs for Idle and AE/MAP (`#236` was closed/unmerged during branch correction);
- #238 — Idle subsystem separation, canonical RPM role and DC Bias runtime/calibration distinction.

## Next chat — continue from here

A new chat should:

1. Read this file first and verify current `main` if repository state may have moved.
2. Treat `df75cac2dcdb26c4fa89d087ed20a99f7bb2a79d` / PR #238 as the application baseline for this handoff refresh.
3. Continue **Analyzer functional refinement**, not generic Logger/Histogram redesign.
4. Preserve the graph preset invariant: visible assigned available channels render.
5. Preserve Table Generator's MSQ geometry-only rule and established Weighted Mean geometry.
6. Do not treat DC Bias calibration curve/table as a scalar runtime channel; use tune/MSQ context when that work begins.
7. Build shared comparison/qualification/evidence capabilities before creating separate one-off analyzer frameworks.
8. Treat the cross-log memory-retention concern as cleared by current evidence; only revisit memory limits with a concrete single-log growth test or regression.
9. Keep Phase 5 gated on explicit owner approval.

## Phase boundary

**Phases 1–4 are complete for the originally approved scope. Current work is Analyzer maturity/refinement inside the existing Web product. Phase 5 is not authorized.**