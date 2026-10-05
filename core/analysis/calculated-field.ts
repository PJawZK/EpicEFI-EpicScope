import type { NumericChannelRange } from '../log-model/log-types';

type Token =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'reference'; readonly value: string }
  | { readonly kind: 'identifier'; readonly value: string }
  | { readonly kind: 'operator'; readonly value: '+' | '-' | '*' | '/' | '%' | '^' }
  | { readonly kind: 'left-paren' }
  | { readonly kind: 'right-paren' }
  | { readonly kind: 'comma' };

type ExpressionNode =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'reference'; readonly reference: string }
  | { readonly kind: 'unary'; readonly operator: '+' | '-'; readonly operand: ExpressionNode }
  | { readonly kind: 'binary'; readonly operator: '+' | '-' | '*' | '/' | '%' | '^'; readonly left: ExpressionNode; readonly right: ExpressionNode }
  | { readonly kind: 'call'; readonly name: string; readonly args: readonly ExpressionNode[] };

export interface CalculatedFieldProgram {
  readonly expression: string;
  readonly references: readonly string[];
  evaluate(resolveReference: (reference: string) => number): number;
}

const FUNCTION_NAMES = new Set(['abs', 'min', 'max', 'sqrt', 'pow', 'clamp', 'round', 'floor', 'ceil', 'log', 'exp']);

function tokenize(expression: string): readonly Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < expression.length) {
    const ch = expression[index]!;
    if (/\s/.test(ch)) { index += 1; continue; }
    if (ch === '[') {
      const end = expression.indexOf(']', index + 1);
      if (end < 0) throw new RangeError('Calculated field reference is missing a closing ].');
      const reference = expression.slice(index + 1, end).trim();
      if (!reference) throw new RangeError('Calculated field reference must not be empty.');
      tokens.push({ kind: 'reference', value: reference });
      index = end + 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const match = expression.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      if (!match) throw new RangeError(`Invalid numeric literal near ${expression.slice(index, index + 12)}.`);
      const value = Number(match[0]);
      if (!Number.isFinite(value)) throw new RangeError('Calculated field numeric literals must be finite.');
      tokens.push({ kind: 'number', value });
      index += match[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const match = expression.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/)!;
      tokens.push({ kind: 'identifier', value: match[0] });
      index += match[0].length;
      continue;
    }
    if (ch === '(') tokens.push({ kind: 'left-paren' });
    else if (ch === ')') tokens.push({ kind: 'right-paren' });
    else if (ch === ',') tokens.push({ kind: 'comma' });
    else if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%' || ch === '^') {
      tokens.push({ kind: 'operator', value: ch });
    } else throw new RangeError(`Unsupported calculated-field token: ${ch}`);
    index += 1;
  }
  return tokens;
}

class Parser {
  private index = 0;
  constructor(private readonly tokens: readonly Token[]) {}

  parse(): ExpressionNode {
    if (this.tokens.length === 0) throw new RangeError('Calculated field expression must not be empty.');
    const node = this.parseAdditive();
    if (this.peek()) throw new RangeError('Unexpected token at end of calculated field expression.');
    return node;
  }

  private peek(): Token | undefined { return this.tokens[this.index]; }
  private take(): Token | undefined { const token = this.tokens[this.index]; if (token) this.index += 1; return token; }

  private parseAdditive(): ExpressionNode {
    let node = this.parseMultiplicative();
    while (this.peek()?.kind === 'operator' && (this.peek() as Extract<Token, { kind: 'operator' }>).value.match(/^[+-]$/)) {
      const operator = (this.take() as Extract<Token, { kind: 'operator' }>).value as '+' | '-';
      node = { kind: 'binary', operator, left: node, right: this.parseMultiplicative() };
    }
    return node;
  }

  private parseMultiplicative(): ExpressionNode {
    let node = this.parsePower();
    while (this.peek()?.kind === 'operator' && (this.peek() as Extract<Token, { kind: 'operator' }>).value.match(/^[*/%]$/)) {
      const operator = (this.take() as Extract<Token, { kind: 'operator' }>).value as '*' | '/' | '%';
      node = { kind: 'binary', operator, left: node, right: this.parsePower() };
    }
    return node;
  }

  private parsePower(): ExpressionNode {
    let node = this.parseUnary();
    if (this.peek()?.kind === 'operator' && (this.peek() as Extract<Token, { kind: 'operator' }>).value === '^') {
      this.take();
      node = { kind: 'binary', operator: '^', left: node, right: this.parsePower() };
    }
    return node;
  }

