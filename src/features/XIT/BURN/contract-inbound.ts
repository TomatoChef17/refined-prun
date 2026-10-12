import { contractsStore } from '@src/infrastructure/prun-api/data/contracts';
import { getEntityNaturalIdFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { ContractInbound, getShipmentInbound } from './contract-inbound-calc';

const byPlanet = computed(() =>
  getShipmentInbound(contractsStore.all.value ?? [], getEntityNaturalIdFromAddress),
);

const empty: ContractInbound = { totals: {}, lines: [] };

// Cargo partners' ships still have to deliver to this planet (accepted shipping contracts).
export function getContractInbound(naturalId: string | undefined): ContractInbound {
  if (!naturalId) {
    return empty;
  }
  return byPlanet.value[naturalId] ?? empty;
}
