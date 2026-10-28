# Native Idle Analyzer — DC Bias / Position PID (Group D)

Branch: `ui/idle-analyzer-html-integration`. Parent: `e13f5a897ee32f48b408acde05a0632c164301cd`. Implements the recorded-data contracts, core and native UI of roadmap steps10–12. No push or main merge is included.

## Accepted-reference reconciliation

The fifth native mode is **DC Bias / Position PID**. It preserves the reference's requested/measured upper graph, lower feed-forward/inner P/I/D/motor traces, four metric cards and Diagnosis/Evidence/Next Test workflows. It reuses the shared application shell, channel/source interfaces, managed scopes, qualification, numerical aggregation and graph/viewport primitives. Existing Idle Control Diagnostics remains available; its algorithms/entry are unchanged, while the shared motor-role priority changes as described below. Other Analyzer domains, parsers, workers, VE and ECU/MSQ writing remain unchanged.

The HTML's “Derived bias” is replaced in the working recorded-data slice by **Logged feed-forward mean**, with its recorded source/units identified. A logged value is not an MSQ curve reconstruction. **Tune-derived DC bias remains explicitly unavailable** until Group G establishes accepted matching tune/firmware geometry and association. Do not silently replace that later feature with the logged mean. Firmware saturation/limits and feed-forward actuator assignment also have explicit authority gates; no synthetic curve, limit, controller mode or causal tuning evidence is imported.

## Signal/unit audit and changed motor authority

The supplied INI declares no engineering units for inner `dcIdlePositionStatus_pTerm/iTerm/dTerm` or `etb1etbFeedForward`. These exact canonical fields may be shown as **raw, engineering unit unspecified**. Declared `%`/`percent` effort and `pp`/`percentage points` contributions retain their distinct labels; neither becomes valve travel. Unknown fuzzy unitless fields, incompatible units and bitfields are rejected. Inner terms are kept separate from outer RPM PID. Calibration bins/values and feed-forward tuning/status fields are not runtime bias suggestions.

`etbFeedForward` and `etb1etbFeedForward` are shared runtime feed-forward fields. Their presence does **not** prove DC idle-valve mode or actuator assignment. Source name, raw-unit authority and that limitation are visible in Evidence/assessment. No automatic ETB2 raw fallback, table interpolation or matching flashed tune is invented.

**Motor-source correctness change:** the actual INI declares `dcIdleDutyCycle` (`DC idle valve H-bridge duty`) in `%` at scale0.005. `dcIdlePositionStatus_output` is a different, unitless PID debug field. Automatic selection now prefers the dedicated H-bridge channel, and a unitless debug output is no longer granted inferred motor-percent authority. An explicitly declared percent source can still be manually mapped; existing valid explicit mappings remain user choices. With no unit-verified motor mapping, motor evidence is unavailable rather than zero. This correction applies to Valve Tracking as well as the new mode.

In the real15–20s interval, the dedicated duty mean is **+26.12%**; the previously used debug output mean was−0.45 under the old inferred-percent mapping. These are different recorded signals, not a sign convention or algorithmic improvement. Historical checkpoint figures describe their historical mapping; do not compare them as the same motor measurement. Position tracking RMSE remains1.81pp.

## Core mathematics and ownership

