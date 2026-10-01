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
- coupling analyzer semantics to a browser-only storage representation.

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
