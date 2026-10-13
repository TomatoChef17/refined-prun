// External CX API (ECAPI), version 0: a common format for player-run markets.
// It follows the PUNoted vendor stores format, so PUNoted is the first market
// that supports it. Any other market can serve the same JSON.
import type { MaterialBill } from '@src/features/XIT/ACT/material-bill';
import { sumBy } from '@src/utils/sum-by';

export const DEFAULT_ECAPI_URL = 'https://api.punoted.net/vendor_stores';

export interface EcapiLocation {
  location_name?: string;
  location_code?: string;
  available?: number;
}

export interface EcapiOrder {
  materialticker: string;
  ordertype: string;
  // -1 means "sell at the corporation price".
  fixedprice?: number;
  price?: { fixedprice?: number; corpprice?: number; cxprice?: number };
  location?: EcapiLocation[];
}

export interface EcapiVendor {
  vendor: {
    gamename: string;
    companycode?: string;
    companyname?: string;
    isactive?: boolean;
  };
  orders: EcapiOrder[];
}

export interface EcapiResponse {
  success?: boolean;
  vendors: EcapiVendor[];
}

export interface VendorPurchase {
  // In-game user name, used as the contract recipient.
  vendor: string;
  company?: string;
  materials: MaterialBill;
  total: number;
}

export interface PurchasePlan {
  purchases: VendorPurchase[];
  // Amounts no vendor can supply at that location.
  missing: Record<string, number>;
}

export interface PlanOptions {
  // Contract location: a station or planet name, or its natural ID.
  location: string;
  // In-game user names or company codes to leave out (case-insensitive).
  exclude?: string[];
}

export function isEcapiResponse(value: unknown): value is EcapiResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { vendors?: unknown }).vendors)
  );
}

// Price per unit: the fixed price when set, else the corporation price.
export function orderPrice(order: EcapiOrder) {
  const fixed = order.price?.fixedprice ?? order.fixedprice ?? -1;
  if (fixed > 0) {
    return fixed;
  }
  return order.price?.corpprice ?? 0;
}

function matchesLocation(location: EcapiLocation, wanted: string) {
  const key = wanted.trim().toLowerCase();
  return (
    location.location_code?.toLowerCase() === key || location.location_name?.toLowerCase() === key
  );
}

interface Offer {
  vendor: EcapiVendor['vendor'];
  ticker: string;
  price: number;
  available: number;
}

// One vendor per material when one has enough stock: the cheapest of those.
// Otherwise the amount is split, cheapest offer first, until it is covered.
// Materials of the same vendor go in one contract.
export function planPurchases(
  data: EcapiResponse,
  wanted: Record<string, number>,
  options: PlanOptions,
): PurchasePlan {
  const exclude = new Set((options.exclude ?? []).map(x => x.trim().toLowerCase()));
  const isExcluded = (vendor: EcapiVendor['vendor']) =>
    exclude.has(vendor.gamename.toLowerCase()) ||
    (vendor.companycode !== undefined && exclude.has(vendor.companycode.toLowerCase()));

  const offers: Offer[] = [];
  for (const entry of data.vendors) {
    if (entry.vendor.isactive === false || isExcluded(entry.vendor)) {
      continue;
    }
    for (const order of entry.orders) {
      if (order.ordertype !== 'sell' || !(order.materialticker in wanted)) {
        continue;
      }
      const price = orderPrice(order);
      if (!(price > 0)) {
        continue;
      }
      const available = sumBy(
        (order.location ?? []).filter(x => matchesLocation(x, options.location)),
        x => Math.floor(x.available ?? 0),
      );
      if (available > 0) {
        offers.push({ vendor: entry.vendor, ticker: order.materialticker, price, available });
      }
    }
  }
  // Cheapest first; on a tie, the vendor with more stock (fewer contracts).
  offers.sort((a, b) => (a.price !== b.price ? a.price - b.price : b.available - a.available));

  const byVendor = new Map<string, VendorPurchase>();
  const missing: Record<string, number> = {};
  const add = (offer: Offer, ticker: string, take: number) => {
    const name = offer.vendor.gamename;
    let purchase = byVendor.get(name);
    if (!purchase) {
      purchase = { vendor: name, company: offer.vendor.companycode, materials: {}, total: 0 };
      byVendor.set(name, purchase);
    }
    purchase.materials[ticker] = { quantity: take, price: offer.price };
    purchase.total += take * offer.price;
  };
  for (const [ticker, amount] of Object.entries(wanted)) {
    const need = Math.ceil(amount);
    const forTicker = offers.filter(x => x.ticker === ticker);
    const single = forTicker.find(x => x.available >= need);
    if (single) {
      add(single, ticker, need);
      continue;
    }
    let left = need;
    for (const offer of forTicker) {
      if (left <= 0) {
        break;
      }
      const take = Math.min(left, offer.available);
      add(offer, ticker, take);
      left -= take;
    }
    if (left > 0) {
      missing[ticker] = left;
    }
  }
  return { purchases: [...byVendor.values()], missing };
}
