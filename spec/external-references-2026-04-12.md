# External References Snapshot (2026-04-12)

Purpose:
- Capture official external guidance that influences Velox v1-v6 planning decisions.

## 1) Node.js Release Policy

Source:
- https://nodejs.org/en/about/previous-releases

Relevant guidance:
- Production apps should use Active LTS or Maintenance LTS releases.

Planning impact:
- Velox CI/release matrix should track current Active/Maintenance LTS Node lines.
- Drop unsupported Node versions on major releases only.

## 2) VS Code Language Server Guidance

Source:
- https://code.visualstudio.com/api/language-extensions/language-server-extension-guide

Relevant guidance:
- Language server model separates a Language Client extension and a Language Server process.
- The split is recommended for heavy analysis to protect editor responsiveness.

Planning impact:
- v2 must migrate from extension-host-only intelligence to a true client/server LSP architecture.

## 3) LSP Protocol Contract

Source:
- https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/

Relevant guidance:
- Standard protocol surface for diagnostics, completion, definition, references, rename, etc.

Planning impact:
- Velox language tooling should align with LSP 3.17 capability contracts for editor portability.

## 4) Wasm MIME Requirement

Source:
- https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/instantiateStreaming_static

Relevant guidance:
- `.wasm` should be served as `application/wasm` for streaming instantiate path.

Planning impact:
- v1/v4 deploy guidance must keep explicit MIME checks in host documentation and verification scripts.

## 5) Static Deploy Baseline (Next.js Reference)

Source:
- https://nextjs.org/docs/app/guides/static-exports

Relevant guidance:
- Static export mode outputs deployable static assets and documents unsupported server-only dynamic features.

Planning impact:
- Velox framework and cloud docs should explicitly separate static-capable features from dynamic/server-required features.
