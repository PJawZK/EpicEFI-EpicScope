# Follow-up Group 3 — VE settings authority and analytical pin protection

Baseline: follow-up Group2 `0de80d4c2f157353f2ef0bdae9acad6ae18d60a9`. Work remains on the recovery lineage; no main merge or automatic ECU writing/Burn. Group1 remains an unconfirmed dropdown report. Timeline interaction (Group4), discovery-window opening (Group5), and evidence layout/change colors (Group6) are separate.

## Actual findings

1. Pins existed only in the shared table gesture session. `runAnalysis` and `buildVeProposal` never received them. A pinned working value could therefore be replaced by source/generated values on the next run. The before-fix controller browser regression fails in both execution modes because pinning leaves old primary analysis authoritative; the core regression also fails to exclude the node.
2. Recommended, Steady, Warm, Cruise and Boost labels all selected the same implemented rules. Only Custom changed behavior: it bypassed the four state flags. Distinct warm/cruise/boost thresholds were never implemented. The mode now exposes its real distinction as **State exclusions enabled/disabled**, retaining internal recommended/custom values. Existing CLT/TPS, operating range and stability settings remain independent; no new undocumented domain thresholds are invented.
3. Logged target, runtime VE, total correction and LTFT are context-only. The numerical target and VE baseline come from the selected MSQ tables; STFT/EGO is the separately controlled compensation source. Readiness purpose labels now distinguish Context only, Delay discovery and Fuel compensation. These mappings are not silently promoted into calculations or combined as multiple trims.
4. Changing Cell Change authority dispatched a numeric-prior change and then explicitly invalidated again. That duplicate path is removed: synchronize the prior silently, then invalidate once. The mode regressions require one session revision advance.

## Setting-to-owner map

| Controls | Current owner and effect | Verification |
|---|---|---|
| VE/target tables and four axis selectors | v2 model selection/readiness; core evidence interpolation and proposal baseline | Existing model, axis validation, numerical reference, result/source authority and replacement suites; pins retire when VE table/axes/tune authority changes |
| RPM, load and actual-mixture channels | v2 run input map; delay-aligned evidence | New controlled changes alter node weights or correction |
| Mixture scale | v2 mixture assessment and actual-channel eligibility; no implicit AFR/Lambda conversion | New mismatch blocker plus existing same-scale and mixture/model regressions |
| Full Log/A–B/saved scope | Existing Logger scope owner, analyzer scope adapter and load bounds | Existing native timeline/scope/publication suites; Group4 selection UI remains separate |
| State exclusions mode and DFCO/fuel-cut/AE/decel mappings | v2 `stateFilteredIndices`, before delayed engine alignment | New per-flag enabled/disabled/mapping-removal cases change counts and proposals |
| CLT/TPS source, min CLT, min/max TPS | v3 request-local qualification validity mask | New numerical cases and missing-source fail-closed check; cached source validity remains unchanged |
| Min/max RPM/load | v2 config to core aligned-engine range qualification | New per-bound cases reject physically out-of-range evidence |
| Stable/recovery duration | Core trailing-window stability qualification | New duration case changes eligible count; existing OLS/continuity policy remains unchanged |
| Cell Change Responsive/Normal/Conservative/Very conservative | v3 numeric priors5/20/50/100 | New monotonic shrinkage cases |
| Custom numeric prior | v2 proposal config | New20-weight case shrinks toward source versus0-weight reference |
| Minimum evidence weight | `buildVeProposal` | New high threshold classifies all four nodes weak |
| Absolute and percent change limits | `buildVeProposal`, raw candidate before prior blend | New independent small-limit cases withhold all four candidates |
| STFT/EGO source and Auto/Context only/Percent fuel applied | v2 assessment; engine-time correction alignment; proposal correction | New known10%/explicit unknown10%/off/unknown-auto cases; same-scale70×1.5 gives105, compensated gives115.5 |
| Logged target/runtime VE/total correction/LTFT | Context/readiness only | New mappings deliberately leave calculated proposal unchanged |
| Fuel command/PW | Current-log delay discovery input; not a direct VE multiplier | Existing workflow plus new two-response discovery fixture |
| Command delta, mixture response delta, search window, event spacing, minimum measured events | `analyzeAfrDelay` then `buildVeDelayTable` | Each new setting independently suppresses a two-event200ms measured recommendation |
| Working delay load/edit/activate | Existing v2 delay owner; delay-aligned evidence | Existing delay replacement/editing/alignment and stale-completion suites |
| Result View, layout, selection and display precision | Presentation owners | Existing reuse/lifetime/history suites; no numerical recalculation |
| Working VE pins | New explicit v2 semantic pin contract to existing proposal owner | New native tool/controller pin, preservation and cancellation regressions |

