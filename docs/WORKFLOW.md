# EpicScope Development Workflow

## Purpose

EpicScope uses a controlled repository workflow so implementation follows approved architecture rather than redefining it implicitly.

## Branching model

`main` is the authoritative integration branch.

Normal development uses short-lived branches created for a defined task or tightly related task group.

Examples:

```text
feature/mlg-parser
feature/timeline-navigation
feature/boost-analyzer-foundation
fix/mlg-corrupt-header
perf/viewport-query
```

Long-running parallel architecture branches are discouraged unless explicitly approved.

## Pull requests

Changes intended for `main` should normally be reviewed through a pull request.

A PR should state:

- task/goal;
- affected architectural areas;
- files added/changed;
- tests/validation performed;
- performance impact where relevant;
- architecture/decision references where applicable.

Direct commits to `main` should be limited to controlled repository initialization, urgent maintenance, or other explicitly approved cases.

## Task definition

Before implementation, a task should identify:

1. **Objective** — what behaviour/outcome is required.
2. **Architectural owner** — which approved subsystem owns it.
3. **Expected files/location** — where new/changed code belongs.
4. **Dependencies** — other modules/contracts required.
5. **Validation** — tests, fixtures, manual checks, or benchmarks.
6. **Completion criteria** — what makes the task done.

Large requests should be split into smaller architectural tasks before coding.

## Architecture gate

If a task cannot be implemented cleanly inside the approved architecture:

1. stop implementation at the design level;
2. describe the mismatch;
3. propose an architecture change;
4. obtain approval;
5. record the decision in `DECISIONS.md`;
6. update affected architecture documents;
7. only then implement the change.

"We may need this later" is not authorization to bypass the current plan.

## Dependency policy

New dependencies must be justified against:

- runtime size/overhead;
- RAM/CPU cost;
- browser/Linux compatibility;
- maintenance activity;
- security exposure;
- lock-in;
- whether a small local implementation would be clearer/cheaper.

Major dependencies or dependencies that materially affect architecture/platform support require explicit approval and a decision entry.

## Web coding direction

The Web implementation uses lightweight TypeScript as the approved direction.

Framework adoption is not automatic. If a framework is proposed, it must demonstrate that its benefits justify runtime weight, complexity, and future Linux migration implications.

## Testing

Testing should follow the architecture.

Expected categories include:

- unit tests for parsers and analysis primitives;
- parser fixtures for supported/invalid files;
- analyzer regression cases;
- integration tests across normalized data boundaries;
- performance benchmarks;
- compatibility/schema tests for persisted sessions when introduced.

Large real logs should not be committed casually into normal Git history.

## Validation and feature maturity

New analyzers/features begin as **Experimental** unless a specific reason supports a higher maturity level.

Promotion to **Beta** or **Stable** should be based on validation evidence, not time or subjective confidence alone.

## Versioning

EpicScope uses semantic-style versioning.

- `0.x` — architecture/features may still evolve significantly.
- `1.0` — reserved for a stable production baseline, expected to correspond to a mature Linux product rather than merely the first Web prototype.

Breaking changes to persisted/public schemas require explicit migration/version handling even during `0.x` once real user data depends on them.

## Commit quality

Commits should be focused and have messages that describe the project change rather than generic text such as `updates` or `fix stuff`.

Where practical, architectural/docs changes should be committed before or with the implementation they authorize.

## Handoff system

EpicScope uses one continuously updated handoff file:

```text
docs/HANDOFF.md
```

When the user requests a handoff:

1. inspect the current repository/branch/commit state;
2. update `HANDOFF.md` in place;
3. preserve only the latest valid project state;
4. reference authoritative documents rather than duplicating them;
5. record completed work, current objective, open tasks, unresolved issues, and next action;
6. record the latest validated/authoritative commit;
7. clearly distinguish approved state from pending ideas;
8. provide the user a short continuation prompt.

Do not create a growing sequence of handoff files.

A new chat should be able to continue with a prompt such as:

> Read the EpicScope repository handoff and continue from there.

The new chat should read `docs/HANDOFF.md` first, then inspect the referenced authoritative files/current repository state before making changes.

## Authority hierarchy

When resolving project state:

1. approved architecture/product documents define intended rules;
2. repository/code defines what currently exists;
3. `HANDOFF.md` defines current progress, context, and next work;
4. old chat discussion does not override newer approved repository state.

## Release workflow

Detailed release automation will be designed later. At minimum, a release candidate should require:

- clean build/test state;
- known benchmark status;
- documented compatibility target;
- version/changelog update;
- no unresolved architecture mismatch relevant to the release.
