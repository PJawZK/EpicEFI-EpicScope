import type {
  TableBrushOptions,
  TableInterpolationAxis,
  TableInterpolationOptions,
} from './ve-table-interaction';

export interface TableToolConfigurationOwner {
  readonly label: string;
  adjustmentStep(): number;
  setAdjustmentStep(value: number): void;
  smoothStrength(): number;
  setSmoothStrength(value: number): void;
  interpolation(): TableInterpolationOptions;
  setInterpolation(value: TableInterpolationOptions): void;
  brush(): TableBrushOptions;
  setBrush(value: TableBrushOptions): void;
  reset(kind: 'step' | 'smooth' | 'interpolation' | 'brush'): void;
}

export interface TableToolConfigurationButtons {
  readonly decrement: HTMLButtonElement;
  readonly increment: HTMLButtonElement;
  readonly smooth: HTMLButtonElement;
  readonly interpolateHorizontal: HTMLButtonElement;
  readonly interpolateVertical: HTMLButtonElement;
  readonly interpolateBoth: HTMLButtonElement;
  readonly brush: HTMLButtonElement;
}

function finiteNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function numberField(caption: string, value: number, options: {
  readonly min?: number;
  readonly max?: number;
  readonly step?: string;
} = {}): { readonly label: HTMLLabelElement; readonly input: HTMLInputElement } {
  const label = document.createElement('label');
  const span = document.createElement('span');
  span.textContent = caption;
  const input = document.createElement('input');
  input.type = 'number';
  input.value = String(value);
  input.inputMode = 'decimal';
  if (options.min !== undefined) input.min = String(options.min);
  if (options.max !== undefined) input.max = String(options.max);
  input.step = options.step ?? 'any';
  label.append(span, input);
  return { label, input };
}

function selectField(caption: string, values: readonly (readonly [string, string])[], current: string): {
  readonly label: HTMLLabelElement;
  readonly select: HTMLSelectElement;
} {
  const label = document.createElement('label');
  const span = document.createElement('span');
  span.textContent = caption;
  const select = document.createElement('select');
  for (const [value, text] of values) select.add(new Option(text, value));
  select.value = current;
  label.append(span, select);
  return { label, select };
}

/**
 * Lightweight contextual configuration for the shared table-editing vocabulary.
 * It owns only transient popover DOM. Persisted values remain with the caller's
 * preference owner and semantic table values remain with TableEditSurface.
 */
