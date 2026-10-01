# WEB-BOOT Implementation Plan

## Status

**Approved planning baseline — implementation has not started.**

This document defines the exact first Web implementation batch for EpicScope. It exists to keep bootstrap work inside approved architectural ownership and to prevent convenience-driven file growth.

`docs/UI_REFERENCE.md` remains the UI/interaction authority. This document only defines how the first implementation slice is organized.

## Goal

Create the smallest runnable EpicScope Web shell that:

- uses the approved EpicScope product identity;
- follows the Tablet Landscape 0.0.45 Logger/Analyzer reference at the shell/responsibility level;
- proves the build/type-check/development path;
- establishes stable Web composition boundaries before log parsing begins;
- contains no source-format parser, fake domain analysis, tune interpretation, or hidden prototype architecture.

## Approved toolchain

WEB-BOOT uses:

- npm for package management and lockfile generation;
- Vite 8.x as development server/build tool;
- vanilla TypeScript 7.x;
- browser-native HTML/CSS/DOM APIs;
- Chromium/Brave as the primary smoke-test browser.

No frontend framework is approved for WEB-BOOT.

Specifically, WEB-BOOT does **not** add React, Vue, Svelte, Lit, a state-management framework, a CSS framework, a graph/chart library, or a general UI component library.

The installed package lockfile is the exact dependency authority for a given commit. Major dependency changes require review under the project dependency policy.

### Development runtime

Vite 8 supports Node.js 20.19+ or 22.12+.

This Node requirement applies to Web development/build tooling. It does not redefine the eventual EpicScope Linux end-user runtime/platform baseline.

## Root tooling files approved by WEB-BOOT

The following repository-root files are approved because they configure the Web development/build process rather than own application behaviour:

```text
.gitignore
package.json
package-lock.json
tsconfig.json
vite.config.ts
```

Responsibilities:

### `.gitignore`

Ignore generated dependency/build/editor artifacts only. It must not become a substitute for deciding where generated project data belongs.

### `package.json`

Own the minimal Web development scripts and development dependencies.

Initial script responsibilities:

- start development server;
- type-check;
- production build;
- preview production build.

It must not become a general task runner for unrelated platform architecture.

### `package-lock.json`

Generated npm lockfile. Commit it so builds use a reviewable dependency graph.

### `tsconfig.json`

Strict TypeScript compiler policy for the currently implemented TypeScript source tree.

The initial configuration should emphasize:

- strict type checking;
- no emitted JavaScript from `tsc` during normal validation;
- modern browser/ES module targets compatible with the Chromium-first Web policy;
- no path-alias complexity until real cross-area imports justify it.

### `vite.config.ts`

Own Web build/dev-server configuration only.

Initial responsibility:

- use `apps/web/` as the Web root;
- output generated production assets outside source directories;
- avoid plugins unless an approved task requires them.

## Initial physical Web tree

Only the following Web implementation files/directories are approved for the first bootstrap batch:

```text
apps/web/
├── index.html
└── src/
    ├── main.ts
    ├── app/
    │   └── app-shell.ts
    ├── pages/
    │   └── logger-page.ts
    ├── panels/
    │   └── inspector-panel.ts
    ├── components/
    │   └── timeline-shell.ts
    └── styles/
        ├── tokens.css
        └── app.css
```

Do not create unused placeholder directories such as `state/`, additional pages, parser directories, analyzer directories, or future platform trees during WEB-BOOT.

## Task split

### WEB-BOOT-001 — Toolchain scaffold

**Goal:** establish the minimal build/type-check path.

**Files:**

