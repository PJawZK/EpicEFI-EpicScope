# EpicScope Handoff

## Repository

`PJawZK/EpicEFI-EpicScope`

## Authoritative branch

`main`

## Current project phase

**Phase 1 — Web log foundation**

Current task entry point: **WEB-REFERENCE**.

## Current objective

Inspect and identify the exact EpicHub Logger/Analyzer UI reference that EpicScope should use as its starting interaction model, capture the relevant rules in repository authority, then define the first concrete Web implementation task batch.

## Latest completed work

Phase 0 foundation is complete.

The repository was initialized, populated with authority documents, audited for contradictions and ownership gaps, corrected, and then given a final post-audit consistency pass.

The final consistency pass corrected two remaining boundary issues:

- `WEB-REFERENCE` is now wholly a Phase 1 task rather than also being a Phase 0 exit criterion;
- domain `Session` state is explicitly separated from UI/application `WorkspaceState`, while both may be represented in a versioned persisted session artifact.

Current foundation documents:

- `README.md`
- `LICENSE`
- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/FILE_ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/PERFORMANCE.md`
- `docs/PLATFORMS.md`
- `docs/ROADMAP.md`
- `docs/WORKFLOW.md`
- `docs/DECISIONS.md`
- `docs/HANDOFF.md`

## Current approved decisions

The authoritative decision log is `docs/DECISIONS.md`.

Key current decisions include:

- Product name: **EpicEFI – EpicScope** / **EpicScope**.
- Purpose: “scope a tune” to inspect ECU/log behaviour for faults and improvements.
- Development order: **Web → Linux → Android / EpicHub**.
- Web is the functional reference; Linux is the primary production/performance target.
- Web direction: lightweight TypeScript.
- Primary browser target: Chromium, with Brave as a first-class practical test browser.
- Initial source formats: MLG first, CSV second.
- Linux baseline: Debian 13 Stable.
- Mature Linux performance goal: supported 1 GiB log on a 2 GiB RAM system without loading the entire file into memory.
- Performance and low RAM outrank visual polish.
- Log and tune/config source formats normalize into appropriate common internal models before analysis/presentation.
- File architecture is controlled; silent structural deviation is prohibited.
- Architecture changes require project-owner approval plus explicit decision logging before implementation.
- `main` is authoritative; normal implementation should use short-lived branches and PR review.
- Apache License 2.0.
- Local analysis remains local unless sharing/upload is explicitly chosen.
- Local-first privacy also prohibits silent transmission of log/tune/analysis content through telemetry/analytics.
- All imported files/artifacts are treated as untrusted input.
- Major features use Experimental / Beta / Stable maturity states.
- Persisted/public schema compatibility must be versioned/migrated rather than silently broken.
- EpicHub Logger/Analyzer interaction concepts are the starting UI authority, not the entire EpicHub application.
- The exact current EpicHub Logger/Analyzer reference must be inspected before implementing the EpicScope Web shell.
- Raw MLG/CSV/INI/MSQ decoding belongs to `core/parsers/`; normalized tune semantics belong to `core/tune/`.
- `core/session/` and `core/persistence/` are approved ownership areas for future session composition and persistence/migration logic.
- Domain Session semantics and UI WorkspaceState are separate even when persisted together.
- The Boost Analyzer is capability-driven and must support more than the current upper/lower chamber arrangement where data permits.
- The currently documented file tree is authoritative for approved areas but deliberately does not invent future Linux/Android/backend trees; those require explicit extension decisions.

## Architecture authority

Read these before significant implementation:

1. `docs/PRODUCT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/FILE_ARCHITECTURE.md`
4. `docs/DATA_MODEL.md`
5. `docs/PERFORMANCE.md`
6. `docs/PLATFORMS.md`
7. `docs/ROADMAP.md`
8. `docs/WORKFLOW.md`
9. `docs/DECISIONS.md`

## Current implementation state

No application code has been added yet.

This remains intentional. Phase 1 begins with reference inspection and task definition before implementation files are introduced.

## Foundation audit / consistency result

No fundamental architectural contradiction remains in the current foundation documents.

The foundation now explicitly covers:

- naming conventions;
- project-owner approval authority;
- MLG/CSV/INI/MSQ parser ownership versus normalized tune ownership;
- session and persistence ownership;
- neutral log-model contracts;
- controlled future tree extension;
- local-first network privacy;
- untrusted-input/resource-allocation rules;
- capability-driven Boost Analyzer scope;
- handoff SHA semantics;
- domain Session versus UI WorkspaceState separation;
- clean Phase 0 → Phase 1 boundary.

Phase 0 is therefore marked **Complete** in `docs/ROADMAP.md`.

## Current roadmap position

Phase 1 is ready to begin.

The first task group is **WEB-REFERENCE**:

1. inspect/identify the exact current EpicHub Logger/Analyzer layout/design reference;
2. capture only the relevant Logger/Analyzer interaction rules for EpicScope;
3. confirm right-side details/settings and timeline behavior against the reference;
4. document deliberate EpicScope deviations before `WEB-BOOT` implements the shell.

## Next recommended actions

1. Complete `WEB-REFERENCE` using the exact EpicHub source/reference rather than memory.
2. Record any EpicScope-specific UI decisions that result from that inspection.
3. Define the first concrete Phase 1 task split and exact approved file locations.
4. Decide the minimal Web build/tooling stack under the lightweight-TypeScript/dependency rules.
5. Create the first short-lived implementation branch.
6. Bootstrap only the files/directories required by those approved tasks.

Do not create all documented future directories as empty placeholders.

## Known unresolved items

- Exact EpicHub Logger/Analyzer layout source/reference has not yet been imported or inspected for EpicScope implementation.
- Exact Web bundler/build tooling has not yet been selected.
- Exact graph rendering library/approach has not yet been selected.
- MLG parser implementation/spec details have not yet been investigated in this repository.
- Branch protection/ruleset enforcement has not yet been configured; workflow policy is currently documented authority.
- Final Linux UI toolkit/runtime architecture is intentionally deferred until Web functionality matures.
- Future share/backend architecture has not been approved and must not be introduced incidentally.

## Repository state validated before this handoff update

`a4363100cf4cc7d5ba58258174d78f28b81694cf`

This is the repository state after the final consistency corrections and before this handoff-file update.

Because a file cannot reliably contain the SHA of the commit that writes itself, this SHA is not presented as the final repository head. A resumed chat must inspect current `main` first.

## Continuation instruction

In a new chat, the user should be able to say:

> Read the EpicScope repository handoff and continue from there.

The new chat must read this file first, then inspect current `main` and the referenced authoritative repository files before making changes. Do not reconstruct current architecture from old chat history when newer repository authority exists.
