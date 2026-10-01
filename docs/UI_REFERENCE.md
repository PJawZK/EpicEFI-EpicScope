# EpicScope Web UI Reference

## Purpose

This document records the approved EpicHub Logger/Analyzer interaction and layout reference that EpicScope Web should use as its starting point.

EpicScope inherits **only the Logger/Analyzer-facing interaction model**. Dashboard, Tuner, Diagnostics, Android runtime structure, Compose implementation details, and other EpicHub application concerns are not EpicScope UI authority.

The authoritative visual/interaction source for this task is:

- `EpicHub-Tablet-Landscape-0.0.45(2).html`

This file supersedes the previously inspected `EpicHub-1.12.1_TabletLandscape.html` as the EpicScope Logger/Analyzer UI reference. The older prototype is not implementation authority for `WEB-REFERENCE`.

The primary EpicHub architectural sources reviewed alongside the prototype are:

- `docs/HANDOFF.md` on `phase2/ui-diagnostics-foundation`;
- `docs/architecture/UI_FOUNDATION_LAYOUT.md` on the same branch;
- `docs/architecture/ANALYSIS_RESPONSIBILITY_MAP.md` for analysis ownership principles.

The HTML is a design/interaction prototype. EpicScope may reproduce approved interaction concepts without importing its demo data, prototype JSON/state implementation, or unrelated EpicHub shell responsibilities.

## Scope of inheritance

EpicScope should inherit these major concepts:

- graph-centric primary workspace;
- multiple named graph workspaces;
- selectable graph layouts;
- persistent bottom timeline/transport area with expandable/compact control behavior;
- right-side channel/detail surfaces on wide layouts;
- explicit edge controls for showing/hiding the sensor panel and timeline controls;
- Full Sensor List with search/filter/sort/favorites/recent behavior;
- channel statistics/details;
- markers and saved ranges;
- A/B cursors and delta/statistics workflows;
- source/session comparison;
- Scatter Plot;
- Histogram / Table analysis;
- Math Channels / derived channels;
- explicit filters and presets;
- linked navigation from analysis results back to graph context;
- view snapshots/session metadata where useful;
- explicit recorded-log identity in the header;
- recording control semantics where later supported by platform scope;
- bounded viewport-oriented interaction rather than requiring full-dataset redraws.

EpicScope does **not** inherit by default:

- EpicHub's four-workspace global navigation shell;
- Dashboard, Tuner, Tuning Tools, or Diagnostics pages;
- Android/Compose navigation/state architecture;
- live ECU connection authority;
- ECU write/Burn behavior;
- Trigger Logger as an initial EpicScope requirement;
- prototype demo/fixture truth;
- prototype JSON/localStorage implementation as a production contract.

Trigger Logger and direct live acquisition may be considered later through their own roadmap/architecture decisions.

## EpicScope shell

EpicScope is a dedicated analysis application, so it does not need EpicHub's module switcher.

The EpicScope shell should therefore be simpler:

```text
EpicScope header / loaded-log context / tools / settings
------------------------------------------------------
active analysis surface
------------------------------------------------------
persistent timeline / range / transport where relevant
```

The 0.0.45 reference adds two useful shell concepts that EpicScope should preserve semantically:

- an explicit `REC` state/action rather than hiding recording state in a secondary control;
- an explicit loaded-recording identity in the header.

For the initial Web phase, the loaded-log identity is immediately relevant. Recording remains platform/roadmap dependent and must not imply live acquisition support before that architecture exists.

The shell must prioritize usable analysis area and low rendering overhead over decorative navigation.

## Primary analysis surfaces

The 0.0.45 prototype exposes these relevant pages:

```text
Logger / Analyzer   -> graph workspace
Scatter Plot        -> X/Y analysis
Histogram / Table   -> binned analysis
Math Channels       -> derived channel editor
```

`Trigger Logger` is also present in EpicHub but is not an initial EpicScope requirement.

For EpicScope the four analysis pages above become first-class analysis surfaces rather than children of a broader EpicHub application.

