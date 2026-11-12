# Nonmonotonic timestamp query correctness — 2026-11-09

Branch `ui/idle-analyzer-html-integration`; starting commit `f02a5b4b38e016953ac94b94c6c89f8db9515fb4`. The accepted Logger zoom/pan, boundary clipping and fixed time-control layout are preserved. No firmware/ECU, file-writing, original recording or unrelated UI changes. Local validated checkpoint; stop for review/manual acceptance, no merge into `main`.

## Phase A — ownership and reproductions

### Canonical authority

`core/parsers/mlg/mlg-records.ts` owns original offsets, modulo-unwrapped canonical timestamps, counters and CRC validity. Index positions remain original attempts, including invalid retries. `mlg-integrity.ts` annotates existing classified diagnostic offsets; offset arrays are monotonic independently of time. Neither owner was changed. A clock regression is confirmed source evidence, not proof of ECU reset, missing packets or physical backwards time.

`mlg-parser.ts` and `mlg-import.worker.ts` publish the same canonical index and time extent through fallback/staged paths. `MlgNumericChannelDataSource` owns original-index reads and time-based fetch covers. Bound INI, persistent-column and sidecar sources delegate those fetch covers; they do not need independent query policies. Blob/cache/source identity and original files remain intact.

Timestamp arrays are immutable after publication; extending/replacing/deriving a time geometry publishes a new array. CRC validation can update validity without changing timestamp metadata. The new query metadata is cached weakly by timestamp-array identity, so it does not pin released recordings or depend on mutable CRC/value flags. MLG source construction initializes it before interactive queries; parser/worker extent calculation reuses it. Partial/derived arrays acquire their own metadata once; no global listener or observer was added.

### Verified October recording

Used the complete original `/workspace/epicscope-mlg-investigation/input/2026-10-25_15.20.05.mlg`, with the existing supported incomplete-tail retention contract: **159,022 complete records**, 28 unrecovered CRC attempts and the separately excluded incomplete tail. No transport parts were used. Both records on either side of each listed regression are checksum-valid with sequential counters.

For a ±0.1 ms region around the regressed timestamp, a source-order membership oracle and actual production query gave:

| Original index | Record byte offset | Previous → current canonical ms | Old → corrected trusted member indices | Old → corrected mean RPM |
| ---: | ---: | --- | --- | --- |
| 40,913 | 284,477,734 | 526688.65 → 526623.03 | [] → [40913] | None → 966 |
| 41,685 | 289,826,922 | 539163.64 → 538873.50 | [41662] → [41662, 41685] | 966 → 959 |
| 91,924 | 637,932,953 | 1274516.17 → 1274428.44 | [] → [91924] | None → 1099 |

The first and third windows incorrectly appeared empty. The middle window lost index 41,685 even though it shares the selected timestamp region with index 41,662. Corrected counts/means exactly match the unchanged original RPM measurements. No RPM value is recalculated or repaired.

The source fetch cover also omitted these later original records. Corrected fetch covers contain all matches plus context: four records at the first location, 26 at the middle location, seven at the third. Fetch cover is not exact membership; intervening out-of-scope records keep their original positions and validity and are filtered by indexed membership at the consumer.

An independent wire fixture `[0,10,20,5,30]`, region `[4,11]`, produced four failing-before tests: raw membership, direct/block envelope count, nearest original sample, and source fetch cover. Additional failing-before tests prove AFR response discovery across a backward boundary, Boost spool completion across a regression still above its initial time, and legacy temporal event calculations across multiple source runs. Logs are retained; not inferred from CI.

### Affected-consumer inventory

