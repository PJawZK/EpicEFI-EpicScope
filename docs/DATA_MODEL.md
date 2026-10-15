<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. `docs/DOCUMENTATION_MAP.md` defines document authority.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Data Model

## Purpose

EpicScope normalizes source data so parsers, analyzers, UI and future Linux/Android implementations share stable semantics without coupling product behavior to one file format or browser representation.

## Core ownership concepts

### Domain Session

A domain **Session** composes analysis context such as sources, channel/tune context, events, results, annotations and comparisons.

It does **not** own general presentation layout/workspace state.

### Application workspace state

Reusable presentation state may exist without a log and includes named graph workspaces, pane/layout geometry, stable channel assignments, favorites/display preferences and other user-owned UI configuration.

Starter-template provenance may be retained for compatibility/history, but a materialized workspace is ordinary user data; template logic has no continuing ownership.

### Log-specific view state

Recording-specific state includes viewport/cursor, A/B boundaries, markers/saved ranges and source-specific navigation/filter context.

Application workspace and exact-log view state remain separate persistence concerns.

## Source model

### Log/source authority

Only one Logger sample source family is authoritative at a time:

```text
Recorded MLG + optional INI binding
              ↕
         INI catalog only
              ↕
      ts_shim live/capture
```

Loaded INI/MSQ are independent application resources and survive source transitions.

### LogSource

A normalized source retains stable internal identity, display/source name, format, size/metadata/provenance, time coverage, diagnostics, channel references and validity/completeness state.

### ChannelDefinition

A channel definition retains:

- stable identity;
- exact source/original name;
- display metadata;
- unit/type/category/precision;
- provenance;
- availability/validity metadata;
- aliases/semantic-role hints where appropriate.

**Literal source identity is presentation authority.** Semantic resolution may provide a task-oriented label or mapping but must not erase/rename the original INI/MSQ/log channel/table name.

### ChannelCatalog

Catalog entries distinguish at least:

- known + data;
- known, no data;
- log-only/current-source-only.

INI provides stable known runtime/output context. Shim schema becomes temporary live catalog authority while Shim owns Logger.

### ChannelBinding

Bindings connect logical/catalog identities to source-local data without copying sample arrays. Recorded `ini:*` identities may map to matching raw Shim IDs during live-source ownership, then normalize back when recorded/INI authority returns.

### ChannelData / NumericChannelRange

Channel data is time-associated numeric/state data with explicit validity/coverage. Efficient implementations may provide bounded partial ranges or complete resident ranges without changing logical channel identity.

Consumers must not infer missing values from portions that were simply not loaded/materialized.

## Semantic roles and capabilities

A semantic role expresses product meaning independently of vendor/source naming:

```text
semantic role
      ↓
logical ECU channel
      ↓
current source identity
```

Resolution preference:

1. explicit user/schema override;
2. exact native/known alias;
3. ECU-family/cross-ECU alias;
4. conservative normalized-name fallback;
5. unresolved.

Compatibility aliases are matching input, not display-name authority. Missing roles remain explicit and do not fabricate data.

## StarterWorkspaceTemplate

A starter template contains stable template identity, name/category, layout, pane definitions, semantic role slots, requirement levels and optional capability gating.

Role requirements:

- required;
- preferred;
- optional.

Materialization resolves roles once and creates an ordinary workspace with concrete channel assignments. Reusing the template creates another workspace. Existing user workspaces are not rewritten when templates change.

Historical `built-in:*` IDs are compatibility data only and confer no protected semantics.

## Timebase

Time is first-class. The model must support monotonic navigation, source timestamps, irregular spacing, gaps/missing samples, event/range alignment and timestamp-based analysis.

Fixed sample rate must never be assumed unless guaranteed by the source.

## TuneContext

Tune context may include firmware/INI identity, MSQ identity, tables/axes/scalars/curves, channel/table relationships and compatibility metadata.

Responsibilities remain distinct:

- MLG/Shim — measured sample authority;
- INI — channel/firmware/table metadata and stable logical identities;
- MSQ — actual tune/calibration values.

### TuneTable

A normalized tune table exposes identity/name, X/Y axes, values, units, source references, lookup/interpolation metadata where known and validation state.

Analysis can therefore correlate samples with tune geometry without UI parsing raw MSQ/INI syntax.

## Derived channels

A derived channel retains formula/function identity, dependencies, unit, validity/provenance and persistence/version metadata where saved. Derived values should use the same normalized query/validity model where practical.

## Events

An event is a bounded occurrence with type, source/time bounds, optional peak/reference time, quality/confidence, evidence/metrics and detector identity.

Events are reusable by navigation, analyzers, comparison and reporting.

## Analyzer results

An `AnalyzerResult` is structured evidence, not rendered DOM.

It should retain:

- source/session/tune identity;
- analysis request/configuration/qualification;
- accepted/excluded evidence and provenance;
- calculated metrics/findings;
- quality/confidence/limitations;
- proposal/recommendation where applicable;
- analyzer/version identity.

Findings remain traceable to source evidence.

### VE Analyzer state separation

VE requires explicit conceptual separation between:

1. **original tune/table state** — immutable analysis input;
2. **analysis session/request state** — source/tune identity, qualification, working lambda-delay table and analysis settings;
3. **evidence/result/proposal state** — retained structured output of Run Analysis;
4. **user review/application state** — future selective edits/reverts/application-strength/export decisions.

Rendered table cells are presentation, not the long-term source of truth for these states.

The current browser implementation has known debt because lifecycle rebuilds, cell-evidence recomputation and DOM-derived working-delay reconstruction still blur this ideal. Future cleanup should expose explicit controller/session state without changing the proven user behavior.

The accepted VE delay state shape is **RPM × load table only**; scalar and RPM-curve alternatives are not current product models.

## Comparison

Comparison links sessions/logs/events/ranges/tune revisions with explicit alignment method, matched/unmatched evidence, metric deltas and quality metadata.

Current Range Compare is primarily cohort/range comparison inside the active source; true independent multi-log comparison remains future/deferred unless explicitly prioritized.

## Validity/missing data

Consumers must distinguish:

- valid;
- missing;
- invalid/corrupt;
- unavailable;
- semantic role unresolved;
- derived result unavailable because dependencies are missing.

Zero/fallback values must not be fabricated to hide missing evidence.

## Units

Calculations must not rely on display strings alone. Machine-readable unit identity should be retained where feasible; conversions belong in approved unit/channel services, not ad-hoc UI code.

## Provenance

The model should answer:

- which source produced a channel/value;
- the exact original source name;
- which concrete source identity backs a semantic role;
- mapping method/override quality;
- imported versus derived status;
- which analyzer/detector/version produced a result;
- which source samples support a recommendation.

## Persistence/versioning

Persisted/public artifacts carry schema versions. Changes require backward-compatible extension, explicit migration or clear unsupported-version rejection.

No silent incompatibility.

## Performance constraint

The conceptual model must not require source-sized object graphs or multiple uncontrolled full copies. Contracts must permit streaming/indexed/columnar/lazy/bounded/native implementations.

Semantic-role resolution and starter materialization are metadata operations and must not duplicate source sample arrays.

## Change control

Adding/changing a persisted/core entity requires review against `ARCHITECTURE.md`, `FILE_ARCHITECTURE.md`, compatibility requirements and current decision authority.
