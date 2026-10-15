/** Cooperative execution stays at the VE calculation boundary; source caches remain owned by the logger. */
export interface VeAnalysisProgress {
  readonly phase: string;
  readonly completed: number;
  readonly total: number;
}

export interface VeAnalysisWorkOptions {
  readonly isCancelled?: () => boolean;
  readonly onProgress?: (progress: VeAnalysisProgress) => void;
  /** Task boundary, injectable for deterministic cancellation tests. */
  readonly yieldControl?: () => Promise<void>;
}

export type VeAnalysisSteps<T> = Generator<VeAnalysisProgress, T, void>;
export const VE_ANALYSIS_BATCH_SIZE = 2048;

export class VeAnalysisCancelled extends Error {
  constructor() { super('VE analysis cancelled.'); this.name = 'AbortError'; }
}

export function finishVeAnalysis<T>(steps: VeAnalysisSteps<T>): T {
  let next = steps.next();
  while (!next.done) next = steps.next();
  return next.value;
}

export async function runVeAnalysis<T>(steps: VeAnalysisSteps<T>, options: VeAnalysisWorkOptions = {}): Promise<T> {
  const yieldControl = options.yieldControl ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  const check = (): void => { if (options.isCancelled?.()) throw new VeAnalysisCancelled(); };
  let completed = false;
  try {
    check();
    // Let pending navigation and the initial progress paint run before touching cached arrays.
    await yieldControl();
    check();
    let deadline = performance.now() + 8;
    for (;;) {
      check();
      const next = steps.next();
      if (next.done) { check(); completed = true; return next.value; }
      if (performance.now() >= deadline) {
        check(); options.onProgress?.(next.value);
        await yieldControl();
        check(); deadline = performance.now() + 8;
      }
    }
  } finally {
    // Release partial arrays/captured inputs promptly after cancellation or failure.
    if (!completed) steps.return(undefined as T);
  }
}

/** Stable merge of bounded native-sorted runs; never native-sort a full log-sized array. */
export function* sortVeAnalysisValues<T>(values: T[], compare: (a: T, b: T) => number, phase: string): VeAnalysisSteps<T[]> {
  const size = VE_ANALYSIS_BATCH_SIZE;
  const passes = 1 + Math.max(0, Math.ceil(Math.log2(values.length / size)));
  const total = values.length * passes;
  let pass = 1;
  for (let start = 0; start < values.length; start += size) {
    const run = values.slice(start, start + size).sort(compare);
    for (let i = 0; i < run.length; i += 1) values[start + i] = run[i]!;
    yield { phase, completed: Math.min(values.length, start + size), total };
  }
  let source = values;
  let target = new Array<T>(values.length);
  for (let width = size; width < values.length; width *= 2) {
    for (let start = 0; start < values.length; start += width * 2) {
      const middle = Math.min(values.length, start + width);
      const end = Math.min(values.length, start + width * 2);
      let left = start, right = middle;
      for (let index = start; index < end; index += 1) {
        target[index] = left < middle && (right >= end || compare(source[left]!, source[right]!) <= 0)
          ? source[left++]! : source[right++]!;
        if ((index + 1) % size === 0) yield { phase, completed: pass * values.length + index + 1, total };
      }
    }
    pass += 1;
    yield { phase, completed: pass * values.length, total };
    [source, target] = [target, source];
  }
  return source;
}