- `analyzeIdleValvePosition` extracts the existing aligned requested/measured/motor summaries and measured−requested error, preserving its original sample grid and invalid gaps. No numerical formula changes.
- `withIdleMotorReference` counts an explicit absolute-duty reference using the captured position input; it shares position statistics/error arrays instead of repeating pairing/aggregation. The existing standalone `analyzeIdleValveTracking` API remains supported and produces the same facts for the same inputs.
- The accepted view result owns one semantic position result, keyed by accepted source/scope/qualification plus requested/measured/motor mappings. Valve and Bias consume that same object. The numeric input envelope aliases immutable source columns/selection; it is not a second copy of the recording or a new source store.
- `analyzeIdlePositionPid` uses that position result's captured RPM/selection for feed-forward and inner P/I/D. Each role has independent exact-index **and timestamp** alignment, finite-valid source gating and input/valid/invalid/unavailable counts. Invalid recovered attempts stay accounted for. No interpolation, dense reindexing, scope rediscovery or repeated qualification is introduced.
- Inner scalar means, magnitudes and RMS use the existing aggregation engine. No assumption equates motor output with bias+P+I+D, a signed integral mean with tuning error, or raw values with duty/position engineering units. Nonfinite derived measurements stay unavailable.
- Only available left-side signals with one common unit category share the term axis. Mixed units keep individual scalar evidence but are not overlaid. Motor duty has a separate right-percent axis; requested/measured position stays above. Raw focused plots can include analysis-excluded records, as in existing modes.

### Lifecycle, retention and work reuse

The existing local controller-evidence boundary now serves Valve, outer PID and Bias. Bias loads only its missing channels when active, in one captured batch. Valve's three position/motor mappings are shared controls, not duplicated Bias authority. Mapping/source/scope changes, mode departure, hiding and disposal reject stale completions before calculation or cache publication. Inactive outer PID settings or the unused Valve motor reference cannot cancel/start Bias work.

A true shared-position mapping change invalidates both Valve and Bias; an inner term/feed-forward mapping change invalidates only Bias. A Valve reference change updates only its reference count, retaining position evidence. Browser testing found that the preceding reference path cleared the graph and reset zoom; the existing controller now preserves a valid position plot during reference-only updates, including the invalid-reference error state. Source/scope changes still withdraw obsolete data normally.

Modes/tabs and unchanged navigation retain accepted results. Full-source cache publication keeps the prior whole-vs-scoped guard, merges compatible roles and retires old remapped columns. Its allowed ID set is at most30 during replacement, normally19: RPM/target2 + base context3 + qualification3 + Valve3 + outer PID4 + Bias4, plus last-loaded controller mappings during replacement. Actual columns can be fewer. Accepted/chart references may overlap or keep a previous column until replacement/disposal; these are not unique browser-heap estimates.

No per-region full-log cache, global listener, observer, generic lifecycle wrapper, new framework or worker layer is added. Existing owner evidence records shared position requests so tests can distinguish one pairing pass from source reads and mode-specific term/reference calculation. Existing core/Logger storage behavior is preserved. Broad profiling/optimization remains deferred.

## Independent reference cases

Original indices40–43; times0/100/200/300ms; RPM1000 valid throughout:

| Evidence | Authored values | Expected facts |
| --- | --- | --- |
| Requested/measured position | `[10,20,30,40]` / `[12,18,36,40]`% | Error `[2,−2,6,0]`pp; signed mean1.5pp; RMSE√11≈3.31662479pp |
| Signed motor duty | `[−95,95,94,−100]`% | Signed mean−1.5%; ≥95% absolute reference3/4=75%; ≥100%1/4=25% |
| Logged feed-forward | `[10,14,18,22]` raw | Mean16, no tune expectation inferred |
| Inner P | `[−2,2,−2,2]` raw | Signed mean0; RMS2 |
| Inner I | `[−3,−1,1,3]` raw | Signed mean0; RMS√5 |
| Inner D | `[−4,4,−4,4]` raw | Signed mean0; RMS4 |

A shifted I range starting at index41 with times100/201/300ms and invalid last record yields1 valid,1 invalid,2 unavailable of4 selected samples; its mean is−1. Other roles keep independent denominators. Tests cover invalid RPM, qualified/overlapping/disjoint scopes, missing feedback/motor/terms/feed-forward, conflicting/mixed units, empty/outside selection and nonfinite aggregates without mutating input arrays.

At **320,459 continuous valid samples**, requested20/measured22% yield mean/RMSE error2pp, motor−95% yields100% reference coverage at95%, logged feed10 raw and inner I3 raw retain exact sample counts. Valve reference decoration shares the error/statistics objects, and browser mode/reference/tab/navigation cases prove one position request, no redundant logical trace loads and bounded graph DOM with retained viewport.

