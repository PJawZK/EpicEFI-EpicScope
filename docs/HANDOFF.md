# EpicScope Handoff

## Repository

`PJawZK/EpicEFI-EpicScope`

## Authoritative branch

`main`

Implementation baseline entering this documentation refresh:

`7da764a7be6c6107523c1582ae4f1a91b655b217`

That baseline is PR #121, **Perf: defer low-spec resident channel materialization until idle**. The documentation-only merge that updates this handoff becomes the newer authoritative `main`; no application behavior is changed by the documentation refresh itself.

## Hosted application

`https://pjawzk.github.io/EpicEFI-EpicScope/`

GitHub Actions remains the required Web validation path and GitHub Pages remains the project-owner test surface. Normal project-owner testing does not require a local clone, Node.js or npm.

## Current project position

EpicScope Web is well beyond the original shell/bootstrap stage. The current application has a working large-log MLG parser/data path, INI-backed channel catalog/binding, reusable application workspaces, exact-log persistence, multi-pane graph/timeline workflows, large-log diagnostics, and active performance hardening.

The current active engineering focus is **large-log arbitrary-channel activation on both a fast desktop and a deliberately weak 2-thread / 4 GB laptop**. The desktop path is now smooth; the remaining problem is first-visible latency on the low-spec laptop when a wide viewport causes too much row-oriented MLG I/O before the first trace appears.

Do not reconstruct current state from the old 318 MB Phase-1 benchmark alone. The current performance authority is the 1.19 GB benchmark described below.

## Current large-log benchmark authority

Primary performance log:

`2026-07-14_22.07.05.mlg`

Known structure:

- size: 1,193,898,186 bytes;
- MLVLG v2;
- 320,458 records;
- 1,389 logged channels;
- fixed record scan;
- row-oriented source layout;
- source block/page behavior means a sparse arbitrary channel still requires reading broad portions of the source file;
- source Blob page size: 32 MiB;
- source cache ceiling: about 96 MiB;
- pinned source-cache allowance: about 64 MiB;
- decoded-channel cache ceiling: 32 MiB;
- bounded decoded chunks: 8,192 samples.

### Desktop validation class

Representative desktop environment:

- Chromium 154 / Linux / Zorin;
- 1,920×947 DPR 1;
- 5 logical threads.

Representative validated run after resident-channel work:

- initial log load/index: about 1.03 s;
- 12-channel saved-workspace restore: about 1.19 s;
- arbitrary `instantMAPValue` viewport-first activation: 23,458 samples in about 133 ms;
- one-time full resident materialization: 320,458 samples in about 789 ms;
- after materialization, continuous zoom/pan no longer causes additional source reads for that active channel;
- continuous zoom subjectively feels immediate once the channel is resident;
- timeline overview is refreshed when the partial trace becomes fully resident.

This desktop behavior is considered a good stopping point unless later regressions appear.

### Low-spec validation class

Representative low-spec laptop:

- Chromium 150 / Linux;
- 1,366×645 DPR 1;
- 2 logical threads;
- 4 GB RAM class machine.

The laptop is strongly storage/I/O constrained. Observed 32 MiB physical reads are commonly around 150–210 ms average and can spike far higher.

Latest representative run:

- initial log load/index: 8.02 s;
- 13-channel shared workspace restore: 7.90 s;
- viewport-first `instantMAPValue` activation requested 81,691 samples and therefore read about 369 MB, taking 2.38 s;
- one-time full resident materialization then read about 1.126 GB and took 8.19 s;
- about 7.97 s of that full materialization was physical source-read time;
- scale-preserving resident swap worked (`scale=0.00 ms` for the full promotion), so the previous late vertical rescale/jump has been removed;
- the remaining visible problem is first-trace latency when the requested viewport itself is too wide.

An earlier, narrower low-spec run showed about 637 ms for a 20,229-sample viewport and about 5.04 s for full materialization, confirming that the first-visible cost scales heavily with source I/O width and storage variability.

## Current active-channel loading architecture

The current Web graph path deliberately uses two stages for an arbitrary newly selected channel:

1. **viewport-first activation** so something useful appears before a full row-oriented scan;
2. **one-time full resident materialization** so the selected active channel becomes fully decoded and future zoom/pan does not chase the viewport with repeated source reads.

