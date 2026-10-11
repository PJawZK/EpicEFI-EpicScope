# EpicScope Handoff

## Continuation authority

Repository: `PJawZK/EpicEFI-EpicScope`

Authoritative branch: `main`

Authoritative application baseline before this documentation refresh:

`52873771d535a3f772f056f2db1e8a471fbac4e7`

That commit includes PR #317, **Summarize Boost chamber response evidence**.

Hosted recorded-log application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

This file is the present-tense continuation authority. If older current-state wording elsewhere conflicts with this handoff, use this handoff plus current `main`/CI state.

## Current development position — 2026-10-11

**Phases 1–4 remain complete for the originally approved Web scope.** Current work is product maturity/refinement inside those modes.

Active track:

1. **Web-product maturity / Analyzer usefulness / evidence-driven tuning workflows** — ACTIVE.
2. **EpicEFI `ts_shim` real-ECU runtime validation** — PAUSED until the required Pi Zero 2 W USB adapter is available.

Do not begin Phase 5 unless the project owner explicitly asks.

Approved workflow remains:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

The dedicated browser performance campaign is now considered complete. Reopen performance work only for a concrete regression, visible interaction problem or new measured workload issue.

## Performance/static maturity checkpoint — completed current campaign

Recent recorded-log performance work culminated in PRs #288–#293:

- #288 — captured priority columns can satisfy viewport slices;
- #289 — deferred full graph materialization is batched;
- #290 — detailed graph phase instrumentation;
- #291 — reuse precomputed full statistics before CRC validation, then refresh authoritative graph statistics after validation;
- #292 — panes outside the current layout keep assignments but no longer remain graph-active;
- #293 — CRC status wording distinguishes clean validation from unrecovered CRC records.

Representative controlled results on the 1.19 GB / 320,458-record test log were roughly:

- initial import around 1.27–1.30 s on the test PC, dominated by real file I/O;
- controlled 8-channel viewport workspace restore around 56–59 ms;
- zero physical reads on the restored captured viewport path;
- deferred 8-channel full materialization reduced from roughly 64 ms to roughly 30 ms after removal of redundant statistics work;
- remaining graph cost is predominantly legitimate envelope construction + trace drawing rather than unexplained overhead.

Do **not** resume general micro-optimization just to shave already-small timings.

The long-used parser test log remains known to contain:

- 291 recovered retry artifacts;
- 8 unrecovered CRC records;
- 9 counter anomalies.

Those invalid source attempts are retained as evidence but excluded from trusted samples. The UI correctly reports `CRC checked · 8 unrecovered CRC records` rather than claiming full CRC validation.

## UI / interaction conventions established in the current chat

### Transient surfaces

PRs #294 and #298 established a common interaction rule:

> **Opening another transient control, or clicking outside the current transient surface, closes the old one.**

This applies to custom dropdown/popover surfaces and the native `<details>` popout menus that act as transient menus.

Structural disclosures such as Analyzer threshold/options sections are not transient popovers and should remain open until deliberately changed.

Diag, Perf and Report now use the same anchored footer-popout interaction style; Report is no longer a modal dialog.

### Analyzer navigation

PR #295 made the compact Analyzer secondary selector native to the Analyzer controller. Do not restore the old permanent mode-button row or proxy hidden controls.

### Inline information/help

PR #306 generalized the earlier Idle-only `i` help implementation into shared EpicScope inline-help infrastructure.

This is now an application-wide convention:

> **If a non-obvious control, threshold, statistic or result would benefit from interpretation, add an inline `i` explanation at the point of use.**

Useful help should explain:

1. what the setting/result is;
2. what changing the setting changes;
3. what result the user should expect;
4. how that result should be interpreted for tuning;
5. important limitations / what cannot be concluded.

Avoid filling obvious UI with redundant help buttons.

## Logger → Analyzer workflow checkpoint

PR #297 added a contextual Logger handoff:

- the existing A/B range tool is explicitly **Qualify**;
- a valid A/B selection exposes **Analyze A/B**;
- Analyze A/B routes directly to Analyzer → Range Compare with Current A/B retained as the comparison scope.

Analyzer event/source navigation back into Logger remains authoritative for reverse navigation.

## Shared Analyzer foundation — current authority

Do not create parallel analyzer-specific scope/filter/comparison frameworks when shared infrastructure already exists.

Current shared foundation includes:

