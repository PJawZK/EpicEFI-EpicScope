# Group 6A — Transactional saved Lambda Delay replacement

Scope: saved-delay file replacement only. Discovery/activation and Load Data workflow remain Group 6B. No main merge or ECU write.

## Reproduced defect

Before the correction, the shared delay interaction adapter captured every `load-delay-file` change and called `resetInteractionSession` before the loading owner read or validated the file. A malformed file destroyed the private numeric draft in Chromium in both staged-worker and Worker-disabled modes. That reset also cleared selection, pins, Undo/Redo and baseline, despite the valid working table and primary analysis remaining authoritative.

Pre-fix evidence: `/workspace/epicscope-v50-next-group6a-validation/reproduction.json`. This is a regression reproduction using the real production controller and shared editing stack; it is not a claim about native OS file-dialog focus behavior.

## Ownership and correction

`ve-analyzer-view-v2.ts` remains the owner of file reading, parsing, validation, working-delay replacement, session invalidation and stale-completion checks. Existing `delayLoadGeneration` already rejects older file selections and completions after source/tune changes, editing, hiding or disposal; no new generation system was added.

Only after a file passes the generation check and parser acceptance does that owner publish a root-local `ve-delay-file-accepted` notification. `ve-analyzer-delay-table-interaction.ts` uses that notification to retire the old private interaction, selection, pins, history and baseline. The listener uses its existing AbortController. Picker changes, empty selection, read rejection and parse/validation rejection no longer reset the interaction session.

Successful replacement advances the existing surface generation and invalidates dependent analysis once through the existing owner. Same-geometry replacements retire old history too. Original tune data remains separate and unchanged. No additional global event listeners, observers, full-log passes, storage operations or loading framework were introduced.

## Regression cases

`tests/web/ve-delay-replacement.browser.mjs`, registered in the full acceptance runner, checks:

- Malformed JSON, invalid analytical axes, rejected file read and empty picker preserve accepted primary/value/generation, selection, pins, private draft and Undo/Redo.
- Pending loads preserve drafts until accepted; accepted changed-geometry replacement clears stale draft/selection/pins/history, withdraws primary evidence, publishes one session revision and establishes the replacement baseline without loading traces.
- An older success cannot overwrite a newer success or a newer rejected request.
- Source, tune, editing, hidden-view and disposed boundaries reject obsolete completions.
- Rejection preserves a pre-existing Redo stack; successful same-geometry replacement retires old history.

## Limits / next checkpoint

Native OS file-dialog focus/blur behavior may naturally commit or close an editor independently of loading; this patch removes the unconditional picker-change reset. The focused tests dispatch file-input changes against real controllers, and the full browser suite also exercises native file-input assignment. Manual UI acceptance remains required.

Discovery/re-grab policy, activation feedback and Load Data ordering are intentionally deferred to 6B. No numerical formulas, evidence policies or Brush mechanics changed. User hardware and the original approximately 1.2 GB MLG were unavailable; this small saved-delay loading change does not establish large-log timing.

## Validation

- Production build/typecheck: passed; existing bundle-size advisory remains.
- Unit suite: 917 passed across 136 files.
- Full real Chromium suite: 1,050 checks across 124 result groups; 525 checks per mode (staged workers and Worker-disabled fallback). The 12 new replacement cases pass in each mode and are included in that total.
- `git diff --check`: passed.
- Full-run artifacts: `/workspace/epicscope-v50-next-group6a-validation/`. No full-gate failure or assertion/timeout relaxation was required.