  private parseUnary(): ExpressionNode {
    const token = this.peek();
    if (token?.kind === 'operator' && (token.value === '+' || token.value === '-')) {
      this.take();
      return { kind: 'unary', operator: token.value, operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExpressionNode {
    const token = this.take();
    if (!token) throw new RangeError('Unexpected end of calculated field expression.');
    if (token.kind === 'number') return { kind: 'number', value: token.value };
    if (token.kind === 'reference') return { kind: 'reference', reference: token.value };
    if (token.kind === 'left-paren') {
      const node = this.parseAdditive();
      if (this.take()?.kind !== 'right-paren') throw new RangeError('Calculated field parenthesis is not closed.');
      return node;
    }
    if (token.kind === 'identifier') {
      const name = token.value.toLowerCase();
      if (!FUNCTION_NAMES.has(name)) throw new RangeError(`Unsupported calculated-field function: ${token.value}`);
      if (this.take()?.kind !== 'left-paren') throw new RangeError(`Function ${token.value} must be followed by parentheses.`);
      const args: ExpressionNode[] = [];
      if (this.peek()?.kind !== 'right-paren') {
        for (;;) {
          args.push(this.parseAdditive());
          if (this.peek()?.kind !== 'comma') break;
          this.take();
        }
      }
      if (this.take()?.kind !== 'right-paren') throw new RangeError(`Function ${token.value} is missing a closing parenthesis.`);
      return { kind: 'call', name, args };
    }
    throw new RangeError('Unexpected token in calculated field expression.');
  }
}

function evaluateCall(name: string, args: readonly number[]): number {
  if (name === 'abs') { if (args.length !== 1) throw new RangeError('abs() expects 1 argument.'); return Math.abs(args[0]!); }
  if (name === 'sqrt') { if (args.length !== 1) throw new RangeError('sqrt() expects 1 argument.'); return Math.sqrt(args[0]!); }
  if (name === 'round') { if (args.length !== 1) throw new RangeError('round() expects 1 argument.'); return Math.round(args[0]!); }
  if (name === 'floor') { if (args.length !== 1) throw new RangeError('floor() expects 1 argument.'); return Math.floor(args[0]!); }
  if (name === 'ceil') { if (args.length !== 1) throw new RangeError('ceil() expects 1 argument.'); return Math.ceil(args[0]!); }
  if (name === 'log') { if (args.length !== 1) throw new RangeError('log() expects 1 argument.'); return Math.log(args[0]!); }
  if (name === 'exp') { if (args.length !== 1) throw new RangeError('exp() expects 1 argument.'); return Math.exp(args[0]!); }
  if (name === 'pow') { if (args.length !== 2) throw new RangeError('pow() expects 2 arguments.'); return Math.pow(args[0]!, args[1]!); }
  if (name === 'clamp') { if (args.length !== 3) throw new RangeError('clamp() expects 3 arguments.'); return Math.min(args[2]!, Math.max(args[1]!, args[0]!)); }
  if (name === 'min') { if (args.length < 1) throw new RangeError('min() expects at least 1 argument.'); return Math.min(...args); }
  if (name === 'max') { if (args.length < 1) throw new RangeError('max() expects at least 1 argument.'); return Math.max(...args); }
  throw new RangeError(`Unsupported calculated-field function: ${name}`);
}

function evaluateNode(node: ExpressionNode, resolveReference: (reference: string) => number): number {
  if (node.kind === 'number') return node.value;
  if (node.kind === 'reference') return resolveReference(node.reference);
  if (node.kind === 'unary') {
    const value = evaluateNode(node.operand, resolveReference);
    return node.operator === '-' ? -value : value;
  }
  if (node.kind === 'call') return evaluateCall(node.name, node.args.map((arg) => evaluateNode(arg, resolveReference)));
  const left = evaluateNode(node.left, resolveReference);
  const right = evaluateNode(node.right, resolveReference);
  if (node.operator === '+') return left + right;
  if (node.operator === '-') return left - right;
  if (node.operator === '*') return left * right;
  if (node.operator === '/') return left / right;
  if (node.operator === '%') return left % right;
  return Math.pow(left, right);
}

function collectReferences(node: ExpressionNode, into: string[]): void {
  if (node.kind === 'reference') { if (!into.includes(node.reference)) into.push(node.reference); return; }
  if (node.kind === 'unary') { collectReferences(node.operand, into); return; }
  if (node.kind === 'binary') { collectReferences(node.left, into); collectReferences(node.right, into); return; }
  if (node.kind === 'call') for (const arg of node.args) collectReferences(arg, into);
}

export function compileCalculatedField(expression: string): CalculatedFieldProgram {
  const root = new Parser(tokenize(expression)).parse();
  const references: string[] = [];
  collectReferences(root, references);
  if (references.length === 0) throw new RangeError('Calculated field must reference at least one channel using [Channel Name].');
  return {
    expression,
    references,
    evaluate: (resolveReference) => evaluateNode(root, resolveReference),
  };
}

function localIndex(range: NumericChannelRange, sampleIndex: number): number | undefined {
  const index = sampleIndex - range.startSampleIndex;
  return Number.isSafeInteger(index) && index >= 0 && index < range.values.length && index < range.validity.length && index < range.timeMs.length
    ? index : undefined;
}

export function evaluateCalculatedFieldRange(
  program: CalculatedFieldProgram,
  rangesByReference: ReadonlyMap<string, NumericChannelRange>,
): NumericChannelRange {
  const referenceRange = rangesByReference.get(program.references[0]!);
  if (!referenceRange) throw new RangeError(`Missing calculated-field channel: ${program.references[0]}`);
  for (const reference of program.references) {
    if (!rangesByReference.has(reference)) throw new RangeError(`Missing calculated-field channel: ${reference}`);
  }

  const values = new Float64Array(referenceRange.values.length);
  values.fill(Number.NaN);
  const validity = new Uint8Array(referenceRange.values.length);
  const timeMs = new Float64Array(referenceRange.timeMs);

  for (let index = 0; index < referenceRange.values.length; index += 1) {
    const sampleIndex = referenceRange.startSampleIndex + index;
    let valid = true;
    const resolved = new Map<string, number>();
    for (const reference of program.references) {
      const range = rangesByReference.get(reference)!;
      const aligned = localIndex(range, sampleIndex);
      const value = aligned === undefined ? undefined : range.values[aligned];
      if (aligned === undefined || range.validity[aligned] !== 1 || value === undefined || !Number.isFinite(value)) {
        valid = false;
        break;
      }
      resolved.set(reference, value);
    }
    if (!valid) continue;
    try {
      const value = program.evaluate((reference) => resolved.get(reference)!);
      if (!Number.isFinite(value)) continue;
      values[index] = value;
      validity[index] = 1;
    } catch {
      // Domain errors are invalid samples, not evaluator failures.
    }
  }

  return { startSampleIndex: referenceRange.startSampleIndex, timeMs, values, validity };
}
