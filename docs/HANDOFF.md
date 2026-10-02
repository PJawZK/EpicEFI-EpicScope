# EpicScope Handoff

## Repository

`PJawZK/EpicEFI-EpicScope`

## Authoritative branch

`main`

## Active development branch / PR

- branch: `main`
- current task: hosted-validate the final Phase 1 graph-density refinements, then begin the approved INI-backed channel-catalog/persistent-workspace foundation

## Current phase

**Phase 1 — Web log foundation**

Completed and validated:

- Phase 0 foundation;
- WEB-REFERENCE using `EpicHub-Tablet-Landscape-0.0.45(2).html`;
- WEB-BOOT through GitHub Actions + GitHub Pages, validated in Brave;
- MLG v1/v2 header/descriptor parsing;
- compact record indexing, marker support and timestamp rollover handling;
- browser-local MLG import and Full Sensor List population;
- bounded normalized numeric channel reads;
- Vitest 5.x parser/core test gate;
- real current EpicEFI/TunerStudio MLG v2 validation;
- single- and multi-channel graph/timeline integration with up to 8 simultaneous bounded Web traces;
- stable full-log Y scales while horizontal zoom/pan changes only time;
- coordinated timeline focus-window handles, cursor dragging and center-follow navigation;
- compact graph legend using trace-color dot + channel name;
- transient auto-dismiss trace-limit warning instead of a persistent graph overlay;
- Channel Value Search with ranked Max / Min / Closest-to-value results, Previous/Next navigation, and one optional secondary-channel constraint;
- diagnostics moved out of the graph viewport into a compact status/popover control;
- EpicScope-logo module menu and EpicHub-style edge-panel controls;
- staged Worker import for large MLG files, with time-to-usable before full CRC validation completes;
- bounded large-log source caching with a ~96 MiB Web cache ceiling;
- batched multi-channel MLG decoding with a bounded 32 MiB decoded-channel cache;
- automatic large-log channel batch commit when leaving the Full Sensor List, preserving one shared row-oriented decode pass without an extra confirmation click;
- whole-log timeline overview with active trace context and source-marker rendering;
- source-marker Previous/Next navigation tied to the existing cursor/focus-window behavior;
- high-zoom raw-sample rendering with real source-gap detection and a 500 ms minimum viewport span;
- graph workspaces with independent channel/viewport/cursor state;
- timeline annotations: user markers, editable saved ranges, A/B boundaries/range shading and per-workspace view history;
- Full Sensor List favorites/recent filters, Add filtered, MLG-derived groups and active-channel statistics;
- compact graph-corner Now/Min/Max readouts plus floating Channel Details;
- fixed multi-graph layouts (Single, 2×2/4, 2×3/5, 3×2/6) with active-pane channel assignment;
- freeform five-pane graph workspaces with Mosaic/Columns/Rows/Cascade arrangements, drag/resize/snap, minimize/maximize, Clear pane and Reset layout;
- shared cursor/viewport/A-B/timeline state across panes;
- one shared multi-pane restore decode before pane activation so large logs do not require one physical source traversal per pane;
- compact graph-pane chrome: static labels for fixed layouts and draggable floating title chips for freeform panes;
- single-layout stacked channel rows with shared time navigation and compact per-row Now/Min/Max;
- Logger keyboard shortcuts with the reference control housed under Settings;
- consolidated Web WorkspaceState with bounded Undo/Redo history;
- versioned per-log Web workspace persistence using browser-local storage, explicit compatibility validation and a Forget saved workspace escape hatch;
- full parser-diagnostics Copy report;
- conservative MLG retry/recovery classification separating recovered CRC retries, CRC-valid jump/repeat counter patterns, and genuinely unresolved warnings.

## Hosted application

`https://pjawzk.github.io/EpicEFI-EpicScope/`

GitHub Actions is the required Web validation path and GitHub Pages is the project-owner test surface. No local clone/Node/npm is required for normal project-owner testing.

## Real-log validation evidence

Validated file: `2026-10-01_13.29.06.mlg`.

Observed/verified:

- MLG v2;
- 36,452 logger records;
- 1,652 channels;
- parser record boundaries land exactly at EOF;
- source file contains genuine checksum-invalid/retried records;
- CRC-invalid samples are retained as source evidence through the normalized validity array and must not be treated as trusted graph/analysis samples;
- 8-bit block counter uses full 0..255 wrap (`254 -> 255 -> 0` is valid).

