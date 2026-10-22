import { describe, expect, it } from 'vitest';
import { getAmountLimits, getFreeUnits, simulateStore } from './cargo-transfer';

const lcb = { weightLoad: 1500, weightCapacity: 2000, volumeLoad: 1900, volumeCapacity: 2000 };
const war = { weightLoad: 0, weightCapacity: 5000, volumeLoad: 4990, volumeCapacity: 5000 };
const dw = { weight: 0.1, volume: 0.1 };

describe('getFreeUnits', () => {
  it('takes the tighter of weight and volume', () => {
    expect(getFreeUnits(lcb, dw)).toBe(1000);
  });

  it('never goes below zero', () => {
    expect(getFreeUnits({ ...lcb, volumeLoad: 2100 }, dw)).toBe(0);
  });
});

describe('getAmountLimits', () => {
  it('limits loading by partner stock and ship space', () => {
    expect(getAmountLimits(lcb, war, dw, 5000, 300).max).toBe(5300);
    expect(getAmountLimits(lcb, war, dw, 5000, 9000).max).toBe(6000);
  });

  it('limits unloading by ship stock and partner space', () => {
    expect(getAmountLimits(lcb, war, dw, 5000, 0).min).toBe(4900);
    expect(getAmountLimits(lcb, { ...war, volumeLoad: 0 }, dw, 5000, 0).min).toBe(0);
  });
});

describe('simulateStore', () => {
  const material = { ticker: 'DW' } as PrunApi.Material;
  const store = {
    ...lcb,
    items: [
      {
        id: 'a',
        type: 'INVENTORY',
        weight: 500,
        volume: 500,
        quantity: { material, amount: 5000 },
      },
    ],
  } as PrunApi.Store;

  it('updates the item and the loads', () => {
    const result = simulateStore(store, 'DW', dw, 3000);
    expect(result.items[0].quantity?.amount).toBe(3000);
    expect(result.weightLoad).toBeCloseTo(1300);
    expect(result.volumeLoad).toBeCloseTo(1700);
  });

  it('removes the item at zero', () => {
    expect(simulateStore(store, 'DW', dw, 0).items).toHaveLength(0);
  });
});
