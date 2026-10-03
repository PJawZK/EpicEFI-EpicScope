from pathlib import Path

ROOT = Path('.')


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text.rstrip() + '\n')


def upsert_block(path: str, key: str, block: str, *, before: str | None = None, after: str | None = None, prepend: bool = False) -> None:
    start = f'<!-- CURRENT_STATE:{key}:START -->'
    end = f'<!-- CURRENT_STATE:{key}:END -->'
    wrapped = f'{start}\n{block.strip()}\n{end}'
    text = read(path)
    if start in text and end in text:
        a = text.index(start)
        b = text.index(end, a) + len(end)
        text = text[:a] + wrapped + text[b:]
    elif prepend:
        text = wrapped + '\n\n' + text
    elif before and before in text:
        text = text.replace(before, wrapped + '\n\n' + before, 1)
    elif after and after in text:
        pos = text.index(after) + len(after)
        text = text[:pos] + '\n\n' + wrapped + text[pos:]
    else:
        text = text.rstrip() + '\n\n' + wrapped + '\n'
    write(path, text)


handoff = '''# EpicScope Handoff

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
'''
write('docs/HANDOFF.md', handoff)

# README: replace stale Status section.
readme = read('README.md')
status_start = readme.index('## Status')
status_end = readme.index('## Web delivery', status_start)
new_status = '''## Status

EpicScope Web is an active hosted application, not a pre-bootstrap shell. The current implementation includes the MLG v1/v2 large-log data path, INI-backed channel catalog/binding, reusable application workspaces, multi-pane graph/timeline tooling, exact-log persistence, performance diagnostics, and large-log channel-loading optimization.

Current performance work uses a 1.19 GB / 320,458-record MLG benchmark across both a 5-thread desktop and a 2-thread / 4 GB laptop. The desktop arbitrary-channel path now uses viewport-first activation followed by one-time full resident materialization, after which zoom/pan requires no further source reads for that active channel. The remaining active task is reducing low-spec time-to-first-visible by capping the initial viewport-first read on <=3-thread systems while preserving the resident-channel model.

See [`HANDOFF.md`](docs/HANDOFF.md) for the exact authoritative continuation state and benchmark evidence.

'''
readme = readme[:status_start] + new_status + readme[status_end:]
write('README.md', readme)

upsert_block('docs/ARCHITECTURE.md', 'web-active-channel-data-path', '''## Current Web active-channel data path

The current browser implementation has an important performance distinction between **workspace restore** and **new arbitrary-channel activation**:

- saved/assigned visible workspace channels are decoded as one shared full-range multi-channel batch before pane activation, amortizing the row-oriented MLG traversal;
- a newly selected arbitrary channel is activated from a bounded viewport range first, then materialized once into a complete resident `NumericChannelRange`;
- while full resident materialization is in progress, viewport refills for that channel are suppressed rather than competing for the same source I/O;
- once complete, the active trace retains the full decoded range directly, so later zoom/pan is presentation-only and does not reread the MLG;
- the resident swap preserves the existing graph scale so full-data arrival does not create a delayed vertical rescale;
- low-spec systems (currently <=3 logical threads) defer full materialization until the interaction has been idle for 1,000 ms; desktop systems keep the faster 120 ms materialization schedule.

This is a Web implementation strategy behind the normalized data-source contracts, not a requirement that Linux use the same mechanism. The row-oriented MLG cost demonstrated by the Web implementation strengthens the case for future Linux-native indexed/columnar techniques without changing product semantics.

The next planned Web refinement is to cap the **initial** low-spec viewport-first request to about 16,384 samples centered in the requested viewport. That is a performance-policy refinement, not a data-model change.''', before='## Web and Linux relationship')

