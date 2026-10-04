# MLG sidecar concurrent I/O benchmark

This temporary benchmark note documents the focused experiment on branch `perf/mlg-sidecar-concurrent-io-v1`.

The branch keeps the existing 256-byte stripe format and changes only sidecar storage scheduling: stripe writes for each validation batch are issued concurrently, and final stripe closes are issued concurrently. The goal is to reduce the measured OPFS write/finalization cost without changing startup behavior or channel-read semantics.
