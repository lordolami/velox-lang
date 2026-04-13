import type {
  ComponentNode,
  ExpressionNode,
  FastFunctionNode,
  ImportBindingNode,
  ImportNode,
  ParamNode,
  ProgramNode,
  RenderSegmentNode,
  StateDeclNode,
} from "./ast";
import type { Token, TokenType } from "./lexer";

export function parse(tokens: Token[], source: string): ProgramNode {
  const parser = new Parser(tokens, source);
  return parser.parseProgram();
}

class Parser {
  private readonly tokens: Token[];
  private readonly source: string;
  private current = 0;

  constructor(tokens: Token[], source: string) {
    this.tokens = tokens;
    this.source = source;
  }

  parseProgram(): ProgramNode {
    const body: ProgramNode["body"] = [];
    while (!this.isAtEnd()) {
      if (this.matchIdentifierLexeme("import")) {
        body.push(this.parseImport());
        continue;
      }
      if (this.match("component")) {
        body.push(this.parseComponent());
        continue;
      }
      if (this.match("at")) {
        body.push(this.parseFastFunction());
        continue;
      }
      const t = this.peek();
      throw new Error(`[VX4003] Expected declaration at ${t.line}:${t.column}`);
    }
    return { kind: "Program", body };
  }

  private parseImport(): ImportNode {
    try {
      if (this.match("string")) {
        const source = this.previous().lexeme;
        this.consumeOptionalSemicolon();
        return {
          kind: "Import",
          defaultImport: null,
          namespaceImport: null,
          namedImports: [],
          source,
          sideEffectOnly: true,
        };
      }

      let defaultImport: string | null = null;
      let namespaceImport: string | null = null;
      let namedImports: ImportBindingNode[] = [];

      if (this.check("identifier")) {
        defaultImport = this.advance().lexeme;
        if (this.match("comma")) {
          // Continue to namespace/named import segment.
        } else {
          this.consumeIdentifierLexemeWithCode("from", "Expected 'from' in import declaration", "VX4203");
          const source = this.consumeWithCode("string", "Expected import source string", "VX4204").lexeme;
          this.consumeOptionalSemicolon();
          return {
            kind: "Import",
            defaultImport,
            namespaceImport: null,
            namedImports: [],
            source,
            sideEffectOnly: false,
          };
        }
      }

      if (this.matchSymbol("*")) {
        this.consumeIdentifierLexemeWithCode("as", "Expected 'as' in namespace import", "VX4205");
        namespaceImport = this.consumeWithCode("identifier", "Expected namespace import alias", "VX4206").lexeme;
      } else if (this.match("lbrace")) {
        namedImports = this.parseNamedImportList();
        this.consumeWithCode("rbrace", "Expected '}' after named imports", "VX4207");
      } else {
        const token = this.peek();
        throw new Error(`[VX4201] Invalid import declaration at ${token.line}:${token.column}`);
      }

      this.consumeIdentifierLexemeWithCode("from", "Expected 'from' in import declaration", "VX4203");
      const source = this.consumeWithCode("string", "Expected import source string", "VX4204").lexeme;
      this.consumeOptionalSemicolon();
      return {
        kind: "Import",
        defaultImport,
        namespaceImport,
        namedImports,
        source,
        sideEffectOnly: false,
      };
    } catch (error) {
      if (error instanceof Error && !error.message.includes("[VX420")) {
        throw new Error(`[VX4201] ${error.message}`);
      }
      throw error;
    }
  }