# Replace the old benchmark-evidence section with current authority.
perf = read('docs/PERFORMANCE.md')
a = perf.index('## Current Web benchmark evidence')
b = perf.index('## Benchmark categories', a)
perf_current = '''## Current Web benchmark evidence

The current primary large-log benchmark is `2026-07-14_22.07.05.mlg`:

- 1,193,898,186 bytes;
- 320,458 records;
- 1,389 channels;
- MLVLG v2;
- row-oriented layout, making a full arbitrary single-channel materialization I/O-heavy even though only one field is decoded.

Current Web source/data parameters include:

- 32 MiB Blob source pages;
- about 96 MiB source-cache ceiling;
- about 64 MiB pinned-source allowance;
- 32 MiB decoded-channel cache;
- 8,192-sample fixed decoded chunks for bounded range reuse.

### Desktop class — 5 logical threads

Representative validated run:

- log load/index: ~1.03 s;
- 12-channel shared workspace restore: ~1.19 s;
- arbitrary `instantMAPValue` viewport-first activation: 23,458 samples in ~133 ms;
- full resident materialization: 320,458 samples in ~789 ms;
- after materialization, continuous zoom/pan performs no further source reads for that active channel and feels immediate.

### Low-spec class — 2 logical threads / 4 GB RAM class

Representative latest run:

- log load/index: ~8.02 s;
- 13-channel shared workspace restore: ~7.90 s;
- arbitrary viewport-first activation at a wide viewport: 81,691 samples, ~369 MB physical source data, ~2.38 s;
- full resident materialization: ~1.126 GB physical source data, ~8.19 s total, of which ~7.97 s was physical source-read time;
- 32 MiB physical reads averaged ~213 ms in that run and included a ~906 ms outlier.

The low-spec result shows that the remaining first-visible problem is dominated by source I/O, not graph drawing or statistics. The next planned change is therefore to cap low-spec first activation to roughly 16,384 centered samples rather than allowing the initial request to scale to a very wide visible viewport. The later full resident materialization remains one-time and idle-delayed.

### Current interpretation

The desktop resident-channel model is accepted as the preferred Web interaction model unless later regression evidence appears. The low-spec laptop remains the acceptance gate for I/O scheduling, allocation/memory pressure and time-to-first-visible changes.

These numbers are regression evidence for the current Web implementation, not final Linux acceptance targets.

'''
perf = perf[:a] + perf_current + perf[b:]
write('docs/PERFORMANCE.md', perf)

# Roadmap current execution position and stale Phase-1 status.
roadmap = read('docs/ROADMAP.md')
roadmap = roadmap.replace('Status: **Closeout pending hosted validation of the final graph-density refinement**', 'Status: **Functional foundation implemented; current Web work has moved into source/workspace foundation and large-log performance hardening**')
write('docs/ROADMAP.md', roadmap)
upsert_block('docs/ROADMAP.md', 'current-execution-position', '''## Current execution position — 2026-10-03

EpicScope Web has progressed past the original Phase-1 shell/log-foundation closeout described in older milestone text. Current implementation already includes the INI-backed channel catalog/binding and reusable application-workspace foundation from Phase 2, while active engineering is hardening the large-log data path before moving deeper into generic analysis/analyzers.

Current performance milestone:

- shared full-range workspace restore is established;
- arbitrary new channels use viewport-first activation followed by one-time resident full materialization;
- desktop behavior is smooth and no longer rereads resident channels during zoom/pan;
- low-spec <=3-thread hardware uses idle-delayed materialization and a scale-preserving resident swap;
- the next task is a low-spec-only cap of about 16,384 samples for the first viewport activation so a wide viewport cannot force hundreds of MiB of source I/O before the first trace appears.

This performance hardening does not change the longer product order: generic analysis/events/compare still precede specialized analyzers, MSQ enrichment remains later than the INI/channel-catalog foundation, and Linux remains the eventual production-performance target.''', after='Large features should be split into reviewable tasks before coding.')

