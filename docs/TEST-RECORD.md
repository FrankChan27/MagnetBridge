# Test record

Environment: Linux sandbox, Node 22, 2026-09-12. No IDMan.exe present (not Windows).

## Unit

`node --experimental-strip-types --test src/lib/magnet/*.test.ts src/lib/idm/*.test.ts`

Magnet parse / sanitization / state machine / piece mapping plus Architecture D range-map, demand store, official CLI builder, localhost Range server.

## End-to-end public torrents (real bytes, real SHA-1)

| Case | Source | Result | Wall clock | Integrity |
| --- | --- | --- | --- | --- |
| MagnetBridge probe 48 KB | self-hosted CC0 torrent + WebSeed | **PASS** | 54 ms | 4/4 pieces, sha256 `b759d7d1…58158d6` matches generator |
| Sintel.en.srt 1.5 KB (multi-file) | [webtorrent.io](https://webtorrent.io/torrents/sintel.torrent) CC-BY-3.0 | **PASS** | 2.1 s | info-hash `08ada5a7…095a10`, 1 piece SHA-1, file sha256 `4ed7e1f1…2cb64b2` |
| Sintel poster.jpg 46 KB (multi-file tail piece) | same torrent | **PASS** | 1.8 s | 1 piece SHA-1, sha256 `153e7e5d…ea389c8` |
| Ubuntu 24.04.3 desktop 5.91 GB | official `.torrent` from releases.ubuntu.com | **PARTIAL** | metadata 734 ms | info-hash `d160b8d8…cef1f7`, 24208 pieces, 262144 B/piece. No `url-list`. Full ISO not downloaded here (hours, TCP swarm only). CLI is the path. |

Raw JSON: [e2e-results.json](e2e-results.json)

## IDM as BT accelerator (architecture B, Q1)

64 MiB local payload, loopback HTTP Range vs `copyFile`.

| Method | ms | MB/s | CPU user+sys ms | RSS Δ |
| --- | --- | --- | --- | --- |
| direct-copy | 328 | 195.0 | 264 | 0 |
| http-range-1 | 1290 | 49.6 | 1559 | +122 MB |
| http-range-8 (IDM-like) | 1609 | 39.8 | 2694 | +135 MB |

Winner: **direct-copy**. Eight localhost connections were slower and fatter, not faster.

Raw JSON: [benchmark-idm-bridge.json](benchmark-idm-bridge.json)

IDM official FAQ: torrents unsupported. Official CLI: HTTP URL only. Verdict: **REJECTED**.

## IDM as download frontend (architecture D, Q2)

Client: **SIMULATED_IDM_CLIENT**. This is **not** a real IDMan.exe PASS.

Demand-driven Range bridge over the CC0 probe file (49 257 bytes, sha256 `b759d7d1…58158d6`). Pieces are fetched only after HTTP Range arrives; SHA-1 is required before bytes leave the server.

| Mode | Wall ms | Conns | First pieces | HTTP | Notes |
| --- | --- | --- | --- | --- | --- |
| jump | 161 | 2 | 1,2,3 then 0 | 206×2 | tail requested first; not a full prefetch |
| multi | 104 | 8 | 0–3 | 206×8, concurrentPeak 8 | overlapping ranges, inflightPeak 3 |
| sequential | 107 | 1 | 0–3 | 200 | one GET streams pieces in order |
| retry | 121 | 2 | 0–3 | abort+reconnect 1 | no garbage after abort |

All four: sha256 match, `prefetchedAllBeforeFirstByte=false`, `secondCompleteCopyBeforeHttp=false`.

Raw JSON: [architecture-d-sandbox.json](architecture-d-sandbox.json)

| Check | Status | Notes |
| --- | --- | --- |
| Empty store before first HTTP | sandbox | measured in experiment |
| Jump/tail range does not prefetch the whole torrent | sandbox | jump mode |
| Concurrent 8-range GET | sandbox | simulated IDM multi |
| Hash failure never served | unit | piece-store.test |
| Independent sha256 of assembled file | sandbox | must match probe |
| Real IDMan.exe E2E | **not run** | Linux host. Use `native/windows/test-idm-bridge.cmd` |

Verdict Q2: **PARTIAL — WINDOWS_IDM_E2E_REQUIRED**

## Other acceptance checks

| Check | Status | Notes |
| --- | --- | --- |
| Pause / resume state machine | PASS | DOWNLOADING ⇄ PAUSED, FAILED can retry, COMPLETED is terminal |
| Kill app → restart | PASS (web) | localStorage reloads tasks as PAUSED |
| Duplicate magnet | PASS | same info-hash reuses the live task |
| IDM missing fallback | PASS | default engine is WebSeed/WebTorrent (Architecture A) |
| IDM present | N/A | opt-in `--idm` only; ignored otherwise |
| No Xunlei | PASS | not referenced in runtime |
| Hash / integrity | PASS | piece SHA-1 on every WebSeed piece and every D response |
| Network blip | PASS | Range fetches retry 3 times with backoff |

## Product status

| Goal | Mark |
| --- | --- |
| magnet → complete local file without babysitting | **SUPPORTED** (WebSeed / WebRTC magnets; Node CLI for TCP swarms) |
| IDM as last-mile BT accelerator | **REJECTED** |
| IDM as unified download frontend | **PARTIAL — WINDOWS_IDM_E2E_REQUIRED** |
| ≥1 GB full swarm download in this sandbox | **PARTIAL** (metadata only) |
