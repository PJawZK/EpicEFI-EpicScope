from pathlib import Path
ROOT = Path('.')

def replace_once(path: str, old: str, new: str) -> None:
    p = ROOT / path
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one anchor, found {count}')
    p.write_text(text.replace(old, new, 1))

# Replace the arithmetic-only evaluator with the research-driven expression/runtime surface.
(ROOT / 'core/analysis/calculated-field.ts').write_text(r'''import type { NumericChannelRange } from '../log-model/log-types';

type Operator = '+' | '-' | '*' | '/' | '%' | '^' | '<' | '<=' | '>' | '>=' | '==' | '!=' | '&&' | '||' | '!';
type Token =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'reference'; readonly value: string }
  | { readonly kind: 'identifier'; readonly value: string }
  | { readonly kind: 'operator'; readonly value: Operator }
  | { readonly kind: 'left-paren' }
  | { readonly kind: 'right-paren' }
  | { readonly kind: 'comma' };

type ExpressionNode =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'reference'; readonly reference: string }
  | { readonly kind: 'unary'; readonly operator: '+' | '-' | '!'; readonly operand: ExpressionNode }
  | { readonly kind: 'binary'; readonly operator: Exclude<Operator, '!'>; readonly left: ExpressionNode; readonly right: ExpressionNode }
  | { readonly kind: 'call'; readonly name: string; readonly args: readonly ExpressionNode[] };

export interface CalculatedFieldRangeBinding {
  readonly range: NumericChannelRange;
  /** Number of source samples before the current sample represented by this reference. */
  readonly sampleOffset?: number;
}

export interface CalculatedFieldOffsetReference {
  readonly baseReference: string;
  readonly sampleOffset: number;
}

export interface CalculatedFieldProgram {
  readonly expression: string;
  readonly references: readonly string[];
  /** Scalar evaluation for non-temporal formulas and simple callers/tests. */
  evaluate(resolveReference: (reference: string) => number): number;
  /** Sample-aware evaluation used by range materialization and temporal formulas. */
  evaluateSample(
    resolveReference: (reference: string, sampleOffset: number) => number,
    resolveTime?: (reference: string, sampleOffset: number) => number,
  ): number;
}

const FUNCTION_NAMES = new Set([
  'abs', 'min', 'max', 'sqrt', 'pow', 'clamp', 'round', 'floor', 'ceil', 'log', 'exp',
  'if', 'lag', 'delta', 'avg', 'rate',
]);
const MAX_TEMPORAL_WINDOW = 4096;

/**
 * Parses MLV-style historical references such as [RPM-1]. Callers must first
 * attempt an exact channel-name/id match so a real source named "RPM-1" keeps
 * its literal meaning.
 */
export function splitCalculatedFieldOffsetReference(reference: string): CalculatedFieldOffsetReference | undefined {
  const match = reference.trim().match(/^(.*?)-(\d+)$/);
  if (!match) return undefined;
  const baseReference = match[1]?.trim() ?? '';
  const sampleOffset = Number(match[2]);
  if (!baseReference || !Number.isSafeInteger(sampleOffset) || sampleOffset < 0) return undefined;
  return { baseReference, sampleOffset };
}

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
    const pair = expression.slice(index, index + 2);
    if (pair === '<=' || pair === '>=' || pair === '==' || pair === '!=' || pair === '&&' || pair === '||') {
      tokens.push({ kind: 'operator', value: pair });
      index += 2;
      continue;
    }
    if (ch === '(') tokens.push({ kind: 'left-paren' });
    else if (ch === ')') tokens.push({ kind: 'right-paren' });
    else if (ch === ',') tokens.push({ kind: 'comma' });
    else if ('+-*/%^<>!'.includes(ch)) tokens.push({ kind: 'operator', value: ch as Operator });
    else throw new RangeError(`Unsupported calculated-field token: ${ch}`);
    index += 1;
  }
  return tokens;
}

class Parser {
  private index = 0;
  constructor(private readonly tokens: readonly Token[]) {}

  parse(): ExpressionNode {
    if (this.tokens.length === 0) throw new RangeError('Calculated field expression must not be empty.');
    const node = this.parseOr();
    if (this.peek()) throw new RangeError('Unexpected token at end of calculated field expression.');
    return node;
  }

  private peek(): Token | undefined { return this.tokens[this.index]; }
  private take(): Token | undefined { const token = this.tokens[this.index]; if (token) this.index += 1; return token; }
  private isWord(value: string): boolean {
    const token = this.peek();
    return token?.kind === 'identifier' && token.value.toLowerCase() === value;
  }

  private parseOr(): ExpressionNode {
    let node = this.parseAnd();
    while ((this.peek()?.kind === 'operator' && this.peekOperator() === '||') || this.isWord('or')) {
      this.take();
      node = { kind: 'binary', operator: '||', left: node, right: this.parseAnd() };
    }
    return node;
  }

  private parseAnd(): ExpressionNode {
    let node = this.parseComparison();
    while ((this.peek()?.kind === 'operator' && this.peekOperator() === '&&') || this.isWord('and')) {
      this.take();
      node = { kind: 'binary', operator: '&&', left: node, right: this.parseComparison() };
    }
    return node;
  }

  private parseComparison(): ExpressionNode {
    let node = this.parseAdditive();
    while (this.peek()?.kind === 'operator' && ['<', '<=', '>', '>=', '==', '!='].includes(this.peekOperator() ?? '')) {
      const operator = (this.take() as Extract<Token, { kind: 'operator' }>).value as '<' | '<=' | '>' | '>=' | '==' | '!=';
      node = { kind: 'binary', operator, left: node, right: this.parseAdditive() };
    }
    return node;
  }

  private peekOperator(): Operator | undefined {
    const token = this.peek();
    return token?.kind === 'operator' ? token.value : undefined;
  }

  private parseAdditive(): ExpressionNode {
    let node = this.parseMultiplicative();
    while (this.peek()?.kind === 'operator' && (this.peekOperator() === '+' || this.peekOperator() === '-')) {
      const operator = (this.take() as Extract<Token, { kind: 'operator' }>).value as '+' | '-';
      node = { kind: 'binary', operator, left: node, right: this.parseMultiplicative() };
    }
    return node;
  }

  private parseMultiplicative(): ExpressionNode {
    let node = this.parsePower();
    while (this.peek()?.kind === 'operator' && ['*', '/', '%'].includes(this.peekOperator() ?? '')) {
      const operator = (this.take() as Extract<Token, { kind: 'operator' }>).value as '*' | '/' | '%';
      node = { kind: 'binary', operator, left: node, right: this.parsePower() };
    }
    return node;
  }

  private parsePower(): ExpressionNode {
    let node = this.parseUnary();
    if (this.peek()?.kind === 'operator' && this.peekOperator() === '^') {
      this.take();
      node = { kind: 'binary', operator: '^', left: node, right: this.parsePower() };
    }
    return node;
  }

  private parseUnary(): ExpressionNode {
    const token = this.peek();
    if (token?.kind === 'operator' && (token.value === '+' || token.value === '-' || token.value === '!')) {
      this.take();
      return { kind: 'unary', operator: token.value, operand: this.parseUnary() };
    }
    if (this.isWord('not')) {
      this.take();
      return { kind: 'unary', operator: '!', operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExpressionNode {
    const token = this.take();
    if (!token) throw new RangeError('Unexpected end of calculated field expression.');
    if (token.kind === 'number') return { kind: 'number', value: token.value };
    if (token.kind === 'reference') return { kind: 'reference', reference: token.value };
    if (token.kind === 'left-paren') {
      const node = this.parseOr();
      if (this.take()?.kind !== 'right-paren') throw new RangeError('Calculated field parenthesis is not closed.');
      return node;
    }
    if (token.kind === 'identifier') {
      const name = token.value.toLowerCase();
      if (!FUNCTION_NAMES.has(name)) throw new RangeError(`Unsupported calculated-field function or keyword: ${token.value}`);
      if (this.take()?.kind !== 'left-paren') throw new RangeError(`Function ${token.value} must be followed by parentheses.`);
      const args: ExpressionNode[] = [];
      if (this.peek()?.kind !== 'right-paren') {
        for (;;) {
          args.push(this.parseOr());
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

function truthy(value: number): boolean { return Number.isFinite(value) && value !== 0; }

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

interface EvaluationContext {
  readonly resolveReference: (reference: string, sampleOffset: number) => number;
  readonly resolveTime?: (reference: string, sampleOffset: number) => number;
}

function temporalOffset(node: ExpressionNode, context: EvaluationContext, name: string, allowZero = true): number {
  const value = evaluateNode(node, context);
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > MAX_TEMPORAL_WINDOW) {
    throw new RangeError(`${name} sample/window argument must be an integer between ${allowZero ? 0 : 1} and ${MAX_TEMPORAL_WINDOW}.`);
  }
  return value;
}

function referenceArgument(node: ExpressionNode | undefined, name: string): string {
  if (!node || node.kind !== 'reference') throw new RangeError(`${name}() first argument must be a [Channel] reference.`);
  return node.reference;
}

function evaluateNode(node: ExpressionNode, context: EvaluationContext): number {
  if (node.kind === 'number') return node.value;
  if (node.kind === 'reference') return context.resolveReference(node.reference, 0);
  if (node.kind === 'unary') {
    const value = evaluateNode(node.operand, context);
    if (node.operator === '-') return -value;
    if (node.operator === '!') return truthy(value) ? 0 : 1;
    return value;
  }
  if (node.kind === 'call') {
    if (node.name === 'if') {
      if (node.args.length !== 3) throw new RangeError('if() expects condition, true value, false value.');
      return truthy(evaluateNode(node.args[0]!, context))
        ? evaluateNode(node.args[1]!, context)
        : evaluateNode(node.args[2]!, context);
    }
    if (node.name === 'lag' || node.name === 'delta' || node.name === 'avg' || node.name === 'rate') {
      if (node.args.length !== 2) throw new RangeError(`${node.name}() expects a [Channel] reference and sample/window count.`);
      const reference = referenceArgument(node.args[0], node.name);
      if (node.name === 'avg') {
        const window = temporalOffset(node.args[1]!, context, 'avg', false);
        let sum = 0;
        for (let offset = 0; offset < window; offset += 1) sum += context.resolveReference(reference, offset);
        return sum / window;
      }
      const offset = temporalOffset(node.args[1]!, context, node.name);
      const current = context.resolveReference(reference, 0);
      const previous = context.resolveReference(reference, offset);
      if (node.name === 'lag') return previous;
      const delta = current - previous;
      if (node.name === 'delta') return delta;
      if (!context.resolveTime) throw new RangeError('rate() requires source timestamps.');
      const seconds = (context.resolveTime(reference, 0) - context.resolveTime(reference, offset)) / 1000;
      if (!(seconds > 0) || !Number.isFinite(seconds)) throw new RangeError('rate() requires a positive finite time interval.');
      return delta / seconds;
    }
    return evaluateCall(node.name, node.args.map((arg) => evaluateNode(arg, context)));
  }

  if (node.operator === '&&') {
    const left = evaluateNode(node.left, context);
    return truthy(left) && truthy(evaluateNode(node.right, context)) ? 1 : 0;
  }
  if (node.operator === '||') {
    const left = evaluateNode(node.left, context);
    return truthy(left) || truthy(evaluateNode(node.right, context)) ? 1 : 0;
  }
  const left = evaluateNode(node.left, context);
  const right = evaluateNode(node.right, context);
  if (node.operator === '+') return left + right;
  if (node.operator === '-') return left - right;
  if (node.operator === '*') return left * right;
  if (node.operator === '/') return left / right;
  if (node.operator === '%') return left % right;
  if (node.operator === '^') return Math.pow(left, right);
  if (node.operator === '<') return left < right ? 1 : 0;
  if (node.operator === '<=') return left <= right ? 1 : 0;
  if (node.operator === '>') return left > right ? 1 : 0;
  if (node.operator === '>=') return left >= right ? 1 : 0;
  if (node.operator === '==') return left === right ? 1 : 0;
  return left !== right ? 1 : 0;
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
  const evaluateSample = (
    resolveReference: (reference: string, sampleOffset: number) => number,
    resolveTime?: (reference: string, sampleOffset: number) => number,
  ): number => evaluateNode(root, { resolveReference, ...(resolveTime ? { resolveTime } : {}) });
  return {
    expression,
    references,
    evaluate: (resolveReference) => evaluateSample((reference, sampleOffset) => {
      if (sampleOffset !== 0) throw new RangeError('Temporal calculated-field functions require sample-aware evaluation.');
      return resolveReference(reference);
    }),
    evaluateSample,
  };
}

function normalizeBinding(value: NumericChannelRange | CalculatedFieldRangeBinding): Required<CalculatedFieldRangeBinding> {
  if ('range' in value) return { range: value.range, sampleOffset: value.sampleOffset ?? 0 };
  return { range: value, sampleOffset: 0 };
}

function localIndex(range: NumericChannelRange, sampleIndex: number): number | undefined {
  const index = sampleIndex - range.startSampleIndex;
  return Number.isSafeInteger(index) && index >= 0 && index < range.values.length && index < range.validity.length && index < range.timeMs.length
    ? index : undefined;
}

export function evaluateCalculatedFieldRange(
  program: CalculatedFieldProgram,
  rangesByReference: ReadonlyMap<string, NumericChannelRange | CalculatedFieldRangeBinding>,
): NumericChannelRange {
  const rawReferenceRange = rangesByReference.get(program.references[0]!);
  if (!rawReferenceRange) throw new RangeError(`Missing calculated-field channel: ${program.references[0]}`);
  const bindings = new Map<string, Required<CalculatedFieldRangeBinding>>();
  for (const reference of program.references) {
    const raw = rangesByReference.get(reference);
    if (!raw) throw new RangeError(`Missing calculated-field channel: ${reference}`);
    bindings.set(reference, normalizeBinding(raw));
  }
  const referenceRange = normalizeBinding(rawReferenceRange).range;
  const values = new Float64Array(referenceRange.values.length);
  values.fill(Number.NaN);
  const validity = new Uint8Array(referenceRange.values.length);
  const timeMs = new Float64Array(referenceRange.timeMs);

  for (let index = 0; index < referenceRange.values.length; index += 1) {
    const sampleIndex = referenceRange.startSampleIndex + index;
    const resolveLocal = (reference: string, extraOffset: number): { binding: Required<CalculatedFieldRangeBinding>; index: number } => {
      const binding = bindings.get(reference);
      if (!binding) throw new RangeError(`Missing calculated-field channel: ${reference}`);
      const targetSampleIndex = sampleIndex - binding.sampleOffset - extraOffset;
      const aligned = localIndex(binding.range, targetSampleIndex);
      if (aligned === undefined) throw new RangeError('Historical calculated-field sample is outside the available source range.');
      return { binding, index: aligned };
    };
    try {
      const value = program.evaluateSample(
        (reference, offset) => {
          const resolved = resolveLocal(reference, offset);
          const sourceValue = resolved.binding.range.values[resolved.index];
          if (resolved.binding.range.validity[resolved.index] !== 1 || sourceValue === undefined || !Number.isFinite(sourceValue)) {
            throw new RangeError('Calculated-field source sample is invalid.');
          }
          return sourceValue;
        },
        (reference, offset) => {
          const resolved = resolveLocal(reference, offset);
          const time = resolved.binding.range.timeMs[resolved.index];
          if (time === undefined || !Number.isFinite(time)) throw new RangeError('Calculated-field source timestamp is invalid.');
          return time;
        },
      );
      if (!Number.isFinite(value)) continue;
      values[index] = value;
      validity[index] = 1;
    } catch {
      // Missing history, invalid dependencies, domain errors and invalid rates become invalid samples.
    }
  }

  return { startSampleIndex: referenceRange.startSampleIndex, timeMs, values, validity };
}
''')

