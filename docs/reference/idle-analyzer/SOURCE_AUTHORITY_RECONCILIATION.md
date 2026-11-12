# Idle Analyzer source authority and proposed native contracts

Baseline and evidence identifiers: [readiness audit](INTEGRATION_READINESS_AUDIT.md). These are **proposed contracts**, not existing exported application APIs. Existing type names below identify actual production code; new names are design vocabulary for review.

## Current owner → integration decision

| Concern | Current production owner | Prototype owner | Decision |
|---|---|---|---|
| MLG header/field metadata | `core/parsers/mlg/mlg-header.ts`, `mlg-format.ts` | `tunePairParseMlg` local descriptor decoder | Reuse production; no second parser |
| Record indexing, CRC, retry/counter and source integrity | `core/parsers/mlg/mlg-records.ts`, `mlg-integrity.ts`, `mlg-parser.ts` | B parser filters CRC and time order, discards invalid attempts | Reuse canonical index/quality/diagnostics; reconcile E9 rather than comparing trusted counts alone |
| Browser import/worker lifetime | `apps/web/src/adapters/mlg-staged-import.ts`, `mlg-file-import.ts`; `workers/mlg-import.worker.ts`, `mlg-crc.worker.ts`, protocol | Async file handler and dense rows | Adapt existing import service for an explicit retained comparison source; transactional replacement and generation rejection |
| Raw reads and decoded columns | `adapters/blob-byte-source.ts`, `mlg-column-sidecar.ts`, `mlg-column-sidecar-storage.ts`; `NumericChannelDataSource` | B objects with every selected field per sample | Reuse batch/range source API and existing storage; don't put raw logs in localStorage or duplicate column retention |
| Quality and sample identity | `core/log-model/log-types.ts`: `NumericChannelRange`, `NUMERIC_SAMPLE_QUALITY` | Dense filtered `idx` and implicit row usability | Canonical source sample index remains immutable; carry validity/quality and continuity; derived arrays must retain index correspondence |
| Channel catalog/mapping | `core/channels/channel-catalog.ts`; `pages/analyzer-channel-roles.ts`; `state/semantic-channel-roles.ts` | Fixed `TUNE_PAIR_FIELDS`, fixed real mapping list | Adapt existing role resolver with missing Idle roles and per-mode capability checks; preserve ambiguity/manual choice. No parallel alias catalogue/resolver |
| Analysis scopes | `pages/analyzer-scope.ts`, Logger A/B and saved ranges | `state.regions`, manual/discovered flags, focused/all and mode-purpose filters | Reuse Logger ranges as source selection input; add Idle region/purpose/qualification model as a projection, not another Logger timeline authority |
| RPM/PID aggregates and sags | `core/analysis/specialized-analyzers.ts`: `analyzeIdle` | Overridden `metricsFor`, `findSags` | Reuse/extend named core calculations after numerical contract review; fix terminal/gap semantics with tests before advertising parity |
| Numeric statistics | `core/analysis/numeric-aggregation.ts` | Repeated local sorts/reductions; population σ | Reuse bounded aggregation and valid/unavailable counts; explicitly document estimator differences |
| Inner DC tracking and effort | `core/analysis/idle-control-diagnostics.ts` | DC target−actual, fixed bias interpolation | Reuse core actual−target tracking; adapt explicit UI sign if chosen; distinguish logged bias from tune-derived expectation |
| Sample qualification | `core/analysis/sample-qualification.ts` | `sampleQualified`, manual bypass, inconsistent A/B discoverers | Adapt common scope/quality machinery; add Idle state/threshold rules in core, not DOM |
| Controller rendering/lifetime | `pages/specialized-analyzer-suite-view.ts`, `pages/analyzer-page.ts` | Mutable global `state`, late function overrides and listeners | Extend existing active-domain boundary with a focused Idle session; avoid a second independent analyzer runtime |
| Graph evidence | `pages/analyzer-event-evidence.ts`, `core/timeline/*`, production graph components | `plotModel`, canvas drawing, peak-preserving reduction | Adapt existing evidence renderer for accepted two-panel view and A/B transforms where feasible; port only missing interaction projections, not a second numeric authority |
| Logger navigation | `pages/logger-page.ts`: `LoggerAnalysisContext`, source-bound `openRangeInLogger`, `openSamplesInLogger`, `setAnalysisRange` | `openLogger`/real handler opens explanation | Reuse checked callbacks for active source; define explicit B-source activation before handoff. Never reinterpret B times against current A |
| INI/MSQ/calibration | `core/parsers/ini/*`, `core/parsers/msq/msq-parser.ts`, `core/tune/tune-model.ts`, `core/tune/table-correlation.ts`, `adapters/msq-candidate.ts` | First-name-only MSQ maps and static references | Reuse validated candidate preparation/normalization and INI editor definitions; preserve pages/dimensions/units/signatures. Do not use DOM table text as values |
| Workspace persistence | `state/application-workspace-persistence.ts`, `workspace-persistence.ts`, corresponding localStorage adapters | Two prototype localStorage keys and plan JSON | Adapt versioned serialization/error-handling pattern; add Idle descriptor to its actual owner after schema review; don't claim current workspace schema already stores Idle A/B sessions |
| Help | `pages/idle-analyzer-help.ts`, shared analyzer help/presentation owners | KB directory/bubbles, `kbEnhance` DOM scans | Reuse help facilities, port reviewed Idle explanations as content; remove prototype whole-page enhancement scans and stale demo wording |
| Observability/testing | `observability/recorder.ts` and producers; `scripts/browser/cdp.mjs`, existing analysis/browser tests | Toasts and ad hoc prototype checks | Reuse existing owner evidence and test transport; no generic global instrumentation/lifecycle layer |

