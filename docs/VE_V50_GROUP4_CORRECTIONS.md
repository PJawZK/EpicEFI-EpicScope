# VE v50 — new plan Group 4 corrections

Implemented from Group 3 audit commit `25dce30aadded52f0c3890c8df8ecd42bb489b84` on `fix/ve-v50-reviewed-groups-1-7`. No merge to main or ECU write/Burn. The exact result SHA and final validation are in `/workspace/epicscope-v50-next-group4-validation/REPORT.md`.

## Corrected behavior

- **N01 — sparse exact lookup:** analytical brackets collapse an exact interior breakpoint to its own node. Working delay and target lookups require only corners with nonzero influence. Exact200ms node lookup no longer fails because its unused neighbor is empty. Used nonfinite delay corners return unavailable. No extrapolation or approximate-coordinate snapping was added.
- **N02 — missing refined delay:** a missing/nonfinite/negative engine-point working delay now withholds the observation. If the one allowed refinement moves the final engine point into a hole, its availability is checked there too. This verifies support without applying another refinement or substituting another point's delay.
- **N03 — alignment origins/metadata:** derived actual/RPM/load/trim arrays all use the observation range's startSampleIndex. Source arrays stay untouched. Raw quality, full-statistics and envelope metadata are omitted from derived ranges because their geometry/values/validity no longer describe those arrays.
- **N04a/b/c and B01 — analytical axes:** saved delay parsing rejects descending, duplicate, folded and nonfinite axes. VE readiness rejects incompatible VE/target RPM/load axes with actionable errors; current-log discovery is disabled for incompatible VE geometry. Core analysis/discovery job boundaries validate axes once per job. `ve-axis-validation.ts` is a shared pure invariant, not another state owner. **No axis or table values are silently reordered.** Independent table editing still supports descending physical coordinates.
- **N05 — selected counters:** delay-unavailable counts follow selected observation identity and multiplicity, including duplicates. Unselected failures do not inflate input counts. A bounded scan of explicit selected indices performs the accounting; a full-range caller without a selection counts in the existing alignment loop. Invalid observed mixture values/times remain invalid inputs rather than becoming missing-delay observations.

The existing VE owner, core analysis functions, saved-table parser and semantic edit owners keep their current responsibilities. No global listener, observer, lifecycle wrapper, instrumentation, worker boundary or alternate model was introduced.

## Numerical differences

All seven former expected failures are now ordinary passing regressions with the same reference expectations:

| Case | Before | After |
|---|---|---|
| N01 | Exact known200ms node unavailable |200ms |
| N02 | contributing1/unavailable1 |contributing0/unavailable2 |
| N03 |0 contributions at shifted input origins |2 contributions |
| N04a/b/c |Incompatible saved axes accepted |Rejected with axis-specific error |
| N05 |input1/unavailable1/contributing1 |input1/unavailable0/contributing1 |
| B01 |Descending tune axis ready, successful zero-contribution run |Axis blocker; Run and current-log discovery do not read traces |

Valid-reference arithmetic is preserved: same-scale AFR/Lambda ratios, known applied trim, inverse-CDF weighted statistics, interpolated discovery percentiles, prior blending, raw-limit ordering, one-refinement approximation, physical editing interpolation, pin/Brush rules, clamp/strength and delay edit snapping. Retained primary/evidence reuse and source caching/storage are unchanged. This is a correctness correction, not a claim of faster decoding or full-log analysis.

## Regression coverage

The shared ledger now has50 ordinary reference cases: the original42 agreeing cases, seven corrected N cases and R43, a320,459-observation selected-accounting case. The unit suite and real-browser numerical acceptance both execute it; no expected-failure exception remains.

Additional unit cases cover sparse2D nodes/edges/required corners, invalid geometry at core job boundaries, duplicate/invalid selections, invalid observed values/times, independently indexed trim/engine inputs, sync/async equivalence and a hole reached after the permitted refinement. Browser cases mount the production chain, load a valid independent delay table alongside invalid tune axes, verify actionable blockers/no trace reads/no original tune mutation, and reject an invalid saved-delay replacement while keeping accepted primary/working values.

The failed saved-file attempt still follows the existing edit adapter's picker-time transient-interaction/history reset. The preservation assertion concerns accepted working values/primary authority, not a new promise to retain drafts/selection/history across failed delay-file choices. Review that existing workflow separately in Group6 if transactional UI-history preservation is desired.

## Deliberately unresolved decisions

Group 4's reproduced mathematical/boundary defects are corrected. The following audit questions remain explicit decisions rather than silently altered algorithms:

- B02 engine-event versus observation-index state exclusions and recovery authority.
- OLS stability versus large excursions and continuity across large valid timestamp intervals (R28/R29).
- More than one delay refinement, changed raw-limit ordering, different quantile conventions, clamp/strength interpretation or millisecond snapping.

Compensated 'Mixture error' naming/source authority and sparse raw-event provenance remain Group5. Completion dialog/navigation remains Group7; Logger timeline/scope identity remains Group8; exact frozen-HTML parity/visual precision remains Group9. The unavailable frozen HTML and actual approximately1.2GB user MLG/hardware remain validation limits.

Stop at this group boundary for review/manual acceptance. No push or main merge is included.
