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

export { getResupplyDays };
