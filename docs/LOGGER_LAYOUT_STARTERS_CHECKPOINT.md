# Logger layout, starter channels and graph-window presentation

Date: 2026-11-03. Branch: `ui/idle-analyzer-html-integration`. Parent checkpoint: `e4ba56213509c4eff2b07407afabf57f48d1e60c`. This checkpoint is local development work, not a main merge or deployment.

## Accepted implementation boundary

Only Logger starter materialization, layout/menu ownership, graph-window presentation and bounded manual resize changed. Logger decoding, numerical calculations, VE Analyzer, Idle Analyzer diagnostics, firmware and ECU writing are unchanged.

The implementation inspection found these existing owners:

- `built-in-workspace-templates.ts` / `semantic-channel-roles.ts`: named starter domain ordering and channel resolution. The resolver remains authoritative; its complete candidate/availability evidence is not truncated or replaced.
- `prepopulated-workspace-runtime.ts`: one-time materialization into ordinary user-owned channel assignments. This now applies the four-channel starter cap and fills all six pane slots from reusable role groups.
- `logger-page.ts` / `logger-pane-layout.ts`: source catalog, visible-pane loading, layout/window gestures, snapshots and workspace restore.
- Existing workspace/application persistence: unchanged formats, keys, source-channel normalization and eight-channel user limit.
- `logger-ui.css`: one shared pane presentation, with CSS container queries for small panes. No new observers or global listeners.
- `ui-refinements.ts`: visible Layout menu proxies existing source controls. Previously it duplicated choice definitions, omitted Dual and retained an independent arrangement order; it now derives its choices once from the owned selectors.

## Starter behavior and persistence

A new named starter resolves against the actual MLG/INI catalog, retains its domain-role ordering and assigns **at most four unique channels per pane**. Previously named templates could initially assign more, and unused pane slots remained empty. All six slots now receive source-resolved assignments before any layout expansion; only visible panes use the existing decode/load path. Reusable group candidates cover **Engine, Idle, Fueling, Boost, Electrical and Controller** behavior. Missing roles are omitted; unrelated catalog channels are not substituted to fill a quota. A sparse source can therefore leave a group empty. No signals, values or channels are fabricated.

The full candidate resolver remains reusable and unchanged. The four-channel cap belongs to new starter materialization, not to the user's assignment limit or persisted-data validator. Users can still assign **eight** channels. Shared group resolution is performed once when creating the initial starter collection and reused across its named workspaces; no new global catalog cache is added.

Assignments for all six panes use the existing snapshots and persistence. Expanding Single → Dual → grids → Freeform requires no reseeding and retains user changes. **Existing saved workspaces are not auto-filled or reset**, including intentionally empty panes, eight-channel assignments, saved geometry and arrangement choices. Explicitly creating an Empty workspace still means empty.

For an existing workspace, use **Layout → Reset starter channels** to opt into the common six groups. This explicitly replaces pane assignments for that workspace, preserves its layout/geometry and uses the existing restore/publication path. It is disabled until an actual source catalog exists. **Reset layout** continues to affect layout/window geometry only; it does not replace customized channels. A clean/reset workspace collection regenerates useful starters when source channels become available. No storage schema migration or raw-data persistence was introduced.

## Shared presentation and arrangements

- Every graph title/control bar is centered at the top, including Freeform. Existing drag/minimize/maximize controls and their owner remain in place; they remain available where the existing Freeform interaction supports them.
- Corner readouts use two-pixel edge offsets. Wide panes reserve the center bar's horizontal space. Narrow panes put the upper readouts immediately below it; lower readouts remain near their corners. Readout width/height bounds prevent collisions, with ellipsis for long text and **scrolling for all retained rows** when a short pane cannot show four/eight values simultaneously. Hover inspection remains available independently. Readouts are interactive scroll surfaces rather than silently clipped blocks.
- Existing graph canvases continue to fill their actual pane and match device-pixel ratio through their existing resize owner. No new canvas/render implementation was introduced.
- Workspace padding is removed, grid gutters are one pixel and pane borders remain thin. The fifth grid pane spans the formerly unused last cell. Fresh/explicitly arranged rows, columns and mosaic presets use contiguous normalized cells instead of percentage gutters; cascade retains its overlapping geometry. Persisted/custom geometry is restored, not rewritten to the new presets.
- New Freeform geometry defaults to **Horizontal rows**, which appears above Mosaic in both source selector and visible menu. Explicit saved choices survive. Legacy snapshots lacking arrangement metadata retain the historical Mosaic fallback; they are not silently migrated to Rows.
- Extremely narrow bars compact their spacing/grip presentation; title and controls remain within the pane.

