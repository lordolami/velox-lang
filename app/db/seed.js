export async function seed(db) {
  db.transaction((tx) => {
    tx.collection("posts").set("hello", { id: "hello", title: "First Post", published: true });
  });
}
