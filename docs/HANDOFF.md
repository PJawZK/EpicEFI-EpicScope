# EpicScope Handoff

## Continuation authority

Repository: `PJawZK/EpicEFI-EpicScope`

Authoritative branch: `main`

Current authoritative main baseline:

`6b048b5a77dfc2cfe0d050e1da334a92a147b591`

That merge is PR #345, the Histogram help-consistency milestone.

Hosted application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

This file is the compact present-tense continuation authority. If older current-state wording elsewhere conflicts with this handoff, current `main`, this file and current CI/test state win.

## Current project position — 2026-10-13

EpicScope Web remains the functional reference/validation implementation for Logger, Histogram and Analyzer behavior.

The large recorded-log performance campaign is complete unless a measured regression appears.

The real ECU/Pi/`ts_shim` source workflow has been validated and merged into `main`; it is not currently the active product-development focus.

The latest active product work moved from Analyzer maturity into a Histogram consistency pass. That pass is now substantially complete through PRs #339, #340, #344 and #345.

Analyzer feature expansion is deliberately paused for now. Fueling and non-knock Ignition reached sensible maturity checkpoints; other analyzers should later be brought to similar practical coverage before a broad cleanup/consolidation/optimization phase is started.

Do not automatically reopen Fueling/Ignition, restart broad Histogram redesign, or begin a new platform phase without a concrete user-visible need, measured regression, or explicit project-owner direction.

## Product/workflow invariant

The approved visible workflow remains:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

For generic Histogram analysis, the current shared sub-flow is:

> **Scope → Channels → Qualification → analysis-specific controls → evidence → Logger / Export**

Shared concepts should use shared names and semantics rather than diverging per page.

## Validated real runtime topology

```text
Mega144H7 USB CDC
      ↓
Pi Zero 2 W
      ↓
ts_shim
      ↓ LAN
EpicScope same-origin Vite proxy
      ↓
Logger / Analyzer / Histogram
```

Pi test endpoint used during validation:

`http://192.168.186.181:29002`

Firmware signature observed during the validated run:

`rusEFI master.2026.10.12.MEGA144H7.2957763282`

Local development command used on JZ-Main:

```bash
cd ~/EpicEFI-EpicScope
EPICSCOPE_SHIM_TARGET='http://192.168.186.181:29002' npm run dev:shim
```

Browser:

`http://localhost:5173/`

## Source ownership model — current authority

One Logger source family is authoritative at a time.

```text
Recorded MLG + optional INI binding
              ↕
         INI catalog only
              ↕
      ts_shim live/capture
```

Loaded INI and MSQ are independent application resources and survive source transitions.

### MLG → Shim

- **Connect Shim** while an MLG is active detaches the recorded source in-process.
- No page reload is used.
- INI, MSQ, reusable workspace, runtime errors and performance/report history remain.
- Shim's decodable schema becomes the temporary Channel Browser catalog.
- Existing stable graph assignments map onto matching raw Shim runtime IDs.

### Unload Log

**Unload Log** releases only the active recorded MLG source/binding/log-specific source ownership. It does not reset the application.

### Shim → MLG

Opening a recorded MLG makes Shim relinquish temporary catalog ownership first. The loaded INI catalog is restored, then the MLG is parsed/bound normally.

Workspace identities migrate back to canonical `ini:*` IDs.

## Stable channel identity rule

Recorded INI-bound workspaces use canonical stable IDs such as:

```text
ini:coolant
ini:intake
ini:MAPValue
ini:RPMValue
ini:TPSValue
```

Shim publishes the matching raw IDs:

```text
coolant
intake
MAPValue
RPMValue
TPSValue
```

While Shim is authoritative, stable assignments resolve to raw Shim channels. When an INI-bound MLG returns, the workspace returns to canonical `ini:*` identities.

Do not reintroduce raw + `ini:*` duplicate traces.

## Real source-validation checkpoint

The full source round trip was tested:

```text
MLG + INI
→ Connect Shim
→ live schema
→ Record / live Logger view
→ Stop Recording
→ Open MLG
→ INI catalog restored
→ MLG/INI binding restored
→ canonical workspace identities restored
```

