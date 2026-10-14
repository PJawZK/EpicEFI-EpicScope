# EpicScope research index

This directory preserves external behavioral research that materially informed EpicScope design. It exists so design rationale does not depend on chat history or on access to third-party binaries.

The research policy is:

- treat mature third-party tools as behavioral/stability references, not design authorities;
- do not copy proprietary source or architecture;
- distinguish observed behavior from inference;
- convert useful behavior into EpicScope requirements, regression tests and explicit design decisions;
- prefer EpicScope's evidence-first, source-provenance and semantic-channel architecture when it can improve on the reference behavior;
- **do not rewrite historical research observations merely because EpicScope later implemented a different or stronger design.**

## Current implementation disposition

Read `STATUS.md` alongside the historical research notes.

`STATUS.md` records whether each major research conclusion is currently:

- **Implemented**;
- **Improved in EpicScope**;
- **Partial**;
- **Planned**;
- **Deferred**;
- **Not applicable to EpicScope**.

The historical research files remain the evidence/rationale record. `STATUS.md` is the living mapping to current product state.

## Research records

### `MLV_BEHAVIORAL_RESEARCH.md`

MegaLogViewer HD 4.6.14 research covering:

- Histogram / Table Generator weighting, thresholds, persistence and evidence behavior;
- calculated fields / math channels, history semantics, smoothing and dependency resolution;
- Scatter aggregation and evidence navigation;
- compare / playback / alignment behavior;
- MLG reader reliability, corruption recovery and partial-tail behavior;
- VE Analyze safeguards, confidence/prior behavior, delay handling and limitations.

**Current EpicScope disposition:** much of the generic Histogram/Table Generator/Scatter/Math Channel research is implemented or improved beyond the reference. VE Analyze findings are preserved as planned VE Analyzer behavior. See `STATUS.md`.

### `MLV_VE_ANALYZE_WORKFLOW_PASS.md`

Second, workflow-focused MegaLogViewer VE Analyze pass added after real UI validation exposed a gap in the original research. It covers:

- the two-table VE + Target AFR workbench as the primary user model;
- Run Analysis / Accept New Table / Exit lifecycle;
- selective revert/edit of proposed cells;
- Cell Change / starting-table authority;
- Lambda Delay Table placement;
- target-table authority;
- EGO sensor/correction field handling;
- quick RPM/load/CLT/time/custom filters;
- how EpicScope should preserve the mature fast workflow while adding stronger evidence and safety semantics.

**Current EpicScope disposition:** this pass changes the intended primary VE Analyzer UX. PR #399's readiness shell remains useful plumbing, but the normative workbench direction is now recorded in `../VE_ANALYZER_WORKBENCH.md`.

### `VE_AUTOTUNE_REFERENCE_RESEARCH.md`

Cross-tool VE/autotune research comparing MegaLogViewer HD and ECUMaster EMU PRO VE Tuner, with explicit EpicScope design conclusions for qualification, lambda-delay discovery, correction authority, confidence and evidence presentation.

**Current EpicScope disposition:** supporting foundations exist in Fueling, AFR-delay analysis, Qualification, Table Generator weighting, semantic roles and MSQ tune context. VE Analyzer has now started as an experimental shell; the next implementation step is the two-table workbench defined in `../VE_ANALYZER_WORKBENCH.md` before recommendation math proceeds.

### `MLG_V3_RESEARCH.md`

Bounded MLG v3 compatibility investigation using TunerStudio 3.6.00.06 Beta, MLV 4.6.14 and controlled fixture testing. Records what is confirmed, what remains unresolved and the exact compatibility implications for EpicScope.

**Current EpicScope disposition:** research complete enough for planning; runtime support remains v1/v2. MLG v3 is a compatibility extension rather than a parser rewrite or current EpicEFI blocker.

### `STATUS.md`

Living research-to-product mapping. Update this file when a researched behavior becomes implemented, is improved in EpicScope, is intentionally deferred, or moves to another EpicEFI product.

## Related product specifications

- `../VE_ANALYZER.md` — EpicScope VE Analyzer evidence/algorithm behavior contract derived from MLV/EMU PRO research.
- `../VE_ANALYZER_WORKBENCH.md` — normative primary VE Analyzer workflow/layout contract from the second MLV VE Analyze pass.
- `../FUELING_ANALYZER.md` — current Fueling Analyzer maturity and reusable delay/qualification foundations.
- `../ANALYZER.md` — present Analyzer family maturity and sequencing.
- `../HISTOGRAM.md` — present generic Histogram/Table Generator/Distribution/Scatter state.
- `../LOG_MLG_PLAN.md` — production MLG parser/support policy.

## Cross-project TunerStudio research

Recent TunerStudio table-interaction/persistence/stability research primarily targets **EpicHub**, because EpicHub owns live tune editing and ECU write semantics.

The parts that transfer to EpicScope are product invariants rather than feature-parity requirements:

- analysis/proposal state must remain separate from tune/ECU state;
- closing a dialog must not imply Apply/Burn;
- any future VE proposal application must be explicit and diff-first;
- shared table/curve interaction components may be reused where EpicScope eventually gains editable proposal surfaces.

Do not turn EpicScope into a live tune editor merely to mirror TunerStudio.

## Traceability

The VE Analyzer specifications in `../VE_ANALYZER.md` and `../VE_ANALYZER_WORKBENCH.md` should be read together with the research notes in this directory. The specifications record intended EpicScope behavior; these research documents record the external evidence and reasoning that motivated those decisions; `STATUS.md` records current implementation disposition.

## Research status

The broad MLV and VE/autotune investigations are considered complete enough for product work after the second VE Analyze workflow pass. Future MLV/EMU PRO/TunerStudio inspection should be triggered by a concrete EpicScope behavior question, regression or compatibility need rather than open-ended reverse engineering.