Existing production is not a complete multi-recording comparison system. Logger advertises one active source context. Its captured `loadTraces` is already bound to source, catalog and extent, and its navigation commands reject retired sources. A separate retained B source needs an explicit, bounded ownership extension using the existing importer/data-source types; simply retaining two arbitrary Logger contexts is not a proven complete solution.

## Authority ordering

1. Canonical bytes/index/CRC/quality establish what was recorded and usable.
2. Catalog definitions and resolved channel IDs establish meaning, unit and mapping confidence.
3. Immutable selection plus qualification establish the exact eligible original indices.
4. Core calculation produces versioned measurements/events with coverage and assumptions.
5. Diagnostic rules produce hypotheses with limits; comparison produces descriptive differences and comparability reasons.
6. Views render those results. Table text, graph geometry, tooltip labels and operator “supported” review status never feed back as measurement authority.

Calibration reference, reviewed proposal and working edits elsewhere in EpicScope remain distinct. Idle integration initially reads immutable tune snapshots only and must not mutate VE’s original/proposal/working stores or its save session.

## Proposed contracts

### Recording, source identity and lifetime

```ts
type SourceRevision = { identity: object; revision: number; sampleCount: number };
type SourceDescriptor = {
  id: string; displayName: string; sizeBytes: number;
  verification: 'metadata' | 'sampled' | 'full-content';
  contentFingerprint?: string;
};
type IdleRecordingHandle = {
  descriptor: SourceDescriptor;
  revision: SourceRevision;
  timeRangeMs: { startMs: number; endMs: number };
  catalogRevision: number;
  channels: readonly ChannelDefinition[];
  loadTraces: LoggerAnalysisContext['loadTraces'];
  integrity: readonly ParserDiagnostic[];
};
```

Use actual production `LogSourceIdentity` plus source lifetime/revision; the descriptor above adds explicit verification semantics for persistence. The production local-file ID is currently `file:name:size:lastModified`, **not** a full-content hash. The prototype samples first/middle/last 32 KiB with a 32-bit hash. E12 proves it cannot establish exact byte identity. Choose verification strength explicitly: metadata/sampled matches may offer a candidate restoration requiring confirmation; do not call them exact-file proof. An incremental full-content verification can be considered if exact unattended restoration is required, using the importer boundary rather than a second synchronous full-file scan.

Comparison owner retains at most the accepted A/B handles required by its session and releases retired/import-failed temporary handles. Shared source references must use existing data-source lifecycle conventions; define release ownership before introducing a registry abstraction. Cancellation must reach existing import handles where supported, with generation checks for unavoidable completions.

### Samples, validity and continuity

Use `NumericChannelRange` directly: `startSampleIndex + localIndex`, `timeMs`, `values`, `validity`, optional `quality`. Validity byte **1** means usable; richer quality code **0** means valid. They are different encodings and must not be interchanged.

An eligible selection contains original indices plus contiguous runs/break reasons, not a new densely numbered synthetic source. A derived metric declares the intersection of required channels’ valid finite samples and counts invalid/unavailable samples separately. A graph can downsample display points, but metrics/events use the defined analysis indices. Recovered retries may be non-breaking; corrupt/unrecoverable records, loss, regressions and time gaps need explicit continuity semantics. Never infer continuity solely from the array after invalid samples have been removed.

### Channel mappings and units

```ts
type IdleRoleBinding = {
  role: string; channelId?: string;
  status: 'resolved' | 'missing' | 'ambiguous' | 'incompatible-unit';
  source: 'existing-resolver' | 'user-override';
  unit?: string; conversion?: { id: string; parameters: readonly number[] };
};
type IdleCapabilities = {
  mode: string; available: boolean;
  missingRequiredRoles: readonly string[];
  unavailableOptionalMetrics: readonly string[];
};
```

RPM is enough for variability; RPM+target for tracking; target+actual DC position for tracking; motor/PID/ignition/bias each require their own roles for their own claims. State qualification requires mapped idle/controller/speed/temperature roles or an explicitly disclosed reduced/manual policy. Do not require all DC/PID channels before allowing RPM diagnostics. Do not substitute physical TPS for pedal/driver intent. Normalize time to ms and distinguish percentage points, travel %, signed duty %, RPM, °C and degrees. Lambda stays lambda unless a justified stoichiometric reference is supplied.

### Region selection and qualification

