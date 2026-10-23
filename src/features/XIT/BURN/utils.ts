import {
  BurnValues,
  getMinDaysLeft,
  getResupplyDays,
  MaterialBurn,
  PlanetBurn,
} from '@src/core/burn';
import { materialsStore } from '@src/infrastructure/prun-api/data/materials';
import { sortMaterials } from '@src/core/sort-materials';
import { trunc0, trunc01 } from '@src/utils/format';
import { userData } from '@src/store/user-data';
import { computeNeedAll, getBuyAmount, getDaysAll } from './need';

export { computeNeedAll, getBuyAmount, getDaysAll };
import { warehousesStore } from '@src/infrastructure/prun-api/data/warehouses';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';

export type BurnSortKey =
  | 'ticker'
  | 'inv'
  | 'invHrt'
  | 'burn'
  | 'need'
  | 'buy'
  | 'days'
  | 'daysAll';

// Natural ID of Hortus Station, whose warehouse feeds the INV HRT column.
export const HRT_NATURAL_ID = 'HRT';

// Default direction when a column is first clicked.
export const burnSortNaturalDesc: Record<BurnSortKey, boolean> = {
  ticker: false,
  inv: false,
  invHrt: true,
  burn: false,
  need: true,
  buy: true,
  days: false,
  daysAll: false,
};

function getSortValue(mat: MaterialBurn, key: BurnSortKey, naturalId: string) {
  switch (key) {
    case 'ticker':
      return 0;
    case 'inv':
      return mat.inventory + mat.inboundInventory + mat.remainingAllocation;
    case 'invHrt':
      return mat.hrtInventory ?? 0;
    case 'burn':
      return mat.dailyAmount;
    case 'need':
      return computeNeedAll(mat, getResupplyDays(naturalId || undefined));
    case 'buy':
      return getBuyAmount(mat, getResupplyDays(naturalId || undefined));
    case 'days':
      return mat.dailyAmount >= 0 ? Number.POSITIVE_INFINITY : mat.daysLeft;
    case 'daysAll':
      return getDaysAll(mat);
  }
}

export function getSortedTickers(burn: PlanetBurn, sortBy?: string, sortDesc?: boolean) {
  const materials = Object.keys(burn.burn).map(materialsStore.getByTicker);
  const sorted = sortMaterials(materials.filter(x => x !== undefined));
  if (!sortBy || !(sortBy in burnSortNaturalDesc)) {
    return sorted;
  }
  const key = sortBy as BurnSortKey;
  const dir = sortDesc ? -1 : 1;
  if (key === 'ticker') {
    return sorted.slice().sort((a, b) => a.ticker.localeCompare(b.ticker) * dir);
  }
  // Array.prototype.sort is stable: ties keep the default material order.
  return sorted.slice().sort((a, b) => {
    const x = getSortValue(burn.burn[a.ticker], key, burn.naturalId);
    const y = getSortValue(burn.burn[b.ticker], key, burn.naturalId);
    if (x === y) {
      return 0;
    }
    return (x < y ? -1 : 1) * dir;
  });
}

export const countDays = getMinDaysLeft;

// Material amounts in the warehouse on the given planet.
export function getWarehouseAmounts(naturalId: string) {
  const amounts: Record<string, number> = {};
  if (!naturalId) {
    return amounts;
  }
  const warehouse = warehousesStore.getByEntityNaturalId(naturalId);
  const store = storagesStore.getById(warehouse?.storeId);
  for (const item of store?.items ?? []) {
    const quantity = item.quantity;
    if (!quantity) {
      continue;
    }
    const ticker = quantity.material.ticker;
    amounts[ticker] = (amounts[ticker] ?? 0) + quantity.amount;
  }
  return amounts;
}

// Days All of the most urgent net-consumed material.
export function countDaysAll(burn: BurnValues) {
  let days = 1000;
  for (const key of Object.keys(burn)) {
    const mat = burn[key];
    if (mat.dailyAmount >= 0) {
      continue;
    }
    days = Math.min(days, getDaysAll(mat));
  }
  return days;
}

export function formatBurnDays(days: number) {
  if (days > 999) {
    return '∞';
  }
  if (days >= 10) {
    return trunc0(days);
  }
  return trunc01(days);
}

export function getBurnThresholds(days: number) {
  const isRed = days <= userData.settings.burn.red;
  const isYellow = !isRed && days <= userData.settings.burn.yellow;
  return {
    isRed,
    isYellow,
    isGreen: !isRed && !isYellow,
  };
}

export function burnDaysClass(days: number) {
  const { isRed, isYellow, isGreen } = getBurnThresholds(days);
  return {
    [C.Workforces.daysMissing]: isRed,
    [C.Workforces.daysWarning]: isYellow,
    [C.Workforces.daysSupplied]: isGreen,
  };
}
