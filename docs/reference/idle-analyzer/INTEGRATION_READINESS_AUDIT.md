# Idle Analyzer integration-readiness assessment

Assessment date: 2026-10-26. This is a documentation-only assessment, not authorization to port or merge the analyzer.

## Audited authority and verdict

- Workstream: `ui/idle-analyzer-html-integration`, audited starting commit `1717d28305b52a921db09141de37aca5d02e462e`.
- Production baseline: `main` at `702c880a29baa28b762ac26f7f7ed55ef01239ef`. Production application, core, tests, dependencies and workflows on the workstream were identical to this main baseline.
- Latest UI reference: [v3.5.10](Idle_Analyzer_v3_5_10_Comparison_Session.html). Versions 3.5.6–3.5.9 and [the previous audit](READINESS_AUDIT_v3_5_6.md) were compared; historical browser claims were not treated as newly reproduced results.
- Verdict: **ready to specify a staged native integration; not ready for a direct HTML/JavaScript port or analytical acceptance**. Preserve the compact mode workspace, linked evidence, distinct source timelines and cautious conclusions. Replace prototype source/state authority with the existing production owners.

The full classification is in [the coverage matrix](FUNCTIONAL_COVERAGE_MATRIX.md), owner/contracts decisions in [source reconciliation](SOURCE_AUTHORITY_RECONCILIATION.md), and acceptance stages in [the implementation plan](INTEGRATION_IMPLEMENTATION_PLAN.md).

No production code or HTML snapshot was changed. No ECU, firmware, write, Burn, main merge or deployment work belongs to this pass. Performance optimization remains on hold; scale hazards below are integration acceptance requirements, not an optimization implementation.

## Method and evidence boundary

An isolated Chromium **154.0.8037.57**, Debian, headless, served the original latest HTML unchanged over local HTTP. Desktop 1440×1000 and narrow 390×844 were exercised. Browser evaluation, CDP pointer/keyboard/file input and screenshots were used; no application listeners, observers or retained instrumentation were added. A temporary, restored `URL.createObjectURL` substitution captured a test-plan Blob for round-trip validation. Controlled input objects exercised delayed competing file reads. Those are test-harness interventions, not normal user actions or production fixes.

Available sources:

| Source | What was actually available and tested | Limit |
|---|---|---|
| October 20 embedded primary | 41,164 decoded rows; metadata 41,298 original rows, 132 CRC exclusions, two time-order exclusions; all eight modes | Embedded transformed data, not independently re-decoded original MLG; embedded MSQ references are not flashed-tune proof |
| October 25 user MLG | A bounded prefix of the existing file, header plus 2,000 complete 6,929-byte blocks, 14,849,557 bytes | Partial real fixture for import/authority tests, not an independent full-recording or before/after tuning experiment |
| September 30 MLG | Historical audit/README results inspected | Original unavailable for fresh replay in this pass |
| Matching October 19/20 original MSQ, INI and firmware | Embedded values and historical claims inspected | Exact matching files/build and provenance unavailable for independent source validation |
| Controlled numeric/File fixtures | Edge cases below | Mathematical/ownership tests, not claims about real ECU behavior |

The prefix was created outside Git without changing the original file. Its SHA-256 is `3cffa88ede6e41fa440fcce96f412e51ea02b9e21d4ad12f52d96679ad1c0d15`. First record offset: 991,557; payload length: 6,924; block length: 6,929. The two parsers were compared on the same bytes.

Evidence keys used throughout these documents:

