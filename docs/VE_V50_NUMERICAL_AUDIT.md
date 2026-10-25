# VE v50 numerical audit — new plan Group 3

Audit date: 2026-10-19. Base: `74e9342d90f1003e224e418dd12c11caf2134a0f`, branch `fix/ve-v50-reviewed-groups-1-7`.

This is the independent reference/audit checkpoint of the new ten-group plan. It does not implement Group 4 corrections or claim that every mathematical boundary is correct. Application code, analysis algorithms, model ownership, editing behavior and production listeners/observers remain unchanged. The durable additions are a shared numerical fixture, unit references and this ledger.

> Historical Group 3 snapshot: Group 4 has since corrected N01–N05 and B01. See [Group 4 corrections](VE_V50_GROUP4_CORRECTIONS.md). The original expected-failure counts below describe the audit checkpoint; the current reference suite uses ordinary passing regressions.

> Subsequent interpolation correction (2026-10-25): the user requested strength-preserving interpolation. Follow-up Group 2 changes R36 from post-blend clamping to target clamping before blending. The historical R36 description below records the old behavior; the current shared fixture expects78.125 with clamp either enabled or disabled. See [the correction and validation](VE_V50_FOLLOWUP_GROUP2_INTERPOLATION.md).

## Reference method and scope

`tests/fixtures/ve-numerical-references.ts` supplies explicit inputs and independently calculated expected outputs. `tests/analysis/ve-numerical-reference.test.ts` executes them. The same fixture executes through Vite in real Chromium in normal and Worker-disabled contexts; an external probe also mounts the production controller chain for B01/B02. Small numerical tolerances cover floating-point evaluation, not material differences. No rendered UI text supplies analytical input.

There are **42 agreeing reference cases and seven explicit expected-failure cases** across five issue families. The `.fails` cases assert the intended boundary, rather than asserting that the current bad output is correct. They must be converted to ordinary passing tests when Group 4 repairs their owners. A green process exit therefore does **not** mean these seven mathematical discrepancies have been fixed.

The audit covers mixture units/direction, applied fuel correction, timestamp and delay alignment, sparse lookup, evidence geometry/weights, weighted quantiles, confidence thresholds, proposal shrinkage/limits, qualification/recovery boundaries, discovery statistics, linear/PCHIP/bilinear/boundary interpolation, pins, clamp/strength and numerical versus display precision. It reviews smoothing/Brush equations and existing interaction regressions without changing their accepted behavior. Scope loading/invalidity remains owned by Logger and the existing VE controllers.

Actual original approximately 1.2 GB MLG input, user hardware and the exact frozen v50 HTML are unavailable. References are synthetic and explicitly identified as such. This is finite reference coverage and an implementation audit, not scientific calibration of confidence labels, verification of sensor accuracy or an exhaustive proof over all JavaScript numeric inputs.

## Numerical owners

| Operation | Existing authority |
|---|---|
| Accepted source/tune, real scope and trace reads | Shell replacement adapters; Logger; Analyzer routing |
| Active mappings, exclusions, parameters, working delay and run generations | `apps/web/src/pages/ve-analyzer-view-v2.ts` |
| Quick CLT/TPS qualification | `ve-analyzer-view-v3.ts::wrappedContext`, `ve-analyzer-qualification.ts` |
| Actual/target mixture compatibility | `ve-analyzer-model.ts`, v2 mixture assessment; no universal AFR conversion is performed |
| Applied-trim interpretation | `ve-fuel-correction.ts`; automatic recognition requires known percent-fuel-applied identity/unit, otherwise context-only or explicit user declaration |
| Delay discovery | `core/analysis/afr-delay-analyzer.ts::analyzeAfrDelay` |
| Recommendation aggregation/IDW filling; working table lookup | `ve-delay-table.ts::buildVeDelayTable` / `interpolateVeDelayTable` — distinct operations |
| Timestamp alignment | `ve-delay-aligned-evidence.ts::buildVeDelayAlignedEvidenceSteps` |
| Steady qualification, node weights and evidence | `ve-evidence-map.ts::buildVeEvidenceMapSteps`, `stableSegment`; `weighted-cell-mean.ts::axisBreakpointContributions` |
| Robust quantiles | `ve-evidence-statistics.ts`; cooperative preparation/sort uses `ve-analysis-work.ts` |
| Raw candidate, limits and prior blending | `ve-proposal.ts::buildVeProposal` |
| Working delay edits/recommendation provenance | `ve-delay-table-editing.ts` |
| Physical editing interpolation, smoothing and Brush | `ve-table-interaction.ts::TableInteractionSession`; semantic edit adapters publish separately |
| Read-only numerical projection/formatting | `ve-analyzer-table-projection.ts`, `ve-analyzer-result-view.ts`; Cell Evidence consumes retained primary data |

