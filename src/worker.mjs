import { runWorker } from "./jobs.mjs";

export async function runWorkerCommand() {
  await runWorker({ dir: ".fastscript", pollMs: Number(process.env.WORKER_POLL_MS || 350) });
}
