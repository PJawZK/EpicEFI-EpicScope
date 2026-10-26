# Group 10 — Final validation and manual acceptance

Date: 2026-10-22. Runtime under review: `8ba0c7a45d18346e111b84f0d14066c3fefd887e` (Group 9). Published and verified on `fix/ve-v50-recovered-through-group-7c-20261022`. No merge to `main`; the independent documentation history on the original development branch is preserved.

This checkpoint validates the reviewed Groups 1–9 implementation. It introduces no application behavior, analytical policy, global listeners, observers or lifecycle wrappers. Automated results and human acceptance are separate. Human acceptance is **pending**.

## Reproducible evidence

Evidence directory: `/workspace/epicscope-v50-group10-final-validation/`. `REPORT.md` records final command outcomes; `browser/summary.json` is authoritative for the complete Chromium gate. `production-summary.json` separately records a smoke test served from the built, hashed production bundle rather than Vite source modules. The external smoke runner and screenshots are retained in that directory.

Commands, run sequentially to avoid competing browser/CPU workloads:

```sh
npm run build
npm test -- --maxWorkers=2
CHROME_NO_SANDBOX=1 BROWSER_RESULTS_DIR=/workspace/epicscope-v50-group10-final-validation/browser npm run test:browser
node /workspace/epicscope-v50-group10-final-validation/production-smoke.mjs
git diff --check
```

Toolchain: Node v24.19.0, Chromium 154.0.8037.57, TypeScript 7.0.2, Vite 8.3.1, Vitest 5.0.3. Browser runs use Linux headless Chromium at 1024/1366/1920 CSS-pixel widths and dedicated DPR 1/1.25/1.5/2 raster checks. These are not a cross-browser or original-hardware certification.

Final results: production build/typecheck passed (existing bundle-size advisory); 929 unit tests across 138 files passed; 1,136 Chromium checks across 142 result groups passed (568 checks per mode); all 14 production-bundle smoke checks passed (7 per mode), with no uncaught browser exceptions. All eight heatmap raster cases had zero dark edges among 480 sampled interior edges each. Production and full-suite screenshots are retained; the production staged screenshot was visually inspected. `git diff --check` passed. No application or test-source changes were necessary for this checkpoint; the only repository change is this acceptance record.

## Acceptance coverage and boundaries

All named JSON files below exist separately with `staged-` and `fallback-` prefixes in the full browser run. Fallback disables `Worker`; native file-input tests use the repository's small binary/text fixtures. Controller fixtures exercise real production controllers in Chromium but are not independent end-user sessions.

| Workflow / contract | Automated evidence | Still requires manual acceptance |
|---|---|---|
| INI, MSQ, MLG load and accepted-input publication | Native shell imports; `ini-table-authority`, `replacement-result`, `publication-result`, `source-integrity-*` | Original INI/MSQ/approximately 1.2 GB MLG, actual hardware and actionable real-data errors |
| Logger navigation, persistence and workspace restore | `storage-startup`, `local-persistence`, crash/normal recovery, publication tests | User's saved workspace, channel count and long recording |
| Analyzer domain routing, inactive work and obsolete completions | `activity-result`, `lifecycle-result`, `context-result`; production smoke enters all offered domains | Actual domain output and responsiveness with the user's channels/log |
| Editing/source/proposal/delay retention | `ve-editing-retention`, `ve-authority`, `ve-history-policy`, `ve-transient-editing` | Existing user workflow and expected source/working distinctions |
| Shift-click ranges, direct numeric entry, interpolation, Brush, pins and history | `delay-edit-result`, `shared-delay-interaction-result`, `ve-proposal-interaction-result`, native pointer/Shift input | Perceived Brush smoothness, OS/browser input behavior and touch hardware |
| Numerical correctness and physical interpolation | `ve-numerical-boundaries` (50 shared reference cases plus 3 controller boundary checks), unit references | Domain-policy decisions below; no scientific calibration claim |
| Result Views and retained Cell Evidence | `ve-result-projection`, `ve-cpu-reuse`, `ve-presentation-lifetime`, `result-view` | Popup content with real evidence and expected units |
| Delay discovery, transactional replacement, activation | `ve-delay-workflow`, `ve-delay-replacement` | Real log discovery quality and instrument/sensor assumptions |
| Completion, View Proposal and keyboard focus | `ve-completion-*`, `ve-view-proposal` | Assistive technology and background-pointer modality |
| Full Log, A–B, saved Logger ranges and scope synchronization | `ve-timeline-native`, `ve-timeline-scope` | User's saved ranges and long-log timeline usability |
| Heatmap seams, precision and typography | `ve-heatmap-paint`, `ve-visual-presentation`, responsive checks and PNGs | Actual browser zoom, display scaling, visual preference and color accessibility |
| Report / Performance / Diagnostics | Diagnostics view/integrated ZIP, parser/owner/performance evidence, production Diagnostics lenses | Original-log diagnostic captures and perceived open/export latency |

