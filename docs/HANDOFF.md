# EpicScope Handoff

## Repository

`PJawZK/EpicEFI-EpicScope`

## Authoritative branch

`main`

## Active development branch

`phase1/web-reference`

## Current project phase

**Phase 1 — Web log foundation**

`WEB-REFERENCE` is complete on the active branch. The next task is to define `WEB-BOOT` precisely before application code is created.

## Current objective

Review/merge the completed UI-reference work, then define the first concrete Web bootstrap task batch, exact file locations, and minimal tooling stack under the existing lightweight-TypeScript and dependency policies.

## Latest completed work

Phase 0 foundation is complete.

Phase 1 `WEB-REFERENCE` has now been completed using both:

- the authoritative `EpicHub-Tablet-Landscape-0.0.45(2).html` prototype supplied by the project owner;
- current EpicHub authority on `PJawZK/EpicHub-EpicEFI-Android`, branch `phase2/ui-diagnostics-foundation`, especially `docs/HANDOFF.md`, `docs/architecture/UI_FOUNDATION_LAYOUT.md`, and `docs/architecture/ANALYSIS_RESPONSIBILITY_MAP.md`.

`EpicHub-Tablet-Landscape-0.0.45(2).html` supersedes the older `EpicHub-1.12.1_TabletLandscape.html` prototype for EpicScope UI-reference purposes.

A new authority document now exists:

- `docs/UI_REFERENCE.md`

It records the EpicHub Logger/Analyzer concepts EpicScope inherits and the deliberate EpicScope deviations.

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
2. Wide-layout analysis/detail controls are standardized on the **right side**. This deliberately moves Scatter and Histogram/Table control responsibility from the prototype's left side to the right for EpicScope.
3. Initial Web development is offline/imported-log focused; live ECU acquisition and functional recording are deferred.
4. Trigger Logger is not an initial EpicScope requirement and is deferred unless explicitly added later.
5. Performance, RAM usage, and maintainability outrank exact visual reproduction.
6. EpicHub prototype localStorage/JSON/demo-state machinery is not EpicScope production architecture.

The approved cursor-follow behavior is explicit: the playback cursor moves independently until it reaches the middle of the visible range; after that, the viewport follows while retaining the current width. A cursor jump behind the window must recover sensibly.

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
- `docs/UI_REFERENCE.md` is now the EpicScope UI-reference authority;
- `EpicHub-Tablet-Landscape-0.0.45(2).html` is the currently reviewed Tablet Landscape source for that authority.

## Architecture authority

Read these before significant implementation:

1. `docs/PRODUCT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/FILE_ARCHITECTURE.md`
4. `docs/DATA_MODEL.md`
5. `docs/UI_REFERENCE.md`
6. `docs/PERFORMANCE.md`
7. `docs/PLATFORMS.md`
8. `docs/ROADMAP.md`
9. `docs/WORKFLOW.md`
10. `docs/DECISIONS.md`

## Current implementation state

No application code has been added yet.

This remains intentional. `WEB-REFERENCE` was a design/authority task. `WEB-BOOT` must first be split into concrete tasks with approved file ownership and a justified minimal toolchain.

## Current roadmap position

- Phase 0 — **Complete**
- Phase 1 — **In progress**
- `WEB-REFERENCE` — **Complete on active branch**
- next — define and execute `WEB-BOOT`

## Next recommended actions

1. Review/merge `phase1/web-reference` through a pull request.
2. Define the concrete `WEB-BOOT` task split, including exact files, owners, dependencies, tests, and completion criteria.
3. Select the minimal Web build/tooling stack under the dependency policy.
4. Create a new short-lived implementation branch after the reference branch is merged.
5. Bootstrap only the files/directories required by the approved tasks.
6. Begin MLG format investigation/parser-contract work only after the bootstrap/data-contract ownership is clear.

Do not create all documented future directories as empty placeholders.

## Known unresolved items

- Exact Web bundler/build tooling has not yet been selected.
- Exact graph rendering library/approach has not yet been selected.
- MLG parser implementation/spec details have not yet been investigated in EpicScope.
- Branch protection/ruleset enforcement has not yet been configured; workflow policy remains documented authority.
- Final Linux UI toolkit/runtime architecture remains intentionally deferred until Web functionality matures.
- Future share/backend architecture has not been approved and must not be introduced incidentally.
- Narrow/portrait/mobile presentation is not defined by the Tablet Landscape authority and should not be guessed during the first Web shell work.

## Repository state validated before this handoff update

`dc5dc90d0fa57389aec0e51fc338ba1739fbd5b9`

This is the active `phase1/web-reference` branch state after correcting the UI-reference authority to EpicHub Tablet Landscape 0.0.45 and before this handoff-file update.

Because a file cannot reliably contain the SHA of the commit that writes itself, this SHA is not presented as the final branch head. A resumed chat must inspect current `main` and the active branch/PR first.

## Continuation instruction

In a new chat, the user should be able to say:

> Read the EpicScope repository handoff and continue from there.

The new chat must read this file first, inspect current `main` and any active branch/PR, then inspect referenced authoritative repository files before making changes. Do not reconstruct current architecture from old chat history when newer repository authority exists.