  private parseComponent(): ComponentNode {
    const name = this.consumeWithCode("identifier", "Expected component name", "VX4301").lexeme;
    const params = this.parseComponentParamList();
    this.consumeWithCode("lbrace", "Expected '{' after component header", "VX4302");

    const state: StateDeclNode[] = [];
    let renderHtml = "";
    let hasRender = false;

    while (!this.check("rbrace") && !this.isAtEnd()) {
      if (this.match("tilde")) {
        state.push(this.parseStateDecl());
        continue;
      }
      if (this.match("render")) {
        if (hasRender) {
          const token = this.previous();
          throw new Error(`[VX4001] Duplicate render block in component "${name}" at ${token.line}:${token.column}`);
        }
        hasRender = true;
        renderHtml = this.parseRawBlock("Expected '{' after render").trim();
        continue;
      }

      const t = this.peek();
      throw new Error(`[VX4004] Unexpected token ${t.type} in component at ${t.line}:${t.column}`);
    }

    this.consumeWithCode("rbrace", "Expected '}' after component body", "VX4303");
    if (!hasRender) {
      throw new Error(`[VX4002] Component "${name}" is missing a render block.`);
    }
    const normalizedRender = normalizeRenderTemplate(renderHtml);
    return {
      kind: "Component",
      name,
      params,
      state,
      render: {
        raw: renderHtml,
        normalized: normalizedRender.template,
        segments: parseRenderSegments(normalizedRender.template),
        events: normalizedRender.events,
      },
    };
  }

  private parseFastFunction(): FastFunctionNode {
    this.consumeWithCode("fast", "Expected 'fast' after '@'", "VX4304");
    const name = this.consumeWithCode("identifier", "Expected @fast function name", "VX4305").lexeme;
    const params = this.parseParamList(true);
    this.consumeWithCode("arrow", "Expected '->' after @fast params", "VX4306");
    const returnType = this.consumeWithCode("identifier", "Expected return type", "VX4307").lexeme;
    const body = this.parseRawBlock("Expected '{' before @fast body", "VX4308").trim();
    return {
      kind: "FastFunction",
      name,
      params,
      returnType,
      body,
    };
  }

  private parseStateDecl(): StateDeclNode {
    const name = this.consumeWithCode("identifier", "Expected state variable name", "VX4310").lexeme;
    this.consumeWithCode("equals", "Expected '=' in state declaration", "VX4311");
    const value = this.parseExpression();
    return { name, value };
  }

  private parseExpression(): ExpressionNode {
    return this.parseLogicalOrExpression();
  }

  private parseLogicalOrExpression(): ExpressionNode {
    let expr = this.parseLogicalAndExpression();
    while (this.matchSymbol("||")) {
      const right = this.parseLogicalAndExpression();
      expr = {
        kind: "BinaryExpression",
        operator: "||",
        left: expr,
        right,
      };
    }
    return expr;
  }

  private parseLogicalAndExpression(): ExpressionNode {
    let expr = this.parseEqualityExpression();
    while (this.matchSymbol("&&")) {
      const right = this.parseEqualityExpression();
      expr = {
        kind: "BinaryExpression",
        operator: "&&",
        left: expr,
        right,
      };
    }
    return expr;
  }

  private parseEqualityExpression(): ExpressionNode {
    let expr = this.parseComparisonExpression();
    while (this.matchSymbol("==") || this.matchSymbol("!=")) {
      const operator = this.previous().lexeme as "==" | "!=";
      const right = this.parseComparisonExpression();
      expr = {
        kind: "BinaryExpression",
        operator,
        left: expr,
        right,
      };
    }
    return expr;
  }

  private parseComparisonExpression(): ExpressionNode {
    let expr = this.parseAddSubExpression();
    while (
      this.matchSymbol("<") ||
      this.matchSymbol(">") ||
      this.matchSymbol("<=") ||
      this.matchSymbol(">=")
    ) {
      const operator = this.previous().lexeme as "<" | ">" | "<=" | ">=";
      const right = this.parseAddSubExpression();
      expr = {
        kind: "BinaryExpression",
        operator,
        left: expr,
        right,
      };
    }
    return expr;
  }

  private parseAddSubExpression(): ExpressionNode {
    let expr = this.parseMulDivExpression();
    while (this.matchSymbol("+") || this.matchSymbol("-")) {
      const operator = this.previous().lexeme as "+" | "-";
      const right = this.parseMulDivExpression();
      expr = {
        kind: "BinaryExpression",
        operator,
        left: expr,
        right,
      };
    }
    return expr;
  }

  private parseMulDivExpression(): ExpressionNode {
    let expr = this.parseUnaryExpression();
    while (this.matchSymbol("*") || this.matchSymbol("/") || this.matchSymbol("%")) {
      const operator = this.previous().lexeme as "*" | "/" | "%";
      const right = this.parseUnaryExpression();
      expr = {
        kind: "BinaryExpression",
        operator,
        left: expr,
        right,
      };
    }
    return expr;
  }

