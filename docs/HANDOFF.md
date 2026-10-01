# EpicScope Handoff

## Repository

`PJawZK/EpicEFI-EpicScope`

## Authoritative branch

`main`

## Active development branch / PR

- branch: `phase1/log-mlg-plan`
- PR: not opened yet
- current task: `LOG-MLG-001` planning / format-support contract

## Current phase

**Phase 1 — Web log foundation**

- Phase 0 — complete
- WEB-REFERENCE — complete and merged
- WEB-BOOT — complete and hosted
- LOG-MLG — planning/investigation in progress

## Authoritative UI reference

`EpicHub-Tablet-Landscape-0.0.45(2).html`

`docs/UI_REFERENCE.md` contains the EpicScope interpretation of that reference.

## WEB-BOOT validated result

WEB-BOOT is complete.

Implemented and validated:

- npm + committed lockfile;
- Vite 8.x + TypeScript 7.x;
- dedicated EpicScope Logger/Analyzer shell;
- right-side Full Sensor List / inspector shell;
- sensor-panel hide/show edge control;
- bottom timeline/transport shell;
- timeline compact/expanded edge control;
- GitHub Actions branch/PR validation;
- GitHub Actions `main` → GitHub Pages deployment;
- Vite base path `/EpicEFI-EpicScope/`;
- zero-install project-owner testing through the hosted Pages build.

Hosted Web application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

The project owner validated the hosted build in Brave.

Initial hosted validation exposed two presentation bugs:

1. hiding the right sensor panel caused it to auto-place underneath the graph because the panel's `display:grid` rule overrode the HTML `hidden` behavior;
2. the old narrow-width CSS deliberately removed header/workspace objects at the 1100 px breakpoint.

Both were fixed and deployed in main commit:

`2729f41ae78f7e2734b1fa8ca26a219bbb7a5ac0`

The project owner then confirmed the corrected behavior works.

WEB-BOOT therefore no longer has a pending hosted-browser gate.

## Web workflow authority

D-035 defines the Web stage as zero-install for the project owner.

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

The project owner is not expected to maintain a local clone or install Node/npm merely to test EpicScope.

GitHub Pages is application hosting only. Local log/tune files remain client-side unless a future explicit sharing/upload feature is approved and invoked.

## LOG-MLG planning state

Detailed planning authority is being established in:

`docs/LOG_MLG_PLAN.md`

Current format findings:

- authoritative EFI Analytics MLVLG v1 and v2 specifications are available;
- v1 uses 55-byte logger-field descriptors;
- v2 uses 89-byte logger-field descriptors and adds category/group metadata;
- v1/v2 are big-endian;
- standard data records and marker records are defined;
- the per-record timestamp is 16-bit and requires rollover handling for a monotonic normalized timeline;
- values use the specified scale/transform conversion;
- imported MLG is untrusted input and every file-provided offset/count/length must be bounds-checked;
- TunerStudio later introduced MLVLG version 3 support with F64 and little-endian variants, but exact v3 decoding is deliberately deferred until authoritative format details or validated real-file evidence are available.

The parser public contract must support bounded/random-access byte reads rather than requiring a full-file `ArrayBuffer`, so browser `File`/`Blob` slicing and later native random access can share the same semantics.

Initial guaranteed implementation target is MLVLG v1 + v2 with explicit unsupported-version behavior for unverified versions.

## Pending project-owner decision

Recommended parser/core test runner:

**Vitest 5.x**

Reasons recorded in `docs/LOG_MLG_PLAN.md`:

- direct TypeScript/Vite integration;
- CI/development dependency only;
- no browser runtime cost;
- EpicScope GitHub Actions already runs Node 22.12.0, which satisfies the current Vitest requirement;
- suitable for parser fixtures, malformed-input tests, and regression tests.

Under D-015/D-025 this dependency must not be added to `package.json` until the project owner explicitly approves it.

## Next implementation sequence after plan approval

1. `TEST-CORE-001` — add approved TypeScript core test runner and CI test gate;
2. `LOG-MODEL-001` — minimal normalized log/channel/time contracts;
3. `LOG-SOURCE-001` — bounded random-access byte-source contract;
4. `LOG-MLG-002` — v1/v2 header and field-descriptor parsing;
5. `LOG-MLG-003` — record/marker scan, timestamp rollover, corruption diagnostics;
6. `LOG-MLG-004` — hosted Web local-file integration and channel population;
7. `LOG-MLG-005` — real EpicEFI/TunerStudio log validation and first Web performance baseline.

At least one real EpicEFI/TunerStudio `.mlg` must be validated before LOG-MLG is considered complete. Large real logs do not need to be committed to normal Git history.

## Architecture authority

Read before significant implementation:

1. `docs/PRODUCT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/FILE_ARCHITECTURE.md`
4. `docs/DATA_MODEL.md`
5. `docs/UI_REFERENCE.md`
6. `docs/LOG_MLG_PLAN.md` while LOG-MLG is active
7. `docs/PERFORMANCE.md`
8. `docs/PLATFORMS.md`
9. `docs/ROADMAP.md`
10. `docs/WORKFLOW.md`
11. `docs/DECISIONS.md`

`docs/WEB_BOOT_PLAN.md` remains historical authority for the completed WEB-BOOT batch but is no longer the active task plan.

## Key constraints still in force

- Web → Linux → Android/EpicHub.
- Chromium/Brave first.
- MLG first, CSV second.
- local-first privacy.
- source formats normalize before UI/analyzers.
- controlled file architecture; project-owner approval required for architectural changes.
- no graph library chosen until graph/timeline workload requirements are concrete.
- imported files are untrusted input.
- parser design must not force whole-file memory loading.
- mature Linux target remains a supported 1 GiB log on a 2 GiB RAM system without loading the complete source into memory.

## Known unresolved items

- project-owner approval of the proposed Vitest 5.x parser/core test dependency;
- exact MLG version 3 format support is intentionally deferred until verified;
- a representative real current EpicEFI/TunerStudio `.mlg` is still needed for LOG-MLG real-file validation;
- exact graph rendering approach remains intentionally deferred;
- branch protection/ruleset enforcement is not yet configured;
- Linux runtime/UI architecture is intentionally deferred;
- share/backend architecture is not approved yet;
- narrow/mobile layout is not defined by the current Tablet Landscape authority.

## Repository state validated before this handoff update

Authoritative `main` WEB-BOOT/fix state:

`2729f41ae78f7e2734b1fa8ca26a219bbb7a5ac0`

The `phase1/log-mlg-plan` branch contains newer planning-document commits. Resumed work must inspect current branch/PR/CI state rather than treating the SHA above as branch head.

## Continuation instruction

A new chat should be able to say:

> Read the EpicScope repository handoff and continue from there.

The new chat must read this file first and use current repository authority rather than reconstructing state from older chat history.
