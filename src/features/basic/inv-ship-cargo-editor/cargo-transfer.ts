export interface Capacity {
  weightLoad: number;
  weightCapacity: number;
  volumeLoad: number;
  volumeCapacity: number;
}

export interface UnitSize {
  weight: number;
  volume: number;
}

const epsilon = 0.000001;

// How many units still fit in the store.
export function getFreeUnits(store: Capacity, unit: UnitSize) {
  const byWeight =
    unit.weight > 0 ? (store.weightCapacity - store.weightLoad) / unit.weight : Infinity;
  const byVolume =
    unit.volume > 0 ? (store.volumeCapacity - store.volumeLoad) / unit.volume : Infinity;
  return Math.max(0, Math.floor(Math.min(byWeight, byVolume) + epsilon));
}

// The lowest and highest amount the ship can hold after one transfer with the partner store.
export function getAmountLimits(
  ship: Capacity,
  partner: Capacity,
  unit: UnitSize,
  shipAmount: number,
  partnerAmount: number,
) {
  const maxIn = Math.min(partnerAmount, getFreeUnits(ship, unit));
  const maxOut = Math.min(shipAmount, getFreeUnits(partner, unit));
  return { min: shipAmount - maxOut, max: shipAmount + maxIn };
}

// The store as it would be after its amount of the ticker changes to the target.
export function simulateStore(
  store: PrunApi.Store,
  ticker: string,
  unit: UnitSize,
  target: number,
): PrunApi.Store {
  let weightLoad = store.weightLoad;
  let volumeLoad = store.volumeLoad;
  const items: PrunApi.StoreItem[] = [];
  for (const item of store.items) {
    const quantity = item.quantity;
    if (quantity?.material.ticker !== ticker) {
      items.push(item);
      continue;
    }
    weightLoad += unit.weight * target - item.weight;
    volumeLoad += unit.volume * target - item.volume;
    if (target <= 0) {
      continue;
    }
    items.push({
      ...item,
      quantity: { ...quantity, amount: target },
      weight: unit.weight * target,
      volume: unit.volume * target,
    });
  }
  return { ...store, items, weightLoad, volumeLoad };
}
