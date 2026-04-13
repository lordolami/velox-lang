export async function POST(ctx) {
  const items = ctx.db.collection("carts").all();
  const total = items.reduce((s, i) => s + i.qty * 10, 0);
  const id = `o_${Date.now()}`;
  ctx.db.collection("orders").set(id, { id, total, status: "paid" });
  ctx.queue.enqueue("send-receipt", { orderId: id });
  return ctx.helpers.json({ ok: true, orderId: id, total });
}
