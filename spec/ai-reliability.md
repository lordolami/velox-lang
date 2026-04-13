# Velox AI Reliability Benchmark

## Goal

Measure whether a constrained, simple Velox authoring style is:
- easy for AI to generate correctly
- strict enough to reject malformed output predictably

## Command

```bash
npm run build
npm run bench:ai
```

## Suite Structure

- `ai-suite/valid/*.vx`
  - Files expected to compile successfully.
- `ai-suite/invalid/*.vx`
  - Files expected to fail compilation with diagnostics.

The benchmark reports:
- valid compile pass rate
- invalid rejection rate
- overall pass rate

## Why This Matters

This directly tracks the "hallucination gap":
- If valid patterns fail too often, syntax/tooling is too brittle.
- If invalid patterns pass, grammar is too loose.

## Current Policy

For launch readiness:
1. Valid suite compile pass rate must stay at `100%`.
2. Invalid suite rejection rate must stay at `100%`.
3. Any regression blocks release until fixed.
