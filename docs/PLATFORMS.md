<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. `docs/DOCUMENTATION_MAP.md` defines documentation authority.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Platform Policy

## Platform order

EpicScope is intentionally developed in this order:

1. Web
2. Linux
3. Android / EpicHub

This is an architectural/product order, not merely chronology.

## Web

EpicScope Web is the **current functional reference and feature-validation platform**.

It establishes product behavior/workflows, validates Analyzer concepts/data contracts, supports cross-machine testing and serves as the validated browser client for the read-only EpicEFI `ts_shim` contract.

### Browser target

Chromium is primary. Brave is a first-class practical target. Firefox/Safari support may be considered later but should not block current work unless a dependency would create unnecessary lock-in.

### Validation classes

Performance-sensitive Web work has been checked on both faster desktop-class Linux/Chromium systems and a deliberately low-spec 2-thread / 4 GB class machine with slower storage.

Hardware-adaptive scheduling is acceptable when product semantics remain identical. Changes affecting I/O/allocation/GC/responsiveness should be checked on the low-spec class before being called settled.

### Browser-behavior authority

Automated typecheck/tests/build remain mandatory, but UI/lifecycle claims require representative browser evidence when automation cannot prove them.

For VE Analyzer lifecycle/render/state/direct-edit changes this is a locked acceptance rule (D-057) after CI-green post-#441 changes caused a real Analyzer-entry freeze.

## Linux

EpicScope Linux remains the intended primary production application after Web functional maturity review.

### Minimum baseline

- Debian 13 Stable or later;
- compatible newer Debian-based distributions where dependencies permit.

A newer minimum may replace Debian 13 only for substantial demonstrated benefit such as performance, memory efficiency, hardware support or security/maintenance—not development convenience alone.

### Runtime dependency discipline

Build tooling may be newer than the end-user runtime. Do not accidentally turn compiler/build-host versions into unnecessary libc/toolkit/runtime requirements.

Linux may replace Web implementation internals with native mmap/indexed/columnar/etc. techniques while preserving established product semantics.

## Android / EpicHub

Android/EpicHub reuse begins only after Web behavior and Linux production architecture are sufficiently mature.

Goals:

- reuse proven Analyzer/domain behavior where practical;
- reuse portable core logic when justified;
- design mobile/tablet UX for that platform rather than forcing desktop layouts;
- avoid duplicated domain logic.

TunerStudio live table-editing/write research primarily belongs to EpicHub, not EpicScope. EpicScope carries only transferable invariants such as explicit proposal-vs-tune state and no implicit Apply/Burn.

## Platform-specific adapters

Platform capabilities stay behind adapters/application layers, for example:

- browser File/Blob/OPFS APIs;
- browser WebSocket/HTTP `ts_shim` transport;
- Linux native file access/mmap/file watching;
- Android storage/document APIs;
- future direct serial/CAN only if separately approved.

Core analyzers consume normalized abstractions rather than platform APIs directly.

## Distribution philosophy

Web remains easy to access for development/cross-machine validation. Linux distribution should prioritize reliable operation and low overhead over packaging fashion; packaging/update format is a later production decision.