# Logical context: exact physical match first, then MLV-style [Channel-N] lookback fallback.
replace_once(
    'apps/web/src/pages/histogram-logical-context.ts',
    "import { compileCalculatedField, evaluateCalculatedFieldRange } from '../../../../core/analysis/calculated-field';",
    "import { compileCalculatedField, evaluateCalculatedFieldRange, splitCalculatedFieldOffsetReference, type CalculatedFieldRangeBinding } from '../../../../core/analysis/calculated-field';",
)
replace_once(
    'apps/web/src/pages/histogram-logical-context.ts',
    """function resolvePhysicalReference(reference: string, channels: readonly ChannelDefinition[]): ChannelDefinition {\n  const normalized = reference.trim().toLocaleLowerCase();\n  const matches = channels.filter((channel) =>\n    channel.id === reference\n    || channel.displayName.toLocaleLowerCase() === normalized\n    || channel.sourceName.toLocaleLowerCase() === normalized,\n  );\n  if (matches.length === 0) throw new RangeError(`Formula channel not found: [${reference}]`);\n  if (matches.length > 1) throw new RangeError(`Formula channel reference is ambiguous: [${reference}]`);\n  return matches[0]!;\n}\n""",
    """interface ResolvedPhysicalReference {\n  readonly channel: ChannelDefinition;\n  readonly sampleOffset: number;\n}\n\nfunction exactPhysicalReference(reference: string, channels: readonly ChannelDefinition[]): ChannelDefinition | undefined {\n  const normalized = reference.trim().toLocaleLowerCase();\n  const matches = channels.filter((channel) =>\n    channel.id === reference\n    || channel.displayName.toLocaleLowerCase() === normalized\n    || channel.sourceName.toLocaleLowerCase() === normalized,\n  );\n  if (matches.length > 1) throw new RangeError(`Formula channel reference is ambiguous: [${reference}]`);\n  return matches[0];\n}\n\nfunction resolvePhysicalReference(reference: string, channels: readonly ChannelDefinition[]): ResolvedPhysicalReference {\n  const exact = exactPhysicalReference(reference, channels);\n  if (exact) return { channel: exact, sampleOffset: 0 };\n  const historical = splitCalculatedFieldOffsetReference(reference);\n  if (historical) {\n    const base = exactPhysicalReference(historical.baseReference, channels);\n    if (base) return { channel: base, sampleOffset: historical.sampleOffset };\n  }\n  throw new RangeError(`Formula channel not found: [${reference}]`);\n}\n""",
)
replace_once(
    'apps/web/src/pages/histogram-logical-context.ts',
    "const referencesByLogicalId = new Map<string, ReadonlyMap<string, ChannelDefinition>>();",
    "const referencesByLogicalId = new Map<string, ReadonlyMap<string, ResolvedPhysicalReference>>();",
)
replace_once(
    'apps/web/src/pages/histogram-logical-context.ts',
    """        const references = new Map<string, ChannelDefinition>();\n        for (const reference of program.references) {\n          const channel = resolvePhysicalReference(reference, baseContext.channels);\n          references.set(reference, channel);\n          physicalIds.add(channel.id);\n        }\n""",
    """        const references = new Map<string, ResolvedPhysicalReference>();\n        for (const reference of program.references) {\n          const resolved = resolvePhysicalReference(reference, baseContext.channels);\n          references.set(reference, resolved);\n          physicalIds.add(resolved.channel.id);\n        }\n""",
)
replace_once(
    'apps/web/src/pages/histogram-logical-context.ts',
    """        const ranges = new Map<string, HistogramTraceContext['range']>();\n        let complete = true;\n        let firstTrace: HistogramTraceContext | undefined;\n        for (const [reference, channel] of references) {\n          const trace = physical.get(channel.id);\n          if (!trace) {\n            complete = false;\n            continue;\n          }\n          firstTrace ??= trace;\n          ranges.set(reference, trace.range);\n          complete &&= traceCoversRequestedScope(trace, startMs, endMs);\n        }\n""",
    """        const ranges = new Map<string, CalculatedFieldRangeBinding>();\n        let complete = true;\n        let firstTrace: HistogramTraceContext | undefined;\n        for (const [reference, resolved] of references) {\n          const trace = physical.get(resolved.channel.id);\n          if (!trace) {\n            complete = false;\n            continue;\n          }\n          firstTrace ??= trace;\n          ranges.set(reference, { range: trace.range, sampleOffset: resolved.sampleOffset });\n          complete &&= traceCoversRequestedScope(trace, startMs, endMs);\n        }\n""",
)

