# Branch cleanup and authority consolidation — 2026-10-15 / 2026-10-16 follow-up

This note records the repository cleanup passes around the VE Analyzer runtime restoration and the later accepted Analyzer points 1–11 integration.

## First cleanup pass — 2026-10-15

The repository had accumulated roughly 195 remote branches. The first cleanup reduced that historical branch population aggressively after auditing merged, patch-equivalent and superseded work.

At that point PR #449 / the #441-era VE composition was the browser-known-good runtime boundary. That runtime snapshot is now historical: it was later superseded by the accepted PR #462 integration.

## Current accepted runtime authority

- Production/continuation branch: `main`
- Accepted integration PR: #462 — **Integrate Analyzer ownership and correctness fixes through point 11**
- PR #462 merge commit: `2fdce3a4fc2a8759a45058c0ebc06dba0ed4739b`
- Exact pre-merge runtime accepted by owner browser testing: `b435702412642f039a8a7f49d33037c309bef9d8`
- Observability architecture/research ported onto the accepted `main` baseline without runtime changes: `aa92d48f2671a1cd2f75f3b4fbcfb66e4dc35f19`

The accepted baseline includes Analyzer points 1–11, VE Result View source-authority/heat-map repair, retained VE session behavior and cooperative analysis responsiveness improvements.

## Second cleanup pass — 2026-10-16

After #462 merged, all remaining open PRs and the visible remote branch set were audited again.

### PR disposition

All formerly open PRs are now closed. Zero open PRs remain.

Superseded by #462 and closed as historical evidence only:

- #452 — `fix/ve-owner-state-retention`
- #457 — `test/codex-point2-browser`
- #458 — `test/codex-point3-browser`
- #459 — `fix/ve-result-view-untouched-values`

PR #460 — `docs/observability-architecture-plan` — contained unique diagnostics/observability architecture rather than disposable stale code. Its authority/research documents were ported onto the current accepted `main` tree in `aa92d48f2671a1cd2f75f3b4fbcfb66e4dc35f19`, after which the stale divergent PR was closed.

### Remote branch classification

Product authority:

- `main`

Infrastructure/deployment ref that should remain:

- `browser-previews` — generated/deployment preview state, not product authority.

Superseded/historical refs safe to remove after a final head check:

- `diagnostic/ve-session-guard-only`
- `docs/observability-architecture-plan`
- `fix/large-segment-spread-overflow`
- `fix/ve-owner-state-retention`
- `fix/ve-result-retention`
- `fix/ve-result-view-untouched-values`
- `fix/ve-session-authority`
- `infra/pr-browser-previews`
- `integrate/points-2-11-20261015`
- `integrate/points-2-11-clean`
- `perf/general-ui-tracing`
- `temp/epicscope-fixes-points-1-2-20261015`
- `test/codex-point2-browser`
- `test/codex-point3-browser`

Audit notes:

- `fix/large-segment-spread-overflow` contains point-1 large-log safety work already represented in accepted `main` history/tests.
- `fix/ve-result-retention` contains the rejected v10/session-wrapper direction and is superseded by current owner-level state retention.
- `fix/ve-session-authority`, `diagnostic/ve-session-guard-only`, the point integration/temp branches and browser-test branches are all historical staging/validation lines now represented by #462.
- `perf/general-ui-tracing` is misleadingly named; its lineage is older VE ownership/result work, not an independent performance feature that needs preservation.
- `infra/pr-browser-previews` is older than the preview workflow already present on `main`. Current `main` has the improved `/preview` workflow, including guarded cancellation, exact preview base-path verification and non-fatal preview-link commenting, so the source branch is redundant.

## Branch deletion tooling limitation

The GitHub connector available during the 2026-10-16 cleanup exposes PR close/update and branch-ref inspection/update, but it does **not** expose remote branch deletion.

Therefore the cleanup closes obsolete PRs and classifies obsolete refs but must not falsely claim the remote refs were physically deleted. The superseded refs above can be deleted safely with ordinary Git/GitHub branch controls after verifying no new commits were added after this audit.

Do not delete `main` or the active `browser-previews` deployment ref.

## Authority rules after cleanup

- `main` is the only product/continuation authority.
- `HANDOFF.md` is the present-tense continuation authority.
- `DOCUMENTATION_MAP.md` defines current-vs-historical documentation authority.
- subsystem contracts define current behavior.
- D-058 / `OBSERVABILITY.md` define the approved upcoming diagnostics architecture.
- historical branches are not knowledge stores; current docs, Git history and PR history preserve provenance.

## Next project sequence

The accepted points 1–11 integration is complete and should not be reopened as a cleanup project.

Next work is:

1. focused UI polish from current `main`;
2. browser sanity/regression verification after interaction-affecting polish;
3. staged implementation of D-058 unified observability/diagnostics;
4. later targeted Analyzer/MLG v3 work only where evidence or demand justifies it;
5. Web functional maturity review before Linux production implementation becomes primary.
