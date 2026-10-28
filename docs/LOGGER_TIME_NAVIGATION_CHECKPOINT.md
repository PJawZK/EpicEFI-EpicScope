# Logger main-graph time navigation checkpoint

Branch: `ui/idle-analyzer-html-integration`. Local checkpoint; no merge or push authorized for this task. Idle Analyzer development remains paused at the Stage 5 independent-B foundation.

## Reproduction and behavior

The requested target is the **main graph**, confirmed by the user. Native Chromium replay with the private production INI and canonical 2,000-record MLG prefix reproduced two failures before this change: clicking the graph did not select time, and graph panning changed the visible range without moving the selected data cursor/NOW values. The thin Navigate bar and overview already selected time; those existing interactions remain in place.

A primary-button click now selects the visible time under the pointer, using the same six-pixel plot inset as trace rendering. Farther clicks consequently produce larger time changes. Selection commits on release; movements under four CSS pixels count as click jitter. A drag pans instead, with no additional seek on release.

Graph panning carries selected time by the **actual clamped viewport displacement**, preserving its screen position. If selection was outside the previous window, a real pan brings it to the new center. A blocked/full-log pan leaves selection unchanged. Existing playback policy remains unchanged; this does not implement desktop MLV acceleration or hold-to-repeat behavior, and no desktop MLV parity verification is claimed.

## Ownership and safety

- GraphViewport owns pointer classification and local pointer capture/listener cleanup. Pointer cancellation, lost capture, source replacement, canvas resize, wheel navigation and leaving Logger retire pending gestures.
- TimelineShell remains the selected-time authority. Its explicit `seekTime` entry invokes the existing cursor notification path.
- LoggerPage owns synchronized viewport, pane cursors and workspace state. Graph pan intents explicitly request cursor carry; overview and other viewport intents retain their previous policies.
- Cursor and viewport publish together to each pane when following/panning. This avoids a second graph redraw solely to update the cursor after a viewport change.
- `cursorAfterViewportPan` is pure bounded arithmetic; no log scans, decoding, persistence reads, new global listeners, observers or lifecycle wrappers were introduced.
- Hover inspection remains separate from committed selection and clears on interaction through its existing boundary.

## Validation

- Focused timeline unit gate: 8 tests passed, including clamped pan, outside-window selection, blocked pan and invalid input.
- Full unit suite: 1,134 tests / 157 files passed.
- Production build passed; existing bundle-size advisory remains.
- Focused staged/fallback Chromium gate: 40 checks / 8 groups passed (new navigation coverage plus hover and row-layout regression coverage).
- Native production replay: nine states captured with real file inputs and native CDP mouse events; no browser exceptions. Main-graph click changed selected time from 20.292s to 10.123s. A zoomed graph drag moved cursor 10.736s → 11.022s while visible start moved 7.565s → 7.851s; NOW channel values changed accordingly. Existing overview/thin-bar actions also remained functional. Short horizontal rows at DPR2 accepted click navigation; subsequent hover left committed time and NOW values unchanged.
- Full staged/fallback browser gate: 1,675 checks / 176 result groups passed.

Synthetic component cases additionally cover click jitter, drag without release seek, pointer cancellation/lost capture, source replacement, explicit view retirement, non-primary button rejection and blocked full-log pan. Native replay supplies actual pointer-capture coverage, separate from synthetic component events.

Artifacts: `/workspace/epicscope-logger-navigation/`; logs: `/workspace/epicscope-logger-navigation-*.log`. Private log/INI bytes are excluded from Git. These checks do not establish full-1GB log performance or all-browser/hardware behavior.

Stop for manual review after validation. Logger clipping and hover checkpoints remain complete; this completes the requested main-graph navigation correction. Idle Analyzer comparison, persistence, remaining authority and final acceptance work remain incomplete and are not advanced here.
