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

## Windows test flow

1. Start `ts_shim` and confirm it is listening on port `29002`.
2. Open a terminal in the EpicScope repository.
3. Install dependencies if needed:

```text
npm install
```

4. Start the shim development mode:

```text
npm run dev:shim
```

5. Open:

```text
http://localhost:5173/
```

6. In EpicScope use **Connect Shim...**.

EpicScope still requests only same-origin paths such as `/telemetry` and `/api/v1/...`; the development server handles forwarding them to the actual shim.

## Different shim host or port

The default upstream target is:

```text
http://127.0.0.1:29002
```

Override it with the environment variable `EPICSCOPE_SHIM_TARGET` before starting Vite.

PowerShell example:

```powershell
$env:EPICSCOPE_SHIM_TARGET='http://192.168.1.50:29002'
npm run dev:shim
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
