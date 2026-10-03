<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. If a status statement in this document describes an older milestone, use the handoff plus current `main`/CI state for present-tense continuation.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Platform Policy

## Platform order

EpicScope is intentionally developed in this order:

1. Web
2. Linux
3. Android / EpicHub

This order is architectural and product-driven, not merely chronological.

## Web

EpicScope Web is the functional reference during early development.

Primary responsibilities:

- prove product features and workflows;
- validate analyzer concepts;
- establish data contracts;
- support testing across the user's different computers and operating systems;
- serve as the fastest iteration environment.

### Browser target

Chromium is the primary browser family for development and validation.

Brave is the user's normal browser and should be treated as a first-class practical test target.

Firefox/Safari compatibility may be considered later, but must not delay core Web development unless a dependency choice would create unnecessary long-term lock-in.

<!-- CURRENT_STATE:current-web-validation-classes:START -->
## Current Web validation classes

Performance-sensitive Web changes are currently checked on two deliberately different Chromium/Linux classes:

- **desktop class:** about 5 logical threads, fast storage, where the 1.19 GB benchmark log indexes in roughly one second and arbitrary-channel full materialization is sub-second;
- **low-spec class:** 2 logical threads / 4 GB RAM class hardware with much slower storage, where the same source scans can take several seconds.

Hardware-adaptive Web policy already exists for CRC validation and active-channel materialization timing. This is allowed as an implementation optimization when both paths preserve the same product semantics. Desktop improvements that can affect I/O, allocation, GC or interaction behavior should be checked on the low-spec class before the performance task is considered settled.
<!-- CURRENT_STATE:current-web-validation-classes:END -->

## Linux

EpicScope Linux is the intended primary production application.

### Minimum baseline

The initial Linux compatibility baseline is:

- Debian 13 Stable or later;
- suitably compatible newer Debian-based distributions where dependencies permit.

Ubuntu support may be validated separately, but Debian 13 is the authoritative minimum target.

### Platform compatibility rule

A newer minimum OS requirement may replace Debian 13 only when it provides a substantial demonstrated benefit to:

- performance;
- memory efficiency;
- hardware support;
- security/maintainability;
- or another clearly material EpicScope capability.

Development convenience alone is not sufficient justification.

### Runtime dependency discipline

Build tooling may be newer than the user's runtime environment.

The project must avoid accidentally turning compiler/build-host versions into unnecessary end-user runtime requirements.

Dependencies that force newer libc/toolkit/runtime requirements must be reviewed against the platform baseline before adoption.

## Android / EpicHub

Android integration begins only after the Web functional model and Linux production model are sufficiently mature.

Goals include:

- reuse proven analyzer behaviour where practical;
- reuse portable core logic where justified;
- adapt UX to mobile/tablet constraints rather than forcing desktop layouts unchanged;
- avoid duplicating domain logic unnecessarily.

Android requirements must not prematurely constrain the Web or Linux implementations.

## Platform-specific adapters

Platform-specific capabilities should be isolated behind adapters or dedicated application layers.

Examples:

- browser file picker / File API;
- Linux native file access, memory mapping, file watching;
- Android storage/document APIs;
- future direct serial/CAN interfaces.

Core analyzers should consume normalized abstractions rather than platform APIs directly.

## Distribution philosophy

Web should remain easy to access for development and cross-machine testing.

Linux distribution should prioritize reliable operation and low overhead over packaging fashion. Packaging format should be decided later against compatibility, update, and dependency requirements.