Retry/recovery diagnostic classification is now hosted-validated. On the 318 MB benchmark log the final classified result retained 28 recovered CRC retries and 11 CRC-valid jump/repeat patterns as informational evidence, while leaving one unrecovered CRC mismatch and two unpaired counter discontinuities visible as warnings. Do not change the documented MLG checksum formula to suppress genuine source evidence.

### Large-log performance validation

Validated file: `2026-09-30_12.09.28.mlg`.

Observed/verified on the hosted Web build:

- source size: 318,023,627 bytes;
- 72,158 records and 1,652 channels;
- staged Worker import becomes usable in roughly 1.7-2.5 s across observed runs, with full CRC validation completing separately afterward;
- four uncached channels (RPM, MAP, TPS and `lowerWgSolenoidTestActive`) load together as `batch=4`;
- the four-channel batch uses one shared 318,023,627-byte physical traversal rather than four independent source passes;
- validated batch decode/read time is about 1.94 s, with all four performance entries reporting the same ~2.03 s operation total;
- the earlier four independent selections required about 995 MB of cumulative physical channel reads, so shared batching cuts that workflow to roughly one-third of the physical I/O;
- timing-based debounce/coordinator experiments were superseded by staged selection plus automatic commit when the pointer leaves Full Sensor List;
- decoded-cache remove/re-add behavior is hosted-validated: re-adding RPM, MAP, TPS and `lowerWgSolenoidTestActive` produced `cacheHit=true`, `physicalReads=0`, and `physicalBytes=0`;
- later hosted persistence validation restored a four-channel workspace on the same 318 MB log with one shared `batch=4` physical traversal;
- a representative persisted-workspace run reached initial usable load in about 1.95 s and full CRC validation in about 4.85 s.

## Graph renderer status

The current Canvas 2D renderer is **Experimental**.

- it uses bounded raw-preserving downsampling rather than plotting every source record;
- CRC-invalid samples are excluded from trusted graph data;
- sparse/conditional-channel rendering has been improved and hosted-validated, but Canvas 2D remains Experimental;
- renderer/UI refinements are now driven by real workflow evidence rather than a blanket polish freeze;
- do not replace source behavior with smoothing/averaging simply to make the trace look nicer.

Canvas 2D is an initial Web renderer choice, not a Linux/Android architecture commitment.

## Current Phase 1 continuation

The core Web log foundation is substantially complete. Large-log import/batching/cache behavior, retry/recovery diagnostics, graph workspaces, fixed/freeform multi-pane layouts, timeline annotations, channel browser/statistics, keyboard shortcuts, Undo/Redo and exact-log workspace persistence are implemented.

The final Phase 1 gate is hosted validation of the latest graph-density refinement:

1. verify fixed panes no longer consume a full-width header row;
2. verify freeform panes use compact draggable title chips;
3. verify Single layout renders each active channel in its own compact stacked row with Now/Min/Max;
4. verify the keyboard-shortcut control now lives under Settings and Compare is labeled compactly;
5. regression-check multi-pane persistence and the shared restore batch on the 318 MB benchmark log.

After that validation, Phase 1 can close.

The approved next architecture increment is the **INI-backed channel catalog and persistent application workspace**. EpicScope should be able to retain named workspaces, pane layouts and channel assignments when no log is loaded. INI supplies stable known-channel definitions; an opened MLG binds recorded data to those logical channels; missing channels remain present but unavailable; MLG-only channels remain usable. MSQ tune-value/table enrichment follows later. CSV remains deferred.

## Key constraints still in force

- Web -> Linux -> Android/EpicHub;
- Chromium/Brave first;
- MLG remains the first-class log source; CSV is still the secondary log format but is intentionally deferred behind the approved INI channel-catalog work;
- local-first privacy; opening a local log must not upload it;
- source formats normalize before UI/analyzers;
- imported files are untrusted input;
- bounded parser/data APIs must remain compatible with future indexed/native implementations;
- invalid source records must not be silently fabricated or treated as valid;
- MLG v3 remains deferred until authoritative format evidence exists;
- branch protection/ruleset enforcement remains unresolved.

## Architecture authority

Read before significant implementation:

1. `docs/PRODUCT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/FILE_ARCHITECTURE.md`
4. `docs/DATA_MODEL.md`
5. `docs/UI_REFERENCE.md`
6. `docs/LOG_MLG_PLAN.md`
7. `docs/PERFORMANCE.md`
8. `docs/PLATFORMS.md`
9. `docs/ROADMAP.md`
10. `docs/WORKFLOW.md`
11. `docs/DECISIONS.md`

## Continuation instruction

A new chat should be able to say:

> Read the EpicScope repository handoff and continue from there.

The new chat must inspect current repository/branch/CI state rather than reconstructing state from older chat history.