## Real-file browser observations

Production build, native mouse/keyboard input, supplied private INI plus canonical2000-indexed-record MLG prefix:

| Scope | Valid RPM | Inner I mean, raw | Logged feed-forward mean, raw | Dedicated motor duty mean,% | Position RMSE,pp |
| --- | ---: | ---: | ---: | ---: | ---: |
| Full prefix | 1,995 | 0.24 | 25.78 | 25.60 | 1.92 |
| Viewed A,0–5s | 337 | 0.66 | 24.70 | 25.08 | 1.82 |
| Viewed B,15–20s | 434 | 0.02 | 26.04 | 26.12 | 1.81 |
| Combined A+B | 771 | 0.30 | 25.45 | 25.67 | 1.81 |

Recorded feed-forward source: `etb1etbFeedForward`, raw unit unspecified, actuator assignment unverified. Motor source: dedicated `dcIdleDutyCycle` / `DC idle valve H-bridge duty`, declared%. These rounded observations demonstrate source/UI behavior, not firmware/tune association or successful tuning. Native replay exercises both regions, modes/tabs, missing/restored inner I, explicit gates, combined focus invariance, Logger navigation and390px layout. Source bytes remain outside Git.

## Validation

- Focused core/roles:36 tests /4 files passed.
- Final targeted browser:240 checks /14 result groups passed in worker/fallback configurations, including the motor-source correction and reference-viewport regression.
- Production typecheck/build:passed; existing >500kB advisory remains. The first build caught an `ArrayLike` iteration typing error in the new test; it was corrected with `Array.from` before the successful native replay.
- Native production replay:13 checkpoints passed, zero exceptions and390px no horizontal overflow. Desktop screenshot inspected against the accepted graph structure and explicit source/unit labels.
- Final full units:1,103 tests /153 files passed, one worker.
- Final full browser:1,591 checks /168 result groups passed, worker/fallback configurations.
- `git diff --check`:passed before final commit.

Artifacts outside Git: `/workspace/epicscope-idle-bias/{browser,native,full-browser}/`, `/workspace/epicscope-idle-bias-{unit,build,full-browser}.log`, plus the final handoff. The initially reproduced viewport failure is preserved separately in `/workspace/epicscope-idle-bias/initial-reference-viewport-failure/`; final browser summaries report the corrected pass. No private fixture bytes are committed.

## Remaining boundaries and next group

This closes Group D's **recorded-data** integration, not full HTML completion. Group G must revisit actual matching tune/firmware bias geometry, actuator association and motor limits; final parity inventory must keep every unsupported capability explicit. Steady-state/direction grouping, verified calibration/controller cadence, causal tuning conclusions, independent B, persistence/plans, broad decluttering and final manual acceptance remain open. No full1GB/hardware responsiveness claim follows from a synthetic sample count or real bounded prefix.

Next: **Group E — Ignition (steps13–15)**: verify absolute advance versus signed idle correction, degree/unit authority and recorded operating context; add aligned calculations and native UI without inventing torque or causal benefit. Stop for review before that group. No automatic push or merge.

## Seven-stage completion

| Stage | Status |
| --- | --- |
| 1 — Fixtures/contracts | Partial overall; inner PID/feed-forward/shared-position/source-unit tests added |
| 2 — Source/session | Primary/Viewed foundation complete; shared controller/position ownership covered; tune/independent-B extensions pending |
| 3 — Core analysis | Partial; five recorded-evidence modes working |
| 4 — Native UI | Partial; five modes and Viewed/combined working; unsupported tune/limit/actuator claims explicit |
| 5 — Independent B/comparison | Not started |
| 6 — Persistence/plans/Logger | Partial |
| 7 — Acceptance | Open; full-feature/manual/hardware/final audit pending |
