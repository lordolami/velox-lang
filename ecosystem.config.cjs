module.exports = { apps: [{ name: "fastscript-app", script: "node", args: "./src/cli.mjs start", env: { NODE_ENV: "production", PORT: 4173 } }] };
