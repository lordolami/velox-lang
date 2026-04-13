# Feedback Loop for AI Generation

## Goal

Make Velox generation quality improve from real edits.

## Signals to Capture

1. Prompt text (or normalized intent category)
2. Generated `.vx` output
3. Human edits after generation
4. Final accepted code snapshot
5. Validation result (`pass/fail` + diagnostic codes)

## Loop

1. Generate -> validate with `velox check`.
2. Capture corrections.
3. Add correction patterns to recipes/spec examples.
4. Re-run `bench:ai` with updated corpus.

## Hard Rule

Never train on code that fails deterministic or diagnostics gates.