The initial EpicScope navigation should preserve fast switching between them while keeping common session, channel, cursor/range, marker, and source context stable.

## Graph workspace

The graph workspace is the primary inspection surface.

Reference behavior includes:

- named workspaces such as General, Idle, and Boost;
- addable graph workspaces;
- workspace switching without discarding each workspace's graph state;
- workspace rename/duplicate/delete actions through contextual interaction;
- Single View;
- multi-graph grid layouts;
- optional freeform windows;
- channel assignments per graph/workspace;
- maximize/minimize behavior where useful;
- comparison controls;
- selectable view panels;
- snapshots and workspace configuration.

EpicScope does not need to reproduce every layout mode in the first implementation. The reference defines intended capability, while ROADMAP tasks decide implementation order.

## Right-side inspector/channel rule

EpicScope keeps additional/detail interaction on the **right side** for wide layouts.

The 0.0.45 reference places Full Sensor List and Channel Statistics on the graph workspace's right side. EpicScope extends this convention deliberately so tool-specific configuration/details also use a consistent right-side inspector rather than changing sides between analysis pages.

This is an intentional EpicScope refinement of the Tablet Landscape prototype, whose Scatter and Histogram/Table control sidebars remain left-side columns.

Therefore the wide-layout rule is:

```text
main plot / table / graph surface | right-side inspector / controls
```

The right-side responsibility may contain, depending on the active surface:

- channel list/search/filter;
- selected-channel detail/statistics;
- scatter axis/filter/preset controls;
- histogram/table axis/value/statistic/filter controls;
- math-channel editor controls/source browser;
- specialized analyzer settings later.

Presentation on narrow/mobile layouts is intentionally deferred; future Linux and Android layouts may adapt this responsibility differently while preserving semantics.

## Full Sensor List and Channel Statistics

Reference behavior to preserve:

- search channels;
- group filter;
- All / Visible / Favorites / Recently used filters;
- sort by name/group/value;
- indication of derived/math channels;
- add all filtered;
- clear active graph;
- selected-channel interaction with statistics/details;
- channel identity remains shared across graphs and analysis tools;
- explicit side-edge show/hide control for the sensor panel;
- Channel Statistics remains a separate detail overlay/surface tied to the active graph/channel context.

Exact TunerStudio/MegaLogViewer source names should remain available through EpicScope's channel model even if display aliases are added.

## Timeline and cursor

The timeline is a persistent, first-class analysis control.

Reference capabilities include:

- overview channel strip;
- draggable visible focus range;
- playback/transport controls for recorded data;
- cursor time;
- visible range display;
- saved ranges;
- markers and marker navigation;
- A/B cursors;
- extremes toggle;
- previous/next view history;
- Zoom Event;
- Fit / Zoom In / Zoom Out;
- configurable overview channel;
- configurable playback speed;
- explicit edge toggle for expanding/collapsing timeline controls rather than treating the timeline as simply present/absent.

### Cursor-follow rule

The approved behavior is:

> The cursor moves independently until it reaches the middle of the visible range. After that, the visible window follows the cursor while maintaining the current range width.

If the cursor jumps behind the current window, the viewport should recover to include it rather than becoming detached.

This behavior is part of EpicScope's interaction contract, not merely prototype animation.

## Scatter Plot

Reference behavior includes:

- any compatible raw or derived channel on X;
- any compatible raw or derived channel on Y;
- optional third channel for color;
- selectable sample limit/downsampling policy;
- Full recording vs Current visible range;
- sample filter expression;
- presets;
- named filters;
- X/Y swap;
- navigation back to selected context in Logger/graph workspace;
- range overview when operating on the current visible range.

EpicScope should keep the semantic link between an analysis selection and its source time/sample context.

## Histogram / Table

Reference behavior includes two related modes.

### Histogram

- channel selection;
- bucket count;
- full-recording or visible-range scope;
- sample filter;
- explicit result/readout.

### Table

