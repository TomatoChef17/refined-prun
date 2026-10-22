import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import { warehousesStore } from '@src/infrastructure/prun-api/data/warehouses';
import { getEntityNaturalIdFromAddress } from '@src/infrastructure/prun-api/data/addresses';

export interface PartnerStore {
  id: string;
  label: string;
}

// Stores the ship can trade materials with at its current location: the warehouse first,
// then the base. Empty while the ship is in flight.
export function getPartnerStores(shipStoreId: string): PartnerStore[] {
  const ship = shipsStore.getByStoreId(shipStoreId);
  if (!ship || ship.flightId !== null) {
    return [];
  }
  const naturalId = getEntityNaturalIdFromAddress(ship.address);
  if (!naturalId) {
    return [];
  }
  const partners: PartnerStore[] = [];
  const warehouse = warehousesStore.getByEntityNaturalId(naturalId);
  const warehouseStore = storagesStore.getById(warehouse?.storeId);
  if (warehouseStore) {
    partners.push({ id: warehouseStore.id, label: `WAR ${naturalId}` });
  }
  const site = sitesStore.getByPlanetNaturalId(naturalId);
  const baseStore = storagesStore.getByAddressableId(site?.siteId)?.find(x => x.type === 'STORE');
  if (baseStore) {
    partners.push({ id: baseStore.id, label: `BASE ${naturalId}` });
  }
  return partners;
}
