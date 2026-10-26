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

## Preservation audit — exhaustive remaining-ref pass

A second, stricter pass was performed before authorizing branch deletion. Git commit uniqueness was **not** treated as proof of useful uniqueness. Each remaining non-deployment branch was checked against current `main` and classified using these categories:

1. **Identical on `main`** — same content/blob or branch is already an ancestor.
2. **Superseded by newer implementation on `main`** — same purpose is implemented by the accepted, stronger/current owner model.
3. **Rejected/experimental historical implementation** — useful provenance but intentionally not current behavior.
4. **Historical documentation already preserved elsewhere** — rationale/evidence retained in current docs or Git/PR history.
5. **Genuinely useful and missing from `main`** — must be ported before branch deletion.

### Result

**Category-5 count: 0.**

No remaining development branch contains a production behavior, regression contract, architecture decision or research artifact that still needs to be rescued onto `main` before the ref is deleted.

### Branch-by-branch disposition

| Branch | Classification | Preservation evidence / reason |
| --- | --- | --- |
| `main` | KEEP | Sole product/continuation authority. |
| `browser-previews` | KEEP | Generated/deployment preview state; not product authority but still operational infrastructure. |
| `integrate/points-2-11-clean` | 1 | Direct ancestor of current `main`: comparison is 0 commits ahead and 17 behind. Contains no unique content. |
| `infra/pr-browser-previews` | 1 + 2 | `docs/PR_BROWSER_PREVIEWS.md` and `vite.config.ts` are byte-identical to `main`; `main` has the newer/improved preview workflow with guarded cancellation, exact preview-path verification and safer commenting. |
| `docs/observability-architecture-plan` | 1 + 2 + 4 | The three irreplaceable artifacts are exact blobs on `main`: `OBSERVABILITY.md` = `65867440…`, performance research = `03b07745…`, D-058 decision = `f8a0bfd4…`. Current surrounding status/authority docs are newer on `main`. |
| `fix/large-segment-spread-overflow` | 1 + 2 | The 320k Fueling and Ignition regression tests are exact blobs on `main`; the VE evidence-map 320k test is exact; the cell-evidence large-visit regression is present in a stronger form on `main` (including an interior negative timestamp/extrema check). Runtime fixes are represented by accepted point-1/main code. |
| `diagnostic/ve-session-guard-only` | 2 | Early analyzer-page guard for unchanged VE context. Current source/session ownership is stronger and explicitly tested on `main`; it distinguishes source identity/revision/sample/catalog semantics from navigation-only updates. |
| `fix/ve-owner-state-retention` | 2 | Earlier owner-level Logger→Analyzer retention plus Result View presentation caching. Superseded by accepted point-2/3 ownership and final model-derived Result View source authority. |
| `perf/general-ui-tracing` | 2 | Misleading branch name: it is **identical** to `fix/ve-owner-state-retention` at commit `457847785b67d9c073a0a89bf06cc1f5d26f7ebe`. There is no separate tracing feature hidden here. |
| `fix/ve-result-retention` | 3 | Contains the rejected `ve-analyzer-view-v10` / session-retention wrapper approach. The later investigation established that wrapper-stack direction as unsafe; current owner-level session behavior replaces it. Its tests encode the obsolete wrapper identity model rather than a missing current contract. |
| `fix/ve-session-authority` | 2 | Earlier standalone session-identity helper/test. Current `sameVeSourceContext` plus lifecycle browser regression is stronger: source identity, sample count, validity revision, catalog semantics, selected scope and tune changes are covered while unrelated navigation refreshes do not destroy Full Log authority. |
| `test/codex-point2-browser` | 2 + 4 | First browser-validation stage for current point-2 lineage. Superseded by later point-3/result-view stages and the accepted main lifecycle regression. |
| `test/codex-point3-browser` | 2 + 4 | Direct one-commit successor to point-2 browser branch; retained-primary evidence behavior is in #462/current main with broader tests. |
| `fix/ve-result-view-untouched-values` | 1 + 2 | Direct successor to point-3 line. Its Result View unit test is byte-identical to current `main`; final main additionally has full-stack Result View browser coverage and accepted heat/source-authority repairs. |
| `temp/epicscope-fixes-points-1-2-20261015` | 2 + 4 | Temporary parent/staging line for the old points integration. No independent feature family; current accepted clean integration was reconstructed on production `main`. |
| `integrate/points-2-11-20261015` | 2 + 4 | Old divergent integration line containing point-2/3 + points-5–11 staging and documentation. Its useful scope was rebuilt cleanly in #462; its only extra step over the temp line was the integration note, which is preserved in repository history/current docs. |

### Specific regression-contract checks

The audit deliberately checked the places most likely to hide useful orphan tests:

- **Large-input safety:** the >320k Fueling, Ignition and VE evidence-map tests from `fix/large-segment-spread-overflow` are already on `main`; the cell-evidence test on `main` is stronger than the branch version.
- **Session identity/retention:** the old `fix/ve-session-authority` tests covered sample-count, A/B/saved-range and channel identity. Current browser lifecycle coverage explicitly verifies Full Log ignores unrelated A/B movement while selected A/B/saved-range changes invalidate; source identity, catalog, sample count, validity revision and tune changes invalidate and stale pending work cannot commit.
- **Result View fallback:** the final unit test from `fix/ve-result-view-untouched-values` is exactly present on `main`, and `main` adds full-stack browser coverage plus accepted source-authority/heat-map behavior.
- **Observability research:** the architecture, performance research and D-058 decision blobs are exactly preserved on `main` before the old PR/branch is discarded.
- **Preview infrastructure:** documentation/base-path support is identical and the workflow on `main` is newer.

