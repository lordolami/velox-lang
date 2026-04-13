# Velox Performance Methodology

## Benchmark Suite: `@fast` Wasm vs Plain JS

Command:

```bash
npm run build
npm run bench:fast
```

What it does:
1. Compiles benchmark kernels with Velox CLI:
   - `benchmarks/fast-sum.vx`
   - `benchmarks/fast-multiaccum.vx`
   - `benchmarks/fast-arith.vx`
2. Loads generated Wasm-backed functions.
3. Runs identical workloads in:
   - plain JavaScript implementations
   - generated `@fast` implementations
4. Prints per-case durations plus overall summary.

Sample output shape:

```json
{
  "runtime": "v24.x",
  "cases": [
    {
      "benchmark": "sumTo(n) with internal loop",
      "iterations": 30000,
      "n": 3000,
      "jsMs": 194.56,
      "wasmMs": 81.367,
      "speedup": 2.391
    },
    {
      "benchmark": "multiAccum(n) multi-register kernel",
      "iterations": 16000,
      "n": 7000,
      "jsMs": 792.877,
      "wasmMs": 272.359,
      "speedup": 2.911
    },
    {
      "benchmark": "arithSeries(n) dual accumulator kernel",
      "iterations": 20000,
      "n": 6000,
      "jsMs": 602.473,
      "wasmMs": 163.003,
      "speedup": 3.696
    }
  ],
  "summary": {
    "averageSpeedup": 2.999,
    "bestSpeedup": 3.696,
    "worstSpeedup": 2.391
  }
}
```

## Notes

1. This benchmark measures hot-loop arithmetic only.
2. UI rendering and network latency are not part of this measurement.
3. Always compare on the same machine and Node/browser version.
4. Tiny per-call kernels can still be slower than plain JS due to JS<->Wasm call overhead.
5. Batched kernels (internal loops) are the current optimization path and can show speedups.
6. Latest local run on April 12, 2026 showed ~`2.39x` to `3.70x` speedup on batched kernels.

## Benchmark Suite: App-Level Build + Render

Command:

```bash
npm run build
npm run bench:apps
npm run bench:apps:gate
npm run bench:apps:report
```

What it does:
1. Compiles full app suite (Todo, Dashboard, Landing, Core Pages, Velox Web) using `velox build`.
2. Measures end-to-end build duration per app.
3. Captures output artifact profile (file counts and bundle size).
4. Loads generated modules and benchmarks component `render()` throughput.
5. `bench:apps:gate` compares measured output against `benchmarks/app-baseline.json`.
6. `bench:apps:report` writes a human-readable and JSON report to `spec/reports/`.

Sample output shape:

```json
{
  "benchmark": "app-level",
  "runtime": "v24.x",
  "apps": [
    {
      "app": "todo",
      "buildMs": 35.218,
      "files": {
        "js": 5,
        "css": 0,
        "wasm": 0,
        "totalKb": 18.114
      },
      "runtime": {
        "renderFns": 4,
        "iterations": 1200,
        "renderMs": 92.87,
        "rendersPerSecond": 51698.4
      }
    }
  ],
  "summary": {
    "appCount": 5,
    "avgBuildMs": 193.138,
    "avgRenderMs": 11.007,
    "avgRendersPerSecond": 1458429.182
  }
}
```
