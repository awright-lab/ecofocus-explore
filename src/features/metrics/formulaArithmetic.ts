type Node = { kind: "number"; value: number } | { kind: "input"; name: "A" | "B" } | { kind: "unary"; sign: 1 | -1; child: Node } | { kind: "binary"; operator: "+" | "-" | "*" | "/"; left: Node; right: Node };
export function parseCellFormula(expression: string): Node {
  if (typeof expression !== "string" || !expression.trim() || expression.length > 256) throw Error("Use a formula of at most 256 characters.");
  const tokens: string[] = []; let offset = 0;
  while (offset < expression.length) {
    if (/\s/.test(expression[offset])) { offset++; continue; }
    const token = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|^[AB()+*/-]/.exec(expression.slice(offset))?.[0];
    if (!token) throw Error("Use only A, B, finite numeric constants, +, -, *, / and parentheses. Functions and code are not accepted.");
    tokens.push(token); offset += token.length; if (tokens.length > 64) throw Error("Use at most 64 formula tokens.");
  }
  let index = 0; const references = new Set<string>();
  function term(depth: number): Node {
    if (depth > 12) throw Error("Use at most 12 nested formula levels.");
    const token = tokens[index++];
    if (token === "+" || token === "-") return { kind: "unary", sign: token === "-" ? -1 : 1, child: term(depth + 1) };
    if (token === "(") { const node = sum(depth + 1); if (tokens[index++] !== ")") throw Error("Close every formula parenthesis."); return node; }
    if (token === "A" || token === "B") { references.add(token); return { kind: "input", name: token }; }
    if (!token || !/^(?:\d|\.)/.test(token)) throw Error("Choose an input or a number after each operator.");
    const value = Number(token); if (!Number.isFinite(value) || Math.abs(value) > 1e12 || value !== 0 && Math.abs(value) < 1e-150 || value === 0 && /[1-9]/.test(token.split(/[eE]/)[0])) throw Error("Constants must be zero or have absolute magnitude from 1e-150 to 1e12.");
    return { kind: "number", value };
  }
  function product(depth: number): Node { let node = term(depth); while (tokens[index] === "*" || tokens[index] === "/") { const operator = tokens[index++] as "*" | "/"; node = { kind: "binary", operator, left: node, right: term(depth) }; } return node; }
  function sum(depth: number): Node { let node = product(depth); while (tokens[index] === "+" || tokens[index] === "-") { const operator = tokens[index++] as "+" | "-"; node = { kind: "binary", operator, left: node, right: product(depth) }; } return node; }
  const node = sum(0); if (index !== tokens.length) throw Error("Separate inputs with an operator; implicit multiplication is not supported.");
  if (!references.has("A") || !references.has("B")) throw Error("This paired-cell builder requires both A and B in the formula."); return node;
}
export function evaluateCellFormula(expression: string, a: number, b: number): number {
  if (![a, b].every(value => Number.isFinite(value) && Math.abs(value) <= 1e12)) throw Error("The recorded inputs exceed the supported finite range.");
  function visit(node: Node): number {
    if (node.kind === "number") return node.value;
    if (node.kind === "input") return node.name === "A" ? a : b;
    if (node.kind === "unary") return node.sign * visit(node.child);
    const left = visit(node.left), right = visit(node.right);
    if (node.operator === "/" && right === 0) throw Error("Division by zero: choose a different denominator or formula.");
    const value = node.operator === "+" ? left + right : node.operator === "-" ? left - right : node.operator === "*" ? left * right : left / right;
    if (!Number.isFinite(value) || Math.abs(value) > 1e15 || value === 0 && left !== 0 && right !== 0 && (node.operator === "*" || node.operator === "/")) throw Error("This calculation exceeds supported numeric range or underflows. Rescale the formula instead of treating it as zero.");
    return Object.is(value, -0) ? 0 : value;
  }
  return visit(parseCellFormula(expression));
}
