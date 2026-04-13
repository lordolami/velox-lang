export async function load(ctx) {
  const endpoint = "https://api.example.com/health";
  return {
    data: `Fetched from ${endpoint} for ${ctx.pathname}`,
  };
}
