# EpicScope research index

This directory preserves external behavioral research that materially informed EpicScope design. It exists so design rationale does not depend on chat history or continued access to third-party binaries.

## Research policy

- treat mature third-party tools as behavioral/stability references, not design authorities;
- do not copy proprietary source or architecture;
- distinguish observed behavior from inference;
- convert useful behavior into EpicScope requirements, regression tests and explicit decisions;
- prefer EpicScope's evidence-first, source-provenance and semantic-channel architecture where it improves on reference behavior;
- **do not rewrite historical research observations merely because EpicScope later implemented a different or stronger design.**

Historical notes may contain contemporaneous wording such as “planned”, “not yet implemented”, or older PR boundaries. That wording is not present-tense product authority. Use `STATUS.md`, `../HANDOFF.md`, the relevant subsystem contract and current `main` for current state.

## Current implementation disposition — 2026-10-16

Read `STATUS.md` alongside historical notes.

Current high-level disposition:

- generic Histogram/Table Generator/Distribution/Scatter/Math Channel research selected for EpicScope is implemented or deliberately closed/deferred;
- VE Analyzer is implemented, real-log/browser validated and stable at its current checkpoint;
- the accepted VE lambda-delay working model is **RPM × load table only**;
- the old PR #449-era Result View/session defects were resolved by the points 1–11 integration merged through PR #462;
- narrow VE ownership debt remains around DOM-derived working-delay reconstruction, but it is not a current blocker;
- MLG v3 remains researched but not implemented;
- TunerStudio live table-editing/write semantics primarily belong to EpicHub, with only transferable explicit-state/apply invariants carried into EpicScope;
- D-058 unified observability is approved and is the next substantial implementation track after focused UI polish.

`STATUS.md` uses these disposition terms: **Implemented**, **Improved in EpicScope**, **Partial**, **Planned**, **Deferred**, and **Not applicable to EpicScope**.

## Research records

### `MLV_BEHAVIORAL_RESEARCH.md`

MegaLogViewer HD behavioral research covering Histogram/Table Generator weighting and persistence, Math/calculated fields, Scatter, compare/navigation, MLG reliability and VE Analyze safeguards/limitations.

**Current disposition:** generic Histogram findings are largely implemented/improved; VE findings are historical inputs to the implemented VE Analyzer.

### `MLV_VE_ANALYZE_WORKFLOW_PASS.md`

Workflow-focused MegaLogViewer VE Analyze pass covering the two-table VE + target-mixture workbench, lifecycle, selective revert/edit, Cell Change authority, Lambda Delay placement, target authority, EGO correction and quick filters.

**Current disposition:** informed the implemented VE surface. Current UI authority is `../VE_ANALYZER_WORKBENCH.md`.

### `VE_AUTOTUNE_REFERENCE_RESEARCH.md`

Cross-tool VE/autotune research comparing MegaLogViewer HD and ECUMaster EMU PRO VE Tuner, with conclusions around qualification, lambda delay, correction authority, confidence and evidence presentation.

**Current disposition:** principal evidence/delay/proposal concepts are implemented. Current ownership/state disposition is in `STATUS.md` and `../HANDOFF.md`.

### `VE_ANALYZER_MLV_EMUPRO_IMPLEMENTATION_AUDIT.md`

Dated implementation audit comparing an earlier EpicScope VE build against preserved MLV/EMU PRO research.

**Interpretation:** historical snapshot. Do not treat its “remaining/planned” wording as current without checking `STATUS.md`.

### `VE_ANALYZER_STATE_OWNERSHIP_AUDIT.md`

Dated architectural audit from the PR #442–#447 regression investigation.

**Current disposition:** historical evidence that informed the later owner-level points work. Its PR #449-era continuation advice has been superseded by the browser-accepted PR #462 integration now on `main`.

### `MLG_V3_RESEARCH.md`

Bounded MLG v3 compatibility investigation using TunerStudio/MLV and controlled fixture testing.

**Current disposition:** research complete enough for planning; production parser remains v1/v2. v3 is a compatibility extension, not a parser rewrite/current blocker.

### `OBSERVABILITY_PERFORMANCE_IMPLEMENTATION_RESEARCH.md`

Performance-first implementation research for the approved D-058 observability architecture.

**Current disposition:** active implementation guidance for the next substantial architecture track after UI polish. Authority remains `../OBSERVABILITY.md`.

### `STATUS.md`

Living research-to-product mapping. Update it whenever a researched behavior becomes implemented, improved, deliberately deferred or assigned elsewhere.

## Related current product authorities

- `../HANDOFF.md` — present-tense continuation authority.
- `../DOCUMENTATION_MAP.md` — document authority classification.
- `../ROADMAP.md` — current implementation sequence.
- `../VE_ANALYZER.md` — current VE algorithm/evidence/product contract.
- `../VE_ANALYZER_WORKBENCH.md` — current VE UI/workflow contract.
- `../OBSERVABILITY.md` — approved diagnostics/observability architecture.
- `../FUELING_ANALYZER.md` — Fueling Analyzer authority.
- `../ANALYZER.md` — Analyzer family maturity/semantics.
- `../HISTOGRAM.md` — generic Histogram authority.
- `../LOG_MLG_PLAN.md` — MLG parser/support policy.

## Cross-project TunerStudio research

TunerStudio table-interaction/persistence/stability research primarily targets **EpicHub**, because EpicHub owns live tune editing and ECU write semantics.

The parts that transfer to EpicScope are product invariants rather than feature-parity requirements:

- analysis/proposal state remains separate from tune/ECU state;
- closing a dialog must not imply Apply/Burn;
- any future VE proposal application is explicit and diff-first;
- shared table/curve interaction components may be reused where appropriate.