Source-lifetime diagnostics showed replaced recorded/bound sources becoming collected; no obvious cross-source strong-reference leak was observed.

The Web implementation remains read-only with respect to ECU control. No tune writes, burns, flashing, mocks, ECU commands or CAN injection are part of this baseline.

For source/protocol details use the `TS_SHIM_*` documents in `docs/`.

## Logger — current authority

Mature behavior includes:

- MLG v1/v2 staged import, CRC/source diagnostics and large-log reuse;
- INI-backed channel catalog/binding;
- optional MSQ tune enrichment;
- reusable named graph workspaces plus exact-log navigation persistence;
- fixed/freeform multi-pane Logger;
- A/B ranges, markers and saved ranges;
- stable channel identity across recorded and Shim source transitions;
- explicit unavailable-channel handling;
- retained-memory, parser, performance and runtime-health diagnostics.

The long-used 1.19 GB / 320,458-record MLG remains the main large-log stress/reference file.

Do not resume broad Logger/performance micro-optimization without a concrete measured problem.

## Analyzer — current checkpoint

Analyzer work is deliberately paused after a substantial maturity pass.

Current surfaces remain:

- Range Compare;
- Tune Table;
- Boost;
- Idle;
- AE / MAP Predict;
- Fueling;
- Ignition;
- Fuel / Injector;
- Trigger / Sync.

### Shared Analyzer presentation/interaction

Current conventions include:

- Full Log / Current A/B / Saved Range scopes;
- shared Qualification where appropriate;
- evidence navigation back to Logger;
- progressive disclosure: a small decision-facing default summary with secondary diagnostics behind **More details**;
- sortable evidence tables where useful;
- one standardized anchored round-`i` help interaction;
- aligned-evidence canvases render at real displayed size and respond to layout resize rather than relying on CSS stretching;
- avoid dense all-signals/all-envelopes defaults; optional context can be enabled deliberately.

### Fueling checkpoint

Fueling is mature enough to freeze unless a concrete defect appears.

Current important behavior includes:

- lambda-first actual/target semantics (`lambdaValue` / `targetLambda`);
- Gas Scale AFR before generic AFR as fallback;
- `veValue` as current live effective VE, distinct from the VE table and `Fuel: Tuned VE`;
- `actualLastInjection` as preferred command signal for observed mixture-response delay;
- `veTableYAxis` as preferred VE/load coordinate;
- DFCO and other fuel cuts explicitly identified/excluded from ordinary steady calibration conclusions;
- AE/decel transient context separated from steady evidence;
- rolling/trailing-window stability rather than brittle adjacent-sample derivatives;
- low-count bins remain visible as Weak/Moderate/Strong evidence instead of disappearing;
- scale-aware Lambda/AFR thresholds;
- STFT/LTFT/total-correction context;
- observed mixture-response-delay analysis;
- compact/progressive UI and Logger evidence navigation.

A Fueling heatmap experiment was rolled back after it caused page-load/graph-resize regressions. Do not reintroduce a DOM-heavy overview implementation without a safer architecture and measured validation.

See `docs/FUELING_ANALYZER.md` for the detailed authoritative Fueling semantics.

### Ignition checkpoint — non-knock scope

Current Ignition work intentionally avoids knock diagnosis because the current validation path does not include trusted knock hardware/evidence.

Current non-knock behavior includes:

- final ignition advance as the primary required signal;
- optional aggregate correction/retard, dwell, RPM and ignition-load context;
- large timing-step and correction-activity event evidence;
- large-log-safe statistics/event presentation;
- clean default aligned evidence (decision-facing traces only, percentile envelopes/context opt-in);
- ranked **Areas to review** built from repeated stable RPM/load regions;
- configurable normal-running review focus (default minimum 1000 rpm) so cranking/start/very-low-RPM regions do not dominate the shortlist;
- optional MSQ base-ignition-table comparison using the actual ignition table axes;
- **Source clue** attribution that distinguishes behavior substantially explained by the base table, overlapping correction activity, residual/unexplained timing movement, or insufficient evidence.

Preferred EpicEFI automatic roles now prioritize canonical channels such as:

