# EpicScope Handoff

## Repository

`PJawZK/EpicEFI-EpicScope`

## Authoritative branch

`main`

Implementation baseline entering this documentation refresh:

`3f0e3c76ceb012bcacc6ee6add55b587a703d414`

That baseline is the merge of PR #130, **Perf: remove opportunistic predecode experiment**. The documentation-only merge that updates this handoff becomes the newer authoritative `main`; no application behavior is changed by this documentation refresh itself.

## Hosted application

`https://pjawzk.github.io/EpicEFI-EpicScope/`

GitHub Actions remains the required Web validation path and GitHub Pages remains the project-owner test surface. Normal project-owner testing does not require a local clone, Node.js or npm.

## Current project position

EpicScope Web has a working large-log MLG v1/v2 data path, INI-backed channel catalog/binding, reusable application workspaces, exact-log persistence, multi-pane graph/timeline workflows, large-log diagnostics, and an actively measured performance path.

The current engineering focus is no longer viewport-fill tuning or opportunistic channel predecode. The latest experiments showed that predecoding arbitrary channel groups only moves cost into startup and therefore does not solve the real requirement: after a log is open, arbitrary channel access should not require repeated multi-second traversals of the original row-oriented MLG.

The active performance rule is now:

> **Do not make startup slower merely to make selected channels faster later.**

Fast initial MLG open remains valuable in its own right. The next architectural investigation should reduce repeated source traversal by reusing work already performed during initial load/indexing, or by introducing a better post-index access representation that does not front-load arbitrary channel decoding.

After this performance direction is proven and stabilized, perform the planned repository/file-structure audit for dead/obsolete code, duplicated responsibilities, and files that have accumulated beyond a healthy modular size.

## Current large-log benchmark authority

Primary benchmark log: `2026-07-14_22.07.05.mlg`

Known structure:

- size: 1,193,898,186 bytes;
- MLVLG v2;
- 320,458 records;
- 1,389 logged channels;
- fixed record scan;
- row-oriented source layout;
- source Blob page size: 32 MiB;
- about 96 MiB source-page cache ceiling;
- about 64 MiB pinned-source allowance.

### Authoritative cold low-spec baseline — 2026-10-03

Environment:

- Chromium 150 / Linux;
- 1,366×645 DPR 1;
- 2 logical threads;
- 4 GB RAM class machine;
- browser history/cache and EpicScope decoded-channel cache cleared before loading;
- no predecode parameter;
- one reusable workspace;
- 12 assigned visible channels, 11 renderable/unique requested channels, one known-unavailable channel;
- zero runtime errors.

Measured initial MLG load/index:

- total: **4,885.7 ms**;
- record read: **4,571.3 ms**;
- record CPU: **135.7 ms**;
- physical reads: **36**;
- physical bytes: **1,193,898,186**.

Measured workspace restore:

- total: **6,007.3 ms**;
- shared 11-channel batch: **5,213.5 ms**;
- source-read await: **4,442.7 ms**;
- decode/transform: **748.9 ms**;
- physical reads: **36**;
- physical bytes: **1,193,898,186**.

Deferred serial validation:

- validation: **6,577.8 ms**;
- validation read: **4,415.1 ms**;
- checksum CPU: **2,114.0 ms**;
- fully validated: **18,034.4 ms** from initial open start.

This is the new low-spec cold baseline for future performance work. Storage variability remains material, so compare physical read time/bytes separately from decode/transform CPU.

## Predecode experiment — concluded and removed

PRs #127–#129 explored opportunistic full-range predecode batches of 32, 64 and 128 channels during the existing workspace source traversal. The experiment proved that more channels can be decoded during the same 36-read / 1.194 GB physical traversal without adding another source pass.

It also proved why this is not the product solution:

- extra decoding increases startup CPU/memory-side work;
- 32 channels was relatively cheap, 64 materially more expensive, and 128 clearly crossed into diminishing returns on the 2-thread laptop;
- only preselected/hot channels benefit afterward;
- arbitrary channels outside that set still require their own expensive access;
- larger sets move per-channel cost into startup rather than removing the underlying row-oriented access problem.

PR #130 removed the opportunistic predecode experiment and its experiment-only resident retention. Do not restore `?predecode=32/64/128`, runtime hot-set selection, or equivalent startup front-loading without a new architectural decision and evidence that the underlying trade has changed.

## Current channel/cache behavior

Retained after PR #130:

- workspace restore loads only channels actually requested by the visible workspace;
- visible workspace channels share one full-range multi-channel decode batch;
- the independent persistent decoded-channel cache remains available for channels already decoded in prior use;
- that persistent cache is bounded to **128 stored columns**;
- Settings exposes **Clear channel cache** for repeatable cold-cache testing and manual reset;
- known-but-unavailable INI channels remain assigned/visible as unavailable rather than being silently removed.

The persistent cache is reuse for already-decoded data. It is not the solution to initial arbitrary-channel access latency.

## Performance implementation history that matters

Important measured steps include:

- adaptive CRC validation: serial on <=3 threads, parallel on >=4 threads;
- shared full-range multi-channel workspace restore;
- viewport-first/progressive/resident-channel experiments for arbitrary channels;
- range/chunk reuse and interaction coalescing experiments;
- persistent decoded-column cache with a bounded 128-column limit and explicit clear control;
- PRs #127–#129: opportunistic predecode A/B experiment;
- PR #130: rollback/removal of opportunistic predecode as the active strategy.

Earlier channel-read concurrency/pipelining also regressed behavior and was reverted. Do not reintroduce concurrency or startup predecode simply because it can hide one benchmark symptom.

