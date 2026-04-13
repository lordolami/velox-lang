export type TokenType =
  | "component"
  | "render"
  | "fast"
  | "identifier"
  | "number"
  | "string"
  | "tilde"
  | "at"
  | "lparen"
  | "rparen"
  | "lbrace"
  | "rbrace"
  | "lbracket"
  | "rbracket"
  | "colon"
  | "comma"
  | "equals"
  | "arrow"
  | "symbol"
  | "eof";

export interface Token {
  type: TokenType;
  lexeme: string;
  line: number;
  column: number;
  start: number;
  end: number;
}

const KEYWORDS = new Set(["component", "render", "fast"]);

export function lex(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let column = 1;

  const push = (
    type: TokenType,
    lexeme: string,
    atLine = line,
    atColumn = column,
    atStart = i,
    atEnd = i + lexeme.length,
  ): void => {
    tokens.push({ type, lexeme, line: atLine, column: atColumn, start: atStart, end: atEnd });
  };

  while (i < source.length) {
    const ch = source[i];

    if (ch === " " || ch === "\t" || ch === "\r") {
      i++;
      column++;
      continue;
    }

    if (ch === "\n") {
      i++;
      line++;
      column = 1;
      continue;
    }

    if (ch === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") {
        i++;
        column++;
      }
      continue;
    }

    const startLine = line;
    const startColumn = column;
    const startIndex = i;

    if (ch === "(") {
      push("lparen", ch, startLine, startColumn, startIndex, startIndex + 1);
      i++;
      column++;
      continue;
    }
    if (ch === ")") {
      push("rparen", ch, startLine, startColumn, startIndex, startIndex + 1);
      i++;
      column++;
      continue;
    }
    if (ch === "{") {
      push("lbrace", ch, startLine, startColumn, startIndex, startIndex + 1);
      i++;
      column++;
      continue;
    }
    if (ch === "}") {
      push("rbrace", ch, startLine, startColumn, startIndex, startIndex + 1);
      i++;
      column++;
      continue;
    }
    if (ch === "[") {
      push("lbracket", ch, startLine, startColumn, startIndex, startIndex + 1);
      i++;
      column++;
      continue;
    }
    if (ch === "]") {
      push("rbracket", ch, startLine, startColumn, startIndex, startIndex + 1);
      i++;
      column++;
      continue;
    }
    if (ch === ":") {
      push("colon", ch, startLine, startColumn, startIndex, startIndex + 1);
      i++;
      column++;
      continue;
    }
    if (ch === ",") {
      push("comma", ch, startLine, startColumn, startIndex, startIndex + 1);
      i++;
      column++;
      continue;
    }
    if (
      (ch === "=" && source[i + 1] === "=") ||
      (ch === "!" && source[i + 1] === "=") ||
      (ch === "<" && source[i + 1] === "=") ||
      (ch === ">" && source[i + 1] === "=") ||
      (ch === "&" && source[i + 1] === "&") ||
      (ch === "|" && source[i + 1] === "|")
    ) {
      const op = ch + source[i + 1];
      push("symbol", op, startLine, startColumn, startIndex, startIndex + 2);
      i += 2;
      column += 2;
      continue;
    }
    if (ch === "=") {
      push("equals", ch, startLine, startColumn, startIndex, startIndex + 1);
      i++;
      column++;
      continue;
    }
    if (ch === "~") {
      push("tilde", ch, startLine, startColumn, startIndex, startIndex + 1);
      i++;
      column++;
      continue;
    }
    if (ch === "@") {
      push("at", ch, startLine, startColumn, startIndex, startIndex + 1);
      i++;
      column++;
      continue;
    }
    if (ch === "-" && source[i + 1] === ">") {
      push("arrow", "->", startLine, startColumn, startIndex, startIndex + 2);
      i += 2;
      column += 2;
      continue;
    }

    if (isSymbol(ch)) {
      push("symbol", ch, startLine, startColumn, startIndex, startIndex + 1);
      i++;
      column++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      column++;
      let value = "";
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\n") {
          throw new Error(`Unterminated string at ${startLine}:${startColumn}`);
        }
        value += source[i];
        i++;
        column++;
      }
      if (source[i] !== quote) {
        throw new Error(`Unterminated string at ${startLine}:${startColumn}`);
      }
      i++;
      column++;
      push("string", value, startLine, startColumn, startIndex, i);
      continue;
    }

    if (isDigit(ch)) {
      let value = ch;
      i++;
      column++;
      while (i < source.length && isDigit(source[i])) {
        value += source[i];
        i++;
        column++;
      }
      push("number", value, startLine, startColumn, startIndex, i);
      continue;
    }

    if (isAlpha(ch)) {
      let ident = ch;
      i++;
      column++;
      while (i < source.length && isAlphaNumeric(source[i])) {
        ident += source[i];
        i++;
        column++;
      }
      if (KEYWORDS.has(ident)) {
        push(ident as TokenType, ident, startLine, startColumn, startIndex, i);
      } else {
        push("identifier", ident, startLine, startColumn, startIndex, i);
      }
      continue;
    }

    throw new Error(`Unexpected character "${ch}" at ${line}:${column}`);
  }

  tokens.push({ type: "eof", lexeme: "", line, column, start: i, end: i });
  return tokens;
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isAlpha(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
}

function isAlphaNumeric(ch: string): boolean {
  return isAlpha(ch) || isDigit(ch);
}

function isSymbol(ch: string): boolean {
  return "+-*/%<>!&|.;#$".includes(ch);
}