| Consumer / owner | Confirmed issue and correction / unaffected distinction |
| --- | --- |
| Logger source `sampleRangeForTime` | Global binary bounds could exclude later source records. Now queries original runs and returns a contiguous original-index cover. Wrappers inherit it. |
| Logger raw trace, direct/block envelope, cursor/hover | Missing members, wrong nearest record and backwards connections. Queries now include all qualifying original indices; presentation keeps runs separate. Envelope block acceleration remains unchanged on monotonic sources; nonmonotonic envelopes query visible run spans directly. |
| Idle plot `sliceNumericRangeByTime` | A single binary slice lost observations. Now returns a zero-copy source-index cover; the plot uses exact indexed membership. It does not compact/renumber matches. |
| Range Statistics, Histogram, generic aggregation, qualification | Existing source-order/time-filtered membership was already healthy when given complete ranges. Source fetch/plot correction prevents incomplete upstream input. Range-coverage extent and finite-time checks now use actual finite min/max, rather than first/last ordinal samples. |
| Timeline navigation, A–B and saved regions | Scalar bounds/annotations do not binary-search source timestamps. Preserved. Correct global min/max extent ensures a regressed final record cannot truncate visible history. Accepted fixed control geometry remains unchanged. |
| VE evidence and delay-table alignment | Global time interpolation could choose another original history. Explicit original observation anchors now restrict lookup to one monotonic run; stable qualification segments also end at run changes. Independent monotonic engine/observation origins remain supported (N03 reference preserved). |
| Native Idle stability / qualification / candidate / recovery | Statistics use source-index alignment and time predicates, not global binary search. Candidate/recovery code already splits/censors backwards/equal time as appropriate. Plot lookup/slicing now corrected; no new diagnostic interpretation. |
| AFR response-delay analyzer | Lookahead could skip a negative delay and later accept a response from the next run; spacing state could also survive a backward jump. Response history now ends at command/mixture run boundaries and candidate spacing resets there. |
| Boost temporal events | Open-loop spool already reset nonconsecutive/backwards histories. Target-based spool could survive a regression above its initial time; now resets on nonincreasing time/nonconsecutive original index. Existing steady-state/ignition-behavior guards remain. Fueling operating-map and Ignition review-region rolling windows already split on nonincreasing source time/record discontinuity; their time-ordered window policies are unchanged. |
| Legacy specialized Idle sag/recovery, AE transients, knock and threshold events | These detectors do not have a justified multi-run combination policy. Cross-run selected histories now report an explicit “one monotonic source segment” error instead of silently producing temporal events. Order-independent aggregates remain supported; legacy Idle can use its existing `includeSagEvents:false`. Native Idle stability is unaffected. |
| Aligned Analyzer event evidence | Unanchored global nearest lookup could select another history. Evidence carries available original onset indices (including AFR and Ignition mappings); lookup stays within that event's run. Nonmonotonic evidence without provenance is unavailable, not guessed. |
| Source integrity bridges | Time-only marker metadata cannot disambiguate overlapping histories. Bridges use run-local lookup; ambiguous overlap suppresses the bridge, not the source icon/diagnostic. Existing same-time recovery and CRC exclusions remain. |
| INI/config table axis brackets; channel-value ranking insertion | Binary search is over validated sorted axes or sorted scores, not the canonical timestamp array. Unaffected. |
| Sorted integrity markers / merged range bounds | Explicitly sorted derived presentation metadata, so binary search remains valid. Canonical source records are not sorted. |
| Live Shim capture | Existing append/segment rules reject regressing capture time; its time binary searches are therefore valid. No live/firmware/ECU path changed. |

The inventory separates proved membership defects and temporal counterexamples from independent physical/firmware hypotheses. It is not a certification of every possible specialized detector or asynchronous cross-recording alignment. Arbitrary external unsorted `sampleIndices` are not a new supported temporal input contract; production qualification supplies original-index order.

## Phase B — query design and temporal policy

### Strategy evaluated

- Repeated linear filtering is correct for membership but unacceptable for repeated navigation.
- Sorting/clamping canonical arrays, dropping records or compaction with a false contiguous origin would corrupt source identity/alignment. Rejected.
- Pure monotonic-run search is compact and efficient for the actual four-run recording, but unbounded run traversal degenerates toward full-record work for consecutive regressions.
- **Implemented hybrid:** `core/log-model/time-query-index.ts` builds finite nondecreasing source runs once. At most 64 runs use bounded run-local binary searches. Above that bound, a separate Uint32 **original-index permutation** sorted by `(timestamp, original index)` supports binary lookup; membership results are restored to original-index order and coalesced into contiguous source spans. This sorts lookup metadata only, never source timestamps/values/validity, and is never supplied as chronological analysis input. Full-extent queries return original runs directly.

