# EpicScope Handoff

## Repository

`PJawZK/EpicEFI-EpicScope`

## Authoritative branch

`main`

Implementation baseline entering this handoff refresh:

`156846d499cf066405ef50dd48229e0702d59bdd`

That baseline is the merge of PR #163, **Refactor logger pane layout state**. It also includes the completed arbitrary-channel access architecture and the first three repository/file-structure audit batches described below.

The documentation-only merge that updates this handoff becomes the newer authoritative `main`; no application behavior is changed by this handoff refresh itself.

## Hosted application

`https://pjawzk.github.io/EpicEFI-EpicScope/`

GitHub Actions remains the required Web validation path and GitHub Pages remains the project-owner test surface. Normal project-owner testing does not require a local clone, Node.js or npm.

## Current project position

EpicScope Web has a working large-log MLG v1/v2 path, INI-backed channel catalog/binding, reusable application workspaces, exact-log persistence, multi-pane graph/timeline workflows, large-log diagnostics, and a post-index column-access architecture that no longer rereads the original row-oriented MLG for normal restored/arbitrary channel use.

The earlier performance investigation is considered **good enough for now**. Do not continue optimizing storage/read latency merely because additional micro-optimizations are possible. The project has substantial feature work remaining, and performance should be re-profiled again after more features are present.

The active engineering focus is now:

> **Continue the repository/file-structure audit conservatively, then proceed with remaining product features.**

Audit work must preserve behavior. Split or move code only where a responsibility boundary is coherent and independently testable; do not refactor performance-critical restore/render paths for line-count aesthetics.

## Current large-log benchmark authority

Primary benchmark log:

`2026-07-14_22.07.05.mlg`

Known structure:

- size: **1,193,898,186 bytes**;
- MLVLG v2;
- **320,458 records**;
- **1,389 logged channels**;
- fixed record scan;
- source Blob page size: 32 MiB;
- source cache ceiling: about 96 MiB;
- pinned-source allowance: about 64 MiB.

Canonical low-spec test environment:

- Chromium/Brave class browser on Linux;
- 1,366×645 DPR 1;
- **2 logical threads**;
- 4 GB RAM class machine;
- one reusable workspace;
- 15 assigned visible channels in the current benchmark workspace;
- 14 renderable/requested channels;
- one known-unavailable channel (`ini:afrGasolineScale`).

Recent runs on this machine typically show:

- initial MLG scan/load roughly **10–11 s** for the current staged workflow;
- restored 14-channel workspace roughly **0.4–0.5 s**;
- restored workspace batch itself only a few milliseconds and with **zero original-log physical rereads**;
- background CRC validation and sidecar work can continue well beyond usable UI readiness.

Do not collapse usable-UI time and total background-completion time into one performance claim.

## Current MLG post-index access architecture

The authoritative path is now layered:

1. **Session/RAM full-range cache** for channels already materialized this page session.
2. **Persistent decoded cache wrapper** remains available generically, but the current MLG sidecar path owns its own persistent columns rather than storing an additional Float64 IndexedDB copy.
3. **Primary OPFS MLG sidecar** stores the raw record payload transposed into native-width stripes.
4. **Sparse on-demand native-width per-channel OPFS cache** stores only channels the user actually selects, for faster cross-session reuse.
5. **Original row reader fallback** remains for unsupported/missing paths.

### Primary sidecar

Current proven configuration:

- one OPFS `columns.bin` representation per log;
- **59 stripes** on the canonical log;
- target stripe width: **64 bytes**;
- stored native payload: **1,191,462,844 bytes** for the canonical log;
- compatible sidecars are reused across sessions;
- restored priority/workspace channels can be captured during initial scan so workspace restore does not need a sidecar reread.

A 16-byte stripe experiment was tested and rejected as the default. It increased stripe count to 238 and materially increased transpose work without improving end-to-end first-channel latency enough to justify the cost. Keep 64-byte stripes unless new evidence changes the trade.

### Sparse native per-channel cache

PRs #159–#160 added and corrected a second OPFS representation for channels the user actually selects:

- first-ever selection can still use the 64-byte stripe path;
- the requested field's raw native bytes are persisted on demand;
- later sessions can read only that compact native column instead of the whole stripe;
- native columns live in a separate OPFS root so normal sidecar rebuild/reset does not erase them;
- missing/stale/corrupt native entries fall back to the 64-byte sidecar;
- **Clear channel cache** clears the decoded persistent cache, primary sidecars and sparse native-column cache while preserving workspace/state.

Measured proof on the canonical low-spec system:

Previously native-cached `accelerationLat` after reload:

