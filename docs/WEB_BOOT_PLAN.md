# WEB-BOOT Implementation Plan

## Status

**Implementation in progress.**

This document defines the first Web implementation batch for EpicScope. `docs/UI_REFERENCE.md` remains the UI/interaction authority.

## Goal

Create the smallest usable EpicScope Web shell while keeping the project genuinely browser-accessible for the project owner.

The normal project-owner workflow must not require a local clone, Node.js, npm, or a development environment. GitHub performs build validation and GitHub Pages provides the browser test surface.

Local development remains supported for contributors, but it is optional.

## Approved Web delivery model

```text
short-lived branch / pull request
        ↓
GitHub Actions Web CI
        ├── npm ci
        ├── TypeScript check
        └── Vite production build
        ↓
merge to main
        ↓
GitHub Actions Pages workflow
        ↓
GitHub Pages
        ↓
Brave / Chromium browser validation
```

GitHub Pages is the distribution and functional test surface for the Web stage. It is **not** an EpicScope backend.

Opening a local log from the Pages-hosted application must remain client-side unless the user explicitly invokes a future approved sharing/upload feature.

## Approved toolchain

- npm with committed `package-lock.json`;
- Vite 8.x;
- vanilla TypeScript 7.x;
- browser-native HTML/CSS/DOM APIs;
- GitHub Actions for CI/build/deployment;
- GitHub Pages for the normal hosted Web build;
- Chromium/Brave as the primary browser target.

No frontend framework, graph/chart library, state-management framework, CSS framework, or general UI component library is approved by WEB-BOOT.

The Node.js requirement belongs to CI/local development tooling only. It is not a user requirement and does not redefine the eventual Linux runtime baseline.

## Approved repository files

Repository root:

```text
.gitignore
package.json
package-lock.json
tsconfig.json
vite.config.ts
```

Web application:

```text
apps/web/
├── index.html
└── src/
    ├── main.ts
    ├── app/app-shell.ts
    ├── pages/logger-page.ts
    ├── panels/inspector-panel.ts
    ├── components/timeline-shell.ts
    └── styles/
        ├── tokens.css
        └── app.css
```

GitHub automation:

```text
.github/workflows/
├── web-ci.yml
└── pages.yml
```

Temporary bootstrap workflows may be used only to establish required generated repository artifacts and must be removed before merge.

## Vite / Pages path

The repository Pages URL is expected under the project path, so Vite uses:

```text
/EpicEFI-EpicScope/
```

as its production base path. This is build/deployment configuration only.

## Task split

### WEB-BOOT-001 — Toolchain scaffold

Establish npm, Vite, TypeScript, the committed lockfile, Vite Pages base path, and GitHub Actions validation.

Validation:

- `package-lock.json` exists and matches the approved dependency set;
- GitHub Actions can execute `npm ci`;
- `npm run typecheck` passes in CI;
- `npm run build` passes in CI.

The project owner is not required to perform these commands locally.

### WEB-BOOT-002 — EpicScope application shell

Implement the dedicated EpicScope shell without importing the broader EpicHub module shell.

Responsibilities:

- EpicScope identity/header;
- loaded-log identity presentation;
- primary Logger/Analyzer surface host;
- right-side inspector host;
- bottom timeline host;
- wide-layout technical styling based on the approved reference.

Not allowed:

- fake MLG decoding;
- parser/domain calculations;
- prototype global-state architecture;
- live ECU/recording implementation;
- Dashboard/Tuner/Diagnostics navigation.

### WEB-BOOT-003 — Logger workspace skeleton

Establish data-source-agnostic presentation boundaries for:

- graph workspace host;
- workspace/tab presentation;
- right-side Full Sensor List/inspector responsibility;
- sensor panel show/hide edge control;
- bottom timeline/transport responsibility;
- expanded/compact timeline edge control.

No fake playback or graph data is introduced.

### WEB-BOOT-004 — GitHub-hosted quality gate

Required automated checks before merge:

1. GitHub Actions `npm ci` succeeds from the committed lockfile;
2. TypeScript validation succeeds;
3. Vite production build succeeds;
4. no unapproved runtime dependencies are introduced;
5. no parser/domain-analysis implementation appears under `apps/web/`;
6. no uncontrolled file architecture appears.

Required post-merge hosted check:

1. GitHub Pages deployment succeeds from `main`;
2. the Pages build opens in Brave/Chromium;
3. shell layout renders correctly;
4. sensor panel show/hide works;
5. timeline expanded/compact behavior works;
6. resizing at normal desktop/tablet-landscape widths is usable;
7. browser console shows no application errors during these interactions.

If GitHub Pages repository settings require enabling **Settings → Pages → Source: GitHub Actions**, that is a one-time repository configuration step, not a local development requirement.

## CI and Pages ownership

### `.github/workflows/web-ci.yml`

PR/branch validation only. It must not deploy production Pages or mutate source code.

### `.github/workflows/pages.yml`

Builds and deploys only the authoritative `main` Web application to GitHub Pages. Deployment output comes from `dist/web`.

GitHub Pages hosting does not grant permission to upload user-selected log/tune data. Local-first privacy remains authoritative.

## Graph rendering policy

WEB-BOOT does not select a graph library. That decision waits until graph/timeline requirements include concrete sample-count, decimation, synchronization, overlay, latency, and memory constraints.

## Test policy

WEB-BOOT requires CI type-check/build validation and hosted browser smoke validation. A dedicated automated test framework remains deferred until parser/core logic requires it.

## Exit state

WEB-BOOT is complete when:

- reproducible GitHub Actions CI passes;
- the Web shell is merged to `main`;
- GitHub Pages deploys successfully;
- the hosted shell passes the Brave/Chromium interaction smoke check;
- the project owner can test EpicScope by opening the hosted site without installing project tooling locally;
- the repository is ready to begin `LOG-MLG` planning.
