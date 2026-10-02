# EpicScope Handoff

## Repository

`PJawZK/EpicEFI-EpicScope`

## Authoritative branch

`main`

## Active development branch / PR

- branch: `main`
- current task: hosted validation of multi-channel traces and Channel Value Search

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
- EpicScope-logo module menu and EpicHub-style edge-panel controls.

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

## Graph renderer status

The current Canvas 2D renderer is **Experimental**.

- it uses bounded raw-preserving downsampling rather than plotting every source record;
- CRC-invalid samples are excluded from trusted graph data;
- visual output is not yet accepted as final, especially for sparse/conditional channels;
- UI/renderer polish is intentionally paused until the navigation and multi-channel feature set is further established;
- do not replace source behavior with smoothing/averaging simply to make the trace look nicer.

Canvas 2D is an initial Web renderer choice, not a Linux/Android architecture commitment.

## Active viewport/navigation increment

`phase1/viewport-navigation` adds a reusable viewport model under `core/timeline/` and connects it to the Web graph/timeline.

Target behavior:

- Fit restores full-log view;
- +/− controls zoom around the current cursor;
- mouse wheel over the graph zooms around the pointer location;
- graph drag pans the visible time range;
- timeline overview contains a real focus-window rectangle;
- focus window can be dragged to pan;
- cursor remains independent until it passes the visible-range midpoint, then the viewport follows it in the direction of travel;
- graph rendering operates on the visible time range rather than always compressing the entire log.

The viewport math belongs to `core/timeline/`; Web components only emit interaction intent and render the resulting state.

## Next after hosted multi-channel / value-search validation

1. improve the whole-log timeline overview with actual trace/event content;
2. expand Value Search if needed after real-log use (for example multiple constraints, ranges, event-aware ranking, or distinct-value handling);
3. add session/workspace persistence for selected channels, viewport state and search state;
4. revisit graph rendering only with real multi-channel/zoom workflows available;
5. improve retry/recovery diagnostic classification without silently repairing source data;
6. complete the first Web performance baseline.

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
