export async function load(ctx) {
  const products = ctx.db.collection("products").all();
  return { products };
}

export default function Home({ products }) {
  const cards = (products || []).map((p) => `<article style="border:1px solid #ddd;padding:12px;border-radius:10px"><h3>${p.name}</h3><p>$${p.price}</p><button data-add="${p.id}">Add to cart</button></article>`).join("");
  return `<section><h1>Startup MVP Store</h1><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">${cards}</div><p><a href="/dashboard">Dashboard</a></p></section>`;
}

export function hydrate({ root }) {
  for (const b of root.querySelectorAll('[data-add]')) {
    b.addEventListener('click', async () => {
      await fetch('/api/cart', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ productId: b.getAttribute('data-add'), qty: 1 })});
      alert('Added to cart');
    });
  }
}
