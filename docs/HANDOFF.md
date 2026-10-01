# EpicScope Handoff

## Repository

`PJawZK/EpicEFI-EpicScope`

## Authoritative branch

`main`

## Current project phase

**Phase 0 — Foundation**

## Current objective

Complete the final foundation checks before application code is introduced, then define the first Phase 1 Web task batch from the approved architecture and roadmap.

## Latest completed work

The repository was initialized with the foundation documents and then audited for contradictions, ambiguous ownership, missing authority boundaries, and roadmap/file-architecture mismatches.

The audit fixes have been applied to the authoritative documents.

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
- Source formats normalize into a common internal data model.
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

This remains intentional. The repository is still at the controlled foundation/specification stage.

## Foundation audit result

The initial audit found no fundamental architectural contradiction.

The following issues were corrected:

- naming conventions were made explicit;
- project-owner approval authority was made explicit;
- MLG/CSV/INI/MSQ parser ownership was separated from normalized tune ownership;
- session and persistence ownership were added to the approved architecture;
- `log-model` was clarified as a neutral contract boundary rather than a simplistic bottom-only dependency;
- the file tree wording was corrected so future Linux/Android/backend architecture must be deliberately approved instead of either pre-guessed or silently improvised;
- the exact EpicHub UI-reference inspection became a Phase 1 gate;
- local-first privacy was expanded to network/telemetry behavior;
- untrusted-input/resource-allocation rules were added;
- Boost Analyzer scope was generalized beyond a single wastegate plumbing arrangement;
- handoff SHA semantics were clarified so resumed chats always inspect current `main` rather than assuming the embedded validation SHA is the repository head.

## Current roadmap position

`docs/ROADMAP.md` Phase 0 is now close to completion.

The next implementation phase is **Phase 1 — Web log foundation**.

Before `WEB-BOOT`, Phase 1 now begins with `WEB-REFERENCE`: inspect/identify the exact EpicHub Logger/Analyzer reference and capture only the relevant interaction rules for EpicScope.

## Next recommended actions

Before writing feature code:

1. perform one final post-audit consistency check of the updated foundation documents;
2. inspect/identify the exact EpicHub Logger/Analyzer UI reference (`WEB-REFERENCE`);
3. define the first concrete Phase 1 task split and exact approved file locations;
4. decide the minimal Web build/tooling stack under the lightweight-TypeScript/dependency rules;
5. create the first short-lived implementation branch;
6. bootstrap only the files/directories required by those approved tasks.

Do not create all documented future directories as empty placeholders.

## Known unresolved items

- Exact Web bundler/build tooling has not yet been selected.
- Exact graph rendering library/approach has not yet been selected.
- MLG parser implementation/spec details have not yet been investigated in this repository.
- Exact EpicHub Logger/Analyzer layout source/reference has not yet been imported or inspected for EpicScope implementation.
- Branch protection/ruleset enforcement has not yet been configured; workflow policy is currently documented authority.
- Final Linux UI toolkit/runtime architecture is intentionally deferred until Web functionality matures.
- Future share/backend architecture has not been approved and must not be introduced incidentally.

## Repository state validated before this handoff update

`81b7ed9f0ce8ca49f1cbfabf99f82176e956c9de`

This is the repository state after the foundation-audit decision updates and before this handoff-file update.

Because a file cannot reliably contain the SHA of the commit that writes itself, this SHA is not presented as the final repository head. A resumed chat must inspect current `main` first.

## Continuation instruction

In a new chat, the user should be able to say:

> Read the EpicScope repository handoff and continue from there.

The new chat must read this file first, then inspect current `main` and the referenced authoritative repository files before making changes. Do not reconstruct current architecture from old chat history when newer repository authority exists.
