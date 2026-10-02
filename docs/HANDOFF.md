# EpicScope Handoff

## Repository

`PJawZK/EpicEFI-EpicScope`

## Authoritative branch

`main`

## Active development branch / PR

- branch: `main`
- current task: continue Phase 1 timeline/navigation work after validated large-log performance, overview rendering and high-zoom fixes

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
- high-zoom raw-sample rendering with real source-gap detection and a 500 ms minimum viewport span.

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

The remaining noisy counter diagnostics are a classification/presentation issue, not evidence of parser offset drift. Do not change the documented MLG checksum formula to suppress them.

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
- decoded-cache remove/re-add behavior is hosted-validated: re-adding RPM, MAP, TPS and `lowerWgSolenoidTestActive` produced `cacheHit=true`, `physicalReads=0`, and `physicalBytes=0`.

## Graph renderer status

The current Canvas 2D renderer is **Experimental**.

- it uses bounded raw-preserving downsampling rather than plotting every source record;
- CRC-invalid samples are excluded from trusted graph data;
- visual output is not yet accepted as final, especially for sparse/conditional channels;
- UI/renderer polish is intentionally paused until the navigation and multi-channel feature set is further established;
- do not replace source behavior with smoothing/averaging simply to make the trace look nicer.

Canvas 2D is an initial Web renderer choice, not a Linux/Android architecture commitment.

## Current Phase 1 continuation

Viewport/navigation, multi-channel graphing, Channel Value Search, the first large-log performance increment, whole-log overview rendering, decoded-channel cache reuse, and the high-zoom renderer path are implemented and hosted-validated.

The current timeline increment adds Previous/Next navigation for parsed source markers. After hosted validation of that control, continue Phase 1 functional work in this order unless real-log use changes priority:

1. expand Value Search only where real-log use shows a concrete need;
2. add session/workspace persistence for selected channels, viewport state and search state;
3. continue timeline usability work where marker/range workflows expose concrete gaps;
4. revisit broader graph rendering only when real workflows expose additional renderer issues;
5. improve retry/recovery diagnostic classification without silently repairing source data;
6. keep extending the Web performance baseline as real workflows are exercised.

## Key constraints still in force

- Web -> Linux -> Android/EpicHub;
- Chromium/Brave first;
- MLG first, CSV second;
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
