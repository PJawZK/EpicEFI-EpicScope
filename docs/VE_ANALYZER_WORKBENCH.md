# VE Analyzer workbench contract

## Status

This document is the normative UI/workflow companion to `VE_ANALYZER.md`.

VE Analyzer is implemented. The current browser-known-good runtime is the #441-era composition restored by PR #449. Future changes to workbench lifecycle/rendering/input behavior require browser validation; CI alone is not sufficient acceptance evidence.

## Primary layout

VE Analyzer is a **table-first calibration workbench**, not a form-first analyzer.

Desktop layout keeps the VE and target-mixture tables as the dominant visual surfaces. Current layout controls allow Side-by-side or Single-table presentation while preserving the same two-table authority.

Conceptually:

```text
┌──────────────────────────────┬──────────────────────────────┐
│ VE / proposal table          │ Target AFR / lambda table    │
│ load ↑                       │ load ↑                       │
│          RPM →               │          RPM →               │
└──────────────────────────────┴──────────────────────────────┘

[table/result controls]
[Run Analysis + readiness]
[quick qualification / mixture / authority / lambda delay]
```

On narrower screens the layout may reflow, but tables remain primary.

## Header/control ownership

The current accepted control grouping is:

```text
[Table view] [VE table selector] [Target table selector / scale]
[VE table] [Target table]
[Result View]
```

Table title/description belongs on the left; compact controls/tabs belong on the right where space allows.

There must be one authoritative owner for table layout/tabs/header controls. Do not add later wrappers that re-parent the same nodes.

## VE / proposal table

Before analysis, the VE surface represents the original selected tune table.

After analysis, the same spatial surface can show proposal/result overlays while the original value remains conceptually distinct.

Current/required capabilities include:

- original VE display;
- proposed VE/result overlays;
- change / percent-change views;
- mixture/evidence views;
- sample count and cumulative evidence;
- confidence/spread;
- delay-used view;
- compact evidence/proposal state markers;
- click/tap evidence detail;
- strongest source-visit navigation to Logger;
- future selective proposal review/revert without mutating original tune state.

Running analysis never mutates the loaded tune.

## Target mixture table

The target AFR/lambda table is a first-class analysis input and remains visible/reachable beside the VE table.

Table selection normally resolves matching RPM/load axes automatically. Manual axis mapping belongs under Advanced as an escape hatch for ambiguous/non-standard tunes rather than occupying normal workflow space.

AFR/Lambda scale semantics must be explicit. Literal table/source names remain preserved.

## Setup and quick controls

Keep normal-use controls compact and near the workbench:

- VE table;
- target table / mixture scale;
- Scope where applicable;
- optional Min/Max RPM/load;
- optional CLT/TPS qualification;
- actual mixture source;
- fuel-correction compensation source/mode;
- Cell Change / prior authority;
- minimum evidence authority;
- maximum absolute/percentage VE change safeguards;
- Lambda Delay access.

Optional operating bounds are not required proposal-safety inputs. Blank optional bounds mean full range/no bound and must not block Run Analysis.

## Advanced controls

Advanced configuration may include:

- manual VE/target axis mapping;
- detailed qualification/state exclusions;
- recovery/stability settings;
- prior/evidence numeric detail;
- non-standard source overrides.

Progressive disclosure is preferred over placing every semantic input in the main table area.

## Run Analysis and readiness

**Run Analysis** is explicit and user-triggered.

No expensive VE analysis runs merely because the app/log/MSQ/analyzer opened or because a control changed.

Readiness must explain specific blockers. The current `Run blocked · N issues` information UI should state why each blocker matters and offer a Fix/focus action when a concrete control can be targeted.

Do not replace specific readiness rows with vague aggregate “Proposal settings” status.

## Lambda Delay

### Current accepted model

Lambda Delay uses **RPM × load table only**.

Scalar/single-delay and RPM-curve modes are historical planning options and are not current product behavior.

### Discovery/workflow

- **Grab lambda delays from log** explicitly performs discovery.
- discovery recommendation and working delay table remain separate states.
- **Use recommendation** promotes the current recommendation into the working table.
- loading/saving a working delay table is explicit.
- grabbing a new recommendation must not silently destroy an existing loaded/saved working table.

Delay discovery must never run automatically.

### Delay table evidence states

Cells distinguish Measured, Interpolated, Insufficient and user-edited/manual working values where applicable. Interpolated evidence must not look identical to directly measured evidence.

### Direct delay-cell editing

Current browser-validated interaction:

- click/tap selects a cell;
- click-drag selects a rectangular range;
- typing digits starts replacement immediately;
- preview is visible in the selected cell/range;
- Enter commits;
- Escape cancels;
- Backspace edits;
- Delete clears to explicit no working delay (`—`);
- repeated edits to the same cell must work without clicking elsewhere;
- focus/selection should return after commit/rerender;
- user provenance is a compact marker rather than a persistent border that conflicts with selection.

Do not restore the old external value/apply controls as the primary interaction.

## Mixture and fuel-correction semantics

Actual mixture source is explicit. Calibrated wideband Lambda/AFR is the normal priority.

If a known correction source is used to compensate evidence, provenance must state that. Unknown correction semantics remain context-only unless the user explicitly declares a supported interpretation.

Do not require closed-loop correction to be disabled merely for reference parity when a correction layer can be modeled safely.

## Result lifecycle

Conceptual states remain separate:

1. **Original** — tune table loaded as analysis input.
2. **Analyzing** — explicit Run operation.
3. **Proposal/evidence** — Analyzer result.
4. **Reviewed proposal** — future/partial review state.
5. **Exported/applied** — only through a separate explicit future action.

Leaving/re-entering Analyzer should eventually preserve appropriate analysis-session state, but current Logger → Analyzer round-trip result persistence is a known defect. Fix it without conflating original tune, proposal and reviewed state.

## Result View

Current Result View includes proposal/change/percent-change/mixture-error/evidence/confidence/spread/delay-related perspectives.

Known issue: fallback/precision behavior remains imperfect. Fix Result View from authoritative structured state rather than repeatedly parsing/reusing rendered DOM as source data.

## Cell evidence

Cell evidence is field-tested and currently useful. It can show supporting evidence and navigate to the strongest contiguous source visit in Logger.

Current architecture debt: the cell-evidence layer recomputes VE analysis instead of consuming retained authoritative primary results. Future cleanup should remove that duplication after stable state ownership exists.

## Browser-known-good boundary

The #441-era cell-evidence composition is the last explicit browser-confirmed good baseline. PR #449 restored runtime files to that composition after post-#441 lifecycle/continuity wrappers froze Analyzer entry.

Do not batch-reintroduce those wrappers. Any state-ownership redesign must be staged and browser-tested after each structural change.

## Product invariant

> VE Analyzer should feel first like a calibration-table workbench and second like an evidence inspector. Evidence explains and constrains the proposal without hiding the VE table and target table behind configuration forms.
