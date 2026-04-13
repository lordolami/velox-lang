export interface ProgramNode {
  kind: "Program";
  body: StatementNode[];
}

export type StatementNode = ImportNode | ComponentNode | FastFunctionNode;

export interface ImportNode {
  kind: "Import";
  defaultImport: string | null;
  namespaceImport: string | null;
  namedImports: ImportBindingNode[];
  source: string;
  sideEffectOnly: boolean;
}

export interface ImportBindingNode {
  imported: string;
  local: string;
}

export interface ComponentNode {
  kind: "Component";
  name: string;
  params: ParamNode[];
  state: StateDeclNode[];
  render: RenderNode;
}

export interface FastFunctionNode {
  kind: "FastFunction";
  name: string;
  params: ParamNode[];
  returnType: string;
  body: string;
}

export interface ParamNode {
  name: string;
  type: string;
}

export interface StateDeclNode {
  name: string;
  value: ExpressionNode;
}

export interface RenderNode {
  raw: string;
  normalized: string;
  segments: RenderSegmentNode[];
  events: RenderEventBindingNode[];
}

export type RenderSegmentNode =
  | RenderTextSegmentNode
  | RenderBindingSegmentNode
  | RenderIfSegmentNode
  | RenderEachSegmentNode;

export interface RenderTextSegmentNode {
  kind: "RenderText";
  value: string;
}

export interface RenderBindingSegmentNode {
  kind: "RenderBinding";
  name: string;
}

export interface RenderIfSegmentNode {
  kind: "RenderIf";
  condition: string;
  consequent: RenderSegmentNode[];
  alternate: RenderSegmentNode[] | null;
}

export interface RenderEachSegmentNode {
  kind: "RenderEach";
  source: string;
  item: string;
  index: string | null;
  body: RenderSegmentNode[];
}

export interface RenderEventBindingNode {
  event: string;
  handler: string;
}

export type ExpressionNode =
  | NumberLiteralNode
  | StringLiteralNode
  | BooleanLiteralNode
  | ArrayLiteralNode
  | ObjectLiteralNode
  | IdentifierNode
  | MemberExpressionNode
  | UnaryExpressionNode
  | BinaryExpressionNode
  | CallExpressionNode;

export interface NumberLiteralNode {
  kind: "NumberLiteral";
  value: number;
}

export interface StringLiteralNode {
  kind: "StringLiteral";
  value: string;
}

export interface BooleanLiteralNode {
  kind: "BooleanLiteral";
  value: boolean;
}

export interface ArrayLiteralNode {
  kind: "ArrayLiteral";
  elements: ExpressionNode[];
}

export interface ObjectLiteralNode {
  kind: "ObjectLiteral";
  properties: ObjectPropertyNode[];
}

export interface ObjectPropertyNode {
  key: string;
  value: ExpressionNode;
}

export interface IdentifierNode {
  kind: "Identifier";
  name: string;
}

export interface MemberExpressionNode {
  kind: "MemberExpression";
  object: ExpressionNode;
  property: ExpressionNode;
  computed: boolean;
}

export interface CallExpressionNode {
  kind: "CallExpression";
  callee: ExpressionNode;
  args: ExpressionNode[];
}

export interface UnaryExpressionNode {
  kind: "UnaryExpression";
  operator: "-" | "!";
  argument: ExpressionNode;
}

export interface BinaryExpressionNode {
  kind: "BinaryExpression";
  operator: "+" | "-" | "*" | "/" | "%" | "==" | "!=" | "<" | ">" | "<=" | ">=" | "&&" | "||";
  left: ExpressionNode;
  right: ExpressionNode;
}
