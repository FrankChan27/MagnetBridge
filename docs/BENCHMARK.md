# Benchmark

All numbers are measured, not inferred.

## Localhost IDM-style bridge (64 MiB)

See [TEST-RECORD.md](TEST-RECORD.md). Direct filesystem copy was ~6× faster than a single Range GET and ~8× faster than eight parallel Range GETs on loopback. Multi-connection HTTP does not help when the bytes are already local. That is the entire proposed IDM last mile.

## WebSeed downloads

| Payload | Bytes | Time | Throughput | Pieces verified |
| --- | --- | --- | --- | --- |
| probe | 49 257 | 54 ms | 0.88 MB/s (tiny, setup-dominated) | 4 |
| Sintel.en.srt | 1 514 | 2.1 s | setup-dominated; 128 KiB piece | 1 |
| Sintel poster.jpg | 46 115 | 1.8 s | setup-dominated; tail piece | 1 |

These are correctness tests, not WAN speed contests. Peak/average WAN throughput for a 123 MB Sintel.mp4 or a 5.91 GB Ubuntu ISO was not claimed.

## BT-only vs BT→IDM

BT→IDM was not run against a real IDMan.exe (this host is Linux). The loopback experiment is the relevant comparison: once BT (or WebSeed) has the bytes, handing them to IDM is extra copy. **BT-only wins.**