- explicit X bins channel;
- explicit Y bins channel;
- explicit cell-value channel;
- explicit statistic/aggregation;
- configurable X/Y resolution;
- full-recording or visible-range scope;
- sample filter;
- linked navigation to source context.

EpicScope strengthens this with the existing PRODUCT requirement that every binned analysis visibly states:

```text
X axis
Y axis
cell value
aggregation/statistic
active filters
sample count
```

The user must never need to infer what a cell means.

## Math Channels

Reference behavior to preserve conceptually:

- create/edit/delete derived channels;
- derived channels behave like normal channels downstream;
- visible derived marker;
- formula references use stable channel identifiers;
- source-channel browser/filter;
- current/min/max preview;
- preview graph;
- derived channels may reference other derived channels only where dependency validation prevents invalid cycles/pathology;
- invalid formulas fail visibly rather than fabricate values.

The prototype's exact expression implementation is not production authority. EpicScope's eventual expression evaluator must follow the project's untrusted-input, bounded-resource, and dependency rules.

## Comparison

The reference includes a second-run overlay and multiple alignment choices:

- time;
- RPM crossing;
- TPS opening;
- nearest marker;
- manual offset;
- optional delta presentation.

EpicScope's roadmap already treats comparison as a first-class generic service. The UI should preserve the concept while allowing the underlying alignment model to become more rigorous than the prototype.

## Analysis presets, named filters, snapshots, and metadata

The reference demonstrates useful reusable analysis state:

- Scatter presets;
- Histogram/Table presets;
- named filters;
- graph workspaces;
- saved ranges;
- snapshots;
- session metadata;
- configuration import/export.

EpicScope should preserve these concepts where they improve repeatability, but persistence must follow `DATA_MODEL.md`, `core/session/`, `core/persistence/`, and schema-version rules rather than copying prototype localStorage/JSON behavior directly.

## Performance implications

The UI reference is subordinate to EpicScope performance requirements.

If a visual/reference behavior would require excessive DOM nodes, unbounded point rendering, repeated full-log scans, large duplicated state, or high idle redraw cost, EpicScope should preserve the user-visible capability while implementing it more efficiently.

In particular:

- graphs should request bounded/downsampled viewport data;
- analysis panels should not own full copies of channel data;
- inactive surfaces should not continuously recompute/redraw;
- large channel lists should support efficient rendering/filtering;
- comparison overlays should not duplicate complete source logs unnecessarily.

Visual fidelity is not allowed to override the performance priority established in `PERFORMANCE.md`.

## Deliberate EpicScope deviations from the prototype

The following deviations are approved for EpicScope:

1. **Dedicated product shell** — remove EpicHub's Dashboard/Tuner/Diagnostics module navigation; EpicScope is already the analysis application.
2. **Right-side control consistency** — Scatter, Histogram/Table, Math Channels, and future specialized analyzer controls/details should use a right-side inspector on wide layouts rather than switching to a left sidebar.
3. **Offline-first initial state** — the first Web implementation focuses on imported logs; live ECU mode and functional recording are not required for initial Web phases.
4. **Trigger Logger deferred** — digital trigger capture is not part of the initial EpicScope analysis foundation unless deliberately added later.
5. **Performance over exact visual reproduction** — density, animation, panel effects, or other appearance details may be simplified whenever necessary for speed, RAM use, or maintainability.
6. **No prototype implementation inheritance** — localStorage/JSON/demo-state implementation is not copied as architecture.

## WEB-REFERENCE completion criteria

`WEB-REFERENCE` is complete when:

- the exact current Tablet Landscape source has been inspected;
- the EpicHub semantic UI contract has been compared against it;
- inherited interaction concepts are recorded;
- deliberate EpicScope deviations are recorded;
- no implementation code has been created merely to discover these rules.

These criteria are satisfied by the review of `EpicHub-Tablet-Landscape-0.0.45(2).html` and the resulting authority in this document.

Future prototype revisions may supersede parts of this reference only through explicit review and a documented EpicScope decision.
