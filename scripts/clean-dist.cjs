const { rmSync } = require("node:fs");
const { resolve } = require("node:path");

rmSync(resolve("dist"), { recursive: true, force: true });
