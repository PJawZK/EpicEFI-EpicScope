# Native Idle Analyzer — DC Valve Tracking (Group B)

Branch: `ui/idle-analyzer-html-integration`. Parent checkpoint: `882b6b7092fc61d1d282c82771909e83cc8f2777`. Closes roadmap steps 4–6: signal/unit contract, numerical analysis and native valve UI. No push or merge is included.

## Scope and reference reconciliation

The accepted HTML's DC Valve Tracking mode supplies the interaction reference: requested/measured position on the upper graph, position error and signed motor duty on separate lower axes, four headline measurements, recorded evidence and next-test guidance. Native integration reuses the existing application shell, Idle managed regions/qualification, Logger source interface, role resolver, numerical aggregation and viewport/envelope/sample-lookup primitives. Standalone HTML bytes are unchanged.

The existing `idle-control-diagnostics.ts` tracking calculation uses original indices but does not gate exact timestamps. It remains unchanged for its existing owner; it is not relabelled as accepted native tracking. The new native calculation supplies the missing source/time/validity contract without changing legacy diagnostics, parsers, workers, VE, tune or ECU behavior.

**Deliberate mathematical difference:** error is **measured − requested**, in percentage points, consistent with production tracking/Stability conventions. The frozen HTML's final valve mode uses requested − measured. Signed mean and error trace reverse sign relative to that HTML; RMSE and absolute magnitude do not. Both native labels and tests state the sign explicitly. Prototype population weighting, cadence, response-time and saturation assumptions are not imported.

## Signal and numerical contract

| Evidence | Native authority / contract |
| --- | --- |
| Requested valve position | Existing `dcTarget` role (`dcIdleTarget`); source/catalog `%` or `percent`, or verified exact canonical role where source units are absent |
| Measured valve position | Existing `dcPosition` role (`IdlePosition`, plus canonical `idlePositionSensor`); same position-percent unit policy |
| Signed motor duty | Existing `dcOutput` role (`dcIdlePositionStatus_output`); percent duty, signed values retained |
| Position error | Same original source index **and exact timestamp** in RPM/requested/measured; all required measurements valid and finite; measured − requested, pp |
| Motor reference | Explicit editable 95% default, valid `0 < reference ≤ 100`; count `abs(duty) ≥ reference`, inclusive, divided by valid aligned motor records only. This is a user reference, not firmware saturation evidence |
| Selection | Existing accepted Stability original-index selection, including scoped invalid provenance; qualification and region-union deduplication are applied once by that existing owner |

Automatic measured-position suggestion now excludes base/current/final/request, raw voltage, stepper, controller status and term fields. A request is not measured feedback. Unknown fuzzy names with absent units and contradictory units are not granted engineering units. Manual channel selection remains an explicit user mapping, with labels/provenance available in Evidence.

Each scalar and paired metric reports its own input/valid/invalid/unavailable counts. Missing roles and incompatible units remain explicit; missing motor does not destroy valid position tracking. Missing index/timestamp alignment is unavailable, not borrowed/interpolated. Invalid source measurements remain invalid, including recovered retry attempts. Derived overflow is unusable/nonfinite evidence and is never a healthy zero. Inputs are not mutated. Statistics are equal-sample-weighted, not time weighted; no interpolation bridges gaps.

## Native behavior and ownership

- **Mode → DC Valve Tracking** is the third native mode. Cards show tracking RMSE, signed mean measured−requested error, signed motor mean and reference coverage.
- The existing channel setup contains the three mappings and motor reference. Diagnosis/Evidence/Next Test use retained facts, qualification and declared purpose. Full Log, Logger A/B, saved/manual, Viewed and combined scopes remain owned by the existing session.
- Upper traces show requested/measured position. Lower error uses the left pp axis; signed motor duty uses the right percent axis. Axes, tooltip units and trace labels are explicit. The shared plot retains its Logger-style viewport, dense/raw envelope, hover, pan, zoom and legend interactions; same-bound mode transitions preserve an existing viewport where data remains available.
- Raw focused position/motor traces can show measurements excluded from analysis. The derived error trace intentionally contains accepted selection samples only; it does not invent full-log error evidence when the current analysis is a disjoint/qualified subset.
- Valve columns load lazily on mode entry, in one captured batch of missing channels. Stability/Base Airflow do not start valve reads or calculations while it is inactive.
- The existing accepted result owns one retained valve result and error trace. Modes/tabs reuse it; different scope/mapping/reference changes invalidate only the appropriate result. Changing the reference reuses raw columns but performs scoped CPU calculation, not file I/O. There is no per-region registry of full arrays.
- Late reads check active mode, disposal, accepted-result identity, existing base generation and a valve request token before calculation or cache publication. Changing mapping/source/scope, leaving the mode, hiding the Analyzer or disposing it cannot accept an obsolete completion. Failures remain in the valve assessment, with Run Analysis available to retry.
- Whole-source column retention stays at the existing view owner. Only whole-source requested/verified evidence is published there; a scoped accepted trace cannot be promoted by its `complete` flag. New base columns merge with compatible retained valve columns instead of silently dropping them. Retention is bounded to current RPM/target/context/qualification mappings, current valve mappings and one last-loaded mapping per valve role (at most 14 channel IDs during replacement, normally at most 11). Repeated manual remapping retires older columns; clearing/restoring a last-loaded role still reuses it. This bookkeeping never selects an analysis channel. Source/catalog/evidence keys still retire incompatible columns.

### Shared code rather than duplicate processing

