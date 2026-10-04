<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. Use the handoff plus current `main`/CI state for present-tense continuation.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Web UI Reference

## Purpose

This document records the approved EpicHub-derived interaction reference and the current EpicScope-specific information hierarchy.

The authoritative visual/interaction source remains:

- `EpicHub-Tablet-Landscape-0.0.45(2).html`

EpicScope inherits useful Logger/Analyzer interaction concepts, but does not copy EpicHub demo state, Android implementation, Dashboard/Tuner responsibilities, or unrelated shell behavior.

The project owner has explicitly refined one earlier interpretation: the **EpicScope logo dropdown is intentionally the in-product mode/surface switcher**, similar in spirit to EpicHub's mode selection. This does not turn EpicScope into the full EpicHub application shell.

## Core UI principle

EpicScope should make the normal analysis path visible in the interface:

> **1. Load Data → 2. Channels → 3. Navigate → 4. Select / qualify range → 5. Analyze → 6. Compare / Export**

Controls should be grouped by **what the user is trying to do next**, not by which source file or component owns the implementation.

Permanent visibility rule:

> A control should remain permanently visible only when it is frequently useful at the current workflow stage.

Everything else should be contextual, grouped, placed under a compact menu/overflow, or revealed by state.

## EpicScope shell and mode switcher

EpicScope is a dedicated analysis product, but it has multiple analysis modes/surfaces.

The **EpicScope logo dropdown in the upper-right** is the approved mode/surface switcher. It must remain visually distinct from the Logger workflow controls.

Current menu state:

- **Logger** — active;
- **Analyzer** — planned;
- **Histogram** — planned.

Future approved modes may include Scatter, Histogram/Table, Math Channels, specialized Analyzer surfaces, or other genuine product modes. Do not populate the switcher with meaningless disabled clutter simply to advertise roadmap items.

The logo/mode menu is not the place for:

- Load Data;
- graph-layout controls;
- range/marker actions;
- diagnostics;
- Settings;
- EpicHub Dashboard/Tuner/Diagnostics application navigation.

## Primary Logger flow

The Logger surface should communicate this progression:

```text
Load Data
   ↓
Channels / graph workspace
   ↓
Navigate the recording
   ↓
Select / qualify a range or event context
   ↓
Analyze
   ↓
Compare / Export result
```

This hierarchy is more important than preserving the exact button placement of the EpicHub prototype.

## Load Data

Log and INI loading belong to one source-input concept.

Current implemented presentation:

**Load Data ▾**

Menu entries:

- Open Log…
- Load INI…

Existing file-loading handlers and data semantics remain authoritative; the dropdown is an information-hierarchy change, not a new source architecture.

The UI should communicate current source state compactly rather than keeping both load actions permanently equal in the top bar.

When no log is loaded, Load Data should be among the strongest visible actions. Once data is loaded, it may visually recede.

## Graph workspaces

A bare workspace name such as `General` does not explain its meaning. The global context is therefore:

**Graphs · <workspace> ▾**

Examples:

- Graphs · General
- Graphs · Idle
- Graphs · Boost

The header communicates **which graph workspace** is active. The graph area itself communicates **which pane inside that workspace** is active.

Do not duplicate pane identity in the global header with clutter such as `Graph - General - Pane 3`.

Reference/retained behavior:

- named graph workspaces;
- create/rename/duplicate/delete where supported;
- Single and multi-pane layouts;
- freeform layout where supported;
- independent channel assignments per pane;
- shared cursor/viewport/timeline/A-B navigation;
- active-pane context;
- maximize/minimize where useful;
- compact graph chrome.

Current EpicScope density refinements remain approved:

- fixed panes use compact static identity rather than a full-height header bar;
- freeform panes use compact draggable title chips;
- Single layout may use synchronized stacked channel rows with compact Now/Min/Max information.

## Header hierarchy

Current implemented hierarchy through PR #171:

- Open Log + Load INI → **Load Data ▾**;
- workspace context → **Graphs · <workspace> ▾**;
- empty top-level **Tools** placeholder removed;
- empty top-level **Compare** placeholder removed;
- EpicScope logo menu explicitly owns mode/surface switching.

