import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compileProject } from "../src/compiler";
import { lex } from "../src/lexer";
import { parse } from "../src/parser";

describe("snapshot regressions", () => {
  it("keeps lexer tokenization stable for core syntax", () => {
    const source = `
import { sum as add } from "./math.vx"
component Counter(label) {
  ~count = add(1, 2)
  render { <p>{label}:{count}</p> }
}
`;
    const tokens = lex(source)
      .filter((token) => token.type !== "eof")
      .map((token) => ({ type: token.type, lexeme: token.lexeme }));
    expect(tokens).toMatchInlineSnapshot(`
      [
        {
          "lexeme": "import",
          "type": "identifier",
        },
        {
          "lexeme": "{",
          "type": "lbrace",
        },
        {
          "lexeme": "sum",
          "type": "identifier",
        },
        {
          "lexeme": "as",
          "type": "identifier",
        },
        {
          "lexeme": "add",
          "type": "identifier",
        },
        {
          "lexeme": "}",
          "type": "rbrace",
        },
        {
          "lexeme": "from",
          "type": "identifier",
        },
        {
          "lexeme": "./math.vx",
          "type": "string",
        },
        {
          "lexeme": "component",
          "type": "component",
        },
        {
          "lexeme": "Counter",
          "type": "identifier",
        },
        {
          "lexeme": "(",
          "type": "lparen",
        },
        {
          "lexeme": "label",
          "type": "identifier",
        },
        {
          "lexeme": ")",
          "type": "rparen",
        },
        {
          "lexeme": "{",
          "type": "lbrace",
        },
        {
          "lexeme": "~",
          "type": "tilde",
        },
        {
          "lexeme": "count",
          "type": "identifier",
        },
        {
          "lexeme": "=",
          "type": "equals",
        },
        {
          "lexeme": "add",
          "type": "identifier",
        },
        {
          "lexeme": "(",
          "type": "lparen",
        },
        {
          "lexeme": "1",
          "type": "number",
        },
        {
          "lexeme": ",",
          "type": "comma",
        },
        {
          "lexeme": "2",
          "type": "number",
        },
        {
          "lexeme": ")",
          "type": "rparen",
        },
        {
          "lexeme": "render",
          "type": "render",
        },
        {
          "lexeme": "{",
          "type": "lbrace",
        },
        {
          "lexeme": "<",
          "type": "symbol",
        },
        {
          "lexeme": "p",
          "type": "identifier",
        },
        {
          "lexeme": ">",
          "type": "symbol",
        },
        {
          "lexeme": "{",
          "type": "lbrace",
        },
        {
          "lexeme": "label",
          "type": "identifier",
        },
        {
          "lexeme": "}",
          "type": "rbrace",
        },
        {
          "lexeme": ":",
          "type": "colon",
        },
        {
          "lexeme": "{",
          "type": "lbrace",
        },
        {
          "lexeme": "count",
          "type": "identifier",
        },
        {
          "lexeme": "}",
          "type": "rbrace",
        },
        {
          "lexeme": "<",
          "type": "symbol",
        },
        {
          "lexeme": "/",
          "type": "symbol",
        },
        {
          "lexeme": "p",
          "type": "identifier",
        },
        {
          "lexeme": ">",
          "type": "symbol",
        },
        {
          "lexeme": "}",
          "type": "rbrace",
        },
        {
          "lexeme": "}",
          "type": "rbrace",
        },
      ]
    `);
  });

  it("keeps parser AST summary stable for core syntax", () => {
    const source = `
import { sum as add } from "./math.vx"
component Counter(label, items) {
  ~count = add(1, 2)
  render {
    <button>{label}:{count}</button>
    {#each items as item, i}<span>{i}:{item}</span>{/each}
  }
}
@fast add1(a: i32) -> i32 { a + 1 }
`;
    const ast = parse(lex(source), source);
    const summary = ast.body.map((node) => {
      if (node.kind === "Import") {
        return {
          kind: node.kind,
          source: node.source,
          namedImports: node.namedImports,
        };
      }
      if (node.kind === "Component") {
        return {
          kind: node.kind,
          name: node.name,
          params: node.params.map((p) => `${p.name}:${p.type}`),
          state: node.state.map((s) => s.name),
          renderSegments: node.render.segments.map((seg) => seg.kind),
        };
      }
      return {
        kind: node.kind,
        name: node.name,
        params: node.params.map((p) => `${p.name}:${p.type}`),
        returnType: node.returnType,
      };
    });

    expect(summary).toMatchInlineSnapshot(`
      [
        {
          "kind": "Import",
          "namedImports": [
            {
              "imported": "sum",
              "local": "add",
            },
          ],
          "source": "./math.vx",
        },
        {
          "kind": "Component",
          "name": "Counter",
          "params": [
            "label:any",
            "items:any",
          ],
          "renderSegments": [
            "RenderText",
            "RenderBinding",
            "RenderText",
            "RenderBinding",
            "RenderText",
            "RenderEach",
          ],
          "state": [
            "count",
          ],
        },
        {
          "kind": "FastFunction",
          "name": "add1",
          "params": [
            "a:i32",
          ],
          "returnType": "i32",
        },
      ]
    `);
  });

  it("keeps build manifest route summary stable", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-snapshot-manifest-"));
    const srcDir = join(root, "src");
    const pagesDir = join(srcDir, "pages");
    mkdirSync(join(pagesDir, "blog"), { recursive: true });
    writeFileSync(join(pagesDir, "_layout.vx"), `component Layout(content) { render { <main>{content}</main> } }`, "utf8");
    writeFileSync(join(pagesDir, "index.vx"), `component Home { render { <h1>home</h1> } }`, "utf8");
    writeFileSync(join(pagesDir, "blog", "[slug].vx"), `component Post { render { <h1>post</h1> } }`, "utf8");
    const outDir = join(root, "dist");
    try {
      compileProject({ inputPath: srcDir, outputDir: outDir });
      const manifest = JSON.parse(readFileSync(join(outDir, "velox-manifest.json"), "utf8"));
      const summary = {
        version: manifest.version,
        modules: manifest.files.modules,
        routeCount: manifest.router.routeCount,
        routes: manifest.router.routes.map((route: { path: string; modulePath: string; layoutModulePaths: string[] }) => ({
          path: route.path,
          modulePath: route.modulePath,
          layoutCount: route.layoutModulePaths.length,
        })),
      };
      expect(summary).toMatchInlineSnapshot(`
        {
          "modules": [
            "pages/_layout.js",
            "pages/blog/[slug].js",
            "pages/index.js",
          ],
          "routeCount": 2,
          "routes": [
            {
              "layoutCount": 1,
              "modulePath": "./pages/blog/[slug].js",
              "path": "/blog/:slug",
            },
            {
              "layoutCount": 1,
              "modulePath": "./pages/index.js",
              "path": "/",
            },
          ],
          "version": 1,
        }
      `);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