- `.gitignore`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vite.config.ts`
- `apps/web/index.html`

**Dependencies:**

- Vite 8.x
- TypeScript 7.x

**Validation:**

- clean dependency install succeeds;
- TypeScript validation succeeds;
- production build succeeds;
- generated build output is ignored by Git.

**Completion criteria:**

A new checkout can install dependencies and launch/build the empty EpicScope Web application without additional undocumented setup.

---

### WEB-BOOT-002 — EpicScope application shell

**Goal:** implement the dedicated EpicScope shell without importing the broader EpicHub module shell.

**Files:**

- `apps/web/src/main.ts`
- `apps/web/src/app/app-shell.ts`
- `apps/web/src/styles/tokens.css`
- `apps/web/src/styles/app.css`

**Responsibilities:**

- product header/identity;
- loaded-log identity placeholder/state presentation;
- primary Logger/Analyzer surface host;
- right-side inspector host;
- bottom timeline host;
- layout behavior for wide Chromium/Brave viewports;
- dark technical visual language derived from the approved reference without copying prototype state/data machinery.

**Not allowed:**

- fake MLG decoding;
- embedded sample-domain calculations;
- application-wide mutable object copied from the prototype;
- live ECU/recording implementation;
- Dashboard/Tuner/Diagnostics module navigation.

**Validation:**

- shell renders without console errors in Brave/Chromium;
- main workspace, inspector responsibility, and timeline responsibility are visually distinct;
- resizing the browser does not cause uncontrolled overflow at normal desktop/tablet-landscape widths.

**Completion criteria:**

EpicScope visibly exists as its own product shell and its main layout responsibilities match `UI_REFERENCE.md`.

---

### WEB-BOOT-003 — Logger workspace skeleton

**Goal:** establish the first Logger/Analyzer presentation boundaries without implementing graph rendering or domain data.

**Files:**

- `apps/web/src/pages/logger-page.ts`
- `apps/web/src/panels/inspector-panel.ts`
- `apps/web/src/components/timeline-shell.ts`

**Responsibilities:**

`logger-page.ts`:

- graph-workspace host;
- named-workspace/tab presentation boundary;
- empty-state/main-surface composition;
- responsibility hooks for future graph windows without implementing graph data/rendering.

`inspector-panel.ts`:

- right-side inspector shell;
- Full Sensor List responsibility placeholder;
- search/filter/sort responsibility locations;
- show/hide edge-control behavior derived from 0.0.45;
- no real channel list until normalized log/channel contracts exist.

`timeline-shell.ts`:

- timeline overview/transport responsibility shell;
- expanded/compact control state;
- timeline edge-control behavior derived from 0.0.45;
- no fake playback data or timeline calculations.

**Validation:**

- inspector can be shown/hidden without destroying the workspace;
- timeline controls can switch between expanded/compact shell states;
- layout changes remain presentation-only;
- no parser/core/analyzer responsibilities appear in these files.

**Completion criteria:**

The first Logger/Analyzer shell demonstrates the approved interaction geography while remaining data-source agnostic.

---

### WEB-BOOT-004 — Bootstrap quality gate

**Goal:** verify that bootstrap code is clean enough to become the base for LOG-MLG.

**Files changed:** normally none unless defects are found.

**Required checks:**

1. clean `npm install` from the committed lockfile;
2. `tsc --noEmit` passes;
3. production Vite build passes;
4. Brave/Chromium smoke test passes;
5. no console errors during shell interactions;
6. no runtime dependencies beyond browser-native APIs;
7. no source parser/domain-analysis code exists under `apps/web/`;
8. no unapproved top-level directory/file architecture has appeared;
9. generated output and dependencies are not committed;
10. current handoff/roadmap accurately identify the next task.

**Completion criteria:**

WEB-BOOT can be merged and `LOG-MLG` investigation can begin from a clean, controlled application base.

## Test policy for WEB-BOOT

No dedicated test-framework dependency is approved for WEB-BOOT because the batch contains only build configuration and static/presentation shell behavior.

Automated validation for this batch is:

- TypeScript static checking;
- production build validation.

Browser behavior receives a documented Chromium/Brave smoke check.

Before parser/core logic is implemented, the relevant task must select and document an automated test runner/strategy. The choice must not be smuggled into LOG-MLG as an incidental dependency.

## Graph rendering policy

WEB-BOOT does not select a graph library.

The graph workspace is a responsibility boundary only. Graph rendering will be selected when the TIMELINE/graph task has concrete requirements for:

- large sample counts;
- viewport decimation;
- cursor synchronization;
- overlays/comparison;
- interaction latency;
- memory use.

This avoids choosing a chart dependency based solely on appearance before EpicScope's workload is known.

## State policy

WEB-BOOT may maintain only minimal presentation state required to demonstrate shell interactions such as inspector visibility or timeline expanded/compact state.

It must not establish a persistence schema or general application state architecture by accident.

Domain `Session` and future persisted `WorkspaceState` remain governed by `DATA_MODEL.md` and later roadmap tasks.

## WEB-BOOT exit state

After WEB-BOOT, the repository should have:

- a minimal reproducible Web toolchain;
- an independent EpicScope shell;
- Logger workspace, right inspector, and bottom timeline presentation boundaries;
- no fake parser/analysis functionality;
- no graph-library commitment;
- a clean place to begin MLG/parser-contract investigation.
