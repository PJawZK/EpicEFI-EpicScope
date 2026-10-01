# EpicScope Data Model

## Purpose

EpicScope uses normalized internal models so import formats, analyzers, UI, and future native implementations remain decoupled.

Log sources such as MLG, CSV, future MDF4 support, and later log formats normalize into common log/channel/time concepts before general analysis.

Tune/configuration sources such as INI and MSQ normalize into tune/firmware concepts rather than being forced into the log model.

This document defines the initial authority. Exact TypeScript/native structures may evolve through approved decisions while preserving these responsibilities.

## Core concepts

### Session

A **Session** is the top-level domain analysis context.

A session may contain:

- one or more imported logs;
- source metadata;
- channel catalog;
- derived channels;
- event collections;
- tune/firmware context;
- annotations/bookmarks;
- analyzer state/results;
- comparison relationships.

A session must not require cloud storage.

The domain Session does not own presentation layout or become a general UI-state container.

### Workspace state

**WorkspaceState** represents presentation/application state associated with how a user is viewing a session.

Examples may include:

- open graph panes;
- selected channels;
- panel visibility/sizing;
- active tabs/workspaces;
- viewport/cursor state;
- UI-specific filter selections where they are not themselves part of the analytical result.

Workspace state may be persisted alongside a session artifact for convenience, but it remains conceptually separate from the domain Session so `core/session/` does not become coupled to a particular UI implementation.

Web, Linux, and Android may have different workspace-state representations while sharing the same underlying Session semantics.

### Persisted session artifact

A **PersistedSessionArtifact** is a versioned saved representation that may contain:

- domain Session data/references;
- analyzer results that are intended to persist;
- compatible annotations/bookmarks;
- optional platform/application workspace state;
- schema/version metadata;
- migration/compatibility metadata.

The persistence layer owns serialization/version/migration concerns. Saving workspace state with a session does not make workspace state part of the core domain Session.

### Log source

A **LogSource** represents one imported recording.

Minimum conceptual fields:

- stable internal identifier;
- source filename/display name;
- source format;
- source size;
- source metadata/provenance;
- start/end or duration information when available;
- parser warnings/errors;
- channel references;
- validity state.

The raw format remains parser-owned. Higher layers operate on normalized data.

### Channel definition

A **ChannelDefinition** describes a signal independent of any specific displayed sample.

Conceptual fields include:

- stable session-local identifier;
- source/original name;
- canonical/display name;
- unit;
- data type;
- source provenance;
- validity/availability metadata;
- optional aliases;
- optional category/group;
- optional semantic role;
- optional precision/display hints.

Source names should be preserved so EpicScope can show exact TunerStudio/MegaLogViewer naming where useful.

### Channel data

**ChannelData** is the time-associated numeric or state data for a channel.

The model must support efficient implementations where time and channel values are not expanded into per-sample objects.

The conceptual API should allow bounded queries such as:

- values in a time range;
- nearest value at time;
- min/max/statistics for a range;
- downsampled values for a viewport;
- filtered/qualified values;
- sample count and validity information.

The data model must not require all values to be resident in memory.

### Timebase

EpicScope treats time as a first-class shared dimension.

The model must support:

- monotonic timeline navigation;
- source timestamps where present;
- irregular sample spacing;
- missing samples;
- alignment between multiple logs/events;
- range queries.

Assuming a single fixed sample rate is not allowed unless a specific source guarantees it.

### Derived channel

A **DerivedChannel** is computed from one or more existing channels.

It should preserve:

- formula/expression or generating function identity;
- dependencies;
- unit;
- validity rules;
- provenance;
- version/schema information when persisted.

Derived channels should use the same consumer-facing query model as imported channels where practical.

### Event

An **Event** represents a meaningful bounded occurrence within a log/session.

Conceptual fields:

- type;
- start time;
- optional peak/reference time;
- end time;
- source log;
- quality/confidence state where appropriate;
- evidence/metrics;
- detector/version identity;
- optional user annotation.

Examples include WOT pull, tip-in, gear change, boost overshoot, idle sag, or DFCO transition.

Events should be reusable by navigation, analyzers, comparisons, and reports.

### Tune context

A **TuneContext** represents loaded ECU configuration information relevant to analysis.

It may include:

- firmware/INI identity;
- tune/MSQ identity;
- tables;
- axes;
- scalar settings;
- channel/table relationships;
- compatibility/validation metadata.

Tune context is optional. Generic log analysis must still work without it.

### Tune table

A normalized **TuneTable** should expose at least:

- identity/name;
- X axis;
- optional Y axis;
- cell values;
- units;
- source setting references;
- interpolation/lookup metadata where known;
- validation state.

Analysis may then map operating samples to table cells without UI code interpreting raw MSQ/INI structures.

### Analyzer result

An **AnalyzerResult** is structured evidence produced by a specialized analyzer.

It should distinguish:

- qualifying data/event selection;
- calculated metrics;
- findings/observations;
- confidence/quality limitations;
- optional proposed action;
- analyzer version/maturity;
- source session/log/tune references.

A finding must remain traceable back to its supporting data.

### Comparison

A **Comparison** links two or more sessions/logs/events/tune revisions for aligned analysis.

Conceptual fields may include:

- compared entities;
- alignment method;
- matched event pairs/groups;
- metric deltas;
- exclusions/unmatched data;
- comparison quality metadata.

## Validity and missing data

EpicScope must represent unavailable/invalid data explicitly rather than silently substituting zeros or fabricated values.

Consumers should be able to distinguish:

- valid value;
- missing value;
- invalid/corrupt value;
- channel unavailable;
- derived result unavailable because dependencies are missing.

## Units

Internal calculations must not rely only on display labels.

Where feasible, channel definitions should include machine-readable unit identity in addition to display text.

Unit conversion should occur through approved channel/unit services rather than ad-hoc UI calculations.

## Source provenance

Normalized data must retain enough provenance to answer questions such as:

- Which source file produced this channel?
- What was the original channel name?
- Was this value imported or derived?
- Which detector/analyzer version created this event/result?

## Persistence and compatibility

Saved EpicScope sessions and analysis artifacts must carry a schema version.

Schema changes must follow one of these paths:

- backward-compatible extension;
- explicit migration;
- clearly rejected unsupported version with a useful error.

Silent incompatibility is prohibited.

## Performance constraint on model design

The conceptual data model must not force a memory representation proportional to source file size plus multiple full duplicates.

The Web prototype may initially use simpler implementations, but public contracts should allow later Linux implementations to use:

- streaming parsing;
- indexed storage;
- memory mapping;
- chunked/channel-oriented storage;
- lazy decoding;
- bounded viewport queries;
- multiresolution/downsample caches.

## Change control

Adding a new core persisted entity or changing the meaning of an existing entity requires review against:

- `ARCHITECTURE.md`;
- `FILE_ARCHITECTURE.md`;
- compatibility requirements;
- `DECISIONS.md`.
