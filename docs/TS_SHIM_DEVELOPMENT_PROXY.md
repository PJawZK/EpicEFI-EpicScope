# EpicScope ts_shim development proxy

This development mode lets EpicScope run on its normal Vite development origin while presenting the same browser-visible relative routes intended for a final Shim-hosted deployment.

## Purpose

The browser talks only to EpicScope:

```text
http://localhost:5173/
```

Vite proxies Shim routes behind that same browser origin:

```text
/telemetry  -> EPICSCOPE_SHIM_TARGET/telemetry
/api/v1/*   -> EPICSCOPE_SHIM_TARGET/api/v1/*
```

The WebSocket proxy rewrites Host/Origin as required so the Shim same-origin check sees a consistent upstream request.

This is a development/test bridge. GitHub Pages recorded-log behavior is unchanged.

## Validated Linux + Pi Zero 2 W flow

The real-ECU validation on 2026-10-12 used:

```text
Mega144H7 USB CDC
      ↓
Pi Zero 2 W
      ↓
ts_shim :29002
      ↓ Wi-Fi / LAN
JZ-Main Linux PC
      ↓
Vite dev:shim proxy
      ↓
Browser http://localhost:5173/
```

Validated Shim endpoint:

```text
http://192.168.186.181:29002
```

From the EpicScope repository on the development PC:

```bash
cd ~/EpicEFI-EpicScope
EPICSCOPE_SHIM_TARGET='http://192.168.186.181:29002' npm run dev:shim
```

Then open:

```text
http://localhost:5173/
```

Use **Load Data → Connect Shim…**.

## Default target

If `EPICSCOPE_SHIM_TARGET` is not set, the development target is:

```text
http://127.0.0.1:29002
```

That is convenient when Shim runs on the same machine as Vite.

## Different Shim host

Linux/macOS shell:

```bash
EPICSCOPE_SHIM_TARGET='http://192.168.1.50:29002' npm run dev:shim
```

PowerShell:

```powershell
$env:EPICSCOPE_SHIM_TARGET='http://192.168.1.50:29002'
npm.cmd run dev:shim
```

Command Prompt:

```bat
set EPICSCOPE_SHIM_TARGET=http://192.168.1.50:29002
npm run dev:shim
```

## Current runtime workflow

The primary Shim workflow no longer requires a separate capture-channel picker or a separate initial **View Live** step.

```text
Load Data → Connect Shim
→ normal Logger Channel Browser / graph assignments
→ Record
→ live Logger view starts immediately
→ Follow / inspect history
→ Stop Recording
```

If a recorded MLG is already active, **Connect Shim** detaches it in-process first. The application is not reloaded; INI, MSQ, reusable workspace and report/performance state are retained.

Opening a recorded MLG while Shim owns the temporary catalog releases Shim ownership first and restores the loaded INI catalog before normal MLG/INI binding proceeds.

## Validation checklist

For a real runtime test, verify:

1. Shim connects and publishes a decodable schema.
2. The normal Channel Browser shows the Shim schema.
3. Existing stable graph assignments resolve to matching Shim channels.
4. Record enables when at least one legal graph assignment exists.
5. Record starts live Logger rendering immediately.
6. Follow can be turned on/off without stopping recording.
7. Stop Recording retains the capture.
8. Opening a recorded MLG restores the INI catalog/binding and canonical `ini:*` workspace identities.
9. Runtime Report shows no duplicate raw + `ini:*` assignments.
10. Health is `0 ISSUE / 0 WARN` for a healthy source transition.

## Current known narrow edge

The source architecture is validated. One UI-level cleanup remains worth preserving in downstream implementations: **capture remains loaded** and **live refresh is paused** should be represented as separate states. Do not use one boolean for both concepts.

## Windows development remains supported

A Windows `ts_shim` instance can still be tested with the same proxy model.

Typical PowerShell flow:

```powershell
npm.cmd install
$env:EPICSCOPE_SHIM_TARGET='http://127.0.0.1:29002'
npm.cmd run dev:shim
```

Then open `http://localhost:5173/` in Chromium/Brave.

PowerShell may block `npm.ps1` under default execution policy; using `npm.cmd` avoids changing policy just for EpicScope.

## Final deployment relationship

Development:

```text
Browser
  -> localhost:5173
       -> EpicScope dev assets
       -> /telemetry -> ts_shim:29002
       -> /api/v1/*  -> ts_shim:29002
```

Final Shim-hosted deployment:

```text
Browser
  -> shim-host:29002
       -> EpicScope static files
       -> /telemetry
       -> /api/v1/*
```

EpicScope addresses Shim routes relative to the current browser origin, so final same-origin hosting should not require a networking rewrite.