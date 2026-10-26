# Follow-up Group 5 — Discover lambda delays without opening the table

Baseline: Group 4 `369be13b08902dab74a43d79702cb940607a5399`. No main merge, push, deployment change or Group 6 implementation.

## Reproduction and correction

The outer Grab button explicitly clicked the Lambda tool opener before invoking the existing discovery button. The new browser regression failed in both staged and fallback modes because discovery opened the table. Removing that opener call leaves discovery at its existing v2 owner; the explicit Delay chip/tool action still opens the table. An already-open table stays open.

The discovery owner now publishes deduplicated, typed presentation feedback for pending, error, successful recommendation and insufficient-evidence states. The run strip consumes that root-local event through its existing abort-controlled lifecycle and displays an inline status outside the closed tool. It does not infer analytical state from DOM text or compute evidence. Pending feedback disables repeat outer requests; failure enables retry. Existing generation guards reject obsolete completions; inactivity clears pending presentation. No global listener, observer, new persistence owner or analytical pass was introduced.

Inside-table messages retain their existing content. Initial discovery still produces a separate recommendation requiring explicit Use. A successful re-grab with a working table keeps the existing activation/replacement behavior; failures or insufficient evidence preserve working edits. This group does not change those policies, numerical calculations, delay interpolation, analysis scope or original tune data. It does not run VE analysis automatically.

## Validation scope

Seven new browser cases exercise successful replacement, source failure, missing traces, no usable transitions, tune replacement, navigation cancellation and initial recommendation/explicit activation/table opening. The existing six-case delay workflow suite also passes in both modes. Held trace promises verify pending feedback, one source request and stale-completion rejection without production instrumentation.

Full gate results, built-production native-input smoke, screenshots and exact local commit are recorded in `/workspace/epicscope-v50-followup-group5/`. The original 1.2 GB recording and its hardware are unavailable; no large-recording timing or synchronous-calculation improvement is claimed. The existing discovery calculation is unchanged.

Final gates: build/typecheck passed; 956 unit tests in 138 files passed; 1,390 Chromium checks in 154 result groups passed (695 per mode). All 26 built-production smoke checks passed, including native Grab, closed-tool feedback and explicit table opening, plus prior interpolation, pins, timeline, scoped analysis and navigation checks. The production navigation fixture correctly reports insufficient delay evidence; controlled component fixtures verify successful discovery/replacement separately. Existing bundle-size warning remains. No test was skipped or timeout relaxed.
