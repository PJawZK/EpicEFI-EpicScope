<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. Use the handoff plus current `main`/CI state for present-tense continuation.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Architecture

## Architectural objective

EpicScope must support rapid Web feature development without coupling product behavior to a browser-only implementation. The long-term production target is a highly optimized Linux application, followed later by Android / EpicHub reuse.

The architecture separates **what the application does** from **how each platform executes it**.

## Primary layers

```text
Source files / platform data sources
              ↓
           Parsers
              ↓
      Normalized source models
      ├─ Log model / samples
      ├─ Channel catalog/bindings
      └─ Tune / firmware context
              ↓
    Generic Analysis Primitives
              ↓
   Event / Tune / Compare Services
              ↓
      Specialized Analyzers
              ↓
        Presentation / UI
```

`core/log-model/` is a neutral contract boundary: parsers produce normalized data through it and consumers query those contracts.

## Layer responsibilities

### Source / parser layer

Responsibilities:

- read supported source formats;
- validate structure/untrusted fields;
- decode source-specific metadata/samples;
- report recoverable/fatal parse errors;
- produce normalized data through approved contracts.

Initial ownership includes MLG and deferred CSV logs plus INI/MSQ source-context decoding as roadmap tasks land.

Parsers must not:

- implement UI behavior;
- contain Boost/Idle/AE-specific conclusions;
- own tune recommendations;
- leak raw source quirks directly into presentation unless explicitly represented in normalized metadata.

### Normalized log model

Responsibilities:

- common channels/units/time/metadata/validity/provenance;
- stable consumer contracts;
- source-format isolation.

### Channel catalog and source binding

Responsibilities:

- stable logical channel identity independent of one MLG;
- normalized INI-known runtime/output channels;
- logical→MLG binding when recorded data exists;
- explicit known/no-data state;
- explicit log-only channels;
- MLG remains authoritative for recorded sample values and validity.

INI enriches identity/organization/persistence but is optional for ordinary MLG analysis. MSQ later enriches tune/calibration values rather than replacing the runtime channel catalog.

### Generic analysis primitives

Reusable operations such as:

- filtering/qualification;
- range/window statistics;
- aggregation;
- resampling/interpolation where approved;
- histogram/heatmap/table preparation;
- scatter preparation;
- visualization downsampling.

Generic analysis must not contain ECU-system-specific conclusions.

### Event services

Responsibilities:

- reusable event detection;
- event time ranges/labels/confidence/evidence;
- shared event definitions for analyzers/comparison/navigation.

### Tune services

Responsibilities:

- normalized firmware/tune context;
- tables/axes/cells/current values;
- operating-point mapping and tune-aware correlations.

Raw INI/MSQ syntax remains parser ownership.

### Compare services

Responsibilities:

- session/event/range alignment;
- metric deltas;
- normalized comparison primitives;
- before/after support independent of one UI surface.

### Session services

Responsibilities:

- compose logs, tune context, events, comparison, annotations and analyzer state;
- expose domain relationships without becoming a UI-state store.

### Persistence services

Responsibilities:

- versioned serialization/deserialization;
- migration/compatibility;
- storage-independent artifact contracts.

Browser/Linux/Android storage are adapters around these contracts.

Persistence must distinguish reusable application workspace from recording-specific analysis state.

### Specialized analyzers

Specialized analyzers compose generic primitives/events/tune/compare services into domain-specific evidence and findings.

Initial planned families: Boost, Idle/PID, AE/MAP Predict, Fueling, Ignition/Knock, Fuel Pressure/Injector, Trigger/Sync.

Specialized analyzers do not parse source files directly.

### Presentation / UI

Responsibilities:

- display data/findings;
- manage interaction, layout, panels, selections and navigation;
- make workflow order clear;
- request bounded data appropriate to the current view;
- avoid owning duplicate authoritative analysis logic.

Current UI workflow authority is:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

The EpicScope logo dropdown owns mode/surface switching. It is presentation navigation only and does not redefine analysis/service ownership.

## Current Web large-log data path

The current browser implementation uses a layered post-index architecture rather than repeated original-row traversal for normal restored/arbitrary channel use:

1. **Session/RAM full-range cache** for already materialized channels.
2. **Primary OPFS MLG column sidecar** storing transposed native-width stripes.
3. **Sparse native per-channel OPFS cache** for channels the user actually selects.
4. **Original row-reader fallback** when the optimized representation is unavailable/invalid.

The primary canonical sidecar currently uses a 64-byte target stripe width (59 stripes on the 1.19 GB benchmark log). A 16-byte stripe experiment was rejected because it increased build/transpose cost without enough end-to-end gain.

The sparse native-column cache is deliberately demand-driven rather than a startup hot set. It remains behind normalized channel/data-source contracts.

The opportunistic `predecode=32/64/128` path was fully removed and must not return without a new decision/evidence.

Current performance posture:

- workspace restore and arbitrary-channel access are no longer active architectural blockers;
- performance remains a regression requirement;
- feature/UI work has priority until a measurable regression or later maturity pass justifies new optimization.

This sidecar/cache design is a **Web implementation strategy**, not a Linux architecture mandate. Linux remains free to use mmap/indexed/columnar/native approaches while preserving product semantics.

## Current Web presentation composition

The Web application currently separates responsibilities across:

- `app-shell.ts` — application shell/global orchestration;
- `logger-page.ts` — Logger/workspace orchestration;
- `timeline-shell.ts` — timeline/range/marker presentation;
- `graph-viewport.ts` — graph presentation lifecycle;
- `inspector-panel.ts` — channel browser/detail interaction;
- focused components/state helpers extracted during the repository audit for parser diagnostics, performance-report formatting, Bug report health/formatting and pane-layout state.

The repository audit is complete for now. Large files may remain when responsibilities are still coherent; file size alone is not an architecture violation.

## Web and Linux relationship

The Web application is the functional authority during current product discovery. Linux is expected to replace/harden performance-critical internals without changing established product semantics unnecessarily.

Conceptually:

```text
Web UI → Web analysis/data implementation
```

may later become:

```text
Linux UI → Native optimized analysis/data implementation
```

without redesigning every workflow/analyzer.

The exact Linux runtime directory structure remains intentionally undecided until Linux architecture is explicitly approved.

## Platform independence

No core product concept should require browser-specific APIs unless explicitly Web-only.

Likewise, Linux-native mmap/file-watching/etc must stay behind platform boundaries.

## Data ownership

Authoritative channel/sample data should have one owner per session. UI/analyzers query/reference it rather than making uncontrolled full copies.

## Error propagation

Errors should be classified by layer/severity:

- recoverable source issue;
- degraded capability;
- analyzer unavailable due to missing context;
- fatal parse/session failure.

Missing data should degrade only affected functions where possible. Malformed input must not drive uncontrolled allocation or fabricated data.

## Network/privacy boundary

Opening/analyzing local data does not imply permission to transmit it. Sharing/publishing/telemetry are separate explicit capabilities.

## Architectural change control

Architecture may evolve, but implementation must not silently redefine it.

A new top-level subsystem, dependency direction, or cross-layer responsibility requires project-owner approval plus corresponding decision/file-architecture updates before code lands.
