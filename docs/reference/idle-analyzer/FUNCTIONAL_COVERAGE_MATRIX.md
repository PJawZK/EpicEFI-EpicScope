# Idle Analyzer functional coverage matrix

Applies to v3.5.10 at audited commit `1717d28305b52a921db09141de37aca5d02e462e`. Evidence IDs and test limits: [audit](INTEGRATION_READINESS_AUDIT.md). Function names refer to **the final active implementation**, including later assignments and `readyRealInit` callbacks, not merely the first matching declaration.

Classification: **F** fully functional and evidence-backed for the bounded behavior stated; **V** functional but requiring further validation; **P** partial/broken; **I** illustrative/placeholder; **D** duplicated by production; **M** missing for integration. Multiple labels are intentional. “Browser” means exercised here; “source” means inspected without complete interaction acceptance. F does not imply ECU/tuning validation.

## Mode, metric, evidence and diagnostic coverage

All eight modes and each Diagnosis/Evidence/Next Test tab were exercised on the embedded recording (E1). Facts, derived values, hypotheses and proposed next experiments must remain distinct.

| Feature / active function | Class | Evidence and limitations | Native action |
|---|---|---|---|
| Stability: RPM mean, error mean/RMSE, σ, in-band coverage | V,D | Browser E1/E15; fixed real warm baseline reproduced; population versus production sample σ differs | Reuse core RPM tracking/aggregation; explicitly name estimator |
| Stability percentile half-span/amplitude | V | Source floor quantile and three-point reference E15; not a spectral hunting detector | Specify estimator and sample coverage; optional named metric |
| Stability “possible explanation” and next test | V | Source/browser; cautious multi-cause text, not root-cause detection | Port reviewed rule/content with structured evidence prerequisites |
| Base Airflow: base, final, derived applied correction (`final-base`) | V,D | Browser; actual recorded inputs, but derived difference is not automatically a universal raw/applied-controller model | Reuse actual base/closed-loop/final roles; label derivation and assumptions |
| Base Airflow “insufficient base”/TPS-fade hypothesis | V | Current real text is conditional; +30 reference and firmware fade behavior not generally proven | Gate by firmware/configuration; no automatic tuning instruction |
| Outer RPM PID: P/D RMS, I mean, raw PID, saturation coverage/fade loss | V,D | Browser E1; active +29.9 threshold and +30 wording are fixed; no per-role missing denominators | Reuse core aggregates; source configuration for limits; unavailable when unsupported |
| Outer PID gains/anti-windup recommendations | V,I | Next-test guidance only; displayed parameters are reference MSQ scalars, not computed recommended gains | Keep read-only evidence; do not port demo gain computation |
| DC Valve: target/actual, tracking RMSE, signed error, motor mean | V,D | E15 sign reference: HTML target−actual, production actual−target | Reuse DC core with explicit display convention |
| DC Valve moving/steady tracking split | V | Source derivative threshold0.45 pp/s; adjacent gaps≤.15 s only | Extend core only with declared derivative/continuity policy and tests |
| DC Valve lag, t63 and oscillation-frequency result | P,I | Active real metrics are null, deliberately unqualified; old demo estimators do not apply | Preserve unavailable state; defer estimator development |
| Motor near-limit and position watch percentages | P,V | User watch limits wired to metrics; optional NaN channels produce false zero% E15; not ECU limits | Valid denominator/availability and verified units |
| DC Bias / Position PID: P/I/D and motor evidence | V,D | Browser; position controller separate from outer RPM controller | Reuse existing DC diagnostic roles/aggregation |
| DC bias expected feed-forward | V,I | Primary fixed eight-point reference interpolation; B absent bias correctly NaN | Prefer logged bias; otherwise resolve source-associated tune curve and flag derived/reference status |
| DC bias occupancy/reference table | V,D | Browser read-only E14; actual target-weighted interpolation occupancy source-reviewed | Reuse tune/table correlation after unit/geometry verification |
| Ignition: advance, idle correction, RPM and lambda/MAP context | V,D | Browser; correlation is not causation; no separate spark effectiveness estimate | Reuse role/range aggregation and source-aligned graphs |
| Load Recovery: sag threshold and bounded low-RPM runs | P,V,D | Browser E7/E15; duplicate events across overlap, gap recovery and different production origin | Extend single core event contract; preserve original source indices |
| Recovery depth/minimum RPM | V,D | Browser; “maxDeviation” is absolute, not necessarily sag depth | Use explicitly named signed depth/absolute deviation metrics |
| Recovery duration/settled time | P,V,D | First in-band hit, no dwell; HTML minimum-origin versus production low-run-end origin; terminal production event absent | Freeze censored/dwell/gap definitions before parity claims |
| Recovery diagnosis of actuator/command/load constraints | V | Narratives identify hypotheses; external load magnitudes not independently measured | Preserve conditional explanation; require relevant roles and provenance |
| Compare condition mode, same source | F,V | E2 blocks identical/overlapping spans; accepts distinct purposes as descriptive contrast | Retain descriptive classification and real source regions |
| Compare independent recordings | V,M | E9/E11 bounded real prefix works; no independent tuning experiment validated | Reuse importer; new bounded comparison session owner |
| Comparison metrics / qualification rules | V,P | CLT/TPS/meanRPM/minsamples/duration warnings exist; fixed target20RPM/active95% thresholds; optional NaN bypasses comparisons | Structured capabilities/reasons; validate both denominators and threshold meanings |
| Tuning-improvement/cause verdict | V,M | Current qualified path says “Needs repetition”; tune identity/load still unproven; no accepted real intervention pair | Keep measured differences descriptive; never infer cause from tune diff alone |
| Raised-RPM comparison uses σ instead of idle-target RMSE | V | Source; not a separately validated raised-RPM experiment in this pass | Preserve purpose-specific definition and labels; add numerical/browser fixtures |
| Reversed/unknown chronology | V | Source and historical September case; imported prefix suffix yields unknown and remains unqualified | Use canonical metadata/operator evidence; retain chronology warning |
| `realAssessment`, `diagnosticCopy`, `v31Evidence` | V,P | Browser all modes; thresholds partly fixed; optional evidence can be unavailable | Results/rules from typed model, not DOM text or narrative parsing |