- total selection: **253.5 ms**;
- read/decode: **112.6 ms**;
- native file open: **53.2 ms**;
- blob read: **38.7 ms**;
- decode: **19.7 ms**.

In the same session, previously unseen `accelEventTriggeredCnt` through the ordinary stripe path:

- total selection: **345.3 ms**;
- read/decode: **263.1 ms**;
- blob read: **168.1 ms**;
- decode: **92.5 ms**.

Once either channel is resident in RAM, repeated selection is effectively free on the data-read side (`~0.1–0.2 ms` read/decode), leaving normal scale/render work.

This is sufficient evidence to keep the sparse native cache. The remaining native-file-open cost is **not an active optimization target now**.

## Workspace restore performance state

The old multi-second workspace restore problem is considered solved for the current architecture.

Important retained optimizations include:

- priority capture of restored channels during initial MLG scan;
- worker-computed full-channel statistics for captured priority channels;
- exact 64-sample envelope summaries for restored traces;
- single shared full-range workspace batch;
- removal of redundant prepare/final-sync rendering and assignment work;
- timeline overview reuse of exact envelope blocks.

On the canonical low-spec system, complete restore is generally around the **400–500 ms** region. The remaining time is mostly canvas/envelope/overview/UI work, not source I/O. Do not reopen workspace optimization unless product changes or new measurements justify it.

A generic multilevel envelope experiment regressed performance and was reverted. Do not reintroduce coarse multilevel envelope selection without new evidence.

## Concluded/rejected performance experiments

### Opportunistic startup predecode

PRs #127–#129 tested `?predecode=32/64/128`. The approach merely moved channel cost into startup and benefited only a chosen subset.

PR #130 documented this experiment as removed, but the later repository audit discovered that the runtime path had not actually been fully removed from `logger-page.ts`.

PR #161 completed the removal:

- deleted `?predecode=32/64/128` parsing;
- deleted arbitrary-channel expansion of the workspace batch;
- deleted predecode diagnostics/count state;
- restored normal workspace-only batch semantics.

Do not restore opportunistic startup predecode without a new architectural decision.

### Smaller sidecar stripes

The 16-byte stripe test reduced bytes read per arbitrary request but increased builder transpose cost substantially and did not improve end-to-end selection enough. The authoritative stripe target remains **64 bytes**.

## Current repository/file-structure audit

The planned audit is now **active**, not future work.

Rules:

- preserve runtime behavior;
- use `docs/ARCHITECTURE.md` and `docs/FILE_ARCHITECTURE.md` as ownership authority;
- prefer small focused batches;
- add/strengthen tests when extracting pure responsibilities;
- do not split large files simply to reduce line count;
- keep restore/render/storage hot paths stable unless a concrete ownership defect warrants change.

Completed audit batches:

### PR #161 — rejected predecode runtime path

Removed the dormant but still functional opportunistic predecode experiment from `logger-page.ts`.

### PR #162 — diagnostics ownership drift

Removed the undocumented `core/diagnostics/` ownership island by moving existing code to its actual owners:

- `bound-cache-observability.ts` → `core/channels/`;
- `channel-decode-performance.ts` → `core/parsers/mlg/`.

GitHub recognized these as renames; only imports changed.

### PR #163 — first logger-page responsibility extraction

Extracted pure pane/layout state from the oversized `logger-page.ts` into:

`apps/web/src/state/logger-pane-layout.ts`

The module owns:

- stable pane IDs;
- layout→pane-count mapping;
- freeform geometry presets;
- empty pane construction;
- legacy/current pane normalization.

Added focused tests in:

`tests/web/logger-pane-layout.test.ts`

No DOM, I/O, restore orchestration or graph rendering behavior moved.

## Current structural pressure points

Largest Web source files observed during the audit include approximately:

- `apps/web/src/pages/logger-page.ts` — ~95 KB before the first extraction;
- `apps/web/src/components/graph-viewport.ts` — ~66 KB;
- `apps/web/src/app/app-shell.ts` — ~63 KB;
- `apps/web/src/components/performance-diagnostics.ts` — ~42 KB;
- `apps/web/src/components/timeline-shell.ts` — ~39 KB;
- `apps/web/src/panels/inspector-panel.ts` — ~32 KB;
- `apps/web/src/adapters/mlg-column-sidecar-v1.ts` — ~32 KB;
- `apps/web/src/workers/mlg-import.worker.ts` — ~24 KB.

Large size alone is not a defect.

The next promising `logger-page.ts` boundary is the parser/source-integrity diagnostics responsibility (diagnostic summarization, grouping/report preparation and the diagnostics indicator/popover). Inspect ownership and usages before extracting it. Avoid touching workspace restore/render orchestration merely as part of cleanup.