# Math Channels editor uses the same exact-first historical reference resolution.
replace_once(
    'apps/web/src/pages/histogram-math-channels-view.ts',
    "import { compileCalculatedField, evaluateCalculatedFieldRange } from '../../../../core/analysis/calculated-field';",
    "import { compileCalculatedField, evaluateCalculatedFieldRange, splitCalculatedFieldOffsetReference, type CalculatedFieldRangeBinding } from '../../../../core/analysis/calculated-field';",
)
replace_once(
    'apps/web/src/pages/histogram-math-channels-view.ts',
    """  const resolveReference = (reference: string): ChannelDefinition => {\n    const normalized = reference.trim().toLocaleLowerCase();\n    const matches = context.channels.filter((channel) =>\n      channel.id === reference\n      || channelLabel(channel).toLocaleLowerCase() === normalized\n      || channel.sourceName.toLocaleLowerCase() === normalized,\n    );\n    if (matches.length === 0) throw new RangeError(`Channel not found: [${reference}]`);\n    if (matches.length > 1) throw new RangeError(`Channel reference is ambiguous: [${reference}]`);\n    return matches[0]!;\n  };\n""",
    """  const exactReference = (reference: string): ChannelDefinition | undefined => {\n    const normalized = reference.trim().toLocaleLowerCase();\n    const matches = context.channels.filter((channel) =>\n      !channel.id.startsWith('formula:')\n      && (channel.id === reference\n        || channelLabel(channel).toLocaleLowerCase() === normalized\n        || channel.sourceName.toLocaleLowerCase() === normalized),\n    );\n    if (matches.length > 1) throw new RangeError(`Channel reference is ambiguous: [${reference}]`);\n    return matches[0];\n  };\n\n  const resolveReference = (reference: string): { readonly channel: ChannelDefinition; readonly sampleOffset: number } => {\n    const exact = exactReference(reference);\n    if (exact) return { channel: exact, sampleOffset: 0 };\n    const historical = splitCalculatedFieldOffsetReference(reference);\n    if (historical) {\n      const base = exactReference(historical.baseReference);\n      if (base) return { channel: base, sampleOffset: historical.sampleOffset };\n    }\n    throw new RangeError(`Channel not found: [${reference}]`);\n  };\n""",
)
# Helper toolbar and explanatory text.
replace_once(
    'apps/web/src/pages/histogram-math-channels-view.ts',
    """            <button type=\"button\" data-insert=\"abs()\">abs()</button><button type=\"button\" data-insert=\"min()\">min()</button><button type=\"button\" data-insert=\"max()\">max()</button><button type=\"button\" data-insert=\"clamp()\">clamp()</button><button type=\"button\" data-insert=\"sqrt()\">sqrt()</button><button type=\"button\" data-insert=\"pow()\">pow()</button><button type=\"button\" data-insert=\"round()\">round()</button>\n          </div>\n          <p class=\"math-channel-help\">Click a source channel below to insert a <strong>[Channel Name]</strong> reference. Examples: <code>[Fuel Pressure] - [MAP]</code> · <code>clamp([TPS], 0, 100)</code> · <code>[Lambda] * 14.1</code>.</p>\n""",
    """            <button type=\"button\" data-insert=\" &gt; \" title=\"Greater than\">&gt;</button><button type=\"button\" data-insert=\" &lt; \" title=\"Less than\">&lt;</button><button type=\"button\" data-insert=\" &gt;= \">&gt;=</button><button type=\"button\" data-insert=\" &lt;= \">&lt;=</button><button type=\"button\" data-insert=\" == \">==</button><button type=\"button\" data-insert=\" != \">!=</button>\n            <button type=\"button\" data-insert=\" AND \">AND</button><button type=\"button\" data-insert=\" OR \">OR</button><button type=\"button\" data-insert=\" NOT \">NOT</button>\n            <button type=\"button\" data-insert=\"if()\">if()</button><button type=\"button\" data-insert=\"lag(, 1)\">lag()</button><button type=\"button\" data-insert=\"delta(, 1)\">delta()</button><button type=\"button\" data-insert=\"avg(, 5)\">avg()</button><button type=\"button\" data-insert=\"rate(, 1)\">rate()</button>\n            <button type=\"button\" data-insert=\"abs()\">abs()</button><button type=\"button\" data-insert=\"min()\">min()</button><button type=\"button\" data-insert=\"max()\">max()</button><button type=\"button\" data-insert=\"clamp()\">clamp()</button><button type=\"button\" data-insert=\"sqrt()\">sqrt()</button><button type=\"button\" data-insert=\"pow()\">pow()</button><button type=\"button\" data-insert=\"round()\">round()</button>\n          </div>\n          <p class=\"math-channel-help\">Click a source channel to insert <strong>[Channel Name]</strong>. Historical references use <code>[RPM-1]</code>. Temporal helpers accept a source reference plus samples/window: <code>delta([RPM], 1)</code> · <code>avg([TPS], 5)</code> · <code>rate([MAP], 1)</code>. Conditions return 1/0 and can use <code>AND</code>, <code>OR</code>, <code>NOT</code> and lazy <code>if(condition, true, false)</code>.</p>\n""",
)
# Preview dependency maps become physical binding-aware.
replace_once(
    'apps/web/src/pages/histogram-math-channels-view.ts',
    """      const references = new Map<string, ChannelDefinition>();\n      for (const reference of program.references) references.set(reference, resolveReference(reference));\n""",
    """      const references = new Map<string, { readonly channel: ChannelDefinition; readonly sampleOffset: number }>();\n      for (const reference of program.references) references.set(reference, resolveReference(reference));\n""",
)
replace_once(
    'apps/web/src/pages/histogram-math-channels-view.ts',
    "const traces = await context.loadTraces([...new Set([...references.values()].map((channel) => channel.id))], startMs, endMs);",
    "const traces = await context.loadTraces([...new Set([...references.values()].map((resolved) => resolved.channel.id))], startMs, endMs);",
)
replace_once(
    'apps/web/src/pages/histogram-math-channels-view.ts',
    """      const ranges = new Map<string, NumericChannelRange>();\n      for (const [reference, channel] of references) {\n        const trace = byId.get(channel.id);\n        if (!trace) throw new RangeError(`Preview data unavailable for [${reference}]`);\n        ranges.set(reference, trace.range);\n      }\n""",
    """      const ranges = new Map<string, CalculatedFieldRangeBinding>();\n      for (const [reference, resolved] of references) {\n        const trace = byId.get(resolved.channel.id);\n        if (!trace) throw new RangeError(`Preview data unavailable for [${reference}]`);\n        ranges.set(reference, { range: trace.range, sampleOffset: resolved.sampleOffset });\n      }\n""",
)
# The type import NumericChannelRange becomes unused after preview binding update.
replace_once(
    'apps/web/src/pages/histogram-math-channels-view.ts',
    "import type { ChannelDefinition, NumericChannelRange } from '../../../../core/log-model/log-types';",
    "import type { ChannelDefinition } from '../../../../core/log-model/log-types';",
)

