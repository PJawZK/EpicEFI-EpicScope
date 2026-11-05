# Native Idle Analyzer — Base Airflow core foundation

Branch: `ui/idle-analyzer-html-integration`. Parent: `652a44f879cb6cad6943671873eacc97540e7fac`. Scope: one bounded stage 3 numerical capability before enabling its stage 4 UI. Base Airflow remains disabled in the native mode picker. No push or merge.

## Capability and owner

`core/analysis/idle-airflow.ts` provides `analyzeIdleAirflow`. It consumes canonical RPM, an already deduplicated original-index selection (such as `IdleStabilityResult.sampleIndices` after region/qualification selection), and optional explicitly unit-bound logged base request, applied correction and final request. It does not own file reads, scopes, qualification, controller lifetime, graphs or tune state.

Statistics reuse `aggregateNumericSamples`, including sample sigma, signed mean, mean magnitude, RMS and original selected/valid/invalid/unavailable counts. This avoids creating another numeric engine or forcing the legacy index-only DC tracking routine into an unrelated context. No median is requested, so no sorting is introduced. Each supplied role is summarized once; no analysis is run per region. Positions are travel-percent levels; applied correction is percentage points. These are **logged request signals, not measured physical airflow**.

The caller supplies unique strictly increasing original indices. Invalid/duplicate/unsorted selection definitions throw before calculation. Source-outside indices, missing time/grid entries and timestamp mismatches count as unavailable. Invalid/nonfinite RPM or role measurements count as invalid when aligned evidence exists. There is no interpolation, zero filling, positive-RPM filter or silent requalification. Nonpositive but source-valid RPM remains recorded context; operating-state interpretation belongs to the controller/assessment, not an invented core filter.

The aligned path reuses input selection and validity arrays. If a role must mask invalid RPM, only its validity mask is copied. If it must mark missing/misaligned evidence, only that role's aggregation index mapping is copied, with the shared aggregator's unavailable sentinel. Original channel arrays, timestamps and the accepted selection are never mutated. These are bounded loops, with no sample-sized spread or full-log extrema operation.

Each role reports missing, incompatible-unit, available, no-valid-evidence or nonfinite-metrics. Missing/incompatible roles have no synthetic statistics. Empty/all-invalid aligned scopes retain real coverage counts and unavailable means. Nonfinite derived aggregates are explicitly flagged rather than presented as available measurements. The aggregate status is recorded-context only when all three roles have usable complete selected evidence, limited when some usable evidence exists and unavailable otherwise. These statuses describe supplied selected indices only; requested-extent completeness and physical source-integrity warnings remain the existing controller/source owner’s authority. No mode can treat these statuses as a verified controller/idle state.

Core unit authority must be explicit: `%`/`percent` for positions, also `pp`/`percentage points` for correction. Unitless, mass-flow, pressure, steps and fraction representations are refused. `%` on a verified correction binding means percentage-point magnitude, not a fractional percentage conversion. The future native adapter must use current role/catalog authority; passing a unit string does not independently establish signal identity or a tune association.

## Numerical reference cases

| Recorded input | Expected fact |
| --- | --- |
| Base `[20,22,24,26]` % | Mean23 % |
| Applied `[-2,4,6,-4]` pp | Signed mean1 pp; mean magnitude4 pp; RMS√18 pp |
| Final `[18,26,30,22]` % | Mean24 %; sample sigma√(80/3) % |
| Selected original indices40,42,43, with RPM42 invalid | Applied valid values−2/−4: signed mean−3, RMS√10; one invalid selected record |
| Role starts at41; sample42 timestamp201 instead of reference200; sample43 invalid | Of four selected indices: one valid, one invalid, two unavailable; no nearest-point substitution |
| Canonical seven-record retry/CRC fixture | Five valid context samples and two invalid original attempts; missing final request stays missing |
| 320,459 aligned constant samples | Exact valid count; constant mean and zero sample sigma; no argument-limit failure |

Role means use their own valid aligned denominators. They do not imply that aggregate base+correction equals final, that raw PID terms equal applied correction, or that a table requires alteration. No watch/saturation thresholds, firmware limits, tune interpolation, gain recommendations, controller cadence or causal classification are added.

## Validation

- Production build/typecheck passed; existing bundle-size warning remains.
- All seven new numerical tests passed in the first full unit attempt, including >320k samples and nonfinite-derived status. Two unchanged existing large-data tests timed out while build/unit/browser work overlapped. Thresholds were not changed; an isolated single-worker full gate is required below before committing.
- Targeted browser gate: **184 checks across 14 groups passed** in worker/fallback configurations. Existing canonical/scale browser cases now additionally call the Airflow foundation and verify original validity, missing roles and 320,459 samples. Base Airflow is still disabled.
- Isolated full unit gate: **1,075 tests across 149 files passed** with unchanged time limits and one worker.
- Final full browser gate: **1,535 checks across 168 result groups passed**, sequentially after the isolated unit gate.

An initial new expectation compared Welford mean with exact1; the source calculation produced1.0000000000000002. The assertion now uses numerical tolerance, retaining the shared implementation without rounding source facts. Production typecheck also caught a new test passing an explicit undefined optional property; the test now omits it. These attempts are not represented as passed gates.

Artifacts are under `/workspace/epicscope-idle-airflow/` and adjacent named logs. No private recording bytes or new native UI were added. This core function is exercised directly by browser tests; there is no user-action path to the new capability until its next bounded integration stage. Existing Stability browser coverage remains relevant to production behavior.

## Completion and next boundary

[Stage status](NATIVE_STAGE_STATUS.md): stage 3 now has a tested Base Airflow core capability, while other modes/events remain incomplete. Stage 4 is unchanged; Base Airflow UI is not implemented. Stage 1's Base Airflow numerical/unit/alignment prerequisites now have executable reference coverage; its remaining mode gates remain open. Stage 2's current primary-source Stability boundary remains complete.

After review, the next bounded stage is to integrate this retained context into the existing native Idle controller and Base Airflow view. Reuse canonical role mapping, accepted selection/qualification, cached traces, original-index graphs and lifecycle generations. Compute/retain context at semantic evidence changes, not on tabs/viewport/mode presentation changes. Show per-role counts and units, handle missing capabilities honestly and do not turn correction magnitude into a tune-table diagnosis. Stop again for native browser/manual acceptance. No additional mode, comparison, persistence or tune-writing work is implied.
