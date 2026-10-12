import { describe, expect, it } from 'vitest';
import { getShipmentInbound } from './contract-inbound-calc';

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
