# MagnetBridge

Paste a magnet you already have the right to download. Press start. The file lands on disk.

IDM is **not** part of this product. Research: [docs/ADR-001-architecture.md](docs/ADR-001-architecture.md). Verdict: **REJECTED**.

## 以后我拿到一个 magnet，怎么用

1. 确认这份资源你有权下载。这里没有搜索，没有索引，也不会帮你绕过任何限制。
2. 打开 MagnetBridge（网页，或 Windows 下的 `native/windows/magnetbridge.cmd`）。
3. 粘贴 `magnet:?xt=urn:btih:…`，勾选确认，点开始。
4. 可选：点「保存目录」选一个 Windows 文件夹。不选的话，完成后走浏览器下载。
5. 等到状态变成「完成」。分片 SHA-1 已经校验过。关掉再开，未完成任务会停在「已暂停」，点继续即可。

不要手工去点 qBittorrent WebUI，也不要手工把所谓直链喂给 IDM。

## Windows local CLI

Needs Node.js 22+.

```bat
native\windows\magnetbridge.cmd --out %USERPROFILE%\Downloads\MagnetBridge "magnet:?xt=urn:btih:..."
```

```bash
node cli/magnetbridge.mjs --out ./downloads "magnet:?xt=urn:btih:..."
```

## Architecture

**SUPPORTED** `magnet → WebSeed Range and/or WebTorrent → local file`  
**REJECTED** `magnet → BT → localhost HTTP → IDM`
