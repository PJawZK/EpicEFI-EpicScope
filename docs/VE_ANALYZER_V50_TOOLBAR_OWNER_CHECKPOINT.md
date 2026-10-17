# VE Analyzer v50 proposal toolbar ownership checkpoint

The VE Proposal shared edit toolbar is owned independently from v7's replaceable table-header control host. It is mounted as a stable sibling in the VE panel header so v7 layout/control resynchronization cannot delete the shared editing and Cell Evidence tools.

Browser acceptance now treats Cell Evidence as an explicit tool action, including while a newer VE analysis is pending; normal VE cell selection no longer doubles as an Evidence-open command.

The v2 semantic owner now publishes a synchronous VE-table render boundary. The shared proposal interaction adapter rebinds at that boundary, with its MutationObserver retained only as fallback, so a freshly rendered proposal table is editable before same-turn pointer input can race the observer.

Cell Evidence now has its own semantic cell-selection memory. It follows VE node clicks independently of whether the current Result View is proposal-editable, so alternate read-only result metrics can still be inspected without re-enabling editing on those views.

This checkpoint is validation-only on `ui/ve-analyzer-v50-reconcile`; it does not authorize merging to `main`.
