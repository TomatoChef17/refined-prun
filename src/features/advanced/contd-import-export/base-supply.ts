import { sumBy } from '@src/utils/sum-by';
import { MaterialEntry } from './parsers';
import { FillStack, ShipBay, SizeLookup, cargoLoad, gameSize } from './ship-fill';

// What the destination base holds and uses of one material.
export interface BaseMaterial {
  // The XIT BURN Inv value: base stock, in flight to it and still to come by contract.
  inv: number;
  // Inv plus the planet warehouse: what the base can use, like XIT BURN Days All.
  stock: number;
  // Units used per day (positive). 0 when the base does not use it.
  usePerDay: number;
}

export type BaseLookup = (ticker: string) => BaseMaterial | undefined;

// Largest XIT BURN Inv first. Materials the base does not have go last, in list order.
export function sortByBaseStock(entries: MaterialEntry[], base: BaseLookup) {
  const stock = (entry: MaterialEntry) => base(entry.ticker)?.inv ?? -1;
  // Array.prototype.sort is stable: equal stocks keep the list order.
  return entries.slice().sort((a, b) => stock(b) - stock(a));
}

function listedAmount(existing: MaterialEntry[], ticker: string) {
  return sumBy(
    existing.filter(x => x.ticker === ticker),
    x => (Number.isFinite(x.amount) && x.amount > 0 ? x.amount : 0),
  );
}

// Units to add so the base holds enough for the given days, counting the units already listed.
export function needAmount(
  base: BaseMaterial | undefined,
  days: number,
  listed: number,
  available: number,
) {
  if (!base || base.usePerDay <= 0) {
    return 0;
  }
  const missing = Math.ceil(days * base.usePerDay - base.stock - listed);
  return Math.max(0, Math.min(missing, available));
}

// NEED: for each dragged stack, the units that bring the base to the resupply days.
export function needFill(
  stacks: FillStack[],
  existing: MaterialEntry[],
  base: BaseLookup,
  resupplyDays: number,
): MaterialEntry[] {
  const added: MaterialEntry[] = [];
  for (const stack of stacks) {
    const amount = needAmount(
      base(stack.ticker),
      resupplyDays,
      listedAmount(existing, stack.ticker),
      stack.quantity,
    );
    if (amount >= 1) {
      added.push({ ticker: stack.ticker, amount });
    }
  }
  return added;
}

// Balanced bay fill: the room left in the bay is shared so that every dragged material
// lasts the same number of days at the base, as long as possible.
// Materials the base does not use get nothing.
export function balanceBay(
  bay: ShipBay,
  existing: MaterialEntry[],
  stacks: FillStack[],
  base: BaseLookup,
  size: SizeLookup = gameSize,
): MaterialEntry[] {
  const load = cargoLoad(existing, size);
  const weightLeft = bay.weight - load.weight;
  const volumeLeft = bay.volume - load.volume;
  const items = stacks
    .map(stack => ({
      stack,
      unit: size(stack.ticker),
      base: base(stack.ticker),
      listed: listedAmount(existing, stack.ticker),
    }))
    .filter(x => x.unit !== undefined && x.base !== undefined && x.base.usePerDay > 0);
  if (items.length === 0 || weightLeft <= 0 || volumeLeft <= 0) {
    return [];
  }

  const amountsFor = (days: number) =>
    items.map(x => needAmount(x.base, days, x.listed, x.stack.quantity));
  const fits = (amounts: number[]) => {
    let weight = 0;
    let volume = 0;
    for (let i = 0; i < amounts.length; i++) {
      weight += amounts[i] * items[i].unit!.weight;
      volume += amounts[i] * items[i].unit!.volume;
    }
    // Tolerance for float sums of per-unit weights.
    return weight <= weightLeft + 1e-6 && volume <= volumeLeft + 1e-6;
  };

  // Find the most days that still fit. 10 years is far more than any bay holds.
  let low = 0;
  let high = 3650;
  for (let i = 0; i < 60; i++) {
    const middle = (low + high) / 2;
    if (fits(amountsFor(middle))) {
      low = middle;
    } else {
      high = middle;
    }
  }
  const amounts = amountsFor(low);
  return items
    .map((x, i) => ({ ticker: x.stack.ticker, amount: amounts[i] }))
    .filter(x => x.amount >= 1);
}
