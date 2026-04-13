import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emitJavaScript } from "../src/codegen";
import { checkProject, compileProject } from "../src/compiler";
import { lex } from "../src/lexer";
import { parse } from "../src/parser";

describe("Velox compiler slice", () => {
  it("parses component state and render", () => {
    const source = `
component Counter(label: str) {
  ~count = 0
  render { <p>{count}</p> }
}
`;
    const ast = parse(lex(source), source);
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0].kind).toBe("Component");
    if (ast.body[0].kind === "Component") {
      expect(ast.body[0].render.segments).toEqual([
        { kind: "RenderText", value: "<p>" },
        { kind: "RenderBinding", name: "count" },
        { kind: "RenderText", value: "</p>" },
      ]);
      expect(ast.body[0].render.events).toEqual([]);
    }
  });

  it("allows dollar sign in render text", () => {
    const source = `
component Price {
  render { <p>$29</p> }
}
`;
    const ast = parse(lex(source), source);
    expect(ast.body[0].kind).toBe("Component");
    if (ast.body[0].kind === "Component") {
      expect(ast.body[0].render.raw).toContain("$29");
    }
  });

  it("fails on duplicate render blocks in a component (VX4001)", () => {
    const source = `
component Broken {
  render { <p>a</p> }
  render { <p>b</p> }
}
`;
    expect(() => parse(lex(source), source)).toThrow(/\[VX4001\]/);
  });

  it("fails when a component is missing render block (VX4002)", () => {
    const source = `
component Broken {
  ~count = 0
}
`;
    expect(() => parse(lex(source), source)).toThrow(/\[VX4002\]/);
  });

  it("fails on invalid top-level declaration token (VX4003)", () => {
    const source = `
foo
`;
    expect(() => parse(lex(source), source)).toThrow(/\[VX4003\]/);
  });

  it("fails on unexpected token in component body (VX4004)", () => {
    const source = `
component Broken {
  nope
  render { <p>x</p> }
}
`;
    expect(() => parse(lex(source), source)).toThrow(/\[VX4004\]/);
  });

  it("fails when component name is missing (VX4301)", () => {
    const source = `
component {
  render { <p>x</p> }
}
`;
    expect(() => parse(lex(source), source)).toThrow(/\[VX4301\]/);
  });

  it("fails when @fast return type is missing (VX4307)", () => {
    const source = `
@fast sum(a: i32, b: i32) -> {
  a + b
}
`;
    expect(() => parse(lex(source), source)).toThrow(/\[VX4307\]/);
  });

  it("fails when state declaration is missing '=' (VX4311)", () => {
    const source = `
component Broken {
  ~count 0
  render { <p>{count}</p> }
}
`;
    expect(() => parse(lex(source), source)).toThrow(/\[VX4311\]/);
  });

  it("fails when @fast param type is missing after ':' (VX4323)", () => {
    const source = `
@fast sum(a:, b: i32) -> i32 {
  a + b
}
`;
    expect(() => parse(lex(source), source)).toThrow(/\[VX4323\]/);
  });

  it("fails when expression is missing in state initializer (VX4333)", () => {
    const source = `
component Broken {
  ~count =
  render { <p>{count}</p> }
}
`;
    expect(() => parse(lex(source), source)).toThrow(/\[VX4333\]/);
  });

  it("fails on unexpected {/if} in render template (VX4102)", () => {
    const source = `
component Broken {
  render { <div>{/if}</div> }
}
`;
    expect(() => parse(lex(source), source)).toThrow(/\[VX4102\]/);
  });

  it("fails on missing {/if} in render template (VX4107)", () => {
    const source = `
component Broken(show) {
  render { <div>{#if show}<p>x</p></div> }
}
`;
    expect(() => parse(lex(source), source)).toThrow(/\[VX4107\]/);
  });

  it("fails on invalid each directive in render template (VX4109)", () => {
    const source = `
component Broken(items) {
  render { <ul>{#each items item}<li>x</li>{/each}</ul> }
}
`;
    expect(() => parse(lex(source), source)).toThrow(/\[VX4109\]/);
  });

  it("fails on missing {/each} in render template (VX4110)", () => {
    const source = `
component Broken(items) {
  render { <ul>{#each items as item}<li>{item}</li></ul> }
}
`;
    expect(() => parse(lex(source), source)).toThrow(/\[VX4110\]/);
  });

  it("supports easier component syntax without typed params", () => {
    const source = `
component Greeting(name) {
  render { <h1>Hello {name}</h1> }
}
`;
    const ast = parse(lex(source), source);
    expect(ast.body[0].kind).toBe("Component");
    if (ast.body[0].kind === "Component") {
      expect(ast.body[0].params).toEqual([{ name: "name", type: "any" }]);
    }
  });

  it("parses call expressions in state declarations", () => {
    const source = `
component App(sum) {
  ~value = sum(1, 2)
  render { <p>{value}</p> }
}
`;
    const ast = parse(lex(source), source);
    expect(ast.body[0].kind).toBe("Component");
    if (ast.body[0].kind === "Component") {
      expect(ast.body[0].state[0].value).toMatchObject({
        kind: "CallExpression",
      });
    }
  });

  it("parses member expressions in state declarations", () => {
    const source = `
component App(user) {
  ~name = user.name
  render { <p>{name}</p> }
}
`;
    const ast = parse(lex(source), source);
    expect(ast.body[0].kind).toBe("Component");
    if (ast.body[0].kind === "Component") {
      expect(ast.body[0].state[0].value).toMatchObject({ kind: "MemberExpression", computed: false });
    }
  });

  it("parses index expressions in state declarations", () => {
    const source = `
component App(items) {
  ~first = items[0]
  render { <p>{first}</p> }
}
`;
    const ast = parse(lex(source), source);
    expect(ast.body[0].kind).toBe("Component");
    if (ast.body[0].kind === "Component") {
      expect(ast.body[0].state[0].value).toMatchObject({ kind: "MemberExpression", computed: true });
    }
  });

  it("parses boolean literals in state declarations", () => {
    const source = `
component App {
  ~ready = true
  render { <p>{ready}</p> }
}
`;
    const ast = parse(lex(source), source);
    expect(ast.body[0].kind).toBe("Component");
    if (ast.body[0].kind === "Component") {
      expect(ast.body[0].state[0].value).toEqual({ kind: "BooleanLiteral", value: true });
    }
  });

  it("parses array literals in state declarations", () => {
    const source = `
component App {
  ~items = [1, 2, 3]
  render { <ul>{#each items as item}<li>{item}</li>{/each}</ul> }
}
`;
    const ast = parse(lex(source), source);
    expect(ast.body[0].kind).toBe("Component");
    if (ast.body[0].kind === "Component") {
      expect(ast.body[0].state[0].value.kind).toBe("ArrayLiteral");
      if (ast.body[0].state[0].value.kind === "ArrayLiteral") {
        expect(ast.body[0].state[0].value.elements).toHaveLength(3);
      }
    }
  });

  it("parses object literals in state declarations", () => {
    const source = `
component App {
  ~profile = { name: "Ada", age: 10, active: true }
  render { <p>ok</p> }
}
`;
    const ast = parse(lex(source), source);
    expect(ast.body[0].kind).toBe("Component");
    if (ast.body[0].kind === "Component") {
      expect(ast.body[0].state[0].value.kind).toBe("ObjectLiteral");
      if (ast.body[0].state[0].value.kind === "ObjectLiteral") {
        expect(ast.body[0].state[0].value.properties).toHaveLength(3);
        expect(ast.body[0].state[0].value.properties[0].key).toBe("name");
      }
    }
  });

  it("emits object literals in generated JS", () => {
    const source = `
component App {
  ~profile = { name: "Ada", age: 10 }
  render { <p>ok</p> }
}
`;
    const ast = parse(lex(source), source);
    const output = emitJavaScript(ast).code;
    expect(output).toContain('profile: { "name": "Ada", "age": 10 }');
  });

  it("parses arithmetic expressions in state declarations with precedence", () => {
    const source = `
component App(a, b) {
  ~value = (a + 1) * b - 2
  render { <p>{value}</p> }
}
`;
    const ast = parse(lex(source), source);
    expect(ast.body[0].kind).toBe("Component");
    if (ast.body[0].kind === "Component") {
      expect(ast.body[0].state[0].value).toMatchObject({ kind: "BinaryExpression", operator: "-" });
    }
  });

  it("parses modulo expressions in state declarations", () => {
    const source = `
component App(a) {
  ~value = (a + 5) % 2
  render { <p>{value}</p> }
}
`;
    const ast = parse(lex(source), source);
    expect(ast.body[0].kind).toBe("Component");
    if (ast.body[0].kind === "Component") {
      expect(ast.body[0].state[0].value).toMatchObject({ kind: "BinaryExpression", operator: "%" });
    }
  });

  it("parses logical/comparison expressions in state declarations", () => {
    const source = `
component App(a, b, ready) {
  ~ok = (a + 1) > b && ready
  render { <p>{ok}</p> }
}
`;
    const ast = parse(lex(source), source);
    expect(ast.body[0].kind).toBe("Component");
    if (ast.body[0].kind === "Component") {
      expect(ast.body[0].state[0].value).toMatchObject({
        kind: "BinaryExpression",
        operator: "&&",
      });
    }
  });

  it("parses side-effect imports", () => {
    const source = `
import "./polyfills.vx";
component App { render { <p>ok</p> } }
`;
    const ast = parse(lex(source), source);
    expect(ast.body[0].kind).toBe("Import");
    if (ast.body[0].kind === "Import") {
      expect(ast.body[0].sideEffectOnly).toBe(true);
      expect(ast.body[0].source).toBe("./polyfills.vx");
    }
  });

  it("parses named imports with aliases", () => {
    const source = `
import { sum as add, mul } from "./math.vx";
component App { render { <p>ok</p> } }
`;
    const ast = parse(lex(source), source);
    expect(ast.body[0].kind).toBe("Import");
    if (ast.body[0].kind === "Import") {
      expect(ast.body[0].namedImports).toEqual([
        { imported: "sum", local: "add" },
        { imported: "mul", local: "mul" },
      ]);
    }
  });

  it("fails on invalid import declaration shape (VX4201)", () => {
    const source = `
import , from "./dep.vx"
component App { render { <p>x</p> } }
`;
    expect(() => parse(lex(source), source)).toThrow(/\[VX4201\]/);
  });

  it("fails on invalid named import alias usage (VX4202)", () => {
    const source = `
import { sum as } from "./dep.vx"
component App { render { <p>x</p> } }
`;
    expect(() => parse(lex(source), source)).toThrow(/\[VX4202\]/);
  });

  it("fails on import missing 'from' keyword (VX4203)", () => {
    const source = `
import foo "./dep.vx"
component App { render { <p>x</p> } }
`;
    expect(() => parse(lex(source), source)).toThrow(/\[VX4203\]/);
  });

  it("fails on import missing source string (VX4204)", () => {
    const source = `
import { foo } from
component App { render { <p>x</p> } }
`;
    expect(() => parse(lex(source), source)).toThrow(/\[VX4204\]/);
  });

  it("fails on namespace import missing 'as' (VX4205)", () => {
    const source = `
import * UI from "./dep.vx"
component App { render { <p>x</p> } }
`;
    expect(() => parse(lex(source), source)).toThrow(/\[VX4205\]/);
  });

  it("fails on namespace import missing alias (VX4206)", () => {
    const source = `
import * as { foo } from "./dep.vx"
component App { render { <p>x</p> } }
`;
    expect(() => parse(lex(source), source)).toThrow(/\[VX4206\]/);
  });

  it("fails on import missing closing brace in named imports (VX4207)", () => {
    const source = `
import { foo from "./dep.vx"
component App { render { <p>x</p> } }
`;
    expect(() => parse(lex(source), source)).toThrow(/\[VX4207\]/);
  });

  it("fails on invalid named import symbol token (VX4208)", () => {
    const source = `
import { 1 } from "./dep.vx"
component App { render { <p>x</p> } }
`;
    expect(() => parse(lex(source), source)).toThrow(/\[VX4208\]/);
  });

  it("parses default and namespace imports", () => {
    const source = `
import AppRuntime, * as UI from "./runtime.vx";
component App { render { <p>ok</p> } }
`;
    const ast = parse(lex(source), source);
    expect(ast.body[0].kind).toBe("Import");
    if (ast.body[0].kind === "Import") {
      expect(ast.body[0].defaultImport).toBe("AppRuntime");
      expect(ast.body[0].namespaceImport).toBe("UI");
      expect(ast.body[0].namedImports).toEqual([]);
      expect(ast.body[0].source).toBe("./runtime.vx");
    }
  });

  it("parses if/else render blocks", () => {
    const source = `
component Banner(show) {
  render { <div>{#if show}<p>On</p>{:else}<p>Off</p>{/if}</div> }
}
`;
    const ast = parse(lex(source), source);
    expect(ast.body[0].kind).toBe("Component");
    if (ast.body[0].kind === "Component") {
      expect(ast.body[0].render.segments[1]).toMatchObject({
        kind: "RenderIf",
        condition: "show",
      });
    }
  });

  it("supports expression conditions in render if blocks", () => {
    const source = `
component Banner(count, ready) {
  render { <div>{#if count > 0 && ready}<p>On</p>{:else}<p>Off</p>{/if}</div> }
}
`;
    const ast = parse(lex(source), source);
    expect(ast.body[0].kind).toBe("Component");
    if (ast.body[0].kind === "Component") {
      expect(ast.body[0].render.segments[1]).toMatchObject({
        kind: "RenderIf",
        condition: "count > 0 && ready",
      });
    }
  });

  it("parses each render blocks", () => {
    const source = `
component List(items) {
  render { <ul>{#each items as item}<li>{item}</li>{/each}</ul> }
}
`;
    const ast = parse(lex(source), source);
    expect(ast.body[0].kind).toBe("Component");
    if (ast.body[0].kind === "Component") {
      expect(ast.body[0].render.segments[1]).toMatchObject({
        kind: "RenderEach",
        source: "items",
        item: "item",
        index: null,
      });
    }
  });

  it("parses indexed each render blocks", () => {
    const source = `
component List(items) {
  render { <ul>{#each items as item, i}<li>{i}:{item}</li>{/each}</ul> }
}
`;
    const ast = parse(lex(source), source);
    expect(ast.body[0].kind).toBe("Component");
    if (ast.body[0].kind === "Component") {
      expect(ast.body[0].render.segments[1]).toMatchObject({
        kind: "RenderEach",
        source: "items",
        item: "item",
        index: "i",
      });
    }
  });

  it("extracts event bindings from template syntax", () => {
    const source = `
component Counter(onTap) {
  render { <button on:click={onTap}>Tap</button> }
}
`;
    const ast = parse(lex(source), source);
    expect(ast.body[0].kind).toBe("Component");
    if (ast.body[0].kind === "Component") {
      expect(ast.body[0].render.events).toEqual([{ event: "click", handler: "onTap" }]);
      expect(ast.body[0].render.normalized).toContain('data-vx-on-click="onTap"');
    }
  });

  it("extracts non-click event bindings from template syntax", () => {
    const source = `
component Form(onInput, onChange) {
  render { <input on:input={onInput} on:change={onChange} /> }
}
`;
    const ast = parse(lex(source), source);
    expect(ast.body[0].kind).toBe("Component");
    if (ast.body[0].kind === "Component") {
      expect(ast.body[0].render.events).toEqual([
        { event: "input", handler: "onInput" },
        { event: "change", handler: "onChange" },
      ]);
      expect(ast.body[0].render.normalized).toContain('data-vx-on-input="onInput"');
      expect(ast.body[0].render.normalized).toContain('data-vx-on-change="onChange"');
    }
  });

  it("extracts keyboard and submit event bindings from template syntax", () => {
    const source = `
component Form(onSubmit, onKeyDown) {
  render { <form on:submit={onSubmit}><input on:keydown={onKeyDown} /></form> }
}
`;
    const ast = parse(lex(source), source);
    expect(ast.body[0].kind).toBe("Component");
    if (ast.body[0].kind === "Component") {
      expect(ast.body[0].render.events).toEqual([
        { event: "submit", handler: "onSubmit" },
        { event: "keydown", handler: "onKeyDown" },
      ]);
      expect(ast.body[0].render.normalized).toContain('data-vx-on-submit="onSubmit"');
      expect(ast.body[0].render.normalized).toContain('data-vx-on-keydown="onKeyDown"');
    }
  });

  it("emits JS for component and @fast function", () => {
    const source = `
component Counter(label: str) {
  ~count = 0
  render { <p>{count}</p> }
}

@fast sum(a: i32, b: i32) -> i32 {
  a + b
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    expect(output).toContain("export function Counter(label)");
    expect(output).toContain("WebAssembly.Module");
    expect(output).toContain("const __velox_wasm_sum_fn = __velox_wasm_sum_instance.exports.sum;");
    expect(output).toContain("return __velox_wasm_sum_fn(a, b);");
  });

  it("emits call expressions in component state initializers", () => {
    const source = `
component App(sum) {
  ~value = sum(1, 2)
  render { <p>{value}</p> }
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    expect(output).toContain("value: sum(1, 2)");
  });

  it("emits member and index expressions in state initializers", () => {
    const source = `
component App(user, items) {
  ~name = user.name
  ~first = items[0]
  render { <p>{name}:{first}</p> }
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    expect(output).toContain("name: (user.name)");
    expect(output).toContain("first: (items[0])");
  });

  it("emits boolean literals in component state initializers", () => {
    const source = `
component App {
  ~ready = false
  render { <p>{ready}</p> }
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    expect(output).toContain("ready: false");
  });

  it("emits arithmetic state expressions", () => {
    const source = `
component App(a, b) {
  ~value = (a + 1) * b - 2
  render { <p>{value}</p> }
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    expect(output).toMatch(/value:\s*\(\(\(a \+ 1\) \* b\) - 2\)/);
  });

  it("emits modulo state expressions", () => {
    const source = `
component App(a) {
  ~value = (a + 5) % 2
  render { <p>{value}</p> }
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    expect(output).toContain("((a + 5) % 2)");
  });

  it("emits logical/comparison state expressions", () => {
    const source = `
component App(a, b, ready) {
  ~ok = (a + 1) > b && ready
  render { <p>{ok}</p> }
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    expect(output).toContain("(((a + 1) > b) && ready)");
  });

  it("emits imports before runtime and rewrites .vx specifiers to .js", () => {
    const source = `
import { sum } from "./math.vx";
component Counter(label: str) {
  ~count = 0
  render { <p>{count}</p> }
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    expect(output).toContain('import { sum } from "./math.js";');
    const importPos = output.indexOf('import { sum } from "./math.js";');
    const runtimePos = output.indexOf("function __veloxCreateReactiveState");
    expect(importPos).toBeGreaterThanOrEqual(0);
    expect(runtimePos).toBeGreaterThan(importPos);
  });

  it("emits default + namespace import form", () => {
    const source = `
import AppRuntime, * as UI from "./runtime.vx";
component App { render { <p>ok</p> } }
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    expect(output).toContain('import AppRuntime, * as UI from "./runtime.js";');
  });

  it("rewrites extensionless relative imports to .js output specifiers", () => {
    const source = `
import { sum } from "./math";
component App { render { <p>ok</p> } }
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    expect(output).toContain('import { sum } from "./math.js";');
  });

  it("emits executable wasm bytes for @fast", () => {
    const source = `
@fast sum(a: i32, b: i32) -> i32 {
  a + b
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    const match = output.match(/Uint8Array\(\[([^\]]+)\]\)/);
    expect(match).toBeTruthy();
    const bytes = match![1].split(",").map((v) => Number(v.trim()));
    const instance = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array(bytes)), {});
    const result = (instance.exports.sum as CallableFunction)(2, 3);
    expect(result).toBe(5);
  });

  it("supports literal operands in @fast expressions", () => {
    const source = `
@fast add1(a: i32) -> i32 {
  a + 1
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    const match = output.match(/Uint8Array\(\[([^\]]+)\]\)/);
    expect(match).toBeTruthy();
    const bytes = match![1].split(",").map((v) => Number(v.trim()));
    const instance = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array(bytes)), {});
    const result = (instance.exports.add1 as CallableFunction)(41);
    expect(result).toBe(42);
  });

  it("supports single literal return in @fast expressions", () => {
    const source = `
@fast fortyTwo() -> i32 {
  42
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    const match = output.match(/Uint8Array\(\[([^\]]+)\]\)/);
    expect(match).toBeTruthy();
    const bytes = match![1].split(",").map((v) => Number(v.trim()));
    const instance = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array(bytes)), {});
    const result = (instance.exports.fortyTwo as CallableFunction)();
    expect(result).toBe(42);
  });

  it("supports multi-line let and return in @fast", () => {
    const source = `
@fast calc(a: i32, b: i32) -> i32 {
  let c = a + b
  let d = c * 2
  return d - 1
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    const match = output.match(/Uint8Array\(\[([^\]]+)\]\)/);
    expect(match).toBeTruthy();
    const bytes = match![1].split(",").map((v) => Number(v.trim()));
    const instance = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array(bytes)), {});
    const result = (instance.exports.calc as CallableFunction)(3, 4);
    expect(result).toBe(13);
  });

  it("supports precedence and parentheses in @fast expressions", () => {
    const source = `
@fast math(a: i32, b: i32) -> i32 {
  (a + b) * 2
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    const match = output.match(/Uint8Array\(\[([^\]]+)\]\)/);
    expect(match).toBeTruthy();
    const bytes = match![1].split(",").map((v) => Number(v.trim()));
    const instance = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array(bytes)), {});
    const result = (instance.exports.math as CallableFunction)(3, 4);
    expect(result).toBe(14);
  });

  it("supports modulo operator in @fast expressions", () => {
    const source = `
@fast mod(a: i32, b: i32) -> i32 {
  a % b
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    const match = output.match(/Uint8Array\(\[([^\]]+)\]\)/);
    expect(match).toBeTruthy();
    const bytes = match![1].split(",").map((v) => Number(v.trim()));
    const instance = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array(bytes)), {});
    const result = (instance.exports.mod as CallableFunction)(20, 6);
    expect(result).toBe(2);
  });

  it("supports comparison operators in @fast expressions", () => {
    const source = `
@fast gt(a: i32) -> i32 {
  a > 0
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    const match = output.match(/Uint8Array\(\[([^\]]+)\]\)/);
    expect(match).toBeTruthy();
    const bytes = match![1].split(",").map((v) => Number(v.trim()));
    const instance = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array(bytes)), {});
    expect((instance.exports.gt as CallableFunction)(5)).toBe(1);
    expect((instance.exports.gt as CallableFunction)(0)).toBe(0);
    expect((instance.exports.gt as CallableFunction)(-2)).toBe(0);
  });

  it("supports equality operators in @fast expressions", () => {
    const source = `
@fast eq(a: i32, b: i32) -> i32 {
  a == b
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    const match = output.match(/Uint8Array\(\[([^\]]+)\]\)/);
    expect(match).toBeTruthy();
    const bytes = match![1].split(",").map((v) => Number(v.trim()));
    const instance = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array(bytes)), {});
    expect((instance.exports.eq as CallableFunction)(3, 3)).toBe(1);
    expect((instance.exports.eq as CallableFunction)(3, 2)).toBe(0);
  });

  it("supports if/else branches in @fast with returns", () => {
    const source = `
@fast abs(a: i32) -> i32 {
  if a >= 0 {
    return a
  } else {
    return -a
  }
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    const match = output.match(/Uint8Array\(\[([^\]]+)\]\)/);
    expect(match).toBeTruthy();
    const bytes = match![1].split(",").map((v) => Number(v.trim()));
    const instance = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array(bytes)), {});
    expect((instance.exports.abs as CallableFunction)(5)).toBe(5);
    expect((instance.exports.abs as CallableFunction)(-9)).toBe(9);
  });

  it("supports logical AND in @fast expressions", () => {
    const source = `
@fast bothPositive(a: i32, b: i32) -> i32 {
  a > 0 && b > 0
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    const match = output.match(/Uint8Array\(\[([^\]]+)\]\)/);
    expect(match).toBeTruthy();
    const bytes = match![1].split(",").map((v) => Number(v.trim()));
    const instance = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array(bytes)), {});
    expect((instance.exports.bothPositive as CallableFunction)(2, 3)).toBe(1);
    expect((instance.exports.bothPositive as CallableFunction)(2, -1)).toBe(0);
  });

  it("supports logical OR in @fast expressions", () => {
    const source = `
@fast eitherPositive(a: i32, b: i32) -> i32 {
  a > 0 || b > 0
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    const match = output.match(/Uint8Array\(\[([^\]]+)\]\)/);
    expect(match).toBeTruthy();
    const bytes = match![1].split(",").map((v) => Number(v.trim()));
    const instance = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array(bytes)), {});
    expect((instance.exports.eitherPositive as CallableFunction)(-2, 3)).toBe(1);
    expect((instance.exports.eitherPositive as CallableFunction)(-2, -3)).toBe(0);
  });

  it("supports let declarations inside @fast if/else branches", () => {
    const source = `
@fast branchLocal(a: i32) -> i32 {
  if a > 0 {
    let x = a * 2
    return x
  } else {
    let y = -a
    return y
  }
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    const match = output.match(/Uint8Array\(\[([^\]]+)\]\)/);
    expect(match).toBeTruthy();
    const bytes = match![1].split(",").map((v) => Number(v.trim()));
    const instance = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array(bytes)), {});
    expect((instance.exports.branchLocal as CallableFunction)(4)).toBe(8);
    expect((instance.exports.branchLocal as CallableFunction)(-6)).toBe(6);
  });

  it("supports assignment statements in @fast", () => {
    const source = `
@fast reassign(a: i32) -> i32 {
  let x = a
  x = x + 2
  return x
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    const match = output.match(/Uint8Array\(\[([^\]]+)\]\)/);
    expect(match).toBeTruthy();
    const bytes = match![1].split(",").map((v) => Number(v.trim()));
    const instance = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array(bytes)), {});
    expect((instance.exports.reassign as CallableFunction)(5)).toBe(7);
  });

  it("supports while loops in @fast", () => {
    const source = `
@fast sumTo(n: i32) -> i32 {
  let i = 0
  let acc = 0
  while i < n {
    acc = acc + i
    i = i + 1
  }
  return acc
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    const match = output.match(/Uint8Array\(\[([^\]]+)\]\)/);
    expect(match).toBeTruthy();
    const bytes = match![1].split(",").map((v) => Number(v.trim()));
    const instance = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array(bytes)), {});
    expect((instance.exports.sumTo as CallableFunction)(0)).toBe(0);
    expect((instance.exports.sumTo as CallableFunction)(5)).toBe(10);
    expect((instance.exports.sumTo as CallableFunction)(10)).toBe(45);
  });

  it("throws on unknown render bindings", () => {
    const source = `
component Broken {
  render { <p>{missing}</p> }
}
`;
    const program = parse(lex(source), source);
    expect(() => emitJavaScript(program)).toThrow(/Unknown render binding/);
  });

  it("renders if/else branches in emitted component output", () => {
    const source = `
component Banner(show) {
  render { <div>{#if show}<p>On</p>{:else}<p>Off</p>{/if}</div> }
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    const sanitized = output
      .replace(/export function Banner/g, "function Banner")
      .replace(/export /g, "");
    const factory = new Function(`${sanitized}; return Banner;`);
    const Banner = factory() as (show: boolean) => { render: () => string };
    expect(Banner(true).render()).toBe("<div><p>On</p></div>");
    expect(Banner(false).render()).toBe("<div><p>Off</p></div>");
  });

  it("throws on unknown if conditions", () => {
    const source = `
component Broken {
  render { {#if missing}<p>nope</p>{/if} }
}
`;
    const program = parse(lex(source), source);
    expect(() => emitJavaScript(program)).toThrow(/Unknown identifier "missing" in render condition/);
  });

  it("evaluates expression conditions in emitted output", () => {
    const source = `
component Banner(count, ready) {
  render { <div>{#if count > 0 && ready}<p>On</p>{:else}<p>Off</p>{/if}</div> }
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    const sanitized = output
      .replace(/export function Banner/g, "function Banner")
      .replace(/export /g, "");
    const factory = new Function(`${sanitized}; return Banner;`);
    const Banner = factory() as (count: number, ready: boolean) => { render: () => string };
    expect(Banner(1, true).render()).toBe("<div><p>On</p></div>");
    expect(Banner(0, true).render()).toBe("<div><p>Off</p></div>");
    expect(Banner(1, false).render()).toBe("<div><p>Off</p></div>");
  });

  it("evaluates member/index access in render conditions", () => {
    const source = `
component Banner(user, items) {
  render { <div>{#if user.profile.active && items[0] > 0}<p>On</p>{:else}<p>Off</p>{/if}</div> }
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    const sanitized = output
      .replace(/export function Banner/g, "function Banner")
      .replace(/export /g, "");
    const factory = new Function(`${sanitized}; return Banner;`);
    const Banner = factory() as (
      user: { profile: { active: boolean } },
      items: number[],
    ) => { render: () => string };
    expect(Banner({ profile: { active: true } }, [1]).render()).toBe("<div><p>On</p></div>");
    expect(Banner({ profile: { active: true } }, [0]).render()).toBe("<div><p>Off</p></div>");
  });

  it("renders each loops in emitted component output", () => {
    const source = `
component List(items) {
  render { <ul>{#each items as item}<li>{item}</li>{/each}</ul> }
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    const sanitized = output
      .replace(/export function List/g, "function List")
      .replace(/export /g, "");
    const factory = new Function(`${sanitized}; return List;`);
    const List = factory() as (items: string[]) => { render: () => string };
    expect(List(["a", "b"]).render()).toBe("<ul><li>a</li><li>b</li></ul>");
  });

  it("renders indexed each loops in emitted component output", () => {
    const source = `
component List(items) {
  render { <ul>{#each items as item, i}<li>{i}:{item}</li>{/each}</ul> }
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    const sanitized = output
      .replace(/export function List/g, "function List")
      .replace(/export /g, "");
    const factory = new Function(`${sanitized}; return List;`);
    const List = factory() as (items: string[]) => { render: () => string };
    expect(List(["a", "b"]).render()).toBe("<ul><li>0:a</li><li>1:b</li></ul>");
  });

  it("emits mount and events metadata for on:click handlers", () => {
    const source = `
component Counter(onTap) {
  render { <button on:click={onTap}>Tap</button> }
}
`;
    const program = parse(lex(source), source);
    const output = emitJavaScript(program).code;
    expect(output).toContain('data-vx-on-click=\\"onTap\\"');
    expect(output).toContain('const events = [{"event":"click","handler":"onTap"}];');
    expect(output).toContain("const mount = (target) => {");
  });

  it("throws on unknown each sources", () => {
    const source = `
component Broken {
  render { {#each items as item}<p>{item}</p>{/each} }
}
`;
    const program = parse(lex(source), source);
    expect(() => emitJavaScript(program)).toThrow(/Unknown render each source/);
  });

  it("throws on unknown event handlers", () => {
    const source = `
component Broken {
  render { <button on:click={missing}>Tap</button> }
}
`;
    const program = parse(lex(source), source);
    expect(() => emitJavaScript(program)).toThrow(/Unknown event handler/);
  });

  it("compiles a directory project into mirrored .js outputs", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-project-"));
    const srcDir = join(root, "src");
    const outDir = join(root, "dist");
    mkdirSync(join(srcDir, "nested"), { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `component App(title) { render { <h1>{title}</h1> } }`,
      "utf8",
    );
    writeFileSync(
      join(srcDir, "nested", "card.vx"),
      `component Card(label) { render { <p>{label}</p> } }`,
      "utf8",
    );
    try {
      const result = compileProject({ inputPath: srcDir, outputDir: outDir });
      expect(result.outputPaths).toHaveLength(2);
      const appJs = readFileSync(join(outDir, "app.js"), "utf8");
      const cardJs = readFileSync(join(outDir, "nested", "card.js"), "utf8");
      expect(appJs).toContain("export function App");
      expect(cardJs).toContain("export function Card");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("compiles a single file via compileProject with explicit output path", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-file-"));
    const srcPath = join(root, "main.vx");
    const outPath = join(root, "custom", "main.js");
    writeFileSync(srcPath, `component Main(name) { render { <p>{name}</p> } }`, "utf8");
    try {
      const result = compileProject({ inputPath: srcPath, outputPath: outPath });
      expect(result.outputPaths).toEqual([outPath]);
      expect(readFileSync(outPath, "utf8")).toContain("export function Main");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails project compile on missing relative .vx imports", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-missing-import-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { util } from "./missing.vx"\ncomponent App { render { <p>ok</p> } }`,
      "utf8",
    );
    try {
      expect(() => compileProject({ inputPath: srcDir, outputDir: join(root, "dist") })).toThrow(
        /Missing imported \.vx module/,
      );
      expect(() => compileProject({ inputPath: srcDir, outputDir: join(root, "dist") })).toThrow(
        /\[VX2001\]/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves extensionless relative imports to sibling .vx modules", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-extensionless-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "math.vx"), `@fast sum(a: i32, b: i32) -> i32 { a + b }`, "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { sum } from "./math"\ncomponent App { render { <p>ok</p> } }`,
      "utf8",
    );
    try {
      const result = compileProject({ inputPath: srcDir, outputDir: join(root, "dist") });
      expect(result.outputPaths.length).toBe(2);
      const appJs = readFileSync(join(root, "dist", "app.js"), "utf8");
      expect(appJs).toContain('from "./math.js";');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("compiles uppercase .VX files and rewrites imports to .js", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-upper-ext-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "math.VX"), `@fast sum(a: i32, b: i32) -> i32 { a + b }`, "utf8");
    writeFileSync(
      join(srcDir, "app.VX"),
      `import { sum } from "./math.VX"\ncomponent App { render { <p>ok</p> } }`,
      "utf8",
    );
    try {
      const result = compileProject({ inputPath: srcDir, outputDir: join(root, "dist") });
      expect(result.outputPaths.length).toBe(2);
      const appJs = readFileSync(join(root, "dist", "app.js"), "utf8");
      expect(appJs).toContain('from "./math.js";');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails project compile on .vx import cycles", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-cycle-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "a.vx"),
      `import { B } from "./b.vx"\ncomponent A { render { <p>A</p> } }`,
      "utf8",
    );
    writeFileSync(
      join(srcDir, "b.vx"),
      `import { A } from "./a.vx"\ncomponent B { render { <p>B</p> } }`,
      "utf8",
    );
    try {
      expect(() => compileProject({ inputPath: srcDir, outputDir: join(root, "dist") })).toThrow(
        /Import cycle detected/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails project compile on unknown named imports", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-bad-symbol-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "math.vx"),
      `@fast sum(a: i32, b: i32) -> i32 { a + b }`,
      "utf8",
    );
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { mul } from "./math.vx"\ncomponent App { render { <p>ok</p> } }`,
      "utf8",
    );
    try {
      expect(() => compileProject({ inputPath: srcDir, outputDir: join(root, "dist") })).toThrow(
        /Unknown import "mul"/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails project compile on mixed declaration name conflict in a module (VX3015)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-dup-export-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "dup.vx"),
      `component App { render { <p>a</p> } }\n@fast App(a: i32) -> i32 { a }`,
      "utf8",
    );
    try {
      expect(() => compileProject({ inputPath: srcDir, outputDir: join(root, "dist") })).toThrow(
        /\[VX3015\]/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails project compile on default imports from .vx modules", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-default-import-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "runtime.vx"),
      `component Runtime { render { <p>ok</p> } }`,
      "utf8",
    );
    writeFileSync(
      join(srcDir, "app.vx"),
      `import Runtime from "./runtime.vx"\ncomponent App { render { <p>ok</p> } }`,
      "utf8",
    );
    try {
      expect(() => compileProject({ inputPath: srcDir, outputDir: join(root, "dist") })).toThrow(
        /Default import "Runtime".+not supported yet/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails project compile on duplicate local import aliases", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-import-local-dupe-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "one.vx"), `component A { render { <p>a</p> } }`, "utf8");
    writeFileSync(join(srcDir, "two.vx"), `component B { render { <p>b</p> } }`, "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { A as Same } from "./one.vx"\nimport { B as Same } from "./two.vx"\ncomponent App { render { <p>ok</p> } }`,
      "utf8",
    );
    try {
      expect(() => compileProject({ inputPath: srcDir, outputDir: join(root, "dist") })).toThrow(
        /\[VX3012\]/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails project compile when import local collides with declaration name", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-import-decl-collision-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "dep.vx"), `component Util { render { <p>u</p> } }`, "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { Util } from "./dep.vx"\ncomponent Util { render { <p>local</p> } }`,
      "utf8",
    );
    try {
      expect(() => compileProject({ inputPath: srcDir, outputDir: join(root, "dist") })).toThrow(
        /Duplicate top-level name "Util"/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("checks a single file without writing output", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-check-file-"));
    const srcPath = join(root, "app.vx");
    writeFileSync(srcPath, `component App { render { <p>ok</p> } }`, "utf8");
    try {
      const result = checkProject({ inputPath: srcPath });
      expect(result.fileCount).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails single-file check on unknown identifier in state expression (VX3004)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-check-unknown-id-"));
    const srcPath = join(root, "app.vx");
    writeFileSync(srcPath, `component App { ~value = missing + 1 render { <p>{value}</p> } }`, "utf8");
    try {
      expect(() => checkProject({ inputPath: srcPath })).toThrow(/\[VX3004\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails single-file check on relative .js import specifier (VX3021)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-single-file-js-import-"));
    const srcPath = join(root, "app.vx");
    writeFileSync(srcPath, `import "./dep.js"\ncomponent App { render { <p>x</p> } }`, "utf8");
    try {
      expect(() => checkProject({ inputPath: srcPath })).toThrow(/\[VX3021\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows single-file check with relative side-effect css import", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-single-file-css-import-"));
    const srcPath = join(root, "app.vx");
    writeFileSync(join(root, "styles.css"), "body { color: blue; }\n", "utf8");
    writeFileSync(srcPath, `import "./styles.css"\ncomponent App { render { <p>x</p> } }`, "utf8");
    try {
      expect(() => checkProject({ inputPath: srcPath })).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("checks a directory project with module graph validation", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-check-dir-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "math.vx"), `@fast sum(a: i32, b: i32) -> i32 { a + b }`, "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { sum } from "./math"\ncomponent App { render { <p>ok</p> } }`,
      "utf8",
    );
    try {
      const result = checkProject({ inputPath: srcDir });
      expect(result.fileCount).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on imported @fast call arity mismatch (VX3001)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-fast-arity-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "math.vx"), `@fast sum(a: i32, b: i32) -> i32 { a + b }`, "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { sum } from "./math"\ncomponent App { ~value = sum(1) render { <p>{value}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3001\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on imported @fast obvious literal type mismatch (VX3002)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-fast-type-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "math.vx"), `@fast sum(a: i32, b: i32) -> i32 { a + b }`, "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { sum } from "./math"\ncomponent App { ~value = sum("1", 2) render { <p>{value}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3002\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on imported @fast boolean literal mismatch (VX3002)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-fast-bool-type-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "math.vx"), `@fast sum(a: i32, b: i32) -> i32 { a + b }`, "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { sum } from "./math"\ncomponent App { ~value = sum(true, 2) render { <p>{value}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3002\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on imported @fast object literal mismatch (VX3002)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-fast-object-type-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "math.vx"), `@fast sum(a: i32, b: i32) -> i32 { a + b }`, "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { sum } from "./math"\ncomponent App { ~value = sum({ n: 1 }, 2) render { <p>{value}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3002\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on imported @fast argument that infers to string expression (VX3002)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-fast-string-expr-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "math.vx"), `@fast sum(a: i32, b: i32) -> i32 { a + b }`, "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { sum } from "./math"\ncomponent App { ~value = sum("1" + 2, 3) render { <p>{value}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3002\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on imported @fast argument that infers to boolean expression (VX3002)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-fast-bool-expr-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "math.vx"), `@fast sum(a: i32, b: i32) -> i32 { a + b }`, "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { sum } from "./math"\ncomponent App { ~value = sum((1 + 2) > 1, 3) render { <p>{value}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3002\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts imported @fast argument that infers to i32 modulo expression", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-fast-mod-expr-ok-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "math.vx"), `@fast sum(a: i32, b: i32) -> i32 { a + b }`, "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { sum } from "./math"\ncomponent App(a) { ~value = sum((a + 5) % 2, 3) render { <p>{value}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts imported @fast argument from object property access", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-fast-object-prop-ok-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "math.vx"), `@fast sum(a: i32, b: i32) -> i32 { a + b }`, "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { sum } from "./math"\ncomponent App { ~profile = { age: 7 } ~value = sum(profile.age, 3) render { <p>{value}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts nested imported @fast calls when argument types/arity are valid", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-fast-nested-ok-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "math.vx"), `@fast inc(a: i32) -> i32 { a + 1 }`, "utf8");
    writeFileSync(join(srcDir, "arith.vx"), `@fast sum(a: i32, b: i32) -> i32 { a + b }`, "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { inc } from "./math"\nimport { sum } from "./arith"\ncomponent App { ~value = sum(inc(1), 2) render { <p>{value}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails nested imported @fast call arity mismatch (VX3001)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-fast-nested-arity-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "math.vx"), `@fast inc(a: i32) -> i32 { a + 1 }`, "utf8");
    writeFileSync(join(srcDir, "arith.vx"), `@fast sum(a: i32, b: i32) -> i32 { a + b }`, "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { inc } from "./math"\nimport { sum } from "./arith"\ncomponent App { ~value = sum(inc(), 2) render { <p>{value}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3001\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when imported component is called in state expression (VX3003)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-component-call-state-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "ui.vx"), `component Badge(text) { render { <p>{text}</p> } }`, "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { Badge } from "./ui"\ncomponent App { ~value = Badge("x") render { <p>{value}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3003\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on unknown callable in state expression (VX3004)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-unknown-callable-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `component App { ~value = nope(1) render { <p>{value}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3004\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on invalid binary operand types in state expression (VX3005)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-invalid-binary-types-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `component App { ~value = "x" - 1 render { <p>{value}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3005\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on invalid unary operand type in state expression (VX3005)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-invalid-unary-type-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `component App { ~value = !5 render { <p>{value}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3005\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when object-typed state is used in numeric binary expression (VX3005)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-object-state-op-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `component App { ~profile = { age: 10 } ~value = profile + 1 render { <p>{value}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3005\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts object property access with numeric type inference", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-object-prop-i32-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `component App { ~profile = { age: 10 } ~value = profile.age + 1 render { <p>{value}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts nested array/object index and property access inference", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-array-object-index-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `component App { ~items = [{ age: 1 }, { age: 2 }] ~value = items[0].age + 3 render { <p>{value}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when object property does not exist (VX3005)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-object-prop-missing-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `component App { ~profile = { age: 10 } ~value = profile.name render { <p>{value}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3005\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when known-shape object uses dynamic index key (VX3005)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-object-dynamic-index-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `component App(key) { ~profile = { age: 10 } ~value = profile[key] render { <p>{value}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3005\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when array is indexed by string literal (VX3005)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-array-string-index-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `component App { ~items = [1, 2, 3] ~value = items["0"] render { <p>{value}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3005\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on self-referential state initializer (VX3006)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-self-state-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `component App { ~count = count + 1 render { <p>{count}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3006\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows state initializer to reference previously declared state", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-prev-state-ref-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `component App { ~a = 1 ~b = a + 1 render { <p>{b}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on forward state reference in initializer (VX3007)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-forward-state-ref-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `component App { ~b = a + 1 ~a = 1 render { <p>{b}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3007\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on nested forward state reference in initializer (VX3007)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-forward-state-ref-nested-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `component App { ~b = wrap(a + 1) ~a = 1 render { <p>{b}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3007\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on duplicate state declarations in same component (VX3008)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-dup-state-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `component App { ~count = 0 ~count = 1 render { <p>{count}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3008\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when state name collides with component param (VX3009)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-state-param-collision-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `component App(count) { ~count = 0 render { <p>{count}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3009\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when state name collides with imported local name (VX3009)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-state-import-collision-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "math.vx"), `@fast sum(a: i32, b: i32) -> i32 { a + b }`, "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { sum } from "./math"\ncomponent App { ~sum = 1 render { <p>{sum}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3009\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when component param collides with imported local name (VX3010)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-param-import-collision-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "math.vx"), `@fast sum(a: i32, b: i32) -> i32 { a + b }`, "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { sum } from "./math"\ncomponent App(sum) { render { <p>{sum}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3010\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on duplicate component param names (VX3011)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-dup-params-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `component App(a, a) { render { <p>{a}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3011\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on duplicate imported local names across import clauses (VX3012)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-dup-import-local-clauses-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "one.vx"), `component A { render { <p>a</p> } }`, "utf8");
    writeFileSync(join(srcDir, "two.vx"), `component B { render { <p>b</p> } }`, "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { A as Same } from "./one"\nimport { B as Same } from "./two"\ncomponent App { render { <p>x</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3012\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on duplicate imported local names inside one import clause (VX3012)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-dup-import-local-clause-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "one.vx"), `component A { render { <p>a</p> } }`, "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { A as Same, A as Same } from "./one"\ncomponent App { render { <p>x</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3012\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on duplicate component names in one module (VX3013)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-dup-component-name-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `component Card { render { <p>a</p> } }\ncomponent Card { render { <p>b</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3013\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on duplicate @fast function names in one module (VX3014)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-dup-fast-name-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `@fast sum(a: i32, b: i32) -> i32 { a + b }\n@fast sum(a: i32, b: i32) -> i32 { a - b }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3014\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when state name collides with component name (VX3016)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-state-component-name-collision-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `component Card { ~Card = 1 render { <p>{Card}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3016\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when param name collides with component name (VX3017)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-param-component-name-collision-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `component Card(Card) { render { <p>{Card}</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3017\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on empty import clause (VX3018)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-empty-import-clause-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "dep.vx"), `component A { render { <p>a</p> } }`, "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import {} from "./dep"\ncomponent App { render { <p>x</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3018\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when declaration collides with namespace import alias (VX3019)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-namespace-alias-collision-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "dep.vx"), `component A { render { <p>a</p> } }`, "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import * as UI from "./dep"\ncomponent UI { render { <p>x</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3019\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows non-relative side-effect import", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-side-effect-non-relative-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `import "polyfills"\ncomponent App { render { <p>x</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows relative side-effect import", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-side-effect-relative-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "polyfills.vx"), `component P { render { <p>p</p> } }`, "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import "./polyfills"\ncomponent App { render { <p>x</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows non-relative value import specifier", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-non-relative-value-import-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { x } from "pkg"\ncomponent App { render { <p>x</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows relative value import specifier", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-relative-value-import-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "dep.vx"), `component X { render { <p>x</p> } }`, "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { X } from "./dep"\ncomponent App { render { <p>x</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on .js import specifier in .vx source (VX3021)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-js-import-specifier-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { A } from "./dep.js"\ncomponent App { render { <p>x</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3021\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on .js side-effect import specifier in .vx source (VX3021)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-js-side-effect-specifier-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `import "./polyfills.js"\ncomponent App { render { <p>x</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3021\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows non-relative .js package specifier", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-package-js-specifier-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { run } from "@scope/pkg/index.js"\ncomponent App { render { <p>x</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on unix-style absolute import specifier in .vx source (VX3022)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-abs-import-unix-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `import "/abs/dep.vx"\ncomponent App { render { <p>x</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3022\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on windows-style absolute import specifier in .vx source (VX3022)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-abs-import-win-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `import "C:\\\\abs\\\\dep.vx"\ncomponent App { render { <p>x</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3022\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when relative import escapes project root (VX3023)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-import-escape-root-"));
    const srcDir = join(root, "src");
    const nestedDir = join(srcDir, "nested");
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(join(root, "dep.vx"), `component Dep { render { <p>d</p> } }`, "utf8");
    writeFileSync(
      join(nestedDir, "app.vx"),
      `import "../../dep"\ncomponent App { render { <p>x</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3023\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows relative import within project root", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-import-in-root-"));
    const srcDir = join(root, "src");
    const nestedDir = join(srcDir, "nested");
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(join(srcDir, "dep.vx"), `component Dep { render { <p>d</p> } }`, "utf8");
    writeFileSync(
      join(nestedDir, "app.vx"),
      `import "../dep"\ncomponent App { render { <p>x</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on unsupported relative import extension .ts (VX3024)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-unsupported-import-ts-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `import { A } from "./dep.ts"\ncomponent App { render { <p>x</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX3024\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows relative side-effect css import", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-sideeffect-css-import-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "styles.css"), "body { color: red; }", "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import "./styles.css"\ncomponent App { render { <p>x</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("allows relative side-effect CSS import with uppercase extension", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-sideeffect-css-upper-import-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "styles.CSS"), "body { color: red; }", "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import "./styles.CSS"\ncomponent App { render { <p>x</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on missing relative side-effect css import (VX2001)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-missing-css-import-"));
    const srcDir = join(root, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "app.vx"),
      `import "./styles.css"\ncomponent App { render { <p>x</p> } }`,
      "utf8",
    );
    try {
      expect(() => checkProject({ inputPath: srcDir })).toThrow(/\[VX2001\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("checks the 60-file example corpus successfully", () => {
    const sourceDir = join(process.cwd(), "examples", "mega60");
    const sourceFiles = readdirSync(sourceDir).filter((file: string) => file.endsWith(".vx"));
    expect(sourceFiles).toHaveLength(60);
    expect(() => checkProject({ inputPath: sourceDir })).not.toThrow();
  });

  it("compiles the 60-file example corpus successfully", () => {
    const sourceDir = join(process.cwd(), "examples", "mega60");
    const root = mkdtempSync(join(tmpdir(), "velox-mega60-compile-"));
    const outDir = join(root, "dist");
    try {
      const result = compileProject({ inputPath: sourceDir, outputDir: outDir });
      expect(result.outputPaths).toHaveLength(60);
      const emitted = readdirSync(outDir).filter((file: string) => file.endsWith(".js"));
      expect(emitted).toHaveLength(60);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("checks interop examples successfully", () => {
    const sourceDir = join(process.cwd(), "examples", "interop");
    expect(() => checkProject({ inputPath: sourceDir })).not.toThrow();
  });

  it("copies relative side-effect css imports into output directory", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-copy-imported-css-"));
    const srcDir = join(root, "src");
    mkdirSync(join(srcDir, "ui"), { recursive: true });
    writeFileSync(join(srcDir, "ui", "theme.css"), "h1 { color: teal; }\n", "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import "./ui/theme.css"\ncomponent App { render { <h1>x</h1> } }`,
      "utf8",
    );
    const outDir = join(root, "dist");
    try {
      compileProject({ inputPath: srcDir, outputDir: outDir });
      expect(existsSync(join(outDir, "ui", "theme.css"))).toBe(true);
      const copied = readFileSync(join(outDir, "ui", "theme.css"), "utf8");
      expect(copied).toContain("color: teal");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("copies relative side-effect CSS imports with uppercase extension into output directory", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-copy-imported-css-upper-"));
    const srcDir = join(root, "src");
    mkdirSync(join(srcDir, "ui"), { recursive: true });
    writeFileSync(join(srcDir, "ui", "theme.CSS"), "h1 { color: navy; }\n", "utf8");
    writeFileSync(
      join(srcDir, "app.vx"),
      `import "./ui/theme.CSS"\ncomponent App { render { <h1>x</h1> } }`,
      "utf8",
    );
    const outDir = join(root, "dist");
    try {
      compileProject({ inputPath: srcDir, outputDir: outDir });
      expect(existsSync(join(outDir, "ui", "theme.CSS"))).toBe(true);
      const copied = readFileSync(join(outDir, "ui", "theme.CSS"), "utf8");
      expect(copied).toContain("color: navy");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("compiles showcase apps successfully", () => {
    const showcaseRoot = join(process.cwd(), "examples", "showcase");
    const apps = ["todo", "dashboard", "landing"];
    for (const app of apps) {
      const sourceDir = join(showcaseRoot, app, "pages");
      const root = mkdtempSync(join(tmpdir(), `velox-showcase-${app}-`));
      const outDir = join(root, "dist");
      try {
        expect(() => checkProject({ inputPath: sourceDir })).not.toThrow();
        const result = compileProject({ inputPath: sourceDir, outputDir: outDir });
        expect(result.outputPaths.length).toBeGreaterThan(0);
        expect(existsSync(join(outDir, "__velox_router.js"))).toBe(true);
        expect(existsSync(join(outDir, "index.html"))).toBe(true);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("emits router artifacts for pages-based apps", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-pages-router-"));
    const srcDir = join(root, "src");
    const pagesDir = join(srcDir, "pages");
    mkdirSync(join(pagesDir, "blog"), { recursive: true });
    writeFileSync(join(pagesDir, "index.vx"), `component Home { render { <h1>home</h1> } }`, "utf8");
    writeFileSync(join(pagesDir, "about.vx"), `component About { render { <h1>about</h1> } }`, "utf8");
    writeFileSync(join(pagesDir, "blog", "[slug].vx"), `component Post { render { <h1>post</h1> } }`, "utf8");
    const outDir = join(root, "dist");
    try {
      const result = compileProject({ inputPath: srcDir, outputDir: outDir });
      expect(result.outputPaths).toHaveLength(3);
      expect(existsSync(join(outDir, "index.html"))).toBe(true);
      expect(existsSync(join(outDir, "__velox_router.js"))).toBe(true);
      const routerJs = readFileSync(join(outDir, "__velox_router.js"), "utf8");
      expect(routerJs).toContain('"path": "/"');
      expect(routerJs).toContain('"path": "/about"');
      expect(routerJs).toContain('"path": "/blog/:slug"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("respects routerEnabled=false and skips router artifact emit", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-router-disabled-"));
    const srcDir = join(root, "src");
    const pagesDir = join(srcDir, "pages");
    mkdirSync(pagesDir, { recursive: true });
    writeFileSync(join(pagesDir, "index.vx"), `component Home { render { <h1>home</h1> } }`, "utf8");
    const outDir = join(root, "dist");
    try {
      compileProject({ inputPath: srcDir, outputDir: outDir, routerEnabled: false });
      expect(existsSync(join(outDir, "__velox_router.js"))).toBe(false);
      expect(existsSync(join(outDir, "index.html"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("respects routerTitle option when emitting index.html", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-router-title-"));
    const srcDir = join(root, "src");
    const pagesDir = join(srcDir, "pages");
    mkdirSync(pagesDir, { recursive: true });
    writeFileSync(join(pagesDir, "index.vx"), `component Home { render { <h1>home</h1> } }`, "utf8");
    const outDir = join(root, "dist");
    try {
      compileProject({ inputPath: srcDir, outputDir: outDir, routerTitle: "My Velox App" });
      const html = readFileSync(join(outDir, "index.html"), "utf8");
      expect(html).toContain("<title>My Velox App</title>");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("emits router artifacts when input root is pages directory", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-pages-root-router-"));
    const pagesDir = join(root, "pages");
    mkdirSync(join(pagesDir, "docs"), { recursive: true });
    writeFileSync(join(pagesDir, "index.vx"), `component Home { render { <h1>home</h1> } }`, "utf8");
    writeFileSync(join(pagesDir, "docs", "[id].vx"), `component Doc { render { <h1>doc</h1> } }`, "utf8");
    const outDir = join(root, "dist");
    try {
      const result = compileProject({ inputPath: pagesDir, outputDir: outDir });
      expect(result.outputPaths).toHaveLength(2);
      expect(existsSync(join(outDir, "__velox_router.js"))).toBe(true);
      const routerJs = readFileSync(join(outDir, "__velox_router.js"), "utf8");
      expect(routerJs).toContain('"path": "/"');
      expect(routerJs).toContain('"path": "/docs/:id"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("omits route group segments from URL paths", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-route-groups-"));
    const srcDir = join(root, "src");
    const pagesDir = join(srcDir, "pages", "(marketing)");
    mkdirSync(pagesDir, { recursive: true });
    writeFileSync(join(pagesDir, "index.vx"), `component MktHome { render { <h1>m</h1> } }`, "utf8");
    writeFileSync(join(pagesDir, "pricing.vx"), `component Pricing { render { <h1>p</h1> } }`, "utf8");
    const outDir = join(root, "dist");
    try {
      compileProject({ inputPath: srcDir, outputDir: outDir });
      const routerJs = readFileSync(join(outDir, "__velox_router.js"), "utf8");
      expect(routerJs).toContain('"path": "/"');
      expect(routerJs).toContain('"path": "/pricing"');
      expect(routerJs).toContain('"modulePath": "./pages/(marketing)/pricing.js"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("wires pages/404.vx as not-found fallback module", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-not-found-page-"));
    const srcDir = join(root, "src");
    const pagesDir = join(srcDir, "pages");
    mkdirSync(pagesDir, { recursive: true });
    writeFileSync(join(pagesDir, "index.vx"), `component Home { render { <h1>home</h1> } }`, "utf8");
    writeFileSync(join(pagesDir, "404.vx"), `component NotFound { render { <h1>404</h1> } }`, "utf8");
    const outDir = join(root, "dist");
    try {
      compileProject({ inputPath: srcDir, outputDir: outDir });
      const routerJs = readFileSync(join(outDir, "__velox_router.js"), "utf8");
      expect(routerJs).toContain('const __velox_not_found = "./pages/404.js";');
      expect(routerJs).not.toContain('"path": "/404"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("emits nested layout module paths in route manifest", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-layout-manifest-"));
    const srcDir = join(root, "src");
    const pagesDir = join(srcDir, "pages");
    mkdirSync(join(pagesDir, "blog"), { recursive: true });
    writeFileSync(join(pagesDir, "_layout.vx"), `component RootLayout(content) { render { <div>{content}</div> } }`, "utf8");
    writeFileSync(
      join(pagesDir, "blog", "_layout.vx"),
      `component BlogLayout(content) { render { <section>{content}</section> } }`,
      "utf8",
    );
    writeFileSync(
      join(pagesDir, "blog", "[slug].vx"),
      `component Post(slug) { render { <p>{slug}</p> } }`,
      "utf8",
    );
    const outDir = join(root, "dist");
    try {
      compileProject({ inputPath: srcDir, outputDir: outDir });
      const routerJs = readFileSync(join(outDir, "__velox_router.js"), "utf8");
      expect(routerJs).toContain('"path": "/blog/:slug"');
      expect(routerJs).toContain('"layoutModulePaths": [');
      expect(routerJs).toContain('"./pages/_layout.js"');
      expect(routerJs).toContain('"./pages/blog/_layout.js"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("injects route context args in router runtime", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-route-context-runtime-"));
    const srcDir = join(root, "src");
    const pagesDir = join(srcDir, "pages");
    mkdirSync(join(pagesDir, "docs"), { recursive: true });
    writeFileSync(join(pagesDir, "docs", "[id].vx"), `component Doc(id) { render { <p>{id}</p> } }`, "utf8");
    const outDir = join(root, "dist");
    try {
      compileProject({ inputPath: srcDir, outputDir: outDir });
      const routerJs = readFileSync(join(outDir, "__velox_router.js"), "utf8");
      expect(routerJs).toContain("function parseQuery(search)");
      expect(routerJs).toContain("params: { ...params }");
      expect(routerJs).toContain("query: parseQuery(window.location.search)");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("copies public assets into output directory on project build", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-public-assets-"));
    const srcDir = join(root, "src");
    const pagesDir = join(srcDir, "pages");
    const publicDir = join(srcDir, "public", "img");
    mkdirSync(pagesDir, { recursive: true });
    mkdirSync(publicDir, { recursive: true });
    writeFileSync(join(pagesDir, "index.vx"), `component Home { render { <h1>home</h1> } }`, "utf8");
    writeFileSync(join(srcDir, "public", "robots.txt"), "User-agent: *\nAllow: /\n", "utf8");
    writeFileSync(join(publicDir, "logo.svg"), "<svg></svg>\n", "utf8");
    const outDir = join(root, "dist");
    try {
      compileProject({ inputPath: srcDir, outputDir: outDir });
      expect(readFileSync(join(outDir, "robots.txt"), "utf8")).toContain("User-agent");
      expect(readFileSync(join(outDir, "img", "logo.svg"), "utf8")).toContain("<svg>");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("respects copyPublic=false and skips public asset copy", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-copy-public-disabled-"));
    const srcDir = join(root, "src");
    const pagesDir = join(srcDir, "pages");
    const publicDir = join(srcDir, "public");
    mkdirSync(pagesDir, { recursive: true });
    mkdirSync(publicDir, { recursive: true });
    writeFileSync(join(pagesDir, "index.vx"), `component Home { render { <h1>home</h1> } }`, "utf8");
    writeFileSync(join(publicDir, "robots.txt"), "User-agent: *\nDisallow:\n", "utf8");
    const outDir = join(root, "dist");
    try {
      compileProject({ inputPath: srcDir, outputDir: outDir, copyPublic: false });
      expect(existsSync(join(outDir, "robots.txt"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("copies route data modules (*.data.js) into output directory", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-route-data-copy-"));
    const srcDir = join(root, "src");
    const pagesDir = join(srcDir, "pages");
    mkdirSync(pagesDir, { recursive: true });
    writeFileSync(join(pagesDir, "index.vx"), `component Home(data) { render { <h1>{data}</h1> } }`, "utf8");
    writeFileSync(join(pagesDir, "index.data.js"), `export const load = () => "ok";\n`, "utf8");
    const outDir = join(root, "dist");
    try {
      compileProject({ inputPath: srcDir, outputDir: outDir });
      expect(readFileSync(join(outDir, "pages", "index.data.js"), "utf8")).toContain("load");
      const manifest = JSON.parse(readFileSync(join(outDir, "velox-manifest.json"), "utf8"));
      expect(manifest.files.routeData).toContain("pages/index.data.js");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("emits velox-manifest.json with router and file metadata", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-build-manifest-"));
    const srcDir = join(root, "src");
    const pagesDir = join(srcDir, "pages");
    const publicDir = join(srcDir, "public", "assets");
    mkdirSync(join(pagesDir, "blog"), { recursive: true });
    mkdirSync(publicDir, { recursive: true });
    writeFileSync(join(pagesDir, "index.vx"), `component Home { render { <h1>home</h1> } }`, "utf8");
    writeFileSync(join(pagesDir, "blog", "[slug].vx"), `component Post { render { <h1>post</h1> } }`, "utf8");
    writeFileSync(join(pagesDir, "index.data.js"), `export const load = () => "ok";\n`, "utf8");
    writeFileSync(join(srcDir, "public", "robots.txt"), "User-agent: *\nAllow: /\n", "utf8");
    writeFileSync(join(publicDir, "logo.svg"), "<svg></svg>\n", "utf8");
    const outDir = join(root, "dist");
    try {
      compileProject({ inputPath: srcDir, outputDir: outDir, routerTitle: "Manifest Demo" });
      const manifest = JSON.parse(readFileSync(join(outDir, "velox-manifest.json"), "utf8"));
      expect(manifest.version).toBe(1);
      expect(typeof manifest.generatedAt).toBe("string");
      expect(manifest.files.modules).toContain("pages/index.js");
      expect(manifest.files.modules).toContain("pages/blog/[slug].js");
      expect(manifest.files.routeData).toContain("pages/index.data.js");
      expect(manifest.files.public).toContain("robots.txt");
      expect(manifest.files.public).toContain("assets/logo.svg");
      expect(manifest.router.enabled).toBe(true);
      expect(manifest.router.title).toBe("Manifest Demo");
      expect(manifest.router.routeCount).toBeGreaterThanOrEqual(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("manifest still emits when router is disabled", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-manifest-router-off-"));
    const srcDir = join(root, "src");
    const pagesDir = join(srcDir, "pages");
    mkdirSync(pagesDir, { recursive: true });
    writeFileSync(join(pagesDir, "index.vx"), `component Home { render { <h1>home</h1> } }`, "utf8");
    const outDir = join(root, "dist");
    try {
      compileProject({ inputPath: srcDir, outputDir: outDir, routerEnabled: false });
      const manifest = JSON.parse(readFileSync(join(outDir, "velox-manifest.json"), "utf8"));
      expect(manifest.router.enabled).toBe(false);
      expect(manifest.router.routeCount).toBe(1);
      expect(existsSync(join(outDir, "__velox_router.js"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("emits data-loading hooks in router runtime", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-router-data-runtime-"));
    const srcDir = join(root, "src");
    const pagesDir = join(srcDir, "pages");
    mkdirSync(pagesDir, { recursive: true });
    writeFileSync(join(pagesDir, "index.vx"), `component Home { render { <h1>home</h1> } }`, "utf8");
    const outDir = join(root, "dist");
    try {
      compileProject({ inputPath: srcDir, outputDir: outDir });
      const routerJs = readFileSync(join(outDir, "__velox_router.js"), "utf8");
      expect(routerJs).toContain("function deriveDataModulePath(modulePath)");
      expect(routerJs).toContain('return modulePath.slice(0, -3) + ".data.js";');
      expect(routerJs).toContain("async function resolveModuleData(moduleExports, modulePath, routeCtx)");
      expect(routerJs).toContain("if (typeof moduleExports.load === \"function\")");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("wires route loading/error module paths without exposing them as routes", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-route-loading-error-"));
    const srcDir = join(root, "src");
    const pagesDir = join(srcDir, "pages");
    mkdirSync(pagesDir, { recursive: true });
    writeFileSync(join(pagesDir, "about.vx"), `component About { render { <h1>about</h1> } }`, "utf8");
    writeFileSync(join(pagesDir, "about.loading.vx"), `component AboutLoading { render { <p>loading</p> } }`, "utf8");
    writeFileSync(join(pagesDir, "about.error.vx"), `component AboutError(error) { render { <p>{error}</p> } }`, "utf8");
    const outDir = join(root, "dist");
    try {
      compileProject({ inputPath: srcDir, outputDir: outDir });
      const routerJs = readFileSync(join(outDir, "__velox_router.js"), "utf8");
      expect(routerJs).toContain('"path": "/about"');
      expect(routerJs).toContain('"loadingModulePath": "./pages/about.loading.js"');
      expect(routerJs).toContain('"errorModulePath": "./pages/about.error.js"');
      expect(routerJs).not.toContain('"path": "/about.loading"');
      expect(routerJs).not.toContain('"path": "/about.error"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("emits loading/error fallback runtime hooks", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-loading-error-runtime-"));
    const srcDir = join(root, "src");
    const pagesDir = join(srcDir, "pages");
    mkdirSync(pagesDir, { recursive: true });
    writeFileSync(join(pagesDir, "index.vx"), `component Home { render { <h1>home</h1> } }`, "utf8");
    const outDir = join(root, "dist");
    try {
      compileProject({ inputPath: srcDir, outputDir: outDir });
      const routerJs = readFileSync(join(outDir, "__velox_router.js"), "utf8");
      expect(routerJs).toContain("if (matched.route.loadingModulePath)");
      expect(routerJs).toContain("Route error fallback");
      expect(routerJs).toContain("function formatError(value)");
      expect(routerJs).toContain("function normalizeLoadResult(result)");
      expect(routerJs).toContain("if (page.load.redirect)");
      expect(routerJs).toContain("if (page.load.notFound)");
      expect(routerJs).toContain("navigate(target)");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on orphan route loading module without matching page (VX3026)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-orphan-loading-module-"));
    const srcDir = join(root, "src");
    const pagesDir = join(srcDir, "pages");
    mkdirSync(pagesDir, { recursive: true });
    writeFileSync(
      join(pagesDir, "about.loading.vx"),
      `component AboutLoading { render { <p>loading</p> } }`,
      "utf8",
    );
    try {
      expect(() => compileProject({ inputPath: srcDir, outputDir: join(root, "dist") })).toThrow(/\[VX3026\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on orphan route error module without matching page (VX3027)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-orphan-error-module-"));
    const srcDir = join(root, "src");
    const pagesDir = join(srcDir, "pages");
    mkdirSync(pagesDir, { recursive: true });
    writeFileSync(
      join(pagesDir, "about.error.vx"),
      `component AboutError { render { <p>error</p> } }`,
      "utf8",
    );
    try {
      expect(() => compileProject({ inputPath: srcDir, outputDir: join(root, "dist") })).toThrow(/\[VX3027\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails on orphan route data module without matching page (VX3028)", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-orphan-data-module-"));
    const srcDir = join(root, "src");
    const pagesDir = join(srcDir, "pages");
    mkdirSync(pagesDir, { recursive: true });
    writeFileSync(join(pagesDir, "about.data.js"), `export const load = () => "x";\n`, "utf8");
    writeFileSync(join(pagesDir, "index.vx"), `component Home { render { <p>home</p> } }`, "utf8");
    try {
      expect(() => compileProject({ inputPath: srcDir, outputDir: join(root, "dist") })).toThrow(/\[VX3028\]/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("ignores internal .velox directories when validating route convention files", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-ignore-internal-dotvelox-"));
    const srcDir = join(root, "src");
    const pagesDir = join(srcDir, "pages");
    const internalDeployDir = join(srcDir, ".velox", "deployments", "old", "pages");
    mkdirSync(pagesDir, { recursive: true });
    mkdirSync(internalDeployDir, { recursive: true });
    writeFileSync(join(pagesDir, "index.vx"), `component Home { render { <h1>home</h1> } }`, "utf8");
    writeFileSync(
      join(internalDeployDir, "ghost.data.js"),
      `export const load = () => "old";\n`,
      "utf8",
    );
    try {
      expect(() => compileProject({ inputPath: srcDir, outputDir: join(root, "dist") })).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
