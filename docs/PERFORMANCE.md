<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. Use the handoff plus current `main`/CI state for present-tense continuation.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Performance Requirements

## Priority

EpicScope prioritizes:

1. log-reading and analysis speed;
2. low memory usage;
3. responsiveness under large datasets;
4. visual polish.

If presentation complexity materially conflicts with performance or memory goals, performance wins.

## Primary Linux target

### PERF-001 — 1 GiB log on 2 GiB RAM

The mature Linux application must be capable of opening and interactively analyzing a supported 1 GiB log on a system with 2 GiB physical RAM without requiring the entire source log to reside in memory at once.

### PERF-002 — No uncontrolled full-log duplication

Core architecture must not require uncontrolled duplicate in-memory copies of the full log for parsing, filtering, graphing, or analysis.

### PERF-003 — Bounded view queries

Graph/table presentation should request only data necessary for the active viewport/operation where practical.

### PERF-004 — Native storage freedom

Linux remains free to use streaming, chunking, mmap, indexed/columnar storage, lazy decoding, downsampling, parallelism, or other native techniques without changing established product semantics.

## Web-stage policy

EpicScope Web is the functional reference, not the final Linux performance implementation.

Web code must still avoid architectures that inherently block later efficiency. Examples of unacceptable patterns include:

- one large object per sample without need;
- repeated full channel copies per view;
- full-log recomputation on every cursor/viewport move;
- browser-storage representation leaking into analyzer semantics;
- independent full source rereads per visible graph pane;
- persisting decoded arrays merely to keep workspace structure alive.

## Current large-log benchmark authority

Primary benchmark log:

`2026-07-14_22.07.05.mlg`

Structure:

- **1,193,898,186 bytes**;
- **320,458 records**;
- **1,389 channels**;
- MLVLG v2.

Important low-spec Web environment:

- Chromium/Brave class browser on Linux;
- 1,366×645 DPR 1;
- 2 logical threads;
- 4 GB RAM class machine.

Hardware/storage variance is significant; individual timings are evidence, not universal SLAs.

## Current Web large-log access architecture

Current access layers are:

1. **Session/RAM full-range cache** for channels already materialized in the page session.
2. **Primary OPFS MLG column sidecar** storing transposed native-width stripes.
3. **Sparse native per-channel OPFS cache** created only for channels the user actually selects.
4. **Original row-reader fallback** for unsupported/missing/corrupt paths.

### Primary sidecar

Authoritative configuration on the canonical benchmark log:

- target stripe width: **64 bytes**;
- native-width transposed payload;
- reused sidecar should avoid repeated original row-log traversal for channel access.

A 16-byte stripe prototype was rejected because stripe count/transpose cost rose materially without enough end-to-end channel-selection benefit.

### Sparse native per-channel cache

The native-column path allows later sessions to read the selected field directly rather than reading a complete stripe. Missing/stale/corrupt entries fall back safely to the primary sidecar.

The native-column root is intentionally separate from the primary sidecar so ordinary sidecar rebuilds do not erase useful sparse columns. Explicit **Clear channel cache** remains the user-controlled reset path.

## Current performance interpretation

The optimization campaign remains **good enough for the current product stage**.

The architectural conclusions are more important than one timing run:

- workspace/preset trace activation can reuse already-decoded/cache-backed channel data;
- previously used arbitrary channels can reuse sparse native columns across sessions;
- repeated same-session activation is RAM-resident;
- first-use sidecar/native work is sufficiently fast that product focus remains on feature maturity;
- remaining render/envelope/layout work is not an active optimization target without measured regression.

## Retained-memory diagnostics

PR #232 added explicit retained-memory measurement. PR #233 extended that measurement across all still-live log-source instances.

Diagnostics now distinguish, where applicable:

- persistent decoded-column resident count/bytes;
- bound full-range resident count/bytes;
- graph-active range bytes;
- peak retained counts/bytes;
- cache hits/reloads/retains/misses;
- explicit eviction count;
- current/latest source memory;
- all live source memory;
- previous live source memory/count;
- source objects observed as collected/finalized.

The live-source instrumentation uses weak references/finalization tracking so diagnostics do not intentionally keep old sources alive.

### Important accounting rule

Persistent decoded columns, bound ranges and graph-active ranges can reference overlapping payload. Their reported byte estimates must **not** simply be summed and described as unique process RAM.