- semantic channel-role suggestions with visible manual override;
- Full Log / Current A/B / Saved Range scopes;
- contextual Logger → Analyzer handoff;
- Analyzer → Logger event/source navigation;
- shared saved qualification filter storage;
- grouped ALL/ANY qualification semantics;
- qualification provenance: input / eligible / rejected / invalid / unavailable;
- event-aligned evidence where used;
- median + 10–90% event envelopes;
- shared numeric comparisons;
- P10 / Median / P90 comparison metrics;
- shared inline-help infrastructure.

PR sequence for the shared comparison/qualification foundation:

- #296 — Range Compare shared scopes;
- #297 — Logger → Analyzer A/B handoff;
- #299 — shared analysis-filter storage while preserving the existing persisted key;
- #300 — saved qualification filters in Range Compare;
- #301 — P10 / Median / P90 in shared numeric comparison;
- #304 — shared Analyzer scopes in Boost;
- #305 — shared qualification filters in Boost.

## Boost Analyzer — current authoritative state

Boost has been substantially redesigned during this chat. Treat this section as authoritative over older roadmap wording.

### Core product rule

Boost analysis must distinguish the ECU control strategy first.

**Open Loop** means there is no meaningful Boost Target requirement. The useful relationship is:

> **RPM / TPS-load / operating state → wastegate command → measured pressure response**

**Closed Loop** retains the same physical context where useful, and additionally evaluates:

> **Boost Target → pressure tracking / error / attainment / overshoot / undershoot / settling**

Do not make Boost Target the foundation of Open Loop analysis.

### Explicit control modes

PR #307 added explicit **Open Loop / Closed Loop** control mode and made Open Loop the default.

Target-dependent controls/results are shown only in Closed Loop.

Closed-loop-only concepts include:

- Boost Target;
- target tracking error / MAE / RMSE;
- target attainment tolerance and percentage;
- target-relative spool landmarks;
- target-relative over/undershoot;
- closed-loop steady-state / settling concepts.

PR #302 added target-relative T10/T50/T90 spool landmarks for Closed Loop, and PR #303 added configurable target-attainment tolerance in the pressure channel's native unit.

### Open Loop physical-response analysis

PRs #308–#315 built the current Open Loop path:

- #308 — target-independent pressure-rise spool core;
- #309 — Open Loop spool UI + TPS/load as first-class context;
- #310 — peak-pressure sample context;
- #311 — RPM × TPS/load operating-point table;
- #312 — evidence quality / pressure consistency assessment;
- #313 — neighboring RPM/load trends;
- #314 — optional high-load pull quick gate;
- #315 — conservative `What this suggests` interpretation.

Open-loop pressure-rise spool uses a user-defined **start pressure → end pressure** rise in the measured pressure channel's native unit. T10/T50/T90 are first crossings through 10/50/90% of that configured pressure rise; no Boost Target is involved.

TPS/load is first-class context. Do not assume it is always percentage TPS: bin widths and quick-gate thresholds use the selected channel's native unit.

### Open Loop operating points

Qualified samples can be grouped by configurable RPM × TPS/load bins.

Each operating point can report:

- sample count;
- mean RPM;
- mean TPS/load;
- pressure mean / min / max / SD;
- upper wastegate duty mean where available;
- lower wastegate duty mean where available;
- evidence strength;
- pressure consistency;
- concise assessment;
- neighboring RPM trend;
- neighboring load trend;
- conservative `What this suggests` interpretation.

Evidence quality is intentionally descriptive. Current classification is based on sample population relative to the configured minimum plus unit-independent relative pressure variation. Mixed/transient or limited evidence should be clearly identified rather than treated as tune-worthy data.

Neighbor comparisons are suppressed where either side lacks usable evidence.

### High-load pull quick gate

PR #314 added an optional Open Loop quick gate on top of shared Qualification.

Default starting values are TPS/load ≥ 80 and RPM ≥ 2000, but **80 only makes sense as a percentage-TPS starting point**. If another load channel is selected, the user must use a threshold in that channel's native unit.

The UI exposes Saved eligible / Quick gate eligible / Final eligible separately so samples do not silently disappear.

### Matched scope comparison — PR #316

Open Loop has an optional **Compare scope** using the same shared choices as the primary scope:

- Full Log;
- Current A/B;
- Saved Range.

The same selected channels, qualification, high-load gate and RPM × TPS/load bin geometry are applied to both sides.

Only operating-point bins with trustworthy evidence on **both** sides are compared.

Matched comparison rows expose:

