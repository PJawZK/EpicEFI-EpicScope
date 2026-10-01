# EpicScope Handoff

## Repository

`PJawZK/EpicEFI-EpicScope`

## Authoritative branch

`main`

## Active development branch / PR

- branch: `phase1/timeline-graph-foundation`
- PR: #11
- current task: first real channel graph + timeline cursor integration

## Current phase

**Phase 1 — Web log foundation**

Completed:

- Phase 0 foundation;
- WEB-REFERENCE using `EpicHub-Tablet-Landscape-0.0.45(2).html`;
- WEB-BOOT hosted through GitHub Actions + GitHub Pages and validated in Brave;
- LOG-MLG planning and parser foundation;
- MLG v1/v2 header/descriptor parsing;
- compact record indexing, marker support and timestamp rollover handling;
- browser-local MLG import and Full Sensor List population;
- bounded normalized numeric channel reads;
- Vitest 5.x parser/core test gate;
- real current EpicEFI/TunerStudio MLG v2 validation.

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
- CRC-invalid samples are retained as traceable source evidence through the normalized validity array and must not be treated as trusted graph/analysis samples;
- 8-bit block counter uses full 0..255 wrap (`254 -> 255 -> 0` is valid).

The remaining noisy counter diagnostics are a classification/presentation issue, not evidence of parser offset drift. Do not change the documented MLG checksum formula to suppress them.

## Active graph/timeline increment

PR #11 introduces the first actual Web data visualization path:

- click a Full Sensor List channel to graph it;
- native Canvas 2D renderer for the initial Web implementation;
- generic viewport-envelope primitive under `core/timeline/`;
- CRC-invalid samples excluded from trusted viewport envelopes;
- timeline click/drag/keyboard cursor;
- start/back/forward/end cursor controls;
- graph cursor and selected-channel readout synchronized to timeline.

Deliberate limits of this increment:

- one graph trace at a time;
- full-log visible range only;
- no zoom/pan yet;
- play/pause disabled;
- A/B/range/marker editing deferred.

Canvas 2D is an initial Web renderer choice, not a Linux/Android architecture commitment. No third-party graph library has been introduced.

## Next after hosted validation

If PR #11 passes hosted Brave validation:

1. add viewport zoom/pan and Fit;
2. implement the approved cursor-follow model (cursor free until center region, viewport then follows);
3. add multi-trace graph panes while preserving bounded queries/decimation;
4. improve retry/recovery diagnostic classification without silently repairing source data;
5. complete the first Web performance baseline.

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
