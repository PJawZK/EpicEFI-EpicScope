<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. `docs/DOCUMENTATION_MAP.md` defines current versus historical authority.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Web UI Reference

## Purpose

This document records the approved EpicHub-derived interaction reference plus current EpicScope-specific hierarchy. EpicScope inherits useful Logger/Analyzer interaction patterns, not EpicHub's wider Dashboard/Tuner/Diagnostics shell or Android architecture.

## Core UI principle

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

Controls are grouped by user goal/sequence rather than implementation ownership. Frequently useful controls may stay visible; secondary/rare actions belong in compact/contextual surfaces.

## EpicScope mode switcher

The **EpicScope logo dropdown** is the in-product mode switcher.

Current top-level entries:

- **Logger**
- **Analyzer**
- **Histogram**

Analyzer and Histogram each use compact secondary dropdowns. Do not expand subviews into permanent top-level button rows.

## Logger header/workspace hierarchy

Conceptual wide-layout order:

```text
EpicScope ▾ | Graph preset ▾ | Layout ▾ | Undo/Redo | Search | Settings | Perf/Report
```

Graph workspaces are user-owned/editable. Starter templates materialize into ordinary workspaces and do not retain hidden ownership afterward.

The Layout menu owns fixed layouts, Freeform and relevant reset/clear/arrange operations. Available channels assigned to visible panes must render; hidden panes may retain assignments and reconcile when visible again.

## Channels / inspector

Wide layouts retain a right-side inspector/control surface.

Expectations:

- Search first;
- group + visibility filters together;
- compact sort + direction;
- current values with units where useful;
- exact source/channel names remain available;
- known-no-data distinct from active data;
- Active/Favorites/Recent reflect real workspace context.

## Load Data / live-source UX

Load Data order is intentionally:

1. Load INI
2. Load MSQ
3. Open Log
4. Unload Log
5. Connect Shim

`ts_shim` live/capture is implemented and real-ECU validated. Live acquisition is therefore **not** a future placeholder. It remains read-only and shares the same normalized product surfaces as recorded analysis.

A source transition must preserve unrelated INI/MSQ/workspace state and must not require a page reload.

## Timeline

Logger owns the authoritative timeline/range/marker component.

Conceptual groups:

- **Navigate** — play/pause, step, scrub/cursor, time, Fit/zoom, view history;
- **Range / Markers** — A/B, duration, saved ranges, markers/navigation;
- **Contextual Analyze** — current selected range/event can feed analysis.

Table Generator, Distribution and Scatter reuse the complete `.timeline-wrap`. Do not move `.timeline-shell` and `.edge-toggle--timeline` independently.

## Histogram hierarchy

Secondary selector:

- Table Generator
- Distribution
- Scatter
- Math Channels

Shared flow:

> **Scope → Channels → Qualification → analysis-specific controls → evidence → Logger / Export**

Current Histogram track is closed for broad feature expansion. UI changes should be correctness/regression/cleanup driven unless field use exposes a real gap.

### Table Generator

Current rules include **Weighted Mean** terminology, Median, one **Table Size** geometry control, saved complete presets, shared Qualification, exact aligned cell evidence and CSV/export. Loaded MSQ geometry does not silently rewrite user-selected analysis channels.

### Distribution

Supports shared scope/Qualification/Math Channels, Count/% Samples/Time, Histogram/Cumulative, comparison, saved setups, CSV, fixed geometry and Logger evidence. Outside fixed geometry remains explicit rather than clamped into edge bins.

### Scatter

Supports Single/Dual, Dots/Lines, density heat, saved setups, point evidence, box-region evidence against the full qualified population, strongest contiguous visit → Logger and qualified/region CSV export.

### Math Channels

Dedicated editor supporting arithmetic, comparison/logical expressions, lazy `if()`, historical `[Channel-N]` references and temporal helpers. Imported/saved labels remain text, never executable HTML. Nested saved Math Channel dependencies remain deliberately unsupported.

## Analyzer hierarchy

Analyzer secondary selector includes:

- Range Compare;
- Tune Table;
- Boost · Experimental;
- Idle · Experimental;
- AE / MAP Predict · Experimental;
- Fueling · Experimental;
- Ignition · Experimental;
- Fuel Pressure / Injector · Experimental;
- Trigger / Sync · Experimental;
- VE Analyzer · Experimental.

Shared Analyzer rules:

- semantic role mapping visible/manual where important;
- literal source names preserved;
- scope explicit where supported;
- evidence can return to Logger;
- decision-facing output uses progressive disclosure;
- unavailable dependencies remain visible rather than silently substituted.

## VE Analyzer workbench

`VE_ANALYZER_WORKBENCH.md` is the detailed authority. Key UI invariants:

- table-first VE + target-mixture workbench;
- table title/description left, compact controls right;
- current single ownership of table layout/tabs/header controls;
- Side-by-side / Single-table presentation without changing underlying table authority;
- compact normal-use mapping/qualification/authority controls;
- explicit **Run Analysis** and actionable blocker information;
- **RPM × load lambda-delay table only**;
- explicit **Grab lambda delays from log** and **Use recommendation** lifecycle;
- direct in-cell delay editing, no old external value/apply editor as primary workflow;
- Result View overlays on the VE table;
- per-cell evidence and strongest-visit Logger navigation;
- original tune, Analyzer proposal/evidence and user-reviewed result remain distinct.

Known UI defects: Result View fallback/precision and Logger → Analyzer result continuity. Fix one at a time from the browser-known-good PR #449 runtime and browser-verify each lifecycle/render/input change.

## Idle Analyzer UI

Idle system selector remains subsystem-aware: Combined, DC Idle, IAC Valve, ETB, Ignition. RPM/Idle Target are common required roles. DC Bias calibration is tune data, not a scalar runtime selector.

## Diagnostics / Perf / Report

Diagnostics should visually recede when healthy. Report exposes current health summary; log-specific warnings must not imply a log problem before a log exists.

## Approved EpicScope refinements

1. EpicScope logo dropdown is the mode switcher, not the broader EpicHub shell.
2. Workflow-first hierarchy.
3. Right-side inspector/control consistency on wide layouts.
4. Recorded and implemented read-only live/Shim sources share normalized product surfaces.
5. Performance over exact visual reproduction.
6. Compact dense graph chrome.
7. No disabled future-tool clutter.
8. Mode/workspace/pane identity remain separate concepts.
9. Shared timeline/range components are reused rather than duplicated.
10. Analysis controls state what thresholds/values actually do.
11. Shared components preserve their owning positioning/context wrapper when re-parented.
12. VE Analyzer is a table-first workbench with browser-validated behavior taking precedence over CI-only assumptions.

## Reference change control

`EpicHub-Tablet-Landscape-0.0.45(2).html` remains a historical reviewed source reference, but this document plus later explicit owner decisions define EpicScope behavior.

Prototype changes do not silently supersede these rules. Meaningful changes require explicit review and corresponding decision/document updates.
