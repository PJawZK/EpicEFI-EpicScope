# EpicScope Architecture

## Architectural objective

EpicScope must support rapid Web feature development without coupling product behaviour to a browser-only implementation. The long-term production target is a highly optimized Linux application, followed later by Android / EpicHub reuse.

The architecture therefore separates **what the application does** from **how each platform executes it**.

## Primary layers

```text
Source file / platform data source
            ↓
         Parser
            ↓
   Normalized Log Model
            ↓
 Generic Analysis Primitives
            ↓
 Event / Tune / Compare Services
            ↓
 Specialized Analyzers
            ↓
      Presentation / UI
```

This diagram describes product flow, not a rule that every code dependency must point linearly downward.

`core/log-model/` is a neutral contract boundary: parsers depend on those contracts to produce normalized data, while analysis/services depend on them to consume normalized data.

## Layer responsibilities

### Source / parser layer

Responsibilities:

- read supported file formats;
- validate format structure;
- decode source-specific metadata and samples;
- report recoverable and fatal parse errors;
- produce normalized data through approved contracts.

Initial source-format ownership includes MLG, CSV, and—when tune-awareness is implemented—INI/MSQ decoding.

Parsers must not:

- implement UI behaviour;
- contain boost/idle/AE-specific analysis;
- own tune recommendations;
- expose source-format quirks directly to presentation code unless explicitly represented in normalized metadata.

All parser/importer inputs are untrusted and must be bounded/validated before using file-provided sizes, offsets, counts, or other allocation-driving values.

### Normalized log model

Responsibilities:

- common representation of channels, units, sample timing, metadata, validity, and source provenance;
- provide stable contracts to analysis layers;
- isolate analyzers from individual import formats.

All supported log formats must normalize into this model before general analysis.

Parsers produce these contracts; consumers query them. The model itself should not contain source-specific parsing behavior.

### Generic analysis primitives

Responsibilities include reusable operations such as:

- filtering;
- windowing;
- aggregation;
- statistics;
- resampling;
- interpolation where approved;
- histogram / heatmap generation;
- scatter preparation;
- downsampling for visualization;
- sample qualification.

Generic analysis must not contain ECU-system-specific conclusions.

### Event services

Responsibilities:

- detect reusable events from normalized channels;
- expose event time ranges, labels, confidence/quality metadata, and evidence;
- allow analyzers and comparison tools to reuse the same event definitions.

### Tune services

Responsibilities:

- represent normalized tune and firmware context;
- map logged operating points to tune structures;
- expose table axes, cells, current values, targets, and relevant metadata;
- avoid embedding presentation assumptions.

Raw INI/MSQ syntax decoding belongs to the parser layer. Tune services consume normalized decoded information rather than becoming source-format parsers themselves.

### Compare services

Responsibilities:

- align sessions/events;
- calculate deltas;
- normalize comparable metrics;
- support before/after and revision analysis.

### Session services

Responsibilities:

- compose logs, tune context, events, comparisons, annotations, and analyzer state into a coherent analysis session;
- expose stable session-level relationships independently of presentation layout;
- avoid becoming a second UI state store.

### Persistence services

Responsibilities:

- versioned serialization/deserialization;
- schema migration;
- storage-independent persisted-artifact contracts;
- explicit compatibility errors for unsupported versions.

Browser storage, Linux filesystem storage, cloud/share services, and future Android storage are platform adapters around these contracts rather than assumptions embedded into the session model.

### Specialized analyzers

Responsibilities:

- compose generic primitives, events, tune context, and comparisons into domain-specific analysis;
- expose evidence, metrics, and findings through stable analyzer contracts.

Initial planned analyzers include boost, idle/PID, AE/MAP Predict, fueling, ignition/knock, fuel pressure/injector, and trigger/sync.

Specialized analyzers must not parse source files directly.

### Presentation / UI

Responsibilities:

- display data and findings;
- manage user interaction, workspace layout, filters, selections, panels, and navigation;
- request bounded data suitable for the current view;
- avoid owning duplicate authoritative analysis logic.

The UI must not become a second analysis engine.

## Web and Linux relationship

The Web application is the functional authority during early development. Its internal implementation may use lightweight TypeScript where appropriate.

The Linux application is expected to replace or harden performance-critical layers with native implementations, likely Rust where justified, without changing the established product semantics unnecessarily.

The architecture must therefore preserve boundaries that allow:

```text
Web UI → Web analysis/data implementation
```

to later become:

```text
Linux UI → Native optimized analysis/data implementation
```

without redesigning every analyzer and workflow.

The exact Linux application/runtime directory structure is intentionally not invented before the Linux architecture is approved. Future platform areas require explicit architecture decisions rather than implicit additions.

## Platform independence

No core product concept should require a browser-specific API unless that concept is explicitly a Web-only adapter.

Likewise, Linux-native features such as memory mapping or direct file watching must live behind platform-specific boundaries rather than leaking through the full product model.

## Data ownership

Authoritative channel/sample data should have one owner per session. UI components and analyzers should query or reference this data rather than making uncontrolled full copies.

This rule is important even during Web prototyping because duplicated log data would make later performance work unnecessarily difficult.

## Error propagation

Errors should be classified by layer and severity:

- recoverable source issue;
- degraded capability;
- analyzer unavailable due to missing channels/context;
- fatal parse/session failure.

Missing data should disable or degrade only affected functions where possible.

Malformed/untrusted input should not be allowed to turn a recoverable parser error into uncontrolled allocation, application-wide crash, or silent fabricated data.

## Network/privacy boundary

Opening and analyzing local data does not imply permission to transmit it.

Remote sharing, publishing, telemetry, or analytics are separate capabilities and must not silently transmit log contents, tune contents, filenames, derived values, or analysis results.

## Architectural change control

Architecture may evolve, but implementation must not silently redefine it.

A new top-level subsystem, dependency direction, or cross-layer responsibility requires project-owner approval, an explicit documented decision in `DECISIONS.md`, and corresponding updates to architecture/file-architecture documentation before code lands.
