# Native Idle Analyzer — Stage 5 descriptive Stability comparison

Branch: `ui/idle-analyzer-html-integration`. Builds on independent-B checkpoint `41c487a6d24d9eb438ff18af44544f8c9e1ef095` and published Logger fixes through `c38825ac4d04135358fdd53215f92126b721833a`. No merge or push included.

## Working bounded slice

Open **Recording B**, load/select B and **Preview B stability**, then **Compare accepted A / B**. A is the primary analyzer's accepted Stability evidence: choose its existing Analysis scope (Full Log, Logger range, manual, Viewed, or included union) outside this dialog and run analysis. B uses its independently accepted bounds/channels. Graph focus alone does not change A's analytical scope. Changing a region means accepting the appropriate analysis scope, not reading rendered graph text.

Comparison presents mean RPM, sample σ, target-error RMSE and within-band percentage for each source, plus descriptive **B−A** differences. It labels recording names, selected channel roles, accepted regions, qualification policy, canonical valid/invalid/unavailable RPM counts and valid/invalid/unavailable target-pair counts. No ECU/tune writing, improvement verdict, chronology, matched operating conditions or causal conclusion is inferred. Loading the same file in both slots is not evidence of an independent experiment.

## Reused owners and invalidation

- Primary Idle controller exposes its current accepted result through a typed callback; original Logger remains primary source authority. No second primary-region state or read pipeline is introduced.
- Existing B source/view retains canonical importer, transactional replacement, original-index preview, role selectors and bounds. Its unchanged preview cache remains healthy.
- `core/analysis/idle-stability-comparison.ts` projects four metrics from retained accepted facts. It does not traverse sample arrays, align/resample populations, read channels or perform full-log analysis. Repeated Compare does not re-read either source or recalculate Stability.
- Primary evidence withdrawal/acceptance clears comparison presentation; real B source/range/mapping changes withdraw it with the existing preview. Invalid B drafts and failed replacement retain prior accepted authority. Reopening explicitly requires Compare again; comparison presentation itself is not persisted.
- Comparison has no asynchronous computation/publication. Existing import/preview generations remain the cancellation boundaries. Every Compare synchronously obtains current accepted A and B; a later B preview cannot publish an earlier comparative result.
- Dialog navigation and source operations remain native EpicScope UI; shared header/footer, frameworks, source stores and Logger ownership are unchanged. No new global listeners or observers.

## Numerical definitions and conservative gates

B−A uses full-precision accepted values; display rounds to two decimals. Differences may therefore differ by 0.01 from subtracting displayed rounded values. Mean and sample σ retain production definitions; RMSE uses each source's own exact-index/time-aligned valid target pairs. In-band differences are **percentage points**, not relative percent change. Unequal durations/populations are not falsely sample-paired or resampled.

A numerical reference: A RPM [900,1000,1100] against target 1000 has mean1000, sample σ100, RMSE sqrt(20000/3), within-band100/3%. B [1000,1000] has mean1000, σ0, RMSE0, within-band100%. B−A is 0 RPM, −100 RPM, −sqrt(20000/3) RPM, +200/3 percentage points.

Production aggregation reports zero spread for one valid sample. This comparison intentionally requires **at least two valid observations** for sample σ and shows Unavailable otherwise; no single-source production behavior is changed. Missing target blocks target metrics only. Nonfinite/overflowed differences remain unavailable. Partial requested coverage blocks all deltas, while retaining each source's independently available facts. Different band definitions block only the in-band delta.

This slice compares unqualified recorded scopes. If either side has qualification enabled, the table shows its facts but **withholds all deltas** with an explicit policy mismatch. B qualification/matched-condition assessment is not implemented or silently borrowed from A. The same conservative gate applies even if a qualified A happens to select identical samples. Throttle, temperature, loads and tune matching remain unverified; no false confidence tier is generated.

## Browser and supplied-file evidence

Staged-worker and fallback action tests load canonical B CRC/retry fixtures, compare with accepted primary, change the two region owners independently, reject invalid drafts, repeat comparison without primary reads, and verify qualification gating and release invalidation. Existing tests retain failed/overlapping-import, stale-preview, missing-target, metadata-cache isolation and navigation coverage.

Production Chromium used native file controls, mouse/keyboard actions, the private INI and canonical 2,000-record prefix in two independent source lifetimes:

| Scope | Valid / invalid RPM | Mean RPM | Sample σ RPM | Target RMSE RPM |
| --- | ---: | ---: | ---: | ---: |
| A full prefix | 1995 / 5 | 898.57 | 18.72 | 18.76 |
| B15–20s | 434 / 2 | 901.09 | 13.96 | 14.00 |
| A10–15s | 404 / 1 | 897.13 | 17.43 | 17.62 |

B−A full-prefix→selected-B mean difference is +2.51 RPM at full precision. Changing only A to10–15s changes that difference to +3.95 RPM while retaining B's15–20s range. Identical full-prefix scopes give zero differences. Results carry read-only warnings throughout. Four native checkpoints passed, including390px dialog/table bounds, with no runtime exceptions. Private bytes are not committed. This does not establish full1GB/hardware performance.

## Validation and stage status

- Focused numerical comparison tests:6 passed.
- Full unit suite:1,140 tests /158 files passed.
- Targeted worker/fallback browser suite:286 checks /14 groups passed.
- Production build:passed; existing bundle-size advisory remains.
- Native production replay:4 checkpoints passed.
- Full staged/fallback browser gate:1,677 checks /176 result groups passed.

Artifacts: `/workspace/epicscope-idle-comparison/`; logs: `/workspace/epicscope-idle-comparison-*.log`.

**Stage5 remains partial:** independent B and first descriptive Stability comparison work; matched qualification/conditions, B region collections, baseline/candidate experiment contracts, tune references/diffs and elapsed/normalized/event graph alignment remain. Stages1–4 remain partial at their recorded capability boundaries; Stage6 persistence/plans remains partial; Stage7 manual/full-feature/hardware acceptance remains open. HTML parity is not complete.

Next bounded stage: B qualification and explicit condition-comparability contracts, followed by source-labeled comparison graph alignment. Persistence and additional comparison modes remain separate checkpoints. Stop for manual review now; do not merge to main or automatically start the next stage.
