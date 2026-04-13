import {
  copyFileSync,
  watch,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, extname, join, normalize, relative, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { compileFile } from "./compiler";
import { collectFileRoutes, emitRouterHtml, emitRouterRuntimeModule } from "./router";

export interface DevServerOptions {
  inputPath: string;
  outputDir?: string;
  port?: number;
  open?: boolean;
  routerEnabled?: boolean;
  routerTitle?: string;
  copyPublic?: boolean;
}

export interface DevServerHandle {
  close: () => void;
}

export function startDevServer(options: DevServerOptions): DevServerHandle {
  const inputPath = resolve(options.inputPath);
  const outputDir = resolve(options.outputDir ?? "dist-dev");
  const port = options.port ?? 3000;
  const routerEnabled = options.routerEnabled ?? true;
  const routerTitle = options.routerTitle ?? "Velox Dev";
  const copyPublic = options.copyPublic ?? true;
  const outputHtmlPath = join(outputDir, "index.html");
  const inputStats = statSafe(inputPath);
  if (!inputStats) {
    throw new Error(`Input path does not exist: ${inputPath}`);
  }
  const directoryMode = inputStats.isDirectory();
  const sourceRoot = directoryMode ? inputPath : dirname(inputPath);

  mkdirSync(outputDir, { recursive: true });

  const sseClients = new Set<ServerResponse<IncomingMessage>>();
  const buildCache = new Map<string, { fingerprint: string; outputRel: string }>();

  const build = (): void => {
    const startedAt = Date.now();
    try {
      const sources = directoryMode ? listVxFiles(sourceRoot) : [inputPath];
      if (sources.length === 0) {
        throw new Error(`No .vx files found in ${sourceRoot}`);
      }

      const builtModules: string[] = [];
      const seenSources = new Set<string>();
      let compiledCount = 0;
      let skippedCount = 0;
      let removedCount = 0;
      for (const sourceFile of sources) {
        seenSources.add(sourceFile);
        const rel = relative(sourceRoot, sourceFile);
        const outputRel = toJsOutputPath(rel);
        const outputJsPath = join(outputDir, outputRel);
        const fingerprint = fileFingerprint(sourceFile);
        const cached = buildCache.get(sourceFile);
        if (
          !cached ||
          cached.fingerprint !== fingerprint ||
          cached.outputRel !== outputRel ||
          !existsSync(outputJsPath)
        ) {
          compileFile({ inputPath: sourceFile, outputPath: outputJsPath });
          buildCache.set(sourceFile, { fingerprint, outputRel });
          compiledCount += 1;
        } else {
          skippedCount += 1;
        }
        builtModules.push(normalizeWebPath(outputRel));
      }

      for (const [cachedSource, cachedMeta] of buildCache) {
        if (seenSources.has(cachedSource)) {
          continue;
        }
        buildCache.delete(cachedSource);
        const staleOutputPath = join(outputDir, cachedMeta.outputRel);
        if (existsSync(staleOutputPath)) {
          unlinkSync(staleOutputPath);
        }
        removedCount += 1;
      }

      const copiedCss = copyCssFiles(sourceRoot, outputDir);
      const manifest = directoryMode ? collectFileRoutes(sourceRoot, sources) : { routes: [], notFoundModulePath: null };
      if (routerEnabled && (manifest.routes.length > 0 || manifest.notFoundModulePath)) {
        writeFileSync(
          join(outputDir, "__velox_router.js"),
          emitRouterRuntimeModule(manifest, { hotReload: true }),
          "utf8",
        );
        writeFileSync(outputHtmlPath, emitRouterHtml(routerTitle, { stylesheets: copiedCss }), "utf8");
      } else {
        const appModulePath = "./" + builtModules[0];
        writeFileSync(outputHtmlPath, makeDevHtml(appModulePath, copiedCss), "utf8");
      }
      copyRouteDataFiles(sourceRoot, outputDir);
      if (copyPublic) {
        copyPublicDirIfPresent(sourceRoot, outputDir);
      }
      broadcastReload(sseClients);
      console.log(
        `Rebuilt ${sources.length} file(s) from ${inputPath} in ${Date.now() - startedAt}ms (compiled ${compiledCount}, cached ${skippedCount}, removed ${removedCount})`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Dev build failed: ${message}`);
    }
  };

  build();

  const server = createServer((req, res) => {
    const urlPath = req.url ?? "/";
    if (urlPath === "/__velox_reload") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write("\n");
      sseClients.add(res);
      req.on("close", () => {
        sseClients.delete(res);
      });
      return;
    }

    const relative = normalize(urlPath === "/" ? "index.html" : urlPath.slice(1));
    if (relative.startsWith("..")) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    const filePath = join(outputDir, relative);
    if (!existsSync(filePath)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const body = readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
    res.end(body);
  });

  server.listen(port, () => {
    console.log(`Velox dev server running at http://localhost:${port}`);
    console.log(`Watching ${inputPath}${directoryMode ? " (recursive)" : ""}`);
    if (options.open) {
      openBrowser(`http://localhost:${port}`);
    }
  });

  let pending: NodeJS.Timeout | null = null;
  const watcher = watch(inputPath, { recursive: directoryMode }, (_event, changed) => {
    if (!shouldRebuildFromChange(changed)) {
      return;
    }
    console.log(`Change detected: ${changed ? changed : inputPath}`);
    if (pending) {
      clearTimeout(pending);
    }
    pending = setTimeout(() => {
      pending = null;
      build();
    }, 80);
  });

  const close = (): void => {
    watcher.close();
    server.close();
    for (const client of sseClients) {
      client.end();
    }
    sseClients.clear();
  };

  return { close };
}

function openBrowser(url: string): void {
  const platform = process.platform;
  if (platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  if (platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}

function broadcastReload(clients: Set<ServerResponse<IncomingMessage>>): void {
  for (const client of clients) {
    client.write("data: reload\n\n");
  }
}

function contentTypeFor(filePath: string): string {
  switch (extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".wasm":
      return "application/wasm";
    case ".json":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function listVxFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (shouldIgnoreSourceDir(entry.name)) {
          continue;
        }
        stack.push(full);
        continue;
      }
      if (entry.isFile() && hasVxExtension(full)) {
        out.push(full);
      }
    }
  }
  out.sort();
  return out;
}

function normalizeWebPath(path: string): string {
  return path.split(sep).join("/");
}

function fileFingerprint(path: string): string {
  const stats = statSync(path);
  return `${stats.size}:${Math.trunc(stats.mtimeMs)}`;
}

function statSafe(path: string): ReturnType<typeof statSync> | null {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function makeDevHtml(appModulePath: string, stylesheets: string[] = []): string {
  const stylesheetLinks = stylesheets
    .map((sheet) => sheet.trim())
    .filter((sheet) => sheet.length > 0)
    .map((sheet) => {
      const href = sheet.startsWith("./") || sheet.startsWith("/") ? sheet : `./${sheet}`;
      return `    <link rel="stylesheet" href="${escapeHtml(href)}" />`;
    })
    .join("\n");
  const stylesheetBlock = stylesheetLinks ? `${stylesheetLinks}\n` : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Velox Dev</title>
${stylesheetBlock}    <style>
      body {
        margin: 0;
        font-family: ui-monospace, Menlo, Consolas, monospace;
        background: #0b1020;
        color: #dbeafe;
        padding: 24px;
      }
      #app {
        border: 1px solid #334155;
        border-radius: 10px;
        padding: 16px;
        background: #111827;
        min-height: 56px;
      }
      .hint {
        color: #93c5fd;
        margin-top: 12px;
      }
      .status {
        color: #a5b4fc;
        margin-bottom: 10px;
      }
    </style>
  </head>
  <body>
    <h1>Velox Dev Server</h1>
    <p class="status" id="status">Loading app.js...</p>
    <div id="app"></div>
    <p class="hint">Fallback manual access: <code>window.__velox_exports</code></p>
    <script type="module">
      let cleanup = null;
      const statusEl = document.getElementById("status");
      const root = document.getElementById("app");

      const setStatus = (msg) => {
        if (statusEl) statusEl.textContent = msg;
      };

      const inferArgs = (fn) => {
        const src = String(fn);
        const match = src.match(/\\(([^)]*)\\)/);
        if (!match || !match[1].trim()) return [];
        return match[1].split(",").map((raw) => {
          const name = raw.trim();
          const n = name.toLowerCase();
          if (/^(on|handle)/.test(n) || /click|input|change|submit|key|handler/.test(n)) {
            return () => {};
          }
          if (/items|list|rows|data|children/.test(n)) {
            return [];
          }
          if (/count|num|index|id|step|age|size|len|total/.test(n)) {
            return 0;
          }
          if (/ready|active|enabled|visible|open|loading/.test(n)) {
            return false;
          }
          return name;
        });
      };

      const tryMount = (veloxExports) => {
        for (const [key, value] of Object.entries(veloxExports)) {
          if (typeof value !== "function") continue;
          try {
            const args = inferArgs(value);
            const instance = value(...args);
            if (!instance || typeof instance !== "object") continue;
            if (typeof instance.mount === "function") {
              if (cleanup) {
                try { cleanup(); } catch (_) {}
              }
              cleanup = instance.mount(root);
              setStatus("Mounted component: " + key);
              return true;
            }
            if (typeof instance.render === "function") {
              if (cleanup) {
                try { cleanup(); } catch (_) {}
                cleanup = null;
              }
              root.innerHTML = instance.render();
              setStatus("Rendered component: " + key);
              return true;
            }
          } catch (_) {
            // Ignore non-component exports.
          }
        }
        root.innerHTML =
          "<pre>No mountable component export found. Use window.__velox_exports in DevTools.</pre>";
        setStatus("No auto-mountable component found");
        return false;
      };

      const importFreshAndMount = async () => {
        try {
          const veloxExports = await import("${appModulePath}?t=" + Date.now());
          window.__velox_exports = veloxExports;
          tryMount(veloxExports);
        } catch (err) {
          console.error(err);
          setStatus("Failed to load app.js. Check terminal for compile errors.");
        }
      };

      await importFreshAndMount();

      const eventSource = new EventSource("/__velox_reload");
      eventSource.onmessage = () => {
        importFreshAndMount();
      };
    </script>
  </body>
</html>
`;
}

function shouldRebuildFromChange(changed: string | null): boolean {
  if (!changed) {
    return true;
  }
  if (hasVxExtension(changed)) {
    return true;
  }
  if (hasCssExtension(changed)) {
    return true;
  }
  if (changed.endsWith(".data.js")) {
    return true;
  }
  const normalized = changed.split("\\").join("/");
  if (normalized.startsWith("public/")) {
    return true;
  }
  return false;
}

function toJsOutputPath(pathValue: string): string {
  if (hasVxExtension(pathValue)) {
    return pathValue.slice(0, -extname(pathValue).length) + ".js";
  }
  return `${pathValue}.js`;
}

function hasVxExtension(pathValue: string): boolean {
  return extname(pathValue).toLowerCase() === ".vx";
}

function hasCssExtension(pathValue: string): boolean {
  return extname(pathValue).toLowerCase() === ".css";
}

function copyRouteDataFiles(sourceRoot: string, outputDir: string): void {
  const dataFiles = listFilesBySuffix(sourceRoot, ".data.js");
  for (const sourceFile of dataFiles) {
    const rel = relative(sourceRoot, sourceFile);
    const target = join(outputDir, rel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(sourceFile, target);
  }
}

function copyPublicDirIfPresent(sourceRoot: string, outputDir: string): void {
  const publicDir = join(sourceRoot, "public");
  if (!existsSync(publicDir)) {
    return;
  }
  const stats = statSafe(publicDir);
  if (!stats || !stats.isDirectory()) {
    return;
  }
  copyDir(publicDir, outputDir);
}

function copyDir(sourceDir: string, targetDir: string): void {
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const source = join(sourceDir, entry.name);
    const target = join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(source, target);
      continue;
    }
    if (entry.isFile()) {
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(source, target);
    }
  }
}

function listFilesBySuffix(root: string, suffix: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (shouldIgnoreSourceDir(entry.name)) {
          continue;
        }
        stack.push(full);
        continue;
      }
      if (entry.isFile() && full.endsWith(suffix)) {
        out.push(full);
      }
    }
  }
  out.sort();
  return out;
}

function copyCssFiles(sourceRoot: string, outputDir: string): string[] {
  const cssFiles = listCssFiles(sourceRoot);
  const copied: string[] = [];
  for (const sourceFile of cssFiles) {
    const rel = relative(sourceRoot, sourceFile);
    const target = join(outputDir, rel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(sourceFile, target);
    copied.push(normalizeWebPath(rel));
  }
  copied.sort();
  return copied;
}

function listCssFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (shouldIgnoreSourceDir(entry.name)) {
          continue;
        }
        stack.push(full);
        continue;
      }
      if (entry.isFile() && hasCssExtension(full)) {
        out.push(full);
      }
    }
  }
  out.sort();
  return out;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shouldIgnoreSourceDir(name: string): boolean {
  if (name === "node_modules") {
    return true;
  }
  if (name === ".git" || name === ".velox") {
    return true;
  }
  if (name === "dist" || name.startsWith("dist-")) {
    return true;
  }
  return false;
}
