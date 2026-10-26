# VE v50 interaction follow-up and Save investigation

Baseline: `76f78de77dfad3a8300fc515c8e1958e66541678` (published recovery branch). This follow-up implements the user's explicit inspection toggle and single compact timeline; it investigates Save to MSQ/Shim without implementing writing or export.

## Cell Evidence: explicit inspection mode

The Group 6 correction stopped the legacy tooltip writer corrupting structured evidence, but also opened evidence on ordinary released clicks. That interrupted normal multi-cell editing. The current toolbar action is now a toggle, initially off. Both the visible v50 button and underlying semantic button expose the same pressed state and active styling.

When off, selection/click/keyboard does not open evidence. Enabling opens the selected cell if one exists; otherwise the existing selection hint remains and the next selection can open it. While enabled, the existing selection-following adapter and retained evidence owner provide structured, cached details. Clicking the action again or closing the inspector disables inspection. Brush/editor clicks remain excluded and Working VE Enter/F2 editing retains precedence. Explicit programmatic evidence-open requests also activate inspection, keeping the existing owner contract useful without another evidence cache.

The existing owner holds the mode and receives root-local toggle requests. The edit-toolbar and v50 header only mirror that mode; selection-following respects it. Existing abort-controlled listeners own cleanup. No global listener, observer or lifecycle wrapper was added. Analysis invalidation still closes obsolete evidence, and hidden views cannot process late selection work. Inspection mode is session-local and is not persisted or a numerical qualification setting.

## One timeline driven by Log Scope

The previous layout rendered Full Log, editable A–B and saved-range timelines together. Its grid reserved 25% of the available width for each label, causing the reported filler gap. Existing production screenshots from Group 6 show both problems.

There is now one stable timeline row and track. Log Scope remains the selection owner: Full Log shows the blue whole-source band; Selected Range shows the amber A–B band and handles; a saved scope shows its purple range. Saved choices remain in Log Scope rather than additional timeline rows. Compact content-sized labels (capped at160px with ellipsis/title) and a6px gap let the track use the remaining width.

Dragging from Full Log or a saved scope previews a new selection on the same track, commits once through Logger's existing range setter and selects accepted A–B. Existing A–B handle adjustment, band movement, Shift replacement, cancellation and navigation ownership remain. Returning to Full Log retains Logger's A–B for reuse while hiding its markers. No range, analysis evidence, persistence writer or log scan is fabricated. Scope changes still invalidate dependent results without automatically running analysis. Removing the parallel rows also removes repeated saved-timeline-node construction.

## Save to MSQ/Shim investigation

The control is a disabled placeholder, not a working save action broken by recent changes:

- Commit `e8c20f8c5a1f6e272a221dbdbb6ed37219cae1b8` introduced it as “show disabled future save action.” Commit `d1ce040afadf5eeae4642a6582f5fdf025849d37` styled it.
- `apps/web/src/pages/ve-analyzer-v50-run-strip.ts` constructs `.ve-v50-save-proposal`, unconditionally sets `disabled=true`, and attaches no click handler or readiness enablement. Its tooltip says reviewed proposal export and safe ECU/shim reconciliation are unimplemented.
- The VE controller retains original tune, generated proposal and working review separately. No proposal-to-MSQ serializer/download path was found. `TuneModel` is a normalized semantic model, not an XML document-preserving writer; simply serializing it is not a proven round-trip MSQ implementation.
- `apps/web/src/pages/ve-analyzer-view-v2.ts` does implement a separate Lambda Delay JSON download via `serializeVeDelayTable`. This is not an MSQ export and does not save working VE review changes.
- `ShimHttpReadOnlyClient` exposes GET inspection of INIs, objects and trigger logs. The telemetry client sends handshake/subscription controls. The Save placeholder is not wired to a tune-write request, transaction, acknowledgement, ECU write or Burn.

Consequently, editing/reviewing VE currently does not produce a saved MSQ through this control. The loaded MSQ is not overwritten. This follow-up leaves the disabled control and its truthful unavailable tooltip unchanged.

Recommended next task, if requested: implement and validate an explicit **Save edited MSQ copy** path first, selecting working review values at a captured tune/review revision, retaining unrelated source document content and validating geometry, precision, blanks and identity before downloading a separate file. Treat Shim application as a separate capability/transaction task with readback and explicit user action; a download implementation must not silently enable ECU writing or Burn. Neither is implemented here.

## Validation and outstanding limits

Focused Chromium checks cover off/on/off, close-to-disable, subsequent selection, structured detail retention, original-tune colors, editor/Brush exclusion, single-track geometry/colors, exact saved/A–B/full bounds, stale completions, navigation and cached source ownership. Existing tests that previously used the Evidence button as an idempotent open action now use explicit open requests when inspection is already enabled; toggle tests assert that a second button click closes it. Native keyboard scope checks use the actual Log Scope choices, replacing removed redundant timeline buttons.

Full results, production screenshots, exact checkpoint and handoff are recorded under `/workspace/epicscope-v50-interaction-followup/`. No original large MLG/hardware validation or performance timing is claimed. The dropdown closure issue remains unreproduced. No push, merge, deployment pin or save implementation is included.

Final validation: build/typecheck passed; final956 unit tests/138files passed;1,402 Chromium checks/156 result groups passed (701 per mode);34 native built-production checks passed. Production screenshots were visually inspected for the active Evidence button, structured panel and compact Full Log/Selected Range track. Earlier browser failures are retained in separate directories: old observability and MSQ replacement helpers were treating toggle clicks as idempotent opens; helpers now request open explicitly when already enabled, preserving their authority/cache assertions. No tests were skipped or timeout relaxed. Existing bundle-size warning remains. Close-button mode handling is an abort-controlled listener on the exact owner button, so disposing the owner cannot leave its root retained through a reassigned shared-panel onclick callback.