### What branch uniqueness means here

Several old branches remain one or more commits “ahead” of `main` according to Git graph topology. That does **not** mean they hold missing product work. The accepted #462 integration was deliberately reconstructed/rebased onto the production line, so equivalent or stronger changes often have different commit identities. The preservation decision is therefore based on file/test/behavior authority and accepted runtime evidence, not `ahead_by` alone.

## Final live head verification

After the preservation audit and after writing its first result to `main`, the GitHub branch collection was read again. The candidate refs had not moved during the audit. Audited heads were:

- `diagnostic/ve-session-guard-only` — `129f898ffb5d2ded9403cb87ca638564871085fa`
- `docs/observability-architecture-plan` — `c125bce13ffa259f1ef88932e23e78a62dc43712`
- `fix/large-segment-spread-overflow` — `6b73ee1d553e5e774e8c62e489932e508362d219`
- `fix/ve-owner-state-retention` — `457847785b67d9c073a0a89bf06cc1f5d26f7ebe`
- `fix/ve-result-retention` — `94c81d865521cd41398b1a5b94a2b95fa084c619`
- `fix/ve-result-view-untouched-values` — `31f6a2954072bb0e60ec32f4b0f6ad7d89b6279e`
- `fix/ve-session-authority` — `a817e17a607fb60f5c769ff8bff213778e850c77`
- `infra/pr-browser-previews` — `f2067b6a2451faa3071d6aadeb5b4594b7674643`
- `integrate/points-2-11-20261015` — `9268e295f9f6367443b253e991580e510042c651`
- `integrate/points-2-11-clean` — `7d0be605ecd11a35f46ea8552893842fbb1fedb4`
- `perf/general-ui-tracing` — `457847785b67d9c073a0a89bf06cc1f5d26f7ebe`
- `temp/epicscope-fixes-points-1-2-20261015` — `ef2f33103e253f5687c19c13831c8a74adf29463`
- `test/codex-point2-browser` — `dbecb07b1dbee53d24fd023b8d10a417b9d812df`
- `test/codex-point3-browser` — `b3d1709cc7311fc5256c582eaf2c7c4c0d5ea2f4`

`browser-previews` remains intentionally retained at `6dedb06191f05d3452bff02b407967cff14a1563`.

## Remote branch classification after preservation audit

Product authority:

- `main`

Infrastructure/deployment ref to retain:

- `browser-previews`

Audited development refs with **zero category-5 material**, therefore safe to delete at the verified heads above:

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

## Branch deletion tooling limitation

The GitHub connector available during the 2026-10-16 cleanup exposes PR close/update and branch-ref inspection/update, but it does **not** expose remote branch deletion.

Therefore the cleanup closes obsolete PRs and fully audits/classifies obsolete refs but must not falsely claim the remote refs were physically deleted. The audited development refs above can be deleted safely with ordinary Git/GitHub branch controls at the verified head SHAs.

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


## Pass C branch governance audit — 2026-10-26

Current production code remains authoritative. **No runtime code change, branch deletion or historical branch merge is authorized by this inventory.** Branch ancestry is not proof of behavioral equivalence.

At the documentation checkpoint, 12 non-main remote branches were compared with `main`. Nine were behind with zero ahead commits: `checkpoint/completed-improvements-target18-20261016`, `fix/lambda-delay-shift-selection-20261017`, `fix/mlg-incomplete-tail-and-worker-errors-20261026`, `fix/ve-v50-recovered-through-group-7c-20261022`, `integration/source-integrity-target1-20261016`, `integration/ve-v50-main-20261026`, `ui/ve-analyzer-v50-reconcile`, and the two `ui/ve-analyzer-v50-reconcile-overlay-scratch*` branches. They are **historical cleanup candidates**, not urgent deletions.

The three divergent branches require separate classification:

- `fix/ve-v50-reviewed-groups-1-7` (2 ahead, 41 behind at audit): its unique tree diff against `main` consisted of `docs/reference/README.md` and `docs/reference/VE_Analyzer_v50_Frozen.html`. Both files were copied **without content changes** onto `main` in Pass C. The frozen reference remains non-authoritative for calculations. Do not delete the branch until verifying other retention needs and that the source blob IDs remain identical.
- `ui/ve-analyzer-v50-port` (61 ahead, 378 behind): old alternate VE editing/UI branch. The implementation comparison is **not** an exhaustive 61-commit patch-equivalence audit. Representative current versus old files: `core/analysis/ve-delay-table-editing.ts` has the same Git blob (`3c969164c336c67fd19c694451f0500af419e9a5`); `ve-table-interaction.ts`, `ve-analyzer-v50-presentation.ts`, and `ve-analyzer-delay-table-interaction.ts` are *different*, with larger/current owner structures. This confirms overlapping evolution, **not** equivalence of every old commit. Four historical port/reconciliation documents are also unique in the old-branch diff and may merit archiving before eventual branch deletion. Keep branch until a true unique-behavior/patch and unique-document provenance audit closes.
- `browser-previews` (3 ahead, 436 behind): special preview-publication branch with a generated-assets-like tree, **not** ordinary source. Retain unless separately verifying deployed preview workflow and replacement publication design.

Preliminary safe classification: keep `main` and preview infrastructure; retain both divergent VE branches pending the precise checks above; fully behind branches may be pruned selectively after user approval, never through this docs pass. Do not treat source-file differences as evidence of defects, and do not cherry-pick historical code into production just to make trees match.

