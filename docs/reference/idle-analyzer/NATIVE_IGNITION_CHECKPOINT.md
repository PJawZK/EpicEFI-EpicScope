# Native Idle Analyzer — Ignition (Group E)

Branch: `ui/idle-analyzer-html-integration`. Parent: `a23f52955ca7f3f0300a4129411b8db2a25cbceb`. Implements recorded-data contracts, core and native UI for roadmap steps 13–15. No push or main merge is included.

## Working reference parity

Ignition is the sixth native mode. Four cards show mean logged advance, mean signed idle correction, retained RPM tracking RMSE and mean actual lambda. Upper graphs retain RPM/target; the lower graph shows the two independent recorded angular signals on a degree scale. Diagnosis, Evidence and Next Test use the existing source-bound scope, qualification and retained result. Shared EpicScope shell, region management, Logger callbacks and graph interaction remain owned by their existing components. No standalone HTML, framework, global listeners, observers or additional workers were added.

Absolute advance is not reconstructed from base timing plus correction. Correction signs remain as recorded. A selected cylinder is not an engine-wide average. Generic degrees do not independently establish BTDC convention or physical spark delivery. No torque estimate, causal tuning diagnosis, gain recommendation, verified controller limit or ECU/tune write is introduced.

## Source and numerical authority

Automatic advance selection prefers `correctedIgnitionAdvance` / `Timing: ignition`; signed idle correction prefers `timingPidCorrection` / `Idle: Timing adjustment`. Base tables, per-cylinder adjustments, unrelated compensations and calibration fields cannot displace these automatic defaults. Explicit compatible mappings remain possible and identified.

Plain degree units are supported; absolute advance additionally accepts explicitly declared BTDC degrees. Signed correction does not accept a BTDC coordinate unit. Radians, ATDC, time units and unknown fuzzy unitless fields are unavailable, with no sign or unit conversion. Exact verified canonical fields retain their fallback authority; contradictory declared units and bitfields are rejected. Evidence includes the original declared unit.

Actual lambda reuses existing actual-mixture eligibility and source priority; targets, errors and AFR do not become lambda. A temporary metadata adapter recognizes the Greek lambda unit without changing global VE policies. No assumed stoichiometry or AFR conversion is added. Nonpositive/nonfinite lambda is invalid supporting evidence, not a healthy zero, and does not remove otherwise valid RPM or angle evidence.

`aggregateIdleAlignedSignal` and `idleRecordedMetricFromStatistics` extract the existing common alignment/statistics path without changing existing recorded-signal unit policies. Exact original indices, timestamps and validity determine independent denominators. Missing/misaligned samples remain unavailable; invalid samples remain invalid. Input columns are not mutated. Each role's counts and units are reported. Missing target does not erase independent angle facts. Lambda presentation uses three decimals; angles use two.

## Lifecycle and repeated work

The existing view's mode-evidence boundary owns lazy Ignition loading and the retained projection. Source/scope/qualification and mapping changes invalidate semantic evidence; tabs, graph focus under combined scope and navigation reuse accepted facts. Active/disposed state, base result identity, generation and request tokens reject stale publication. Hidden modes do not initiate this calculation, and inactive controller setting changes do not cancel it.

Current and last-loaded Ignition mappings join the existing bounded trace retention policy: normally 22 allowed IDs, at most 36 during replacement. These are cache eligibility bounds, not unique process heap measurements; plot/result references can overlap or temporarily retain previous columns. Existing Valve/Bias shared position evidence remains shared. No new source store or recording copy is introduced.

## Independent numerical reference cases

Four exact records at original indices 40–43 and times 0/100/200/300 ms:

| Input / metric | Reference |
| --- | --- |
| RPM 900/1000/1100/1300; target 1000 | RMSE sqrt(27500) = 165.8312 RPM |
| Advance 10/14/18/22 degrees | Mean 16 degrees; RMS sqrt(276) |
| Correction −4/−2/+2/+4 degrees | Mean 0; mean absolute 3; RMS sqrt(10) |
| Lambda .9/1/1.1/1 | Mean 1; RMS sqrt(1.005) |
| Selected union indices 40 and 43 | Advance 16; correction 0; lambda .95 |

A shifted correction channel with one timestamp mismatch and one invalid sample yields 1 valid, 1 invalid and 2 unavailable, mean −2; independent advance/lambda retain four valid samples. Lambda 0/−1/NaN/1.1 yields one valid and three invalid, mean 1.1, without changing RPM/angle eligibility. Empty, missing and out-of-source cases are explicit. A 320,459-sample continuous valid case preserves exact counts and means (16 degrees, −2 degrees, lambda 1.010), with bounded graph rendering and no sample-sized spreads.

No intentional mathematical difference from the accepted mean/RMS contracts is introduced. Supporting evidence is descriptive, not proof of combustion quality or spark torque.

## Real-file browser replay

Production preview used the private canonical INI and 2,000-record MLG prefix. Defaults resolved to `correctedIgnitionAdvance`, `timingPidCorrection` and `lambdaValue`.

| Scope | Mean advance | Signed correction | Actual lambda | RPM RMSE |
| --- | ---: | ---: | ---: | ---: |
| Full prefix | 16.00° | 0.00° | .943 | 18.76 |
| Viewed A, 0–5 s | 16.00° | 0.00° | .931 | 15.16 |
| Viewed B, 15–20 s | 16.00° | 0.00° | .951 | 14.00 |
| Combined A+B | 16.00° | 0.00° | .942 | 14.52 |

Identical recorded angles across these intervals are real source values; changing lambda and RPM metrics confirms scope changes without inventing angular variation. Fourteen native checkpoints covered tabs, mode round-trips, missing/restored correction and lambda, combined focus invariance, Logger navigation and 390px layout. Desktop screenshots show retained shared shell, four cards and two graphs. No browser exceptions or narrow horizontal overflow were observed.

## Validation and remaining boundary

- Focused unit gate: 44 tests / 5 files passed.
- Full unit gate: 1,111 tests / 154 files passed.
- Targeted worker/fallback browser gate: 254 checks / 14 groups passed.
- Production build passed; existing >500 kB bundle advisory remains.
- Real-file production browser replay: 14 action checkpoints passed.
- Full browser gate: 1,605 checks passed across staged and fallback configurations (168 result groups).

Local artifacts: `/workspace/epicscope-idle-ignition/` (targeted browser, native screenshots/report and full browser results); logs use `/workspace/epicscope-idle-ignition-*.log`. Private input bytes are not committed. Synthetic 320k coverage and the private prefix do not establish full-1GB or hardware performance. Original unavailable recordings, matching tune/firmware provenance and manual acceptance remain unavailable/open.

Next is Group F, Recovery (steps 16–18): implement onset, gap/validity/region boundaries, confirmed dwell, censoring and overlap-safe event identity before exposing results. Legacy sag/recovery outputs are not accepted substitutes. Group G retains tune/limits/actuator authority work. Broad optimization, decluttering and shared in-app tutorial/help remain later work. Stop for review here.
