export async function load(ctx) {
  const orders = ctx.db.collection("orders").all();
  return { orders };
}

export default function Dashboard({ orders }) {
  const rows = (orders || []).map((o) => `<li>${o.id} • ${o.total} • ${o.status}</li>`).join("");
  return `<section><h1>Dashboard</h1><ul>${rows}</ul></section>`;
}