## Selection, display and navigation

| Feature / functions | Class | Evidence and limitations | Native action |
|---|---|---|---|
| Mode menu/select, `renderMode`, `modeMetrics`, `renderMetrics` | F,V | E1 all modes respond; responsive labels truncate | Retain compact accepted UI; per-mode capability state |
| Focused region selector, `setSelected`, `activeRegion`, `regionById` | F,V | Browser, selected region and mode-purpose assessment differ deliberately | Keep focus separate from included union/comparison selection |
| Focused/all assessment scope, `assessmentSamples/Stats`, `eligibleSamples` | V,D | Source/browser; eligible union deduplicates dense rows; repeated live recomputation | Canonical original-index union and cached result projection |
| Main timeline selection/drag/keyboard | V,D | Source; manual region creation tested via dialog, latest A/B pointer/keyboard separately tested | Adapt existing timeline input behavior; full ordinary drag regression still required |
| A/B independent source timelines, `laneHtml`, `renderComparisonTimelines`, `sourceSelection` | F,V | E2/E11/E13; distinct original source domains; missing B explicit | Preserve; derive source labels/bounds from model |
| A/B pointer selection, `timeAtTrack`, `selectTimelinePosition` | P,V | CDP Alt-click E3/E17 works but fails result invalidation | Retain interaction, semantic revision on region movement |
| `createOrMoveManualA/B`, Arrow/Home/End/Enter/Space | P,V | ArrowRight/focus/count and Alt-click tested; Home/End/Enter/Space source-reviewed, not fully replayed; stale labels/restore bounds | Keep one movable selection; test bounds/focus and both sources for every key |
| Same-source B manual interval | V | Source; latest refinement addresses older behavior; full pointer drag/Alt combinations not exhausted | Native region ownership, regression gate |
| Region manager, `renderManager`, inclusion/all/none, manual add | F,V | E4 enabled/excluded/manual raised interval tested; invalid/reversed ranges not exhaustively tested | Reuse selection validation; stable IDs/semantics |
| Region purpose, merge/split/delete and rename | V | Source implementation inspected; purpose used in analysis; all combinations not browser-accepted | Keep only model-backed operations with regression tests |
| Automatic discovery, `discover`, `sampleQualified` | P,V,D | Preset/rediscovery exercised; E5 no-op settings; manual bypass intentional; A/B different policies | Reuse qualification primitives; explicit shared rules |
| Recommended preset, quick qualification and scope popups | F,V | E4 open/respond; preset rediscovery retains manual regions | Preserve UI; make affected operation clear; test setting causality |
| Run Analysis / summary, `analyze`, `showSummary`, `renderStage` | P,V,D | E4 works; E7 duplicate total; E17 retained/live state mismatch | One revision-bound result shared by all consumers |
| Diagnosis/Evidence/Next Test tabs, `renderInspector` | F,V | E1 content in all24 combinations; facts/hypotheses separated | Presentation-only tab changes |
| Event list, `renderEvents` | V,P,D | E18 source-labeled; shows up to5 sags/source in Compare, not total event count; overlap totals elsewhere duplicate | Distinguish display cap from actual count and canonical events |
| Event click → viewport focus | F,V,D | E18 after paint,0–17.99349→0–3 s; selections unchanged | Preserve source and transform; no analysis invalidation for zoom |
| Dual graphs, `plotModel`, `drawPlot`, `axisRange` | V,D | All mode canvases plus independent source/narrow screenshots; source timings retained in compare points | Adapt evidence renderer, verify units/scales/gap line breaks |
| Elapsed and normalized alignment | F,V | E2/E11 applied; normalized explicitly shape-only | Preserve display transform, never use normalized coordinate as source time |
| Event alignment | V | Gated when missing sags; two recovery regions have qualifying sags; complete aligned graphical acceptance not run | Require explicit verified anchors/fallback; add browser numeric-transform tests |
| Graph zoom/pan/fit, `graphWindow`, `setGraphWindow`, `graphZoom/FitAll/FitMatched`, `graphPositionView`, `graphLegendNavigation` | V,D | Event zoom tested; wheel/drag/fit controls source-reviewed, not every gesture replayed | Adapt current viewport components and keep analysis bounds unchanged |
| Peak-preserving drawing, `peakPreservingPlotPoints` | V,D | Source present; no adversarial peak/gap/aliasing proof here | Reuse existing envelopes; display reduction must not become evidence reduction |
| Hover/legend/linked evidence, `showHover`, `evidenceSamples`, `syncEvidenceLinks`, `activateEvidenceCard` | V,D | Source; no complete hover/pointer/touch accessibility acceptance | Keep source-index association and missing-value/gap behavior |
| Logger button, `openLogger` plus real override | I,D,M | E14 explanation only, explicitly no navigation | Bind existing checked source/range/sample callbacks; B source activation explicit |
| App picker | I | Toast explaining prototype only | Use real production router; discard placeholder |
| Narrow responsive layout | V | E13 no document overflow, two graphs/timelines; component clipping visible | Preserve layout principles; component/focus/touch tests remain |

