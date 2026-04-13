export default function PrivatePage({ user }) {
  return `<section><h1>Private</h1><p>Hello ${user?.name ?? "anonymous"}</p></section>`;
}

export async function GET(ctx) {
  try {
    const user = ctx.auth.requireUser();
    return ctx.helpers.json({ ok: true, user });
  } catch {
    return ctx.helpers.redirect("/");
  }
}
