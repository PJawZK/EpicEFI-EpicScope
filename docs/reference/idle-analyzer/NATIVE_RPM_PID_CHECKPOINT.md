# Native Idle Analyzer — RPM PID (Group C)

Branch: `ui/idle-analyzer-html-integration`. Parent: `6e4dd1bce42ecd4f3b8dff8e7f101b109a05fc1d`. Implements roadmap steps 7–9: recorded RPM PID contracts, numerical evidence and native UI. No push or main merge is included.

## Reference reconciliation and authority

The accepted HTML's RPM PID view supplies the interaction reference: RPM/target above, logged outer P/I/D and applied correction below, metrics and Diagnosis/Evidence/Next Test. Native integration reuses the current source/region/qualification owner, canonical role resolver, numeric aggregation, plot/viewport primitives and shared application chrome. Frozen HTML, parsers, workers, Logger ownership, VE, tune and ECU behavior are unchanged.

The supplied real INI declares **empty engineering units** for `idleStatus_pTerm`, `idleStatus_iTerm`, `idleStatus_dTerm` and `idleStatus_output`. Wire scaling (F32 or S16 ×0.01) is not proof of percentage-point engineering units or controller-stage semantics. Exact canonical outer-controller fields can therefore supply **raw controller values, engineering unit unspecified**. Unknown fuzzy unitless fields and contradictory engineering units are rejected. Declared `%`, `percent`, `pp` or `percentage points` are accepted as correction percentage points. Bitfields are rejected. Outer logged output suggestions exclude DC/position/applied/closed-loop fields; it is not the existing `idleClosedLoop` applied-correction role.

**Supported measurements:** per-role signed mean, RMS and coverage for P/I/D, independently logged PID output and applied correction. Headline cards show P RMS, I mean, D RMS and applied-correction mean. P/D RMS preserve opposing excursions hidden by signed means. Logged output remains a separate input; the native code never reconstructs it from P+I+D.

**Explicit reference adaptations / remaining gates:** the final HTML uses a fixed +30 threshold and a median “fade loss” based on assumptions about raw output and applied correction. These are not imported as general production facts. Native Evidence explicitly reports **Firmware limit/clamp coverage: unavailable** and **Raw-to-applied attenuation: unavailable** without runtime-associated limit, engineering-scale and controller-stage authority. D RMS and applied mean occupy the currently useful headline positions. This is not a claim that the HTML's saturation/fade capabilities are completed: **Group G (settings/tune context, steps 19–21)** must revisit those authority gates and implement justified coverage/comparison if verified, otherwise retain explicit unavailability in the final parity inventory. Do not silently substitute +30 or equate all unitless fields with pp.

No gain recommendation, automatic idle-state qualification, anti-windup diagnosis, controller cadence, clamping/fade percentage or causal improvement is inferred. A missing RPM target leaves RPM tracking unavailable but does not erase independent recorded PID terms.

## Numerical and source contract

`analyzeIdleRpmPid` consumes the existing accepted original-index selection. It does not discover regions, repeat qualification or reconstruct a controller. Shared `summarizeIdleRecordedSignal` validates exact original indices **and timestamps**, canonical RPM provenance, finite values and validity. Source arrays remain immutable. Each role reports its own input/valid/invalid/unavailable denominator. Missing or invalid observations are never interpolated, borrowed or replaced with healthy zeros. Recovered invalid attempts remain accounted for; derived nonfinite aggregates remain unavailable.

The shared scalar helper accepts explicit raw units only when called under the PID contract; default Airflow/Valve callers still reject raw engineering-unit substitution. A source's empty unit alone does not enable raw support. Unit labels distinguish missing (`unit unavailable`), incompatible (`unit unsupported`) and present raw (`engineering unit unspecified`) evidence.

All valid term/output traces sharing one left graph axis must have the same unit category (raw or pp). Mixed raw/pp terms retain independent numerical evidence but are not overlaid on one scale; Evidence explains the graph restriction. Applied correction stays on a separately labelled right pp axis. A common raw numeric scale does not establish physical calibration or control-stage equivalence. Raw focused traces can include records excluded from current analysis, as in other native modes.

## Lifecycle and reuse

- `idle-analyzer-view.ts` remains the current session/source owner. The existing Valve loading function is extended into one local **controller evidence** boundary for Valve and PID, rather than adding a second copied async/session wrapper.
- Each accepted scope result retains independent `valve` and `pid` numerical results. Mode/tab changes reuse them; PID reads/calculation remain deferred until PID is active. Only missing PID role columns are requested, in one captured batch. Applied correction reuses the existing base-context trace.
- Active mode, disposal, accepted-result identity, base generation and controller request token guard completion before calculation/cache publication. Mapping/source/scope replacement, mode departure and hidden view reject obsolete work. Editing inactive Valve settings cannot cancel or start PID work, and vice versa.
- Region scope, inclusion, purpose, qualification, Logger commands and original-index deduplication stay with existing owners. Viewed changes update scoped PID facts; changing graph focus in combined scope does not change them. Unchanged context/navigation retains accepted results.
- Whole-source column retention preserves the prior full-vs-scoped guard and merges compatible roles. Bounded current/last-loaded mappings now cover four PID roles alongside three Valve roles. The whole-source cache’s allowed ID set is at most22 during simultaneous role replacement, normally15 (RPM/target2 + base context3 + qualification3 + Valve3 + PID4); actual cached traces can be fewer. Accepted-result/plot references can overlap or keep a previous column until replacement/disposal; this is not a unique browser-heap byte estimate. Clearing/restoring the last role reuses its column; repeated remapping retires older columns. This bookkeeping never selects semantic input roles.
- No per-region full-log result registry, new worker, global event listener, MutationObserver, generic instrumentation or application framework is added. Existing owner events distinguish calculation from logical source requests. Shared controller loading does not alter the existing Valve event's valid-tracking sample count.

