/** Legacy factories retain their full status UI; v50 supplies its own compact projection. */
export interface VeReadinessPresentation {
  readonly compactReadiness?: boolean;
}

export interface VeProposalSettingInputs {
  readonly priorWeight: string;
  readonly minimumEvidenceWeight: string;
  readonly maximumAbsoluteChange: string;
  readonly maximumPercentChange: string;
}

export function veNumericSettingIssue(label: string, raw: string): string | undefined {
  const text = raw.trim();
  if (!text) return `${label} is blank`;
  const value = Number(text);
  if (!Number.isFinite(value)) return `${label} must be a number`;
  if (value < 0) return `${label} must be 0 or greater`;
  return undefined;
}

export function veProposalSettingIssues(inputs: VeProposalSettingInputs): string[] {
  return [
    veNumericSettingIssue('Prior weight', inputs.priorWeight),
    veNumericSettingIssue('Minimum evidence weight', inputs.minimumEvidenceWeight),
    veNumericSettingIssue('Max VE change', inputs.maximumAbsoluteChange),
    veNumericSettingIssue('Max VE change %', inputs.maximumPercentChange),
  ].filter((issue): issue is string => Boolean(issue));
}

export interface VeReadinessRow {
  readonly id: string;
  readonly name: string;
  readonly purpose: string;
  readonly required: boolean;
  readonly source: string;
  readonly status: string;
  readonly valid: boolean;
  readonly targetSelector?: string;
  readonly blockerMessage?: string;
}

export interface VeReadinessBlocker {
  readonly code: string;
  readonly message: string;
  readonly targetSelector?: string;
}

export interface VeReadinessState {
  readonly rows: readonly VeReadinessRow[];
  readonly blockers: readonly VeReadinessBlocker[];
  readonly ready: boolean;
  readonly canRun: boolean;
  readonly active: boolean;
  readonly pending: boolean;
  readonly delayState: 'missing' | 'recommendation' | 'working';
  readonly text: string;
  readonly title: string;
}

export function createVeReadiness(
  rows: readonly VeReadinessRow[],
  state: { readonly active: boolean; readonly pending: boolean; readonly proposed: boolean; readonly delayState: VeReadinessState['delayState'] },
): VeReadinessState {
  const blockers = rows.filter(row => row.required && !row.valid).map(row => ({
    code: row.id,
    message: row.blockerMessage ?? `${row.name}${row.status === 'Missing' ? '' : ` — ${row.status}`}`,
    ...(row.targetSelector ? { targetSelector: row.targetSelector } : {}),
  }));
  const ready = rows.length > 0 && blockers.length === 0;
  return { rows, blockers, ready, canRun: ready && state.active && !state.pending,
    active: state.active, pending: state.pending, delayState: state.delayState,
    text: !state.active ? 'VE inactive' : rows.length === 0 ? 'Not ready' : state.pending ? 'Calculating VE evidence…' : !ready
      ? `Run blocked · ${blockers.length} ${blockers.length === 1 ? 'issue' : 'issues'}`
      : state.proposed ? 'VE proposal calculated' : 'Ready · press Run Analysis',
    title: blockers.map(blocker => blocker.message).join('; '),
  };
}

type ReadinessTargetRevealer = (target: HTMLElement) => HTMLElement | undefined;
const targetRevealers = new WeakMap<HTMLElement, ReadinessTargetRevealer[]>();

/** Presentation owners reveal only their own surfaces; no readiness state is copied. */
export function registerVeReadinessTargetRevealer(root: HTMLElement, reveal: ReadinessTargetRevealer): () => void {
  const owners = targetRevealers.get(root) ?? [];
  owners.push(reveal);
  targetRevealers.set(root, owners);
  return () => {
    const index = owners.indexOf(reveal);
    if (index >= 0) owners.splice(index, 1);
    if (!owners.length) targetRevealers.delete(root);
  };
}

export function focusVeReadinessTarget(root: HTMLElement, selector: string): void {
  const target = root.querySelector<HTMLElement>(selector);
  if (!target) return;
  let destination = target;
  for (const reveal of targetRevealers.get(root) ?? []) {
    const resolved = reveal(target);
    if (resolved && root.contains(resolved)) { destination = resolved; break; }
  }
  for (let ancestor: HTMLElement | null = destination; ancestor && root.contains(ancestor); ancestor = ancestor.parentElement) {
    if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
  }
  requestAnimationFrame(() => {
    if (!destination.isConnected || !root.contains(destination) || destination.closest('[hidden]')) return;
    destination.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    destination.focus({ preventScroll: true });
  });
}
