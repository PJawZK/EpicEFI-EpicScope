# VE Analyzer workbench contract

## Status

This document is a normative UI/workflow companion to `VE_ANALYZER.md`.

It was added after a second focused MegaLogViewer VE Analyze research pass exposed an under-specified part of the original EpicScope plan: the mature VE Analyze workflow is fundamentally a **two-table calibration workbench**, not a form-first analyzer.

Where this document and the earlier shell layout disagree, use this workbench contract for the primary VE Analyzer UX while preserving the evidence/safety rules in `VE_ANALYZER.md`.

## Primary layout

Desktop VE Analyzer should devote most available space to two calibration surfaces:

```text
┌──────────────────────────────┬──────────────────────────────┐
│ VE table / proposed VE       │ Target AFR / lambda table    │
│                              │                              │
│ load ↑                       │ load ↑                       │
│      cells...                │      cells...                │
│                              │                              │
│          RPM →               │          RPM →               │
└──────────────────────────────┴──────────────────────────────┘

[ Run Analysis ]

quick filters / authority / mixture fields / lambda delay

[proposal review controls] [Accept / Apply explicitly] [Exit / discard]
```

The exact responsive arrangement may change on narrower screens, but the VE and target tables remain the dominant visual objects.

## Left table — VE / proposal surface

The left table represents the selected VE table from the loaded tune.

Before analysis it shows the original/current VE table.

After analysis the same spatial surface should show the proposal, with the original value still available for inspection and selective revert.

Required capabilities over time:

- original VE display;
- proposed VE display;
- value-based coloring;
- selected cell/range interaction;
- original vs proposed value inspection;
- sample/hit count;
- cumulative evidence/weight;
- confidence;
- change / percent-change view;
- selective revert to original;
- optional manual proposal editing;
- evidence navigation to Logger.

Running analysis must not mutate the loaded tune.

## Right table — target mixture surface

The right table represents the target AFR/lambda calibration used by the VE calculation.

It is a first-class analysis input and should be visible beside the VE table.

Supported target authorities should include:

- target AFR/lambda table from loaded MSQ;
- logged target AFR/lambda channel where available;
- explicit comparison when both are available.

The UI must state which authority is used for analysis.

AFR/lambda conversion must be explicit and use the configured stoichiometric scale rather than silently mixing units/scales.

## Compact setup controls

The setup controls added in PR #399 remain useful but should become compact setup/advanced controls rather than dominate the page.

They include:

- VE table selection;
- VE RPM-axis selection;
- VE load-axis selection;
- target table selection;
- target RPM/load-axis mapping when required;
- semantic RPM/load/actual-mixture channel overrides;
- optional logged-target override/context;
- optional correction/context channels.

Suggestions are allowed. All important mapping remains visible and user-overridable.

## Primary actions

### Run Analysis

Prominent and explicit.

No expensive VE analysis should run merely because:

- the app opened;
- a log loaded;
- an MSQ loaded;
- VE Analyzer opened;
- a table/control changed.

Changing analysis inputs marks prior results stale. User presses **Run Analysis** to recompute.

### Accept / Apply proposal

Analysis result and tune state remain separate.

The eventual acceptance workflow must be explicit and diff-first.

Before EpicScope supports tune-state application, export/copy/review actions may be provided instead. No UI should imply that `Run Analysis` has changed the tune.

### Exit / discard

The user can leave VE Analyzer or discard the proposal without accepting it.

### Revert selected cells

Selected proposal cells/ranges can be restored to original VE values without discarding the entire result.

Use shared EpicEFI table-interaction behavior rather than introducing incompatible VE-only gestures.

## Quick controls visible near the workbench

Keep common tuning controls accessible without opening advanced semantic configuration:

- Scope / time range;
- Min RPM;
- Max RPM;
- Min Load;
- Max Load;
- Min CLT;
- Cell Change / evidence-prior authority;
- actual mixture field;
- EGO/STFT correction field;
- Custom Filter status;
- Lambda Delay model/table access.

The exact visual arrangement may use one or two rows beneath the tables.

## Advanced qualification

EpicScope should improve on MLV with semantic qualification, but progressively disclose it.

Advanced qualification can include:

- DFCO exclusion;
- fuel-cut exclusion;
- AE exclusion;
- decel enrichment/enleanment exclusion;
- warm-up/coolant correction neutrality;
- RPM/load/TPS stability;
- post-transient recovery/settling;
- lambda validity;
- limiter/protection state;
- sync/engine-running validity;
- injector/fuel-pressure limitation context.

The Recommended VE Analysis preset should resolve these automatically where semantic channels exist and visibly report unavailable safeguards.

## Cell Change / prior authority

Provide a simple tuner-facing setting near the primary controls.

Its behavior represents the authority of the starting VE value relative to new log evidence.

The UI may use descriptive labels rather than copying MLV naming, but it should remain quick to understand.

Advanced detail may show the actual prior/evidence weighting model.

## Lambda Delay

Lambda Delay is a prominent workbench tool.

Supported working models:

- single time value;
- RPM → delay curve;
- RPM × load delay table.

The full/table model remains preferred when evidence supports it.

EpicScope-specific improvement:

- delay is time-based rather than record-count based;
- **Grab lambda delays from log** is an explicit user action;
- discovered recommendation and user working model remain separate;
- measured/interpolated/manual delay regions remain distinguishable.

Delay discovery must not run automatically.

## Mixture and EGO correction

Actual mixture source is explicit.

Initial production priority is calibrated wideband lambda/AFR.

If an EGO/STFT correction channel is selected and used to compensate evidence, the result provenance must say so.

Do not require closed-loop correction to be disabled when a correction layer can be modeled safely.

Narrowband-specific autotune behavior is not required for first implementation merely for reference parity.

## Result lifecycle

The VE table surface has these conceptual states:

1. **Original** — loaded tune table.
2. **Analyzing** — explicit Run Analysis operation in progress.
3. **Proposal** — analysis result shown spatially on the VE table.
4. **Reviewed proposal** — user may revert/edit cells or choose application authority.
5. **Accepted/exported/applied** — only through a separate explicit action.

The original table remains available throughout the review lifecycle.

## Result views

The primary VE table should support switchable result overlays/modes rather than separate disconnected reports:

- Proposed VE;
- VE change;
- VE percent change;
- mixture error;
- contributing sample/hit count;
- cumulative weighted evidence;
- confidence;
- delay used;
- qualification/exclusion state.

A cell should be able to open detailed evidence and navigate to Logger.

## Result-state semantics

Cells must visually distinguish:

- measured recommendation;
- interpolated suggestion;
- weak/observational evidence;
- withheld recommendation;
- no usable evidence;
- manually edited proposal where applicable;
- reverted/original value.

Unvisited regions must not look measured.

## Immediate implementation correction after PR #399

PR #399's evidence-readiness shell is retained as useful plumbing, not final UX.

Before implementing full recommendation math, reshape the page in this order:

1. VE table renderer on the left;
2. target AFR/lambda table renderer on the right;
3. compact table/axis mapping controls;
4. Run Analysis as the primary action;
5. quick RPM/load/CLT/scope/custom-filter controls;
6. Cell Change/prior-authority control;
7. actual-mixture and EGO-correction selectors;
8. Lambda Delay access from the primary workbench;
9. Recommended VE Analysis qualification details;
10. evidence-only operating map and recommendation math.

## Product invariant

> VE Analyzer should feel first like a calibration-table workbench and second like an evidence inspector. EpicScope's stronger evidence model should explain and constrain the proposal without hiding the VE table and target table behind configuration forms.
