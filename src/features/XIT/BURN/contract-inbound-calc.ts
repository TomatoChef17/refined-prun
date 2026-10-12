// Pure: cargo that partners' ships bring to my bases under accepted shipping contracts.
export interface ContractInboundLine {
  contract: string;
  partner: string;
  ticker: string;
  amount: number;
}

export interface ContractInbound {
  totals: Record<string, number>;
  lines: ContractInboundLine[];
}

// Contracts in force: accepted by both sides and not finished.
const ACTIVE = new Set<string>(['CLOSED', 'PARTIALLY_FULFILLED', 'DEADLINE_EXCEEDED']);

// Materials of one delivery: DELIVERY_SHIPMENT <- PICKUP_SHIPMENT <- PROVISION_SHIPMENT.
function shipmentMaterials(contract: PrunApi.Contract, delivery: PrunApi.ContractCondition) {
  const byId = new Map(contract.conditions.map(x => [x.id, x]));
  const provisions: PrunApi.ContractCondition[] = [];
  for (const pickupId of delivery.dependencies) {
    const pickup = byId.get(pickupId);
    if (pickup?.type !== 'PICKUP_SHIPMENT') {
      continue;
    }
    for (const provisionId of pickup.dependencies) {
      const provision = byId.get(provisionId);
      if (provision?.type === 'PROVISION_SHIPMENT') {
        provisions.push(provision);
      }
    }
  }
  if (provisions.length === 0) {
    // Unusual layout: with a single delivery, every provided shipment belongs to it.
    const deliveries = contract.conditions.filter(x => x.type === 'DELIVERY_SHIPMENT');
    if (deliveries.length === 1) {
      provisions.push(...contract.conditions.filter(x => x.type === 'PROVISION_SHIPMENT'));
    }
  }
  return provisions
    .map(x => x.quantity)
    .filter((x): x is PrunApi.MaterialAmount => !!x && x.amount > 0);
}

// Planet natural id -> cargo still to be delivered there by a partner.
export function getShipmentInbound(
  contracts: PrunApi.Contract[],
  naturalIdOf: (address?: PrunApi.Address | null) => string | undefined,
): Record<string, ContractInbound> {
  const result: Record<string, ContractInbound> = {};
  for (const contract of contracts) {
    if (!ACTIVE.has(contract.status)) {
      continue;
    }
    for (const condition of contract.conditions) {
      if (
        condition.type !== 'DELIVERY_SHIPMENT' ||
        condition.party === contract.party ||
        condition.status === 'FULFILLED'
      ) {
        continue;
      }
      const planet = naturalIdOf(condition.destination ?? condition.address);
      if (!planet) {
        continue;
      }
      const entry = (result[planet] ??= { totals: {}, lines: [] });
      for (const quantity of shipmentMaterials(contract, condition)) {
        const ticker = quantity.material.ticker;
        entry.totals[ticker] = (entry.totals[ticker] ?? 0) + quantity.amount;
        entry.lines.push({
          contract: contract.localId,
          partner: contract.partner.name,
          ticker,
          amount: quantity.amount,
        });
      }
    }
  }
  return result;
}
