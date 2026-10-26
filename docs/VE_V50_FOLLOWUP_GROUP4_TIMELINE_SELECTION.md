# Follow-up Group 4 — Selectable VE timeline using Logger A–B authority

Baseline: Group3 `76cc52781386ba9bda0bb64fee1073458284f7f5`. This group implements range creation/adjustment in VE, not a separate range model. No main merge, automatic analysis or ECU writing/Burn. Group1's dropdown report remains unconfirmed; Groups5–6 are separate.

## Reproduction and ownership

The old VE timeline only projected whole-source/A–B/saved ranges and selected existing scope options. With no Logger A–B selection, only Full Log existed; no track could create a range. The before-fix Chromium regression fails in staged and fallback with “VE scope overview has no range selection track.”

Existing owners are preserved:

- `timeline-shell.ts` retains A/B annotations and workspace serialization. Its new atomic `setAnalysisRange` clips/normalizes real source bounds and emits one annotation/workspace mutation for a changed range. Invalid/unchanged requests produce no mutation.
- `logger-page.ts::getAnalysisContext` exposes a source-bound range setter. It rejects retired identities/revisions/sample extents/time extents and invalid/non-overlapping/zero-length ranges. Its boolean means **accepted**, including an unchanged range; this permits selecting existing A–B while Full Log is active without making another workspace-history entry.
- The shell republishes an accepted Logger context to the active Analyzer. This operation keeps the user in VE. “Open in Logger” remains a separate navigation/viewport action.
- The VE presentation owns private pointer preview geometry and dispatches the existing semantic scope change only after Logger acceptance. It never treats preview pixels or rendered text as analytical values. The existing v2 owner invalidates result/proposal/completion when selected scope actually changes.

## Interaction contract

- Log Scope has **Full Log** and **Selected Range (A–B)** as its primary choices. Selected Range is disabled until a real Logger range exists. Existing saved Logger ranges remain available; no saved ranges or evidence are fabricated.
- Full Log keeps its blue source band. The new amber selected-range row shares the same time-axis alignment; saved ranges remain purple.
- Drag the empty selected-range track to create A–B. Shift-drag anywhere replaces the range. Drag A/B handles to adjust either boundary; drag the band to move it while preserving its duration within the source extent.
- Pointer capture stays on the stable track. Pointer moves update only bounded band/marker styles; no source reads, persistence or analytical publication occurs during preview. Release commits once. Escape, pointer cancellation/lost capture, hidden/disposed view or a replaced context cancels the gesture.
- A/B handles are separate keyboard-focusable sliders, outside selection buttons. Left/right adjust by1% of source duration; Shift gives0.1%, with a1ms minimum step. Home/End use source endpoints. Zero-length resulting selections are rejected. Labels/ARIA expose millisecond bounds and accepted values.
- Selecting Full Log does not delete A–B. Revisit Selected Range later, or return to Logger, and the authoritative selection remains available.
- The new context flows through existing qualification/alignment/proposal ownership. Initial Full→A–B selection and an active A–B resize each invalidate once without autorun. Working delay and tune-bound pins retain their established semantics.
- Unknown/zero source extent or a context without the edit capability cannot create ranges. Existing valid read-only scopes can still be selected where available.

## Hidden work and persistence

Logger annotation changes previously refreshed inspector statistics immediately. VE selection occurs while Logger is hidden, so those changes mark its statistics dirty and defer that refresh until Logger is entered through the existing shell navigation boundary. Existing graph/range state remains synchronized. There is no new global listener, observer, generic lifecycle wrapper, worker, range cache or persistence writer.

The existing graph and overview render owners also converted hidden zero-size boxes into1px canvases and could scan cached full-log arrays for those draws. They now return before envelope construction when their measured width/height is zero; their existing ResizeObservers paint the accepted state when revealed. A320,459-value cached fixture proves hidden range updates inspect no value arrays and visible reveal still renders. This separates cached-array CPU work from source I/O; the deferred renderer is not a new cache or a dropped semantic update.

One committed change uses the existing timeline→Logger workspace mutation→shell workspace history/save path. Repeated identical accepted bounds do not create duplicate workspace mutations. Selection itself performs no file decode/read or full-log analysis; explicit analysis still uses Logger's bounded loader. Source caching/storage behavior is retained.

## Validation

New component regressions verify initial two choices, exact preview/commit separation, single invalidation/no trace reads, retained delay, handles, keyboard input, cancellation/inactivity/replacement, reverse drags, move/clamp and rejected commits. Actual Logger-owner tests verify one workspace mutation, normalized/clipped bounds, invalid/no-op handling, no hidden reads and stale-source rejection. Native shell CDP input checks accepted Logger metadata and Logger/Analyzer retention; separate built-production smoke checks native selection and explicit scoped analysis.

Native integration uses integer CSS-pixel input and derives expected times from those exact pixels, retaining tight numerical comparisons rather than assuming subpixel CDP coordinates survive conversion unchanged. Assertions target VE's scoped controls; other hidden Analyzer domains also have scope selects and must not be used to assess VE selection.

Existing saved-range tests now locate the A–B lane via its row (its selection button is no longer the parent of editable sliders). The unknown-range assertion expects a disabled Selected Range choice instead of its absence. Color separation, common-axis alignment, original bounds, saved-range retention and keyboard selection assertions remain intact.

Final command outcomes, screenshots, exact SHA and handoff: `/workspace/epicscope-v50-followup-group4/`. Synthetic/native small fixtures establish the range contracts; the original1.2GB recording/hardware performance remains untested. Stop after validation and a local commit. No automatic push, deployment-pin change or Group5 implementation.

Final results: build/typecheck and956 unit tests/138 files passed;1,376 Chromium checks/152 result groups passed (688 per mode), including9 selection cases,15 Logger-context cases (two new), and two native shell selection checks per mode. All22 final production-bundle smoke checks passed, including native selection, explicit A–B analysis, retained pins and interpolation. The production screenshot was visually inspected. Source/style/test checksums and git diff --check passed. Initial harness failures are retained: an open Lambda tool intercepted native coordinates; the selection test then needed to explicitly restore the completed Full Log baseline required by the unchanged MSQ replacement tests. No replacement assertion was removed, and no test was skipped or existing timeout relaxed.
