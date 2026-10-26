/** Analytical binary lookup requires increasing physical axes. Editing has a
 * separate contract and can deliberately support descending coordinates. */
export function veAnalysisAxisIssue(values: readonly number[] | undefined): string | undefined {
  if (!values?.length) return 'Select a non-empty axis.';
  for (let index = 0; index < values.length; index++) {
    if (!Number.isFinite(values[index])) return 'Axis values must be finite.';
    if (index > 0 && !(values[index]! > values[index - 1]!)) return 'Axis values must be strictly increasing; select or correct the axis without reordering table cells.';
  }
  return undefined;
}
