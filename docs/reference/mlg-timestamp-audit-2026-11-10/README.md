# Read-only audit reproduction

From a checkout with dependencies installed:

```sh
EPICSCOPE_AUDIT_OUTPUT=/tmp/epicscope-timestamp-audit node docs/reference/mlg-timestamp-audit-2026-11-10/investigate.mjs /path/to/CHDL.mlg /path/to/October25.mlg /path/to/November1.mlg
EPICSCOPE_AUDIT_OUTPUT=/tmp/epicscope-timestamp-audit node docs/reference/mlg-timestamp-audit-2026-11-10/render.mjs
```

Inputs must be the complete original recordings; source bytes are opened read-only. Outputs are outside the repository. Compressed committed ledgers describe the baseline investigation, including its then-current diagnostic labels. Reproduction uses the code in the checkout and may report the subsequently corrected labels. Framing/record lengths depend on the production parser; checksum arithmetic, raw-counter/raw-clock observations and membership oracle are separate checks. No external clock/specification authority is implied. Timing candidates are not source repairs.

Decompress `*-ledger.json.gz` with a standard gzip reader. Each event includes its original record, before/after neighbors, byte offsets and observed classifications. `SUMMARY.json` includes independently rechecked raw-identity retry accounting. Raw source payloads are not included.
