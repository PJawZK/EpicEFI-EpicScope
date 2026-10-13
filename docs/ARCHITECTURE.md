<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. Use the handoff plus current `main`/CI state for present-tense continuation.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Architecture

## Architectural objective

EpicScope must support rapid Web feature development without coupling product behavior to a browser-only implementation. The long-term production target is a highly optimized Linux application, followed later by Android / EpicHub reuse.

The architecture separates **what the application does** from **how each platform executes it**.

Related authority for semantic starter templates:

- `PREPOPULATED_WORKSPACES.md` — starter catalog and implementation status;
- `DATA_MODEL.md` — semantic role/template entities;
- `DECISIONS.md` — D-051–D-055 approved rules.

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
 Semantic roles / capabilities
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

The semantic role/capability layer is metadata/identity logic. It does not duplicate channel sample arrays or replace source provenance.

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
- temporary Shim schema/catalog ownership while Shim is authoritative;
- MLG remains authoritative for recorded sample values and validity.

INI enriches identity/organization/persistence but is optional for ordinary MLG analysis. MSQ enriches tune/calibration values rather than replacing the runtime channel catalog.

Concrete source identity may change while logical meaning remains stable, for example:

```text
recorded: ini:RPMValue
live:     RPMValue
```

The source-identity layer must prevent duplicate raw + `ini:*` traces during these transitions.

### Semantic channel-role and capability layer

Starter templates and analyzers must not become hard-coded lists of one ECU vendor's channel names.

Conceptual identity chain:

```text
semantic role
      ↓
logical ECU channel
      ↓
current source identity
```

Example:

```text
engine.rpm
      ↓
RPMValue
      ↓
ini:RPMValue  (recorded MLG + INI)
      or
RPMValue      (ts_shim)
```

Resolution preference is:

1. explicit user/schema override;
2. exact EpicEFI/native or otherwise known alias;
3. ECU-family/cross-ECU compatibility alias;
4. conservative normalized-name fallback;
5. unresolved.

Compatibility aliases and EpicScope display names are separate. Legacy/MLV `TP` may resolve `engine.throttle.position`, but the preferred visible EpicScope name is **TPS**.

MegaLogViewer `FieldMaps/*.properties` are useful compatibility/alias evidence but are not semantic vocabulary authority.

Future starter availability should prefer capability/role presence over board-name conditionals. For example, a Dual Chamber Boost starter should depend on upper/lower wastegate semantics being present rather than `ECU == Mega144H7`.

### Starter-template materialization

EpicScope separates **layout**, **starter template** and **workspace**:

```text
Layout
  graph geometry only

Starter template
  tuning/diagnostic purpose
  + layout reference
  + panes
  + semantic role slots
  + requirement levels
  + optional ECU/schema specialization

Workspace
  user-owned materialized graph state
  + concrete channel assignments
  + editable layout/pane state
```

Starter-template definitions are controlled product data. Materialization resolves semantic roles against the current authoritative channel set and creates an ordinary editable workspace.

Role requirement levels are:

- required;
- preferred;
- optional.

Missing roles degrade explicitly rather than fabricating values or failing the entire workspace.

Materialization is one-time. After creation, template logic has no continuing ownership of the workspace. Rename, delete, duplication, channel edits and layout edits are ordinary workspace operations. Template updates affect future materializations only.

Source transitions may normalize the user's concrete channel assignments between stable forms such as `ini:RPMValue` and `RPMValue`; this identity translation is separate from starter-template resolution and must not repopulate channels the user removed.

Historical persisted `built-in:*` IDs are compatibility data only and confer no protected runtime semantics.

The first validated implementation used the Single layout to prove source-independent semantic resolution before adding multi-pane geometry. The later lifecycle correction retains that resolver architecture while removing protected built-in workspace instances.

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

Template identity and materialized workspace identity are distinct. A template may be used repeatedly to create separate user workspaces, and a historical internal ID must never imply protected ownership by itself.

### Specialized analyzers

Specialized analyzers compose generic primitives/events/tune/compare services into domain-specific evidence and findings.

Current/initial families: Boost, Idle/PID, AE/MAP Predict, Fueling, Ignition/Knock, Fuel Pressure/Injector, Trigger/Sync.

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

## Current source ownership path

Only one Logger sample/catalog source family is authoritative at a time:

```text
Recorded MLG + optional INI binding
              ↕
         INI catalog only
              ↕
      ts_shim live/capture
```

Loaded INI and MSQ are independent application resources and survive source transitions.

The real MLG + INI → Shim → MLG path has been validated on Mega144H7 → Pi Zero 2 W → LAN → browser. The semantic-role layer sits above this already-validated source transition mechanism rather than replacing it.

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

Semantic-role resolution and starter materialization are metadata operations and must not force source-sized sample duplication.

## Current Web presentation composition

The Web application currently separates responsibilities across:

- `app-shell.ts` — application shell/global orchestration;
- `logger-page.ts` — Logger/workspace orchestration;
- `timeline-shell.ts` — timeline/range/marker presentation;
- `graph-viewport.ts` — graph presentation lifecycle;
- `inspector-panel.ts` — channel browser/detail interaction;
- `semantic-channel-roles.ts` — semantic role definitions and source-name resolution;
- `built-in-workspace-templates.ts` — starter-template definitions and role requirements (legacy filename retained for now);
- `prepopulated-workspace-runtime.ts` — one-time starter materialization plus historical-ID compatibility;
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

Semantic starter/template contracts should therefore remain platform-neutral even when Web materialization/persistence implementation details differ from Linux or Android.

The exact Linux runtime directory structure remains intentionally undecided until Linux architecture is explicitly approved.

## Platform independence

No core product concept should require browser-specific APIs unless explicitly Web-only.

Likewise, Linux-native mmap/file-watching/etc must stay behind platform boundaries.

## Data ownership

Authoritative channel/sample data should have one owner per session/source. UI/analyzers/workspace resolvers query/reference it rather than making uncontrolled full copies.

## Error propagation

Errors should be classified by layer/severity:

- recoverable source issue;
- degraded capability;
- analyzer/workspace role unavailable due to missing context;
- fatal parse/session failure.

Missing data should degrade only affected functions where possible. Malformed input must not drive uncontrolled allocation or fabricated data.

## Validation discipline

Architecture claims should move from proposed to validated only after automated checks and representative runtime evidence.

The four-role **Single · Resolver Test** path is runtime-validated through MLG + INI → Shim → MLG and proves source-specific semantic resolution.

The expanded eight-role **General** starter has automated coverage. One explicit real MLG + INI → Shim → MLG confirmation with all eight roles remains useful before describing every role as runtime-validated.

## Network/privacy boundary

Opening/analyzing local data does not imply permission to transmit it. Sharing/publishing/telemetry are separate explicit capabilities.

## Architectural change control

Architecture may evolve, but implementation must not silently redefine it.

A new top-level subsystem, dependency direction, or cross-layer responsibility requires project-owner approval plus corresponding decision/file-architecture updates before code lands.
