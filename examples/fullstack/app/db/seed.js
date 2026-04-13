export async function seed(db) {
  db.collection("orders").set("demo", { id: "demo", sku: "starter", qty: 1 });
}