| Key | Reproduced result |
|---|---|
| E1 | Initial source decode and 8 modes × Diagnosis/Evidence/Next Test; canvas and metric content present; no initial application exception |
| E2 | Same-region comparison blocked; distinct condition comparison accepted; all five lower trace groups respond; normalized alignment applies; event option gated by recovery evidence |
| E3 | A/B ArrowRight changes each selected interval independently, retains keyboard focus and region count; CDP Alt-click moves A; moved labels retain old hard-coded time text |
| E4 | Run Analysis and summary render; enable/exclude all and a 200–205 s raised-RPM manual region work; qualification and scope panels open; all four Advanced panels and mapping search respond |
| E5 | Stationary false still rejects a moving sample; Fan exclusion true still admits a stationary sample with fan=true. With minimum evidence set to 500, a 501–505 s stability region containing 311 rows/3.98972 s still produces assessment/evidence; active functions use fixed 80/3 s gates |
| E6 | Exported plan kind `EpicScope Idle Analyzer Test Plan` is refused by Load plan, which expects `EpicScope Idle Analyzer Next-Test Plan` plus a `nextTest` field |
| E7 | Two identical enabled 515–533 s recovery regions: union 1,428 samples, but 24 reported events, repeating the same 12 sags by region |
| E8 | Active `metricsFor` with 320,001 continuous finite samples throws `RangeError: Maximum call stack size exceeded` |
| E9 | Real prefix: prototype 1,995 trusted rows, five CRC exclusions, zero time-order exclusions, one auto window; production retains 2,000 indexed records, 1,995 CRC-valid and five recovered retry attempts |
| E10 | Slow replacement A starts, B starts/finishes, then A is released: accepted source changes B→A. Invalid replacement subsequently clears valid A instead of retaining it |
| E11 | Independent B interval 5.10–17.50 s, normalized/tracking: reload blocks missing B; matching re-import restores interval; changed sampled fingerprint rejects old selection and uses a different suggestion |
| E12 | Same-size 300,000-byte files differing only at byte 80,000 have identical `300000:ff901dc5` sampled fingerprints |
| E13 | Desktop/narrow independent-source plots and two timelines render; document scrollWidth 375 at innerWidth 390, no document-wide horizontal overflow. Narrow cards/long labels still truncate; not comprehensive accessibility acceptance |
| E14 | Bias/PID references read-only; other tune tables explicitly DEMO ONLY; Help search “bias” gives five topics; Logger opens an explicitly future-handoff placeholder |
| E15 | Numeric reference tests below and production functions run directly; missing optional channels produce NaN-derived unavailable metrics but falsely reassuring zero watch/saturation percentages |
| E16 | Built-in warm region stored at 504–516.4 s reloads as 501–513.4 s; stored bounds exist but restoration copies only enabled/purpose for existing IDs |
| E17 | After clean analysis, timeline Alt-click changes region bounds with `dirty=false` and old `analysis.runsAt`; current assessment recalculates while retained summary remains old |
| E18 | Source-labeled comparison sag click, after layout/paint settled, changes viewport from 0–17.99349 s to 0–3 s and leaves source selections unchanged |
| E19 | Controlled 30-field MSQ pair differing only by an added constant reports zero changed entries; different firmware signature produces a warning, not a verified mapping |

Local investigation artifacts, JSON observations and screenshots were saved outside the repository at `/workspace/epicscope-idle-readiness-20261026/`. The evidence descriptions, numeric inputs, fixture identity and reproduction instructions here remain usable if that temporary directory is unavailable. Initial helper mistakes (wrong dialog IDs, a ByteSource missing its required `size`, and a pre-paint event click) were corrected and rerun; their failed observations are **not** application findings.

## Confirmed blockers and priority

### P0 — Source and analytical authority

**I1. Do not port the second-source parser or dense row identity.** Latest HTML lines 977 (`realInit`), 1216 (`tunePairParseMlg`) and 1272 (`tunePairDetectWindows`) implement separate parsing, aliases, exclusions and discovery. E9 proves that equal trusted counts do not provide equal integrity semantics: production classifies the five invalid attempts as recovered retries with non-breaking continuity and preserves their original record positions. The prototype drops them, renumbers `idx`, and cannot provide canonical sample-index evidence. It also drops otherwise-valid timestamp regressions. Use production source-bound ranges, validity and integrity metadata. The standalone parser is already chunked at 4 MiB; it is not a whole-file `arrayBuffer` reader.

**I2. Make replacement acceptance transactional and generation-bound.** HTML line 1416 clears B before awaiting fingerprint/parse, without a replacement token. E10 reproduces stale completion overwriting newer B and failed replacement destroying a valid source. The MSQ handlers at line 1465 have analogous unguarded async state assignments (source-reviewed; competing MSQ replay not run). Native integration must retain accepted sources/tunes until a replacement is accepted, and reject retired completions, including disposal/navigation changes. Extend existing controller ownership, not global lifecycle wrappers.

**I3. Resolve per-mode role capabilities and valid denominators.** `metricsFor` (1060) validates only RPM/target globally, then calculates optional channels without per-role finite/valid accounting. Missing motor/DC error gives zero saturation/watch coverage (E15), despite unavailable underlying evidence. Import also unnecessarily requires eleven channels for every comparison, blocking useful RPM-only diagnostics. `renderMapping` (1175) is a read-only list, not a selectable resolver. Native roles need actual channel IDs, units, ambiguity/manual overrides and mode-specific availability. Missing measurement is unavailable, never healthy zero.