## Derivations and reference ledger

### Mixture direction, compensation, evidence and proposal

Assume the measured and target mixture use the **same scale and AFR calibration** and other fueling factors are held fixed. With applied trim fraction `c`, the base-VE candidate ratio is `(actual / target) * (1 + c)`. It multiplies VE: lean actual requires increased base fuel; rich actual requires decreased base fuel. Multiplying by the known applied trim removes closed-loop fueling's contribution when attributing a correction to base VE. It is not a second request to apply that trim to the ECU. If actual/target are both expressed in Lambda using the same stoichiometric constant, that common factor cancels. This does not authorize mixing AFR/Lambda or different AFR calibrations without conversion/metadata.

Candidate `C = V*r`; accepted prior blend `P = (V*p + C*w)/(p+w)`. Weights are interpolation-node observation weights, not elapsed seconds. Confidence is a threshold category, not a calibrated probability or count of statistically independent engine events.

| ID | Independent reference / expected result |
|---|---|
| R01 | V=70, actual=15.4, target=14 => r=1.1, C=77. With p=w=20, P=73.5, change=3.5, +5%. |
| R02 | Actual=12.6 / target=14 => r=0.9, C=63, P=66.5, change=-3.5, -5%. |
| R03 | 15.4/14 and 1.1/1 both give 1.1. |
| R04 | Lean ratio1.1 and +5% applied trim => 1.1*1.05=1.155. |
| R05 | Lean ratio1.1 and -10% applied trim =>0.99; -100% yields nonpositive fuel factor and is unavailable, not zero-VE evidence. |
| R06 | Prior zero follows eligible evidence:77. |
| R07 | V70, raw ratio1.5 =>C105, raw change35/+50%; limits20VE/20% withhold before p100/w1 shrinkage or evidence threshold. This is current safety policy. |
| R08 | Weight7 below minimum8 =>weak evidence, no accepted proposal. |
| R09 | Current policy protects source VE0 through undefined/infinite relative change, even though raw absolute change can be0. |
| R10 | Values1,2,4 with weights1,8,1: cumulative weights1,9,10; inverse-CDF median2/P10=1/P90=2/spread1/total10/count3. |
| R11 | Equal weights at0,100,200,300: inverse-CDF weighted median100, not150. |
| R12 | Nonfinite observations/weights and nonpositive weights are removed: remaining value2/weight3/count1. |
| R13 | Cooperative estimator independently reaches median2/P10=1/P90=2 on R10. |
| R14 | Identical single-node evidence with counts/weights7,8,20 yields limited/moderate/strong under current thresholds. |
| R15 | Physical fractions u=v=1/4 yield weights9/16,3/16,3/16,1/16; sum1. Sample count can increment in four cells without becoming four source observations. |
| R38 | V80, ratio1.25, p0 =>C100; exactly20VE/+25% is accepted at those configured limits. |
| R39 | 4099 alternating1/2 observations contain2050 ones/2049 twos: median1/P10=1/P90=2/weight4099 across bounded merge-sort runs. |
| R40 | Minimum individual weight0.2 removes the three smaller R15 contributions; remaining weight stays9/16, without renormalization. |

Raw limits and minimum weight are deliberately separate from prior blending. Changing their ordering could turn previously withheld large raw corrections into accepted proposals; this audit does not authorize that policy change.

### Timestamp alignment, delay discovery and qualification

An observation at `t_m` is associated with engine time `t_e = t_m - delay(rpm(t_e), load(t_e))`. The implementation uses the delay at observed operating point followed by **one** refinement, with a0.5ms difference threshold; it does not solve this implicit equation to convergence. Source sample indices in evidence remain observation identities for Logger handoff, not synthetic engine-record offsets.

