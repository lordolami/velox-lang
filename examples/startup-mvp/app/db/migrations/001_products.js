export async function up(db) {
  const products = db.collection("products");
  if (!products.get("p1")) products.set("p1", { id: "p1", name: "Starter Plan", price: 19 });
  if (!products.get("p2")) products.set("p2", { id: "p2", name: "Growth Plan", price: 49 });
  if (!products.get("p3")) products.set("p3", { id: "p3", name: "Scale Plan", price: 99 });
}