# Extend calculated-field tests with conditions, short-circuit conditional, historical refs and time-series helpers.
replace_once(
    'tests/analysis/calculated-field.test.ts',
    """  it('rejects malformed references', () => {\n    expect(() => compileCalculatedField('[AFR')).toThrow(/closing/);\n    expect(() => compileCalculatedField('[] + 1')).toThrow(/must not be empty/);\n  });\n});\n""",
    """  it('supports comparisons, word/symbol logic and lazy conditional branches', () => {\n    const logical = compileCalculatedField('[TPS] > 50 AND [RPM] >= 3000 OR NOT [Enabled]');\n    expect(logical.evaluate((reference) => ({ TPS: 60, RPM: 3200, Enabled: 1 }[reference] ?? 0))).toBe(1);\n    expect(logical.evaluate((reference) => ({ TPS: 10, RPM: 3200, Enabled: 1 }[reference] ?? 0))).toBe(0);\n    const conditional = compileCalculatedField('if([A] > 0, sqrt([A]), 0)');\n    expect(conditional.evaluate(() => -4)).toBe(0);\n  });\n\n  it('supports historical bindings and temporal lag/delta/average/rate helpers', () => {\n    const source = range(0, [10, 20, 40, 70]);\n    const historical = evaluateCalculatedFieldRange(compileCalculatedField('[A] - [A-1]'), new Map([\n      ['A', source],\n      ['A-1', { range: source, sampleOffset: 1 }],\n    ]));\n    expect([...historical.validity]).toEqual([0, 1, 1, 1]);\n    expect([...historical.values].slice(1)).toEqual([10, 20, 30]);\n\n    const temporal = evaluateCalculatedFieldRange(compileCalculatedField('lag([A], 1) + delta([A], 1) + avg([A], 2) + rate([A], 1)'), new Map([['A', source]]));\n    expect([...temporal.validity]).toEqual([0, 1, 1, 1]);\n    expect(temporal.values[1]).toBeCloseTo(10 + 10 + 15 + 1000);\n    expect(temporal.values[2]).toBeCloseTo(20 + 20 + 30 + 2000);\n  });\n\n  it('rejects malformed references', () => {\n    expect(() => compileCalculatedField('[AFR')).toThrow(/closing/);\n    expect(() => compileCalculatedField('[] + 1')).toThrow(/must not be empty/);\n  });\n});\n""",
)

