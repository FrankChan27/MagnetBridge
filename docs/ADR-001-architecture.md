# ADR-001 MagnetBridge architecture

Status: accepted
Date: 2026-09-12

Chosen: magnet → WebTorrent / WebSeed → local file.
IDM bridge (magnet → BT → localhost HTTP Range → IDM) is REJECTED.

IDM official FAQ: torrents unsupported. Official CLI only accepts HTTP/FTP/HTTPS/MMS URLs.
Loopback Range benchmark: direct copy 328ms / 195 MB/s vs 8-connection HTTP 1609ms / 39.8 MB/s.
