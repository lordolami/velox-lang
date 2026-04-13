# Benchmark Table (v1)

Run date: 2026-04-13 (local machine)

Commands:

```bash
npm run bench:apps
npm run bench:fast
```

## App-Level Summary

| Metric | Velox |
| --- | ---: |
| Avg build time (5 apps) | 193.138 ms |
| Avg render time (1200 iters) | 11.007 ms |
| Avg renders/sec | 1,458,429 |
| Total bundle size (5 apps) | 199.713 KB |

## `@fast` Kernel Summary

| Metric | Velox |
| --- | ---: |
| Average speedup vs plain JS | 2.737x |
| Best speedup | 2.998x |
| Worst speedup | 2.502x |

## Velox vs Next.js vs Vite (Launch Slot)

| Scenario | Velox | Next.js | Vite |
| --- | ---: | ---: | ---: |
| Static build latency (same demo app) | 193.138 ms avg (local suite) | Pending controlled baseline run | Pending controlled baseline run |
| Bundle size (same demo app set) | 199.713 KB total (5 apps) | Pending controlled baseline run | Pending controlled baseline run |

Note:
This table keeps only measured values in-repo. Next.js and Vite rows are intentionally marked pending until we run the same app fixtures under a shared benchmark harness.
