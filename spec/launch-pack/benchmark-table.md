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
| Avg build time (4 showcase apps) | 253.413 ms |
| Avg render time (1200 iters) | 7.477 ms |
| Avg renders/sec | 1,105,500 |
| Total bundle size (4 apps) | 131.495 KB |

## `@fast` Kernel Summary

| Metric | Velox |
| --- | ---: |
| Average speedup vs plain JS | 2.650x |
| Best speedup | 3.323x |
| Worst speedup | 1.536x |

## Velox vs Next.js vs Vite (Launch Slot)

| Scenario | Velox | Next.js | Vite |
| --- | ---: | ---: | ---: |
| Static build latency (same demo app) | 253.413 ms avg (local suite) | Pending controlled baseline run | Pending controlled baseline run |
| Bundle size (same demo app set) | 131.495 KB total (4 apps) | Pending controlled baseline run | Pending controlled baseline run |

Note:
This table keeps only measured values in-repo. Next.js and Vite rows are intentionally marked pending until we run the same app fixtures under a shared benchmark harness.
