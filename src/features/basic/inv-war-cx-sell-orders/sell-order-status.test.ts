import { describe, expect, it } from 'vitest';
import { getOnSaleItems } from './sell-order-status';

const orders = [
  { id: 'a', ticker: 'DW', amount: 1000, price: 120 },
  { id: 'b', ticker: 'DW', amount: 500, price: 118 },
  { id: 'c', ticker: 'RAT', amount: 300, price: 200 },
];

describe('getOnSaleItems', () => {
  it('groups orders by ticker with the lowest price', () => {
    const [dw] = getOnSaleItems(
      orders,
      () => undefined,
      () => undefined,
    );
    expect(dw).toMatchObject({ ticker: 'DW', amount: 1500, price: 118, undercut: false });
  });

  it('ignores my own orders in the live book', () => {
    const book = [
      { id: 'b', price: 118 },
      { id: 'x', price: 119 },
    ];
    const [dw] = getOnSaleItems(
      orders,
      t => (t === 'DW' ? book : undefined),
      () => undefined,
    );
    expect(dw).toMatchObject({ bestOther: 119, live: true, undercut: false });
  });

  it('marks undercut when another seller asks less', () => {
    const items = getOnSaleItems(
      orders,
      () => undefined,
      t => (t === 'RAT' ? 190 : 118),
    );
    expect(items.find(x => x.ticker === 'RAT')?.undercut).toBe(true);
    expect(items.find(x => x.ticker === 'DW')?.undercut).toBe(false);
  });
});
