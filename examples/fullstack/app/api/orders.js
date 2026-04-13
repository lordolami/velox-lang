export const schemas = { POST: { sku: "string", qty: "int" } };
export async function POST(ctx) {
  const body = await ctx.input.validateBody(schemas.POST);
  const order = { id: Date.now().toString(36), ...body };
  ctx.db.collection("orders").set(order.id, order);
  ctx.queue.enqueue("send-order-email", { orderId: order.id });
  return ctx.helpers.json({ ok: true, order });
}
