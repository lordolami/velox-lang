export function load() {
  return {
    data: {
      steps: [
        "Initialize a new project",
        "Create pages with .vx files",
        "Run build and preview",
        "Deploy with a cloud target bundle",
      ],
      checkCommand: "npm run startup:ready",
      checkScope: "build, tests, lsp, perf, deterministic output, deploy smoke",
    },
  };
}

