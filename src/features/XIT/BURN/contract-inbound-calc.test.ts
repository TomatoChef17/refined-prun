import { describe, expect, it } from 'vitest';
import { getPurchaseInbound, getShipmentInbound } from './contract-inbound-calc';

const at = (id: string) => ({ id }) as unknown as PrunApi.Address;
const naturalIdOf = (a?: PrunApi.Address | null) => (a as unknown as { id?: string })?.id;

function cond(partial: Partial<PrunApi.ContractCondition>): PrunApi.ContractCondition {
  return {
    id: 'x',
    type: 'PROVISION_SHIPMENT',
    party: 'CUSTOMER',
    index: 0,
    status: 'PENDING',
    dependencies: [],
    deadlineDuration: null,
    deadline: null,
    ...partial,
  } as PrunApi.ContractCondition;
}

const qty = (ticker: string, amount: number) =>
  ({ material: { ticker }, amount }) as PrunApi.MaterialAmount;

function shipping(
  status: PrunApi.ContractStatus,
  deliveryStatus: PrunApi.ContractConditionStatus = 'PENDING',
  deliveryParty: PrunApi.ContractParty = 'PROVIDER',
): PrunApi.Contract {
  return {
    localId: 'EO616JG',
    partner: { name: 'Mylgron Minerals' },
    party: 'CUSTOMER',
    status,
    conditions: [
      cond({ id: 'prov1', quantity: qty('DW', 1100), address: at('HRT') }),
      cond({ id: 'prov2', quantity: qty('RAT', 500), address: at('HRT') }),
      cond({
        id: 'pick',
        type: 'PICKUP_SHIPMENT',
        party: 'PROVIDER',
        dependencies: ['prov1', 'prov2'],
      }),
      cond({
        id: 'del',
        type: 'DELIVERY_SHIPMENT',
        party: deliveryParty,
        status: deliveryStatus,
        dependencies: ['pick'],
        destination: at('SB-838b'),
      }),
    ],
  } as unknown as PrunApi.Contract;
}

describe('getShipmentInbound', () => {
  it('counts what a partner ship still has to deliver to my base', () => {
    const result = getShipmentInbound([shipping('CLOSED')], naturalIdOf);
    expect(result['SB-838b'].totals).toEqual({ DW: 1100, RAT: 500 });
    expect(result['SB-838b'].lines[0]).toMatchObject({
      contract: 'EO616JG',
      partner: 'Mylgron Minerals',
    });
  });

  it('tells whether the cargo is still to be picked up or on the way', () => {
    const waiting = getShipmentInbound([shipping('CLOSED')], naturalIdOf)['SB-838b'];
    expect(waiting.lines[0].stage).toBe('pickup');
    const contract = shipping('CLOSED');
    contract.conditions.find(x => x.id === 'pick')!.status = 'FULFILLED';
    const loaded = getShipmentInbound([contract], naturalIdOf)['SB-838b'];
    expect(loaded.lines[0].stage).toBe('transit');
  });

  it('ignores delivered shipments and contracts not accepted yet', () => {
    expect(getShipmentInbound([shipping('CLOSED', 'FULFILLED')], naturalIdOf)).toEqual({});
    expect(getShipmentInbound([shipping('OPEN')], naturalIdOf)).toEqual({});
    expect(getShipmentInbound([shipping('FULFILLED')], naturalIdOf)).toEqual({});
  });

  it('ignores shipments I deliver myself for someone else', () => {
    expect(getShipmentInbound([shipping('CLOSED', 'PENDING', 'CUSTOMER')], naturalIdOf)).toEqual(
      {},
    );
  });
});

function purchase(
  status: PrunApi.ContractStatus,
  type: PrunApi.ContractConditionType = 'DELIVERY',
  party: PrunApi.ContractParty = 'PROVIDER',
  conditionStatus: PrunApi.ContractConditionStatus = 'PENDING',
): PrunApi.Contract {
  return {
    localId: 'GR65BD5',
    partner: { name: 'Seller' },
    party: 'CUSTOMER',
    status,
    conditions: [
      cond({ id: 'pay', type: 'PAYMENT', party: 'CUSTOMER' }),
      cond({
        id: 'goods',
        type,
        party,
        status: conditionStatus,
        quantity: qty('SF', 3000),
        address: at('OZ-189c'),
      }),
    ],
  } as unknown as PrunApi.Contract;
}

describe('getPurchaseInbound', () => {
  it('counts goods a seller still has to deliver to my base', () => {
    expect(getPurchaseInbound([purchase('CLOSED')], naturalIdOf)['OZ-189c'].totals).toEqual({
      SF: 3000,
    });
    expect(
      getPurchaseInbound([purchase('PARTIALLY_FULFILLED', 'PROVISION')], naturalIdOf)['OZ-189c']
        .totals,
    ).toEqual({ SF: 3000 });
  });

  it('ignores delivered goods, contracts not accepted and my own sales', () => {
    expect(
      getPurchaseInbound([purchase('CLOSED', 'DELIVERY', 'PROVIDER', 'FULFILLED')], naturalIdOf),
    ).toEqual({});
    expect(getPurchaseInbound([purchase('OPEN')], naturalIdOf)).toEqual({});
    expect(getPurchaseInbound([purchase('CLOSED', 'DELIVERY', 'CUSTOMER')], naturalIdOf)).toEqual(
      {},
    );
  });
});
