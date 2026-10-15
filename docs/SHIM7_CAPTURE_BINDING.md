# SHIM-7 capture binding — historical implementation slice

> **Status: superseded historical record.**
>
> This file records an earlier `ts_shim` capture-binding slice in which recording/capture had to be explicitly opened before becoming the analysis source. It is **not** the current live-source workflow.
>
> Current authority is `TS_SHIM_STATUS.md` and `TS_SHIM_INTEGRATION.md`.

## Historical SHIM-7 behavior

The SHIM-7 slice kept live connection/recording separate from the active analysis source until the user explicitly chose **Open Capture**.

When a retained Shim capture was opened in that slice:

- the Shim schema was filtered to channels present in the selected-channel capture;
- the retained `ShimLiveNumericChannelDataSource` became the Logger source;
- Logger used capture-relative time/reconnect markers;
- Analyzer/Histogram consumed that source through Logger analysis context;
- rich Shim quality remained available with legacy validity as compatibility projection;
- manual INI binding was not required for the capture;
- an active MLG was replaced only after explicit **Open Capture**;
- opening a later MLG switched back to recorded mode.

That slice intentionally did not provide the later live graph-follow workflow while recording.

## Current replacement

The implemented current workflow has moved beyond SHIM-7:

```text
Connect Shim
→ normal Logger Channel Browser / graph assignments
→ Record
→ live Logger view starts immediately
→ Follow / inspect history
→ Stop Recording
```

Current source transitions are in-process, preserve INI/MSQ/workspace state, use the complete live Shim schema as temporary catalog authority and normalize stable workspace identities between `ini:*` and matching raw Shim channels.

Do not use the historical **Open Capture first** lifecycle as current architecture. See `TS_SHIM_STATUS.md` for real-ECU validation and `TS_SHIM_INTEGRATION.md` for the current contract.
