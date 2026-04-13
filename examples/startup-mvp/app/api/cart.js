export const schemas = { POST: { productId: "string", qty: "int" } };

export async function POST(ctx) {
  const body = await ctx.input.validateBody(schemas.POST);
  const cart = ctx.db.collection("carts");
  const id = `c_${Date.now()}`;
  cart.set(id, { id, ...body });
  return ctx.helpers.json({ ok: true, id });
}