upsert_block('docs/PRODUCT.md', 'current-web-implementation', '''## Current Web implementation state

The Web product is now a usable hosted large-log analyzer foundation rather than an early shell. Current capabilities include MLG v1/v2 import/index/validation, INI-backed channel identity and log binding, persisted named workspaces and pane assignments, multi-pane graph/timeline navigation, annotations/ranges, channel statistics/search, diagnostics, and large-log source/decode caching.

For arbitrary newly selected channels, the current interaction model is **fast visible subset first, then one-time full resident channel**. This lets the UI become useful before an expensive row-oriented full-file scan, while still making later zoom/pan independent of source I/O after materialization. Hardware-adaptive scheduling is permitted where measured evidence shows a clear low-spec benefit, provided product semantics remain the same.

The Web stage remains the functional reference. The current optimization work is not intended to turn browser-specific Blob/cache behavior into a Linux architecture requirement.''', before='## Primary workflows')

upsert_block('docs/PLATFORMS.md', 'current-web-validation-classes', '''## Current Web validation classes

Performance-sensitive Web changes are currently checked on two deliberately different Chromium/Linux classes:

- **desktop class:** about 5 logical threads, fast storage, where the 1.19 GB benchmark log indexes in roughly one second and arbitrary-channel full materialization is sub-second;
- **low-spec class:** 2 logical threads / 4 GB RAM class hardware with much slower storage, where the same source scans can take several seconds.

Hardware-adaptive Web policy already exists for CRC validation and active-channel materialization timing. This is allowed as an implementation optimization when both paths preserve the same product semantics. Desktop improvements that can affect I/O, allocation, GC or interaction behavior should be checked on the low-spec class before the performance task is considered settled.''', before='## Linux')

upsert_block('docs/DECISIONS.md', 'current-performance-decisions', '''## D-041 — Web arbitrary active channels become fully resident after first-visible activation

**Status:** Approved / implemented

For the current Web MLG data path, a newly selected arbitrary channel may appear from a bounded viewport-first read and then be materialized once into a complete resident decoded range.

Once resident, normal zoom/pan must reuse that active decoded range rather than repeatedly rereading the row-oriented MLG source. Saved-workspace restoration remains a separate shared multi-channel full-range batch so several assigned channels can amortize one source traversal.

This is a Web implementation policy behind existing normalized data contracts, not a mandate that Linux use the same storage strategy.

## D-042 — Low-spec Web scheduling may adapt to measured hardware constraints

**Status:** Approved / implemented

Measured low-spec behavior justifies hardware-adaptive scheduling while preserving identical product semantics.

Current rules:

- CRC validation uses the established serial path on <=3 logical threads and parallel pipeline on >=4 threads;
- resident active-channel materialization starts quickly on desktop-class hardware but waits for 1,000 ms of interaction idle on <=3-thread systems;
- the resident swap preserves the current trace scale so data completion does not create a delayed visual rescale;
- low-spec performance work must be judged from physical I/O, responsiveness and memory/GC behavior, not desktop measurements alone.

A planned follow-up will cap low-spec first-visible activation to a small centered range (target about 16,384 samples). That cap is an implementation task, not yet an implemented decision in this snapshot.''', before='## Superseding decisions')

# Notes for authority/history documents that otherwise should not be rewritten.
upsert_block('docs/DATA_MODEL.md', 'current-range-residency-note', '''## Current Web range/residency implementation note

`NumericChannelRange` is currently used both for bounded/partial reads and for complete decoded active-channel ranges. A Web graph trace may therefore begin with partial coverage and later replace its backing range with the complete resident range without changing logical channel identity.

This does not redefine the normalized model: partial/full coverage is execution state. Recorded MLG values/validity remain authoritative, and analyzers must not infer absent samples from an unloaded portion of a partial range.''', prepend=True)

upsert_block('docs/FILE_ARCHITECTURE.md', 'current-performance-ownership', '''## Current performance-sensitive ownership

Current large-log hot paths remain inside already-approved areas:

- `core/parsers/mlg/` — MLG source access, indexing, bounded/multi-channel decoding and decoded chunk/cache behavior;
- `core/channels/` — stable channel/data-source binding and forwarding such as time→sample range mapping;
- `apps/web/src/components/graph-viewport.ts` — Web-only viewport-first activation, progressive fallback behavior, active resident-channel lifecycle and interaction scheduling;
- `apps/web/src/pages/logger-page.ts` — workspace restore coordination, graph/timeline propagation and performance diagnostics integration.

The current performance work does not authorize a new top-level cache/backend subsystem. Persistent columnar/indexed storage remains a future architectural option, especially for Linux, and requires explicit review before introduction.''', prepend=True)

