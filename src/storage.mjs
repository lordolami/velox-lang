import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function sha(input) {
  return createHash("sha1").update(input).digest("hex");
}

export function createLocalStorage({ dir = ".fastscript/storage" } = {}) {
  const root = resolve(dir);
  mkdirSync(root, { recursive: true });
  return {
    type: "local",
    put(key, content) {
      const file = join(root, key);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, content);
      return { key, etag: sha(Buffer.isBuffer(content) ? content : Buffer.from(String(content))) };
    },
    get(key) {
      const file = join(root, key);
      if (!existsSync(file)) return null;
      return readFileSync(file);
    },
    delete(key) {
      rmSync(join(root, key), { force: true });
    },
    url(key) {
      return `/__storage/${key}`;
    },
  };
}

export function createS3CompatibleStorage({ bucket, endpoint, region = "auto", presignBaseUrl } = {}) {
  return {
    type: "s3-compatible",
    bucket,
    endpoint,
    region,
    // Designed for presigned URL workflows.
    async putWithPresignedUrl(url, content, contentType = "application/octet-stream") {
      const res = await fetch(url, { method: "PUT", headers: { "content-type": contentType }, body: content });
      if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`);
      return true;
    },
    async getWithPresignedUrl(url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`S3 download failed: ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    },
    presignPath(key, action = "get") {
      if (!presignBaseUrl) throw new Error("presignBaseUrl is required for presignPath");
      return `${presignBaseUrl}?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}&action=${encodeURIComponent(action)}`;
    },
  };
}
