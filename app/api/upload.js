export const schemas = {
  POST: { key: "string", content: "string" }
};

export async function POST(ctx) {
  const body = await ctx.input.validateBody(schemas.POST);
  const put = ctx.storage.put(body.key, Buffer.from(body.content, "utf8"));
  return ctx.helpers.json({ ok: true, ...put, url: ctx.storage.url(body.key) });
}