Once fully resident, the active trace directly holds the full `NumericChannelRange`; normal graph navigation then becomes presentation work rather than repeated MLG I/O.

Saved workspace channels remain different: visible channels are restored through one shared full-range multi-channel batch before pane activation so several channels amortize a single source traversal.

## Performance implementation history that matters

The current architecture was reached through measured A/B iterations:

- PR #111 — adaptive CRC validation: serial on <=3 threads, parallel pipeline on >=4 threads; considered settled;
- PR #112 — viewport-first arbitrary-channel selection;
- PR #113 — `sampleRangeForTime()` forwarding through INI/channel binding;
- PR #114 — removed eager viewport→full promotion and added range-aware partial caching;
- PR #115 — fixed 8,192-sample decoded chunks for overlapping viewport reuse;
- PR #116 — progressive active-channel fill;
- PR #117 — adaptive progressive fill sizing;
- PR #118 — interaction-aware coalescing during continuous wheel/pan activity;
- PR #119 — pivot to viewport-first then one-time fully resident active channel;
- PR #120 — timeline overview refresh when an active trace changes from partial to full resident range;
- PR #121 — low-spec idle-delayed materialization plus scale-preserving resident swap.

An earlier concurrency/pipelining experiment in PR #89 regressed behavior and was reverted. Do not casually reintroduce channel-read concurrency/pipelining without new measured evidence.

The progressive-fill work is retained as fallback/cache machinery, but it is no longer the preferred steady-state user model for newly selected active channels because continuous interaction could outrun or visually expose the fill process.

## Exact next performance task

The next planned implementation is deliberately narrow:

**On systems with <=3 logical threads, cap viewport-first activation to about 16,384 samples, centered within the requested viewport, instead of letting first activation scale to the entire visible viewport.**

Keep all of the following from PR #121:

- desktop (>3 threads) behavior unchanged;
- 1,000 ms low-spec idle delay before full resident materialization;
- viewport activity restarts that low-spec idle timer;
- one-time full resident materialization after the user settles;
- preserve the viewport-first scale when swapping in the full resident range;
- no repeated viewport-driven I/O once full resident materialization completes.

Purpose of the cap:

- reduce low-spec time-to-first-visible;
- avoid cases like 81,691 samples / ~369 MB / ~2.38 s just to show the first trace;
- ideally turn first activation into roughly one or a few 32 MiB source-page reads rather than 11 pages;
- accept temporary partial horizontal coverage while the later resident scan completes.

Do not apply this cap to the desktop path unless measurements justify it.

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
- Settings can unload the persisted INI catalog for repeatable fresh-load testing.

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
- active-channel timeline overview refresh after resident materialization;
- no graph navigation I/O for fully resident active channels.

Canvas 2D remains a Web implementation choice, not a Linux/Android architecture commitment.

## Current diagnostic/validation rules

Performance diagnostics should be treated as measurement authority for Web optimization. Always compare:

- workload/log;
- hardware class and logical thread count;
- viewport width/sample count;
- physical read count/bytes/time;
- decode vs I/O time;
- subjective graph responsiveness;
- memory/GC pressure on the 4 GB laptop where observable.

Desktop wins are not considered complete until the low-spec laptop has also been checked when the change can affect memory, allocation, I/O scheduling or interaction behavior.

Do not claim MegaLogViewer's internal implementation strategy as fact; it is only a behavioral comparison target.

## UI/reference constraints still in force

- authoritative Logger/Analyzer visual/interaction reference remains `EpicHub-Tablet-Landscape-0.0.45(2).html`;
- use TunerStudio/MegaLogViewer channel terminology where practical;
- do not change established UI colors in response to apparent visibility/performance reports unless the user explicitly requests a color change; a recent apparent color issue was a TN-panel viewing-angle effect, not a palette problem;
- performance may simplify implementation but should not silently alter established interaction semantics.

## Repository/workflow constraints

- `main` is authoritative;
- normal implementation uses a focused branch/PR;
- run type-check, tests and production build before merge;
- verify post-merge Web CI and GitHub Pages deployment;
- temporary branch-only patch/validation workflows or scripts must remove themselves before PR/final diff;
- avoid accidental no-op commits on `main`;
- project-owner testing is hosted; do not require a local clone.

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

The new chat must use the repository handoff and current repository state as authority. It should not reconstruct present architecture from older chats or older prototype code.
