# EpicScope research index

This directory preserves external behavioral research that materially informed EpicScope design. It exists so design rationale does not depend on chat history or continued access to third-party binaries.

## Research policy

- treat mature third-party tools as behavioral/stability references, not design authorities;
- do not copy proprietary source or architecture;
- distinguish observed behavior from inference;
- convert useful behavior into EpicScope requirements, regression tests and explicit decisions;
- prefer EpicScope's evidence-first, source-provenance and semantic-channel architecture where it can improve on the reference behavior;
- **do not rewrite historical research observations merely because EpicScope later implemented a different or stronger design.**

Historical notes may therefore contain contemporaneous wording such as “planned” or “not yet implemented”. That wording is not present-tense product authority. Use `STATUS.md`, `../HANDOFF.md`, the relevant subsystem contract and current `main` for current state.

## Current implementation disposition — 2026-10-15

Read `STATUS.md` alongside the historical notes.

Current high-level disposition:

- generic Histogram/Table Generator/Distribution/Scatter/Math Channel research selected for EpicScope is implemented or deliberately closed/deferred;
- VE Analyzer is implemented and real-log/browser validated, not planned-only;
- the accepted VE lambda-delay working model is **RPM × load table only**;
- VE currently retains known state-ownership debt after PR #449 restored the browser-known-good #441-era runtime;
- MLG v3 remains researched but not implemented;
- TunerStudio live table-editing/write semantics primarily belong to EpicHub, with only transferable explicit-state/apply invariants carried into EpicScope.

`STATUS.md` uses these disposition terms:

- **Implemented**;
- **Improved in EpicScope**;
- **Partial**;
- **Planned**;
- **Deferred**;
- **Not applicable to EpicScope**.

## Research records

### `MLV_BEHAVIORAL_RESEARCH.md`

MegaLogViewer HD 4.6.14 behavioral research covering Histogram/Table Generator weighting and persistence, Math/calculated fields, Scatter, compare/navigation, MLG reliability and VE Analyze safeguards/limitations.

**Current disposition:** generic Histogram findings are largely implemented/improved; VE findings are now historical inputs to the implemented VE Analyzer. See `STATUS.md`.

### `MLV_VE_ANALYZE_WORKFLOW_PASS.md`

Second workflow-focused MegaLogViewer VE Analyze pass covering the two-table VE + target-mixture workbench, Run/Accept/Exit lifecycle, selective revert/edit, Cell Change authority, Lambda Delay placement, target authority, EGO correction and quick filters.

**Current disposition:** its workbench conclusions informed the implemented VE surface. Current UI authority is `../VE_ANALYZER_WORKBENCH.md`.

### `VE_AUTOTUNE_REFERENCE_RESEARCH.md`

Cross-tool VE/autotune research comparing MegaLogViewer HD and ECUMaster EMU PRO VE Tuner, with design conclusions around qualification, lambda delay, correction authority, confidence and evidence presentation.

**Current disposition:** the principal VE evidence/delay/proposal concepts are implemented in EpicScope, with current remaining state-ownership/result-continuity work tracked in `STATUS.md` and `../HANDOFF.md`.

### `VE_ANALYZER_MLV_EMUPRO_IMPLEMENTATION_AUDIT.md`

Dated implementation audit comparing EpicScope's then-current VE work against the preserved MLV/EMU PRO research.

**Interpretation:** historical snapshot. Do not treat its “remaining/planned” wording as current without checking `STATUS.md`.

### `VE_ANALYZER_STATE_OWNERSHIP_AUDIT.md`

Dated architectural audit from the PR #442–#447 regression investigation.

**Current disposition:** still directly relevant as debt/evidence. PR #449 restored the browser-known-good runtime rather than completing the attempted continuity redesign. Current next steps remain staged state-ownership cleanup with browser verification.

### `MLG_V3_RESEARCH.md`

Bounded MLG v3 compatibility investigation using TunerStudio 3.6.00.06 Beta, MLV 4.6.14 and controlled fixture testing.

**Current disposition:** research complete enough for planning; production parser remains v1/v2. v3 is a compatibility extension, not a parser rewrite/current blocker.

### `STATUS.md`

Living research-to-product mapping. Update it whenever a researched behavior becomes implemented, improved, deliberately deferred or assigned elsewhere.

## Related current product authorities

- `../HANDOFF.md` — present-tense continuation authority.
- `../DOCUMENTATION_MAP.md` — document authority classification.
- `../VE_ANALYZER.md` — current VE algorithm/evidence/product contract.
- `../VE_ANALYZER_WORKBENCH.md` — current VE UI/workflow contract.
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
- shared table/curve interaction components may be reused where appropriate;
- EpicScope must not become a live tune editor merely to mirror TunerStudio.

## Traceability rule

When current implementation diverges from an old research recommendation:

1. preserve the historical observation;
2. update `STATUS.md`;
3. update the relevant current product/spec document;
4. add/refine a durable decision if the change is architectural/product policy.

This avoids both losing research history and allowing old “planned” text to contradict current product state.
