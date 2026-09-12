# ADR-001 MagnetBridge architecture

Status: accepted
Date: 2026-09-12
Decision owner: MagnetBridge Phase 1 research

## Context

The product promise is: a user pastes a magnet they are allowed to download, presses start, and a complete local file appears. An early idea was to finish the last mile with Internet Download Manager (IDM). That idea is not assumed. It must be proven or rejected.

## Options

### A. magnet → BT engine → local file

qBittorrent WebUI API (`POST /api/v2/torrents/add`, `urls=magnet:…`) stably accepts magnets. libtorrent is the engine inside qBittorrent. WebTorrent is a maintainable JS engine: Node speaks TCP/DHT/trackers; the browser speaks WebRTC + BEP-19 WebSeed.

Data is written once, piece SHA-1 is native, pause/resume/recheck are native.

### B. magnet → BT engine → localhost HTTP Range → IDM → local file

IDM official FAQ: the current version does not support torrents “for legal reasons”.
Official CLI: `idman /d URL [/p path] [/f name] [/q] [/h] [/n] [/a]` — HTTP/FTP/HTTPS/MMS only.
Magnet cannot be turned into an IDM URL. A Range server would only be serving bytes the BT engine already has, or blocking on holes IDM cannot understand. IDM has no progress API for our state machine. Official policy forbids third-party store extensions from driving that CLI.

### C. magnet → metadata → official WebSeed HTTP Range → local file, with WebTorrent fallback

Many legal torrents (Linux ISOs, Blender films, this repo’s probe file) publish HTTP mirrors as `url-list` / `ws=`. Downloading those ranges and verifying BT piece hashes is still architecture A, with HTTP as a peer.

## Decision

| Option | Reliability | Complexity | Speed | Resume | Maintenance | UX | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | High | Medium | Swarm-bound | Native | Low | Matches the promise | **SUPPORTED** |
| B | Low | Very high | Worse than A (extra copy / hole waits) | Poor (no IDM API) | High | Two UIs, stuck states | **REJECTED** |
| C | High when WebSeed exists | Low | Mirror-bound | Easy (HTTP is stateless) | Low | Same as A | **SUPPORTED** (subset of A) |

Chosen: **A + C**. IDM is not in the runtime path.

qBittorrent remains a valid optional Windows backend if a user already runs it, but MagnetBridge does not require installing or clicking its WebUI. This app embeds WebTorrent + a WebSeed Range client.

## Consequences

- Detecting `IDMan.exe` is allowed only to tell the user it will not be used.
- A localhost Range server must not be used to fake a second download of a finished torrent.
- Browser build cannot talk to vanilla TCP peers; torrents without WebSeed or WebRTC peers need the Node CLI (`cli/magnetbridge.mjs`) or a local qBittorrent.
- Integrity is piece SHA-1 from the torrent, not “IDM said it finished”.
