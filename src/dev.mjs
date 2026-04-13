import { runServer } from "./server-runtime.mjs";

export async function runDev() {
  await runServer({ mode: "development", watchMode: true, buildOnStart: true, port: 4173 });
}
