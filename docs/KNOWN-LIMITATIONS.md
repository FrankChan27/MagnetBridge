# Known limitations

Status of the product: **PARTIAL** for “every magnet on earth”, **SUPPORTED** for the stated UX on WebSeed / WebRTC magnets and for the Node CLI on regular BitTorrent.

- Browser engine cannot connect to TCP/uTP BitTorrent peers. If a magnet has no `ws=` / `url-list` and no WebRTC trackers, use `cli/magnetbridge.mjs` or qBittorrent.
- File System Access (write into a chosen Windows folder) needs a user gesture in Chrome/Edge and is often blocked inside cross-origin iframes. Fallback is a browser download of the completed file.
- Huge torrents in the browser are memory-sensitive when no directory handle is available. The UI warns using `navigator.storage.estimate()`.
- Metadata fetch from third-party caches (itorrents.org) is a last resort for a hash the user already pasted. If it is down, the task fails instead of hanging.
- Pause in the browser aborts in-flight Range requests; resume reuses already verified pieces kept in memory for that session. After a full reload, pieces are fetched again (HTTP WebSeed makes this cheap; swarm torrents should use the CLI so the store is on disk).
- IPv6 works when the browser/Node and the mirror support it; we do not force a stack.
- Windows MAX_PATH / reserved device names are sanitized. Very deep trees are truncated.
- Q1: IDM is not a BT accelerator. Q2: IDM-as-frontend is opt-in Architecture D and **not SUPPORTED** until a real `IDMan.exe` E2E exists.
- This sandbox cannot execute `IDMan.exe`. Simulated HTTP clients are labelled `SIMULATED_IDM_CLIENT`.
- Architecture D binds `127.0.0.1` only and uses an unguessable token. It still cannot see IDM's internal pause button; it only sees HTTP abort/reconnect and the output file.
- ≥1 GB public images (Ubuntu desktop ISO) are not fully downloaded in CI. Metadata from `releases.ubuntu.com` is accepted; the full ISO is a CLI/manual case.
