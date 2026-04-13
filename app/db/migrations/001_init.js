export async function up(db) {
  const users = db.collection("users");
  if (!users.get("u_1")) {
    users.set("u_1", { id: "u_1", name: "Dev" });
  }
}
