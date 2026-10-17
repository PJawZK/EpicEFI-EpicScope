# VE Analyzer v50 proposal toolbar ownership checkpoint

The VE Proposal shared edit toolbar is owned independently from v7's replaceable table-header control host. It is mounted as a stable sibling in the VE panel header so v7 layout/control resynchronization cannot delete the shared editing and Cell Evidence tools.

Browser acceptance now treats Cell Evidence as an explicit tool action, including while a newer VE analysis is pending; normal VE cell selection no longer doubles as an Evidence-open command.

This checkpoint is validation-only on `ui/ve-analyzer-v50-reconcile`; it does not authorize merging to `main`.
