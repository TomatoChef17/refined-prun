import { describe, expect, it } from 'vitest';
import { BaseLookup, balanceBay, needFill, sortByBaseStock, sortByTicker } from './base-supply';
import { SHIP_BAYS, SizeLookup } from './ship-fill';

const sizes: Record<string, { weight: number; volume: number }> = {
  H2O: { weight: 0.2, volume: 0.2 },
  RAT: { weight: 0.21, volume: 0.1 },
  PG: { weight: 0.001, volume: 0.001 },
};
const size: SizeLookup = ticker => sizes[ticker];
const bay = (label: string) => SHIP_BAYS.find(x => x.label === label)!;

const bases: Record<string, { inv: number; stock: number; usePerDay: number }> = {
  H2O: { inv: 1000, stock: 1000, usePerDay: 100 },
  RAT: { inv: 50, stock: 50, usePerDay: 10 },
  PG: { inv: 4000, stock: 4000, usePerDay: 0 },
};
const base: BaseLookup = ticker => bases[ticker];

describe('sortByBaseStock', () => {
  it('puts the largest base stock first and unknown materials last', () => {
    const list = [
      { ticker: 'RAT', amount: 1 },
      { ticker: 'XX', amount: 1 },
      { ticker: 'H2O', amount: 1 },
      { ticker: 'PG', amount: 1 },
    ];
    expect(sortByBaseStock(list, base).map(x => x.ticker)).toEqual(['PG', 'H2O', 'RAT', 'XX']);
  });
});

describe('needFill', () => {
  it('brings each used material to the resupply days', () => {
    // H2O: 16 d * 100 - 1000 = 600. RAT: 160 - 50 = 110. PG is not used.
    const stacks = [
      { ticker: 'H2O', quantity: 5000 },
      { ticker: 'RAT', quantity: 5000 },
      { ticker: 'PG', quantity: 5000 },
    ];
    expect(needFill(stacks, [], base, 16)).toEqual([
      { ticker: 'H2O', amount: 600 },
      { ticker: 'RAT', amount: 110 },
    ]);
  });

  it('counts listed units and caps at the dragged quantity', () => {
    expect(
      needFill([{ ticker: 'H2O', quantity: 5000 }], [{ ticker: 'H2O', amount: 500 }], base, 16),
    ).toEqual([{ ticker: 'H2O', amount: 100 }]);
    expect(needFill([{ ticker: 'RAT', quantity: 30 }], [], base, 16)).toEqual([
      { ticker: 'RAT', amount: 30 },
    ]);
  });
});

describe('balanceBay', () => {
  it('gives every material the same days and stays inside the bay', () => {
    const stacks = [
      { ticker: 'H2O', quantity: 100000 },
      { ticker: 'RAT', quantity: 100000 },
    ];
    const result = balanceBay(bay('WCB'), [], stacks, base, size);
    const h2o = result.find(x => x.ticker === 'H2O')!.amount;
    const rat = result.find(x => x.ticker === 'RAT')!.amount;
    const daysH2O = (1000 + h2o) / 100;
    const daysRAT = (50 + rat) / 10;
    expect(Math.abs(daysH2O - daysRAT)).toBeLessThan(0.2);
    // WCB volume (1000 m³) binds: 0.2 * h2o + 0.1 * rat <= 1000.
    expect(0.2 * h2o + 0.1 * rat).toBeLessThanOrEqual(1000);
    expect(0.2 * h2o + 0.1 * rat).toBeGreaterThan(990);
  });

  it('skips materials the base does not use and respects stack limits', () => {
    const stacks = [
      { ticker: 'PG', quantity: 1000 },
      { ticker: 'RAT', quantity: 20 },
    ];
    expect(balanceBay(bay('LCB'), [], stacks, base, size)).toEqual([{ ticker: 'RAT', amount: 20 }]);
  });
});

describe('sortByTicker', () => {
  it('sorts entries alphabetically by ticker', () => {
    const sorted = sortByTicker([
      { ticker: 'RAT', amount: 1 },
      { ticker: 'COF', amount: 2 },
      { ticker: 'H2O', amount: 3 },
    ]);
    expect(sorted.map(x => x.ticker)).toEqual(['COF', 'H2O', 'RAT']);
  });
});
