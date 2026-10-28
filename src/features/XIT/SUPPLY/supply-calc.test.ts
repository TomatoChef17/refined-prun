import { describe, expect, it } from 'vitest';
import type { MaterialBurn } from '@src/core/burn';
import {
  buildSupplyRows,
  formatList,
  getContractFlows,
  suggestShip,
  summarizeBases,
  SupplyBase,
  SupplyOptions,
} from './supply-calc';

function mat(partial: Partial<MaterialBurn>): MaterialBurn {
  return {
    input: 0,
    output: 0,
    workforce: 0,
    dailyAmount: 0,
    remainingAllocation: 0,
    inventory: 0,
    inboundInventory: 0,
    daysLeft: 0,
    type: 'input',
    ...partial,
  };
}

const helion: SupplyBase = {
  naturalId: 'VH-331d',
  name: 'Helion',
  resupplyDays: 10,
  burn: {
    // 100/day, 300 at base + 200 in WAR = 5 days -> need 500.
    C: mat({ input: 100, dailyAmount: -100, inventory: 300, warehouseInventory: 200 }),
    // Workforce: 10/day, 50 -> need 50.
    RAT: mat({ workforce: 10, dailyAmount: -10, inventory: 50 }),
    // Produced here.
    PG: mat({ output: 5000, dailyAmount: 5000, inventory: 900 }),
  },
};

const curie: SupplyBase = {
  naturalId: 'OZ-189c',
  name: 'Curie',
  resupplyDays: 10,
  burn: {
    // 50/day, 100 -> 2 days, need 400.
    C: mat({ input: 50, dailyAmount: -50, inventory: 100 }),
    // Covered: 20 days of RAT.
    RAT: mat({ workforce: 10, dailyAmount: -10, inventory: 200 }),
  },
};

const ashland: SupplyBase = {
  naturalId: 'PD-754d',
  name: 'Ashland',
  resupplyDays: 10,
  burn: { C: mat({ output: 578, dailyAmount: 578, inventory: 2000 }) },
};

const options: SupplyOptions = {
  prod: true,
  wf: true,
  hrt: { C: 690, RAT: 3000 },
  reserved: { C: 100 },
  onOrder: { C: 50 },
};

describe('buildSupplyRows', () => {
  const rows = buildSupplyRows([helion, curie], [helion, curie, ashland], options);
  const c = rows.find(x => x.ticker === 'C')!;

  it('sums the need of each base and counts the planet warehouse', () => {
    expect(c.cells['VH-331d'].need).toBe(500);
    expect(c.cells['OZ-189c'].need).toBe(400);
    expect(c.totalNeed).toBe(900);
  });

  it('deducts reserved stock and adds stock on order', () => {
    // 690 - 100 reserved + 50 on order = 640 available, 900 needed.
    expect(c.available).toBe(640);
    expect(c.missing).toBe(260);
  });

  it('lists my own producers, excluded bases included', () => {
    expect(c.producers).toEqual([{ name: 'Ashland', daily: 578, stock: 2000 }]);
  });

  it('orders inputs by urgency and leaves out produced materials', () => {
    expect(rows.map(x => x.ticker)).toEqual(['C', 'RAT']);
    expect(c.minDays).toBe(2);
  });

  it('applies the PROD and WF filters', () => {
    const wfOnly = buildSupplyRows([helion, curie], [], { ...options, prod: false });
    expect(wfOnly.map(x => x.ticker)).toEqual(['RAT']);
  });

  it('adds the reserved amount HRT cannot cover to the missing amount', () => {
    // 3,169 needed by the base + 21,000 reserved - 12,662 in stock = 11,507 missing.
    const base: SupplyBase = {
      naturalId: 'XX-001a',
      name: 'Base',
      resupplyDays: 10,
      burn: { PG: mat({ input: 316.9, dailyAmount: -316.9 }) },
    };
    const pg = buildSupplyRows([base], [base], {
      ...options,
      hrt: { PG: 12662 },
      reserved: { PG: 21000 },
      onOrder: {},
    }).find(x => x.ticker === 'PG')!;
    expect(pg.totalNeed).toBe(3169);
    expect(pg.missing).toBe(11507);
  });

  it('reports no missing amount when HRT covers the need', () => {
    expect(rows.find(x => x.ticker === 'RAT')!.missing).toBe(0);
  });
});

