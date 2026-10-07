# SHIM-7 capture binding

SHIM-7 keeps live connection/recording separate from the active analysis source until the user explicitly chooses **Open Capture**.

When a retained shim capture is opened:

- the shim schema is filtered to the channels actually present in the selected-channel capture;
- the retained `ShimLiveNumericChannelDataSource` becomes the Logger source directly;
- Logger uses the capture-relative time range and reconnect markers;
- Analyzer and Histogram consume that same source through `loggerPage.getAnalysisContext()` when those modes are opened;
- shim rich quality remains available on channel ranges while legacy validity remains the compatibility projection;
- manual INI binding is not required for the capture;
- a currently loaded MLG is replaced only after this explicit **Open Capture** action;
- opening a later MLG switches the Logger source context back to recorded mode.

Live graph-follow while a recording is still growing is intentionally not part of this slice. A recording is first retained, then explicitly opened as a stable analysis source.