Workspace/layout maintenance actions should be grouped together rather than scattered across the header.

Preferred conceptual grouping:

```text
Load Data | Graphs · workspace | Layout / workspace actions | Undo/Redo | contextual analysis/output
                                                             ...                  EpicScope ▾
```

Exact spacing may adapt to viewport width.

## Right-side inspector rule

On wide layouts, EpicScope keeps channel/detail/tool-specific controls on the **right side**:

```text
main graph / plot / table surface | right-side inspector / controls
```

Depending on mode, the right side may contain:

- channel browser;
- channel statistics/details;
- scatter controls;
- histogram/table controls;
- math-channel editor/source browser;
- specialized analyzer settings.

Future Linux/Android layouts may adapt presentation while preserving these responsibilities.

## Channels / Channel browser

The channel browser is workflow step 2 and should be immediately understandable.

Current implemented hierarchy through PR #172:

- primary identity: **Channels**;
- secondary descriptor: **Channel browser**;
- Search remains first;
- Group + visibility filters remain together;
- sort uses one compact selector plus ↑/↓ direction control;
- **Load now** is the primary footer action;
- **Add all filtered** and **Clear active pane** live under `⋯`.

### Filter semantics

Active/Favorites/Recent/group/search behavior is covered by focused tests.

Expected meanings:

- **All** — channels allowed by current search/group constraints;
- **Active** — channels active in the relevant graph/pane context, not merely channels that exist in the catalog;
- **Favorites** — favorited channels within current search/group constraints;
- **Recent** — recently used channels within current search/group constraints.

Known-but-unavailable channels must not be silently reclassified as active data merely because they remain assigned to a workspace.

If hosted behavior contradicts these semantics, treat it as a bug candidate rather than assuming user error.

### Live channel values

Channel rows may show the current value directly. A decorative value bar is not required.

Approved style examples:

- `848 rpm`
- `2.1 %`
- `λ 0.987`
- `48 kPa`
- `82.2 °C`
- `13.9 V`

Use an established symbol where it communicates the measurement naturally, such as `λ`. Otherwise use the normal unit text.

Exact source/channel names should remain available even if aliases are introduced later.

## Timeline: next hierarchy pass

The timeline is a first-class analysis control, but the existing implementation exposes too many functions at the same visual level.

The next approved UI pass should reorganize the existing controls without removing underlying functionality.

### Group 1 — Navigate

Frequent recording-navigation actions:

- play/pause;
- step backward/forward;
- timeline scrub/cursor;
- current/total time;
- Fit;
- zoom out/in;
- previous/next view history.

Order controls by normal frequency/importance. Start/end jumps and other rare navigation helpers may be visually secondary.

Marker navigation does not belong here merely because it moves the cursor; it belongs with Markers.

### Group 2 — Range / Markers

Range selection should become the bridge from navigation to analysis.

Initial state may present:

```text
Range   A —   B —    [Set A] [Set B]
```

Once both boundaries exist:

```text
Range 12.400 → 16.820   Δ 4.420 s
```

Secondary range maintenance should be grouped rather than permanently exposed:

- Save range;
- Clear A/B;
- Saved ranges;
- Rename saved range;
- Delete saved range.

Markers should similarly form one conceptual group:

- Add marker;
- Previous marker;
- Next marker;
- Edit current marker;
- Delete current marker.

### Group 3 — Analyze

`Analyze` becomes the contextual next action after data/channel/range context is meaningful.

Future menu contents may include:

- Range statistics;
- Histogram;
- 2D Histogram / Heatmap;
- Scatter;
- Events;
- later specialized analyzers.

The Analyze entry should be context-sensitive rather than creating a permanent button for every new analysis feature.

## Cursor-follow and graph-navigation behavior

Retained interaction contract:

- cursor moves independently until it reaches the middle region of the visible window;
- after that, the viewport follows while maintaining range width;
- if the cursor jumps outside the window, the viewport recovers to include it;
- graphs/panes remain synchronized to shared navigation context.

