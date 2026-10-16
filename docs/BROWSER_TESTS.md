# Browser acceptance

From the repository root, with the locked npm dependencies installed and a local Chromium or Chrome executable:

```sh
npm ci
CHROME_BIN=chromium npm run test:browser
```

`CHROME_BIN` defaults to `chromium`; use an executable name on PATH or an absolute path. No browser download or extra npm dependency is required. On a trusted container/CI runner that cannot use Chrome's sandbox, explicitly set `CHROME_NO_SANDBOX=1`. Ordinary desktop runs should retain the sandbox. Node must meet package.json's engine requirement. The npm command enables Node's built-in WebSocket transport explicitly for the supported Node 20 line; it also works on Node 22/24 without another transport dependency.

The command starts its own loopback Vite server and headless Chrome on dynamically allocated ports. It creates a temporary Chrome profile, uses separate incognito contexts for staged and forced Worker-disabled fallback imports, and closes its contexts, Chrome and Vite before removing the profile. It does not connect to an existing browser or application server. Ctrl-C and SIGTERM follow the same cleanup path. Each run has a ten-minute deadline, with bounded DevTools and readiness waits.

The selected suite runs **128 checks per configuration, 256 total**:

| Coverage | Checks per configuration |
| --- | ---: |
| Math preview metadata edits, debounce, cancellation and 320459-sample limit | 8 |
| Histogram shared formula paths, historical references, navigation and preview races | 8 |
| Transactional MSQ replacement, failures and overlapping reads | 17 |
| Accepted input publication, navigation and Histogram tune delivery | 15 |
| VE lifecycle, retained state, real invalidation and stale completions | 26 |
| Source-bound Logger context snapshots and loaders | 12 |
| Analyzer activity routing and obsolete completion rejection | 25 |
| Batched delay editing, inline preview, provenance and render counts | 15 |
| Full controller-stack Result View values and heat policy | 1 |
| Native CDP mouse drag, pointer capture and keyboard range edit | 1 |

Before the full-shell sequence, Math preview checks cover metadata-only edits/saves, coalesced typing/helper edits, immediate stale-load rejection, reset/hide/entry, and a 320459-sample input whose preview is capped at 10000 anchor samples while full logical analysis remains unbounded. A component Histogram workspace checks saved historical formulas in Table Generator, Math preview, Distribution and Scatter, including deduplicated dependencies, scoped coverage, missing-data recovery and stale preview rejection. The full-shell sequence loads INI, MSQ, MLG and a delay table through real file inputs, then enters VE and runs analysis before the replacement/navigation checks. Component fixtures exercise additional races and lifecycle transitions. No production instrumentation or application event listeners are installed by the runner.

The fixtures in `tests/fixtures/browser/` are the small synthetic fixtures from the earlier browser acceptance work. They contain generated channel data, a uniform 16×16 VE/AFR tune, and a uniform 100-ms delay table; they are not an owner's tune or recording. This suite is a correctness safety net, not a 1.2-GB log benchmark, original-recording acceptance, or exhaustive coverage of every browser module. Other `.browser.mjs` modules are not implicitly included. Vitest remains a separate command.

The Result View check follows the accepted policy: source-authoritative VE fallback values; original base heat in Proposed VE; neutral `0.5` heat for alternate views without the selected metric; interpolated delay values in Lambda Delay. The assertion correction changes no production presentation behavior.

Results go to ignored `artifacts/browser/` (override with `BROWSER_RESULTS_DIR`). The runner replaces its own prior result files there. `summary.json` records success/failure and completed checks; per-suite JSON preserves named assertions and measurements. On browser failure it also attempts a screenshot and visible page snapshot. `chrome.log` captures startup/Chrome diagnostics. A missing executable, failed assertion, empty/malformed result, unhandled browser exception, timeout or interruption produces a nonzero exit; partial successes remain marked as a failed run. CI runs this command in the separate Web CI browser job and uploads the results even on failure.

Run CPU-heavy Vitest large-sample regressions separately from local browser/build work to avoid resource-contention timeouts. Passing this suite does not replace manual acceptance on representative logs and hardware.
