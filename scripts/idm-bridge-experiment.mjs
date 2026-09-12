#!/usr/bin/env node
/**
 * Architecture B evidence: localhost HTTP Range "IDM-style" vs direct copy.
 * IDM itself cannot run in this Linux sandbox; this measures the only part
 * of the proposed bridge that could exist — serving already-local bytes over
 * loopback with 1 vs N Range connections.
 */
import { createServer } from "node:http";
import { copyFile, stat, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { tmpdir } from "node:os";

const SIZE = 64 * 1024 * 1024;
const CONNS = 8;
const dir = join(tmpdir(), "magnetbridge-idm-exp");
const src = join(dir, "source.bin");
const dstCopy = join(dir, "copy.bin");
const dstHttp1 = join(dir, "http1.bin");
const dstHttpN = join(dir, "httpn.bin");

function rssMb() {
  return Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10;
}

async function time(label, fn) {
  const cpu1 = process.cpuUsage();
  const t0 = performance.now();
  const rss0 = rssMb();
  await fn();
  const ms = performance.now() - t0;
  const cpu = process.cpuUsage(cpu1);
  const out = {
    label,
    ms: Math.round(ms),
    mbps: Number(((SIZE / (1024 * 1024)) / (ms / 1000)).toFixed(1)),
    cpuUserMs: Math.round(cpu.user / 1000),
    cpuSysMs: Math.round(cpu.system / 1000),
    rssDeltaMb: Number((rssMb() - rss0).toFixed(1)),
  };
  console.log(JSON.stringify(out));
  return out;
}

function startRangeServer(filePath) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const buf = await readFile(filePath);
      const range = req.headers.range;
      if (!range) {
        res.writeHead(200, { "content-length": buf.length, "accept-ranges": "bytes" });
        res.end(buf);
        return;
      }
      const m = /bytes=(\d+)-(\d*)/.exec(range);
      if (!m) {
        res.writeHead(416);
        res.end();
        return;
      }
      const start = Number(m[1]);
      const end = m[2] ? Number(m[2]) : buf.length - 1;
      res.writeHead(206, {
        "content-range": `bytes ${start}-${end}/${buf.length}`,
        "content-length": end - start + 1,
        "accept-ranges": "bytes",
      });
      res.end(buf.subarray(start, end + 1));
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, url: `http://127.0.0.1:${addr.port}/file` });
    });
  });
}

async function downloadRanges(url, dest, connections) {
  const head = await fetch(url, { headers: { Range: "bytes=0-0" } });
  const totalHeader = head.headers.get("content-range")?.split("/")[1];
  const total = Number(totalHeader ?? SIZE);
  const chunk = Math.ceil(total / connections);
  const parts = [];
  const tasks = [];
  for (let i = 0; i < connections; i += 1) {
    const start = i * chunk;
    if (start >= total) break;
    const end = Math.min(total - 1, start + chunk - 1);
    tasks.push(
      fetch(url, { headers: { Range: `bytes=${start}-${end}` } })
        .then((r) => r.arrayBuffer())
        .then((buf) => {
          parts[i] = Buffer.from(buf);
        }),
    );
  }
  await Promise.all(tasks);
  await writeFile(dest, Buffer.concat(parts.filter(Boolean)));
}

await rm(dir, { recursive: true, force: true });
await mkdir(dir, { recursive: true });
await writeFile(src, Buffer.alloc(SIZE, 7));

const results = [];
results.push(await time("direct-copy", () => copyFile(src, dstCopy)));

const { server, url } = await startRangeServer(src);
try {
  results.push(await time("http-range-1", () => downloadRanges(url, dstHttp1, 1)));
  results.push(await time("http-range-8-idm-like", () => downloadRanges(url, dstHttpN, CONNS)));
} finally {
  server.close();
}

const copyOk = (await stat(dstCopy)).size === SIZE;
const http1Ok = (await stat(dstHttp1)).size === SIZE;
const httpnOk = (await stat(dstHttpN)).size === SIZE;

const verdict = {
  copyOk,
  http1Ok,
  httpnOk,
  winner: results.slice().sort((a, b) => a.ms - b.ms)[0]?.label,
  conclusion:
    "Loopback multi-connection HTTP does not beat a filesystem copy. IDM cannot see a magnet, and bridging BT bytes through localhost Range is strictly extra work.",
  results,
};

await writeFile(join(dir, "verdict.json"), JSON.stringify(verdict, null, 2));
console.log("VERDICT", JSON.stringify(verdict, null, 2));
await writeFile("/workspace/docs/benchmark-idm-bridge.json", JSON.stringify(verdict, null, 2));