The project owner previously chose not to require the prototype's hard-coded Extremes or Zoom Event controls. Do not re-add them merely for reference fidelity.

## Generic analysis surfaces

After the Logger hierarchy is clear, generic analysis remains the planned foundation before specialized analyzers.

### Range statistics

Should consume explicit source/channel/range context and expose sample count, relevant statistics and qualification evidence.

### Histogram

Must expose:

- selected channel/value;
- bucket definition/count;
- scope (full recording or selected/visible range);
- active filters;
- sample count.

### 2D Histogram / Table / Heatmap

Must make semantics explicit:

```text
X axis
Y axis
cell value
aggregation/statistic
active filters
sample count
```

A cell's meaning must never require guesswork.

### Scatter

Reference behavior includes:

- X channel;
- Y channel;
- optional color channel;
- full-recording vs range scope;
- filter expression/preset;
- linked navigation back to source time/sample context.

### Math Channels

Derived/math channels should behave like normal channels downstream and use stable channel identifiers. Invalid formulas/dependencies fail visibly rather than fabricating data.

## Compare / Export

Compare remains a first-class future product capability, but a disabled top-level Compare placeholder is not useful.

Comparison may later become:

- a dedicated mode/surface;
- a contextual Analyze/Compare action;
- or a result-stage menu,

provided the generic compare service remains the underlying authority.

Expected comparison concepts include:

- second-run/log overlay;
- time/event/range alignment;
- manual offset where needed;
- metric deltas;
- linked source context.

Export similarly belongs to the result/output stage rather than permanently occupying Logger navigation space before useful export functions exist.

## Diagnostics and Settings

Healthy diagnostics should visually recede.

Preferred conceptual status:

`Ready · CRC ✓`

with a compact Diagnostics entry containing parser/source diagnostics, performance diagnostics and Bug report tooling. Warnings/errors may become more prominent when action is useful.

Settings should be grouped by responsibility, for example:

- Display;
- Playback;
- Sources;
- Storage/cache;
- Diagnostics;
- Help/shortcuts.

Do not allow development diagnostics to compete visually with ordinary Logger workflow.

## Performance implications

The UI reference remains subordinate to EpicScope performance requirements.

Avoid:

- unbounded DOM channel lists;
- full-dataset redraw on every interaction;
- continuous expensive animations;
- duplicated full channel arrays in analysis panels;
- analysis modes recomputing while inactive.

Preserve capability while using bounded/virtualized/downsampled implementations where appropriate.

## Approved EpicScope deviations/refinements

1. **EpicScope mode switcher** — the EpicScope logo dropdown is an in-product mode/surface switcher. This supersedes the earlier interpretation that EpicScope needed no module-like switcher at all.
2. **Not the broader EpicHub shell** — Dashboard/Tuner/Diagnostics and Android app-navigation architecture are still not inherited.
3. **Workflow-first Logger hierarchy** — Load Data → Channels → Navigate → Range → Analyze → Compare/Export.
4. **Right-side control consistency** on wide layouts.
5. **Offline/imported-log focus** initially; live ECU acquisition/REC remains separate roadmap work.
6. **Trigger Logger deferred** unless deliberately approved.
7. **Performance over exact visual reproduction**.
8. **Compact dense graph chrome** rather than large permanent pane bars.
9. **Single-view stacked traces** are an approved EpicScope adaptation.
10. **No hard requirement for Extremes / Zoom Event**.
11. **Shortcut discoverability under Settings/Help** rather than permanent toolbar space.
12. **No disabled future-tool clutter** — absent functionality does not need a permanent header placeholder.
13. **Current channel values without bars** — direct unit-aware values are preferred.
14. **Mode/pane identity separation** — mode belongs to EpicScope logo switcher; workspace belongs to Graphs; active pane belongs locally to the graph pane.

## Reference completion/control

`EpicHub-Tablet-Landscape-0.0.45(2).html` remains the reviewed reference source, but this document is the EpicScope authority after project-owner refinements.

Future prototype changes do not silently supersede these rules. Meaningful changes require explicit review and corresponding decision/document updates.
