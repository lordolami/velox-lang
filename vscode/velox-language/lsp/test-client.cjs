const { spawn } = require("node:child_process");

class LspTestClient {
  constructor(serverPath, options = {}) {
    this.serverPath = serverPath;
    this.cwd = options.cwd || process.cwd();
    this.proc = null;
    this.buffer = "";
    this.nextId = 1;
    this.pending = new Map();
    this.notifications = [];
    this.notificationWaiters = [];
  }

  async start() {
    this.proc = spawn(process.execPath, [this.serverPath, "--stdio"], {
      cwd: this.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.proc.stdout.on("data", (chunk) => this._onData(chunk));
    this.proc.stderr.on("data", (chunk) => {
      process.stderr.write(String(chunk));
    });
    this.proc.on("exit", () => {
      for (const [, p] of this.pending) {
        p.reject(new Error("LSP server exited unexpectedly."));
      }
      this.pending.clear();
    });
  }

  async stop() {
    if (!this.proc) return;
    try {
      this.proc.kill();
    } catch {
      // noop
    }
    this.proc = null;
  }

  request(method, params, timeoutMs = 6000) {
    const id = this.nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };
    const promise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`LSP request timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
    this._send(payload);
    return promise;
  }

  notify(method, params) {
    this._send({ jsonrpc: "2.0", method, params });
  }

  async waitForNotification(method, predicate, timeoutMs = 6000) {
    for (const note of this.notifications) {
      if (note.method === method && (!predicate || predicate(note.params))) {
        return note.params;
      }
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.notificationWaiters = this.notificationWaiters.filter((w) => w !== waiter);
        reject(new Error(`Timed out waiting for notification: ${method}`));
      }, timeoutMs);
      const waiter = {
        method,
        predicate: predicate || null,
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
      };
      this.notificationWaiters.push(waiter);
    });
  }

  _send(message) {
    if (!this.proc || !this.proc.stdin.writable) {
      throw new Error("LSP server not running.");
    }
    const body = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n`;
    this.proc.stdin.write(header + body, "utf8");
  }

  _onData(chunk) {
    this.buffer += chunk.toString("utf8");
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;
      const header = this.buffer.slice(0, headerEnd);
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }
      const len = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (this.buffer.length < bodyStart + len) break;
      const body = this.buffer.slice(bodyStart, bodyStart + len);
      this.buffer = this.buffer.slice(bodyStart + len);
      let msg;
      try {
        msg = JSON.parse(body);
      } catch {
        continue;
      }
      this._onMessage(msg);
    }
  }

  _onMessage(msg) {
    if (Object.prototype.hasOwnProperty.call(msg, "id")) {
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      if (msg.error) {
        pending.reject(new Error(msg.error.message || "LSP error"));
        return;
      }
      pending.resolve(msg.result);
      return;
    }
    if (!msg.method) return;
    const note = { method: msg.method, params: msg.params };
    this.notifications.push(note);
    const stillWaiting = [];
    for (const waiter of this.notificationWaiters) {
      if (waiter.method !== note.method) {
        stillWaiting.push(waiter);
        continue;
      }
      if (waiter.predicate && !waiter.predicate(note.params)) {
        stillWaiting.push(waiter);
        continue;
      }
      waiter.resolve(note.params);
    }
    this.notificationWaiters = stillWaiting;
  }
}

module.exports = {
  LspTestClient,
};
