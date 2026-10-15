# VE Analyzer state ownership audit

Date: 2026-10-15

> **Status: current architectural-debt evidence, with the attempted PR #445–#447 stabilization superseded at runtime by PR #449.**
>
> The root ownership findings below remain relevant. The continuity/render implementations from PRs #445–#447 are **not** the current runtime authority because Analyzer entry regressed and PR #449 restored the #441-era browser-known-good composition.
>
> Current engineering sequence is authoritative in `../HANDOFF.md`, `../VE_ANALYZER.md` and `../ROADMAP.md`.

## Trigger

After PR #441 added cell evidence/Logger navigation, attempts to preserve VE result rendering/session continuity across Logger → Analyzer navigation introduced regressions culminating in an Analyzer-entry freeze.

Known-good browser reference before those experiments:

`fd21e4d4a390a4f6607d0290ef273749fc7fd915`

PR #449 restored runtime files to that known-good composition. The project owner then confirmed Analyzer entry works again.

## Root findings that remain valid

### 1. Base lifecycle is destructive

The underlying VE controller owns state such as analysis result, proposal, delay discovery/recommendation and working delay state. `setContext()` / `setTuneModel()` paths rebuild the surface and can clear analysis state.

Long-term rule: true source/tune authority changes may invalidate analysis; ordinary navigation/view refresh must not destroy a valid same-source analysis session.

### 2. Rendered DOM must not be both source and output

Result View previously parsed rendered cell text/title and then overwrote that same presentation. Switching views could therefore consume previous presentation output rather than authoritative analysis/proposal data.

Observed symptoms included missing `—` fallbacks and precision/value degradation after switching result views.

Target design: Result View renders from structured authoritative result/proposal state, never from presentation it previously wrote.

### 3. One result renderer/owner

The failed continuity work added overlapping full-table rendering/lifecycle responsibilities. Multiple owners increased work and made ordering fragile.

Rule: one authoritative result renderer/owner per structural surface.

### 4. Cell evidence duplicates analysis

`ve-analyzer-cell-evidence.ts` independently rebuilds qualification/evidence/proposal information rather than consuming the retained primary Run Analysis result.

This is not the known Analyzer-entry freeze cause, but it creates drift/performance/ownership risk.

Target: expose retained `VeEvidenceMapResult` / `VeProposalResult` (or equivalent authoritative session state) to cell evidence.

### 5. Working delay state is partly reconstructed from DOM

Cell-evidence/review paths can reconstruct working delay data from rendered cells, losing authoritative metadata such as direct source events/confidence/event counts.

Target: expose the real working `VeDelayTable` through explicit controller/session state.

### 6. Qualification has hidden one-shot state

Quick qualification currently depends on hidden call-order state around trace loading.

Target: make qualification explicit analysis request/session configuration rather than a one-shot loader flag.

### 7. Custom qualification semantics are unsafe/unclear

Current `Custom` behavior effectively disables normal state exclusions in affected paths. Before advanced formula exclusion is added, Custom must be redesigned so it means explicit user-selected qualification rules rather than silently turning DFCO/fuel-cut/AE/decel safeguards off.

### 8. Wrapper chain remains architectural debt

Historical VE layers (`v2` … `v9` plus global refinements/cell evidence) contain useful validated behavior but too many lifecycle/render owners.

Do not “clean this up” by adding another wrapper. Long-term consolidation should converge toward explicit responsibilities:

1. VE session/request state;
2. analysis orchestration/result/proposal state;
3. one table/result renderer;
4. review/evidence UI.

Consolidation is behavioral work, not cosmetic renaming, and must preserve the browser-validated direct delay editor.

## Historical attempted stabilization — not current runtime authority

PRs #445–#447 attempted to reduce duplicate rendering and preserve same-source continuity. Although parts of their design were directionally useful, the post-#441 runtime stack still produced an Analyzer-entry regression in real browser use.

Therefore do **not** treat merged state after PR #447 (`4edd39880eea84f8e18c05354e3636a177b04346`) as the current baseline. PR #449 is the runtime boundary.

The useful design lessons from the failed sequence are retained here; the runtime implementation itself was rolled back.

## Current known defects/debt

- Result View fallback/precision behavior remains imperfect.
- Logger → Analyzer VE result/session continuity is incomplete.
- lifecycle context/tune setters remain destructive.
- cell evidence duplicates primary analysis.
- working delay ownership is partly DOM-derived.
- qualification request state is partly implicit.
- Custom qualification semantics need redesign.

## Current recommended engineering order

1. preserve the PR #449 browser-known-good runtime;
2. fix Result View fallback/precision as one isolated change and browser-verify it;
3. fix Logger → Analyzer result/session persistence as one isolated change and browser-verify it;
4. then expose authoritative VE session/result/proposal/working-delay state;
5. make cell evidence consume retained primary results;
6. remove rendered-DOM delay reconstruction and hidden one-shot qualification state;
7. define Custom qualification semantics before adding advanced formulas;
8. only after state ownership is stable, continue proposal edit/revert/application-strength/export refinement.

## Invariants

- browser behavior is acceptance authority for VE lifecycle/render/input changes;
- CI remains required but is not sufficient;
- one structural change at a time;
- no automatic ECU write/Burn;
- original VE, Analyzer evidence/proposal and user-reviewed result remain separate;
- accepted lambda-delay working model is **RPM × load table only**;
- do not destabilize the currently working direct delay-table editor.
