# Points 5–11 integration review

Source branch: `temp/epicscope-fixes-points-1-2-20261015`

Source head: `3dec0f8f56047490592c332d7098a3b70475175b`

Production baseline at review start: `dd63b54f707a4afaa798107928946dce1c4fc12e`

## Scope being integrated

The source branch contains the previously browser-validated point-2/point-3/point-4 ownership foundation required by points 5–11, followed by the consolidated points 5–11 implementation. Production `main` already contains the independently merged point-1 large-log spread fix, so Git history is divergent even though the point-1 behavior is already represented on both sides.

The integration scope is therefore the accepted owner-level behavior from points 2–11, while preserving production main's point-1 implementation and avoiding wrapper/lifecycle-stack regressions.

## Point 5 — selector ownership

- Removes Analyzer/Histogram document-wide option-decoration ownership and subtree observers.
- Moves labeling/eligibility/defaulting to local selector owners.
- Preserves literal source names and units, manual selections and the VE actual-mixture real-transition guard.
- Introduces shared pure option-label helpers; no replacement global observer/listener.

## Point 6 — active Analyzer work only

- Adds explicit Analyzer activity routing.
- Hidden domains defer latest inputs rather than performing expensive work.
- Pending/obsolete completions are rejected when activity/context/tune changes.
- Tune changes during hidden/pending work participate in invalidation rather than allowing stale publication.

## Point 7 — measured CPU/correctness cleanup

- Reuses sorted weighted VE evidence for quantiles rather than sorting repeatedly.
- Caches immutable channel-role normalization by channel-definition identity.
- Removes remaining large event-extrema spread risk in Idle/AE paths.
- Bounds event-row preparation/navigation to the displayed 200-row limit.
- Retains profile-justified event-envelope sorting reuse; does not rewrite rolling/recovery algorithms without profile evidence.

## Point 8 — cooperative bounded VE work

- Uses cooperative bounded batches in the profiled VE evidence pipeline rather than adding workers without evidence.
- Exposes progress and explicit cancellation while preserving existing generation guards.
- Keeps synchronous work documented where no measured justification exists for further worker/batching complexity.

## Point 9 — recoverable persistence failures

- Makes preset/filter/math-channel save/delete failure visible at the owning manager.
- Adds Retry/current-cache-safe behavior.
- Preserves existing healthy storage/cache architecture instead of replacing it.

## Point 10 — analysis load rejection ownership

- Handles rejected trace/data loads at the current Analyzer controllers that own them.
- Shows actionable current-session errors rather than allowing rejected `void` chains to escape as unhandled rejections.
- Rejects obsolete errors/completions after newer state supersedes the load.

## Point 11 — transactional MSQ replacement

- Keeps the current accepted tune authoritative while a replacement is read, parsed, validated and normalized.
- Accepts/switches tune only after the replacement candidate is valid.
- Failed replacement preserves the previous tune and valid VE/session state and reports an actionable retry message.
- Uses a monotonically increasing load generation so only the latest selection may be accepted or report an error; older completions are ignored.
- Keeps the picker usable so a newer selection can supersede a pending read.
- Scope is intentionally limited to MSQ replacement; this is not a general file-loading refactor.

## Validation evidence carried by the source branch

The source handoff records:

- 117 automated test files / 601 tests for the completed consolidated checkpoint;
- focused Analyzer lifecycle/activity/selector/persistence/load-error checks;
- 73 real-Chromium component checks;
- production build/typecheck and diff checks;
- synthetic full-shell 1.2-GB / 320,458-record / 1,389-channel acceptance;
- point-11 replacement tests covering invalid/current retention, overlapping selections and latest-generation authority.

These are source-branch validation records. The integrated production candidate still requires CI and browser acceptance on the actual integration result; source-branch success is not treated as proof that a divergent-history merge is browser-correct.

## Remaining point 12

Point 12 remains deliberately unimplemented: post-conversion socket-identity/rejection hardening for deferred telemetry conversion is a lower-priority candidate and requires a reproducing reconnect/deferred-conversion failure before promotion.
