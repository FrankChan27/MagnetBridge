# MagnetBridge

Paste a magnet you already have the right to download. Press start. The file lands on disk.

Default path does **not** use IDM. Research: [docs/ADR-001-architecture.md](docs/ADR-001-architecture.md).  
Q1 (IDM as BT accelerator): **REJECTED**.  
Q2 (IDM as already-purchased download frontend): [docs/ADR-002-idm-as-download-frontend.md](docs/ADR-002-idm-as-download-frontend.md) **PARTIAL — WINDOWS_IDM_E2E_REQUIRED**.

## Current status

| Path | Verdict |
| --- | --- |
| magnet → WebSeed Range and/or WebTorrent → local file | **SUPPORTED** |
| magnet → BT complete → localhost copy → IDM | **REJECTED** (accelerator / extra copy) |
| magnet → demand-driven pieces → localhost Range → IDM | **PARTIAL — WINDOWS_IDM_E2E_REQUIRED** |
| Ubuntu 24.04.3 desktop 5.91 GB | **PARTIAL** — metadata only, not a full-download PASS |

Measured records: [docs/TEST-RECORD.md](docs/TEST-RECORD.md), [docs/BENCHMARK.md](docs/BENCHMARK.md), [docs/architecture-d-sandbox.json](docs/architecture-d-sandbox.json).

## 以后我拿到一个 magnet，怎么用

1. 确认这份资源你有权下载。这里没有搜索，没有索引，也不会帮你绕过任何限制。
2. 打开 MagnetBridge（网页，或 Windows 下的 `native/windows/magnetbridge.cmd`）。
3. 粘贴 `magnet:?xt=urn:btih:…`，勾选确认，点开始。
4. 可选：点「保存目录」选一个 Windows 文件夹。不选的话，完成后走浏览器下载。
5. 等到状态变成「完成」。分片 SHA-1 已经校验过。关掉再开，未完成任务会停在「已暂停」，点继续即可。

不要手工去点 qBittorrent WebUI，也不要手工把所谓直链喂给 IDM。

### 如果我想继续用已经买的 IDM 当下载窗口

这是可选的 Architecture D，不是默认。

1. 在已经安装 IDM 的 Windows 上运行：`native\windows\test-idm-bridge.cmd`
2. 或：`native\windows\magnetbridge.cmd --idm --out %USERPROFILE%\Downloads\MagnetBridge "magnet:?xt=urn:btih:..."`
3. MagnetBridge 取 metadata、只监听 `127.0.0.1`、用一次性 token URL，再调用官方 `idman /n /d URL /p /f`。
4. 之后看 IDM 自己的窗口。不要手工复制 localhost 地址。

当前 Linux 沙箱没有 `IDMan.exe`。模拟客户端通过 **不等于** 真实 IDM 通过。

## Run the web app

```bash
npm install
npm run dev
```

Open the preview. Use the built-in **MagnetBridge 探针** (CC0, ~48 KB) for a first closed loop, or **Sintel 英文字幕** (CC-BY-3.0).

## Windows local CLI

Needs [Node.js 22+](https://nodejs.org). No extra server.

Architecture A (default):

```bat
native\windows\magnetbridge.cmd --out %USERPROFILE%\Downloads\MagnetBridge "magnet:?xt=urn:btih:..."
```

Architecture D (opt-in IDM frontend):

```bat
native\windows\test-idm-bridge.cmd
```

## What this will not do

- Search or recommend copyrighted content
- Convert a magnet into an IDM “direct link”
- Call Thunder / Xunlei
- Bypass DRM, paywalls, or login walls
- Pretend a simulated HTTP client is a real IDM run

## Architecture

**SUPPORTED** `magnet → WebSeed Range and/or WebTorrent → local file`  
**REJECTED** `magnet → BT complete → localhost HTTP copy → IDM`  
**PARTIAL** `magnet → demand-driven BT pieces → localhost Range → IDM` (needs Windows `IDMan.exe`)

## Tests

```bash
npm test
npm run test:e2e
npm run bench:idm
npm run test:arch-d
```

Records: [docs/TEST-RECORD.md](docs/TEST-RECORD.md), [docs/LICENSES.md](docs/LICENSES.md), [docs/KNOWN-LIMITATIONS.md](docs/KNOWN-LIMITATIONS.md).