- Primary / Compare sample counts;
- Primary / Compare pressure;
- Δ pressure;
- Δ upper duty;
- Δ lower duty;
- observed interpretation.

Examples of valid wording include:

- `Observed duty + pressure response; repeat to confirm`;
- `Duty changed with little pressure response`;
- pressure changed while duty remained approximately similar.

If a comparison scope is selected but no trustworthy bins match, say so explicitly.

### Upper/lower chamber response summary — PR #317

Matched comparisons are also summarized separately for upper and lower wastegate control.

For a chamber to count as isolated evidence:

- selected chamber duty must change by at least **0.5 duty point**;
- opposite chamber must remain within **0.5 duty point** when its channel is available.

If the opposite-chamber channel is unavailable, count/report that case explicitly because true chamber isolation cannot be proven.

At least two usable comparisons are required before reporting a directional association.

Possible summaries include:

- higher duty accompanied higher pressure;
- higher duty accompanied lower pressure;
- duty changed with little pressure response;
- mixed observed association;
- insufficient evidence.

### Critical interpretation rule

EpicScope must **not assume wastegate plumbing/polarity**.

Do not convert an observed positive or negative duty/pressure association into an automatic instruction like `increase upper duty` or `decrease lower duty` unless a future deliberately designed, validated layer has enough evidence and explicit actuator semantics to justify it.

For now, Boost is descriptive evidence + repeatability/control-authority analysis.

### EpicEFI wastegate channel naming note

For current EpicEFI INI/runtime naming:

- `boostOutput` → **Boost: Output** — final upper/main boost-control output;
- `lwgDutyPct` → **Lower WG port output** — lower chamber output;
- `openLoopPart` → **Boost: Open loop** — open-loop contribution, not necessarily the same as final output.

Older logs may legitimately contain zero throughout `Boost: Output` and/or `Lower WG port output`. Do not infer a math bug merely because those channels are zero; verify the selected channel in Logger first.

The July 14 test log used during this chat has zero throughout the selected upper/lower final-output channels, so the Open Loop operating-point table correctly reports zero duty means for that source.

## Immediate next work — Boost automatic repeated-pull/event grouping

The next meaningful slice is **automatic repeated-pull/event grouping** so a log containing multiple comparable pulls can be separated and compared without manually creating every saved range.

Keep this conservative and build it from the existing evidence model rather than inventing another Boost definition.

Recommended sequence:

1. define a pull candidate from the existing selected TPS/load + RPM + qualification + optional high-load gate evidence;
2. require contiguous source samples and explicit minimum-duration / hysteresis or release behavior;
3. preserve source start/end indices/time, RPM/TPS/pressure and WG-duty context for each detected pull;
4. expose detected pulls as inspectable evidence before automatic comparison;
5. group/compare only pulls with overlapping trustworthy RPM × TPS/load operating regions;
6. report repeatability/spread and duty→pressure response across multiple events;
7. do not infer actuator polarity or tune direction from one comparison;
8. allow direct jump from an auto-detected pull/comparison back into Logger.

Avoid a hidden magic `boost pull` rule. Thresholds and qualification semantics must be visible and explainable through the shared `i` help convention.

After repeated-pull grouping is useful, revisit duty saturation/headroom and Closed Loop settling/controller-quality analysis. Then continue Fueling maturity using the same shared qualification/evidence infrastructure.

## Range Compare — current state

Range Compare is no longer limited to two saved ranges.

Current capabilities include:

- Full Log / Current A/B / Saved Range independently on each side;
- shared saved qualification sets;
- grouped ALL/ANY qualification;
- per-side provenance counts;
- mean/min/max/std-dev plus P10/Median/P90;
- Logger A/B contextual handoff.

Future improvements should continue using the shared comparison model rather than creating specialized parallel range comparison code.

## Histogram / Table Generator authority

Current Histogram modes:

- Table Generator;
- Distribution;
- Scatter;
- Math Channels.

Table Generator invariants:

- visible weighted statistic label is **Weighted Mean**;
- standalone Size button is removed; **Table Size** owns geometry settings;
- Auto, Custom and Loaded MSQ are geometry sources;
- **Loaded MSQ is geometry-only** and must not silently rewrite selected runtime X/Y/Z channels;
- breakpoint-node Weighted Mean behavior remains authoritative;
- presets/filters/Math Channels remain reusable analysis inputs;
- source evidence/provenance must not be silently discarded.

## Recorded-log architecture — preserve

The established MLG path remains authoritative:

