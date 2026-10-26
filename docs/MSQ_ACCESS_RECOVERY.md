# MSQ access recovery without VE invalidation

Baseline: `4042bfde2e64397295c82af02586130dbcd131df`. This correction is separate from the reported MLG short-read investigation. No MLG parsing or analysis algorithms are changed.

## Defect and evidence

Save previously reported “Reopen the MSQ through a supported file-handle picker to overwrite it” whenever the accepted document lacked `requestPermission` or `createWritable`. Loading through the fallback file input produces exactly that state. Normal reopening invokes replacement tune acceptance, which correctly invalidates dependent VE analysis but is inappropriate for recovering missing file access.

The production Load MSQ button uses a native picker only in a secure context with `showOpenFilePicker` available. Otherwise it uses the read-only file input. The user's existing report does not record those API properties, so it cannot prove which browser capability caused the fallback. We reproduced missing-API and read-only import states in Chromium; we do not claim to reproduce the user's exact Brave configuration.

## Corrected flow

- In a capable browser, a read-only accepted MSQ exposes **Enable saving to this MSQ**. The existing loader owns this access-only operation.
- The explicit button invokes the picker directly under user activation. The selected handle must support overwrite; its size and every byte must match the retained accepted original. Filename alone is never trusted. A byte-identical file under a different name can be deliberately selected; its selected native handle becomes the save destination.
- Attachment retains model, byte buffer, text, generation and all numerical entry identities. It does not parse again, invoke tune acceptance, call `setTuneModel`, advance VE generation, run analysis, rebuild tables or alter the active log. The shell updates only the save document reference and file-access tooltip.
- The existing Save transaction still requests write permission on Save, checks current disk bytes and performs staging/readback validation. Attachment itself neither requests write permission nor writes anything.
- Cancellation, read denial, incapable handles and mismatched bytes retain the current analysis and edits. A mismatch offers retry without silently replacing the tune or attaching access to different contents. Explicit reload remains the path for intentional source replacement.
- Replacement loads, newer chooser requests and disposal reject obsolete attachment completions using the loader's existing generations. Duplicate access requests are ignored while one is pending.
- Unsupported API and insecure-context states have distinct explanations. The UI does not recommend a futile reopen when the browser cannot supply a native handle. It does not invent an overwrite fallback or download a copy.

No event listeners on window/document, observers, analysis lifecycle wrappers or instrumentation were introduced. Existing Save/reload behavior and immutable original tune ownership remain in place.

## Browser acceptance

In Brave on localhost, load the matching INI and MSQ. If the native picker is unavailable, the status now explicitly says so; application code cannot grant a browser API that the browser does not expose. Browser configuration/policy must then be checked separately, or use a browser session exposing native file access.

For a read-only import in a capable session, finish any cell editing, select **Enable saving to this MSQ**, and select the unchanged loaded file. Completed analysis, working VE edits, pins, working delay and Undo history must remain. Then use Save MSQ and approve native write permission. Intentional MSQ replacement still resets affected analysis.

Automated validation uses memory-backed picker handles, real workers, and disposable native OPFS files. It never overwrites the supplied user files. Actual Brave desktop picker permissions and TunerStudio reopening still require manual acceptance. The pre-existing final external-write race remains: the browser API cannot lock out a desktop TunerStudio write between final verification and commit.

Validation results and exact local commit are recorded in `/workspace/epicscope-msq-access-fix/`. Stop before investigating MLG loading. No main merge or deployment change is included.

## Validation results

- Typecheck and production build: passed; existing large-chunk build warning retained.
- Full units: 999 tests /141 files passed with `npm test -- --maxWorkers=2`. Initial default-worker run hit the existing 5-second timeout in the 320k Fueling test (998 others passed). No assertions or timeouts changed.
- Full Chromium suite: 1,454 checks /162 groups passed, staged and fallback, exit0. The initial new fixture attempted a cell edit before analysis/editor binding completed; the fixture now awaits actual completion and binding. No application change was needed for that fixture timing issue.
- Built-production trusted native mouse/keyboard workflows: 53 checks passed, including unsupported API reason and handle attachment preserving an actual working edit/Undo availability.
- Focused browser/reference validation: 59 checks passed, including retained primary analysis/Working VE/pins/delay/DOM/Undo, original writer/readback tests and all1,024 TunerStudio reference values.

Exact SHA and artifacts: `/workspace/epicscope-msq-access-fix/STATE.json`, `HANDOFF.md`, browser/production JSON, screenshots and logs. Publish only to the existing development branch for local manual testing; main is unchanged.
