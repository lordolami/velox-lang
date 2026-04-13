export async function POST(ctx) {
  const user = { id: "u_1", name: "Dev" };
  ctx.auth.login(user);
  return ctx.helpers.json({ ok: true, user });
}

export async function DELETE(ctx) {
  ctx.auth.logout();
  return ctx.helpers.json({ ok: true });
}
