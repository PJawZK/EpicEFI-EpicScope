# EpicScope Handoff

## Repository

`PJawZK/EpicEFI-EpicScope`

## Authoritative branch

`main`

## Active development branch

`phase1/web-boot`

## Current project phase

**Phase 1 — Web log foundation**

`WEB-REFERENCE` and the `WEB-BOOT` implementation plan are merged to `main`. `WEB-BOOT` implementation is now in progress on the active branch.

## Current objective

Complete and validate the initial EpicScope Web shell exactly as defined in `docs/WEB_BOOT_PLAN.md`, then merge it before beginning `LOG-MLG` planning/investigation.

## Latest completed work

Phase 0 foundation is complete.

Phase 1 `WEB-REFERENCE` is complete and merged. The authoritative UI source is:

- `EpicHub-Tablet-Landscape-0.0.45(2).html`

It supersedes the older Tablet Landscape prototype for EpicScope UI-reference purposes.

The WEB-BOOT planning authority is also merged to `main` and defines:

- npm + Vite 8.x + vanilla TypeScript 7.x;
- no frontend framework;
- exact initial root tooling files;
- exact initial Web source files;
- `WEB-BOOT-001` through `WEB-BOOT-004`;
- no graph library during bootstrap;
- no parser/domain-analysis logic in the Web shell.

## Current implementation state

The active `phase1/web-boot` branch now contains the first application code.

Implemented files:

- `.gitignore`
- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `apps/web/index.html`
- `apps/web/src/main.ts`
- `apps/web/src/app/app-shell.ts`
- `apps/web/src/pages/logger-page.ts`
- `apps/web/src/panels/inspector-panel.ts`
- `apps/web/src/components/timeline-shell.ts`
- `apps/web/src/styles/tokens.css`
- `apps/web/src/styles/app.css`

Implemented shell responsibilities:

- dedicated EpicScope product header;
- recorded-analysis/log identity placeholder;
- graph-workspace host with no fake graph data;
- right-side Full Sensor List/inspector shell;
- explicit sensor-panel edge show/hide behavior derived from 0.0.45;
- bottom timeline/transport shell;
- expanded/compact timeline-control edge behavior derived from 0.0.45;
- dark technical layout/style derived from the approved reference;
- no Dashboard/Tuner/Diagnostics shell inheritance;
- no parser, analyzer, tune, live ECU, or fake session architecture.

## Validation completed

- strict TypeScript source check passes with the compiler available in the execution environment;
- source files stay inside the approved WEB-BOOT architecture;
- no runtime/frontend framework dependency has been introduced;
- Node engine range was corrected to match Vite's supported `^20.19.0 || >=22.12.0` ranges.

## Validation still required before merge

`WEB-BOOT` must **not** be marked complete yet.

This execution environment cannot currently reach the npm registry. Therefore the following WEB-BOOT quality-gate items remain unverified:

1. generate and commit the real `package-lock.json` from the approved `package.json`;
2. clean npm dependency installation;
3. `npm run typecheck` using the committed TypeScript version;
4. Vite production build;
5. Brave/Chromium visual/interaction smoke check;
6. final no-console-error check.

Do not create a fabricated or incomplete lockfile to bypass this gate.

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

## Current roadmap position

- Phase 0 — **Complete**
- Phase 1 — **In progress**
- `WEB-REFERENCE` — **Complete and merged**
- `WEB-BOOT` — **Implementation in progress; quality gate not yet complete**
- next after WEB-BOOT — `LOG-MLG`

## Next recommended actions

1. Obtain npm registry access in an execution/development environment.
2. Run `npm install` to generate the real `package-lock.json` using the approved dependency versions.
3. Run `npm run typecheck` and `npm run build`.
4. Launch the built/dev Web application in Brave/Chromium and validate sensor/timeline edge controls, layout, console state, and basic resizing.
5. Commit only necessary fixes plus the generated lockfile.
6. Complete `WEB-BOOT-004`, merge the implementation PR, then plan `LOG-MLG` including its automated test strategy.

## Known unresolved items

- WEB-BOOT npm/Vite quality gate remains blocked by registry access in the current execution environment.
- Exact graph rendering library/approach remains intentionally unselected until graph/timeline workload requirements are concrete.
- Parser/core automated test runner/strategy remains intentionally unselected until LOG-MLG planning.
- MLG parser implementation/spec details have not yet been investigated in EpicScope.
- Branch protection/ruleset enforcement has not yet been configured; workflow policy remains documented authority.
- Final Linux UI toolkit/runtime architecture remains intentionally deferred until Web functionality matures.
- Future share/backend architecture has not been approved and must not be introduced incidentally.
- Narrow/portrait/mobile presentation is not defined by the Tablet Landscape authority and should not be guessed during the first Web shell work.

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

## Repository state validated before this handoff update

`5912eac5d0669da6f86be018a4aefbb9cdf5464c`

This is the active `phase1/web-boot` implementation state after the initial shell and Node-engine correction and before this handoff-file update.

Because a file cannot reliably contain the SHA of the commit that writes itself, this SHA is not presented as the final branch head. A resumed chat must inspect current `main` and the active branch/PR first.

## Continuation instruction

In a new chat, the user should be able to say:

> Read the EpicScope repository handoff and continue from there.

The new chat must read this file first, inspect current `main` and any active branch/PR, then inspect referenced authoritative repository files before making changes. Do not reconstruct current architecture from old chat history when newer repository authority exists.