- `correctedIgnitionAdvance` for final timing;
- `ignitionAdvanceCorrections` / `ignitionCorrections` for aggregate correction context;
- `sparkDwell` for dwell;
- `RPMValue` for RPM;
- `loadForIgnitionTableDot` / `ignitionLoad` before generic MAP for ignition-table load.

Ignition remains observational. It does not claim knock/detonation, declare timing safe/unsafe, or recommend adding/removing a specific number of degrees from log evidence alone.

## Histogram — current authoritative checkpoint

Histogram coherence is substantially improved and is the latest completed product track.

Current surfaces:

- Table Generator;
- Distribution;
- Scatter;
- Math Channels.

Four milestones are confirmed on current `main`:

### PR #339 — Scope/evidence flow

- Full Log / Current A/B / Saved Range consistency;
- shared Logger timeline including Table Generator;
- Distribution correctness fixes for comparison geometry and Time gaps;
- Scatter Full Log/A-B/Saved Range support;
- full-qualified-data density with bounded visible rendering;
- line-gap handling;
- rendered Scatter point → Logger evidence navigation;
- redundant manual Refresh controls removed from auto-updating flows.

### PR #340 — Shared Qualification

- the same saved grouped ALL/ANY Qualification sets work in Table Generator, Distribution and Scatter;
- Qualification is applied before Distribution/Scatter analysis;
- eligible/input provenance remains visible;
- missing dependencies remain explicit rather than silently changing filter meaning.

### PR #344 — Shared Math Channels

- saved Math Channels are first-class inputs in Distribution and Scatter as well as Table Generator;
- calculated traces retain source alignment;
- Qualification may use Math Channels;
- the old compact Table Generator formula editor remains internally dormant/hidden and is deferred to cleanup.

### PR #345 — Unified help

- Histogram now uses the shared Analyzer-style anchored round-`i` information popup;
- Distribution/Scatter gained focused explanations for non-obvious calculations;
- Table Generator's bespoke help surface is no longer the visible path;
- help density remains intentionally restrained.

Detailed current Histogram behavior and remaining work are documented in `docs/HISTOGRAM.md`.

### Histogram remaining useful work

The broad coherence pass is complete. Remaining worthwhile functionality is narrower:

1. saved setups/presets for Distribution and Scatter;
2. exports for Distribution and Scatter;
3. richer Scatter region selection rather than only individual points;
4. eventually replace the remaining Scatter timeline text/DOM bridge with direct shared state propagation;
5. later remove dormant duplicate/runtime-refinement code during the planned cleanup phase.

Do not restart a broad Histogram rewrite.

## Cleanup/consolidation policy

A dedicated cleanup/optimization phase is intentionally deferred until analyzer coverage is broader.

When that phase begins, it should explicitly review:

- dormant/duplicate editor paths;
- analyzer-local/shared DOM enhancement code;
- unnecessary MutationObservers;
- direct DOM state bridges/lookups that should become explicit state/contracts;
- Boost-specific utilities that have become generic;
- duplicate table/event/help/rendering logic;
- canvas resize ownership;
- CSS duplication and runtime UI surgery;
- dead/unreachable branches and compatibility leftovers;
- large-log performance after consolidation.

Until then, do not destabilize mature paths solely to make code prettier.

## Current Git / workflow state

Current authoritative `main`:

`6b048b5a77dfc2cfe0d050e1da334a92a147b591`

Recent merged milestones relevant to this handoff:

- #338 — Ignition base-table/source attribution;
- #339 — Histogram scope/evidence flow;
- #340 — shared Histogram Qualification;
- #341 — validated `ts_shim` live/recorded source workflow promoted to `main`;
- #344 — shared Histogram Math Channels;
- #345 — unified Histogram help.

Post-merge type-check, full tests, production build and GitHub Pages deployment are green at the current Histogram baseline.

PR #342 (Shim HTTP fetch binding) and draft PR #343 (General · Single pre-populated workspace) are not part of the current `main` baseline unless they are later merged/reconciled.

If continuing from a local clone:

```bash
cd ~/EpicEFI-EpicScope
git switch main
git pull
npm run typecheck
npm test
```

Continue from current `main`, not an older Analyzer/Histogram feature branch.