## Settings, sources, persistence and auxiliary controls

| Feature / functions | Class | Evidence and limitations | Native action |
|---|---|---|---|
| Embedded source, `realInit`, lower/upper bounds/in-window helpers | V,I,D | E1 fixed baseline verifies; compressed transformed rows lack canonical index correspondence | Keep HTML fixture only; native source from existing importer |
| Independent `.mlg` chooser, `tunePairParseMlg` | P,V,D | E9 imports prefix; E10 race and destructive failure; 11 required roles; hard fail on truncated tail | Discard decoder; adapt staged importer acceptance |
| Parse progress/error toast | V,D | Browser useful progress/status; may be stale due race | Existing import lifecycle/progress owner |
| Candidate discovery, `tunePairDetectWindows` | V,D | One window in prefix; cap150; policies differ from primary | One core discovery policy and disclosed caps |
| Match finder, `pairSuggestedIntervals`, `renderMatchingSuggestions` | V | Source: conditions/duration/purpose ranking, not lowest RMSE; suggestions shown in import | Retain condition-first review suggestions; no automatic outcome cherry-picking |
| Candidate manual start/end/purpose and region options | F,V | E11 5.10–17.50 s restore; validation bounds in setup | Source-bound region model; validate finite extent and coverage |
| Comparison modal, `openSetup`, `updateSetup`, `pairWindowsOptions` | F,V | E2/E11 source choice and gating work | One session model projected into modal and timelines |
| Sampled fingerprint, `tunePairSampleFingerprint` | P,V | E11 works for sampled mismatch; E12 unsampled byte collision | Explicit verification strength; no claim of exact byte identity |
| Tune file choosers, `tunePairParseMsq`, `pairRefreshReadiness` | P,V,D | Source and E19 controlled parse/diff; no fresh matched real MSQ-pair replay; min30 constants arbitrary | Existing MSQ candidate/INI/TuneModel authority and transactional reads |
| Tune diff, `tunePairTuneDiff` | P,V,M | E19 misses added-only constant; name-only identity and signature warning | Include additions/removals/geometry/page/compatibility before verification claim |
| Change-note input | P | Editable text exists; active comparison evidence/session/export does not bind it as intervention provenance | Store as operator annotation, not calibration proof |
| Comparison trace selector | F,V | All5groups respond E2; session tracking selection restored E11 | Presentation-only projection of retained numeric result |
| `savePrefs`, `storeSession`, re-import restoration | P,V,D | E11 healthy B refusal/match/mismatch; E16 loses edited existing A bounds; weak schema validation/storage errors swallowed | Versioned descriptor at session owner; preserve no-raw-log persistence |
| Analysis result persistence | M | Current reload recomputes A and requires B; no verified reusable serialized result | Recompute after verified restoration; don't invent stale evidence |
| Source replacement/session invalidation/cancellation | P,M,D | E10/E17 reproduced; existing production controller has generation checks | Extend existing owner/worker boundaries, no global wrappers |
| Advanced panels and input mapping search | F,V,D | E4 all4panels and RPM filter respond; no channel mapping selectors | Shared role mapping/availability UI |
| RPM/CLT/TPS/min-duration/entry-hysteresis/bridge-gap controls | V | Discovery wired in source; preset exercised; manual regions bypass filters; gap policy not independently fully validated | Configuration contract and one control→operation→result test each |
| Stationary and fan controls | P | E5 set state, no effect on active real predicate; fan placeholder false | Wire only with actual role availability; otherwise disabled/unavailable |
| Minimum evidence control | P | E5 state changes but active real gates hard-code80samples/3s | Single configurable evidence policy and displayed effective values |
| Sag/settled/position-watch/motor-limit controls | V | Used in active calculations; reference fixtures E15; firmware limits not established | Define units, thresholds and availability; regression-test effects |
| Comparison CLT/TPS/RPM/sample rules | V | Source-used in warnings; not all boundary cases browser-replayed | Structured comparability reasons and valid-role gating |
| Tune viewer, `openTuneTables`, `renderTuneTable`, `stepTune`, operating/cell details | V,D | E14 all6tables inspected; read-only; real versus demo labels distinct | Existing INI/MSQ geometry/value authority; no synthetic fallback as real tune |
| Tune highlight / `tableOccupancy` | V,D | Source inspected; interpolation weighting; not full numeric coverage proof | Reuse tune correlation; validate axes, units, denominators and source association |
| Summary | P,V | E4 facts render but selected union versus focused scope differs; E17 freshness wrong | Scope/result revision always visible |
| Test plan export/load, `createTestPlan` | P,M | E6 round-trip fails; no full A/B provenance; loaded legacy plan unused by real inspector | New versioned schema using session/result descriptor; old format only if explicit migration |
| Hypothesis review status | V | Source stores operator annotation; not analytical confidence; full reload/follow-up acceptance not run | Retain separate user annotation keyed to experiment/source/revision |
| Help directory/search/bubble/related-topic functions (`kb*`) | F,V,D | E14 browse/search works; content may retain demo thresholds; not exhaustive keyboard/focus validation | Reuse production help and reviewed definitions |
| Toasts/dialog open/close/Escape/focus helpers | V,D | Repeated dialogs exercised; no full accessibility conformance claim | Use production dialog/help conventions, preserve meaningful progress |
| Synthetic scenarios, `pseudoNoise`, `generateLog`, `attachSupport`, `makeScenario`, `setScenario` | I | Hidden after real init; older metrics/diagnoses overridden; not current measurement authority | Do not port; preserve only standalone historical snapshots/test fixtures |
| Old duplicate declarations/overrides and capture handlers | I,P | Source layers remain active infrastructure even when output functions overridden; active plan mismatch demonstrates risk | Port accepted functions by owner, not concatenated script; do not mechanically delete while preserving snapshots |

## What is still unvalidated

No source fixture establishes a real causal tuning improvement, a valid t63/oscillation estimate, firmware-specific fade behavior on arbitrary ECUs, complete September/October raw-source equivalence, or full-size B responsiveness. Every unexercised gesture, browser/platform, malformed persistence payload and altered/missing-channel combination above remains a native acceptance test, not a successful validation claim. Production owner reuse does not exempt new integration paths from real browser checks.