Other future audit candidates include:

- separating collection/report formatting from `performance-diagnostics.ts` if a clean boundary is found;
- inspecting `app-shell.ts` for independently testable import/persistence/orchestration responsibilities;
- tracing compatibility/re-export files before removal;
- confirming reusable-workspace persistence vs exact-log persistence remain intentionally separate.

## Current channel/cache behavior

Retained semantics:

- workspace restore requests only visible/renderable workspace channels;
- visible workspace channels share one batch;
- known-but-unavailable INI channels remain assigned and visible as unavailable;
- stable logical `ini:<logicalKey>` identities remain authoritative for reusable workspace assignments;
- MLG remains authoritative for recorded values and validity;
- log-only channels remain usable;
- repeated full-range channel selections are retained in session RAM;
- sparse native MLG columns persist only for channels actually used;
- cache clearing is explicit and must not remove reusable workspace/state.

## Current workspace / source-context state

Implemented and retained:

- INI parsing and normalized channel catalog;
- stable logical `ini:<logicalKey>` identity;
- conservative INI↔MLG binding;
- known/no-data channels remain visible;
- usable log-only channels remain usable;
- reusable application workspace persists named workspaces, layouts/geometry and stable channel assignments independently of exact log identity;
- exact-log persistence remains separate for cursor/viewport/A-B/markers/ranges;
- restored catalog/workspace state is distinct from freshly loaded state;
- Settings can unload the persisted INI catalog for repeatable fresh-load testing;
- Settings can clear channel/cache storage independently of workspace state.

MSQ tune-value/table enrichment remains later work. CSV remains deferred unless roadmap priorities change.

## Graph / timeline state

Implemented and working:

- multiple reusable workspaces;
- fixed and freeform multi-pane layouts;
- shared viewport/cursor/timeline/A-B navigation;
- active-pane context;
- graph/timeline source markers and user markers;
- saved ranges and view history;
- high-zoom raw-sample rendering and zoomed-out exact envelope rendering;
- Now/Min/Max and channel details;
- source validity handling;
- timeline overview;
- workspace state restoration independent of the abandoned predecode experiment.

Canvas 2D remains a Web implementation choice, not a Linux/Android architecture commitment.

## Performance diagnostic rules

Performance diagnostics remain the Web measurement authority. When performance work resumes, record/compare:

- workload/log;
- exact build SHA;
- browser/hardware class and logical thread count;
- cold/warm session and persistent cache state;
- sidecar status/configuration;
- requested/unique channel count;
- physical source read count/bytes/time;
- initial scan/load time;
- workspace restore breakdown;
- arbitrary first-channel activation breakdown;
- persistent lookup/delegation timings;
- sidecar/native file-open, blob-read and decode timings;
- subjective interaction behavior;
- memory/GC pressure where observable.

Do not claim MegaLogViewer's internal implementation strategy as fact. It remains only a behavioral comparison target.

## UI/reference constraints still in force

- authoritative Logger/Analyzer visual/interaction reference remains `EpicHub-Tablet-Landscape-0.0.45(2).html`;
- use TunerStudio/MegaLogViewer channel terminology where practical;
- do not change established UI colors because of monitor-angle/visibility reports unless explicitly requested;
- performance or cleanup work must not silently change interaction semantics.

## Repository/workflow constraints

- `main` is authoritative;
- normal implementation uses a focused branch/PR;
- run type-check, tests and production build before merge;
- verify post-merge Web CI and GitHub Pages deployment;
- temporary branch-only patch/validation workflows or scripts must be removed before the final PR diff;
- avoid accidental/no-op commits on `main`;
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

When older documents contain milestone/status statements that conflict with this handoff or current `main`, use this handoff plus the current repository/CI state for present-tense continuation.

## Exact next task

Continue the repository/file-structure audit from current `main`.

Highest-value immediate candidate:

1. inspect the parser/source-integrity diagnostics responsibility still embedded in `apps/web/src/pages/logger-page.ts`;
2. decide whether pure summarization belongs in parser/model code and whether the DOM indicator/report belongs in a Web component;
3. extract only if the boundary is clean and behavior can be covered by focused tests;
4. otherwise leave it in place and move to the next audit candidate.

Do not restart storage/channel micro-optimization unless a new feature or benchmark demonstrates a real regression.

## Continuation instruction

A new chat should be able to start with:

> Read `docs/HANDOFF.md` in `PJawZK/EpicEFI-EpicScope`, inspect current `main`/PR/CI state, and continue from there.

Use the repository handoff and current repository state as authority. Do not reconstruct present architecture from older chats or superseded performance experiments.