## Cross-log lifetime test — 2026-10-06

Test sequence in one browser page:

1. load `2026-10-02_13.27.46.mlg` (~295 MB, 66,929 records);
2. without page reload, load `2026-07-14_22.07.05.mlg` (~1.2 GB, 320,458 records);
3. inspect retained-memory diagnostics after the second load.

Observed result:

- current/latest live source count: **1**;
- previous live source count: **0**;
- previous source observed collected/finalized: **1**;
- therefore there is currently **no evidence of a cross-log strong-reference retention leak**.

One representative active-1.2-GB state with 22 retained channels showed approximately:

- persistent decoded columns: **56.4 MB**;
- bound full-channel ranges: **119.9 MB**;
- graph-active ranges: **38.1 MB**.

These figures overlap by design.

## Current cache-eviction policy

No new LRU/byte budget was added after the retained-memory audit.

Reason:

- cross-log replacement released the previous source;
- the active-log retained figures were measurable and explainable;
- adding independent eviction policies without a real single-log growth problem risks fighting useful cache reuse.

Revisit a byte budget/LRU only when a **single-log many-channel stress test** (or another real feature) demonstrates harmful retained growth, GC pressure, UI degradation or browser instability.

A good future stress case is the canonical ~1.2 GB log while deliberately visiting/loading hundreds of distinct channels and Analyzer/Histogram surfaces in one session.

## Time-to-usable vs background completion

Do not collapse these into one metric:

- initial source open/index;
- UI readiness;
- workspace restore;
- deferred CRC validation;
- sidecar/native persistence completion.

Background validation/storage work may continue after the user can interact with the recording.

## Concluded/rejected experiments

### Opportunistic startup predecode

`predecode=32/64/128` was rejected. Normal startup must not decode speculative arbitrary hot sets merely to reduce later selection latency.

### 16-byte sidecar stripes

Rejected as default because extra transpose/build cost outweighed practical channel-selection benefit. Keep 64-byte target stripes unless new evidence changes the trade.

### Generic multilevel graph-envelope experiment

A coarse multilevel envelope approach regressed the tested restore/render path and was reverted. Do not reintroduce it without new evidence.

## Current optimization policy

Do **not** continue storage/channel/render micro-optimization simply because further work is possible.

Resume focused performance engineering when:

- a meaningful new feature introduces a measurable regression;
- representative logs/hardware expose a new bottleneck;
- the deliberate single-log retained-memory stress test shows harmful growth;
- Web functional maturity requires a final profiling pass;
- Linux production implementation begins.

## Benchmark categories

Performance tests should eventually cover:

- parser throughput;
- metadata/channel discovery;
- time to first usable graph;
- indexing/sidecar build/reuse;
- memory high-water mark;
- arbitrary first-channel activation;
- repeated channel activation;
- viewport query latency;
- Histogram/Table/Scatter calculation;
- event detection;
- Analyzer throughput;
- comparison throughput;
- retained-channel growth across many unique channel selections.

Representative benchmark names may include:

```text
parse_100mb_mlg
open_1gb_mlg
index_1gb_log
first_channel_large_log
viewport_query_large_log
histogram_large_log
boost_analysis_large_log
memory_ceiling_1gb_log
many_channels_memory_1gb_log
```

## Benchmark discipline

A performance result should record where applicable:

- workload/log;
- exact build SHA;
- browser/hardware/OS and logical thread count;
- cold/warm state;
- browser/cache/sidecar/native-column state;
- requested/unique channel count;
- physical read bytes/time;
- decode/transform CPU;
- initial load time;
- workspace restore breakdown;
- arbitrary-channel breakdown;
- retained-memory counters/source lifetime;
- subjective responsiveness;
- memory/GC pressure where observable.

Do not claim MegaLogViewer's internal strategy as fact. It remains only a behavioral comparison target.

## UI performance

Avoid continuous decorative animation, heavy blur/effects, large unbounded DOM trees, inactive modes recomputing/redrawing, and permanent controls that create layout pressure without frequent value.

Virtualized channel lists and bounded graph rendering remain appropriate.

## Future Linux implementation

Potential native techniques include memory-mapped files, columnar/indexed storage, chunk indexes, parallel decoding/analysis, SIMD where useful, persistent local indexes/caches and multiresolution graph caches.

No technique is mandatory before profiling justifies it.
