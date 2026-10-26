import { getPlanetBurn, getResupplyDays } from '@src/core/burn';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { contractDraftsStore } from '@src/infrastructure/prun-api/data/contract-drafts';
import {
  getEntityNameFromAddress,
  getEntityNaturalIdFromAddress,
} from '@src/infrastructure/prun-api/data/addresses';
import {
  getContractInbound,
  getPurchaseContractInbound,
} from '@src/features/XIT/BURN/contract-inbound';
import { getWarehouseAmounts } from '@src/features/XIT/BURN/utils';
import { homeStation } from '@src/core/home-station';
import { getContractFlows } from '@src/features/XIT/SUPPLY/supply-calc';
import { contractsStore } from '@src/infrastructure/prun-api/data/contracts';
import { userData } from '@src/store/user-data';
import { getInvStore } from '@src/core/store-id';
import { BaseLookup } from './base-supply';

export interface BaseOption {
  naturalId: string;
  name: string;
}

// The player's bases, by name.
export function getBaseOptions(): BaseOption[] {
  const options: BaseOption[] = [];
  for (const site of sitesStore.all.value ?? []) {
    const naturalId = getEntityNaturalIdFromAddress(site.address);
    if (!naturalId) {
      continue;
    }
    options.push({ naturalId, name: getEntityNameFromAddress(site.address) ?? naturalId });
  }
  return options.sort((a, b) => a.name.localeCompare(b.name));
}

// The base the draft delivers to: a condition destination first, then a condition address.
export function getDraftBase(draftNaturalId: string | undefined) {
  const draft = contractDraftsStore.getByNaturalId(draftNaturalId);
  if (!draft) {
    return undefined;
  }
  const isBase = (naturalId: string | undefined) =>
    naturalId !== undefined && sitesStore.getByPlanetNaturalId(naturalId) !== undefined;
  for (const condition of draft.conditions) {
    const naturalId = getEntityNaturalIdFromAddress(condition.destination);
    if (isBase(naturalId)) {
      return naturalId;
    }
  }
  for (const condition of draft.conditions) {
    const naturalId = getEntityNaturalIdFromAddress(condition.address);
    if (isBase(naturalId)) {
      return naturalId;
    }
  }
  return undefined;
}

// The base whose inventory a drag started from, read from the INV tile command.
// Undefined for warehouses, ships and other sources.
export function getSourceBase(source: Element | undefined) {
  const frame = source?.closest(`.${C.TileFrame.frame}`);
  const command = frame ? _$(frame, C.TileFrame.cmd)?.textContent?.trim() : undefined;
  if (!command) {
    return undefined;
  }
  const space = command.indexOf(' ');
  if (space < 0 || command.slice(0, space).toUpperCase() !== 'INV') {
    return undefined;
  }
  const store = getInvStore(command.slice(space + 1));
  if (store?.type !== 'STORE') {
    return undefined;
  }
  return getEntityNaturalIdFromAddress(sitesStore.getById(store.addressableId)?.address);
}

// Stock and daily use per material at the base, counted like XIT BURN.
export function getBaseLookup(naturalId: string | undefined): BaseLookup | undefined {
  const site = sitesStore.getByPlanetNaturalId(naturalId);
  const burn = getPlanetBurn(site);
  if (!naturalId || !burn) {
    return undefined;
  }
  const partner = getContractInbound(naturalId).totals;
  const bought = getPurchaseContractInbound(naturalId).totals;
  const warehouse = getWarehouseAmounts(naturalId);
  return ticker => {
    const mat = burn.burn[ticker] as (typeof burn.burn)[string] | undefined;
    if (!mat) {
      return undefined;
    }
    const inv =
      mat.inventory +
      mat.inboundInventory +
      mat.remainingAllocation +
      (partner[ticker] ?? 0) +
      (bought[ticker] ?? 0);
    return {
      inv,
      stock: inv + (warehouse[ticker] ?? 0),
      usePerDay: mat.dailyAmount < 0 ? -mat.dailyAmount : 0,
    };
  };
}

export interface HrtStock {
  stock: number;
  // Still to provide from the home station in my open contracts.
  contracts: number;
  // Kept aside in XIT SUPPLY.
  kept: number;
  free: number;
}

// Home station (XIT SET COSM) warehouse stock that is free to ship: not promised in my contracts
// and not kept aside in XIT SUPPLY.
export function getHrtStock(): (ticker: string) => HrtStock {
  const hub = homeStation.value.naturalId;
  const stock = getWarehouseAmounts(hub);
  const flows = getContractFlows(
    contractsStore.all.value ?? [],
    hub,
    getEntityNaturalIdFromAddress,
  );
  const kept = userData.supply.reserved;
  return ticker => {
    const amount = stock[ticker] ?? 0;
    const contracts = flows.reserved[ticker] ?? 0;
    const aside = kept[ticker] ?? 0;
    return {
      stock: amount,
      contracts,
      kept: aside,
      free: Math.max(0, Math.floor(amount - contracts - aside)),
    };
  };
}

export { getResupplyDays };
