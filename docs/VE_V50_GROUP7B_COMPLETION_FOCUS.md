# Group 7B — Completion dialog keyboard focus

Scope: keyboard traversal and focus restoration in the existing run-strip dialog owner. Group 7C summary/operation feedback remains separate. No main merge or ECU write.

## Finding and correction

The dialog focused its Close icon on open but did not wrap Tab at the last action or Shift-Tab at the first. Its dismiss helper only hid the section and did not restore the opener. A real-Chromium boundary-key regression failed before correction in both worker modes (`/workspace/epicscope-v50-next-group7b-validation/reproduction.json`). Pre-change evidence uses dispatched keyboard events; native Chromium input is separately verified after correction.

The existing dialog key handler now wraps only the first/last action boundaries; the browser retains normal interior traversal. Escape dismisses locally and stops propagation. The owner retains the opener only while a summary is open and restores it on Close, Escape or View Proposal if focus still belonged to the dialog. A missing, disabled or invisible opener falls back to visible Run. Inactive/disposed owners do not restore focus into their controls. Reopening records the new opener.

No additional global listener, observer, focus-trap framework, lifecycle wrapper, analysis state or numerical authority. The existing three dialog actions remain unchanged. Group 7A table navigation is preserved.

## Validation coverage

- Four controller cases per mode: Tab boundary wrapping, Escape/Run restoration, all dismissal actions/Summary restoration, inactive-view dismissal with retained authority.
- Three native CDP cases per mode: four forward Tabs, four reverse Tabs and Escape/Run restoration. These use Chromium Input.dispatchKeyEvent, not synthetic events as a substitute for native traversal.
- Native checks are registered in full acceptance through `scripts/browser/ve-completion-focus.mjs`; fixture checks live in `tests/web/ve-completion-focus.browser.mjs`.
- Native/focused artifacts: `/workspace/epicscope-v50-next-group7b-validation/focused-results.json`.

Initial production typecheck caught a nullable optional Run button in the focus helper. Its input type was corrected to include null; initial evidence is retained in build-initial.log. No assertion, timeout or test expectation was relaxed.

## Limits / acceptance

Manual keyboard/accessibility acceptance remains required. This preserves the existing section-based dialog and adds keyboard containment; it does not introduce native-modal top-layer behavior, page-wide inertness or background pointer blocking. Native OS dialogs, assistive technology, user hardware, frozen v50 HTML and the original approximately 1.2 GB MLG were unavailable. No broad modality, visual parity or large-log timing claim.

Manual check: run analysis, cycle Tab/Shift-Tab, press Escape and confirm Run focus; reopen with Summary and dismiss each way, confirming Summary focus. Navigation away must not send focus back into VE.

Stop after validation/local commit. Group 7C has not started; do not push or merge.

## Final results

Production build/typecheck passed after the nullable helper correction. All 917 unit tests /136 files passed. Full real Chromium acceptance passed: 1,084 checks /132 result groups, 542 per mode. Four controller and three native keyboard checks per mode are included in that total. Focused runs also passed those cases; do not add them as unique full checks. `git diff --check` passed. No browser/unit failure, skipped case or assertion/timeout relaxation. Full logs and results are retained in the validation directory above.
