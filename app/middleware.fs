export async function middleware(ctx, next) {
  const protectedRoute = ctx.pathname.startsWith("/private");
  if (protectedRoute && !ctx.user) {
    return ctx.helpers.redirect("/");
  }
  return next();
}