**I4. Freeze a shared numerical specification before matching visual values.** Existing production uses sample standard deviation and actual−target DC error; HTML uses population σ and target−actual. Recovery has different origin/threshold semantics. These are real mathematical differences, not formatting bugs. Extend the existing core where needed, with named metric definitions and migration tests; do not replace it wholesale to match a prototype.

**I5. Preserve firmware and tune provenance.** Raw PID≥29.9, +30 limit/fade narratives, E10 AFR conversion λ×14.1, position movement threshold 0.45 pp/s, bias curve and PID parameters are reference-specific. The primary bias is interpolated from a separate fixed MSQ reference, not a logged runtime feed-forward channel; B correctly receives NaN for missing bias instead of borrowing A’s curve. A loaded MSQ/filename does not establish flashed identity or firmware timing. Generalized diagnoses must expose these assumptions or remain unavailable. Do not present missing fan/DFCO/load placeholder zeros as recorded evidence.

### P1 — State, selection and workflow correctness

**I6. One semantic revision must govern retained results, live assessment, events, summary and exports.** `selectTimelinePosition` (1852) saves/renders without `markDirty`, while live assessment calls `metricsFor` again. E17 demonstrates contradictory freshness. Primary restore in `realInit` copies only enabled/purpose for existing IDs; E16 loses moved bounds. `createOrMoveManualA/B` (1797/1818) retains labels containing old times (E3). Native region bounds must be model authority; derive labels, reject invalid restoration and key all result artifacts to the same selection/configuration/source revision.

**I7. Reconcile qualification and evidence settings with actual behavior.** Manual regions intentionally bypass automatic entry limits; the quick popup says so. That is not itself a defect. Advanced Stationary/Fan flags are unused by the active real predicate (E5); Minimum evidence is set but fixed 80-sample/3-second real gates prevail. Warm/TPS/RPM/min-duration/hysteresis/gap affect discovery, not necessarily existing manual intervals or independent B windows. B’s detection permits VSS≤5 versus primary≤1 and minimum five seconds versus configurable primary discovery. Native selection, discovery and analysis qualification need distinct explicit contracts. Remove/disable unavailable controls or wire them to the stated semantic operation.

**I8. Reconcile sag identity, gaps and incomplete recoveries.** `analyze` (1083) deduplicates union rows but concatenates per-region events (E7). `findSags` (1080) splits low-RPM runs at >0.2 s but its first-in-band search can cross a ten-second gap and reports recovery=10 s (E15). It does not require a settling dwell. Production core also needs review for gap semantics and its unflushed terminal sag (E15), not blind designation as fully equivalent. One physical event may reference multiple regions; it must not become multiple physical events in totals.

**I9. Make Test plan a round-trippable, source-aware workflow.** Export/import schemas disagree (E6). Even a supported legacy plan is only placed in `state.importedPlan`; the active real inspector does not use the old imported-plan rendering. Export has one fixed primary source/active region and no complete A/B provenance or result revision. Native import must validate a versioned descriptor and keep operator follow-up status separate from analytical confidence. E6 is an actual failure; complete legacy-import follow-up semantics remain source-reviewed, not accepted.

**I10. Bound native computation and event/display projections.** E8 is a correctness failure, not a benchmark. Other active event-alignment extrema in `plotModel` (1553) also spread sample-sized arrays; they were source-reviewed, not separately scale-replayed because metric calculation already fails first. Rendering re-derives samples, metrics and comparison evidence several times; large B imports create per-row objects on the UI thread. Reuse production worker ingestion, requested numeric columns, bounded extrema and rendering envelopes. Do not infer whole-log CPU/latency from this 2,000-record prefix or launch a generic optimization refactor.

### P2 — Native integration features and optional improvements

- Replace Logger placeholder with existing source-checked handoff. B needs an explicit source activation decision before navigation; never send B’s seconds into A’s Logger.
- Replace illustrative tables with normalized INI/MSQ read-only inspection when available. Preserve clearly disabled unavailable states. No Idle table editing or save/Burn work is authorized.
- Keep cautious comparison categories. Same-source differences, unknown/reversed chronology, incompatible definitions and uncontrolled loads cannot establish tuning improvement. Matching suggestions already rank conditions rather than low RMSE; retain that healthy property.
- Improve narrow component clipping, long source/region labels, focus/touch interactions and accessibility after authority contracts are accepted. No document overflow alone does not prove full usability.
- t63, delay/oscillation-frequency estimation and automated tuning recommendations are not initial integration blockers **if visibly unavailable**. The real adapter already leaves t63/lag/frequency null; do not resurrect demo estimators merely for UI parity.

## Numerical reference cases and differences

