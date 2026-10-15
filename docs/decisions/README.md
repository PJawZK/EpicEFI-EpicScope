# EpicScope dated decision records

`../DECISIONS.md` contains the original numbered decision log through D-055. This directory preserves dated decisions/audits that refine the project after or alongside that log.

For current project state, always read `../HANDOFF.md` and `../DOCUMENTATION_MAP.md` first.

## Current accepted decisions

### 2026-10-15 — Unified observability authority

File: `2026-10-15-unified-observability-authority.md`

- **D-058** — EpicScope diagnostics, performance history, runtime errors and report assembly converge on one versioned, bounded observability/session architecture. The shared stream behaves as a flight recorder with explicit operation correlation, owner-provided revisions/fingerprints, priority/coalescing/backpressure, recursion protection, batched bounded persistence and previous-session evidence. Specialized reports become projections over the shared record stream; useful existing probes remain in their natural owners and redundant collectors/builders are removed after parity.

### 2026-10-15 — VE runtime validation and lambda-delay authority

File: `2026-10-15-ve-runtime-and-delay-authority.md`

- **D-056** — VE lambda-delay working model is **RPM × load table only**. Scalar/single and RPM-curve modes are historical/rejected options unless explicitly reopened by a later decision.
- **D-057** — VE lifecycle/render/state/input changes require browser acceptance evidence in addition to automated CI and should proceed one structural change at a time from the PR #449 browser-known-good boundary.

These are current accepted decisions.

## Historical/refining decisions

### 2026-10-14 — Source identity is immutable presentation data

File: `2026-10-14-source-identity-presentation.md`

Preserves the decision that literal source identity/name remains presentation authority while semantic roles may guide internal mapping.

### 2026-10-14 — VE Analyzer workbench correction

File: `2026-10-14-ve-analyzer-workbench-correction.md`

Historical/refining record that moved VE UX from an evidence-form shell toward the two-table calibration workbench. Current UI authority is `../VE_ANALYZER_WORKBENCH.md`.

### 2026-10-14 — Fuel / Injector validation hold and VE Analyzer pivot

File: `2026-10-14-fuel-injector-hold-ve-analyzer-pivot.md`

Historical sequencing decision that paused broad Fuel / Injector expansion and made VE the active track. Current sequence is in `../ROADMAP.md` and `../HANDOFF.md`.

## Decision maintenance rule

When a durable new decision is accepted:

1. give it the next unused D-number if it is project-wide and durable;
2. record it in `DECISIONS.md` when practical, or in a clearly indexed dated decision record;
3. state what earlier decision/document it refines or supersedes;
4. update `../DOCUMENTATION_MAP.md`, `../HANDOFF.md` and affected subsystem authority docs when current behavior changes.

Never silently overwrite historical rationale merely to make old records read as present-tense status.
