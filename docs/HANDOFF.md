# EpicScope Handoff

## Repository

`PJawZK/EpicEFI-EpicScope`

## Authoritative branch

`main`

## Active development branch

`phase1/web-boot-plan`

## Current project phase

**Phase 1 — Web log foundation**

`WEB-REFERENCE` has been merged to `main`. `WEB-BOOT` is now fully planned on the active branch; no application code has been created yet.

## Current objective

Review/merge the WEB-BOOT planning authority, then create a fresh short-lived implementation branch and execute only the approved bootstrap tasks/files from `docs/WEB_BOOT_PLAN.md`.

## Latest completed work

Phase 0 foundation is complete.

Phase 1 `WEB-REFERENCE` is complete and merged to `main` as squash commit:

`59b4e5171a1cce5e34c5b900ca2e4cbfe6c0b5a7`

The authoritative UI source is:

- `EpicHub-Tablet-Landscape-0.0.45(2).html`

It supersedes the older Tablet Landscape prototype for EpicScope UI-reference purposes.

The current planning branch adds:

- `docs/WEB_BOOT_PLAN.md`;
- detailed `WEB-BOOT-001` through `WEB-BOOT-004` task definitions;
- approved root Web tooling files and initial physical Web source files in `FILE_ARCHITECTURE.md`;
- D-034 for the initial Web toolchain;
- roadmap alignment and correction of the remaining stale older-prototype reference.

## WEB-BOOT approved direction

Toolchain:

- npm with committed `package-lock.json`;
- Vite 8.x;
- vanilla TypeScript 7.x;
- browser-native HTML/CSS/DOM APIs;
- Chromium/Brave-first smoke testing.

Not approved as part of WEB-BOOT:

- React/Vue/Svelte/Lit or another frontend framework;
- graph/chart library;
- state-management framework;
- CSS framework;
- general UI component library;
- dedicated test framework solely for static shell code.

The Vite/Node requirement is Web build tooling only; it does not redefine the eventual Linux runtime/platform baseline.

## WEB-BOOT task split

1. `WEB-BOOT-001` — toolchain scaffold.
2. `WEB-BOOT-002` — dedicated EpicScope application shell.
3. `WEB-BOOT-003` — Logger workspace/right inspector/bottom timeline skeleton.
4. `WEB-BOOT-004` — bootstrap quality gate.

Exact files, responsibilities, prohibitions, validation, and completion criteria are defined in `docs/WEB_BOOT_PLAN.md`.

The initial implementation must not create parser, analyzer, fake log-data, or graph-library architecture merely to make the shell look functional.

## UI-reference decisions

EpicScope inherits the following interaction families from the 0.0.45 reference:

- graph-centric primary analysis workspace;
- named graph workspaces and multiple graph layouts;
- contextual workspace rename/duplicate/delete behavior;
- Full Sensor List / channel search/filter/sort/favorites/recent behavior;
- Channel Statistics/details;
- explicit side-edge sensor-panel show/hide control;
- persistent timeline/range/cursor concepts;
- expandable/compact timeline-control behavior with its own edge control;
- saved ranges and markers;
- A/B cursors;
- source/session comparison concepts;
- Scatter Plot;
- Histogram / Table;
- Math Channels / derived channels;
- named filters and analysis presets;
- linked navigation from analysis results to graph/source context;
- snapshots/session metadata where useful;
- explicit loaded-log identity in the header;
- visible recording-state/action semantics, without implying that initial EpicScope Web already supports live acquisition.

Approved EpicScope deviations from the EpicHub prototype:

1. EpicScope uses a dedicated product shell rather than EpicHub's Dashboard/Tuner/Logger/Diagnostics module switcher.
2. Wide-layout analysis/detail controls are standardized on the **right side**.
3. Initial Web development is offline/imported-log focused; live ECU acquisition and functional recording are deferred.
4. Trigger Logger is deferred unless explicitly added later.
5. Performance, RAM usage, and maintainability outrank exact visual reproduction.
6. Prototype localStorage/JSON/demo-state machinery is not EpicScope production architecture.

The approved cursor-follow behavior remains: the playback cursor moves independently until it reaches the middle of the visible range; after that, the viewport follows while retaining the current width.