  private parseUnaryExpression(): ExpressionNode {
    if (this.matchSymbol("-") || this.matchSymbol("!")) {
      const operator = this.previous().lexeme as "-" | "!";
      const argument = this.parseUnaryExpression();
      return {
        kind: "UnaryExpression",
        operator,
        argument,
      };
    }
    return this.parseCallExpression();
  }

  private parseCallExpression(): ExpressionNode {
    let expr = this.parsePrimaryExpression();

    while (true) {
      if (this.match("lparen")) {
        const args: ExpressionNode[] = [];
        if (!this.check("rparen")) {
          do {
            args.push(this.parseExpression());
          } while (this.match("comma"));
        }
        this.consumeWithCode("rparen", "Expected ')' after function call arguments", "VX4331");
        expr = {
          kind: "CallExpression",
          callee: expr,
          args,
        };
        continue;
      }

      if (this.matchSymbol(".")) {
        const property = this.consumeWithCode("identifier", "Expected property name after '.'", "VX4333");
        expr = {
          kind: "MemberExpression",
          object: expr,
          property: { kind: "Identifier", name: property.lexeme },
          computed: false,
        };
        continue;
      }

      if (this.match("lbracket")) {
        const propertyExpr = this.parseExpression();
        this.consumeWithCode("rbracket", "Expected ']' after index expression", "VX4332");
        expr = {
          kind: "MemberExpression",
          object: expr,
          property: propertyExpr,
          computed: true,
        };
        continue;
      }

      break;
    }

    return expr;
  }

  private parsePrimaryExpression(): ExpressionNode {
    if (this.match("number")) {
      return { kind: "NumberLiteral", value: Number(this.previous().lexeme) };
    }
    if (this.match("string")) {
      return { kind: "StringLiteral", value: this.previous().lexeme };
    }
    if (this.match("lbracket")) {
      const elements: ExpressionNode[] = [];
      if (!this.check("rbracket")) {
        do {
          elements.push(this.parseExpression());
        } while (this.match("comma"));
      }
      this.consumeWithCode("rbracket", "Expected ']' after array literal", "VX4332");
      return { kind: "ArrayLiteral", elements };
    }
    if (this.match("lbrace")) {
      const properties: Array<{ key: string; value: ExpressionNode }> = [];
      if (!this.check("rbrace")) {
        do {
          let key = "";
          if (this.match("identifier")) {
            key = this.previous().lexeme;
          } else if (this.match("string")) {
            key = this.previous().lexeme;
          } else {
            const token = this.peek();
            throw new Error(`[VX4333] Expected object literal key at ${token.line}:${token.column}`);
          }
          this.consumeWithCode("colon", "Expected ':' after object literal key", "VX4332");
          const value = this.parseExpression();
          properties.push({ key, value });
        } while (this.match("comma"));
      }
      this.consumeWithCode("rbrace", "Expected '}' after object literal", "VX4332");
      return { kind: "ObjectLiteral", properties };
    }
    if (this.match("identifier")) {
      const name = this.previous().lexeme;
      if (name === "true" || name === "false") {
        return { kind: "BooleanLiteral", value: name === "true" };
      }
      return { kind: "Identifier", name };
    }
    if (this.match("lparen")) {
      const expr = this.parseExpression();
      this.consumeWithCode("rparen", "Expected ')' after expression", "VX4332");
      return expr;
    }
    const t = this.peek();
    throw new Error(`[VX4333] Expected expression at ${t.line}:${t.column}`);
  }

  private parseComponentParamList(): ParamNode[] {
    if (!this.check("lparen")) {
      return [];
    }
    return this.parseParamList(false);
  }

  private parseParamList(requireTypes: boolean): ParamNode[] {
    const params: ParamNode[] = [];
    this.consumeWithCode("lparen", "Expected '('", "VX4321");
    if (!this.check("rparen")) {
      do {
        const name = this.consumeWithCode("identifier", "Expected parameter name", "VX4322").lexeme;
        let type = "any";
        if (this.match("colon")) {
          type = this.consumeWithCode("identifier", "Expected parameter type", "VX4323").lexeme;
        } else if (requireTypes) {
          const token = this.peek();
          throw new Error(`[VX4324] Expected ':' and parameter type at ${token.line}:${token.column}`);
        }
        params.push({ name, type });
      } while (this.match("comma"));
    }
    this.consumeWithCode("rparen", "Expected ')' after parameters", "VX4325");
    return params;
  }

