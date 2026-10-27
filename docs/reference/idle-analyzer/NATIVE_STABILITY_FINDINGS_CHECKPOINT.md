# Native Stability — descriptive findings and next-test checkpoint

Continues `ui/idle-analyzer-html-integration` from `301f0096c772ea09c41203c62029dc051b38d722`. Implements the next bounded item after scope/discovery feedback: data-dependent Stability observations, evidence eligibility and repeatable next-test guidance. No automatic tuning instructions, writes, comparison, extra modes or main merge.

## HTML reconciliation and qualification boundary

The frozen HTML's final `realAssessment()` Stability override describes measured sigma, target error, minimum RPM and operating context; its final Next Test tab separates recommended action, controlled conditions, supporting evidence and contradictions. It does not establish controller-gain causality. Earlier superseded prototype heuristics are not native analytical authority.

Native findings use the accepted production result and retain production n−1 sample sigma, actual−target sign, inclusive deduplicated region union and valid-pair denominators. The native channel set currently establishes RPM/target and optional logged controller requests. It does **not** establish warm-engine, closed-throttle idle, pedal intent, matched physical load or source/tune association. These are explicit limits in all assessment tabs. Physical TPS alone must not be substituted for driver intent. The prototype's physical-TPS coverage is not fabricated as0% when its role is not mapped.

“Evidence status” is eligibility for descriptive recorded measurements, not an automatic qualified-idle or tune-quality verdict. Warm/throttle/state qualification remains a separate feature stage.

## Typed findings and current owners

- `core/analysis/idle-stability-assessment.ts` projects accepted aggregate facts in O(1); it never reads raw samples, error arrays or index arrays, imports another source, fits parameters or performs per-region analysis.
- It distinguishes no RPM, one-point evidence, missing/insufficient paired target, partial returned scope, unpaired RPM, excluded measurement counts, nonfinite derived metrics, nonpositive RPM, wide logged-target span, signed mean offset and within/outside reference-band coverage.
- A target span wider than twice the existing reference band is labeled mixed target conditions. The width is a disclosed reference comparison, not a universal firmware limit. Target range explicitly uses target-valid samples; tracking uses aligned valid pairs.
- Nonpositive RPM triggers mapping/operating-scope review; negative source values are not asserted to prove an actual engine stop. A one-point match never becomes evidence of steady idle. Nonfinite derived metrics never become baseline guidance.
- Excluded invalid records can be recovered retry attempts. Counts alone do not establish unrecovered physical loss. Invalid/shared retry counts do not automatically downgrade declared coverage or invent a gap; actual missing pairing/coverage limits eligibility. Source-integrity review is stated explicitly.
- `apps/web/src/pages/idle-stability-assessment.ts` maps typed facts/rule codes into readable observations and prioritized next tests. No rendered text drives analytical state; internal rule codes are not presented as user-facing configuration.
- The existing `idle-analyzer-view.ts` computes the assessment/presentation once when a fresh primary analysis accepts. It retains them alongside the numerical result and projects them into Diagnosis, Evidence and Next Test. Source/scope/role generation rejection remains unchanged. Focus, tabs, trace/viewport navigation and unchanged unions reuse the retained assessment.

No new roles, channel reads, source caches, observers, global listeners, workers, lifecycle wrappers or dependencies are introduced. Existing parsers, Logger interfaces, tune/model ownership and production graph boundaries remain unchanged.

## Changed UI behavior

Diagnosis now shows Evidence status, measured minimum/sigma/RMSE/signed error, applicable named findings, explicit limits and the relevant next test. Evidence retains original mapping/coverage/unit definitions and adds eligibility and distinct target-valid/paired counts. Next Test uses the HTML's Recommended action / Hold constant / What would support it? / What would contradict it? structure.

Guidance priorities are source/numerical validity, sufficient observations, nonpositive operating scope, target mapping, actual coverage/pairing, matched target levels, repeatable signed offset, repeatable excursions, and retained descriptive baseline. Priorities do not rank tuning interventions. All-band observations explicitly are not a universal pass criterion or proof of correct tuning. No oscillation frequency, lag, sag/recovery event, control-loop timing, root cause, gain value or table adjustment is inferred.