describe('summarizeBases', () => {
  it('totals weight and volume per base and suggests a ship', () => {
    const rows = buildSupplyRows([helion, curie], [], options);
    const size = (t: string) => ({ C: { weight: 2, volume: 1 }, RAT: { weight: 1, volume: 1 } })[t];
    const summary = summarizeBases([helion, curie], rows, size);
    // Curie is the most urgent (2 days of C).
    expect(summary.map(x => x.name)).toEqual(['Curie', 'Helion']);
    const h = summary.find(x => x.name === 'Helion')!;
    expect(h.weight).toBe(500 * 2 + 50);
    expect(h.volume).toBe(500 + 50);
    expect(h.inputs).toBe(2);
    expect(h.ship).toBe('LCB');
  });
});

describe('suggestShip', () => {
  it('picks the smallest bay that fits both limits', () => {
    expect(suggestShip(1500, 1500)).toBe('LCB');
    expect(suggestShip(2800, 900)).toBe('WCB');
    expect(suggestShip(4000, 3000)).toBe('HCB');
    expect(suggestShip(12000, 2000)).toBe('3× HCB');
    expect(suggestShip(0, 0)).toBe('');
  });
});

describe('getContractFlows', () => {
  const at = (id: string) => ({ lines: [] as unknown[], id }) as unknown as PrunApi.Address;
  const naturalIdOf = (a?: PrunApi.Address | null) => (a as unknown as { id: string })?.id;
  const material = (ticker: string) => ({ ticker }) as PrunApi.Material;
  function condition(
    partial: Partial<PrunApi.ContractCondition> & { ticker: string; qty: number },
  ): PrunApi.ContractCondition {
    const { ticker, qty, ...rest } = partial;
    return {
      id: rest.id ?? ticker + qty,
      type: 'PROVISION',
      party: 'PROVIDER',
      index: 0,
      status: 'PENDING',
      dependencies: [],
      deadlineDuration: null,
      deadline: null,
      quantity: { material: material(ticker), amount: qty } as PrunApi.MaterialAmount,
      ...rest,
    } as PrunApi.ContractCondition;
  }
  function contract(
    status: PrunApi.ContractStatus,
    conditions: PrunApi.ContractCondition[],
  ): PrunApi.Contract {
    return {
      localId: 'X1',
      partner: { name: 'Bogside' },
      party: 'CUSTOMER',
      status,
      conditions,
    } as unknown as PrunApi.Contract;
  }

  it('counts what partners still have to bring to HRT', () => {
    const flows = getContractFlows(
      [contract('CLOSED', [condition({ ticker: 'RDE', qty: 28, address: at('HRT') })])],
      'HRT',
      naturalIdOf,
    );
    expect(flows.onOrder).toEqual({ RDE: 28 });
    expect(flows.onOrderLines.RDE[0].partner).toBe('Bogside');
  });

  it('counts what I still have to provide from HRT as reserved', () => {
    const flows = getContractFlows(
      [
        contract('CLOSED', [
          condition({ ticker: 'DW', qty: 7710, party: 'CUSTOMER', address: at('HRT') }),
        ]),
      ],
      'HRT',
      naturalIdOf,
    );
    expect(flows.reserved).toEqual({ DW: 7710 });
  });

  it('ignores other places, fulfilled conditions and inactive contracts', () => {
    const flows = getContractFlows(
      [
        contract('CLOSED', [condition({ ticker: 'C', qty: 5, address: at('OZ-189c') })]),
        contract('CLOSED', [
          condition({ ticker: 'H', qty: 5, address: at('HRT'), status: 'FULFILLED' }),
        ]),
        contract('OPEN', [condition({ ticker: 'O', qty: 5, address: at('HRT') })]),
        contract('FULFILLED', [condition({ ticker: 'N', qty: 5, address: at('HRT') })]),
      ],
      'HRT',
      naturalIdOf,
    );
    expect(flows.onOrder).toEqual({});
    expect(flows.reserved).toEqual({});
  });

  it('counts provided goods still waiting for my pickup', () => {
    const provided = condition({
      id: 'p1',
      ticker: 'MCG',
      qty: 250,
      address: at('HRT'),
      status: 'FULFILLED',
    });
    const pickup = condition({
      id: 'k1',
      ticker: 'MCG',
      qty: 250,
      type: 'PICKUP',
      party: 'CUSTOMER',
      address: at('HRT'),
      dependencies: ['p1'],
      pickedUp: { amount: 100 } as PrunApi.MaterialAmount,
    });
    const flows = getContractFlows([contract('CLOSED', [provided, pickup])], 'HRT', naturalIdOf);
    expect(flows.onOrder).toEqual({ MCG: 150 });
  });
});

describe('formatList', () => {
  it('lists only missing inputs', () => {
    const rows = buildSupplyRows([helion, curie], [], options);
    expect(formatList(rows)).toBe('C 260');
  });
});
