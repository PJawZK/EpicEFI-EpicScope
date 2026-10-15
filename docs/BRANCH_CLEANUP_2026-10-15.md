# Branch cleanup and authority consolidation — 2026-10-15

This note records the completed repository cleanup pass performed after restoring the VE Analyzer browser-known-good runtime.

## Runtime baseline preserved during cleanup

- Branch: `main`
- Browser-validated VE runtime baseline before documentation cleanup: `86357400be6971b1f8edfe98d70816fa55b3bec5`
- Merge: PR #449 — **Restore VE Analyzer runtime to browser-known good state**
- Browser verification: Analyzer entry works again after rollback.

The documentation/branch cleanup itself did not intentionally alter VE runtime behavior.

## Cleanup result

The repository had accumulated roughly 195 remote branches.

Cleanup proceeded conservatively:

1. delete branches fully contained by `main`;
2. delete patch-equivalent branches already represented in `main`;
3. audit every remaining branch family against current `main` before deleting it;
4. preserve useful research/behavior/decisions in `main`, documentation or Git/PR history;
5. remove the remaining superseded historical refs.

Final remote state verified from the local clone:

```text
origin/HEAD -> origin/main
origin/main
```

No historical remote development branch remains active.

## What was audited before final deletion

The final review covered:

- VE Analyzer implementation/research/state-ownership branches;
- Fuel Pressure / Injector analysis branches;
- Histogram/Table Generator/Distribution/Scatter/Math Channel branches;
- semantic starter/workspace branches;
- Inspector filter/performance work;
- `ts_shim`/source-transition work;
- documentation/research branches.

The audit found no remaining branch that needed to stay as an authority. Apparent `git cherry` uniqueness was largely caused by later refactoring, squash/rebase differences, temporary transformation/workflow commits or superseded implementations whose useful behavior already existed in evolved form on `main`.

## Current authority rules

- `main` is the production authority.
- `HANDOFF.md` is the present-tense continuation authority.
- `DOCUMENTATION_MAP.md` defines current-vs-historical document authority.
- current subsystem contracts (`VE_ANALYZER.md`, `VE_ANALYZER_WORKBENCH.md`, `HISTOGRAM.md`, `PREPOPULATED_WORKSPACES.md`, `TS_SHIM_STATUS.md`, etc.) define current behavior.
- `research/` preserves historical external-tool evidence; `research/STATUS.md` is the living disposition.
- Git history and merged PRs preserve old implementation provenance.

Historical branches are not required as knowledge stores.

## VE Analyzer cleanup boundary

The current runtime after PR #449 remains the browser-known-good baseline. Do not reintroduce the post-#441 continuity/render wrappers as a batch.

Known remaining VE issues:

- Result View fallback/precision behavior;
- loss of VE Analyzer result state after Logger round-trip;
- destructive lifecycle rebuilds;
- duplicated cell-evidence analysis;
- working-delay ownership partly reconstructed from rendered DOM.

Future VE work should address those one structural change at a time with browser validation after each change.

## Documentation correction completed

The documentation consolidation completed with these current facts made explicit:

- PR #449 / the #441-era composition is the browser-validated VE runtime boundary;
- VE Analyzer is implemented and real-log/browser validated, not planned-only;
- the accepted lambda-delay working model is **RPM × load table only**;
- repository remote branch authority is `main` only;
- current-state docs and historical research/plan docs have distinct authority roles;
- D-056/D-057 record table-only delay authority and browser-validation requirements;
- `DOCUMENTATION_MAP.md` defines how future readers resolve historical-vs-current wording.
