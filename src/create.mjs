import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

export async function createApp(target = "app") {
  const root = process.cwd();
  const appRoot = join(root, target);
  const pagesRoot = join(appRoot, "pages");

  ensureDir(pagesRoot);
  ensureDir(join(appRoot, "api"));
  ensureDir(join(appRoot, "db", "migrations"));

  const files = [
    {
      path: join(pagesRoot, "index.fs"),
      content: `export default function Home() {
  ~title = "Build full-stack apps with plain JavaScript."
  return \`
    <section class="hero">
      <p class="eyebrow">FastScript</p>
      <h1>\${title}</h1>
      <p>Simple syntax, fast compiler pipeline, deploy anywhere.</p>
      <button data-fs-counter>Counter: <span data-fs-counter-value>0</span></button>
    </section>
  \`;
}

export function hydrate({ root }) {
  const btn = root.querySelector("[data-fs-counter]");
  const value = root.querySelector("[data-fs-counter-value]");
  if (!btn || !value) return;
  let n = Number(value.textContent || "0");
  btn.addEventListener("click", () => {
    n += 1;
    value.textContent = String(n);
  });
}
`,
    },
    {
      path: join(pagesRoot, "_layout.fs"),
      content: `export default function Layout({ content, pathname, user }) {
  return \`
    <header class="nav">
      <a href="/">FastScript</a>
      <nav>
        <a href="/">Home</a>
        <a href="/private">Private</a>
      </nav>
      <small>\${user ? "Signed in" : "Guest"}</small>
    </header>
    <main class="page">\${content}</main>
    <footer class="footer">Built with FastScript</footer>
  \`;
}
`,
    },
    {
      path: join(pagesRoot, "404.fs"),
      content: `export default function NotFound() {
  return \`<section><h1>404</h1><p>Page not found.</p></section>\`;
}
`,
    },
    {
      path: join(pagesRoot, "private.fs"),
      content: `export default function PrivatePage({ user }) {
  return \`<section><h1>Private</h1><p>Hello \${user?.name ?? "anonymous"}</p></section>\`;
}

export async function GET(ctx) {
  try {
    const user = ctx.auth.requireUser();
    return ctx.helpers.json({ ok: true, user });
  } catch {
    return ctx.helpers.redirect("/");
  }
}
`,
    },
    {
      path: join(appRoot, "styles.css"),
      content: `:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; font: 16px/1.6 ui-sans-serif, system-ui; background: #050505; color: #fff; }
.nav { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 16px 24px; border-bottom: 1px solid #1f1f1f; }
.nav a { color: #d3d3ff; text-decoration: none; margin-right: 12px; }
.page { max-width: 980px; margin: 0 auto; padding: 40px 24px; }
.hero h1 { font-size: clamp(2rem, 6vw, 4rem); line-height: 1.05; margin: 0 0 10px; }
.eyebrow { color: #9f92ff; font-size: 12px; text-transform: uppercase; letter-spacing: .12em; }
.hero button { padding: 8px 12px; border: 1px solid #333; background: #0f0f0f; color: #fff; border-radius: 8px; cursor: pointer; }
.footer { border-top: 1px solid #1f1f1f; padding: 24px; color: #8a8a8a; }
`,
    },
    {
      path: join(appRoot, "api", "hello.js"),
      content: `export async function GET() {
  return { status: 200, json: { ok: true, message: "Hello from FastScript API" } };
}
`,
    },
    {
      path: join(appRoot, "api", "auth.js"),
      content: `export const schemas = {
  POST: { name: "string?" }
};

export async function POST(ctx) {
  const body = await ctx.input.validateBody(schemas.POST);
  const user = { id: "u_1", name: body.name || "Dev" };
  ctx.auth.login(user);
  return ctx.helpers.json({ ok: true, user });
}

export async function DELETE(ctx) {
  ctx.auth.logout();
  return ctx.helpers.json({ ok: true });
}
`,
    },
    {
      path: join(appRoot, "api", "upload.js"),
      content: `export const schemas = {
  POST: { key: "string", content: "string" }
};

export async function POST(ctx) {
  const body = await ctx.input.validateBody(schemas.POST);
  const put = ctx.storage.put(body.key, Buffer.from(body.content, "utf8"));
  return ctx.helpers.json({ ok: true, ...put, url: ctx.storage.url(body.key) });
}
`,
    },
    {
      path: join(appRoot, "api", "webhook.js"),
      content: `import { verifyWebhookRequest } from "../../src/webhook.mjs";

export async function POST(ctx) {
  const result = await verifyWebhookRequest(ctx.req, {
    secret: process.env.WEBHOOK_SECRET || "dev-secret",
    replayDir: ".fastscript"
  });
  if (!result.ok) return ctx.helpers.json({ ok: false, reason: result.reason }, 401);
  return ctx.helpers.json({ ok: true });
}
`,
    },
    {
      path: join(appRoot, "middleware.fs"),
      content: `export async function middleware(ctx, next) {
  const protectedRoute = ctx.pathname.startsWith("/private");
  if (protectedRoute && !ctx.user) {
    return ctx.helpers.redirect("/");
  }
  return next();
}
`,
    },
    {
      path: join(appRoot, "db", "migrations", "001_init.js"),
      content: `export async function up(db) {
  const users = db.collection("users");
  if (!users.get("u_1")) {
    users.set("u_1", { id: "u_1", name: "Dev" });
  }
}
`,
    },
    {
      path: join(appRoot, "db", "seed.js"),
      content: `export async function seed(db) {
  db.transaction((tx) => {
    tx.collection("posts").set("hello", { id: "hello", title: "First Post", published: true });
  });
}
`,
    },
  ];

  for (const file of files) {
    if (!existsSync(file.path)) writeFileSync(file.path, file.content, "utf8");
  }

  const count = readdirSync(pagesRoot).length;
  console.log(`created ${target} with ${count} page file(s)`);
}