```ts
type IdleRegion = {
  id: string; sourceId: string; revision: number;
  startMs: number; endMs: number;
  purpose: 'idle' | 'recovery' | 'raised' | 'entry' | 'custom';
  origin: 'logger-range' | 'manual' | 'discovered'; included: boolean;
};
type IdleQualification = {
  revision: number; policy: 'automatic-entry' | 'manual-explicit';
  rules: readonly { role: string; operator: string; value: number }[];
  minimumSamples: number; minimumObservedMs: number;
  maximumContinuousGapMs: number;
};
```

Validate finite ordered bounds inside that source; specify inclusive endpoints at the source adapter. Keep focused region, included-region union, comparison selections and graph viewport separate. Manual selection may intentionally bypass discovery entry conditions but never bypass source validity or metric prerequisites. Controls must disclose whether they rediscover candidates, requalify analysis or only change presentation. Both A/B should apply the same declared comparison qualification policy, or report the difference.

Logger saved ranges currently have no persisted IDs; `analyzer-scope.ts` retains bounds/labels conservatively. Do not treat `saved:arrayIndex` as a permanent region identity. Store an Idle ID plus source/bounds/provenance and reconcile the Logger projection deliberately.

### A/B comparison, provenance and confidence

```ts
type IdleComparisonSession = {
  revision: number;
  kind: 'conditions' | 'tuning-experiment';
  a: { sourceId: string; regionId: string; tuneRevision?: string };
  b: { sourceId: string; regionId: string; tuneRevision?: string };
  alignment: 'elapsed' | 'normalized' | 'event';
  eventAnchors?: { aOriginalSampleIndex: number; bOriginalSampleIndex: number };
};
type TuneProvenance = {
  revision: string; signature?: string; firmwareBuild?: string;
  iniRevision?: string;
  association: 'unverified' | 'operator-associated' | 'independently-established';
};
type IdleMetric = {
  id: string; definitionVersion: number; unit: string;
  availability: 'available' | 'insufficient' | 'missing' | 'incompatible';
  value?: number;
  validCount: number; invalidCount: number; unavailableCount: number;
  observedDurationMs?: number; assumptions: readonly string[];
};
```

Results additionally carry source/selection/qualification/tune revisions, physical event IDs, region references, measured facts, derived metrics, hypotheses, recommendation text and comparability reasons as separate fields. Confidence/status is structured data, never derived from string prefixes such as the prototype’s warning filters. A human’s test-plan disposition is a separate annotation.

Chronology should use canonical source metadata where meaningful, with operator verification when unknown; filenames are a hint. MSQ diff must include additions/removals/dimensions and definition compatibility. Current `TuneModel.entries` preserves page information, but its `byName` alone is not a unique `(page,name)` authority: resolve duplicates explicitly before comparison. Equal names or signatures do not prove equal meaning or flashed identity.

Same-source comparison is descriptive. Tuning-experiment comparison can describe better/worse measured outcomes under stated conditions; it cannot assert a causal tune improvement from the existence of different MSQs alone. An unknown controller update period blocks t63/lag claims even if the logger sampled quickly.

### Graph, event and Logger commands

```ts
type IdleDisplayWindow = { lo: number; hi: number; alignment: IdleComparisonSession['alignment'] };
type IdleLoggerRequest = {
  sourceId: string; sourceRevision: SourceRevision;
  startMs: number; endMs: number;
  originalSampleIndices?: readonly number[];
};
```

Display x is a projection of original time: elapsed `t-start`; normalized `(t-start)/(end-start)`; event `t-anchor`. Store inverse mapping/source identity for cursor/event handoff. Normalized time neither resamples evidence for metrics nor establishes matched events. Graph pan/zoom changes only `IdleDisplayWindow`; timeline region movement advances semantic revision and invalidates results. Axis fallback from unavailable event alignment must be reflected in labels and model state.

Route active-source commands through `LoggerAnalysisContext` checks. For B, request an explicit supported source activation/open operation; if unavailable, disable with explanation. Do not create another Logger, silently load another source, or fabricate ranges.

### Persistence, replacement and invalidation

Persist a versioned descriptor: verification strength/identity, region bounds and purpose, mappings/qualification, comparison kind/alignment/trace, tune associations and operator annotations. Raw MLG rows, File objects and evidence are not localStorage payloads. Re-import is required unless an existing approved storage-backed source handle is actually available.

On restore: validate schema/types/bounds/enums; bind sources; verify identity at stated strength; restore region revisions; resolve current catalog/tune compatibility; recompute analysis. Unmatched/missing source remains visibly blocked. Do not revive results or confidence from a stored text report.

On replacement: increment request generation; parse/index/resolve in temporary state; accept only if still current; then swap accepted handle, advance semantic revision and invalidate dependent results. Failure preserves prior accepted handle/session. On analysis request, capture the full semantic key; navigation/disposal/source/tune/scope/qualification changes reject obsolete completion. Pure tab, trace visibility, display alignment and viewport changes reuse immutable results unless an explicitly new event-selection calculation is required.

The existing specialized controller already defers hidden-domain work and rejects obsolete async reads. Preserve and extend that boundary; do not replace it with global listeners, MutationObservers or wrapper lifecycles.
