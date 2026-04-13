const { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, relative, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const TARGETS = [
  resolve("examples", "showcase", "todo", "pages"),
  resolve("examples", "showcase", "dashboard", "pages"),
  resolve("examples", "showcase", "landing", "pages"),
];

function main() {
  const root = mkdtempSync(join(tmpdir(), "velox-deterministic-"));
  const distCli = resolve("dist", "cli.js");
  const failures = [];
  const reports = [];

  try {
    for (const sourceDir of TARGETS) {
      const name = sourceDir.split(/[\\/]/).slice(-2).join("-");
      const outA = join(root, `${name}-a`);
      const outB = join(root, `${name}-b`);
      runBuild(distCli, sourceDir, outA);
      runBuild(distCli, sourceDir, outB);

      const diff = diffDirs(outA, outB);
      reports.push({
        sourceDir,
        pass: diff.length === 0,
        differences: diff,
      });
      if (diff.length > 0) {
        failures.push(`${sourceDir}: ${diff[0]}`);
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  const result = {
    benchmark: "deterministic-build-output",
    pass: failures.length === 0,
    targets: reports,
    failures,
  };
  console.log(JSON.stringify(result, null, 2));
  if (failures.length > 0) {
    process.exit(1);
  }
}

function runBuild(distCli, sourceDir, outDir) {
  const run = spawnSync(process.execPath, [distCli, "build", sourceDir, "-o", outDir], {
    cwd: resolve("."),
    encoding: "utf8",
  });
  if (run.status !== 0) {
    throw new Error(
      `Deterministic build failed for ${sourceDir}\nstdout:\n${run.stdout || ""}\nstderr:\n${run.stderr || ""}`,
    );
  }
}

function diffDirs(a, b) {
  const filesA = listFiles(a);
  const filesB = listFiles(b);
  const differences = [];
  const union = new Set([...filesA.map((p) => relative(a, p)), ...filesB.map((p) => relative(b, p))]);
  for (const rel of [...union].sort()) {
    const fileA = join(a, rel);
    const fileB = join(b, rel);
    const existsA = safeExists(fileA);
    const existsB = safeExists(fileB);
    if (existsA !== existsB) {
      differences.push(`${rel}: existence mismatch`);
      continue;
    }
    const contentA = normalizeFile(readFileSync(fileA, "utf8"), rel);
    const contentB = normalizeFile(readFileSync(fileB, "utf8"), rel);
    if (contentA !== contentB) {
      differences.push(`${rel}: content mismatch`);
    }
  }
  return differences;
}

function normalizeFile(content, relPath) {
  if (relPath === "velox-manifest.json") {
    const parsed = JSON.parse(content);
    delete parsed.generatedAt;
    delete parsed.outputRoot;
    return JSON.stringify(parsed, null, 2);
  }
  return content;
}

function listFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (entry.isFile()) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

function safeExists(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

main();