Not every control must alter every recording. Flags absent/unmapped/inactive, thresholds already satisfied, other filters rejecting the same samples, insufficient evidence, withheld limits or a robust median unchanged by removed observations can all leave a displayed proposal unchanged. Setup changes invalidate old analysis and require an explicit run. Discovery parameters affect the next discovery/recommendation; they do not retroactively alter an already accepted working delay table.

## Pin authority and behavior

The existing v2 VE review owner now owns a tune/table/axis-bound protected-value map and exposes `setPinned(positions)` plus pinned positions in its snapshot. The shared table session remains the gesture/decorating owner, synchronizing from that explicit contract. The existing local Pin command calls the owner; no new global listener, observer, lifecycle wrapper or generic event bus is introduced. Lambda Delay's pins retain their existing manual-edit behavior.

- Pin/unpin is a semantic change: invalidate old primary/proposal/detail/completion and advance existing cancellation generations, without loading traces or automatically rerunning. Duplicate/invalid requests are non-destructive.
- Pin changes retain all currently displayed working review values. Subsequent analysis preserves each pinned working value, including an explicit blank. A deliberate direct edit may still change a pinned value and becomes its next protected value.
- Pin/unpin uses the existing semantic revision boundary, so previous review Undo/Redo history retires even though working values are retained. Fresh edits establish new history; pins themselves are not a value-edit Undo transaction.
- `buildVeProposal` receives a run-local copy of pinned indices. Those nodes receive explicit **pinned** state and no candidate/proposed/change values. They count separately, rather than falsely appearing as weak/no evidence/withheld by limits. Summary/status and Cell Evidence describe their exclusion.
- Real evidence is retained for inspection. A sample may contribute to both a protected node and an unprotected neighbor; pinning a node does not throw away that sample for its neighbors. This is exclusion from generated updates, not fabricated absence of evidence or a promise to skip full-log evidence computation.
- Pins survive Result Views, navigation and source/scope changes while the accepted tune/table/axes remain the same. Replacing the tune model or changing VE table/axis authority retires them. Pins remain session-local; reload persistence is not added.
- Existing async generation checks reject completions after pin/settings changes. A synchronous tune replacement triggered by primary invalidation cannot inherit retained review values from the retired tune.

## Numerical references and retained limits

The settings fixture uses60 valid100ms observations, a100ms delay and uniform operating point at the midpoint of four VE nodes. Without other qualification,59 observations contribute. The first40 have actual AFR21 and a state flag; the final20 have AFR14. Target14 and source VE70 yield a weighted median ratio1.5 and unshrunk proposal105. Enabling one flagged exclusion leaves20 on-target observations and proposal70. CLT/TPS qualification independently masks input ranges and therefore also affects engine-point delay availability; their counts need not equal state-only filtering.

No change is made to observation-time versus engine-event-time state exclusion (B02), OLS stability across excursions/gaps (R28/R29), one delay refinement, raw-limit ordering, quantile conventions, or delay millisecond snapping. Follow-up Group2's target-before-strength clamp remains intact. These policy limitations remain explicit rather than being silently declared fixed.

## Validation / stop

Before-fix failures, focused results, final gate logs, production smoke, exact commit and handoff are stored in `/workspace/epicscope-v50-followup-group3/`. New browser checks run in both staged and Worker-disabled modes through actual production controllers, with semantic snapshots rather than parsing labels as analytical input. Synthetic traces/tables establish controlled effects, not original1.2GB MLG performance or human acceptance. Stop after this group; no automatic publish, main merge or Group4 implementation.

Final results: build/typecheck passed (existing bundle advisory);956 unit tests/138 files passed;1,350 Chromium checks/148 result groups passed (675 per mode, including42 settings and7 pin cases per mode). All18 production-bundle smoke checks passed, including native pointer/keyboard interpolation and native pinning that preserves edited200 through Run Analysis in both modes. Production screenshot inspected. Source hashes and git diff --check passed. The initial full-gate failure used a retired cell node after pin invalidation; the visual regression now reacquires the current cell while preserving selection, pin symbol, exact geometry, working value, one revision and no-read assertions. No skipped tests or relaxed existing timeouts.