| Case/input | HTML result | Production result / interpretation |
|---|---|---|
| RPM [900,1000,1100], target 1000, t=[0,.1,.2] s | mean1000, mean error0, RMSE81.649658, population σ81.649658, in-band±40=33.3333%, evidence span.2 s | `aggregateNumericSamples`: sample σ100, variance10000. Keep production sample convention or expose population as a separately named metric; never silently relabel |
| Same RPM quantiles | floor-index P05=900, P95=1000, half-span50 | Not an interpolated quantile definition. With three points this is materially different from interpolation; specify estimator/minimum coverage before adding it |
| DC target10, measured12 | signed target−actual=−2; RMSE2 | `analyzeIdleControlDiagnostics`: actual−target=+2; RMSE2. Keep production sign or explicitly invert a presentation projection with matching label |
| Errors[0,−150,−200,−120,0],100 ms apart,sag100,settled40 | onset.1 s, minimum.2 s, low-run last.3 s, recovery.2 s from minimum | `analyzeIdle`: recovery100 ms from low-run end. Neither is a dwell-confirmed settling time |
| Error−200 at0,0 at10 s | recovery10 s despite gap | Must return censored/not observed across prohibited continuity breaks under accepted policy |
| Ends while below threshold: errors[0,−200] | HTML emits qualifying terminal sag (depth criterion) | Existing production emits no terminal sag. Proposed core extension must represent incomplete/censored events and regression-test existing callers |
| Missing DC error/motor | tracking RMSE NaN (JSON null), watch%=0, motor saturation%=0 | Native metrics need explicit unavailable/counts, not zero denominators or “acceptable” status |
| Embedded warm501–513.4 s | n987, meanRPM908.260385, RMSE16.369870, population σ14.021986, DC RMSE2.759939, signed DC−1.342183 | Reproduced embedded baseline, not independent raw-MLG/MSQ validation; no conclusion about optimal gains |
| Independent prefix5.10–17.50 s | n1018, RPM RMSE22.766453, DC RMSE2.038502; comparison not qualified | Descriptive fixture only. No matching tune pair, documented intervention or established comparable load; no improvement claim |

Additional definitions to freeze: sample versus time weighting on irregular cadence; interval inclusivity; zero/negative timestamp treatment; gap thresholds; target-state validity; logged versus derived outer correction; signed versus absolute motor effort; same-purpose raised-RPM σ versus idle-target RMSE; controller update cadence versus logger cadence. The HTML’s `sec` sums only positive adjacent steps≤0.15 s; it is neither selected wall-clock length nor a general time-weighted denominator.

## Existing validation and remaining gates

Executed against unchanged production code:

```sh
npm test -- tests/analysis/idle-control-diagnostics.test.ts tests/analysis/specialized-analyzers.test.ts tests/analysis/numeric-aggregation.test.ts tests/web/analyzer-scope.test.ts tests/analyzer-channel-roles.test.ts
```

**Five files, 36 tests passed.** Direct production-function reference probes were also run. This is relevant reuse evidence, not proof of native Idle UI correctness. No full production build/full suite or full production browser regression was claimed for this documentation-only pass. The latest standalone HTML was exercised in real Chromium; Firefox, Safari, Brave, touch/accessibility and full-size independent B replay remain untested here.

Historical v3.5.7 September replay remains historical. All five snapshots share the same embedded payload, active real metric section, primary initialization section and B parser section; v3.5.7–10 largely add navigation/refinement/session behavior. Their common numeric code does not acquire mathematical validation through newer version labels.

Snapshot SHA-256 guard (unchanged during this assessment):

| Snapshot | SHA-256 |
|---|---|
| v3.5.6 | `2bfc4cbc388d3332ea6af4a26ca41bf7630874009ef7078cff24d96107080319` |
| v3.5.7 | `53af72c5896c7b96d480c66d8f7ae7a3aa565f25e694d234c95aa335ad9c3e5a` |
| v3.5.8 | `95d95d2404608019be62f74ab32fa0f43e32a689f891abeb2bb8d9dde280a865` |
| v3.5.9 | `955a97d2e077704ffd5d96225bacbb1645dcce2fd9333f8d8b9e0b2ffd16c8b9` |
| v3.5.10 | `c3eeddc778836360baf7c9401684359e9108972f3967d883126f8731bf4ca7a6` |

## Recommended next decision

Review the proposed ownership and mathematical definitions, then authorize **only implementation stage 1** if acceptable. Resolve numerical/source fixtures before a broad port. Remaining prototype faults can be corrected at native integration boundaries without creating v3.5.11 or another parser/state system. Stop here for review; the accepted layout is preserved, not declared analytically complete.
