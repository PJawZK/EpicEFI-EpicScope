# Canonical-time research evidence

Research base and input SHA-256 identities are pinned in `PROVENANCE.json`. `SUMMARY.json` is a compact comparison; `chdl.json`, `oct25.json` and `nov01.json` retain original regression cases, scoped membership differences and calculation experiments. `DESIGN_CASES.json` records an observed existing duplicate lookup limitation and proposed fallback cases; it is not a source selector.

Reproduce with dependencies installed:

```sh
EPICSCOPE_TIME_RESEARCH_OUTPUT=/tmp/epicscope-time-authority node docs/reference/time-authority-2026-11-10/simulate.mjs /path/to/CHDL.mlg /path/to/October25.mlg /path/to/November1.mlg
```

Use complete original recordings. Inputs open read-only; outputs default outside the checkout. The script imports current core owners through Vite SSR; no UI or ECU is accessed. Header framing and channel decoding remain dependent on the code in the checkout. It constructs copied timestamp variants and copied CRC masks for classification experiments. Do not import this research harness into runtime code or treat the exploratory header-refinement model as an approved clock repair.

`time-consumer-files.txt` is a search inventory, not proof of complete behavioral coverage. Owner-specific findings and proposed gates are in `docs/MLG_CANONICAL_TIME_AUTHORITY_DESIGN.md`.