# Logical context proves [Channel-N] resolves to one physical dependency and applies lookback.
replace_once(
    'tests/web/histogram-logical-context.test.ts',
    """  it('returns physical and calculated traces together without reloading duplicate dependencies', async () => {\n""",
    """  it('resolves MLV-style historical references against the physical channel without duplicate loads', async () => {\n    const rpm = channel('rpm', 'RPM', 'rpm');\n    const requests: string[][] = [];\n    const change: HistogramCalculatedFieldDefinition = { id: 'rpm-change', name: 'RPM Change', expression: '[RPM] - [RPM-1]', unit: 'rpm/sample' };\n    const logical = createHistogramLogicalContext(context([rpm], [trace(rpm, [1000, 1100, 1300])], requests), [change]);\n    const loaded = await logical.loadTraces(['formula:rpm-change']);\n    expect(requests).toEqual([['rpm']]);\n    expect([...loaded[0]!.range.validity]).toEqual([0, 1, 1]);\n    expect([...loaded[0]!.range.values].slice(1)).toEqual([100, 200]);\n  });\n\n  it('returns physical and calculated traces together without reloading duplicate dependencies', async () => {\n""",
)

# Documentation closes the Math Channels research gap and records precise semantics/limits.
replace_once(
    'docs/HISTOGRAM.md',
    """- formula helpers and validation;\n- numeric preview;\n- stable `ƒ` identity/units in Histogram channel selectors;\n""",
    """- arithmetic plus comparison/logical expressions (`>`, `<`, `>=`, `<=`, `==`, `!=`, `AND`, `OR`, `NOT`);\n- lazy `if(condition, true, false)` conditionals;\n- MLV-style historical sample references such as `[RPM-1]`;\n- sample-aware `lag()`, `delta()`, moving `avg()` and timestamp-based `rate()` helpers;\n- formula helpers and validation;\n- numeric preview;\n- stable `ƒ` identity/units in Histogram channel selectors;\n""",
)
replace_once(
    'docs/HISTOGRAM.md',
    """Math formulas currently resolve physical channel dependencies. Nested saved Math Channel references are not silently introduced.\n""",
    """Historical suffixes are resolved exact-name first: a real physical channel literally named `RPM-1` wins; otherwise `[RPM-1]` means one source sample before `[RPM]`. Temporal history is evaluated within the loaded source range, so the first lookback/window samples are intentionally invalid rather than fabricated. `rate([Channel], N)` uses recorded timestamps and returns change per second. Temporal sample/window counts are bounded to 4096.\n\nMath formulas continue to resolve physical channel dependencies. Nested saved Math Channel references are not silently introduced; composition remains explicit and cycle-free.\n\nAt this checkpoint the research-driven generic Histogram maturity gaps are closed across Table Generator, Distribution, Scatter and Math Channels.\n""",
)