The actual October source has four runs: `[0,40913)`, `[40913,41685)`, `[41685,91924)`, `[91924,159022)`. It needs **no permutation**. Its measured independent metadata construction was 5.331 ms, excluding file I/O/decode. Its time extent remains 0–2,272,475.84 ms.

### Deterministic membership, duplicates and calculations

- Queries are inclusive, include every qualifying original attempt, and return source-index order. CRC/value validity is applied by the existing consumer, not rewritten by the time index. Nonfinite timestamps have no finite query membership; finite NaN channel values retain their existing independent quality treatment.
- Equal timestamps remain in the same run and all matching original records remain eligible for membership. Nearest lookup orders ties by distance, then lower timestamp, then earliest original index. It chooses an original observation before checking validity; cursor lookup does not hide an invalid observation by skipping to a healthier duplicate.
- Raw traces break at run boundaries; dense envelopes keep separate run provenance rather than merge overlapping histories into one bucket path. The accepted source-based continuity, actual extrema and clipped boundary-neighbor behavior remain within each run.
- Temporal interpolation requires a source-index anchor for a nonmonotonic history. Both interpolation brackets must belong to that anchor's original run. A target before that run's start is unavailable; another run covering the same numeric time is not substituted. Unanchored nonmonotonic interpolation is unavailable. Fully monotonic independent-index histories retain ordinary time interpolation.
- Exact interpolation uses the original anchor when its timestamp matches; otherwise the first exact source observation within the selected run is deterministic. Invalid/nonfinite chosen endpoints yield unavailable; they are not silently replaced by a different history. Thus ambiguity can reduce usable temporal evidence without changing canonical CRC/retry classification. No quality-dependent time-index cache is retained.
- Calculations needing strict time advance cannot treat duplicate time as a new elapsed interval. VE retains the original observation clock as explicit boundary provenance through delay alignment: a monotonic-looking derived engine clock cannot hide an original source regression. Segments end on either original run changes or nonincreasing aligned time; AFR/Boost histories stop/reset at their respective boundaries. Legacy temporal detectors without a segmented policy reject cross-run selection explicitly. This limitation is deliberate and reviewable, not a claim that membership alone makes those durations physically meaningful.

The contiguous fetch/slice compatibility contract can overfetch records between widely separated matches. Plot/statistical consumers must apply exact time membership; no invalidity mask is silently substituted. The implementation avoids repeated full **timestamp** scans. Pathological many-run source covers can still be broad and cause I/O/decode work if not retained by the existing column cache; discontiguous multi-span streaming is not introduced here. Actual tested October covers are small, and repeated Logger navigation uses retained columns. Measurement costs below exclude I/O deliberately.

### Numerical comparisons

- Actual RPM windows: empty→966, 966→959, empty→1099, with corrected counts 1/2/1 and exact original indices as above.
- Independent delay example: times `[0,10,20,5,15,25]`, values `[0,100,200,300,400,500]`, original origin 100. At target time 7, old global interpolation returned **70** from the wrong history. With anchor 104, corrected interpolation is **320** inside the 5→15 run. Without an anchor, or targeting time 3 from anchor 103, it is unavailable. The old result was evaluated from the exact baseline function, not an invented approximation.
- Variable-delay counterexample: original times `[0,100,200,150,250]` with RPM-dependent delay produced two contributing samples by combining an apparently monotonic aligned engine window across the source regression. Corrected sync/async results both contribute zero: neither original run independently supplies the required 150 ms stable interval. Original-clock provenance is retained by reference, without rewriting either clock.
- AFR counterexample: one apparent response crossing a regression becomes zero usable events with gap rejection. Boost counterexample: one apparent target-spool completion crossing a backward step becomes no completed event.
- Legacy cross-run temporal requests now error explicitly; the same four RPM observations remain valid in order-independent aggregation when sag events are disabled.
- All **50 VE numerical reference cases** pass, including independent sample-index origins, existing interpolation, correction authority and numerical policy cases. The extra VE-only original-clock guard was validated by sync/async regression, full numerical references and complete browser/build gates. No real-file VE tune/proposal comparison is claimed without a matched accepted tune/config; the actual-file numerical comparison is RPM membership/statistics.

## Phase C — validation and measured overhead

