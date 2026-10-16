# Source-integrity integration acceptance

Target 7 closes the reproducible cloud checks. Original-recording and affected-hardware acceptance remains a separate open gate until run. No production code is changed by target 7.

## Reproducible cloud checks

From the repository root with locked dependencies and Chromium installed:

```sh
npm test -- --maxWorkers=1
npm run build
CHROME_NO_SANDBOX=1 BROWSER_RESULTS_DIR=/tmp/epicscope-acceptance/browser-results npm run test:browser
```

The browser runner exercises both staged-worker and Worker-disabled fallback imports. Preserve its summary, per-module results, native downloaded ZIPs and screenshots. Intentional synthetic runtime-error/recovery messages are fixture evidence; the runner separately rejects unexpected browser exceptions. CI alone does not replace browser execution.

Coverage includes actual INI/MSQ/MLG inputs, input replacement, workspace/source restoration, active/hidden Analyzer routing, VE retained-primary evidence, delay editing, Result Views, Histogram publication/formulas, Parser/Perf/Diagnostics, native ZIP download/cancellation and IndexedDB/renderer recovery. Some Analyzer lifecycle cases are controller/component browser tests rather than manual end-to-end entry into every domain.

Scale checks use synthetic arrays above 320k records for retry continuity, sparse annotation, marker selection, dense invalid spans and prepared graph activation. Those tests verify computation and deterministic access budgets; they do not reproduce 1.2 GB file I/O or original data patterns.

The final shell gate imports a small real binary MLG containing recovered and unrecovered CRC records, exports Diagnostics through native browser download, verifies source-time/continuity metadata, then imports a clean replacement and exports again to reject obsolete CRC findings. It retains all earlier acceptance assertions.

## Original recording and affected computer: pending

Use the computer/browser where pauses occurred, the original approximately 1.2 GB MLG and matching INI/MSQ. Record CPU, RAM, OS, browser/version, hardware acceleration, file storage type and available memory. Record the tested commit. Cloud hardware is not a substitute.

For a controlled comparison, use integrated baseline `663e7d5` and implementation candidate `1d943d9` with identical files/browser settings. The baseline includes both feature sets before targets 2–6. Preserve baseline freezes/errors as findings rather than assuming both builds complete.

1. Load INI and MSQ, then the MLG. Record time to usable Logger and time to completed CRC validation separately. Confirm source identity, record count, diagnostics and validity.
2. Restore the saved Logger workspace. Zoom/pan with the same channels; inspect recovered retries and genuine gaps at high zoom. Open marker explanations, click inside/outside, change workspace, and replace/unload the source.
3. Navigate Logger → Analyzer → Histogram and back. Enter each Analyzer domain. In VE, set the same scope/qualification/delay, run analysis, open multiple evidence cells, change Result Views and navigate away/back. Confirm retained delay/result/proposal and correct invalidation on real source/tune/scope changes.
4. Repeat already-loaded navigation and evidence opening without selecting the MLG again. Record these cached-data CPU/render costs separately from physical reads/decode. Use Perf/Diagnostics counters to distinguish them.
5. Open Parser, Perf and Diagnostics; switch every Diagnostics view and download a bundle. Check that marker source times/semantics match exported findings and replacement removes old findings.
6. Repeat navigation/popups/restoration several times. Observe memory after operations settle. Full recording retention is intentional; retained source/cache memory alone is not a leak. Look for unbounded growth tied to repeated lifecycle operations.

Capture browser Performance recordings for the actions that pause, including main-thread task durations and stacks, plus an unprofiled observation of responsiveness because recording adds overhead. Preserve Diagnostics ZIPs, screenshots, exact action order and whether each run was cold or cached. Do not add generic global instrumentation.

Acceptance requires correct results/state and no unexplained browser exceptions or obsolete completions. Compare pauses with the baseline; no target-machine latency/heap or freeze-elimination claim is established until these measurements exist.

Dense visible-marker drawing still scales with visible markers × traces. Explicit full Parser capture/JSON encoding remains synchronous. Profile those residual costs before further caching, workers or batching. Whole-browser/OS crash durability, real BFCache eligibility and live ECU/network stress are separate unrun scenarios.
