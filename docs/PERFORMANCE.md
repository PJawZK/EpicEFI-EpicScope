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

The earlier row-oriented repeated-read problem is no longer the active architecture question.

Current access layers are:

1. **Session/RAM full-range cache** for channels already materialized in the page session.
2. **Primary OPFS MLG column sidecar** storing transposed native-width stripes.
3. **Sparse native per-channel OPFS cache** created only for channels the user actually selects.
4. **Original row-reader fallback** for unsupported/missing/corrupt paths.

### Primary sidecar

Authoritative configuration on the canonical benchmark log:

- 59 stripes;
- target stripe width: **64 bytes**;
- stored native payload: **1,191,462,844 bytes**.

A 16-byte stripe prototype was rejected because stripe count/transpose cost rose materially without enough end-to-end channel-selection benefit.

### Sparse native per-channel cache

The native-column path allows later sessions to read the selected field directly rather than reading a complete stripe. Missing/stale/corrupt entries fall back safely to the primary sidecar.

The native-column root is intentionally separate from the primary sidecar so ordinary sidecar rebuilds do not erase useful sparse columns. Explicit **Clear channel cache** remains the user-controlled reset path.

## Current performance interpretation

The optimization campaign is considered **good enough for the current product stage**.

A recent post-audit low-spec run on the canonical log showed approximately:

- initial MLG load: **8.47 s**;
- workspace restore: **0.54 s**;
- shared workspace data batch: only a few milliseconds with **zero original-log physical rereads**;
- first native-cached arbitrary-channel activation: about **0.27 s** total;
- repeated same-session channel activation: about **0.05 s** total, with effectively free data lookup.

Other runs have been faster/slower depending on I/O and browser scheduling. Do not reduce the project state to one timing number.

The architectural conclusions are more important:

- workspace restore no longer needs repeated original-MLG traversal;
- previously used arbitrary channels can reuse sparse native columns across sessions;
- repeated same-session activation is RAM-resident;
- first-use sidecar/native work is sufficiently fast to move product focus back to features/UI;
- remaining render/envelope/layout cost is sub-second class and not an active optimization target.

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

`predecode=32/64/128` proved that many columns can share one source traversal, but it simply moved arbitrary-channel work into startup and benefited only a chosen subset.

The runtime path was fully removed. Do not restore speculative startup hot sets without a new architectural decision and evidence.

### 16-byte sidecar stripes

Rejected as the default because extra transpose/build cost outweighed practical channel-selection benefit. Keep 64-byte target stripes unless new evidence changes the trade.

### Generic multilevel graph-envelope experiment

A coarse multilevel envelope approach regressed the tested restore/render path and was reverted. Do not reintroduce it without new evidence.

## Current optimization policy

Do **not** continue storage/channel/render micro-optimization simply because further work is possible.

Resume focused performance engineering when:

- a meaningful new feature introduces a measurable regression;
- representative logs/hardware expose a new bottleneck;
- Web functional maturity requires a final profiling pass;
- Linux production implementation begins.

This keeps complexity proportional to user benefit.

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
- histogram/heatmap calculation;
- event detection;
- analyzer throughput;
- comparison throughput.

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
- subjective responsiveness;
- memory/GC pressure where observable.

Do not claim MegaLogViewer's internal strategy as fact. It remains only a behavioral comparison target.

## UI performance

UI hierarchy work must preserve responsiveness while reducing clutter.

Avoid:

- continuous decorative animation;
- heavy blur/effects;
- large unbounded DOM trees;
- inactive modes recomputing/redrawing;
- permanent controls that create layout pressure without frequent value.

Virtualized channel lists and bounded graph rendering remain appropriate.

## Future Linux implementation

Potential native techniques include:

- memory-mapped files;
- columnar/indexed storage;
- chunk indexes;
- parallel decoding/analysis;
- SIMD where useful;
- persistent local indexes/caches;
- multiresolution graph caches.

No technique is mandatory before profiling justifies it.
