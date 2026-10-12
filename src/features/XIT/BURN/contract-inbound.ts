import { contractsStore } from '@src/infrastructure/prun-api/data/contracts';
import { getEntityNaturalIdFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { ContractInbound, getPurchaseInbound, getShipmentInbound } from './contract-inbound-calc';

const byPlanet = computed(() =>
  getShipmentInbound(contractsStore.all.value ?? [], getEntityNaturalIdFromAddress),
);

const purchasesByPlanet = computed(() =>
  getPurchaseInbound(contractsStore.all.value ?? [], getEntityNaturalIdFromAddress),
);

const empty: ContractInbound = { totals: {}, lines: [] };

// Cargo partners' ships still have to deliver to this planet (accepted shipping contracts).
export function getContractInbound(naturalId: string | undefined): ContractInbound {
  if (!naturalId) {
    return empty;
  }
  return byPlanet.value[naturalId] ?? empty;
}

// Goods sellers still have to deliver to this planet (accepted purchase contracts).
export function getPurchaseContractInbound(naturalId: string | undefined): ContractInbound {
  if (!naturalId) {
    return empty;
  }
  return purchasesByPlanet.value[naturalId] ?? empty;
}
