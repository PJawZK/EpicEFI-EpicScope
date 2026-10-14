# MegaLogViewer VE Analyze workflow / UI research pass

## Why this second pass exists

The first MegaLogViewer research pass captured much of VE Analyze's calculation/evidence behavior, but under-described the actual user-facing workflow and workbench layout. A real MLV VE Analyze screenshot reviewed on 2026-10-14 exposed that gap.

This document preserves the second, workflow-focused pass separately rather than rewriting the first research record.

Reference sources:

- MegaLogViewer VE Analysis documentation: https://www.efianalytics.com/MegaLogViewer/veAnalysis.html
- MegaLogViewer HD VE Analysis documentation: https://www.efianalytics.com/MegaLogViewerHD/veAnalysis.html
- historical VE Analyze manual PDF: https://www.efianalytics.com/MegaLogViewer/MegaLogViewerVE_Analyze_Manual.pdf
- user-provided current MLV VE Analyze screenshot reviewed 2026-10-14.

Research principle remains:

> Borrow MLV's accumulated experience, not its architecture.

---

## Primary correction to the first research pass

VE Analyze is fundamentally a **table workbench**, not a generic analyzer form.

The mature user workflow is visually centered on two large calibration tables:

1. the VE table being analyzed / proposed;
2. the target AFR table used as the mixture target.

The user can understand the task immediately because the calibration surface and target surface are always visible together.

The normal workflow is:

```text
open log + tune
  -> choose VE table
  -> open VE Analyze
  -> inspect VE table + Target AFR table
  -> adjust visible analysis controls if needed
  -> Run Analysis
  -> inspect suggested VE table in-place
  -> review original/hit-count/weighting context
  -> optionally revert/edit selected cells
  -> Accept New Table or exit without accepting
```

This should be considered a product-level behavior, not merely presentation styling.

---

## Observed workbench layout

The reference layout uses most of the window for two side-by-side tables.

### Left: VE table

The left table is the main editable/proposed calibration surface.

Observed properties:

- load bins vertically;
- RPM bins horizontally;
- full table visible at once where space allows;
- cells colorized by value;
- Run Analysis directly beneath the table;
- after analysis, the same table surface becomes the suggested/result table rather than moving the result to a separate report.

The VE result is therefore spatially anchored to the exact calibration cells the tuner already understands.

### Right: Target AFR table

The target table is a first-class peer surface, not a hidden input field.

Observed properties:

- load bins vertically;
- RPM bins horizontally;
- target AFR values visible in every cell;
- independently colorized;
- a Target AFR Table selector/action is available;
- the selected target table can be viewed and, in MLV workflows, edited for analysis.

The important product lesson is that the user can visually verify the requested mixture target at the same operating region where VE is being changed.

EpicScope should support lambda-first semantics internally, but the target table workbench should show the scale actually selected/available and make AFR-vs-lambda conversion explicit rather than hiding it.

---

## Core controls visible in the primary workflow

The screenshot and EFI Analytics documentation show these as central controls, not secondary implementation details.

### Run Analysis

A prominent **Run Analysis** action starts VE analysis explicitly.

There is no implication that opening the window starts the heavy calculation.

EpicScope should retain this explicit action model.

### Accept New Table

After analysis, MLV offers **Accept New Table**.

This is a clear state transition:

```text
original table
   -> analysis proposal
   -> explicit user acceptance
```

EpicScope should preserve the same conceptual lifecycle while improving it:

- Original/current tune remains immutable analysis input.
- Proposed VE is separate state.
- Accept/Apply must be explicit.
- Before any eventual tune mutation/export, EpicScope should show the diff and chosen apply authority.

### Exit / reject proposal

The user can exit without accepting the proposed table.

Running analysis must therefore never imply acceptance.

### Revert selected cells

EFI Analytics documentation states that selected cells can be right-clicked and reverted to original values after analysis.

This is an important review workflow:

- analysis proposal can be selectively rejected;
- the user need not accept or reject the entire table as one unit.

EpicScope should provide an equivalent explicit cell/range action, using its shared table-interaction foundation rather than requiring a special VE-only interaction model.

### Manual cell editing

MLV allows proposed cells to be manually modified before acceptance.

EpicScope should eventually allow proposal-surface editing without mutating the loaded MSQ/current tune until an explicit apply/export step.

---

## Cell Change / starting-table authority

The visible **Cell Change** control is the tuner-facing representation of starting-cell prior authority.

Typical values include modes such as Easy / Normal / Hard / Very Hard in MLV versions/workflows.

This changes how strongly the existing VE table resists movement from new evidence.

The first EpicScope spec correctly captured the underlying prior/evidence concept, but the UI lesson is equally important:

- keep a simple tuner-facing authority control near the workbench;
- expose the deeper evidence/prior explanation progressively;
- do not make users configure a statistical model before they can run VE analysis.

EpicScope may use clearer labels than MLV, but should preserve the fast workflow.

---

## Lambda / wideband delay

MLV exposes wideband delay / Lambda Delay as a direct part of VE analysis.

The current reference screenshot exposes a **Lambda Delay Table** action.

Historical documentation also describes record-offset based wideband delay.

EpicScope improvement remains justified:

- represent delay in time, not integer record offset;
- support single, RPM-curve and RPM x load table models;
- expose the working delay model directly from the main VE workbench;
- keep expensive delay discovery behind explicit **Grab lambda delays from log**;
- never force the user into delay discovery before ordinary VE analysis can be inspected/configured.

The key correction is that Lambda Delay should be a **prominent workbench tool**, not buried as an unrelated collapsed analyzer subsection.

