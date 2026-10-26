# MLG complete-prefix recovery and worker error routing

Baseline: main `8adf15c3b14b80c2ab1ff9cf98be924734aa6642`. This fixes the verified incomplete-tail import failure and duplicate worker-error fallback at existing owners. No source file is rewritten, truncated, padded or replaced.

## Evidence

All four uploaded archive parts and the full ZIP matched the manifest SHA-256; extraction passed ZIP CRC. The exact MLG is 1,102,856,192 bytes, SHA-256 `de56d1d03458d2cde755ab903fc34e62f864c8962fe6d0e4d17df8d0c2961a13`. Both prior Pages runtime `8ba0c7a` and baseline main rejected it at offset 1,102,854,995. The declared standard block is 6,929 bytes; only 1,197 bytes remain in the final record, leaving 5,732 missing. Independent streaming verification found 159,022 structurally complete records before this boundary. The cause of the incomplete write is not established.

A read-only browser prefix probe retained those records and exposed existing integrity classifications: 701 recovered CRC attempts, 28 unrecovered CRC records, 93 valid retry-like runs, and 30 counter discontinuities. Complete structural records are not synonymous with trusted valid samples. Existing CRC/retry/continuity policies remain authoritative.

## Recovery owner and policy

`scanMlgRecords` stays strict by default. Its explicit `incompleteTail: 'retain-complete-records'` policy is opted into by the browser file-import adapter and staged indexing worker. General scanning retains a nonempty complete logger-record prefix only when it reaches physical EOF within a known next block header, logger record or marker. It does not resynchronize or skip unknown block types, accept malformed headers, or reinterpret a backing source returning fewer bytes than requested. A file with no complete logger record remains rejected.

The incomplete block is never indexed, assigned a fabricated time/value, padded or included in analysis. Original source bytes and file size remain unchanged. One `mlg-incomplete-tail` warning reports byte offset, actual/expected/missing lengths, block kind and retained record count. Structured `incompleteTail` metadata and delivery-loss semantics accompany the message. Earlier CRC exclusions remain unchanged. Tail diagnostic ordering is normalized at the existing retry-classification owner so staged/fallback final evidence agrees without sorting sample arrays.

Logger owns the resulting source diagnostics. Existing source-load/CRC status presentation includes “incomplete tail excluded” during indexing and after completion. A loaded source with warnings remains marked as an issue while the application is Ready. This is a retained source warning, not a claim that the original file is complete or all samples are valid.

## Worker failure ownership

The existing worker message contract distinguishes format errors from runtime failures and carries code/offset. The adapter reconstructs a validated `MlgFormatError`; it does not parse human-readable text. The shell's current indexed-import catch reports a known format error directly through its existing import-error owner. No second full scan is attempted for that error. Existing stale/cancelled-source checks run first. Runtime/infrastructure errors retain the existing fallback route; post-index validation errors retain their existing separate route.

No global listeners, observers, lifecycle wrappers, generic instrumentation, persistence schema changes or full-log caches were introduced. INI/MSQ numerical authority and Save behavior are unchanged. No automatic ECU/ Shim write or Burn is added.

## Regression and exact-file validation

Core regressions cover strict default, recognized versus unknown short EOF types (including exact scan-chunk boundaries), partial headers/records/markers, empty usable prefix, unknown block types, CRC preservation, source-read failures and scan-chunk boundaries. Browser tests exercise actual worker/fallback diagnostic parity, typed format error metadata, actual shell no-retry behavior, retained infrastructure fallback, visible tail warning and 320,005 continuous valid samples followed by a partial record.

The full unchanged uploaded log has also been loaded through the actual application's worker and fallback paths. Both retain 159,022 complete records and identical final integrity counts, with no runtime exceptions or worker-fallback events. Worker final-validation time includes existing CRC validation and sidecar construction; it must not be compared with an earlier failed-import duration as a speedup benchmark. Uploaded data and diagnostic artifacts remain outside the repository.

Final gate counts, exact commits, screenshots and logs are recorded in `/workspace/epicscope-mlg-tail-fix/`. Manual acceptance of the user's browser/MLV and previously pending Brave MSQ native-permission/TunerStudio behavior is separate from automated validation.