## Reproduced manual resize boundary defect

Native production actions at a390px browser viewport produced a170px Logger workspace. The old manual resize rule forced a190px window even when only170px remained, overflowing into the sensor panel. This was independently reproduced before the correction, with native evidence retained under `resize-before/`.

The current resize owner now caps preferred190×120px minima to the actual remaining workspace, both before and after snapping. Normal minima remain when space permits. A pure layout helper and regression tests cover this boundary. Native first/last-row resize now stays within the narrow workspace. Ordinary native drag displaced the pane by40×20px, and ordinary resize changed dimensions by−40×−20px; these are observed geometry changes, not just changes to an arrangement label.

During validation, the full browser gate also caught a legacy70px readout minimum inadvertently re-exposed during CSS cleanup. That regression was corrected in the original rule, and all narrow layout/preset cases were rerun. No failing gate is represented as a pass.

## Validation evidence

- Focused layout/materialization units cover all six layouts, all named starter caps, unique/available IDs, empty/RPM-only catalogs, source overrides, contiguous presets and constrained resizing.
- Full unit suite: **1,145 tests /159 files passed**.
- Focused staged/fallback browser suite: **64 checks /10 groups passed** (starters/persistence/presentation plus hover, main-graph navigation and row-canvas regressions).
- Existing persistence serialization/parse + owner restore tests preserve explicit empty panes, eight channels, Mosaic/custom geometry and historical implicit Mosaic. Clean collection and explicit starter reset regenerate defaults. Sparse source replacement does not fabricate starter roles.
- Browser assertions cover every supported layout and Freeform preset at narrow width, eight-channel readout scrolling to its last row, short panes, canvas bitmaps, centered bars, corner intersections and minimize/maximize restoration.
- Production build: passed; existing bundle-size advisory remains.
- Native production replay: **28 checkpoints passed**, including all six layouts, all four Freeform presets, native dragging/resizing, minimize/maximize/restore, short/narrow/high-DPI displays, every layout at390px, corrected first/last-window narrow resizing and an actual page reload/re-import. No browser exceptions. Rendered screenshots were inspected.
- Actual reload retained Freeform Columns and all five pane channel assignments after the canonical MLG was reselected through its real file input. A page reload does not imply browser persistence of raw file bytes.
- Full staged/fallback browser gate: **1,701 checks /178 result groups passed**.

Artifacts: `/workspace/epicscope-logger-layout-starters/`; logs: `/workspace/epicscope-logger-layout-starters-*.log`. Native replay uses the private production INI and canonical2,000-record prefix; private bytes and screenshots are not committed. This is not a full1GB hardware-performance benchmark or all-browser validation. Extremely small panes necessarily show a bounded portion of their readout rows at once; scrolling/hover supplies the remaining values.

## Manual acceptance / stop point

Review the new default collection in clean browser state. For saved workspaces, first confirm existing choices survive; use Layout → Reset starter channels only when you want to replace their assignments. Exercise Single/Dual/grids/Freeform, Rows/Mosaic/Columns/Cascade, custom drag/resize, minimize/maximize and eight-channel assignment at your normal viewport/DPI.

Stop for manual UI acceptance after the checkpoint. Do not merge to main or automatically resume Idle diagnostic development. Idle stage completion remains unchanged: Stage5 descriptive Stability comparison is partial; matched qualification/conditions, aligned graphs and subsequent stage closures remain open.
