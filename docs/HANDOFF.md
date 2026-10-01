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
- WEB-BOOT implementation — pre-merge CI gate passed
- next after hosted Pages validation — LOG-MLG planning/investigation

## Authoritative UI reference

`EpicHub-Tablet-Landscape-0.0.45(2).html`

`docs/UI_REFERENCE.md` contains the EpicScope interpretation of that reference.

## Web workflow authority

D-035 defines the Web stage as zero-install for the project owner.

The project owner is not expected to maintain a local clone or install Node/npm merely to test EpicScope.

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

GitHub Pages is only the application host. Local logs/tunes remain client-side unless a future explicit sharing/upload feature is approved and invoked.

## WEB-BOOT implementation

Implemented:

- npm + committed `package-lock.json`;
- Vite 8.x + TypeScript 7.x;
- Vite production base path `/EpicEFI-EpicScope/`;
- `.github/workflows/web-ci.yml` for branch/PR validation;
- `.github/workflows/pages.yml` for `main` → GitHub Pages deployment;
- dedicated EpicScope shell;
- Logger/Analyzer workspace host;
- right-side Full Sensor List / inspector shell;
- sensor-panel edge show/hide behavior;
- bottom timeline/transport shell;
- expanded/compact timeline edge behavior;
- dark technical styling based on the approved reference;
- no frontend framework, graph library, parser, analyzer, tune, or fake session architecture.

Temporary repository-establishment workflows were removed before merge candidate review.

## Validation

GitHub Actions Web CI passes on the implementation branch:

- dependency install from committed lockfile — PASS;
- TypeScript 7 type-check — PASS;
- Vite production build — PASS.

A TypeScript 7 issue with CSS side-effect imports was found by CI and corrected by adding Vite client types to `tsconfig.json`.

## Remaining WEB-BOOT gate

The branch is ready to merge.

After merge:

1. GitHub Pages workflow must succeed from `main`;
2. if required, repository Pages source must be set once to **Settings → Pages → Source: GitHub Actions**;
3. hosted EpicScope must open in Brave/Chromium;
4. sensor panel toggle must work;
5. timeline compact/expanded behavior must work;
6. normal desktop/tablet-landscape resizing must remain usable;
7. browser console must show no application errors during these interactions.

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

- hosted Pages validation is pending merge/deployment;
- exact graph rendering approach is intentionally deferred;
- MLG format/parser work has not yet started in EpicScope;
- parser/core test runner is intentionally deferred to LOG-MLG planning;
- branch protection/ruleset enforcement is not yet configured;
- Linux runtime/UI architecture is intentionally deferred;
- share/backend architecture is not approved yet;
- narrow/mobile layout is not defined by the current Tablet Landscape authority.

## Repository state validated before this handoff update

`ed13e564be415537db1626088a8d5707927ba702`

The Web CI run for this state completed successfully. This handoff update itself creates a newer commit; resumed work must inspect current repository/CI state rather than treating the SHA above as final head.

## Continuation instruction

A new chat should be able to say:

> Read the EpicScope repository handoff and continue from there.

The new chat must read this file first and use current repository authority rather than reconstructing state from older chat history.
