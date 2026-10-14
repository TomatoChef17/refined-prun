// Pure calculations for XIT SUPPLY. No store access here, so it can be unit tested.
import type { BurnValues, MaterialBurn } from '@src/core/burn';
import { computeNeedAll, getDaysAll } from '@src/features/XIT/BURN/need';

export interface SupplyBase {
  naturalId: string;
  name: string;
  // Burn values with warehouseInventory filled for the base planet.
  burn: BurnValues;
  resupplyDays: number;
}

export interface SupplyCell {
  need: number;
  daysAll: number;
  inventory: number;
  warehouse: number;
  inbound: number;
  dailyAmount: number;
  // Units used per day by production lines and by the workforce.
  prodUse: number;
  wfUse: number;
}

export interface Producer {
  name: string;
  daily: number;
  stock: number;
}

export interface SupplyRow {
  ticker: string;
  cells: Record<string, SupplyCell>;
  totalNeed: number;
  // Units used per day by all included bases (PROD and WF switches applied).
  totalUse: number;
  // Fewest days left among the bases consuming this input.
  minDays: number;
  hrt: number;
  reserved: number;
  onOrder: number;
  // HRT stock left for the bases: stock - reserved + on order. Negative when the
  // stock does not even cover the contracts I still have to provide.
  available: number;
  missing: number;
  producers: Producer[];
}

export interface UnitSize {
  weight: number;
  volume: number;
}

export interface Bay {
  label: string;
  weight: number;
  volume: number;
}

// Transport bays, smallest first.
export const SUPPLY_BAYS: Bay[] = [
  { label: 'LCB', weight: 2000, volume: 2000 },
  { label: 'WCB', weight: 3000, volume: 1000 },
  { label: 'HCB', weight: 5000, volume: 5000 },
];

export interface BaseSummary {
  naturalId: string;
  name: string;
  inputs: number;
  weight: number;
  volume: number;
  minDays: number;
  ship: string;
}

export interface SupplyOptions {
  prod: boolean;
  wf: boolean;
  hrt: Record<string, number>;
  reserved: Record<string, number>;
  onOrder: Record<string, number>;
  // Also list inputs of bases that make more than they use (per-day view).
  anyUse?: boolean;
}

function consumes(mat: MaterialBurn, options: SupplyOptions) {
  if (mat.dailyAmount >= 0 && !options.anyUse) {
    return false;
  }
  return (options.prod && mat.input > 0) || (options.wf && mat.workforce > 0);
}

// One row per input consumed by the included bases, most urgent first.
// `producers` lists every base (excluded ones too) with a net production of the input.
export function buildSupplyRows(
  bases: SupplyBase[],
  producerBases: SupplyBase[],
  options: SupplyOptions,
): SupplyRow[] {
  const rows = new Map<string, SupplyRow>();
  for (const base of bases) {
    for (const [ticker, mat] of Object.entries(base.burn)) {
      if (!consumes(mat, options)) {
        continue;
      }
      let row = rows.get(ticker);
      if (!row) {
        row = {
          ticker,
          cells: {},
          totalNeed: 0,
          totalUse: 0,
          minDays: Number.POSITIVE_INFINITY,
          hrt: 0,
          reserved: 0,
          onOrder: 0,
          available: 0,
          missing: 0,
          producers: [],
        };
        rows.set(ticker, row);
      }
      const need = computeNeedAll(mat, base.resupplyDays);
      const daysAll = getDaysAll(mat);
      row.cells[base.naturalId] = {
        need,
        daysAll,
        inventory: mat.inventory + mat.remainingAllocation,
        warehouse: mat.warehouseInventory ?? 0,
        inbound: mat.inboundInventory,
        dailyAmount: mat.dailyAmount,
        prodUse: options.prod ? mat.input : 0,
        wfUse: options.wf ? mat.workforce : 0,
      };
      row.totalNeed += need;
      row.totalUse += row.cells[base.naturalId].prodUse + row.cells[base.naturalId].wfUse;
      row.minDays = Math.min(row.minDays, daysAll);
    }
  }

  for (const row of rows.values()) {
    row.hrt = options.hrt[row.ticker] ?? 0;
    row.reserved = options.reserved[row.ticker] ?? 0;
    row.onOrder = options.onOrder[row.ticker] ?? 0;
    row.available = row.hrt - row.reserved + row.onOrder;
    row.missing = Math.max(0, Math.ceil(row.totalNeed - row.available));
    for (const base of producerBases) {
      const mat = base.burn[row.ticker] as MaterialBurn | undefined;
      if (mat !== undefined && mat.dailyAmount > 0) {
        row.producers.push({
          name: base.name,
          daily: mat.dailyAmount,
          stock: mat.inventory + (mat.warehouseInventory ?? 0),
        });
      }
    }
    row.producers.sort((a, b) => b.daily - a.daily);
  }

  return [...rows.values()].sort((a, b) => {
    if (a.minDays !== b.minDays) {
      return a.minDays - b.minDays;
    }
    return a.ticker.localeCompare(b.ticker);
  });
}

