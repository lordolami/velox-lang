import { createServer, type IncomingMessage } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { spawn } from "node:child_process";

export interface PreviewServerOptions {
  dir: string;
  port?: number;
  open?: boolean;
  spaFallback?: boolean;
}

export interface PreviewServerHandle {
  url: string;
  close: () => void;
}

export function startPreviewServer(options: PreviewServerOptions): PreviewServerHandle {
  const rootDir = resolve(options.dir);
  if (!existsSync(rootDir) || !statSync(rootDir).isDirectory()) {
    throw new Error(`Preview directory not found: ${rootDir}`);
  }

  const requestedPort = options.port ?? 4173;
  const open = options.open ?? false;
  const spaFallback = options.spaFallback ?? true;
  const fallbackIndexPath = join(rootDir, "index.html");
  const hasIndexFallback = spaFallback && existsSync(fallbackIndexPath);

  const server = createServer((req: IncomingMessage, res) => {
    const rawPath = req.url ?? "/";
    const normalized = normalize(rawPath === "/" ? "index.html" : rawPath.replace(/^\//, ""));
    if (normalized.startsWith("..")) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    const filePath = join(rootDir, normalized);
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      const body = readFileSync(filePath);
      res.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
      res.end(body);
      return;
    }

    if (hasIndexFallback) {
      const body = readFileSync(fallbackIndexPath);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(body);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  });

  server.listen(requestedPort);
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    throw new Error("Failed to start preview server.");
  }
  const url = `http://localhost:${addr.port}`;

  console.log(`Velox preview server running at ${url}`);
  console.log(`Serving ${rootDir}`);

  if (open) {
    openBrowser(url);
  }

  return {
    url,
    close: () => {
      server.close();
    },
  };
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
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

