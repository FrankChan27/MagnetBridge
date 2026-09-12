# Benchmark

All numbers are measured, not inferred.

## Q1 — Localhost IDM-style extra copy (64 MiB)

See [TEST-RECORD.md](TEST-RECORD.md). Direct filesystem copy was ~6× faster than a single Range GET and ~8× faster than eight parallel Range GETs on loopback. Multi-connection HTTP does not help when the bytes are already local. That is why Architecture B is **REJECTED** as an accelerator.

## Q2 — Architecture D demand-driven frontend (SIMULATED_IDM_CLIENT)

This is **not** a real IDMan.exe run. See [architecture-d-sandbox.json](architecture-d-sandbox.json).

Relevant costs, not “is D faster than A”:

- Extra hop: BT/WebSeed piece fetch + HTTP Range + client write.
- Second representation: verified pieces stay in the in-memory store while the client writes the final file. That is streaming, not a post-complete copy.
- `blockedMs` is time spent waiting on missing pieces.
- `priorityChanges` counts Range-driven piece priority bumps. Many connections increase this.
- `cacheHits` vs `cacheMisses` shows overlapping Range reuse.

Architecture A remains the faster path to a local file. Architecture D is only justified if keeping IDM as the Windows UI is worth that hop.

## WebSeed downloads (Architecture A)

| Payload | Bytes | Time | Throughput | Pieces verified |
| --- | --- | --- | --- | --- |
| probe | 49 257 | 54 ms | 0.88 MB/s (tiny, setup-dominated) | 4 |
| Sintel.en.srt | 1 514 | 2.1 s | setup-dominated; 128 KiB piece | 1 |
| Sintel poster.jpg | 46 115 | 1.8 s | setup-dominated; tail piece | 1 |

These are correctness tests, not WAN speed contests. Peak/average WAN throughput for a 123 MB Sintel.mp4 or a 5.91 GB Ubuntu ISO was not claimed.
