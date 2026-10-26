# VE Analyzer workbench contract

## Current v50 workbench addendum — 2026-10-26

Current `main` UI code and browser tests override older PR #462 groupings/diagram descriptions below. The integrated v50 workbench is table-first with VE/Target split or single presentation; Logger-owned Full Log/A–B/saved range selections; explicitly activated delay recommendations; Result Views with distinct source, generated and working states; protected pin behavior; structured Cell Evidence retained across released clicks; and red/blue direction coloring relative to original tune. See [current VE specification](VE_ANALYZER.md), [scope review](VE_V50_FOLLOWUP_GROUP4_TIMELINE_SELECTION.md), and [evidence review](VE_V50_FOLLOWUP_GROUP6_CELL_EVIDENCE.md).

Manual acceptance still matters for real-data dropdown behavior, Brush responsiveness, accessible dialog interactions, native browser selection and 32×32 rendering at actual zoom. Prior acceptance records below apply to historical revisions; they do not validate every later change.

## Status

This document is the normative UI/workflow companion to `VE_ANALYZER.md`.

VE Analyzer is implemented and browser-accepted on the PR #462 runtime lineage now merged into `main`. The exact pre-merge runtime accepted by the owner was `b435702412642f039a8a7f49d33037c309bef9d8`.

Future changes to workbench lifecycle/rendering/input behavior require browser validation; CI alone is not sufficient acceptance evidence.

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

The accepted control grouping is:

```text
[Table view] [VE table selector] [Target table selector / scale]
[VE table] [Target table]
[Result View]
```

Table title/description belongs on the left; compact controls/tabs belong on the right where space allows.

There must be one authoritative owner for table layout/tabs/header controls. Do not add later wrappers that re-parent the same nodes or create a second lifecycle owner.

## VE / proposal table

Before analysis, the VE surface represents the original selected tune table.

After analysis, the same spatial surface can show proposal/result overlays while the original value remains conceptually and technically distinct.

Required capabilities include:

- original VE display;
- proposed VE/result overlays;
- change / percent-change views;
- mixture/evidence views;
- sample count and cumulative evidence;
- confidence/spread;
- delay-used view;
- compact evidence/proposal state markers;
- per-cell evidence access and strongest-visit Logger navigation.

The rendered cell text is presentation only. It must not become authoritative state for later Result Views.

## Result View behavior

Accepted Result View semantics after PR #462:

- **Proposed VE** — proposal where emitted, original VE otherwise; normal VE heat-map.
- **Alternate Result Views** — cells with a real selected metric use that metric’s heat scale.
- **Fallback/untouched cells in alternate views** — preserve original VE text/value but use neutral heat.
- **Lambda Delay** — a valid interpolated working delay is a real metric even if the VE evidence state is no-evidence.
- repeated view cycling preserves the same authoritative source VE and primary-analysis identity;
- presentation-only switching must not trigger new trace loading.

App-level UI refinement may reorient load rows for presentation. Result View/model mapping must therefore use authoritative coordinates/stable metadata rather than rendered row position as model index.

## Target mixture table

Target AFR/lambda remains a separate tune table surface. Scale semantics must remain explicit. Loading or changing presentation must not silently reinterpret actual-mixture scale or mutate VE analysis state.

## Lambda-delay workflow

The accepted working model is **RPM × load table only**.

Normal lifecycle:

```text
Load/derive working delay table
      or
Grab lambda delays from log
        ↓
review recommendation/provenance
        ↓
Use recommendation (explicit)
        ↓
edit individual cells if needed
        ↓
Run Analysis
```

Expensive delay discovery is explicit. It must not run merely because the app/log/analyzer opened.

Direct cell editing is the primary delay-edit workflow. Recommendation and working delay remain distinct states.

## Run readiness

**Run Analysis** remains explicit and should be accompanied by actionable readiness/blocker information.

Hard blockers should be limited to genuinely required semantics/inputs. Optional qualification bounds left blank are not blockers. Missing optional safeguards should be visible as unavailable context rather than fabricated.

## Qualification and mapping

Normal workflow should resolve VE/target axes and common channel roles automatically where unambiguous. Manual overrides remain an Advanced escape hatch rather than consuming primary workflow space.

Qualification controls must state what they actually do. Custom qualification must not silently imply that normal safety/state exclusions remain active if they do not.

## Session/navigation behavior

The completed VE session remains authoritative when Logger/Analyzer navigation does not semantically change source/tune/scope.

Accepted behavior includes:

- switching to another Analyzer and back retains completed VE result;
- leaving Analyzer and returning retains the session when source/tune/scope are unchanged;
- cell evidence consumes retained primary analysis;
- genuine source/tune/scope changes invalidate conservatively;
- stale asynchronous completions/errors cannot publish into a newer session.

UI polish must preserve these ownership semantics.

## Cell evidence

Cell evidence should explain why a node has its current state, including retained source evidence, proposal/candidate context, confidence/spread and strongest contiguous source visit where available.

Opening evidence must not rerun the full VE analysis merely to reconstruct what the completed primary result already owns.

## Visual polish direction

The immediate project task is a focused UI polish pass. For VE workbench specifically, useful polish includes:

- consistent spacing between table header controls, tabs and descriptions;
- stronger distinction between setup controls, Run action, readiness and result-review controls;
- consistent numeric alignment and table density;
- clear selected Result View and active table/tab states;
- overflow behavior that preserves table readability;
- keyboard/focus/hover/disabled states;
- error/blocker copy that is compact but actionable.

Do not turn polish into another lifecycle/state wrapper refactor.

## Remaining ownership debt

The working delay surface is still partly reconstructed from rendered DOM by `readDelaySurface()`. This is later cleanup, not a blocker for current UI polish or observability work.

## Safety boundary

Original tune/VE data, Analyzer evidence/proposal and user-reviewed application result remain distinct states.

Nothing in the workbench may automatically write or Burn to the ECU.
