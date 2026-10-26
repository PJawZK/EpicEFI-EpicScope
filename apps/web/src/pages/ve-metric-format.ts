/** Presentation only: never round retained working, proposal or evidence values. */
export function formatVeMetric(value: number | undefined, digits = 2): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const precision = Number.isFinite(digits) ? Math.max(0, Math.min(20, Math.trunc(digits))) : 2;
  const text = value.toFixed(precision);
  if (Number(text) === 0) return '0';
  return text.replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}
export function formatSignedVeMetric(value: number | undefined, digits = 2, suffix = ''): string {
  const text = formatVeMetric(value, digits);
  return text === '—' ? text : `${text !== '0' && value! > 0 ? '+' : ''}${text}${suffix}`;
}
