# Logger UI point 2 — hover inspection

Branch: `ui/idle-analyzer-html-integration`. Parent: `fb95c3ad7268329b0482051ddd1b85399ed5af24`. Idle Analyzer remains paused at the independent-B foundation. This checkpoint adds hover inspection; MLV-style committed-time navigation is still the next separate task. No push or main merge included.

## Working behavior

Moving a mouse/hovering pen over a populated Logger graph shows a dotted vertical line and a colored value popup for that pane's rendered channels. The time is snapped to the nearest original observation in the first retained trace; the header explicitly says **Hover**, gives source time and original sample index. Visible non-minimized graph panes display the same hover time on their own time scales. Only the pane under inspection owns the popup. Empty panes do not fabricate values.

The committed solid cursor, playback time, NOW values, inspector selection and A–B/saved ranges remain independent. Hover emits no committed-cursor update or workspace mutation. Pan/drag and wheel zoom keep their existing interaction owners and dismiss hover. Pointer leave/cancel, graph layout changes, source replacement/clear, channel removal/loading changes, viewport/validity changes and leaving Logger withdraw stale hover. Returning to Logger does not resurrect an old pointer popup; a new pointer move inspects the current data.

The popup uses a native manual popover owned by the graph, with pointer events disabled. Its top-layer positioning avoids clipping the eight channel rows inside short Freeform panes, and clamps to the browser viewport. This uses the current modern Chromium platform, not another UI framework or a global popup manager. Existing page/graph ownership explicitly clears it when hidden. No new global listeners, MutationObserver, ResizeObserver or generic lifecycle wrapper is added.

## Data and performance contracts

`core/timeline/viewport-series.ts` extracts `nearestNumericSamplePosition` from the existing nearest-sample search. It preserves original observation identity even if invalid; the existing `nearestNumericSample` remains the valid-value wrapper with the same tie/out-of-range/invalid behavior. The shared search is logarithmic, does not scan for a healthier neighbor, and neither sorts nor mutates source arrays.

`graph-hover-inspection.ts` receives only the viewport and retained rendered trace references. It has no data-source loader, parser, analysis, committed-cursor or persistence capability. At a selected observation, each channel uses the same original index **and exact timestamp**, its own validity and finite value. Invalid, absent or misaligned values show **Unavailable**. No interpolation, resampling, aggregate bucket value or healthy zero is substituted. Missing cached coverage yields no hover sample; hover itself never fetches it. The lookup follows the existing ordered-range time-search policy, not a new decoder for source clock anomalies.

Pointer events coalesce into one pending animation frame with the latest coordinates. The popup retains one title and eight reusable rows; moving between samples updates their text/color rather than rebuilding graph/legend/table DOM. The dotted line is a lightweight DOM overlay. The component never calls the graph draw/envelope/statistics path. Cross-pane synchronization updates presentation only; it does not evaluate other panes' full arrays or change active-pane selection.

Logger's current pane owner distributes transient hover time. Graph viewport's existing data/resize boundaries clear stale inspection; the existing app mode boundary explicitly clears top-layer hover before hiding Logger. Existing asynchronous trace-publication points also clear stationary-pointer inspection when a channel/range is accepted, rather than leaving an older channel set visible. Source decoding, cache/storage, workers and analytical authority remain unchanged. Cached data can still be updated by their existing owners; source/validity/viewport changes invalidate inspection rather than accepting late presentation from another source.

## Browser and numerical evidence

Focused lookup cases preserve original invalid sample11 at200ms, keep valid-value lookup unavailable there, preserve the earlier observation on an exact tie, reject outside coverage and use fewer than64 time-entry reads beyond320k records.

Direct browser tests use retained channels to verify:

- Channel values, units, original identity and cross-pane line synchronization.
- No committed cursor emissions/source reads and an unchanged graph bitmap during hover.
- Invalid required observations and per-channel timestamp mismatch remain unavailable.
- Async channel completion withdraws the popup even when the mouse has not moved.
- Pointer bursts retain the exact title/row DOM nodes; the native top-layer popup can be taller than its short graph row while staying inside the browser viewport.
- Leave, viewport/validity changes, drag start and replacement dismiss inspection.
- With320,459 retained samples and500 synchronous pointer events, one coalesced projection uses fewer than128 time-entry reads and at most2 numeric-value reads. This is a bounded lookup test, not a full-browser hardware benchmark.
- Actual Logger-shell hover leaves timeline text unchanged and cannot leak into Analyzer after the existing mode transition.

The real-file production replay used the private INI and canonical2,000-record prefix. Twelve native action checkpoints covered single-graph inspection at different points, pointer leave, Freeform horizontal rows, empty panes, zoom, dragging, return to hover, Logger→Analyzer→Logger and DPR2. For example, the short-row popup reports **12.686s / original sample984**, with RPM887 and the separately recorded MAP/TPS/coolant/intake/battery/lambda/advance values. All five panes show the dotted line; the eight-value popup extends beyond its originating row without being clipped. Committed timeline and NOW snapshots remain unchanged by pointer inspection. Native screenshots show no popup after pan/zoom dismissal or Analyzer navigation. No browser exceptions occurred.

Private input bytes are not committed. These observations do not establish full1GB log, all hardware or all-browser performance; no automatic periodic hover refresh for live-changing data is claimed.

## Validation and stop point

- Focused viewport-series unit gate:18 tests passed.
- Full unit suite:1,133 tests /157 files passed.
- Production build passed; existing >500kB bundle advisory remains.
- Targeted worker/fallback browser gate:26 checks /6 groups passed (hover plus Logger layout).
- Native production replay:12 action checkpoints passed, including high DPI and short rows.
- Full browser gate: 1,661 checks /174 result groups passed in staged/fallback configurations.

Artifacts: `/workspace/epicscope-logger-hover/`; logs: `/workspace/epicscope-logger-hover-*.log`. Point1's row-canvas correction remains covered by the browser gate.

Stop for manual review here. Next is **MLV-style time navigation**, beginning with the actual click/drag/selected-time owners and a controlled reference behavior check. Do not fold that navigation change into hover or resume Idle Analyzer automatically. Idle's seven-stage completion remains unchanged: current primary/Viewed/tune and B foundations are working; comparison, persistence, remaining authority and final acceptance are still incomplete.
