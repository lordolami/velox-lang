export async function load(ctx) {
  return "post slug=" + (ctx.params?.slug || "unknown");
}