| ID | Independent reference / expected result |
|---|---|
| R16 | At140ms between RPM1200 at70ms and1600 at210ms, fraction1/2 gives1400. An invalid bracketing endpoint or extrapolation returns unavailable. |
| R17 | Target corners0,20,40,60 at RPM1000/3000 and load40/80: RPM1500/load50 =>u=v=1/4 =>15; RPM999 is unavailable. |
| R18 | Delay corners0,200,400,600 at the same geometry =>150ms. Lookup uses working values. |
| R19 | Four direct onset delays0,100,200,300 use linearly interpolated sample order statistics: median150/P10=30/P90=270/spread240ms. This intentionally differs from R11's weighted inverse-CDF convention. |
| R20 | Direct100ms at RPM1000 and300ms at3000 with equal normalized distance to2000 give IDW200ms. Empty interpolated center has no fabricated direct events/count. |
| R21 | Mixture at1000ms with100ms delay samples trim at900ms (+10%), yielding ratio1.1 while retaining source observation index10. |
| R22 | A delay that predates available engine history yields one unavailable/zero contributing observation; no extrapolated fallback. |
| R23 | rpm(t)=1000+t, t in ms; d(rpm)=0.2*(rpm-1000). At t_m=1000, observed delay200 gives first t_e800, refined delay160 gives final t_e840/RPM1840. Node weights0.16/0.84 match the implemented approximation. Exact implicit solution is833⅓ms/RPM1833⅓; difference6⅔ms, not a floating-point error. |
| R24 | Async/cooperative zero-delay evidence matches ratio1.1/weight20 independently. |
| R25 | Command step at100ms, response changes at200/300/400ms =>onset100/t50=200/t90=300ms. Crossings are first sampled thresholds, not sub-sample fitted crossings; t50/t90 refer to observed peak amplitude. |
| R26 | Invalid response sample before onset yields zero usable events/one gap rejection. |
| R27 | CLT minimum70 and TPS maximum90 include equality; source validity remains immutable. Thresholds compare source numeric units; no implicit C/F conversion is introduced. |
| R28 | Current policy: RPM1000,2000,1000 over0/100/200ms has trailing OLS slope0 and one eligible observation at duration200ms, even though excursion rates are large. |
| R29 | Current policy: valid observations at0/10000ms interpolate RPM2000 at5000ms and satisfy a300ms trailing duration at the second sample. No maximum elapsed-gap boundary exists in this API. |
| R42 | Marking an observation explicitly invalid breaks the segment; after invalid index2, duration300ms resumes at index6, with one eligible observation. |

Unknown/missing correction samples fail closed when compensation is enabled. Loaded query bounds are real scope bounds: unavailable delay history at a scope start is counted rather than fabricated. Parser invalidity is respected; a merely large valid timestamp interval is a different case from explicit invalidity.

### Editing interpolation, pins, strength and precision

| ID | Independent reference / expected result |
|---|---|
| R30 | X1000,1500,3000, endpoint values10/20: interior fraction1/4 =>12.5, not index-average15; one publication. |
| R31 | Reverse X3000,1500,1000 and endpoint values20/10 =>same physical value12.5; one publication. Editing explicitly supports descending physical axes, unlike the current analytical binary lookup contract. |
| R32 | Pinned middle20 splits endpoints0/40 into two line segments, yielding0,10,20,30,40 without moving the pin. |
| R33 | PCHIP support X0,1,3,4/Y0,1,3,6 has secants1,1,3 and internal derivatives1 and27/17. AtX2, Hermite terms give2+(1-27/17)/4=63/34. Selected interior input999 is replaced. |
| R34 | Four corners0,20,40,60 on axes0,1,4 in both directions yield interior15; sparse nonfinite interior/edges need no fabricated support samples for bilinear filling. |
| R35 | Boundary surface at u=v=1/4: bilinear15 plus top/bottom edge deviation3 and left/right deviation2 =>20. This is a Coons-style boundary correction, not the same operation as IDW delay recommendation filling. |
| R36 | Existing value100, linear target12.5, strength1/4 =>78.125 without clamp. Current post-blend boundary clamp[10,20] makes it20 when enabled. |
| R37 | V70, C77, p17, w20: P2730/37=73.783783…, change%=200/37=5.405405…. Display73.78/+5.4%; numerical projection retains full values. |
| R41 | Current delay edit policy: recommendation100.1ms, entered100.4ms both round to100ms, so working value snaps to100.1 with recommendation provenance. This is semantic snapping, not purely display rounding. |

Smoothing averages finite members of the bounded3x3 neighborhood from one pre-edit snapshot, includes the current cell and surrounding unselected cells, and blends by strength; pinned cells remain influence sources but are not bulk-edit targets. Brush adds `delta * direction * strength * falloff(distance/radius)` per pulse, with flat/linear/cosine-soft profiles, private transaction previews and one release publication. Its distance is grid-node distance rather than physical RPM/load distance; that is the accepted interaction contract, not a numerical regression to change during this audit. Existing pin, sparse, invalid-anchor, preview/cancel, Undo/Redo and native editing coverage remains required.

