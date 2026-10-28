import type { MaterialBurn } from '@src/core/burn';

// Days left when the planet warehouse stock is added to the base stock.
export function getDaysAll(mat: MaterialBurn) {
  if (mat.dailyAmount >= 0) {
    return Number.POSITIVE_INFINITY;
  }
  const total =
    mat.inventory + mat.inboundInventory + mat.remainingAllocation + (mat.warehouseInventory ?? 0);
  return total / -mat.dailyAmount;
}

// Amount to deliver to reach the resupply target, counting the base stock,
// inbound cargo AND the warehouse stock on the same planet (same basis as Days All).
export function computeNeedAll(mat: MaterialBurn, resupplyDays: number) {
  if (mat.dailyAmount >= 0) {
    return 0;
  }
  const daysAll = getDaysAll(mat);
  if (!Number.isFinite(daysAll) || daysAll >= resupplyDays) {
    return 0;
  }
  // Math.abs avoids a "-0" result.
  return Math.abs(Math.ceil((daysAll - resupplyDays) * mat.dailyAmount));
}

// Part of the need that Hortus Station cannot cover and has to be bought.
export function getBuyAmount(mat: MaterialBurn, resupplyDays: number) {
  const need = computeNeedAll(mat, resupplyDays);
  return Math.max(0, Math.ceil(need - (mat.hrtInventory ?? 0)));
}
