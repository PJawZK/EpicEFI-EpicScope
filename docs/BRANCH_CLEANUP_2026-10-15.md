# Branch cleanup and authority consolidation — 2026-10-15

This note records the repository cleanup pass performed after restoring the VE Analyzer browser-known-good runtime.

## Authoritative production baseline

- Branch: `main`
- Baseline before this documentation-only cleanup: `86357400be6971b1f8edfe98d70816fa55b3bec5`
- Merge: PR #449 — **Restore VE Analyzer runtime to browser-known good state**
- Browser verification: the project owner confirmed that Analyzer entry works again after the rollback.

The VE runtime restored by PR #449 remains intentionally unchanged by this cleanup.

## Branch disposition

The repository had accumulated roughly 195 remote branches. Cleanup proceeded conservatively:

1. branches already fully contained by `main` were deleted;
2. branches with patch-equivalent content already represented in `main` were deleted;
3. remaining branch families were audited against current `main` before recommending deletion.

The surviving historical families were reviewed across VE Analyzer, Fuel / Injector, Histogram/Scatter/Distribution/Math/Table Generator, Logger starter workspaces, Inspector filtering, Shim/source-transition work, and research/docs.

The audit found no remaining historical branch that needs to remain authoritative as a branch. Meaningful product behavior, tests, research, and decisions from those branches are represented in current `main`, usually in a later/evolved form. Apparent `git cherry` uniqueness was largely caused by refactoring, squash/rebase differences, or temporary transform/workflow commits.

## Current authority rules

- `main` is the production authority.
- `docs/HANDOFF.md` is the present-tense continuation authority.
- `docs/VE_ANALYZER.md` is the VE Analyzer behavioral/product contract.
- `docs/research/` preserves historical external-tool research and implementation audits.
- `docs/PREPOPULATED_WORKSPACES.md` and `docs/STARTER_SYSTEM_VALIDATION.md` are the current Logger starter/workspace authorities.
- `docs/HISTOGRAM.md` is the current Histogram maturity authority.

Historical branches are not required as knowledge stores once their useful conclusions are preserved in those authorities and Git/PR history.

## VE Analyzer cleanup boundary

The current runtime after PR #449 is the browser-known-good baseline. Do not reintroduce the post-#441 continuity/render wrappers as a batch. Future VE work must be staged one structural change at a time with browser verification after each change.

Known remaining VE issues include Result View fallback/precision behavior and loss of Analyzer results after Logger round-trip. These are not grounds to reintroduce the reverted wrapper stack.

## Documentation correction

This cleanup also corrects two stale continuation statements:

- the authoritative baseline is no longer PR #429; PR #449 / `86357400…` is the browser-validated rollback baseline immediately preceding this docs-only consolidation;
- VE Analyzer is no longer planned-only: it is implemented and real-log/browser validated, with current maturity work focused on result-state ownership, review continuity, and further proposal/review refinement.
