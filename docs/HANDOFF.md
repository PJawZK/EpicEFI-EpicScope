# EpicScope Handoff

## Repository

`PJawZK/EpicEFI-EpicScope`

## Authoritative branch

`main`

## Current project phase

**Phase 0 — Foundation**

## Current objective

Complete the repository foundation before application code is introduced, then begin Phase 1 Web implementation from the approved architecture and roadmap.

## Latest completed work

The repository has been initialized and populated with the first authoritative project documents:

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
- Source formats normalize into a common internal data model.
- File architecture is controlled; silent structural deviation is prohibited.
- Architecture changes require explicit review and decision logging.
- `main` is authoritative; normal implementation should use short-lived branches and PR review.
- Apache License 2.0.
- Local analysis remains local unless sharing/upload is explicitly chosen.
- Major features use Experimental / Beta / Stable maturity states.
- Persisted/public schema compatibility must be versioned/migrated rather than silently broken.
- EpicHub Logger/Analyzer interaction concepts are the starting UI authority, not the entire EpicHub application.

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

This is intentional. The project is still at the controlled foundation/specification stage.

## Current roadmap position

`docs/ROADMAP.md` Phase 0 is substantially established.

The next implementation phase is **Phase 1 — Web log foundation**, beginning with approved bootstrap and MLG data-path tasks.

## Next recommended actions

Before writing feature code:

1. Review the foundation documents together for contradictions or missing rules.
2. Define the first concrete Phase 1 task split and exact approved file locations.
3. Decide the minimal Web build/tooling stack while respecting the lightweight-TypeScript and dependency policies.
4. Create the first short-lived implementation branch rather than developing normal feature work directly on `main`.
5. Bootstrap only the files/directories needed for those approved first tasks.

A likely first task group is:

- Web project bootstrap/application shell.
- MLG format investigation/parser contract.
- Normalized log/channel/time contracts.
- Small curated MLG test fixture strategy.

Do not create all documented future directories as empty placeholders.

## Known unresolved items

- Exact Web bundler/build tooling has not yet been selected.
- Exact graph rendering library/approach has not yet been selected.
- MLG parser implementation/spec details have not yet been investigated in this repository.
- Exact EpicHub Logger/Analyzer layout source/reference has not yet been imported or inspected for EpicScope implementation.
- Branch protection/ruleset enforcement has not yet been configured; workflow policy is currently documented authority.
- Final Linux UI toolkit/runtime architecture is intentionally deferred until Web functionality matures.

## Latest validated foundation commit before this handoff update

`14b5848f4aa71c7286c27130c552f5e0ee4514f5`

This commit contains the initial decision log and all preceding foundation documents. The commit that adds/updates this handoff will naturally be newer.

## Continuation instruction

In a new chat, the user should be able to say:

> Read the EpicScope repository handoff and continue from there.

The new chat must read this file first, then inspect the referenced authoritative repository files/current branch state before making changes. Do not reconstruct current architecture from old chat history when newer repository authority exists.