upsert_block('docs/LOG_MLG_PLAN.md', 'current-large-log-performance-state', '''## Current large-log performance state

The authoritative performance regression log is now `2026-07-14_22.07.05.mlg` (1,193,898,186 bytes, 320,458 records, 1,389 channels), in addition to the older 318 MB validation logs retained as parser/recovery evidence.

The Web implementation has demonstrated that row-oriented MLG makes an arbitrary full single-channel materialization fundamentally source-I/O heavy: on the fast desktop it is sub-second, while the 2-thread laptop can spend roughly 5–8 seconds scanning about 1.13 GB for one new full channel.

Current policy therefore combines bounded viewport-first activation with a one-time resident full-channel materialization. Fixed 8,192-sample decoded chunks support bounded reuse. Once an active channel is fully resident, zoom/pan must not require another source traversal for that channel.

The next low-spec task is to cap the first viewport activation near 16,384 centered samples so a wide viewport cannot force an 80k-sample / hundreds-of-MiB read before first paint. Checksum/retry semantics must not be altered as a performance shortcut.''', prepend=True)

upsert_block('docs/UI_REFERENCE.md', 'current-performance-ui-note', '''## Current performance-driven UI behavior

The current large-log implementation may initially show only bounded horizontal coverage for a newly selected arbitrary channel while complete resident data is being materialized. This is an approved performance behavior so long as channel identity, viewport/navigation semantics and source truth are preserved. Once resident, navigation should feel immediate without repeated source reads.

Do not change established UI colors merely to address performance or apparent visibility reports unless the project owner explicitly requests a palette change. A recent apparent color problem was confirmed to be a TN-monitor viewing-angle effect, not a color-system defect.''', prepend=True)

upsert_block('docs/WEB_BOOT_PLAN.md', 'historical-status', '''> **Historical bootstrap authority.** WEB-BOOT is complete and deployed. This document remains the detailed record of the initial toolchain/shell task and should not be read as the current implementation status. For current development state, use `docs/HANDOFF.md`, `docs/ROADMAP.md`, and `docs/PERFORMANCE.md`.''', prepend=True)

upsert_block('docs/WORKFLOW.md', 'current-performance-workflow', '''## Current large-log performance workflow

For performance work, the normal repository workflow is supplemented by measured A/B validation:

1. start from authoritative `main`;
2. make one focused performance change on a short-lived branch;
3. run type-check, full tests and production build;
4. merge only after the final diff contains no temporary patch/workflow artifacts;
5. verify post-merge Web CI and GitHub Pages deployment;
6. benchmark the deployed build with the same representative log and interaction sequence;
7. compare physical reads/bytes/time, decode/render time and subjective interaction behavior;
8. when relevant, repeat on the 2-thread / 4 GB laptop before calling the optimization settled.

Temporary branch-only GitHub workflows/scripts are acceptable for controlled patching/validation but must remove themselves before the PR. Do not require the project owner to create a local clone for normal testing.

Current caution: a prior channel concurrency/pipelining experiment (PR #89) regressed behavior and was reverted. Reintroducing similar concurrency requires new evidence rather than assumption.''', prepend=True)

# Ensure every docs/*.md carries an explicit current-state pointer, including historical/reference docs.
for p in sorted((ROOT / 'docs').glob('*.md')):
    if p.name == 'HANDOFF.md':
        continue
    text = p.read_text()
    marker = '<!-- CURRENT_STATE:handoff-pointer:START -->'
    if marker in text:
        continue
    pointer = ('<!-- CURRENT_STATE:handoff-pointer:START -->\n'
               '> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. '
               'If a status statement in this document describes an older milestone, use the handoff plus current `main`/CI state for present-tense continuation.\n'
               '<!-- CURRENT_STATE:handoff-pointer:END -->\n\n')
    p.write_text(pointer + text)
