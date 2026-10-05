<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. Use the handoff plus current `main`/CI state for present-tense continuation.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Decision Log

This file records approved project/architectural decisions. A later decision may refine or supersede an earlier one; superseded decisions remain historically relevant unless explicitly removed.

## D-001 — Product name
**Status:** Approved

Formal/outward-facing name: **EpicEFI – EpicScope**. Compact name: **EpicScope**. Product concept: *scope a tune*.

## D-002 — Platform development order
**Status:** Approved

1. Web functional reference
2. Linux production/performance implementation
3. Android / EpicHub reuse

## D-003 — Web technology direction
**Status:** Approved

Lightweight TypeScript by default. Large frontend frameworks require explicit justification.

## D-004 — Primary browser target
**Status:** Approved

Chromium-first with Brave treated as a first-class practical test browser.

## D-005 — Linux baseline
**Status:** Approved

Debian 13 Stable is the minimum authoritative Linux target unless substantial demonstrated benefit justifies raising it.

## D-006 — Performance priority
**Status:** Approved

Log-reading/analysis speed and low RAM outrank visual polish. Mature Linux target includes interactive analysis of a supported 1 GiB log on 2 GiB RAM without requiring the complete source in memory.

## D-007 — Web optimization policy
**Status:** Approved

Web validates complete product behavior first, while still prohibiting obviously wasteful architecture. Final deep native optimization belongs mainly to Linux after feature requirements mature.

## D-008 — Initial source formats
**Status:** Approved

MLG is first-class initial log format. CSV remains secondary/deferred. All formats normalize through approved internal models.

## D-009 — Normalized data authority
**Status:** Approved

Parsers normalize source data before generic analysis/presentation. UI/analyzers do not become source-format parsers.

## D-010 — Controlled file architecture
**Status:** Approved

Production code must fit approved responsibilities/locations. Silent architectural drift is prohibited.

## D-011 — Task-to-file planning
**Status:** Approved

Implementation tasks should identify ownership, dependencies, validation and completion criteria before coding.

## D-012 — Repository workflow
**Status:** Approved

`main` is authoritative. Normal work uses focused short-lived branches and PR review.

## D-013 — Versioning
**Status:** Approved

Semantic-style versioning. `0.x` covers evolving Web/architecture development; `1.0` is reserved for a mature production baseline, expected to align with Linux maturity rather than first Web availability.

## D-014 — License
**Status:** Approved

Apache License 2.0.

## D-015 — Dependency discipline
**Status:** Approved

Dependencies must justify runtime, memory, compatibility, maintenance and architectural cost.

## D-016 — Privacy model
**Status:** Approved

Local analysis is local by default. Upload/share/publish are explicit optional actions.

## D-017 — Test-data policy
**Status:** Approved

Small curated fixtures may live in-repo. Large real logs require deliberate artifact/test-data handling and must not bloat normal Git history casually.

## D-018 — Benchmark policy
**Status:** Approved

Performance benchmarks exist from early development to detect regressions. Linux claims later require representative measurement.

## D-019 — Error-handling policy
**Status:** Approved

Malformed/missing/incompatible data should degrade affected capability where possible rather than crash the whole session. Missing data must not be fabricated.

## D-020 — Feature maturity labels
**Status:** Approved

Major features/analyzers use **Experimental**, **Beta**, **Stable**. Promotion requires validation evidence.

## D-021 — Naming conventions
**Status:** Approved

Preserve useful source terminology, especially TunerStudio/MegaLogViewer names. Follow repository naming rules; generic dumping-ground modules are prohibited.

## D-022 — Compatibility policy
**Status:** Approved

Persisted/public schemas are versioned. Breaking changes require extension, migration or explicit unsupported-version behavior.

## D-023 — EpicHub UI relationship
**Status:** Approved

EpicHub Logger/Analyzer interaction is the starting reference, not the full EpicHub app architecture. EpicScope may deliberately refine it.

## D-024 — Handoff system
**Status:** Approved

A single continuously updated `docs/HANDOFF.md` is the present-tense continuation authority.

## D-025 — Project-owner architecture approval
**Status:** Approved

Architectural changes require project-owner approval; contributors/agents may propose but not self-authorize structural deviation.

## D-026 — Parser/tune ownership
**Status:** Approved

Raw MLG/CSV/INI/MSQ decoding belongs under `core/parsers/`. `core/tune/` owns normalized tune/table semantics, not raw source syntax.

## D-027 — Session and persistence ownership
**Status:** Approved

`core/session/` owns non-UI domain-session composition. `core/persistence/` owns storage-independent versioning/migration/compatibility. Platform storage stays behind adapters.

## D-028 — Untrusted input policy
**Status:** Approved

Imported files/metadata/shared artifacts are untrusted. File-provided sizes/counts/offsets/strings must be bounded before driving allocation/execution.

## D-029 — Extended local-first privacy
**Status:** Approved

Without explicit user action/consent, EpicScope must not transmit log/tune contents, filenames, derived values or analysis results to remote services/analytics.

## D-030 — Capability-driven Boost Analyzer
**Status:** Approved

Boost analysis must support different control arrangements where channels permit: single/dual solenoid, upper/lower chamber, open/closed loop. The current vehicle setup is important but not architecture-defining.

## D-031 — Current file tree is deliberately incomplete
**Status:** Approved

`FILE_ARCHITECTURE.md` defines approved known areas, not a speculative complete future tree. Linux/Android/backend/live-acquisition areas require explicit approval before introduction.

## D-032 — Domain session and workspace state are separate
**Status:** Approved

Domain `Session` is not a general UI-state container. Web/Linux/Android may have different presentation workspace representations while core session semantics remain stable.

