# EpicScope ts_shim development proxy

This development mode lets EpicScope run on its own Vite port while presenting the same browser-visible route structure that the final shim-hosted deployment will use.

## Purpose

The browser talks only to the EpicScope development origin:

```text
http://localhost:5173/
```

Vite serves EpicScope and proxies the shim routes behind the same origin:

```text
/telemetry   -> http://127.0.0.1:29002/telemetry
/api/v1/*    -> http://127.0.0.1:29002/api/v1/*
```

The WebSocket proxy rewrites both Host and WebSocket Origin toward the shim target so the shim's same-origin upgrade check sees a consistent upstream request.

This is a development/test bridge only. Production/GitHub Pages build behavior is unchanged.

## Windows 10 test flow

The current native `ts_shim` runtime is tested on Windows. The GitHub Pages site is not the correct page for this local proxy test; use a fresh local checkout/ZIP of current `main`.

### 1. Run ts_shim

Start the Windows `ts_shim` build normally.

The default EpicScope development target is:

```text
http://127.0.0.1:29002
```

In **PowerShell**, verify the port is listening:

```powershell
Test-NetConnection 127.0.0.1 -Port 29002
```

Expected result:

```text
TcpTestSucceeded : True
```

If using Command Prompt instead of PowerShell, use:

```bat
netstat -ano | findstr :29002
```

### 2. Download a fresh EpicScope main ZIP

From the `PJawZK/EpicEFI-EpicScope` GitHub repository:

```text
Code → Download ZIP
```

Extract the complete repository. A normal Windows path is:

```text
C:\Users\<user>\Downloads\EpicEFI-EpicScope-main
```

The extracted folder must contain at least:

```text
package.json
vite.config.ts
apps\
core\
docs\
tests\
```

Do not use an older extracted ZIP after shim work has moved forward. If the running page does not show **Connect Shim…**, first verify that the source copy is current.

### 3. Install Node.js if needed

EpicScope currently declares:

```text
Node ^20.19.0 or >=22.12.0
```

Use a normal current Node.js Windows x64 installation. Native-module build tools are not required by EpicScope's current dependency set.

Open a **new** PowerShell window after installation and verify:

```powershell
node --version
npm.cmd --version
```

PowerShell may block `npm.ps1` under the default Windows execution policy. Do not change policy just for EpicScope; use `npm.cmd` explicitly.

### 4. Install EpicScope dependencies

In PowerShell:

```powershell
cd "C:\Users\<user>\Downloads\EpicEFI-EpicScope-main"
npm.cmd install
```

Run this before `dev:shim`. If `vite` is reported as not recognized, dependencies were not installed in the current extracted repository; run `npm.cmd install` and retry.

### 5. Start shim-development mode

```powershell
npm.cmd run dev:shim
```

Vite should report a local URL similar to:

```text
http://localhost:5173/
```

Leave this terminal running.

### 6. Open the local EpicScope page

Open Brave/Chromium at:

```text
http://localhost:5173/
```

Do **not** use the GitHub Pages URL for this test.

Open **Load Data**. Current shim-capable main should show:

```text
Connect Shim…
```

If only the traditional file-loading choices are present, the most likely cause is a stale source ZIP. In current source, `apps/web/src/main.ts` installs both the live shim UI and shim HTTP UI.

### 7. Runtime test

Use:

```text
Load Data → Connect Shim…
```

Then test, in order:

- connection / schema status;
- **Channels…**;
- **Record**;
- **View Live**;
- **Follow** on/off;
- **Stop**;
- **Open Capture** where applicable;
- **Shim HTTP…** for INIs, Objects and Trigger Log.

The HTTP payloads are especially useful because typed read-only HTTP integration is intentionally waiting for real responses instead of guessing the native shim's response shapes.

## Different shim host or port

The default upstream target is:

```text
http://127.0.0.1:29002
```

Override it with the environment variable `EPICSCOPE_SHIM_TARGET` before starting Vite.

PowerShell example:

```powershell
$env:EPICSCOPE_SHIM_TARGET='http://192.168.1.50:29002'
npm.cmd run dev:shim
```

Command Prompt example:

```bat
set EPICSCOPE_SHIM_TARGET=http://192.168.1.50:29002
npm run dev:shim
```

## Final deployment relationship

Development:

```text
Browser
  -> localhost:5173
       -> EpicScope static/dev assets
       -> /telemetry -> ts_shim:29002
       -> /api/v1/*  -> ts_shim:29002
```

Final shim-hosted deployment:

```text
Browser
  -> shim-host:29002
       -> EpicScope static files
       -> /telemetry
       -> /api/v1/*
```

The EpicScope networking code should not need to change when moving from the development proxy to shim-hosted deployment because it already addresses the routes relative to the current origin.