  private parseRawBlock(openError: string, openCode?: string): string {
    const open = this.consumeWithCode("lbrace", openError, openCode ?? "VX4334");
    let depth = 1;
    let close: Token | null = null;

    while (!this.isAtEnd()) {
      const token = this.advance();
      if (token.type === "lbrace") {
        depth++;
      } else if (token.type === "rbrace") {
        depth--;
        if (depth === 0) {
          close = token;
          break;
        }
      }
    }

    if (!close) {
      throw new Error(`[VX4334] Unterminated block starting at ${open.line}:${open.column}`);
    }

    return this.source.slice(open.end, close.start);
  }

  private parseNamedImportList(): ImportBindingNode[] {
    const named: ImportBindingNode[] = [];
    while (!this.check("rbrace") && !this.isAtEnd()) {
      const imported = this.consumeWithCode("identifier", "Expected imported symbol name", "VX4208").lexeme;
      let local = imported;
      if (this.checkIdentifierLexeme("as")) {
        this.advance();
        if (!this.check("identifier")) {
          const token = this.peek();
          throw new Error(`[VX4202] Expected local alias after 'as' at ${token.line}:${token.column}`);
        }
        local = this.consume("identifier", "Expected local alias after 'as'").lexeme;
      }
      named.push({ imported, local });
      if (!this.match("comma")) {
        break;
      }
    }
    return named;
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private matchSymbol(symbol: string): boolean {
    if (this.peek().type === "symbol" && this.peek().lexeme === symbol) {
      this.advance();
      return true;
    }
    return false;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) {
      return this.advance();
    }
    const token = this.peek();
    throw new Error(`${message} at ${token.line}:${token.column}`);
  }

  private consumeWithCode(type: TokenType, message: string, code: string): Token {
    if (this.check(type)) {
      return this.advance();
    }
    const token = this.peek();
    throw new Error(`[${code}] ${message} at ${token.line}:${token.column}`);
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) {
      return type === "eof";
    }
    return this.peek().type === type;
  }

  private checkIdentifierLexeme(value: string): boolean {
    return this.peek().type === "identifier" && this.peek().lexeme === value;
  }

  private matchIdentifierLexeme(value: string): boolean {
    if (this.checkIdentifierLexeme(value)) {
      this.advance();
      return true;
    }
    return false;
  }

  private consumeIdentifierLexeme(value: string, message: string): Token {
    if (this.checkIdentifierLexeme(value)) {
      return this.advance();
    }
    const token = this.peek();
    throw new Error(`${message} at ${token.line}:${token.column}`);
  }

  private consumeIdentifierLexemeWithCode(value: string, message: string, code: string): Token {
    if (this.checkIdentifierLexeme(value)) {
      return this.advance();
    }
    const token = this.peek();
    throw new Error(`[${code}] ${message} at ${token.line}:${token.column}`);
  }

  private consumeOptionalSemicolon(): void {
    if (this.peek().type === "symbol" && this.peek().lexeme === ";") {
      this.advance();
    }
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === "eof";
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }
}

function parseRenderSegments(raw: string): RenderSegmentNode[] {
  const result = parseRenderSegmentsUntil(raw, 0, new Set());
  if (result.stop) {
    throw new Error(`Unexpected "${result.stop}" in render block.`);
  }
  return result.segments;
}

interface RenderParseResult {
  segments: RenderSegmentNode[];
  cursor: number;
  stop: "{:else}" | "{/if}" | "{/each}" | null;
}

