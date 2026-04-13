import { randomUUID } from "node:crypto";

function base(level, msg, extra = {}) {
  return {
    ts: new Date().toISOString(),
    level,
    msg,
    ...extra,
  };
}

export function createLogger({ service = "fastscript" } = {}) {
  return {
    requestId() {
      return randomUUID();
    },
    info(msg, extra = {}) {
      console.log(JSON.stringify(base("info", msg, { service, ...extra })));
    },
    warn(msg, extra = {}) {
      console.warn(JSON.stringify(base("warn", msg, { service, ...extra })));
    },
    error(msg, extra = {}) {
      console.error(JSON.stringify(base("error", msg, { service, ...extra })));
    },
  };
}
