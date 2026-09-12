# MagnetBridge

Paste a magnet you already have the right to download. Press start. The file lands on disk.

IDM is **not** part of this product. Research: [docs/ADR-001-architecture.md](docs/ADR-001-architecture.md). Verdict: **REJECTED**.

## Current status

This repository is the Architecture A prototype (first durable snapshot of the working implementation).

| Path | Verdict |
| --- | --- |
| magnet → WebSeed Range and/or WebTorrent → local file | **SUPPORTED** |
| magnet → BT → localhost HTTP → IDM | **REJECTED** |
| Ubuntu 24.04.3 desktop 5.91 GB | **PARTIAL** — official metadata fetch succeeded; the full ISO was **not** downloaded |

Measured records: [docs/TEST-RECORD.md](docs/TEST-RECORD.md), [docs/BENCHMARK.md](docs/BENCHMARK.md). Do not read the Ubuntu metadata result as a full-download PASS.

## 以后我拿到一个 magnet，怎么用

1. 确认这份资源你有权下载。这里没有搜索，没有索引，也不会帮你绕过任何限制。
2. 打开 MagnetBridge（网页，或 Windows 下的 `native/windows/magnetbridge.cmd`）。
3. 粘贴 `magnet:?xt=urn:btih:…`，勾选确认，点开始。
4. 可选：点「保存目录」选一个 Windows 文件夹。不选的话，完成后走浏览器下载。
5. 等到状态变成「完成」。分片 SHA-1 已经校验过。关掉再开，未完成任务会停在「已暂停」，点继续即可。

不要手工去点 qBittorrent WebUI，也不要手工把所谓直链喂给 IDM。

## Run the web app

```bash
npm install
npm run dev
```

Open the preview. Use the built-in **MagnetBridge 探针** (CC0, ~48 KB) for a first closed loop, or **Sintel 英文字幕** (CC-BY-3.0).

## Windows local CLI

Needs [Node.js 22+](https://nodejs.org). No extra server.

```bat
native\windows\magnetbridge.cmd --out %USERPROFILE%\Downloads\MagnetBridge "magnet:?xt=urn:btih:..."
```

or:

```bash
node cli/magnetbridge.mjs --out ./downloads "magnet:?xt=urn:btih:..."
```

The CLI uses WebTorrent in Node, which talks to regular BitTorrent peers. That is the fallback when a torrent has no WebSeed.

## What this will not do

- Search or recommend copyrighted content
- Convert a magnet into an IDM “direct link”
- Call Thunder / Xunlei
- Bypass DRM, paywalls, or login walls

## Architecture

**SUPPORTED** `magnet → WebSeed Range and/or WebTorrent → local file`  
**REJECTED** `magnet → BT → localhost HTTP → IDM`

qBittorrent WebUI *can* accept magnets (`POST /api/v2/torrents/add`). Embedding that as a hidden backend is valid, but shipping a JS engine avoids asking the user to install and click a second app.

## Tests

```bash
npm test
npm run test:e2e
npm run bench:idm
```

Records: [docs/TEST-RECORD.md](docs/TEST-RECORD.md), [docs/LICENSES.md](docs/LICENSES.md), [docs/KNOWN-LIMITATIONS.md](docs/KNOWN-LIMITATIONS.md).