function parseRenderSegmentsUntil(raw: string, start: number, stops: Set<string>): RenderParseResult {
  const segments: RenderSegmentNode[] = [];
  let cursor = start;

  while (cursor < raw.length) {
    const open = raw.indexOf("{", cursor);
    if (open === -1) {
      if (cursor < raw.length) {
        segments.push({ kind: "RenderText", value: raw.slice(cursor) });
      }
      return { segments, cursor: raw.length, stop: null };
    }

    if (open > cursor) {
      segments.push({ kind: "RenderText", value: raw.slice(cursor, open) });
    }

    if (raw.startsWith("{:else}", open)) {
      if (!stops.has("{:else}")) {
        throw new Error("[VX4101] Unexpected {:else} without matching {#if}.");
      }
      return { segments, cursor: open + "{:else}".length, stop: "{:else}" };
    }

    if (raw.startsWith("{/if}", open)) {
      if (!stops.has("{/if}")) {
        throw new Error("[VX4102] Unexpected {/if} without matching {#if}.");
      }
      return { segments, cursor: open + "{/if}".length, stop: "{/if}" };
    }

    if (raw.startsWith("{/each}", open)) {
      if (!stops.has("{/each}")) {
        throw new Error("[VX4103] Unexpected {/each} without matching {#each ...}.");
      }
      return { segments, cursor: open + "{/each}".length, stop: "{/each}" };
    }

    if (raw.startsWith("{#if", open)) {
      const close = raw.indexOf("}", open + 4);
      if (close === -1) {
        throw new Error("[VX4104] Unterminated {#if ...} directive in render block.");
      }

      const condition = raw.slice(open + 4, close).trim();
      if (condition.length === 0) {
        throw new Error("[VX4105] Invalid if condition. Use expression like {#if count > 0}.");
      }

      const inner = parseRenderSegmentsUntil(raw, close + 1, new Set(["{:else}", "{/if}"]));
      let alternate: RenderSegmentNode[] | null = null;
      let blockCursor = inner.cursor;

      if (inner.stop === "{:else}") {
        const elseResult = parseRenderSegmentsUntil(raw, inner.cursor, new Set(["{/if}"]));
        if (elseResult.stop !== "{/if}") {
          throw new Error("[VX4106] Missing {/if} after {:else} block.");
        }
        alternate = elseResult.segments;
        blockCursor = elseResult.cursor;
      } else if (inner.stop !== "{/if}") {
        throw new Error("[VX4107] Missing {/if} to close {#if ...} block.");
      }

      segments.push({
        kind: "RenderIf",
        condition,
        consequent: inner.segments,
        alternate,
      });
      cursor = blockCursor;
      continue;
    }

    if (raw.startsWith("{#each", open)) {
      const close = raw.indexOf("}", open + 6);
      if (close === -1) {
        throw new Error("[VX4108] Unterminated {#each ...} directive in render block.");
      }

      const directive = raw.slice(open + 6, close).trim();
      const parts = directive.match(
        /^([A-Za-z_][A-Za-z0-9_]*)\s+as\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s*,\s*([A-Za-z_][A-Za-z0-9_]*))?$/,
      );
      if (!parts) {
        throw new Error(
          `[VX4109] Invalid each directive "${directive}". Use {#each items as item} or {#each items as item, i}.`,
        );
      }

      const source = parts[1];
      const item = parts[2];
      const index = parts[3] ?? null;
      const body = parseRenderSegmentsUntil(raw, close + 1, new Set(["{/each}"]));
      if (body.stop !== "{/each}") {
        throw new Error("[VX4110] Missing {/each} to close {#each ...} block.");
      }

      segments.push({
        kind: "RenderEach",
        source,
        item,
        index,
        body: body.segments,
      });
      cursor = body.cursor;
      continue;
    }

    const close = raw.indexOf("}", open + 1);
    if (close === -1) {
      throw new Error("[VX4111] Unterminated render binding. Missing '}' in render block.");
    }

    const name = raw.slice(open + 1, close).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      throw new Error(`[VX4112] Invalid render binding "${name}". Expected identifier like {count}.`);
    }
    segments.push({ kind: "RenderBinding", name });
    cursor = close + 1;
  }

  return { segments, cursor, stop: null };
}

function normalizeRenderTemplate(raw: string): {
  template: string;
  events: Array<{ event: string; handler: string }>;
} {
  const events: Array<{ event: string; handler: string }> = [];
  const template = raw.replace(
    /on:([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
    (_, event: string, handler: string) => {
      events.push({ event, handler });
      return `data-vx-on-${event}="${handler}"`;
    },
  );

  return { template, events };
}
