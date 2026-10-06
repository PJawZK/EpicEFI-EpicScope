<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. Use the handoff plus current `main`/CI state for present-tense continuation.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Web UI Reference

## Purpose

This document records the approved EpicHub-derived interaction reference and current EpicScope-specific hierarchy.

The visual/interaction reference remains `EpicHub-Tablet-Landscape-0.0.45(2).html`, but EpicScope is its own product. It inherits useful Logger/Analyzer interaction patterns, not the wider EpicHub Dashboard/Tuner/Diagnostics shell or Android architecture.

## Core UI principle

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

Controls are grouped by what the user is trying to do next, not by implementation ownership.

Permanent visibility rule:

> A control remains permanently visible only when it is frequently useful at the current workflow stage.

Secondary/rare actions belong in compact menus, contextual rows or state-dependent surfaces.

## EpicScope mode switcher

The **EpicScope logo dropdown** is the in-product mode switcher.

Current real top-level entries:

- **Logger**
- **Analyzer**
- **Histogram**

The redundant active-mode chip is removed. Selected mode is represented by the menu state itself.

Analyzer and Histogram each use a compact secondary dropdown for their own subviews. Do not expand those subviews into permanent rows of top-level buttons.

The logo menu does not own Load Data, layout actions, diagnostics, Settings or wider EpicHub app navigation.

## Logger header hierarchy

Conceptual order:

```text
EpicScope ▾ | Graph preset ▾ | Layout ▾ | Undo/Redo | Search | Settings | Perf/Report
```

Exact placement may adapt to viewport width, but redundant context labels should not be reintroduced.

### Graph presets/workspaces

Graph workspaces are user-editable presets. The visible selector may display them in the coherent form:

`<user name> - Graph`

Examples:

- `General - Graph`
- `Idle - Graph`
- `Boost - Graph`

The stored user-editable part remains the workspace name itself.

Supported preset actions include create, rename, duplicate, delete and switch.

**Rendering invariant:** every available channel assigned to a visible pane renders. Hidden panes may retain assignments/active cache state; when made visible they reconcile automatically.

### Layout menu

Layout is one compact menu rather than separate permanent layout/arrange/reset/clear buttons.

It owns:

- Single/fixed multi-pane layouts;
- Freeform;
- Freeform quick arrange where relevant;
- **Reset**;
- **Clear**.

Reset/Clear appear at the bottom of the menu with short single-word labels and fitting symbols.

Freeform exposes five visible panes. Out-of-layout hidden pane geometry must not be applied.

### Undo / Redo

Undo and Redo form one compact rectangular control using two triangular halves split diagonally. Preserve the compact silhouette/alignment rather than turning them back into two full independent buttons.

### Search

The former `Search Symbol Value` text button is represented by a magnifying-glass symbol. The accessible name/popover can still describe Search Symbol Value.

### Settings

Settings are grouped sensibly by responsibility and current mode.

Current conceptual sections:

- Current mode;
- Interface;
- Data & storage;
- Diagnostics/help where appropriate.

Mode-specific settings should appear only when relevant. Do not hide core analysis controls in Settings.

## Channels / inspector

Wide layouts retain a right-side inspector/control surface.

Channel browser expectations:

- Search first;
- Group + visibility filters together;
- compact sort + direction;
- current values may appear directly with units;
- exact source/channel names remain available;
- known-no-data is distinct from active data.

Active/Favorites/Recent must reflect actual graph/pane context, not merely catalog existence.

## Timeline

Timeline is a shared first-class navigation/selection component.

Conceptual groups:

### Navigate

- play/pause;
- step/navigation;
- scrub/cursor;
- time display;
- Fit/zoom;
- previous/next view history.

### Range / Markers

- Set A / Set B;
- current A→B span/duration;
- save/clear/select saved range;
- markers and marker navigation.

### Contextual Analyze

Range/event context should naturally feed analysis without creating a permanent button for every tool.

The shared Logger timeline is also reused in Scatter and Distribution where those modes need the same A/B/range context. Re-parent the authoritative component rather than create divergent copies.

The existing Hide/Show controls edge tab remains shared with timeline-based analysis surfaces; only its silhouette was widened to fit the longer wording.

## Histogram mode hierarchy

