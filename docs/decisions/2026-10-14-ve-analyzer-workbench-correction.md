# 2026-10-14 — VE Analyzer workbench correction

## Decision

The PR #399 VE Analyzer evidence-readiness shell is retained as useful input/mapping plumbing, but it is **not** the final primary VE Analyzer UX.

A second focused MegaLogViewer VE Analyze workflow pass showed that the mature user model is a two-table calibration workbench:

- VE / proposed VE table on the left;
- Target AFR/lambda table on the right;
- prominent Run Analysis;
- compact filters/authority/mixture/delay controls;
- result reviewed directly in VE-table coordinates;
- selective revert/edit before explicit acceptance.

Normative UI/workflow companion: `docs/VE_ANALYZER_WORKBENCH.md`.

Research record: `docs/research/MLV_VE_ANALYZE_WORKFLOW_PASS.md`.

## Why this changes the implementation order

The earlier shell correctly established:

- MSQ VE table selection;
- RPM/load axis selection;
- semantic input resolution;
- shared scope;
- readiness state;
- no automatic heavy analysis or tune mutation.

Those remain useful foundations.

However, continuing directly into deeper qualification/recommendation math would risk building a form-first workflow that misses the proven VE Analyze interaction model.

Therefore the next implementation step is to reshape the primary VE Analyzer page around the two-table workbench before adding recommendation math.

## Immediate implementation order

1. render selected VE table as dominant left surface;
2. render selected target AFR/lambda table as dominant right surface;
3. move explicit table/axis mappings into compact setup/advanced controls;
4. add prominent Run Analysis;
5. add quick Min/Max RPM, Min/Max Load, Min CLT, Scope/time and Custom Filter controls;
6. add Cell Change / prior-authority control;
7. add actual-mixture and EGO-correction selectors;
8. expose Lambda Delay Table/model prominently;
9. then add Recommended VE Analysis semantic qualification and evidence overlays;
10. then implement weighted VE recommendation math and review/application lifecycle.

## Invariants retained

- Run Analysis does not mutate tune state.
- Target mixture authority is explicit.
- Proposal and original VE remain separate.
- Lambda delay discovery remains explicit/on-demand.
- EpicScope retains stronger evidence provenance, confidence and qualification than MLV.
- Out-of-authority proposals are withheld rather than silently clamped.
- User acceptance/apply remains explicit and diff-first.
