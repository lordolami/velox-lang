# Velox AST Schema (v1)

Version: 1
Source of truth: `src/ast.ts`

## Program

```ts
ProgramNode {
  kind: "Program";
  body: StatementNode[];
}
```

`StatementNode`:
- `ImportNode`
- `ComponentNode`
- `FastFunctionNode`

## Imports

```ts
ImportNode {
  kind: "Import";
  defaultImport: string | null;
  namespaceImport: string | null;
  namedImports: ImportBindingNode[];
  source: string;
  sideEffectOnly: boolean;
}

ImportBindingNode {
  imported: string;
  local: string;
}
```

## Components

```ts
ComponentNode {
  kind: "Component";
  name: string;
  params: ParamNode[];
  state: StateDeclNode[];
  render: RenderNode;
}

ParamNode {
  name: string;
  type: string;
}

StateDeclNode {
  name: string;
  value: ExpressionNode;
}
```

## Render

```ts
RenderNode {
  raw: string;
  normalized: string;
  segments: RenderSegmentNode[];
  events: RenderEventBindingNode[];
}
```

`RenderSegmentNode` union:
- `RenderTextSegmentNode`
- `RenderBindingSegmentNode`
- `RenderIfSegmentNode`
- `RenderEachSegmentNode`

```ts
RenderTextSegmentNode {
  kind: "RenderText";
  value: string;
}

RenderBindingSegmentNode {
  kind: "RenderBinding";
  name: string;
}

RenderIfSegmentNode {
  kind: "RenderIf";
  condition: string;
  consequent: RenderSegmentNode[];
  alternate: RenderSegmentNode[] | null;
}

RenderEachSegmentNode {
  kind: "RenderEach";
  source: string;
  item: string;
  index: string | null;
  body: RenderSegmentNode[];
}

RenderEventBindingNode {
  event: string;
  handler: string;
}
```

## Fast Functions

```ts
FastFunctionNode {
  kind: "FastFunction";
  name: string;
  params: ParamNode[];
  returnType: string;
  body: string;
}
```

## Expressions

`ExpressionNode` union:
- `NumberLiteralNode`
- `StringLiteralNode`
- `BooleanLiteralNode`
- `ArrayLiteralNode`
- `ObjectLiteralNode`
- `IdentifierNode`
- `UnaryExpressionNode`
- `BinaryExpressionNode`
- `CallExpressionNode`

```ts
NumberLiteralNode {
  kind: "NumberLiteral";
  value: number;
}

StringLiteralNode {
  kind: "StringLiteral";
  value: string;
}

BooleanLiteralNode {
  kind: "BooleanLiteral";
  value: boolean;
}

ArrayLiteralNode {
  kind: "ArrayLiteral";
  elements: ExpressionNode[];
}

ObjectLiteralNode {
  kind: "ObjectLiteral";
  properties: ObjectPropertyNode[];
}

ObjectPropertyNode {
  key: string;
  value: ExpressionNode;
}

IdentifierNode {
  kind: "Identifier";
  name: string;
}

UnaryExpressionNode {
  kind: "UnaryExpression";
  operator: "-" | "!";
  argument: ExpressionNode;
}

BinaryExpressionNode {
  kind: "BinaryExpression";
  operator: "+" | "-" | "*" | "/" | "%" | "==" | "!=" | "<" | ">" | "<=" | ">=" | "&&" | "||";
  left: ExpressionNode;
  right: ExpressionNode;
}

CallExpressionNode {
  kind: "CallExpression";
  callee: ExpressionNode;
  args: ExpressionNode[];
}
```