- MLG v1/v2 loading, indexing and staged/deferred CRC validation;
- optional INI catalog/binding;
- optional MSQ tune enrichment;
- reusable named graph workspaces/presets;
- multi-pane fixed/freeform graph layouts;
- shared viewport/cursor/timeline;
- A/B selection, markers and saved ranges;
- exact-log persistence separated from reusable workspace state;
- session/cache/OPFS large-log architecture;
- retained-memory/runtime-health diagnostics.

### Graph preset invariant

> **Visible pane + assigned available channel = active rendered trace.**

Unavailable channels remain assigned but are not falsely activated. Out-of-layout panes preserve saved assignments but must not retain/reacquire active decoded graph traces.

## Analysis provenance rules — authoritative

Analysis must not silently discard or invent evidence. Where applicable retain/expose:

- input sample count;
- valid/invalid/stale/unavailable sample counts;
- rejected/outside-range counts;
- source sample indices;
- selected time/range scope;
- complete vs partial decoded coverage;
- explicit channel/role/filter semantics;
- explicit aggregation/event method;
- event thresholds/configuration;
- event/pull start/end evidence;
- weighted hit count/weight where relevant;
- comparison sample/population counts;
- shim delivery loss / reconnect segment provenance where applicable.

If a trace does not fully cover the requested scope, do not present the result as complete.

## Idle analyzer invariants retained

Idle distinguishes outer RPM control from inner actuator/control behavior.

Common required inputs remain RPM and Idle Target. Canonical runtime RPM matching strongly prefers `RPMValue`.

**DC Bias calibration curve/table is calibration data, not a scalar log channel.** Runtime DC Bias/feed-forward output is valid runtime evidence. Calibration-curve/current-point analysis belongs to tune/MSQ or future typed shim tune-object context.

Idle aligned evidence keeps separate Engine response and Controller/actuator panes; independently autoscaled signals are for timing/shape comparison, not absolute cross-signal magnitude comparison.

## `ts_shim` integration — implemented first pass, runtime validation paused

Read [`TS_SHIM_INTEGRATION.md`](TS_SHIM_INTEGRATION.md) and [`TS_SHIM_STATUS.md`](TS_SHIM_STATUS.md) before resuming shim work.

Current integration remains read-only and converges at `NumericChannelDataSource`; there are no live-only Analyzer implementations.

Current Pi/ECU target topology remains:

```text
Mega144H7 USB CDC
      ↓
Pi Zero 2 W
Raspberry Pi OS Lite
raw serial ↔ TCP bridge
      ↓ Wi-Fi / home LAN
Windows PC
      ↓
ts_shim.exe --upstream-tcp PI_HOST:PORT
```

The Pi only needs to expose ECU USB CDC bytes over raw TCP (planned `ser2net`). It does not need Windows or `ts_shim`.

**Do not spend active development time on this path until the USB adapter/hardware dependency clears.**

When hardware is available, resume from `TS_SHIM_STATUS.md` by confirming `/dev/ttyACM*` / stable `/dev/serial/by-id/*`, freezing the minimal raw-TCP bridge configuration, testing Windows reachability, then starting native `ts_shim.exe --upstream-tcp ...`.

## Startup instructions for the next chat

1. read `docs/HANDOFF.md` first;
2. verify current `main` and CI before changing code;
3. treat current `main` as authoritative;
4. do **not** resume the broad performance campaign unless a measured regression appears;
5. do **not** resume Pi/real-ECU shim runtime work until the user says the USB adapter/hardware is available;
6. continue browser-only Analyzer maturity, currently Boost repeated-pull/event grouping;
7. preserve shared scope / qualification / comparison / inline-help infrastructure instead of creating analyzer-local duplicates;
8. preserve the recorded MLG/INI/MSQ path, graph invariant and Table Generator MSQ geometry-only rule;
9. keep Boost interpretations evidence-based and polarity-agnostic;
10. keep Phase 5 gated on explicit owner approval.

Suggested continuation prompt:

> Read `docs/HANDOFF.md` in `PJawZK/EpicEFI-EpicScope`, verify current `main`, and continue the Boost Analyzer maturity work from automatic repeated-pull/event grouping. Keep the Pi Zero 2 W / real-ECU `ts_shim` work paused until the required USB adapter is available.

## Phase boundary

**Phases 1–4 are complete for the originally approved scope. Current active work is Web-product maturity/refinement. First-class read-only `ts_shim` integration exists but remaining real-runtime validation is intentionally paused. Phase 5 remains blocked on explicit owner approval.**