export function installTableToolConfiguration(
  host: HTMLElement,
  buttons: TableToolConfigurationButtons,
  owner: TableToolConfigurationOwner,
  onChanged: () => void,
): () => void {
  let popover: HTMLElement | undefined;

  const close = (): void => {
    popover?.remove();
    popover = undefined;
    document.removeEventListener('pointerdown', outsidePointer, true);
    document.removeEventListener('keydown', escapeKey, true);
  };

  const outsidePointer = (event: PointerEvent): void => {
    if (popover?.contains(event.target as Node)) return;
    close();
  };
  const escapeKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') close();
  };

  const open = (event: MouseEvent, title: string, description: string): HTMLElement => {
    event.preventDefault();
    event.stopPropagation();
    close();
    const element = document.createElement('div');
    element.className = 've-table-tool-options';
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-label', title);
    const header = document.createElement('div');
    header.className = 've-table-tool-options-head';
    const strong = document.createElement('strong');
    strong.textContent = title;
    const hint = document.createElement('span');
    hint.textContent = description;
    header.append(strong, hint);
    element.append(header);
    element.style.position = 'fixed';
    element.style.visibility = 'hidden';
    document.body.append(element);
    const anchor = event.currentTarget instanceof HTMLElement ? event.currentTarget : host;
    // Configuration fields are populated by the caller after open() returns.
    // Measure only after that content exists; position in viewport coordinates
    // so neither the table header nor a tool-window scroll area can clip it.
    queueMicrotask(() => {
      if (!element.isConnected) return;
      const rect = anchor.getBoundingClientRect();
      const popupWidth = element.offsetWidth;
      const popupHeight = element.offsetHeight;
      const pad = 8;
      const gap = 5;
      const below = window.innerHeight - rect.bottom;
      const above = rect.top;
      const down = below >= popupHeight + gap || below >= above;
      const left = Math.max(pad, Math.min(rect.left, window.innerWidth - popupWidth - pad));
      const top = down
        ? Math.max(pad, Math.min(rect.bottom + gap, window.innerHeight - popupHeight - pad))
        : Math.max(pad, Math.min(rect.top - popupHeight - gap, window.innerHeight - popupHeight - pad));
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
      element.dataset.direction = down ? 'down' : 'up';
      element.style.visibility = '';
      document.addEventListener('pointerdown', outsidePointer, true);
      document.addEventListener('keydown', escapeKey, true);
    });
    popover = element;
    return element;
  };

  const foot = (element: HTMLElement, resetKind: Parameters<TableToolConfigurationOwner['reset']>[0]): void => {
    const footer = document.createElement('div');
    footer.className = 've-table-tool-options-foot';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Reset default';
    reset.addEventListener('click', () => {
      owner.reset(resetKind);
      close();
      onChanged();
    });
    footer.append(reset);
    element.append(footer);
  };

  const configureStep = (event: MouseEvent): void => {
    const element = open(event, 'Increment step', `Used by both + and − for the ${owner.label} table.`);
    const field = numberField('Step', owner.adjustmentStep(), { min: 0.000001 });
    element.append(field.label);
    field.input.addEventListener('change', () => {
      const value = finiteNumber(field.input.value, owner.adjustmentStep());
      if (value > 0) owner.setAdjustmentStep(value);
      onChanged();
    });
    foot(element, 'step');
    field.input.focus({ preventScroll: true });
    field.input.select();
  };

  const configureSmooth = (event: MouseEvent): void => {
    const element = open(event, 'Smoothing intensity', 'Controls how strongly Smooth moves selected values toward the local 3×3 result. 1.0 = 100%.');
    const field = numberField('Intensity · 0–1', owner.smoothStrength(), { min: 0, max: 1, step: '0.1' });
    element.append(field.label);
    field.input.addEventListener('change', () => {
      owner.setSmoothStrength(clamp01(finiteNumber(field.input.value, owner.smoothStrength())));
      onChanged();
    });
    foot(element, 'smooth');
    field.input.focus({ preventScroll: true });
    field.input.select();
  };

  const configureInterpolation = (event: MouseEvent, axis: TableInterpolationAxis): void => {
    const current = owner.interpolation();
    const both = axis === 'both';
    const element = open(
      event,
      `${both ? 'Both-directions interpolation' : 'Interpolation'} · ${owner.label}`,
      'Normal click applies the current method. Pins remain untouched; H/V pins also act as interior anchors.',
    );
    const method = selectField('Method', both
      ? [['bilinear', 'Bilinear · four corners'], ['boundary', 'Boundary surface · all four edges']]
      : [['linear', 'Linear'], ['shape', 'Shape-preserving · neighbor-informed']],
    both ? (current.method2d ?? 'bilinear') : (current.method1d ?? 'linear'));
    const strength = numberField('Strength · 0–1', current.strength ?? 1, { min: 0, max: 1, step: '0.1' });
    const clampLabel = document.createElement('label');
    clampLabel.className = 've-table-tool-options-check';
    const clamp = document.createElement('input');
    clamp.type = 'checkbox';
    clamp.checked = current.clamp ?? true;
    const clampText = document.createElement('span');
    clampText.textContent = both ? 'Clamp to boundary range' : 'Clamp to anchor range';
    clampLabel.append(clamp, clampText);
    element.append(method.label, strength.label, clampLabel);
    const commit = (): void => {
      const next: TableInterpolationOptions = {
        ...current,
        axis,
        strength: clamp01(finiteNumber(strength.input.value, current.strength ?? 1)),
        clamp: clamp.checked,
        ...(both ? { method2d: method.select.value === 'boundary' ? 'boundary' : 'bilinear' }
          : { method1d: method.select.value === 'shape' ? 'shape' : 'linear' }),
      };
      owner.setInterpolation(next);
      onChanged();
    };
    method.select.addEventListener('change', commit);
    strength.input.addEventListener('change', commit);
    clamp.addEventListener('change', commit);
    foot(element, 'interpolation');
  };

  const configureBrush = (event: MouseEvent): void => {
    const current = owner.brush();
    const element = open(event, `Brush · ${owner.label}`, 'Paint a weighted local adjustment. Pinned cells are protected. Shift reverses the adjustment.');
    const delta = numberField('Adjustment', current.delta, { min: -9999, max: 9999 });
    const radius = numberField('Radius · cells', current.radius, { min: 1, max: 8, step: '1' });
    const strength = numberField('Strength · 0–1', current.strength ?? 1, { min: 0, max: 1, step: '0.1' });
    const falloff = selectField('Falloff', [
      ['soft', 'Smooth'],
      ['linear', 'Linear'],
      ['flat', 'Hard'],
    ], current.falloff ?? 'soft');
    element.append(delta.label, radius.label, strength.label, falloff.label);
    const commit = (): void => {
      owner.setBrush({
        delta: finiteNumber(delta.input.value, current.delta),
        radius: Math.max(1, Math.min(8, Math.round(finiteNumber(radius.input.value, current.radius)))),
        strength: clamp01(finiteNumber(strength.input.value, current.strength ?? 1)),
        falloff: falloff.select.value === 'flat' ? 'flat' : falloff.select.value === 'linear' ? 'linear' : 'soft',
      });
      onChanged();
    };
    delta.input.addEventListener('change', commit);
    radius.input.addEventListener('change', commit);
    strength.input.addEventListener('change', commit);
    falloff.select.addEventListener('change', commit);
    foot(element, 'brush');
  };

  buttons.decrement.addEventListener('contextmenu', configureStep);
  buttons.increment.addEventListener('contextmenu', configureStep);
  buttons.smooth.addEventListener('contextmenu', configureSmooth);
  buttons.interpolateHorizontal.addEventListener('contextmenu', (event) => configureInterpolation(event, 'horizontal'));
  buttons.interpolateVertical.addEventListener('contextmenu', (event) => configureInterpolation(event, 'vertical'));
  buttons.interpolateBoth.addEventListener('contextmenu', (event) => configureInterpolation(event, 'both'));
  buttons.brush.addEventListener('contextmenu', configureBrush);

  return close;
}
