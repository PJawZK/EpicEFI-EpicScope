import { describe, expect, it } from 'vitest';

import { planMlgColumnStripes } from '../../apps/web/src/adapters/mlg-column-sidecar';
import type { MlgFieldDescriptor } from '../../core/parsers/mlg/mlg-format';

function scalar(
  index: number,
  widthBytes: 1 | 2 | 4 | 8,
  type: 0 | 2 | 4 | 6,
): MlgFieldDescriptor {
  return {
    index,
    offset: index * 10,
    type,
    name: `f${index}`,
    units: '',
    displayStyle: 0,
    widthBytes,
    category: '',
    kind: 'scalar',
    scale: 1,
    transform: 0,
    digits: 0,
  };
}

describe('MLG column sidecar stripe planner', () => {
  it('packs whole fields into bounded stripes without splitting a field', () => {
    const fields: MlgFieldDescriptor[] = [
      scalar(0, 4, 4),
      scalar(1, 4, 4),
      scalar(2, 8, 6),
      scalar(3, 2, 2),
      scalar(4, 2, 2),
    ];

    const plan = planMlgColumnStripes(fields, 10);

    expect(plan.fieldPayloadBytes).toBe(20);
    expect(plan.stripes).toEqual([
      {
        index: 0,
        fileName: 'stripe-0000.bin',
        startByte: 0,
        widthBytes: 8,
        firstFieldIndex: 0,
        lastFieldIndexExclusive: 2,
      },
      {
        index: 1,
        fileName: 'stripe-0001.bin',
        startByte: 8,
        widthBytes: 10,
        firstFieldIndex: 2,
        lastFieldIndexExclusive: 4,
      },
      {
        index: 2,
        fileName: 'stripe-0002.bin',
        startByte: 18,
        widthBytes: 2,
        firstFieldIndex: 4,
        lastFieldIndexExclusive: 5,
      },
    ]);
    expect(plan.fields.map((field) => ({
      fieldIndex: field.fieldIndex,
      recordOffset: field.recordOffset,
      stripeIndex: field.stripeIndex,
      stripeOffset: field.stripeOffset,
    }))).toEqual([
      { fieldIndex: 0, recordOffset: 0, stripeIndex: 0, stripeOffset: 0 },
      { fieldIndex: 1, recordOffset: 4, stripeIndex: 0, stripeOffset: 4 },
      { fieldIndex: 2, recordOffset: 8, stripeIndex: 1, stripeOffset: 0 },
      { fieldIndex: 3, recordOffset: 16, stripeIndex: 1, stripeOffset: 8 },
      { fieldIndex: 4, recordOffset: 18, stripeIndex: 2, stripeOffset: 0 },
    ]);
  });
});
