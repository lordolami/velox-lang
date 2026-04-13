import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export type VeloxTemplate = "pages" | "single";

export interface InitProjectOptions {
  targetDir: string;
  template: VeloxTemplate;
  force?: boolean;
}

export interface InitProjectResult {
  targetDir: string;
  files: string[];
  template: VeloxTemplate;
}

export function initProject(options: InitProjectOptions): InitProjectResult {
  const targetDir = resolve(options.targetDir);
  const force = options.force ?? false;
  ensureTargetReady(targetDir, force);

  const files: Array<{ path: string; content: string }> = [
    { path: "package.json", content: packageJsonTemplate(targetDir) },
    { path: "velox.config.json", content: veloxConfigTemplate() },
    { path: "README.md", content: readmeTemplate(options.template) },
  ];

  if (options.template === "single") {
    files.push(
      {
        path: "app.vx",
        content: singleAppTemplate(),
      },
      {
        path: "public/robots.txt",
        content: "User-agent: *\nAllow: /\n",
      },
    );
  } else {
    files.push(
      {
        path: "pages/index.vx",
        content: pagesIndexTemplate(),
      },
      {
        path: "pages/about.vx",
        content: pagesAboutTemplate(),
      },
      {
        path: "pages/_layout.vx",
        content: pagesLayoutTemplate(),
      },
      {
        path: "pages/404.vx",
        content: pages404Template(),
      },
      {
        path: "public/robots.txt",
        content: "User-agent: *\nAllow: /\n",
      },
    );
  }

  const written: string[] = [];
  for (const file of files) {
    const full = join(targetDir, file.path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, file.content, "utf8");
    written.push(full);
  }

  return {
    targetDir,
    files: written,
    template: options.template,
  };
}

function ensureTargetReady(targetDir: string, force: boolean): void {
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
    return;
  }
  const items = readdirSync(targetDir);
  if (items.length === 0) {
    return;
  }
  if (!force) {
    throw new Error(
      `Target directory is not empty: ${targetDir}. Use --force to scaffold into a non-empty folder.`,
    );
  }
}

function packageJsonTemplate(targetDir: string): string {
  const name = safePackageName(targetDir);
  return `{
  "name": "${name}",
  "private": true,
  "scripts": {
    "dev": "velox dev .",
    "build": "velox build .",
    "check": "velox check ."
  }
}
`;
}

function veloxConfigTemplate(): string {
  return `{
  "build": {
    "outDir": "dist",
    "copyPublic": true,
    "router": {
      "enabled": true,
      "title": "Velox App"
    }
  },
  "dev": {
    "outDir": "dist-dev",
    "port": 3000,
    "open": false,
    "copyPublic": true,
    "router": {
      "enabled": true,
      "title": "Velox Dev"
    }
  },
  "deploy": {
    "target": "local",
    "appName": "velox-app",
    "buildOutDir": "dist",
    "outputDir": ".velox/deployments"
  }
}
`;
}

function readmeTemplate(template: VeloxTemplate): string {
  return `# Velox App

Template: \`${template}\`

## Commands

\`\`\`bash
npm run dev
npm run build
npm run check
\`\`\`
`;
}

function singleAppTemplate(): string {
  return `component App {
  render {
    <section>
      <h1>Velox Single App</h1>
      <p>Edit app.vx and run: velox dev .</p>
    </section>
  }
}
`;
}

function pagesLayoutTemplate(): string {
  return `component RootLayout(content, pathname) {
  render {
    <div>
      <header>
        <strong>Velox App</strong>
        <small>{pathname}</small>
        <nav>
          <a href="/">Home</a>
          <a href="/about">About</a>
        </nav>
      </header>
      <main>{content}</main>
    </div>
  }
}
`;
}

function pagesIndexTemplate(): string {
  return `component Home {
  render {
    <section>
      <h1>Welcome to Velox</h1>
      <p>Start building from pages/index.vx.</p>
      <a href="/about">About page</a>
    </section>
  }
}
`;
}

function pagesAboutTemplate(): string {
  return `component About {
  render {
    <section>
      <h1>About</h1>
      <p>This app uses Velox pages router.</p>
      <a href="/">Back Home</a>
    </section>
  }
}
`;
}

function pages404Template(): string {
  return `component NotFound {
  render {
    <section>
      <h1>404</h1>
      <p>Page not found.</p>
      <a href="/">Go Home</a>
    </section>
  }
}
`;
}

function safePackageName(targetDir: string): string {
  const base = targetDir.split(/[/\\\\]/).at(-1) || "velox-app";
  return base
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "velox-app";
}
