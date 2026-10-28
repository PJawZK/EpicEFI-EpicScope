# Logger UI point 1 — Freeform horizontal-row trace clipping

Branch: `ui/idle-analyzer-html-integration`. Parent: `41c487a6d24d9eb438ff18af44544f8c9e1ef095`. Idle Analyzer work is paused at its independent-B foundation. This checkpoint fixes Logger layout sizing only; hover inspection is next, followed by MLV-style time navigation. No push or main merge included.

## Reproduced cause and correction

The real production browser, loaded with the supplied INI and canonical 2,000-record prefix, reproduced the reported clipping through Layout → Freeform → Horizontal rows. At1680×1050 each pane's drawable viewport was153.984px high, but `.graph-canvas` had a220px CSS minimum. The renderer correctly scaled traces to its canvas; the enclosing viewport then hid the lower66px. This was actual clipping, not missing samples or a source-decoding problem.

A second conflict was `.graph-workspace--freeform .graph-window { min-height:120px }`: on short screens it overrode the normalized row arrangement, causing overlapping rows/final-pane clipping. The layout owner already assigns pane geometry and independently enforces120px for explicit pointer resizing.

- `timeline-graph.css`: remove the canvas's conflicting220px minimum so it fits the pane.
- `logger-ui.css`: let automatically arranged freeform panes honor their assigned height instead of a second CSS120px minimum. Explicit pointer-resize limits remain unchanged in `logger-page.ts`.
- The existing `graph-viewport.ts` ResizeObserver remains the sole resize/draw owner. It measures the available canvas and resizes its backing bitmap for DPR. No new observer, listener, resize wrapper, renderer, graph scaling formula or source pass was introduced.

Readouts, selected samples, cursor/playback navigation, timeline ownership, channel mappings, source/cache behavior and Idle analysis are unchanged. Dense corner legends in very short panes remain a separate presentation concern; this correction makes the trace canvas fit its actual plotting area.

## Browser evidence and regression coverage

Before/after screenshots and measured geometry are under `/workspace/epicscope-logger-rows/native/` (private input bytes are not committed). After correction:

| Native viewport | First row pane height | Drawable canvas CSS height | Bitmap height |
| --- | ---: | ---: | ---: |
|1680×1050, DPR1 |155.984px |153.984px |154px |
|1366×900, DPR1 |127.484px |125.484px |125px |
|1280×720, DPR1 |93.297px |91.297px |91px |
|1440×900, DPR2 |127.484px |125.484px |250px |

Native mouse clicks exercised the actual Layout menu. Screenshots confirm full vertical trace scaling within the first row; all five row canvases fit, and short-screen rows do not overlap. DPR backing dimensions follow the existing renderer's rounded CSS-size policy.

`tests/web/logger-layout.browser.mjs`, included in the full acceptance gate, exercises the real loaded Logger shell:

1. All five horizontal-row canvases and backing bitmaps fit their assigned viewports.
2. A320px workspace keeps all five normalized rows nonoverlapping and the final row inside the workspace.
3. Minimize/maximize and restoration retain canvas ownership and sizing.
4. Mosaic, columns and cascade canvases fit their own frames.
5. Single/grid4/grid5/grid6 retain correctly sized bitmaps.

The targeted browser run passed10 checks across worker/fallback configurations. Production build passed, with the existing bundle-size advisory. The full browser gate passed 1,645 checks across 170 result groups in staged/fallback configurations. No new unit tests were added for this CSS-only correction; the meaningful regression is the browser layout/bitmap contract and native rendered traces.

This is functional layout validation with the available prefix, not a full1GB/hardware performance claim. Source loading/analysis algorithms were not changed.

## Stop point

Point1 is implemented; stop for review. Next: dotted hover crosshair and current-channel value popup, following the existing graph/Logger owners. MLV-style selected-time/navigation synchronization is last. Do not resume Idle Analyzer or start those next UI tasks automatically.