---

## Target mixture handling

MLV exposes target AFR as a full table and provides target-table selection.

The target is therefore not merely a log channel. It may originate from the loaded tune and must be spatially aligned with the VE table.

EpicScope should support both sources deliberately:

- tune target table / interpolated target at the operating point;
- logged target lambda/AFR channel when available.

When both exist, the UI should make the selected analysis authority explicit and may compare them for consistency rather than silently preferring one.

A first useful default for an MSQ-backed workflow is:

- VE table from MSQ;
- target AFR/lambda table from MSQ;
- logged target channel shown as optional validation/context if available.

This is a material correction to the first shell, which treated target mixture primarily as a semantic log-channel role.

---

## EGO / closed-loop correction handling

The current screenshot exposes:

- **EGO Sensor Field**;
- **EGO Correction Field**.

MLV documentation/FAQ explains that EGO correction can be factored into the VE analysis rather than requiring closed-loop correction to be disabled.

Product implications for EpicScope:

- actual mixture source must be explicit;
- EGO/STFT correction source must be explicit when compensation is used;
- compensation must be visible in evidence/provenance;
- missing correction channels should degrade visibly;
- do not require users to disable normal closed-loop operation solely to make VE Analyzer function if the correction layer can be modeled safely.

EpicScope can improve on MLV by distinguishing observation from compensation and showing whether a recommendation used EGO/STFT correction.

---

## Wideband / narrowband mode

Historical MLV VE Analyze exposes Wideband AFR / Narrowband O2 mode selection.

For EpicScope, narrowband autotune should not be assumed necessary merely for parity. The useful product lesson is that the measurement model must be explicit.

Initial EpicScope VE Analyzer should prioritize calibrated wideband lambda/AFR evidence. Narrowband-specific analysis can remain deferred unless a supported use case requires it.

---

## Primary visible filters

The reference puts common filters directly in the VE Analyze workbench:

- minimum RPM;
- maximum RPM;
- minimum load/MAP;
- maximum load/MAP;
- minimum coolant temperature;
- start time;
- stop time;
- custom filter.

These are simple, understandable controls with immediate tuning meaning.

EpicScope's richer Qualification system should **not remove this simplicity**.

Recommended EpicScope design:

### Quick filters on the primary workbench

- Min RPM / Max RPM;
- Min Load / Max Load;
- Min CLT;
- Scope / time range;
- Custom filter state.

### Advanced semantic qualification

Progressively disclosed below/behind Advanced Settings:

- DFCO/fuel-cut exclusion;
- AE/decel exclusion;
- warm-up correction neutrality;
- RPM/load/TPS stability;
- recovery/settling;
- lambda validity;
- limiter/protection;
- injector/fuel-pressure limitation context.

This preserves the mature fast workflow while improving safety/evidence quality.

---

## Analysis result presentation

EFI Analytics documentation states that, after Run Analysis:

- the suggested table is displayed;
- original value can be inspected;
- hit count and weighting can be inspected;
- low-weight cells remain close to original because the starting value itself carries weight;
- cells can be reverted to original or modified before accepting.

This strongly suggests that EpicScope's primary result view should remain the VE table itself.

Additional EpicScope result modes can then be switchable overlays/views:

- Proposed VE;
- absolute change;
- percent change;
- mixture error;
- hit/sample count;
- cumulative weight;
- confidence;
- delay used;
- qualification/exclusion provenance.

Do not make the user leave the table to understand the proposal.

---

## What EpicScope should preserve exactly in spirit

- Two-table VE + target workbench as the primary visual model.
- Prominent Run Analysis action.
- Explicit proposal lifecycle.
- Accept/Exit separation.
- Selective revert/edit before acceptance.
- Simple Cell Change / prior-authority control.
- Direct access to Lambda Delay.
- Simple RPM/load/CLT/time filters visible without opening a formula builder.
- Explicit actual-mixture and EGO-correction field selection.
- Proposal shown in calibration-table coordinates.

## What EpicScope should improve

- time-based delay instead of record-offset delay;
- user-triggered delay discovery;
- semantic state/stability qualification presets;
- exact source-sample provenance;
- Logger navigation per cell/evidence region;
- confidence/exclusion reasoning;
- measured/interpolated/weak/withheld distinctions;
- diff-first explicit application;
- no implicit tune/ECU write;
- clear lambda/AFR scale handling;
- explicit tune-target vs logged-target authority.

---

## Correction to current EpicScope implementation direction

PR #399 established useful plumbing: semantic channel resolution, MSQ VE table/axis mapping, scope and readiness state.

Those foundations remain useful, but the current shell should **not** become the final primary UX.

Next implementation should reshape VE Analyzer around the two-table workbench before adding deeper calculation layers.

Recommended immediate sequence:

1. render selected VE table as the dominant left workbench surface;
2. render selected target AFR/lambda table as the dominant right workbench surface;
3. retain explicit MSQ table/axis selectors, but move them into compact setup/advanced controls rather than making them the main experience;
4. add prominent Run Analysis;
5. add quick Min/Max RPM, Min/Max Load, Min CLT, Scope/time and Custom Filter controls;
6. add Cell Change / prior-authority control;
7. add mixture/EGO field selectors;
8. expose Lambda Delay Table/model from the primary workbench;
9. only then add semantic qualification details, evidence overlays and recommendation math;
10. preserve proposal/original/review/apply state separately.

## Research status

The second pass closes a product-workflow gap in the original research. Further MLV VE Analyze research should be driven by concrete unanswered behavior questions rather than broad reverse engineering.
