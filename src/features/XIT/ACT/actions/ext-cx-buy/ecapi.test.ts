import { describe, expect, it } from 'vitest';
import { EcapiResponse, orderPrice, planPurchases } from './ecapi';

const hrt = (available: number) => [
  { location_name: 'Hortus Station', location_code: 'HRT', available },
];

const data: EcapiResponse = {
  success: true,
  vendors: [
    {
      vendor: { gamename: 'Alice', companycode: 'ALC', isactive: true },
      orders: [
        {
          materialticker: 'RAT',
          ordertype: 'sell',
          price: { fixedprice: -1, corpprice: 150 },
          location: hrt(1000),
        },
        {
          materialticker: 'DW',
          ordertype: 'sell',
          price: { fixedprice: 90, corpprice: 80 },
          location: hrt(500),
        },
      ],
    },
    {
      vendor: { gamename: 'Bob', companycode: 'BOB', isactive: true },
      orders: [
        {
          materialticker: 'RAT',
          ordertype: 'sell',
          price: { fixedprice: 140, corpprice: 150 },
          location: hrt(300),
        },
        { materialticker: 'DW', ordertype: 'buy', price: { fixedprice: 10 }, location: hrt(9999) },
        {
          materialticker: 'COF',
          ordertype: 'sell',
          price: { fixedprice: -1, corpprice: 500 },
          location: [{ location_name: 'Mayer', location_code: 'OZ-189a', available: 100 }],
        },
      ],
    },
    {
      vendor: { gamename: 'Sleepy', companycode: 'ZZZ', isactive: false },
      orders: [
        {
          materialticker: 'RAT',
          ordertype: 'sell',
          price: { fixedprice: 1, corpprice: 1 },
          location: hrt(99999),
        },
      ],
    },
  ],
};

describe('orderPrice', () => {
  it('uses the fixed price, else the corporation price', () => {
    expect(orderPrice(data.vendors[0].orders[0])).toBe(150);
    expect(orderPrice(data.vendors[0].orders[1])).toBe(90);
  });
});

describe('planPurchases', () => {
  it('splits between vendors, cheapest first, when nobody has enough alone', () => {
    const plan = planPurchases(data, { RAT: 1300 }, { location: 'Hortus Station' });
    expect(plan.purchases).toEqual([
      {
        vendor: 'Bob',
        company: 'BOB',
        materials: { RAT: { quantity: 300, price: 140 } },
        total: 42000,
      },
      {
        vendor: 'Alice',
        company: 'ALC',
        materials: { RAT: { quantity: 1000, price: 150 } },
        total: 150000,
      },
    ]);
    expect(plan.missing).toEqual({});
  });

  it('prefers one vendor with enough stock over a cheaper partial offer', () => {
    // Bob is cheaper but has only 300 RAT; Alice has the 800.
    const plan = planPurchases(data, { RAT: 800 }, { location: 'HRT' });
    expect(plan.purchases.map(x => x.vendor)).toEqual(['Alice']);
  });

  it('groups the materials of one vendor in one contract', () => {
    const plan = planPurchases(data, { RAT: 200, DW: 100 }, { location: 'HRT' });
    const bob = plan.purchases.find(x => x.vendor === 'Bob');
    const alice = plan.purchases.find(x => x.vendor === 'Alice');
    expect(bob?.materials).toEqual({ RAT: { quantity: 200, price: 140 } });
    expect(alice?.materials).toEqual({ DW: { quantity: 100, price: 90 } });
  });

  it('reports what nobody sells at that location, ignores buy orders and inactive vendors', () => {
    const plan = planPurchases(data, { COF: 10, RAT: 2000 }, { location: 'HRT' });
    expect(plan.missing).toEqual({ COF: 10, RAT: 700 });
    expect(plan.purchases.some(x => x.vendor === 'Sleepy')).toBe(false);
  });

  it('leaves out excluded players and companies', () => {
    const plan = planPurchases(data, { RAT: 100 }, { location: 'HRT', exclude: ['bob'] });
    expect(plan.purchases.map(x => x.vendor)).toEqual(['Alice']);
    const byCode = planPurchases(data, { RAT: 100 }, { location: 'HRT', exclude: ['ALC', 'BOB'] });
    expect(byCode.missing).toEqual({ RAT: 100 });
  });
});