## Independent reference cases

Original indices40–43, times0/100/200/300ms, valid RPM1000:

| Signal | Authored values | Expected mean | Expected RMS | Unit authority |
| --- | --- | ---: | ---: | --- |
| P | −3,+3,−3,+3 | 0 | 3 | Raw, unspecified engineering unit |
| I | 1,2,3,4 | 2.5 | √7.5 | Raw, unspecified engineering unit |
| D | −4,+4,−4,+4 | 0 | 4 | Raw, unspecified engineering unit |
| Logged output | 30,30,5,5 | 17.5 | √462.5 | Raw; output stage unverified |
| Applied correction | 0,1,2,3 | 1.5 | √3.5 | pp |

These independent facts do not establish an output sum, clamp percentage or fade loss. With declared pp units the arithmetic stays the same, but physical unit labels change; controller limits/staging still remain unverified.

A P range starting at original index41 with times100/201/300ms and invalid last value gives **1 valid,1 invalid,2 unavailable** of4 selected records, while I retains its own four valid observations. Tests also cover canonical invalid RPM, qualified/disjoint/overlapping regions, empty/out-of-source selection, missing roles/output/target, incompatible and mixed units, nonfinite aggregates, duplicate/unsorted indices and input immutability.

At **320,459 continuous valid samples**, P−3 raw → RMS3, I2 raw → mean2, D4 raw → RMS4, logged output30 raw → mean30, applied5pp → mean5. Browser coverage checks original-record counts, bounded graph DOM, retained reads and same-bound viewport reuse; no sample-sized spreads are introduced.

Real private INI + canonical 2000-indexed-record MLG prefix, native mouse/keyboard production replay:

| Scope | Valid RPM records | P RMS, raw | I mean, raw | D RMS, raw | Applied mean, pp |
| --- | ---: | ---: | ---: | ---: | ---: |
| Full prefix | 1,995 | 3.09 | −1.10 | 1.08 | −0.86 |
| Viewed A,0–5s | 337 | 2.45 | −1.23 | 1.06 | −1.49 |
| Viewed B,15–20s | 434 | 2.39 | −1.01 | 1.08 | −1.09 |
| Combined A+B | 771 | 2.42 | −1.11 | 1.07 | −1.27 |

Raw values are not pp. Different graph focus within combined scope retains the same measurements. Removing P makes it unavailable without destroying I/D/applied; restoring its mapping restores its facts. These rounded observations demonstrate recorded-data/UI behavior, not matching flashed-firmware provenance or a causal tuning diagnosis.

## Validation

The final production/browser gates below passed on the implemented code.

- Focused core/role gate:35 tests /4 files passed; later role/PID authority refinement21 tests /2 files passed.
- Targeted browser:226 checks /14 result groups passed, worker/fallback configurations, before the final explicit-unavailable Evidence sections. Full gate below covers those final sections and all previous behavior.
- Final full units:1,095 tests /152 files passed, one worker.
- Final production typecheck/build:passed; existing >500kB advisory remains.
- Final full browser regression:1,577 checks /168 result groups passed, worker/fallback configurations, including the final missing-unit/unsupported-authority presentation and missing-target case.
- Final native production replay:12 action checkpoints passed with zero exceptions and390px no-overflow, on the final production build. Missing-unit labels, explicit unsupported-authority Evidence, two real regions, mode/tabs, missing/restored mapping, combined invariance and Logger navigation were exercised.
- `git diff --check`:passed before final checkpoint.

Artifacts outside Git: `/workspace/epicscope-idle-pid/{browser,native,full-browser}/`, `/workspace/epicscope-idle-pid-{unit,build,full-browser}.log`, plus final handoff. Private recording/INI bytes remain outside Git.

## Remaining work and next boundary

This closes the supported recorded-evidence slice of **Group C**, not full Idle HTML integration. Verified saturation/attenuation authority remains explicit Group G/parity follow-up. Broad layout/candidate-banner cleanup, tune context, independent B, persistence/plans and final manual acceptance remain open. Synthetic >320k samples and the real bounded prefix do not establish full1GB/hardware responsiveness.

Next: **Group D — DC Bias / Position PID (steps10–12)**: establish logged bias/inner PID/motor units and ownership, keep runtime bias separate from tune-derived expectation, implement aligned evidence and native UI without inventing limits or a matching tune. Stop for review before that group. No automatic advance, push or main merge.

## Seven-stage completion

| Stage | Status |
| --- | --- |
| 1 — Fixtures/contracts | Partial overall; outer PID units/alignment/missing/scale contracts added |
| 2 — Source/session | Primary/Viewed foundation complete; shared controller evidence lifetime covered; tune/independent-B extensions pending |
| 3 — Core analysis | Partial; Stability, Base Airflow, DC Valve Tracking and RPM PID recorded evidence working |
| 4 — Native UI | Partial; four modes and Viewed/combined workflows working; unsupported PID limit/attenuation explicitly unavailable |
| 5 — Independent B/comparison | Not started |
| 6 — Persistence/plans/Logger | Partial |
| 7 — Acceptance | Open; full-feature/manual/hardware/final audit pending |