Histogram secondary selector:

- **Table Generator**
- **Distribution**
- **Scatter**
- **Math Channels**

The former separate Heatmap / Dual Heatmap modes are not restored as separate primary modes.

### Table Generator

Important current UI rules:

- visible statistic wording is **Weighted Mean**, not `MLV Weighted Mean`;
- standalone **Size** button is removed;
- the remaining geometry button is **Table Size**;
- Table Size owns Auto/custom/MSQ geometry controls;
- Presets mean complete saved Table Generator setups;
- grouped Filters use the existing saved-library/editor model;
- cell evidence can open contributing samples in Logger.

Loaded MSQ table selection changes geometry only and must not silently rewrite selected analysis X/Y/Z channels.

### Distribution

Distribution is a real analysis workspace, not a placeholder histogram.

Current controls/features include:

- Full Log / Range A/B;
- Count / % Samples / Time;
- Automatic / Manual bins;
- Histogram / Cumulative;
- statistical summary;
- saved-range A-vs-B comparison;
- clickable bin evidence;
- shared Logger timeline.

### Scatter

Current controls/features include:

- Full Log / Range A/B;
- Single / Dual;
- Dots / Lines;
- X/Y selectors per pane;
- density heat encoding and legend;
- shared Logger timeline;
- Hide/Show controls tab.

Per-pane coverage/status belongs outside the plot overlay when possible. Stale previous plots must be cleared if a new selection cannot load.

### Math Channels

Math Channels is a dedicated editor, not a tiny formula popover.

Dynamic imported/saved labels are text data and must not be interpolated into executable HTML.

## Analyzer mode hierarchy

Analyzer uses a compact secondary dropdown rather than a permanent mode-button row.

Current subviews:

- Range Compare;
- Tune Table;
- Boost · Experimental;
- Idle · Experimental;
- AE / MAP Predict · Experimental;
- Fueling · Experimental;
- Ignition · Experimental;
- Fuel / Injector · Experimental;
- Trigger / Sync · Experimental.

### Shared Analyzer interaction

- semantic role mapping is visible and manually overridable;
- scope is explicit (Full Log / Current A-B / Saved Range where supported);
- event rows select evidence in Analyzer;
- double-click/Enter can open event evidence in Logger;
- aligned-event graphs use a common interaction model where applicable.

### Idle Analyzer UI

Idle must make control architecture explicit.

Idle system selector:

- Combined;
- DC Idle;
- IAC Valve;
- ETB;
- Ignition.

Common required roles:

- RPM;
- Idle Target.

Subsystem-specific controls appear only when relevant.

**DC Bias:** distinguish the calibration curve/table from any logged runtime bias contribution. The calibration itself is not a scalar channel selector.

Analyze controls must explain their meaning in context, e.g. sag threshold relative to target and settled band used to end recovery.

## Diagnostics / Perf / Report

Diagnostics should visually recede when healthy.

Perf and Report use compact consistent boxed controls.

Report has a live health status:

- healthy check when no issue/warning;
- warning count when warnings exist;
- issue count when issues exist;
- tooltip/title explains summary.

Log-specific warnings must not imply a log problem before a log exists.

## Approved deviations/refinements

1. EpicScope logo dropdown is the mode switcher.
2. Not the broader EpicHub shell.
3. Workflow-first hierarchy.
4. Right-side inspector/control consistency on wide layouts.
5. Offline/imported-log focus; live ECU acquisition remains separate future work.
6. Performance over exact visual reproduction.
7. Compact dense graph chrome.
8. Single-view synchronized stacked traces are an approved adaptation.
9. No disabled future-tool clutter.
10. Current values can be direct unit-aware text without decorative bars.
11. Mode/workspace/pane identity are separate concepts.
12. Secondary Analyzer/Histogram functions belong in dropdowns rather than permanent button rows.
13. Shared timeline/range components should be reused across analysis surfaces rather than duplicated.
14. Analysis controls should state what entered thresholds/values actually do.

## Reference change control

`EpicHub-Tablet-Landscape-0.0.45(2).html` remains the reviewed source reference, but this document plus explicit later owner decisions define EpicScope behavior.

Prototype changes do not silently supersede these rules. Meaningful changes require explicit review and corresponding decision/document updates.