// Smallest bay that carries the whole load, or the number of HCB trips.
export function suggestShip(weight: number, volume: number) {
  if (weight <= 0 && volume <= 0) {
    return '';
  }
  for (const bay of SUPPLY_BAYS) {
    if (weight <= bay.weight && volume <= bay.volume) {
      return bay.label;
    }
  }
  const largest = SUPPLY_BAYS[SUPPLY_BAYS.length - 1];
  const trips = Math.ceil(Math.max(weight / largest.weight, volume / largest.volume));
  return `${trips}× ${largest.label}`;
}

// Per-base totals for the footer, bases ordered by urgency.
export function summarizeBases(
  bases: SupplyBase[],
  rows: SupplyRow[],
  size: (ticker: string) => UnitSize | undefined,
): BaseSummary[] {
  return bases
    .map(base => {
      let inputs = 0;
      let weight = 0;
      let volume = 0;
      let minDays = Number.POSITIVE_INFINITY;
      for (const row of rows) {
        const cell = row.cells[base.naturalId] as SupplyCell | undefined;
        if (cell === undefined) {
          continue;
        }
        minDays = Math.min(minDays, cell.daysAll);
        if (cell.need <= 0) {
          continue;
        }
        inputs++;
        const unit = size(row.ticker);
        if (unit) {
          weight += unit.weight * cell.need;
          volume += unit.volume * cell.need;
        }
      }
      return {
        naturalId: base.naturalId,
        name: base.name,
        inputs,
        weight,
        volume,
        minDays,
        ship: suggestShip(weight, volume),
      };
    })
    .filter(x => Number.isFinite(x.minDays) || x.inputs > 0)
    .sort((a, b) =>
      a.minDays !== b.minDays ? a.minDays - b.minDays : a.name.localeCompare(b.name),
    );
}

// ----- Contracts -----

export interface ContractLine {
  contract: string;
  partner: string;
  amount: number;
}

export interface ContractFlows {
  reserved: Record<string, number>;
  onOrder: Record<string, number>;
  reservedLines: Record<string, ContractLine[]>;
  onOrderLines: Record<string, ContractLine[]>;
}

// Contracts in force: accepted by both sides and not finished.
const ACTIVE_CONTRACTS = new Set<string>(['CLOSED', 'PARTIALLY_FULFILLED']);
const INBOUND_TYPES = new Set<string>(['PROVISION', 'DELIVERY', 'DELIVERY_SHIPMENT']);
const OUTBOUND_TYPES = new Set<string>(['PROVISION', 'DELIVERY', 'PROVISION_SHIPMENT']);

function add(
  totals: Record<string, number>,
  lines: Record<string, ContractLine[]>,
  ticker: string,
  line: ContractLine,
) {
  if (line.amount <= 0) {
    return;
  }
  totals[ticker] = (totals[ticker] ?? 0) + line.amount;
  (lines[ticker] ??= []).push(line);
}

// Reads open contracts for material flows at one location:
// - on order: materials a partner still has to bring there, or that wait for my pickup;
// - reserved: materials I still have to provide from there.
export function getContractFlows(
  contracts: PrunApi.Contract[],
  location: string,
  naturalIdOf: (address?: PrunApi.Address | null) => string | undefined,
): ContractFlows {
  const flows: ContractFlows = { reserved: {}, onOrder: {}, reservedLines: {}, onOrderLines: {} };
  for (const contract of contracts) {
    if (!ACTIVE_CONTRACTS.has(contract.status)) {
      continue;
    }
    const byId = new Map(contract.conditions.map(x => [x.id, x]));
    for (const condition of contract.conditions) {
      const quantity = condition.quantity;
      if (!quantity || condition.status === 'FULFILLED') {
        continue;
      }
      const ticker = quantity.material.ticker;
      const line = {
        contract: contract.localId,
        partner: contract.partner.name,
        amount: quantity.amount,
      };
      const mine = condition.party === contract.party;
      if (!mine && INBOUND_TYPES.has(condition.type)) {
        const where = naturalIdOf(condition.destination ?? condition.address);
        if (where === location) {
          add(flows.onOrder, flows.onOrderLines, ticker, line);
        }
      } else if (mine && OUTBOUND_TYPES.has(condition.type)) {
        if (naturalIdOf(condition.address) === location) {
          add(flows.reserved, flows.reservedLines, ticker, line);
        }
      } else if (mine && condition.type === 'PICKUP') {
        // Provided by the partner but not picked up yet: still to come in.
        const ready = condition.dependencies.every(id => byId.get(id)?.status === 'FULFILLED');
        if (ready && naturalIdOf(condition.address) === location) {
          const left = quantity.amount - (condition.pickedUp?.amount ?? 0);
          add(flows.onOrder, flows.onOrderLines, ticker, { ...line, amount: left });
        }
      }
    }
  }
  return flows;
}

// "C 2146, H 1979" for the #contrats Discord channel.
export function formatList(rows: SupplyRow[]) {
  return rows
    .filter(x => x.missing > 0)
    .map(x => `${x.ticker} ${x.missing}`)
    .join(', ');
}
