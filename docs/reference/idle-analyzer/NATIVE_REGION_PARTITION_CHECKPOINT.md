# Native Idle Analyzer — region split/merge checkpoint

Branch: `ui/idle-analyzer-html-integration`. Parent checkpoint: `3915ecdca9a4a0c75579317464f891b5efa7a74e`. Scope: complete the accepted HTML's managed-region split/merge workflow through the existing native region session. Stop for manual review; no push or merge is included.

## Implemented workflow

Manage regions now exposes a precise **Split at (s)** input and **Split** action on each row. The default split time is the midpoint; the entered value must be finite and strictly inside the accepted source-time bounds. A split creates two touching intervals, preserves the first region ID and gives the second a new ID. Both retain inclusion, candidate/manual origin and existing manual-bypass eligibility. The 200-region limit also applies to splits. Invalid requests leave the previous region array and accepted results intact.

Each row also has an explicit **Merge target** selector and **Merge** action. Only compatible targets are offered. Both regions must overlap or share an endpoint and have the same inclusion state, origin and manual-bypass eligibility. A merge retains the initiating region's ID and label, removes the target and moves graph focus to the retained region when necessary. Gapped or incompatible regions cannot merge: filling their bounding envelope would silently add samples or alter qualification policy.

Splits partition existing intervals rather than becoming new manual overrides. Candidate children therefore do not become bypass-eligible merely because their bounds were partitioned. Discovery's minimum duration is not silently reapplied to reviewed region partitions. The common manual-bypass eligibility predicate is shared by the region session, merge validation and qualification plan.

For combined included analysis, splitting and compatible merging preserve the exact sample union, including shared-endpoint deduplication, exclusions and source validity. Existing retained source columns and semantic analysis keys remain authoritative. When the union/policy is unchanged, accepted numerical evidence is reused while region-count and scope metadata update. No new parser, source cache, graph authority or lifecycle mechanism is introduced.

Draft start/end fields still require **Apply** before a split or merge uses them. When the current analysis is the legacy single-manual-region scope, operations affecting that selected region require **Analyze included regions** first. This avoids silently shrinking the active analysis to one split child or activating unrelated checked regions. No inclusion choices are silently rewritten. Logger scope and graph-focus ownership remain unchanged.

The dialog uses its existing bounded scrollable table at narrow widths. No EpicScope header/footer or standalone HTML chrome is copied.

## Focused correctness correction

A new region API regression case uncovered that `edit(id, bounds, label)` previously spread all properties of its bounds argument into the stored region. Passing a structurally valid full region object could therefore restore an outdated inclusion flag. Existing UI callers already passed plain start/end bounds; no user-visible reproduction is claimed for that call path. The method now copies only start/end, preserving session-owned inclusion and origin. The regression checks a retained full-region bounds argument after exclusion.

## Validation

- Production build and TypeScript check: passed; existing large-bundle warning remains.
- Focused unit gate: **34 tests across four files** passed.
- Full unit gate: **1,061 tests across 147 files** passed.
- Focused browser gate: **178 checks across 14 groups** passed in worker/fallback configurations, including final bypass and scale assertions.
- Final full browser gate: **1,529 checks across 168 result groups** passed in worker/fallback configurations.
- Native production-preview Chromium: **eight action checkpoints** passed using the supplied INI and private canonical 2,000-record MLG prefix. Mouse/keyboard input drove controls; no application handler invocation or added application instrumentation.

Native recorded reference cases:

| Operation | Managed intervals | Valid RPM samples |
| --- | ---: | ---: |
| Include 0–5 s and 15–20 s | 2 | 771 |
| Reject split at endpoint 0 s | 2 | 771 |
| Split 0–5 s at 2.5 s | 3 | 771 |
| Merge the two touching children | 2 | 771 |
| Exclude 15–20 s | 2 | 337 |
| Split the excluded interval at 17.5 s, width 390 px | 3 | 337 |
| Merge those excluded children, width 390 px | 2 | 337 |
| Close dialog at width 390 px | 2 | 337 |

Native checks also verified that the gapped second region was not offered as a merge target, target focus transferred to the retained region, zero uncaught browser exceptions occurred, and the narrow document did not overflow horizontally. Screenshots of desktop and narrow controls were inspected. Table content intentionally scrolls within its container.

Browser regression covers inclusive endpoint deduplication, unchanged metrics and retained-read counts, metadata freshness, excluded partitions, navigation retention, explicit single-manual-scope refusal and qualification/manual-bypass preservation. The 320,459-sample browser reference splits and merges without duplicate samples, source re-reads or changed zero-RMSE results. Unit cases cover overlap in either temporal order, invalid/missing identities, transactional rejection, source reset, candidate/manual policy compatibility and the region limit.

The first full browser attempt stopped because a new scale assertion compared the localized `320,459` display directly with `320459`. The assertion now normalizes the display separator, as the pre-existing scale check does. This was a test expectation error, not a changed sample count; the corrected focused gate passed both configurations before the final full gate.

Local test logs, native screenshots and reports are under `/workspace/epicscope-idle-partition/` and adjacent named log files. Private recording and INI bytes are not committed. The five frozen HTML snapshots remain unchanged.

## Remaining boundary

This stage adds split/merge only. Purpose tags and purpose-aware diagnostics, further diagnostic modes, independent two-recording comparison, tune context, persistence and test plans remain separate work. It does not establish firmware-qualified idle, optimize unrelated full-log algorithms, change VE editing/save behavior or write ECU/tune data.

Review split time entry, compatible merge choices, excluded-region handling, qualification counts and shared Logger navigation before advancing. Full-recording/hardware acceptance is not established by the bounded prefix or synthetic scale test.