## Independent numerical/reference cases

| Recorded case | Expected finding / next test |
|---|---|
| No valid RPM | Unavailable; verify source/mapping/inclusion |
| One900RPM /900target point | Limited variability/paired evidence; select repeated observations |
| RPM960,1040; target1000 | Both pairs exactly inside±40; baseline repeat, not a tuning pass |
| RPM950,1050; target1000 |0% inside±40; mean error0, RMSE50, sample sigma√5000; repeat excursions |
| RPM1100,1100; target1000 | Sigma0, mean error+100, RMSE100; signed offset above target |
| RPM900,900; target1000 | Mean error−100; signed offset below target |
| RPM0,900 | Review nonpositive source/operating region; no steady-idle claim |
| Matched RPM/target900,1200 | Target span300 exceeds80RPM reference width; compare matched target levels |
| Two valid pairs plus shared invalid retry attempt | Excluded counts disclosed, no invented unrecovered loss; valid-pair metrics remain descriptive |
| Target invalid at one of three valid RPM samples | Two valid pairs,100% paired in-band coverage; limited pairing, not3/3 healthy |
| Explicit region union excluding intervening4000RPM | Findings use the selected unique samples, independent of graph overview/focus |

No existing mathematical convention changes. For the two-point950/1050 example, production sample sigma is70.7107; population sigma would be50. That intentional n−1 distinction is retained rather than copied from an alternate prototype convention. Pure projection tests also refuse raw error/index access and reject nonfinite derived statistics as usable assessment evidence.

## Validation

- `npm run build`: passed (TypeScript + production Vite bundle); existing >500kB bundle warning remains.
- `npm test -- --maxWorkers=1`: **1,048 tests /146 files passed**.
- Focused staged/fallback Chromium: **170 checks /14 groups passed**.
- Final full staged/fallback Chromium: **1,521 checks /168 groups passed** (`CHROME_NO_SANDBOX=1 BROWSER_RESULTS_DIR=/workspace/epicscope-idle-findings/full-browser-final npm run test:browser`). Each configuration includes24 Idle checks; Brush code/assertions unchanged.
- Five frozen HTML hashes, checkpoint links and `git diff --check` verified.

Native production mouse/keyboard actions used the supplied INI and real2,000record October25 prefix (1,995trusted RPM-target pairs):

- Full-log analysis produced excluded-record context plus outside-band observations. The two included0–5s/15–20s intervals selected771valid pairs and produced all-observed-pairs-within-band guidance. Suggested next tests changed from repeating excursions to retaining a descriptive baseline.
- Viewing either region retained771sample combined findings. Existing Diagnostics snapshots confirmed2analysis requests/2accepted records throughout these focus changes, with every captured physical-read counter unchanged (ordered report counters1,1,1,0; overlapping layers are not unique I/O totals).
- Native target removal made target-dependent metrics unavailable, produced RPM-variability-only findings and a mapping/alignment next test. Restoring the canonical target restored within-band findings. No raw-data recomputation was introduced for tabs/focus.
- Native use reproduced a pre-existing presentation defect: Unit authority/setup note retained the old target after deselection. Fixed at the current owner with one shared typed mapping-description projection, synced on role changes and consumed directly by Evidence rather than reading old DOM text. Also corrected unavailable band coverage from “Unavailable%” to “Unavailable”. Browser regression and the full gate were rerun; final native Evidence/setup now report `target: unavailable` consistently.
- Native actions recorded zero uncaught browser exceptions; screenshots of Diagnosis, Evidence, next tests and missing/restored target were inspected. Pre-fix evidence is retained separately for review.

Artifacts and private-source screenshots stay outside Git under `/workspace/epicscope-idle-findings/`; source INI/MLG bytes are not committed.

## Remaining acceptance

Qualified operating-state filters, purpose/split/merge, further diagnostic modes, independent recording comparison, tune-table context, persistence and test plans remain deferred. The real prefix supports workflow evidence, not full October21 recording or large-log hardware acceptance. Review the data-dependent Diagnosis/Evidence/Next Test tabs, source/mapping limitations, scope/focus separation and changed results after inclusion edits before the next stage. No push or main merge is implied by this local checkpoint.
