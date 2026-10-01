# EpicScope Handoff

## Repository

`PJawZK/EpicEFI-EpicScope`

## Authoritative branch

`main`

## Active development branch / PR

- branch: `phase1/web-boot`
- PR: `#3 — Phase 1: implement WEB-BOOT shell`

## Current phase

**Phase 1 — Web log foundation**

- Phase 0 — complete
- WEB-REFERENCE — complete and merged
- WEB-BOOT planning — complete and merged
- WEB-BOOT implementation — in progress
- next after WEB-BOOT — LOG-MLG planning/investigation

## Authoritative UI reference

`EpicHub-Tablet-Landscape-0.0.45(2).html`

`docs/UI_REFERENCE.md` contains the EpicScope interpretation of that reference.

## Important Web workflow correction

The Web stage is intentionally zero-install for the project owner.

The normal project-owner workflow must **not** require a local clone, Node.js, npm, or a development environment.

Authoritative Web flow:

```text
branch / PR
  ↓
GitHub Actions Web CI
  ↓
merge to main
  ↓
GitHub Actions Pages deployment
  ↓
GitHub Pages
  ↓
Brave / Chromium validation
```

Local development remains optional for contributors.

D-035 records this decision. `docs/WEB_BOOT_PLAN.md` is updated accordingly.

GitHub Pages is only the application host. Local logs/tunes remain client-side unless a future explicit sharing/upload feature is approved and invoked.

## WEB-BOOT implementation state

Implemented:

- npm + committed `package-lock.json`;
- Vite 8.x + TypeScript 7.x;
- Vite production base path `/EpicEFI-EpicScope/`;
- `.github/workflows/web-ci.yml` for automated branch/PR validation;
- `.github/workflows/pages.yml` for `main` → GitHub Pages deployment;
- dedicated EpicScope shell;
- Logger/Analyzer workspace host;
- right-side Full Sensor List / inspector shell;
- sensor-panel edge show/hide behavior;
- bottom timeline/transport shell;
- expanded/compact timeline edge behavior;
- dark technical styling based on the approved reference;
- no frontend framework, graph library, parser, analyzer, tune, or fake session architecture.

Temporary workflows used to generate the lockfile and patch authority documents were removed before merge candidate review.

## CI status / latest issue

GitHub Actions successfully installs dependencies from the committed lockfile.

The first full TypeScript 7 CI run exposed missing Vite client type declarations for CSS side-effect imports. This was corrected by adding `vite/client` to `tsconfig.json`.

A new Web CI run is validating that correction. Do not mark WEB-BOOT complete until CI type-check and production build both pass.

## Remaining WEB-BOOT gate

Before merge:

1. GitHub Actions `npm ci` passes;
2. GitHub Actions TypeScript check passes;
3. GitHub Actions Vite production build passes;
4. PR is merge-ready.

After merge:

1. GitHub Pages workflow succeeds from `main`;
2. if required, repository Pages source is set once to **Settings → Pages → Source: GitHub Actions**;
3. hosted EpicScope opens in Brave/Chromium;
4. sensor panel toggle works;
5. timeline compact/expanded behavior works;
6. normal desktop/tablet-landscape resizing is usable;
7. browser console has no application errors during these interactions.

The project owner should not need any local installation for these checks.

## Architecture authority

Read before significant implementation:

1. `docs/PRODUCT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/FILE_ARCHITECTURE.md`
4. `docs/DATA_MODEL.md`
5. `docs/UI_REFERENCE.md`
6. `docs/WEB_BOOT_PLAN.md` while WEB-BOOT is active
7. `docs/PERFORMANCE.md`
8. `docs/PLATFORMS.md`
9. `docs/ROADMAP.md`
10. `docs/WORKFLOW.md`
11. `docs/DECISIONS.md`

## Key constraints still in force

- Web → Linux → Android/EpicHub.
- Chromium/Brave first.
- MLG first, CSV second.
- local-first privacy.
- source formats normalize before UI/analyzers.
- controlled file architecture; project-owner approval required for architectural changes.
- no graph library chosen until graph/timeline workload requirements are concrete.
- parser/core automated test strategy must be selected during LOG-MLG planning.
- mature Linux target remains a supported 1 GiB log on a 2 GiB RAM system without loading the complete source into memory.

## Known unresolved items

- exact graph rendering approach is intentionally deferred;
- MLG format/parser work has not yet started in EpicScope;
- parser/core test runner is intentionally deferred to LOG-MLG planning;
- branch protection/ruleset enforcement is not yet configured;
- Linux runtime/UI architecture is intentionally deferred;
- share/backend architecture is not approved yet;
- narrow/mobile layout is not defined by the current Tablet Landscape authority.

## Repository state validated before this handoff update

`f15e0109a341af85a803675ca39d56647cee3d68`

This is the active WEB-BOOT branch after the TypeScript/Vite client-type correction and before this handoff update.

A handoff file cannot reliably contain the SHA of the commit that writes itself. A resumed chat must inspect current `main`, this branch, PR #3, and current CI/Pages status before making changes.

## Continuation instruction

A new chat should be able to say:

> Read the EpicScope repository handoff and continue from there.

The new chat must read this file first and use current repository authority rather than reconstructing state from older chat history.