## D-033 — EpicScope UI reference authority
**Status:** Approved; refined by D-045

`docs/UI_REFERENCE.md` is the authoritative EpicScope interpretation of `EpicHub-Tablet-Landscape-0.0.45(2).html` and current project-owner refinements.

Inherited concepts include graph/timeline/channel/range/marker/Scatter/Histogram/Table/Math/compare workflows. EpicScope does not inherit EpicHub Android implementation architecture or the broader Dashboard/Tuner/Diagnostics app shell.

Right-side controls on wide layouts, offline/imported-log initial focus, Trigger Logger deferral and performance-over-exact-reproduction remain approved.

The earlier wording that EpicScope should have no module-like switcher is refined by D-045: the EpicScope-logo dropdown is an **in-product EpicScope mode/surface switcher**, not the broader EpicHub shell.

## D-034 — WEB-BOOT Web toolchain
**Status:** Approved

npm lockfile, Vite 8.x, vanilla TypeScript 7.x, browser-native HTML/CSS/DOM, Chromium/Brave-first. No framework/chart/state/CSS library was approved by bootstrap alone.

## D-035 — GitHub-hosted Web delivery
**Status:** Approved

Project-owner testing should not require local Node/npm/clone. GitHub Actions is build/test authority; GitHub Pages is normal hosted test surface. Hosted delivery does not authorize log/tune upload.

## D-036 — Web workspace persistence v1
**Status:** Approved

Exact-log `epicscope.web-workspace` v1 persists presentation/navigation state for the matching source identity. Raw log bytes/decoded arrays are not persisted. Unsupported artifacts are rejected explicitly and user can forget saved state.

## D-037 — INI-backed channel catalog and log binding
**Status:** Approved

Normalized INI is preferred stable known runtime/output-channel context. MLG remains authoritative for samples/validity. Known-no-data and log-only states remain explicit. INI is optional for ordinary log analysis.

## D-038 — Persistent application workspace independent of exact log identity
**Status:** Approved

Reusable named workspaces/layouts/stable channel assignments persist separately from recording-specific viewport/cursor/A-B/marker/range state.

Current separate artifacts:

- `epicscope.web-workspace` v1 — exact-log navigation/annotations;
- `epicscope.web-application-workspace` v1 — reusable app workspace;
- `epicscope.web-ini-channel-catalog` v1 — normalized INI catalog.

## D-039 — MSQ is optional tune-value enrichment
**Status:** Approved

MSQ later supplies actual calibration values/tables/curves/scalars. It does not replace INI as channel-definition context or MLG as recorded-sample authority.

## D-040 — Vitest is active Web/core automated test gate
**Status:** Approved

Vitest 5.x is part of normal CI validation for parser/core/persistence/analysis logic where appropriate.

## D-041 — Web active-channel reuse may retain decoded data
**Status:** Approved

The Web path may retain fully decoded/materialized channels and use bounded persistent reuse. This is an implementation optimization, not a Linux mandate.

## D-042 — Low-spec Web scheduling is evidence-driven
**Status:** Approved

Low-spec behavior is judged by measured I/O, startup, responsiveness, decode CPU and memory pressure rather than desktop intuition alone.

## D-043 — Do not front-load arbitrary channel work into startup
**Status:** Approved; performance campaign concluded for now

The `predecode=32/64/128` strategy is rejected. Normal startup must not decode speculative arbitrary hot sets merely to reduce later selection latency.

The replacement architecture is now implemented through OPFS sidecar/native-column access and session reuse. Performance should be revisited only for measured regression/maturity work rather than continuous micro-optimization.

## D-044 — Workflow-first UI hierarchy
**Status:** Approved

The primary Logger workflow is:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

Rules:

- controls are grouped by user goal and normal sequence, not implementation ownership;
- frequently used controls may remain visible at the current stage;
- secondary/rare controls should be contextual, grouped or placed in compact overflow/menu surfaces;
- future analysis features should not each create a permanent top-level button;
- disabled placeholders for absent functionality should not consume primary UI space;
- global workspace context is **Graphs · <workspace>** while active-pane identity stays local to the graph pane;
- timeline work should group **Navigate**, **Range/Markers**, then contextual **Analyze**.

## D-045 — EpicScope logo dropdown is the in-product mode switcher
**Status:** Approved; refines D-033

The EpicScope logo dropdown in the upper-right is intentionally the mode/surface switcher, similar in concept to EpicHub's mode selection.

Current intended entries:

- Logger — active;
- Analyzer — planned;
- Histogram — planned.

Future real EpicScope surfaces may be added deliberately as capability lands.

This does **not** adopt EpicHub's broader Dashboard/Tuner/Diagnostics application shell or Android navigation architecture. The mode menu switches EpicScope analysis surfaces only.

## Superseding/refining decisions

Decisions are not silently deleted when refined. A later numbered decision should state what it changes and why. D-045 currently refines the mode-switcher interpretation inside D-033 while preserving the rest of the EpicHub-reference boundary.


### Table Generator MLV weighted-mean parity note

The MLV-style weighted-mean implementation is considered sufficiently matched for current use. On the 2026-10-02_13.27.46.mlg comparison, representative cells matched MLV values and total hit weights effectively exactly; the large RPM 1800 / TPS 0 reference cell differed by only 19 contributing hits (EpicScope about 50,767 vs MLV 50,748, roughly 0.037%) while the weighted result remained 38.53 and total hit weight differed by about 0.97. This is retained as a compatibility footnote, not an active investigation. If revisited later, examine record-validity/retry handling before changing the established weighting geometry.
