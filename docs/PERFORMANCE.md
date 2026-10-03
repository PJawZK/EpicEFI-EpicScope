<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. If a status statement in this document describes an older milestone, use the handoff plus current `main`/CI state for present-tense continuation.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Performance Requirements

## Priority

EpicScope prioritizes:

1. log-reading and analysis speed;
2. low memory usage;
3. responsiveness under large datasets;
4. visual polish.

If visual effects or presentation complexity materially conflict with performance or memory goals, performance wins.

## Primary Linux target

### PERF-001 — 1 GiB log on 2 GiB RAM

The mature Linux application must be capable of opening and interactively analyzing a supported 1 GiB log on a system with 2 GiB physical RAM without requiring the entire source log to reside in memory at once.

This is a design constraint, not merely a late optimization goal.

### PERF-002 — No full-log duplication

Core architecture must not require uncontrolled duplicate in-memory copies of the full log for parsing, filtering, graphing, or analysis.

### PERF-003 — Bounded view queries

Graph and table presentation should request only the data necessary for the active viewport or analysis operation where practical.

### PERF-004 — Large-log capable storage model

The Linux implementation must be free to use streaming parsing, chunking, memory mapping, indexed storage, lazy decoding, downsampling, or other native techniques without changing product semantics.

## Web-stage policy

EpicScope Web is the functional reference. It is not required to meet the final Linux memory target during early development.

However, Web code must avoid architectural choices that inherently prevent later efficient implementation.

Examples of unacceptable Web habits include:

- representing every sample as a large independent object without need;
- making repeated full copies of every channel for each view;
- recalculating the entire log on every cursor/viewport movement;
- coupling analyzer semantics to a browser-only storage representation;
- re-reading the full log independently for every visible graph pane;
- persisting decoded sample arrays merely to keep workspace/channel structure available without a log.

## Current Web benchmark evidence

The primary large-log benchmark remains `2026-07-14_22.07.05.mlg`:

- 1,193,898,186 bytes;
- 320,458 records;
- 1,389 channels;
- MLVLG v2;
- row-oriented layout, so arbitrary full-history column extraction can require reading broad portions of the original file.

Current Web source parameters include 32 MiB Blob pages, an approximately 96 MiB source cache, and an approximately 64 MiB pinned-source allowance. A separate persistent decoded-channel cache is bounded to 128 stored columns and can be cleared from Settings.

### Authoritative low-spec cold baseline — 2026-10-03

Environment: Chromium 150 on Linux, 1,366×645 DPR 1, 2 logical threads, 4 GB RAM class. Browser history/cache and EpicScope decoded-channel cache were cleared before loading. No predecode parameter was used.

Initial load/index:

- total: **4,885.7 ms**;
- record read: **4,571.3 ms**;
- record CPU: **135.7 ms**;
- 36 physical reads / **1,193,898,186 bytes**.

Workspace restore for 11 unique requested channels:

- total: **6,007.3 ms**;
- shared batch: **5,213.5 ms**;
- source-read await: **4,442.7 ms**;
- decode/transform: **748.9 ms**;
- 36 physical reads / **1,193,898,186 bytes**.

Deferred serial validation:

- validation: **6,577.8 ms**;
- validation read: **4,415.1 ms**;
- checksum CPU: **2,114.0 ms**;
- fully validated: **18,034.4 ms** from initial open start.

The baseline confirms that cold low-spec performance is primarily source-I/O dominated. INI parsing/binding and UI population are secondary costs.

### Desktop class

Desktop runs on the same 1.19 GB source remain dramatically faster (roughly ~1 s class for initial load and shared workspace restore in representative runs), demonstrating that the same architecture is highly sensitive to storage/hardware throughput. Desktop results remain a regression check, but low-spec hardware is the acceptance gate for changes that affect I/O, allocation or scheduling.

### Opportunistic predecode experiment — rejected direction

A/B experiments decoded total batches of 32, 64 and 128 channels during the existing workspace traversal. The physical traversal remained a single 36-read / ~1.194 GB pass, but extra CPU/memory-side work increased with batch size. More importantly, only the preselected channels became cheap afterward; arbitrary channels outside the set retained the original cost.

The experiment therefore demonstrated a useful mechanism but a poor product trade: **startup work was shifted, not removed**. PR #130 removed the predecode experiment. Future work must not front-load arbitrary channel subsets merely to improve later selection latency.

### Current interpretation and optimization target

The active problem is not graph rendering. It is repeated access to a row-oriented 1.19 GB source when arbitrary full-history channels are requested.

Current priority is to investigate methods that improve arbitrary first-use access without worsening the normal cold open path, especially:

- reusing worker/index work or source knowledge produced during initial load;
- reducing duplicate worker/main-thread physical traversal where possible;
- building compact access/index information during already-required work rather than decoding speculative channels;
- evaluating transient or persistent post-index representations only if their build/startup/memory cost is demonstrably better than the problem they solve;
- avoiding extra validation reads if checksum/diagnostic work can safely consume bytes already read without extending time-to-usable.

The persistent decoded-channel cache remains useful for channels already decoded once, but it is not considered a solution to first-use arbitrary-channel latency.

The performance acceptance rule is explicit: **do not make startup slower merely to make selected channels faster later.**

## Benchmark categories

Performance tests should eventually cover at least:

- parser throughput;
- initial metadata/channel discovery time;
- time to first usable graph;
- indexing time;
- memory high-water mark;
- viewport query latency;
- histogram/heatmap calculation latency;
- event-detection throughput;
- analyzer throughput;
- comparison throughput;
- repeated-navigation responsiveness after indexing.

Representative benchmark names may include:

```text
parse_100mb_mlg
open_1gb_mlg
index_1gb_log
viewport_query_large_log
histogram_large_log
boost_analysis_large_log
memory_ceiling_1gb_log
```

## Benchmark discipline

During Web development, benchmarks primarily detect regressions and obviously poor designs. They do not need to satisfy the final Linux target yet.

During Linux development, measurable targets should be established from real hardware and representative logs before optimization claims are accepted.

## Optimization policy

Optimization should be evidence-driven.

A performance change should ideally record:

- workload/log used;
- hardware/OS used;
- before measurement;
- after measurement;
- memory impact;
- behavioural compatibility;
- trade-offs introduced.

Micro-optimizations that materially increase complexity without measurable user benefit should be rejected.

## UI performance

The UI should prefer clarity and responsiveness over decorative work.

Potentially expensive visual effects such as continuous animation, heavy blur, large DOM trees, or unnecessary redraws should not be introduced merely for appearance.

Graphs and timelines should support level-of-detail/downsample strategies so rendered point count does not scale directly with total log size.

## Future Linux implementation

The Linux implementation may adopt native Rust or other performance-oriented components when justified by profiling and architecture.

Potential techniques include:

- memory-mapped files;
- channel-oriented columnar storage;
- chunk indexes;
- parallel decoding/analysis;
- SIMD where it provides meaningful gains;
- persistent local index/cache files;
- multiresolution graph caches.

No particular optimization technique is mandatory before evidence shows it is useful.