## Exact next performance task

Investigate approaches that improve **first use of arbitrary channels without increasing normal startup work**.

Highest-value architectural question:

> Can EpicScope avoid rereading essentially the whole row-oriented MLG for each newly requested full-history channel by reusing information/bytes/work already produced during the initial load/index pass, or by creating a compact access structure whose construction does not materially worsen startup?

Candidate directions to investigate and benchmark, not pre-approved implementations:

- retain/transfer reusable index/source information from the worker-side initial scan so main-thread channel extraction does not independently cold-traverse the file;
- build compact row/block access information during work already required for initial parsing, without decoding arbitrary channels up front;
- evaluate a post-index transient or persistent representation that improves arbitrary column extraction while respecting memory and startup budgets;
- determine whether validation can consume bytes already read without adding another complete source pass, but only if this does not extend the critical open path;
- measure whether source ownership can be consolidated enough to reduce current worker/main-thread duplicate physical traffic.

Acceptance discipline:

- no startup regression should be accepted merely to improve a selected subset of channels;
- arbitrary channel selection must be tested from a truly cold decoded-channel cache;
- compare physical source bytes/read count/read time separately from decode CPU;
- desktop and low-spec laptop must both be checked;
- preserve local-only behavior and current workspace/channel semantics.

## Current workspace / source-context state

Implemented and retained:

- INI parsing and normalized channel catalog;
- stable logical `ini:<logicalKey>` identity;
- conservative INI↔MLG binding;
- known/no-data channels remain visible;
- usable log-only channels remain usable;
- MLG remains authoritative for recorded values and validity;
- reusable application workspace persists named workspaces, layouts/geometry and stable channel assignments independently of exact log identity;
- exact-log persistence remains separate for cursor/viewport/A-B/markers/ranges;
- restored catalog/workspace state is distinct from freshly loaded state;
- Settings can unload the persisted INI catalog for repeatable fresh-load testing;
- Settings can clear the persistent decoded-channel cache independently.

MSQ tune-value/table enrichment remains later work. CSV remains deferred.

## Graph / timeline state

Implemented and working:

- multiple workspaces;
- fixed and freeform multi-pane layouts;
- shared viewport/cursor/timeline/A-B navigation;
- active-pane context;
- graph/timeline source markers and user markers;
- saved ranges and view history;
- high-zoom raw-sample rendering and zoomed-out envelope rendering;
- Now/Min/Max and channel details;
- source validity handling;
- timeline overview and graph interaction remain independent of the abandoned predecode experiment.

Canvas 2D remains a Web implementation choice, not a Linux/Android architecture commitment.

## Current diagnostic/validation rules

Performance diagnostics are the Web measurement authority. Always record/compare:

- workload/log;
- browser/hardware class and logical thread count;
- cold/warm decoded-channel cache state;
- requested/unique channel count;
- physical read count/bytes/time;
- source-read await vs decode/transform time;
- initial load time;
- workspace restore time;
- arbitrary first-channel activation time when testing that path;
- subjective interaction behavior;
- memory/GC pressure on the 4 GB laptop where observable.

Do not claim MegaLogViewer's internal implementation strategy as fact; it is only a behavioral comparison target. The practical product goal is to keep EpicScope's initial MLG load competitive/faster while improving arbitrary-channel access through EpicScope's own measured architecture.

## UI/reference constraints still in force

- authoritative Logger/Analyzer visual/interaction reference remains `EpicHub-Tablet-Landscape-0.0.45(2).html`;
- use TunerStudio/MegaLogViewer channel terminology where practical;
- do not change established UI colors in response to apparent visibility/performance reports unless explicitly requested;
- performance work must not silently alter established interaction semantics.

## Repository/workflow constraints

- `main` is authoritative;
- normal implementation uses a focused branch/PR;
- run type-check, tests and production build before merge;
- verify post-merge Web CI and GitHub Pages deployment;
- temporary branch-only patch/validation workflows or scripts must remove themselves before PR/final diff;
- avoid accidental no-op commits on `main`;
- project-owner testing is hosted; do not require a local clone.

## Planned code-structure audit after performance direction stabilizes

Once the replacement performance approach is proven and reasonably optimized, audit the complete application source tree for:

- obsolete experiment code and dead branches;
- duplicated helpers/paths left by iterative performance work;
- unused files/exports;
- responsibilities that have drifted into the wrong architectural layer;
- very large files that should be split into coherent modules;
- temporary compatibility or diagnostic code that no longer earns its complexity;
- test coverage around cleanup-sensitive behavior.

Do not perform destructive cleanup merely for line-count aesthetics; preserve behavior and use the architecture documents as the ownership authority.

## Architecture authority

Read before significant implementation:

1. `docs/HANDOFF.md`
2. `docs/PRODUCT.md`
3. `docs/ARCHITECTURE.md`
4. `docs/FILE_ARCHITECTURE.md`
5. `docs/DATA_MODEL.md`
6. `docs/UI_REFERENCE.md`
7. `docs/LOG_MLG_PLAN.md`
8. `docs/PERFORMANCE.md`
9. `docs/PLATFORMS.md`
10. `docs/ROADMAP.md`
11. `docs/WORKFLOW.md`
12. `docs/DECISIONS.md`

## Continuation instruction

A new chat should be able to start with:

> Read `docs/HANDOFF.md` in `PJawZK/EpicEFI-EpicScope`, inspect current `main`/PR/CI state, and continue from there.

Use the repository handoff and current repository state as authority. Do not reconstruct present architecture from older chats or superseded performance experiments.
