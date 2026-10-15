<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. `docs/DOCUMENTATION_MAP.md` defines documentation authority.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Development Workflow

## Purpose

EpicScope uses a controlled repository workflow so implementation follows approved architecture rather than redefining it implicitly.

## Project-owner approval authority

Architectural/product-direction approval belongs to the project owner. Contributors/agents may propose changes but must not self-authorize structural deviation merely by editing a decision file or introducing a new layer.

## Repository/branch model

`main` is the only product/continuation authority.

Short-lived focused branches/PRs are still normal for runtime/product changes. After merge/closeout, branch refs should be deleted so the repository does not become a long-lived branch archive. Historical branches are never knowledge stores; Git/PR history and authoritative docs preserve provenance.

`browser-previews` is deployment infrastructure, not product authority.

The 2026-10-16 connector-based cleanup could close PRs and classify refs but did not expose remote branch deletion. `BRANCH_CLEANUP_2026-10-15.md` records refs that may be removed with normal Git/GitHub controls.

Long-running parallel architecture branches are discouraged unless explicitly approved.

## Pull requests and direct main updates

Changes intended for production should normally use a focused PR with:

- objective;
- affected ownership areas;
- files changed;
- tests/validation;
- performance impact where relevant;
- decision/document references.

Direct `main` changes are acceptable for controlled/explicitly approved maintenance such as documentation/repository consolidation where another review branch adds no value. Runtime/product behavior changes should normally retain focused branch/PR review.

## Task definition

Before implementation, identify:

1. objective;
2. architectural owner;
3. expected files/location;
4. dependencies;
5. validation;
6. completion criteria.

Large changes should be split into smaller ownership-safe tasks.

## Architecture gate

If a task does not fit approved ownership:

1. stop at design level;
2. describe the mismatch;
3. propose a change;
4. obtain project-owner approval;
5. record the durable decision;
6. update affected architecture/documentation;
7. then implement.

## Dependency policy

New dependencies must justify runtime/RAM/CPU cost, browser/Linux compatibility, maintenance/security exposure, lock-in and whether a small local implementation is clearer/cheaper.

## Web coding direction

Lightweight TypeScript/browser-native DOM remains the approved Web direction. Framework/library adoption requires explicit benefit and architecture review.

## Naming

Default conventions:

- directories/files: `kebab-case`;
- exported types/classes/interfaces: `PascalCase`;
- functions/variables/properties: `camelCase`;
- true global/module constants: `UPPER_SNAKE_CASE` where useful;
- decisions: `D-NNN`;
- exact external/source channel/table names preserved in metadata/presentation.

Avoid `new`, `final`, `helper2`, `temp`, or ever-growing `vN` naming as a substitute for ownership design. Historical VE `v2`…`v9` layers are known debt, not the preferred pattern for new work.

## Input security/privacy

All imported logs/tunes/metadata/session artifacts are untrusted. Validate sizes/counts/offsets/encodings/expressions before allocation/execution.

Local analysis is local by default. No silent transmission of log/tune contents, filenames, derived values or analysis results.

## Automated validation

Normal Web CI gate:

- TypeScript/typecheck;
- Vitest/regression tests;
- production Vite build.

New parser/persistence/channel-binding/analysis work extends this gate rather than treating build success alone as validation.

## Browser/runtime validation

Automated validation does not prove all browser behavior.

For VE Analyzer lifecycle/render/state/direct-edit changes, browser validation is **required acceptance evidence** (D-057). Historical PRs #442–#447 demonstrated that CI-green changes can still freeze or corrupt a real browser workflow.

Current accepted VE/Analyzer baseline is PR #462 on `main`, with exact pre-merge runtime acceptance at `b435702412642f039a8a7f49d33037c309bef9d8`.

VE rule:

1. make one structural change at a time;
2. run normal CI/tests/build;
3. verify the affected browser workflow;
4. only then describe the change as fixed/validated.

Other UI changes also require representative browser/manual validation when automated tests cannot exercise the behavior being claimed.

For the immediate UI polish pass, purely cosmetic CSS changes may use proportionate browser sanity checks; interaction, focus, re-parenting, lifecycle or table behavior changes require explicit workflow verification.

## Performance workflow

Performance work is evidence-driven:

1. start from authoritative `main`;
2. make one focused change;
3. typecheck/test/build;
4. benchmark with the same representative workload;
5. compare physical reads/bytes/time, decode/render time, retained memory and interaction behavior;
6. repeat on low-spec hardware when the change can affect I/O/allocation/GC/responsiveness.

Broad Logger/Histogram micro-optimization is paused unless a measured regression appears.

The D-058 observability implementation must establish an explicit baseline before inserting hot-path instrumentation and must benchmark enabled/minimal overhead plus deliberate event-storm behavior.

## Feature maturity

New analyzers/features begin Experimental unless evidence supports a higher maturity level. Promotion to Beta/Stable is based on validation evidence, not age.

## Documentation completion rule

A product/architecture change is incomplete if authoritative docs still contradict it.

Update the smallest affected authority set:

- `HANDOFF.md` — continuation/current state;
- `ROADMAP.md` — sequencing/status;
- `PRODUCT.md` — user-visible product contract;
- subsystem authority docs — detailed behavior;
- `research/STATUS.md` — research disposition;
- decision record — durable invariant;
- `DOCUMENTATION_MAP.md` — if authority relationships changed.

Historical research/decision observations should generally remain historical rather than being rewritten to pretend they were always current.

## Handoff system

`docs/HANDOFF.md` is the single continuously updated continuation authority.

When updating it:

1. inspect current `main`;
2. reconcile code/runtime with existing handoff;
3. retain current progress/open issues/next sequence;
4. link subsystem authorities instead of duplicating unnecessary history;
5. distinguish browser-validated behavior from CI-only claims;
6. identify runtime baselines explicitly when needed rather than assuming the handoff commit itself is a tested runtime SHA.

A new chat should be able to continue with:

> Read `docs/HANDOFF.md`, verify current `main`, then continue from the documented boundary.

## Authority hierarchy

For present-tense work:

1. current `main` implementation/runtime evidence describes what actually exists;
2. `HANDOFF.md` describes current continuation boundary;
3. current product/subsystem/architecture documents describe intended rules;
4. explicit later accepted decisions refine older decisions;
5. historical research/plans/chats do not override newer repository authority.

When there is a mismatch, reconcile documents/code rather than choosing whichever old text is convenient.

## Release workflow

Detailed release automation remains future work. A release candidate should at least require clean validation, known benchmark/compatibility status, version/changelog update and no unresolved architecture mismatch relevant to the release.
