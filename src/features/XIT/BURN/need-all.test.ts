import { describe, expect, it } from 'vitest';
import { MaterialBurn } from '@src/core/burn';
import { computeNeedAll, getBuyAmount } from './need';

function mat(partial: Partial<MaterialBurn>): MaterialBurn {
  return {
    input: 0,
    output: 0,
    workforce: 0,
    dailyAmount: -100,
    remainingAllocation: 0,
    inventory: 0,
    inboundInventory: 0,
    daysLeft: 0,
    type: 'input',
    ...partial,
  };
}

describe('computeNeedAll', () => {
  it('counts the planet warehouse stock', () => {
    // Base 300 + WAR 500 = 8 days; target 10 days -> 200 to deliver.
    expect(computeNeedAll(mat({ inventory: 300, warehouseInventory: 500 }), 10)).toBe(200);
  });

  it('is 0 when base + warehouse already cover the target', () => {
    expect(computeNeedAll(mat({ inventory: 300, warehouseInventory: 900 }), 10)).toBe(0);
  });

  it('counts inbound cargo', () => {
    expect(computeNeedAll(mat({ inventory: 300, inboundInventory: 200 }), 10)).toBe(500);
  });

  it('is 0 for produced materials', () => {
    expect(computeNeedAll(mat({ dailyAmount: 50 }), 10)).toBe(0);
  });
});

describe('getBuyAmount', () => {
  it('is the part of the need HRT cannot cover', () => {
    expect(getBuyAmount(mat({ inventory: 300, hrtInventory: 450 }), 10)).toBe(250);
  });

  it('is 0 when HRT covers the need', () => {
    expect(getBuyAmount(mat({ inventory: 300, hrtInventory: 5000 }), 10)).toBe(0);
  });
});
