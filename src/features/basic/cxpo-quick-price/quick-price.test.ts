import { describe, expect, it } from 'vitest';
import { getQuickPrices } from './quick-price';

const me = 'me';

describe('getQuickPrices', () => {
  it('goes one tick under the best ask and over the best bid', () => {
    const prices = getQuickPrices(
      [
        { id: 'x', ownerId: 'a', price: 120 },
        { id: 'x', ownerId: 'b', price: 118.5 },
      ],
      [
        { id: 'x', ownerId: 'c', price: 100 },
        { id: 'x', ownerId: 'd', price: 101.25 },
      ],
      { companyId: me },
    );
    expect(prices).toMatchObject({ sellPrice: 118.49, buyPrice: 101.26 });
    expect(prices.sellCrosses).toBe(false);
    expect(prices.buyCrosses).toBe(false);
  });

  it('ignores my own orders', () => {
    const prices = getQuickPrices(
      [
        { id: 'x', ownerId: me, price: 110 },
        { id: 'x', ownerId: 'a', price: 115 },
      ],
      [{ id: 'x', ownerId: me, price: 105 }],
      { companyId: me },
    );
    expect(prices.sellPrice).toBe(114.99);
    expect(prices.buyPrice).toBeUndefined();
  });

  it('flags a price that would trade at once', () => {
    const prices = getQuickPrices(
      [{ id: 'x', ownerId: 'a', price: 100.01 }],
      [{ id: 'x', ownerId: 'b', price: 100 }],
    );
    expect(prices.sellPrice).toBe(100);
    expect(prices.sellCrosses).toBe(true);
    expect(prices.buyCrosses).toBe(true);
  });
});

describe('getQuickPrices own order ids', () => {
  it('ignores orders whose id is mine', () => {
    const prices = getQuickPrices(
      [
        { id: 'mine', ownerId: 'a', price: 100 },
        { id: 'other', ownerId: 'b', price: 105 },
      ],
      [],
      { orderIds: new Set(['mine']) },
    );
    expect(prices.sellPrice).toBe(104.99);
  });
});
