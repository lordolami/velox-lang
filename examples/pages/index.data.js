export async function load(ctx) {
  return "home data: " + (ctx.pathname || "/");
}