## Large-log and performance interpretation

The unit/browser regressions include continuous valid synthetic arrays above 320,000 samples, exact numerical references, cached analysis progress, retained primary/evidence reuse and stale-completion rejection. They establish tested correctness and ownership contracts. They do **not** establish the loading duration, peak memory or responsiveness of the unavailable original file. Small native MLG imports cover actual file/decode paths; synthetic cached trace tests cover subsequent CPU work. Their timings must not be presented as equivalent.

The production smoke checks packaged asset bootstrap, native fixture imports, all Analyzer domain entries, a completed VE analysis, completion reopen, Logger/Histogram/Analyzer round trip and Diagnostics lenses in both modes. The deeper controller/numerical/interaction suite runs through Vite; it is not silently relabeled as a full production-bundle interaction suite.

## Numerical reference and policy ledger

See [numerical audit](VE_V50_NUMERICAL_AUDIT.md), [corrected reference cases](VE_V50_GROUP4_CORRECTIONS.md) and `tests/fixtures/ve-numerical-references.ts`. All seven former expected failures became passing regressions in Group 4; the current shared ledger has 50 ordinary references. The older audit's expected-failure counts are historical, not current exceptions.

Examples: an exact known 200 ms sparse delay node returns 200 ms; unavailable delay refinement contributes no fabricated sample; independently indexed traces retain two expected contributions; malformed/non-increasing analytical axes are rejected without normalizing the original tune. Same-scale mixture direction, known trim compensation, weighted inverse-CDF statistics, physical-coordinate interpolation and pin/Brush transactions retain the documented formulas.

Unresolved policies remain explicit: engine-event versus observation-time exclusions/recovery (B02); OLS stability despite cancelling excursions and long valid timestamp gaps (R28/R29); one delay refinement rather than fixed-point iteration. Raw-limit-before-prior ordering, quantile conventions, post-blend clamp and same-displayed-millisecond delay snapping remain deliberate current behavior. This final validation does not approve or silently change those policies.

## Frozen-reference parity boundaries

The reference retrieved from documentation commit `4e6caf816ee2e723ddec5a2f88f5292d092d0d29` is recorded in Group 8 with SHA-256 `4a1d91bdd45fefab6e7f2e7a671a7e51d4d8e50df43dd53233962f78d5d3e4bc`. Equivalence to the separately named historical attachment has not been independently established. Prototype demo Visible ranges, density or evidence are not fabricated in production. Logger owns real scope; TypeScript owns analytical values. Group 9's paint-only seam coverage retains native table geometry rather than copying a new layout authority.

The completion summary remains a section-based custom dialog. Native keyboard wrapping and opener restoration are covered; a native modal top layer, page-wide inert behavior and background-pointer blocking are not implemented. Review assistive-technology/pointer expectations before accepting it as fully modal.

## Manual acceptance — stop here before release

Record commit SHA, browser/version, OS, CPU, RAM, display scaling, file size/record count, workspace and chosen scope. Use a fresh session and then a restored-workspace session. Keep the original tune available for comparison. Do not write or Burn to an ECU.

1. Load the actual INI, MSQ and large MLG. Record file-pick-to-ready duration separately from later cached analysis. Note freezes, visible progress, memory and errors; export existing Report/Perf/Diagnostics before and after the workflow.
2. Restore the workspace and visit Logger → Analyzer (each domain) → Histogram → Logger. Check scope/channel retention and any pause. Open VE, run Full Log analysis and confirm the summary agrees with the real selected inputs.
3. In Lambda Delay, Shift-click a rectangle, type without F2 and confirm live preview, one commit, Undo/Redo, Delete versus Revert and retained values after navigation. Repeat applicable operations on working VE review while confirming source tune remains unchanged.
4. Hold/sweep Brush, reverse with Shift, adjust radius, skip pins and cancel a stroke. Judge live preview and input responsiveness; one completed stroke must remain one undo transaction.
5. Open several Cell Evidence cells and switch every Result View repeatedly. Confirm source/generated/review values stay distinct, displayed units/precision make sense and evidence does not require another full analysis.
6. Select real A–B/saved ranges from Logger and VE, edit/remove a saved range, return between views, then rerun explicitly. Check colors, synchronized real bounds, retained working delay and retirement of obsolete results.
7. Load a valid replacement tune/delay and reject an invalid replacement. Confirm accepted state survives failure and stale overlapping completions cannot replace the latest accepted session. Test cancellation while analysis is active.
8. Open Report/Performance/Diagnostics and export the existing diagnostics bundle. Check keyboard focus, completion Close/reopen/View Proposal, responsive layouts and heatmaps at the user's actual browser zoom. Record accessibility/pointer limitations explicitly.

For each item record pass/fail, reproduction steps and an artifact. A perceived pause without a matching diagnostic timing is still a valid observation. Approval is manual; no release/main merge is authorized by passing automated tests.