## Current approved decisions

The authoritative decision log is `docs/DECISIONS.md`.

Notable current decisions include:

- **EpicEFI – EpicScope** / **EpicScope** naming;
- Web → Linux → Android/EpicHub development order;
- lightweight TypeScript, Chromium/Brave-first Web direction;
- MLG first, CSV second;
- Debian 13 Stable Linux baseline;
- mature Linux target: supported 1 GiB log on a 2 GiB RAM system without holding the complete source in memory;
- performance and low RAM outrank visual polish;
- controlled architecture/task-to-file planning;
- project-owner approval required for architectural changes;
- local-first privacy and untrusted-input handling;
- raw source decoding in `core/parsers/`, normalized semantics in appropriate core models;
- domain Session separated from UI WorkspaceState;
- capability-driven Boost Analyzer;
- `docs/UI_REFERENCE.md` is the EpicScope UI-reference authority;
- `docs/WEB_BOOT_PLAN.md` is the detailed initial Web bootstrap authority;
- initial Web bootstrap uses npm + Vite 8.x + vanilla TypeScript 7.x with no frontend framework.

## Architecture authority

Read these before significant implementation:

1. `docs/PRODUCT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/FILE_ARCHITECTURE.md`
4. `docs/DATA_MODEL.md`
5. `docs/UI_REFERENCE.md`
6. `docs/WEB_BOOT_PLAN.md` when working on WEB-BOOT
7. `docs/PERFORMANCE.md`
8. `docs/PLATFORMS.md`
9. `docs/ROADMAP.md`
10. `docs/WORKFLOW.md`
11. `docs/DECISIONS.md`

## Current implementation state

No application code has been added yet.

This remains intentional. The planning branch defines exact files before implementation, in accordance with the project's controlled-file-architecture rules.

## Current roadmap position

- Phase 0 — **Complete**
- Phase 1 — **In progress**
- `WEB-REFERENCE` — **Complete and merged**
- `WEB-BOOT` — **Planned on active branch; implementation pending**
- next after WEB-BOOT — `LOG-MLG`

## Next recommended actions

1. Review/merge `phase1/web-boot-plan` through a pull request.
2. Create a fresh short-lived `phase1/web-boot` implementation branch from the resulting `main`.
3. Execute `WEB-BOOT-001` through `WEB-BOOT-004` exactly as defined in `docs/WEB_BOOT_PLAN.md`.
4. Merge only after type-check, production-build, and Brave/Chromium smoke validation pass.
5. Before `LOG-MLG` implementation, select/document the parser/core automated test strategy.
6. Investigate MLG format/parser contracts without allowing source-format details into the Web UI.

Do not create all documented future directories as empty placeholders.

## Known unresolved items

- Exact graph rendering library/approach remains intentionally unselected until graph/timeline workload requirements are concrete.
- Parser/core automated test runner/strategy remains intentionally unselected until LOG-MLG planning.
- MLG parser implementation/spec details have not yet been investigated in EpicScope.
- Branch protection/ruleset enforcement has not yet been configured; workflow policy remains documented authority.
- Final Linux UI toolkit/runtime architecture remains intentionally deferred until Web functionality matures.
- Future share/backend architecture has not been approved and must not be introduced incidentally.
- Narrow/portrait/mobile presentation is not defined by the Tablet Landscape authority and should not be guessed during the first Web shell work.

## Repository state validated before this handoff update

`0fd2889243b1cc40e73fd3d182bcc0c1f7ec0164`

This is the active `phase1/web-boot-plan` branch state after the WEB-BOOT plan, roadmap, decision, and file-architecture updates and before this handoff-file update.

Because a file cannot reliably contain the SHA of the commit that writes itself, this SHA is not presented as the final branch head. A resumed chat must inspect current `main` and the active branch/PR first.

## Continuation instruction

In a new chat, the user should be able to say:

> Read the EpicScope repository handoff and continue from there.

The new chat must read this file first, inspect current `main` and any active branch/PR, then inspect referenced authoritative repository files before making changes. Do not reconstruct current architecture from old chat history when newer repository authority exists.
