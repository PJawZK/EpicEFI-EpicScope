<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. Use the handoff plus current `main`/CI state for present-tense continuation.
<!-- CURRENT_STATE:handoff-pointer:END -->

> **Historical bootstrap authority.** WEB-BOOT is complete and deployed. This document records the initial toolchain/shell batch and is not the current feature roadmap. Use `docs/HANDOFF.md`, `docs/ROADMAP.md`, and `docs/UI_REFERENCE.md` for current work.

# WEB-BOOT Implementation Plan

## Status

**Complete — historical bootstrap authority.**

## Current clarification

WEB-BOOT deliberately rejected importing the **broader EpicHub application shell** (Dashboard/Tuner/Diagnostics/Android navigation architecture).

That does **not** prohibit EpicScope from having its own in-product mode/surface switcher. The project owner has since approved the **EpicScope logo dropdown in the upper-right** as the EpicScope mode switcher for surfaces such as Logger, Analyzer and Histogram. See D-045 and `docs/UI_REFERENCE.md`.

This is a refinement of current EpicScope presentation, not a change to the historical bootstrap boundary.

## Goal

Create the smallest usable EpicScope Web shell while keeping the project browser-accessible for the project owner.

The normal project-owner workflow must not require a local clone, Node.js, npm, or a development environment. GitHub performs validation and GitHub Pages provides the browser test surface.

## Approved Web delivery model

```text
short-lived branch / pull request
        ↓
GitHub Actions Web CI
        ├── npm ci
        ├── TypeScript check
        ├── tests
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

GitHub Pages is distribution/test surface, not an EpicScope backend. Selecting a local log/tune file must remain client-side unless the user explicitly invokes a future approved sharing/upload capability.

## Approved toolchain

- npm with committed `package-lock.json`;
- Vite 8.x;
- vanilla TypeScript 7.x;
- browser-native HTML/CSS/DOM APIs;
- GitHub Actions CI/build/deploy;
- GitHub Pages;
- Chromium/Brave primary browser target.

No frontend framework, graph/chart library, state-management framework, CSS framework, or general UI component library was approved by WEB-BOOT alone.

Node.js is build/development tooling, not an end-user requirement or Linux runtime baseline.

## Initial approved repository files

Repository root:

```text
.gitignore
package.json
package-lock.json
tsconfig.json
vite.config.ts
```

Initial Web application:

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

Later approved files are governed by `FILE_ARCHITECTURE.md`; this historical list is not intended to match the full current tree.

GitHub automation:

```text
.github/workflows/
├── web-ci.yml
└── pages.yml
```

## Vite / Pages path

Production base path:

```text
/EpicEFI-EpicScope/
```

## Historical task split

### WEB-BOOT-001 — Toolchain scaffold

Established npm, Vite, TypeScript, committed lockfile, Pages base path and GitHub Actions validation.

### WEB-BOOT-002 — EpicScope application shell

Established the dedicated EpicScope product shell without importing the broader EpicHub app shell.

Historical responsibilities:

- EpicScope identity/header;
- loaded-log identity presentation;
- primary Logger/Analyzer surface host;
- right-side inspector host;
- bottom timeline host;
- wide-layout technical styling.

Historical prohibitions remain:

- fake MLG decoding;
- parser/domain calculations in shell code;
- prototype global-state architecture;
- unapproved live ECU/recording implementation;
- EpicHub Dashboard/Tuner/Diagnostics navigation.

Current refinement: the EpicScope identity/logo dropdown may switch **EpicScope analysis modes**. That is not the prohibited broader EpicHub application navigation.

### WEB-BOOT-003 — Logger workspace skeleton

Established presentation boundaries for graph workspace, right-side inspector, sensor-panel visibility and bottom timeline/transport behavior without fake source data.

### WEB-BOOT-004 — GitHub-hosted quality gate

Established CI/build and post-merge hosted validation expectations.

## CI and Pages ownership

### `.github/workflows/web-ci.yml`

Branch/PR validation. Current workflow includes type-check, tests and production build as defined by active project workflow.

### `.github/workflows/pages.yml`

Builds/deploys authoritative `main` to GitHub Pages. Hosting does not authorize transmitting user log/tune contents.

## Graph rendering policy

WEB-BOOT did not select a graph library. Later graph/timeline behavior evolved through measured requirements while retaining the lightweight Web direction.

## Test policy

WEB-BOOT originally deferred a dedicated automated test framework. That deferral was later resolved by Vitest; current testing authority is D-040 and `WORKFLOW.md`.

## Exit state

WEB-BOOT is complete. Present implementation order and exact next work are governed by `HANDOFF.md` and `ROADMAP.md`, not this historical plan.