## Confirmed mathematical/boundary discrepancies

All N cases reproduce in both unit execution and real Chromium. Browser JSON records `undefined` explicitly, instead of losing it in JSON serialization.

| ID | Input, intended result and current result | Responsible path / scope |
|---|---|---|
| N01 | RPM axes1000/2000/3000, one load row, working100/200/unavailable. Exact RPM2000 should resolve200ms using its node alone. Current result is unavailable because the zero-weight neighbor at3000 is required. | `ve-delay-table.ts::bracket` and `interpolateVeDelayTable`; ordinary sparse working-table boundary, high practical relevance. Target interpolation has an analogous bracket/corner pattern, although accepted MSQ numeric tables usually have finite cells. |
| N02 | Two observations at0/100ms, RPM1000/2000, delay axes1000/2000/3000 and working unavailable/100/100. First observation has no delay; second observed-point delay100ms maps to RPM1000 where engine-point delay is unavailable. Both should be unavailable (contributing0/unavailable2). Current output is contributing1/unavailable1: the second sample silently keeps observed-point delay. | `ve-delay-aligned-evidence.ts::buildVeDelayAlignedEvidenceSteps`, conditional refinement branch. Fail-closed hole, not the documented one-iteration approximation. |
| N03 | Actual observations startSampleIndex10 at times100/200ms; RPM/load ranges start0 and cover0/100/200ms, constant valid states and zero delay. Expected two contributions; current zero. | `alignedRange` spreads each engine input's old startSampleIndex onto arrays indexed in actual-observation geometry. Reproduced core API boundary; normal Logger traces generally share record origins, so no claim this is the user's normal MLG path. Derived quality/statistical metadata should also be reviewed when correcting geometry; no current downstream summary-cache corruption is asserted. |
| N04a/b/c | Saved delay axes descending3000/2000/1000, duplicate1000/1000/3000 and folded1000/3000/2000 should be rejected or explicitly normalized with matching table values before ascending lookup. Parser currently accepts all three. | `ve-delay-table-storage.ts::parseVeDelayTableFile` validates finite arrays/geometry but not strict axis ordering. Analytical brackets/nearest assignment assume ascending axes. Never sort axes independently of cell values. |
| N05 | Three actual observations with100ms delay, selected indices[2]. Only selected observation is available: input1/unavailable0/contributing1. Current result is input1/unavailable1/contributing1 because unavailable observation0 is counted outside the selection. | Delay alignment scans full actual array and increments delay-unavailable counter before `sampleIndices` scope is applied in base evidence builder. Affects selected/state-filtered summary counts; it is not extra I/O. |

N04 is three test vectors for one validation issue family. There are seven expected-failure tests, not seven independent architectural problems. The current N04 references choose safe rejection. If review instead chooses explicit normalization, replace that expectation with axis/value association cases proving the normalization preserves every cell; accepting the original incompatible geometry remains incorrect.

### Browser-only geometry finding B01

Production controller chain with descending MSQ VE RPM axis2000/1000, valid ascending target/working-delay geometry and continuous valid source data:

- readiness reports `ready=true`; VE RPM axis row is `Resolved`, `valid=true`;
- analysis completes with success status, zero contributing samples and56 VE-out-of-range rejections.

`ve-analyzer-view-v2.ts::renderReadiness` checks nonempty axis values, while `axisValues` returns them without monotonic validation. This extends the N04 invariant problem to tune-side acceptance/readiness. General MSQ parsing need not reject every descending array: validation belongs at the analytical geometry boundary. A descending grid may be intentionally supported by the edit engine; do not break that independent feature.

## Policy and presentation questions — do not silently change them

