# EpicScope Handoff

## Repository

`PJawZK/EpicEFI-EpicScope`

## Authoritative branch

`main`

## Active development branch / PR

- branch: `phase1/log-mlg-foundation`
- PR: implementation PR not opened yet
- current tasks: `TEST-CORE-001`, `LOG-MODEL-001`, `LOG-SOURCE-001`

## Current phase

**Phase 1 — Web log foundation**

- Phase 0 — complete
- WEB-REFERENCE — complete
- WEB-BOOT — complete, hosted, and validated in Brave
- LOG-MLG planning — complete and merged in `99f8f26f3008731fec9d775dee0e07860b71c9a1`
- LOG-MLG implementation foundation — in progress

## Hosted application

`https://pjawzk.github.io/EpicEFI-EpicScope/`

GitHub Actions is the required Web validation path and GitHub Pages is the project-owner test surface. No local clone/Node/npm is required for normal project-owner testing.

## Authoritative UI reference

`EpicHub-Tablet-Landscape-0.0.45(2).html`

`docs/UI_REFERENCE.md` contains the EpicScope interpretation.

## Active LOG-MLG authority

Read `docs/LOG_MLG_PLAN.md` before MLG implementation work.

Initial guaranteed parser scope:

- MLVLG v1 and v2;
- big-endian v1/v2 structures;
- standard logger records and marker records;
- scalar and bit-field descriptors defined by the v1/v2 specifications;
- explicit unsupported-version handling for unverified newer versions;
- bounded/untrusted-input handling;
- no public parser contract that requires full-file materialization.

MLG v3 is intentionally deferred until authoritative format details or validated real-file evidence are available.

## Approved parser/core test runner

The project owner explicitly approved **Vitest 5.x** on 2026-10-01.

Implementation pins the current 5.x release used by this branch and runs parser/core tests through GitHub Web CI. This is a development/CI dependency only and does not become a browser runtime dependency.

## Current implementation state

On `phase1/log-mlg-foundation`:

- Vitest added to the Web development toolchain;
- `npm test` added;
- GitHub Web CI now includes a Test step;
- `tsconfig.json` includes `core/**/*.ts` and `tests/**/*.ts`;
- first normalized contracts added under `core/log-model/`;
- format-neutral `RandomAccessByteSource` added under `core/parsers/`;
- in-memory bounded byte-source implementation and tests added;
- npm lockfile regenerated on GitHub;
- temporary lockfile-bootstrap workflow removed after use.

The next gate is GitHub CI on the current branch. After that, continue with `LOG-MLG-002` header/field-descriptor decoding rather than adding UI parsing logic.

## Required task order

1. `TEST-CORE-001` — parser/core test runner and CI gate
2. `LOG-MODEL-001` — minimal normalized log contracts
3. `LOG-SOURCE-001` — bounded random-access byte source
4. `LOG-MLG-002` — v1/v2 header and field-descriptor parser
5. `LOG-MLG-003` — record/marker scan and monotonic timebase
6. `LOG-MLG-004` — hosted local-file integration and Full Sensor List population
7. `LOG-MLG-005` — real EpicEFI/TunerStudio log validation and first Web performance baseline

## Key constraints still in force

- Web → Linux → Android/EpicHub.
- Chromium/Brave first.
- MLG first, CSV second.
- local-first privacy; opening a local log must not upload it.
- source formats normalize before UI/analyzers.
- imported files are untrusted input.
- parser reads must be bounded and must not silently fabricate missing bytes as zero.
- parser/public data contracts must permit later streaming/indexed/native implementations.
- no graph library selected yet.
- no MLG v3 decoding by guesswork.
- a representative real current EpicEFI/TunerStudio `.mlg` is required before LOG-MLG completion.
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

The new chat must inspect the current repository/branch/CI state rather than reconstructing state from older chat history.
