import { verifyWebhookRequest } from "../../src/webhook.mjs";

export async function POST(ctx) {
  const result = await verifyWebhookRequest(ctx.req, {
    secret: process.env.WEBHOOK_SECRET || "dev-secret",
    replayDir: ".fastscript"
  });
  if (!result.ok) return ctx.helpers.json({ ok: false, reason: result.reason }, 401);
  return ctx.helpers.json({ ok: true });
}