1. **Engine-time exclusion authority (B02, reproduced):** with1000ms working delay and300ms stable duration, a fuel-cut flag at source index9/900ms removes index9 from observed-index selection. The mixture sample19/1900ms still contributes even though its associated engine event is index9. Browser contribution list is13–23, including19; stateExcludedCount is1. Current owner is v2 `stateFilteredIndices`, before delay alignment. CLT/TPS qualification separately masks loaded traces before alignment. Define which flags qualify engine events, observations, or both, and how recovery operates on that timeline. Recommended direction is to reject evidence associated with excluded engine events as well; this audit does not implement a new exclusion policy or owner.
2. **Stable/recovery guarantee (R28/R29):** the UI promises a stable trailing/recovery window, but an OLS net slope can cancel large excursions and large valid timestamp gaps count toward duration. Define tolerated local rate/excursion and continuity before replacing the estimator. No arbitrary new maximum-gap constant is justified by the available log/hardware evidence.
3. **Delay approximation (R23):** one refinement is documented and reproduced. A6⅔ms error in the constructed case is an approximation difference, not automatically a defect requiring iterative solving. Decide error/convergence bounds before increasing full-log work.
4. **Proposal ordering and zero baseline (R07/R09):** retain conservative raw-limit-before-prior and zero-base protection unless a deliberate policy decision changes them. Do not treat shrinkage as permission to accept a large raw correction.
5. **Clamp/strength (R36):** post-blend clamp can move an out-of-bound original much more than nominal strength. Current implementation is internally consistent; a different interpolation-strength promise needs an explicit decision.
6. **Delay edit precision (R41):** same-displayed-millisecond snapping is explicitly implemented and covered by existing tests. Proposal/result formatting preserves full precision (R37), but this delay rule changes semantic values. Do not claim every rounding operation is presentation-only or remove accepted provenance behavior without review.
7. **Compensated 'Mixture error' label (code-confirmed):** Result View and Cell Evidence display `evidence.correctionPercent`, which includes applied-trim compensation. Actual on target with+5% trim therefore displays+5%, although raw actual/target error is0. Group5 should make the displayed basis explicit or provide separate owner-derived metrics; do not recover raw semantics by parsing rendered text or simply subtracting trim from a weighted median.
8. **Sparse raw delay evidence (code observation):** `buildVeDelayTable` preserves any original insufficient cell's raw sourceEvents/eventCount/quantiles when filling its recommendation from neighbors. The interface comment says interpolated cells have empty sourceEvents, which is only true when the cell initially had no direct events (R20). Presentation should distinguish raw local evidence from interpolated recommendation rather than discard real events to match that comment.

## Ranked Group 4 plan

1. **Sparse lookup and unavailable refinement:** correct N01 and N02 at existing table lookup/alignment owners. Add exact node/edge/2D sparse cases and verify no fabricated delay fallback. Convert their expected-failure cases to ordinary tests only when fixed.
2. **Selected counters and aligned geometry:** correct N05 and N03 without changing Logger source ownership. Check selected count accounting, duplicate-index policy, nonzero/shifted origins and derived metadata. These are bounded correctness changes, not a new caching or I/O subsystem.
3. **Analytical geometry acceptance:** address N04 and B01 at saved-table/tune/readiness boundaries with actionable errors. Choose rejection versus a deliberate axis/value normalization contract; preserve descending-axis support in independent table editing and original tune data.
4. **Qualification timing/stability decisions:** review B02 and R28/R29 before implementation. Keep changes at the current VE qualification/evidence boundaries and test physically aligned cut/recovery transitions. This may warrant a separate acceptance checkpoint because it changes which samples are trusted.
5. **Keep separate planned work separate:** compensated metric naming/source authority belongs to Group5; workflow defects remain Group7; Logger timeline ownership remains Group8; presentation parity/precision choices remain Group9.

No worker migration, generic lifecycle layer, new global listener/observer, automatic ECU write/Burn or merge to main is justified by this audit. No production performance improvement is claimed.

## Healthy behavior to retain

- Same-scale ratio direction, known applied-trim multiplication, prior shrinkage and raw safety-limit ordering agree with the independent cases.
- Weighted data is filtered/sorted once per estimator; cooperative merge/quantile results agree with reference cases. Do not merge the weighted inverse-CDF and unweighted interpolated percentile conventions merely because both produce a median.
- Physical-coordinate linear/PCHIP/bilinear/boundary editing, pins and private Brush transaction behavior agree with reviewed formulas/reference cases. Do not replace them with index averages or copy prototype calculations into the UI.
- Invalid validity samples, missing trim and unavailable out-of-history delay fail closed in the tested paths. Sparse recommendations retain real evidence/provenance; no synthetic Logger ranges/events were created.
- Typed primary analysis/projections retain numerical precision; Result Views and ordinary navigation do not trigger new full-log work (Group2 coverage remains required).
- Existing source caching/storage and retained primary/evidence reuse are unaffected. Numerical defects found here are CPU/semantic boundary/counting issues, not evidence that cached MLG data should be reread or decoded again.

## Validation record

Final command results, exact local commit SHA, probe output and handoff are recorded under `/workspace/epicscope-v50-next-group3-numerical-audit/REPORT.md` and `HANDOFF.md`. The production build, full unit suite and full Chromium gate are required after this audit's test additions. Expected-failure counts must remain separately reported. Stop for review before Group4.
