# ADR-002 IDM as a unified download frontend

Status: accepted as **PARTIAL — WINDOWS_IDM_E2E_REQUIRED**
Date: 2026-09-12
Does not amend ADR-001.

## Context

The user owns a lifetime IDM license and already uses IDM as the Windows download manager. ADR-001 asked whether IDM makes BitTorrent faster. That question is closed.

This ADR asks a different question: can MagnetBridge hide BitTorrent behind a localhost HTTP Range server so IDM remains the familiar frontend, without first downloading the whole torrent and copying it.

## Questions

| # | Question | Evidence | Verdict |
| --- | --- | --- | --- |
| Q1 | Can IDM accelerate BT? | ADR-001, official CLI, 64 MiB copy-vs-Range | **REJECTED** (unchanged) |
| Q2 | Can IDM be the unified download frontend? | This document + sandbox Range bridge | **PARTIAL — WINDOWS_IDM_E2E_REQUIRED** |

## Options

### A (keep)

magnet → WebTorrent / WebSeed → local file. Default. Must stay available.

### B (still rejected)

magnet → BT completes → localhost HTTP → IDM copies bytes. Extra I/O. Not this work.

### D (this work)

magnet → metadata → demand-driven piece scheduler → SHA-1 → localhost HTTP Range (127.0.0.1 + unguessable token) → official IDM CLI `/n /d URL /p path /f name` → IDM writes the Windows file.

An IDM Range request maps to torrent pieces. Missing pieces are prioritized, fetched, verified, then returned as `206`. Unverified bytes are never sent. Concurrent ranges are allowed. Client abort cancels only that response.

## Official IDM surface used

Documented CLI only: https://www.internetdownloadmanager.com/support/command_line.html

```
idman /d URL [/p local_path] [/f local_file_name] [/q] [/h] [/n] [/a]
```

Store extensions remain forbidden. A user-run local tool is not a store extension. There is no official progress API, so pause/complete is observed from the file IDM writes.

## Sandbox results (SIMULATED_IDM_CLIENT)

Linux cannot execute `IDMan.exe`. A client that mimics IDM (HEAD, concurrent Range, jump, retry) is labelled **SIMULATED_IDM_CLIENT** and is not a real IDM PASS.

See `docs/architecture-d-sandbox.json`.

Expected properties if the experiment is honest:

- Store is empty before the first HTTP request.
- Jump/tail ranges fetch high piece indexes first, not the whole torrent.
- SHA-1 failure never becomes HTTP body bytes.
- Integrity of the probe file matches the known sha256.

## Costs that are acceptable only if the frontend UX is worth it

- Extra hop versus Architecture A (BT engine already has the bytes).
- Piece cache plus IDM's file is a second representation of requested bytes, but it is streamed, not a post-complete copy.
- Many IDM connections randomize piece priority; swarm efficiency can drop.
- No IDM job-control API.

## Decision

- Architecture A remains **SUPPORTED** and the default.
- Architecture B remains **REJECTED**.
- Architecture D is **PARTIAL — WINDOWS_IDM_E2E_REQUIRED**.
- Opt-in only: CLI `--idm` or `native/windows/test-idm-bridge.cmd`.
- Do not mark D **SUPPORTED** until a real `IDMan.exe` finishes a legal public magnet and an independent hash matches.

## Windows action required

Run `native\windows\test-idm-bridge.cmd` on the machine that already has IDM. That script detects Node and IDM, starts the localhost bridge, invokes the official CLI, and writes `docs/architecture-d-windows-result.json`.