- **1,183 unit tests passed in 162 files.** Coverage includes monotonic data, isolated/consecutive regressions, duplicate timestamps, canonical rollover continuity and existing wire rollover fixtures, original flags, invalid/nonfinite measurements, narrow boundary regions, actual source fetch covers, complete finite extent after a final regression, anchored interpolation and >320k multi-run membership.
- **1,733 complete browser checks passed in 182 groups**, staged/fallback. Includes manually accepted Logger continuity/navigation/layout/hover checks and new actual parser/sidecar timestamp-query parity. The final production build and complete browser gate include the last VE original-clock-provenance correction.
- **70 focused browser checks in ten groups** passed, including query, source marker/CPU, hover and accepted trace/navigation presentation checks.
- Production build and TypeScript passed; existing bundle-size advisory remains. `git diff --check` passed.
- Production Chromium replay exercised the source-query implementation against the complete October source in fresh worker and fallback sessions; native seek/zoom/hover inspected all three regression locations, preserving original index 40,913 and 91,924 and deterministic earlier tied index 41,662. Both 41,662 and 41,685 remain in membership. Original CRC count/tail warning, source icons and overview marks remain. Zero captured runtime exceptions; screenshots inspected. Navigation button/bar rectangles match across the tested locations.
- A replay initially aimed outside its viewport because the accepted first zoom centers a clamped viewport near the start. The external harness now re-seeks after that first zoom. No accepted navigation code was changed to satisfy the replay; its initial debug screenshot/log is retained separately.

Measured locally using Node v24.19.0/Linux, independent processes per scenario, 320,005 timestamp entries. Construction excludes timestamp allocation, file read/decode and browser rendering. Each query pair is exact membership plus nearest lookup; 10,000 pairs per scenario:

| Scenario | Runs | Build ms | Mean query-pair µs | Exact extra permutation bytes |
| --- | ---: | ---: | ---: | ---: |
| monotonic | 1 | 3.831 | 1.004 | 0 |
| four-runs | 4 | 10.213 | 1.346 | 0 |
| many-runs | 321 | 45.487 | 12.177 | 1,280,020 |
| consecutive-regressions | 320,005 | 87.617 | 1.251 | 1,280,020 |

The 321-run case returns 320 original matches per narrow query; the monotonic/few-run cases return far fewer. These are not interchangeable workloads or universal hardware promises. Construction is O(N) for few runs, O(N log N) when a lookup permutation is needed. Repeated queries use cached metadata and binary searches/output work, not a new full-clock scan. Existing warm-lookup complexity tests now prepare source metadata before measuring interaction reads; one-time construction is measured separately here.

Memory: canonical timestamp/value arrays are not copied into a repaired data set. Metadata stores O(run count) source-span objects; many-run lookup adds exactly **4 bytes per finite record** (1,280,020 bytes here). Normal/four-run cases have no permutation. GC heap deltas in the small-run cases are noisy/negative and are **not** evidence of zero/negative overhead. The extreme 320,005-run descending case measured about **15,783,640 bytes additional JS heap**, plus the exact 1,280,020-byte permutation. That exposes a real worst-case trade-off instead of disguising it as constant memory. Weak ownership allows released time geometries/indexes to collect together. Node heap figures are engine/environment-dependent, not browser process RSS.

The actual recording's offset/time/counter/CRC arrays have the same combined SHA-256 before and after all query/numerical probes: `e7f5332132217df12de06e99a018021d20a815914694f67726c36569ffbd60b4`. This fingerprints source index content, not the whole file. The original file was opened read-only; its whole-file SHA-256 was also rechecked against the earlier audit and remains `de56d1d03458d2cde755ab903fc34e62f864c8962fe6d0e4d17df8d0c2961a13`.

## Checkpoint and review boundary

Evidence root `/workspace/epicscope-nonmonotonic/`: failing-before logs, before/after exact-file query/numerical JSON, temporal baseline function, benchmark methodology/results, complete/focused browser results, native screenshots and final validation logs. Private original recording bytes are not committed or bundled.

**Phases A/B/C complete within these explicit policies.** Review source/run selection and the legacy temporal unavailable behavior before user acceptance. There is no new run-selection UI or multi-span fetch API; automatic clock repair, globally time-sorted analyses, firmware-cause attribution and invented missing-time counts remain excluded. Commit locally on the development branch, stop for review; no push or main merge.