`core/analysis/idle-recorded-signal.ts` extracts the existing Base Airflow selection validation and exact-index/time scalar aggregation, without changing its numerical rules. Base Airflow and Valve Tracking share it and production `aggregateNumericSamples`. `idle-recorded-presentation.ts` shares constant-size value/coverage projection. Existing Airflow exports remain compatible. Valve pairing and magnitude-reference counting are mode-specific; no generic framework or global lifecycle/listener layer was added.

The accepted error trace uses arrays on the retained RPM grid, preserving source indices and invalid gaps. This is one accepted-result allocation, not one full array per region. Scope/mapping/reference changes may still perform linear CPU passes; broad optimization and worker moves remain deferred without profiling evidence. No additional global listeners or observers were introduced.

## Independent numerical cases

Synthetic original indices 40–43, times 0/100/200/300 ms, valid RPM 1000 throughout:

- Requested `[10,20,30,40]`%; measured `[12,18,36,40]`%.
- Error `[2,−2,6,0]` pp: signed mean **1.5 pp**, mean absolute **2.5 pp**, RMSE **√11 = 3.31662479… pp**, extrema −2/+6 pp.
- Motor `[-95,95,94,-100]`%: signed mean **−1.5%**, inclusive absolute-duty coverage at 95% is **3/4 = 75%**; at 100% it is **1/4 = 25%**. Tracking facts stay unchanged.
- A shifted measured array starting at index41 with times `[100,201,300]`, last sample invalid, yields **1 valid, 1 invalid, 2 unavailable** paired records, signed error −2 pp. Motor retains its independent four valid records.
- Qualified/disjoint/overlapping regions, invalid RPM, absent feedback/motor, incompatible units, empty/out-of-source selection, nonfinite inputs/overflow and duplicate/unsorted indices have executable cases.
- **320,459** aligned valid samples: requested20%, measured22%, motor−95%; error mean/RMSE2 pp, motor reference coverage100%, original grid retained, no sample-sized spread.

Real private INI + 2000-indexed-record MLG prefix, native mouse/keyboard production-build replay:

| Scope | Valid RPM records | Tracking RMSE, pp | Mean measured−requested, pp | Mean signed motor, % | Absolute motor ≥95% |
| --- | ---: | ---: | ---: | ---: | ---: |
| Full prefix | 1,995 | 1.92 | +0.21 | −0.35 | 0.0% |
| Viewed A, 0–5 s | 337 | 1.82 | +0.21 | +0.14 | 0.0% |
| Viewed B, 15–20 s | 434 | 1.81 | +0.09 | −0.45 | 0.0% |

B at the 1% motor reference yields **81.8%** coverage while RMSE remains1.81 pp. Combined A+B retains771 valid RPM records,1.81 pp RMSE,+0.14 pp mean error,−0.19% signed motor mean and82.4% at the1% reference, regardless of graph focus. These rounded observations demonstrate source/UI behavior, not a firmware tuning diagnosis. Exact per-role denominators remain in Evidence; invalid retries can make the assessment limited despite complete requested coverage.

## Validation and artifacts

Validation results and remaining gates are recorded below.

- Focused units: 30 tests / 4 files passed (valve, Airflow, Airflow presentation, channel roles).
- Final targeted browser: 214 checks / 14 result groups passed in worker/fallback configurations, including dual axes, lazy reads/result reuse, qualification/scope, stale mapping/source/hidden completions, partial-vs-full cache regression, bounded repeated remapping and >320k rendering.
- Full units: 1,087 tests / 151 files passed, one worker.
- Final production typecheck/build: passed; existing >500kB chunk-size advisory remains.
- Final full browser regression: 1,565 checks / 168 result groups passed, worker/fallback configurations, on final bounded-retention code. Earlier pre-bound pass: 1,563 checks.
- Native production replay: 11 action checkpoints passed with the real INI/MLG prefix, mode/tabs, regions, motor reference, combined invariance, Logger navigation and390px no-overflow; zero browser exceptions. This replay used the final production build after bounded-retention correction.
- `git diff --check`: passed before final commit.

Artifacts remain outside Git: `/workspace/epicscope-idle-valve/{browser,native,full-browser,full-browser-final}/`, `/workspace/epicscope-idle-valve-{unit,build,full-browser,full-browser-final}.log`. Private input bytes are not committed.

## Remaining limits / next boundary

No full1GB/hardware responsiveness claim. No automatic idle-state, controller-update cadence, latency, steady/moving-state classification, step t63, oscillation frequency, firmware saturation limit, tune correctness or causal fault is inferred. Their absence is explicit rather than substituting synthetic/prototype evidence. Broad clutter/candidate banner cleanup remains deferred to the complete feature inventory. This mode is read-only; no MSQ/ECU editing is added.

Next is **Group C — RPM PID (steps 7–9)**: distinguish raw logged P/I/D from applied/clamped/faded correction; establish unit and limit authority before calculation and UI. Reuse the current source/session and aggregation owners. Stop here for review; do not start Group C automatically.

## Seven-stage completion

| Stage | Status |
| --- | --- |
| 1 — Fixtures/contracts | Partial overall; DC tracking units/alignment/sign/count/scale cases added |
| 2 — Source/session | Primary source and Viewed foundation complete; lazy valve evidence lifetime covered; tune/independent-B extensions pending |
| 3 — Core analysis | Partial; Stability, Base Airflow and DC Valve Tracking working |
| 4 — Native UI | Partial; three native modes plus Viewed/combined workflow working |
| 5 — Independent B/comparison | Not started |
| 6 — Persistence/plans/Logger | Partial; source-authoritative Logger handoff/navigation working |
| 7 — Acceptance | Open; full-feature/manual/hardware/final audit pending |
