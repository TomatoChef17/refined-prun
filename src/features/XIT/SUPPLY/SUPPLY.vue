<script setup lang="ts">
import RadioItem from '@src/components/forms/RadioItem.vue';
import PrunButton from '@src/components/PrunButton.vue';
import LoadingSpinner from '@src/components/LoadingSpinner.vue';
import MaterialIcon from '@src/components/MaterialIcon.vue';
import { BurnValues, getPlanetBurn, getResupplyDays } from '@src/core/burn';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { contractsStore } from '@src/infrastructure/prun-api/data/contracts';
import { materialsStore } from '@src/infrastructure/prun-api/data/materials';
import { getEntityNaturalIdFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { getPrice } from '@src/infrastructure/fio/cx';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { userData } from '@src/store/user-data';
import { useClipboard } from '@src/hooks/use-clipboard';
import { fixed0, fixed1 } from '@src/utils/format';
import {
  formatBurnDays,
  getBurnThresholds,
  getWarehouseAmounts,
  HRT_NATURAL_ID,
} from '@src/features/XIT/BURN/utils';
import {
  getContractInbound,
  getPurchaseContractInbound,
} from '@src/features/XIT/BURN/contract-inbound';
import { useTileState } from './tile-state';
import ReserveCell from './ReserveCell.vue';
import {
  buildSupplyRows,
  getContractFlows,
  Producer,
  summarizeBases,
  SupplyBase,
  SupplyRow,
} from './supply-calc';

const $style = useCssModule();

const TARGETS = ['SET', '7', '10', '14', '21'];
const target = useTileState('target');
const show = useTileState('show');
const prod = useTileState('prod');
const wf = useTileState('wf');
const perDay = useTileState('perDay');
const buyContracts = useTileState('buyContracts');
const unchecked = useTileState('unchecked');

function targetModel(value: string) {
  return computed({
    get: () => target.value === value,
    set: (on: boolean) => {
      if (on) {
        target.value = value;
      }
    },
  });
}
const targetModels = Object.fromEntries(TARGETS.map(x => [x, targetModel(x)]));

function showModel(value: string) {
  return computed({
    get: () => show.value === value,
    set: (on: boolean) => {
      if (on) {
        show.value = value;
      }
    },
  });
}
const showMissing = showModel('MISSING');
const showNeed = showModel('NEED');
const showAll = showModel('ALL');

function resupplyDaysFor(naturalId: string) {
  return target.value === 'SET' ? getResupplyDays(naturalId) : Number(target.value);
}

// Adds the planet warehouse stock and the cargo partner ships are bringing
// under accepted shipping contracts, as XIT BURN does.
function withWarehouse(burn: BurnValues, naturalId: string): BurnValues {
  const warehouse = getWarehouseAmounts(naturalId);
  const partner = getContractInbound(naturalId).totals;
  const bought = buyContracts.value ? getPurchaseContractInbound(naturalId).totals : {};
  const result: BurnValues = {};
  for (const [ticker, mat] of Object.entries(burn)) {
    const partnerShips = partner[ticker] ?? 0;
    const purchases = bought[ticker] ?? 0;
    result[ticker] = {
      ...mat,
      warehouseInventory: warehouse[ticker] ?? 0,
      inboundInventory: mat.inboundInventory + partnerShips + purchases,
      contractInventory: partnerShips,
      purchaseInventory: purchases,
    };
  }
  return result;
}

const allBases = computed<SupplyBase[] | undefined>(() => {
  const sites = sitesStore.all.value;
  if (!sites) {
    return undefined;
  }
  return sites
    .map(getPlanetBurn)
    .filter(x => x !== undefined)
    .map(x => ({
      naturalId: x.naturalId,
      name: x.planetName,
      burn: withWarehouse(x.burn, x.naturalId),
      resupplyDays: resupplyDaysFor(x.naturalId),
    }));
});

const excluded = computed(() => new Set(userData.supply.excluded));
const includedBases = computed(() =>
  (allBases.value ?? []).filter(x => !excluded.value.has(x.naturalId)),
);
const excludedBases = computed(() =>
  (allBases.value ?? []).filter(x => excluded.value.has(x.naturalId)),
);

const flows = computed(() =>
  getContractFlows(contractsStore.all.value ?? [], HRT_NATURAL_ID, getEntityNaturalIdFromAddress),
);

const reserved = computed(() => {
  const totals: Record<string, number> = { ...flows.value.reserved };
  for (const [ticker, amount] of Object.entries(userData.supply.reserved)) {
    totals[ticker] = (totals[ticker] ?? 0) + amount;
  }
  return totals;
});

const allRows = computed(() =>
  buildSupplyRows(includedBases.value, allBases.value ?? [], {
    prod: prod.value,
    wf: wf.value,
    hrt: getWarehouseAmounts(HRT_NATURAL_ID),
    reserved: reserved.value,
    onOrder: flows.value.onOrder,
    anyUse: perDay.value,
  }),
);

const rows = computed(() => {
  // Per-day view: every input used somewhere, most used first.
  if (perDay.value) {
    return allRows.value
      .filter(x => x.totalUse > 0)
      .sort((a, b) =>
        b.totalUse !== a.totalUse ? b.totalUse - a.totalUse : a.ticker.localeCompare(b.ticker),
      );
  }
  switch (show.value) {
    case 'MISSING':
      return allRows.value.filter(x => x.missing > 0);
    case 'ALL':
      return allRows.value;
    default:
      return allRows.value.filter(x => x.totalNeed > 0);
  }
});

const size = (ticker: string) => {
  const material = materialsStore.getByTicker(ticker);
  return material ? { weight: material.weight, volume: material.volume } : undefined;
};

// Base columns, most urgent first.
const columns = computed(() => summarizeBases(includedBases.value, allRows.value, size));

const missingRows = computed(() => allRows.value.filter(x => x.missing > 0));
const isChecked = (ticker: string) => !unchecked.value.includes(ticker);

function toggleRow(ticker: string) {
  unchecked.value = isChecked(ticker)
    ? [...unchecked.value, ticker]
    : unchecked.value.filter(x => x !== ticker);
}

const allChecked = computed(() => missingRows.value.every(x => isChecked(x.ticker)));

function toggleAll() {
  unchecked.value = allChecked.value ? missingRows.value.map(x => x.ticker) : [];
}

const checkedMissing = computed(() => missingRows.value.filter(x => isChecked(x.ticker)));

const { copied, copy } = useClipboard();

async function copyList() {
  await copy(checkedMissing.value.map(x => `${x.ticker} ${x.missing}`).join(', '));
}

const missingValue = computed(() => {
  let total = 0;
  for (const row of missingRows.value) {
    total += (getPrice(row.ticker) ?? 0) * row.missing;
  }
  return total;
});

const mostUrgent = computed(() => {
  const base = columns.value.at(0);
  if (base === undefined || !Number.isFinite(base.minDays)) {
    return undefined;
  }
  const row = allRows.value
    .filter(x => base.naturalId in x.cells)
    .sort((a, b) => a.cells[base.naturalId].daysAll - b.cells[base.naturalId].daysAll)[0];
  return { name: base.name, ticker: row?.ticker, days: base.minDays };
});

function exclude(naturalId: string) {
  if (!userData.supply.excluded.includes(naturalId)) {
    userData.supply.excluded.push(naturalId);
  }
}

function include(naturalId: string) {
  userData.supply.excluded = userData.supply.excluded.filter(x => x !== naturalId);
}

function daysClass(days: number) {
  if (!Number.isFinite(days)) {
    return undefined;
  }
  const { isRed, isYellow } = getBurnThresholds(days);
  return isRed ? 'red' : isYellow ? 'yellow' : undefined;
}

function cellTooltip(row: SupplyRow, naturalId: string) {
  const cell = row.cells[naturalId];
  const parts = [
    `base ${fixed0(cell.inventory)}`,
    `WAR ${fixed0(cell.warehouse)}`,
    `inbound ${fixed0(cell.inbound)}`,
    `${fixed0(-cell.dailyAmount)}/d`,
    `${formatBurnDays(cell.daysAll)} d left`,
  ];
  return parts.join(' · ');
}

function useOf(row: SupplyRow, naturalId: string) {
  const cell = row.cells[naturalId] as SupplyRow['cells'][string] | undefined;
  return cell ? cell.prodUse + cell.wfUse : 0;
}

function useTooltip(row: SupplyRow, naturalId: string) {
  const cell = row.cells[naturalId];
  const parts: string[] = [];
  if (cell.prodUse > 0) {
    parts.push(`Production ${fixed1(cell.prodUse)}/d`);
  }
  if (cell.wfUse > 0) {
    parts.push(`Workers ${fixed1(cell.wfUse)}/d`);
  }
  const net = cell.dailyAmount;
  parts.push(net >= 0 ? `net +${fixed1(net)}/d (made here)` : `net ${fixed1(net)}/d`);
  if (net < 0) {
    parts.push(`${formatBurnDays(cell.daysAll)} d left`);
  }
  return parts.join(' · ');
}

function hrtTooltip(row: SupplyRow) {
  return (
    `stock ${fixed0(row.hrt)} − reserved ${fixed0(row.reserved)} + on order ` +
    `${fixed0(row.onOrder)} = ${fixed0(row.available)} available`
  );
}

function onOrderTooltip(ticker: string) {
  const lines = flows.value.onOrderLines[ticker] ?? [];
  return lines.map(x => `${x.contract} ${x.partner}: ${fixed0(x.amount)}`).join(' · ');
}

function formatProducer(p: Producer) {
  return `${p.name} +${fixed0(p.daily)}/d · ${fixed0(p.stock)}`;
}

// Reading aid: the row and base column under the mouse light up, and a click pins a row.
const hoverRow = ref<string | undefined>();
const hoverCol = ref<string | undefined>();
const pinnedRow = ref<string | undefined>();

function onTableOver(e: MouseEvent) {
  const target = e.target as HTMLElement;
  hoverRow.value = target.closest<HTMLElement>('tr')?.dataset.row;
  hoverCol.value = target.closest<HTMLElement>('td, th')?.dataset.col;
}

function onTableLeave() {
  hoverRow.value = undefined;
  hoverCol.value = undefined;
}

function onRowClick(e: MouseEvent, ticker: string) {
  // Checkboxes and the reserve editor keep their own click.
  if ((e.target as HTMLElement).closest('input, [data-no-pin]')) {
    return;
  }
  pinnedRow.value = pinnedRow.value === ticker ? undefined : ticker;
}

function rowClass(ticker: string) {
  return {
    [$style.rowHover]: hoverRow.value === ticker,
    [$style.rowPinned]: pinnedRow.value === ticker,
  };
}

function colClass(naturalId: string) {
  return { [$style.colHover]: hoverCol.value === naturalId };
}

function formatWeight(value: number) {
  return value >= 100 ? fixed0(value) : value.toFixed(1);
}
</script>

<template>
  <LoadingSpinner v-if="allBases === undefined" />
  <template v-else>
    <div :class="[C.ComExOrdersPanel.filter, $style.bar]">
      <span :class="$style.label">Target</span>
      <RadioItem v-for="t in TARGETS" :key="t" v-model="targetModels[t].value" horizontal>
        {{ t === 'SET' ? 'SET' : `${t}d` }}
      </RadioItem>
      <div :class="$style.separator" />
      <RadioItem
        v-model="showMissing"
        horizontal
        data-tooltip="Only inputs HRT cannot cover: to buy or bring from my bases."
        data-tooltip-position="bottom">
        MISSING
      </RadioItem>
      <RadioItem
        v-model="showNeed"
        horizontal
        data-tooltip="Inputs at least one base needs to reach the target, even if HRT covers them."
        data-tooltip-position="bottom">
        NEED
      </RadioItem>
      <RadioItem
        v-model="showAll"
        horizontal
        data-tooltip="Every input my bases consume, even with nothing to deliver."
        data-tooltip-position="bottom">
        ALL
      </RadioItem>
      <div :class="$style.separator" />
      <RadioItem
        v-model="perDay"
        horizontal
        data-tooltip="Show the units each base uses per day, for every input, instead of the need."
        data-tooltip-position="bottom">
        /DAY
      </RadioItem>
      <RadioItem
        v-model="prod"
        horizontal
        data-tooltip="Inputs of production lines."
        data-tooltip-position="bottom">
        PROD
      </RadioItem>
      <RadioItem
        v-model="wf"
        horizontal
        data-tooltip="Consumables of the workforce."
        data-tooltip-position="bottom">
        WF
      </RadioItem>
      <div :class="$style.separator" />
      <RadioItem
        v-model="buyContracts"
        horizontal
        data-tooltip="Count goods bought under accepted purchase contracts (BUY) that the seller has not delivered to the base yet. Turn off to ignore them."
        data-tooltip-position="bottom">
        BUY CONT
      </RadioItem>
      <div :class="$style.spacer" />
      <PrunButton
        primary
        :disabled="checkedMissing.length === 0"
        data-tooltip-position="bottom"
        :data-tooltip="
          copied ? 'Copied!' : 'Copy the checked missing inputs, e.g. for #contrats on Discord.'
        "
        @click="copyList">
        COPY LIST
      </PrunButton>
    </div>
    <div v-if="excludedBases.length > 0" :class="$style.hiddenBar">
      <span :class="$style.label">
        <span data-tooltip="Bases left out of the table. Click one to show it again.">
          Hidden bases
        </span>
      </span>
      <PrunButton
        v-for="base in excludedBases"
        :key="base.naturalId"
        dark
        inline
        data-tooltip="Show this base again"
        @click="include(base.naturalId)">
        + {{ base.name }}
      </PrunButton>
    </div>
    <div :class="$style.scroll">
      <table :class="$style.table" @mouseover="onTableOver" @mouseleave="onTableLeave">
        <thead>
          <tr>
            <th :class="$style.check">
              <span
                v-if="missingRows.length > 0"
                data-tooltip="Inputs copied by COPY LIST. Only inputs missing at HRT can be copied.">
                <input type="checkbox" :checked="allChecked" @change="toggleAll" />
              </span>
            </th>
            <th :class="$style.left">
              <span data-tooltip="Click a row to pin it, click again to unpin">Input</span>
            </th>
            <th
              v-for="base in columns"
              :key="base.naturalId"
              :data-col="base.naturalId"
              :class="[$style.baseHead, colClass(base.naturalId)]">
              <div :class="$style.baseName" @click="showBuffer(`XIT BURN ${base.naturalId}`)">
                <span :data-tooltip="`${base.name} — open XIT BURN`">{{ base.name }}</span>
              </div>
              <div :class="$style.baseSub">
                <span :class="[$style.baseDays, $style[daysClass(base.minDays) ?? 'none']]">
                  {{ formatBurnDays(base.minDays) }}d
                </span>
                <span :class="$style.hide" @click="exclude(base.naturalId)">
                  <span data-tooltip="Hide this base">×</span>
                </span>
              </div>
            </th>
            <th :class="$style.sep">{{ perDay ? 'Σ /day' : 'Σ Need' }}</th>
            <th>HRT stock</th>
            <th>
              <span
                data-tooltip="Kept aside at HRT: open contracts I must still provide + manual reserve.">
                Reserved
              </span>
            </th>
            <th>
              <span data-tooltip="Coming to HRT through open contracts.">On order</span>
            </th>
            <th>Missing at HRT</th>
            <th :class="$style.left">I produce it</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.ticker"
            :data-row="row.ticker"
            :class="rowClass(row.ticker)"
            @click="onRowClick($event, row.ticker)">
            <td :class="$style.check">
              <input
                v-if="row.missing > 0"
                type="checkbox"
                :checked="isChecked(row.ticker)"
                @change="toggleRow(row.ticker)" />
              <span v-else :class="$style.zero">·</span>
            </td>
            <td :class="$style.icon">
              <MaterialIcon size="inline-table" :ticker="row.ticker" />
            </td>
            <template v-for="base in columns" :key="base.naturalId">
              <td
                v-if="perDay && useOf(row, base.naturalId) > 0"
                :data-col="base.naturalId"
                :class="[$style.need, colClass(base.naturalId)]">
                <span :data-tooltip="useTooltip(row, base.naturalId)">
                  {{ fixed1(useOf(row, base.naturalId)) }}
                </span>
              </td>
              <td
                v-else-if="perDay"
                :data-col="base.naturalId"
                :class="[$style.dot, colClass(base.naturalId)]" />
              <td
                v-else-if="(row.cells[base.naturalId]?.need ?? 0) > 0"
                :data-col="base.naturalId"
                :class="[
                  $style.need,
                  $style[daysClass(row.cells[base.naturalId].daysAll) ?? 'none'],
                  colClass(base.naturalId),
                ]">
                <span :data-tooltip="cellTooltip(row, base.naturalId)">
                  {{ fixed0(row.cells[base.naturalId].need) }}
                </span>
              </td>
              <td
                v-else-if="row.cells[base.naturalId]"
                :data-col="base.naturalId"
                :class="[$style.dot, colClass(base.naturalId)]">
                <span :data-tooltip="cellTooltip(row, base.naturalId)">·</span>
              </td>
              <td
                v-else
                :data-col="base.naturalId"
                :class="[$style.dot, colClass(base.naturalId)]" />
            </template>
            <td :class="[$style.sep, $style.total]">
              {{ perDay ? fixed1(row.totalUse) : fixed0(row.totalNeed) }}
            </td>
            <td
              :class="{
                [$style.short]: row.missing > 0,
                [$style.zero]: row.hrt === 0 && row.missing === 0,
              }">
              <span :data-tooltip="hrtTooltip(row)">{{ fixed0(row.hrt) }}</span>
            </td>
            <ReserveCell
              data-no-pin
              :ticker="row.ticker"
              :total="row.reserved"
              :lines="flows.reservedLines[row.ticker] ?? []" />
            <td>
              <span v-if="row.onOrder > 0" :data-tooltip="onOrderTooltip(row.ticker)">
                {{ fixed0(row.onOrder) }}
              </span>
              <span v-else :class="$style.zero">–</span>
            </td>
            <td v-if="row.missing > 0" :class="$style.missing">{{ fixed0(row.missing) }}</td>
            <td v-else :class="$style.ok">✓</td>
            <td :class="$style.producers">
              <span
                v-if="row.producers.length > 0"
                :data-tooltip="row.producers.map(formatProducer).join(' · ')">
                {{ row.producers[0].name }} +{{ fixed0(row.producers[0].daily) }}/d
                <span v-if="row.producers.length > 1" :class="$style.more">
                  +{{ row.producers.length - 1 }}
                </span>
              </span>
              <span v-else :class="$style.zero">—</span>
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td :colspan="columns.length + 8" :class="$style.emptyRow">
              Nothing to show with these filters.
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td />
            <td :class="$style.left">To deliver</td>
            <td
              v-for="base in columns"
              :key="base.naturalId"
              :data-col="base.naturalId"
              :class="[$style.footBase, colClass(base.naturalId)]">
              <template v-if="base.inputs > 0">
                <div>{{ base.inputs }} input{{ base.inputs > 1 ? 's' : '' }}</div>
                <div :class="$style.footSub">
                  {{ formatWeight(base.weight) }}t · {{ formatWeight(base.volume) }}m³
                </div>
                <div :class="$style.ship">{{ base.ship }}</div>
              </template>
              <span v-else :class="$style.zero">—</span>
            </td>
            <td :class="$style.sep" colspan="6" />
          </tr>
        </tfoot>
      </table>
    </div>
    <div :class="$style.summary">
      <span>
        Missing at HRT, value:
        <b :class="$style.red">{{ fixed0(missingValue) }}</b>
        <span :class="$style.zero"> (market price)</span>
      </span>
      <span>
        Inputs missing: <b>{{ missingRows.length }} / {{ allRows.length }}</b>
      </span>
      <span v-if="mostUrgent">
        Most urgent base: <b>{{ mostUrgent.name }}</b> ({{ mostUrgent.ticker }},
        {{ formatBurnDays(mostUrgent.days) }} d)
      </span>
    </div>
  </template>
</template>

<style module>
.bar {
  flex-wrap: wrap;
  row-gap: 2px;
}

.hiddenBar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px 4px;
  flex-wrap: wrap;
}

.label {
  color: #888;
  font-size: 11px;
  margin: 0 4px;
}

.spacer {
  flex: 1;
}

.separator {
  width: 1px;
  align-self: stretch;
  background-color: #2b485a;
  margin: 0 0.25rem;
}

.scroll {
  overflow-x: auto;
}

.table {
  width: 100%;
}

.table th,
.table td {
  text-align: right;
  white-space: nowrap;
  padding: 3px 6px;
}

/* One shade per row, so a line reads easily across many base columns. */
.table tbody tr:nth-child(even) td {
  background-color: rgba(255, 255, 255, 0.025);
}

/* Reading aid. Box shadows draw over the coloured need cells without moving anything. */
.table tbody tr {
  cursor: pointer;
}

.rowHover td {
  box-shadow:
    inset 0 1px 0 rgba(127, 179, 213, 0.6),
    inset 0 -1px 0 rgba(127, 179, 213, 0.6),
    inset 0 0 0 999px rgba(127, 179, 213, 0.1);
}

.rowPinned td {
  box-shadow:
    inset 0 1px 0 #f7a600,
    inset 0 -1px 0 #f7a600,
    inset 0 0 0 999px rgba(247, 166, 0, 0.1);
}

.colHover {
  box-shadow:
    inset 1px 0 0 rgba(127, 179, 213, 0.6),
    inset -1px 0 0 rgba(127, 179, 213, 0.6),
    inset 0 0 0 999px rgba(127, 179, 213, 0.1);
}

/* The cell being read: framed at the crossing of its row and base. */
.rowHover td.colHover {
  box-shadow:
    inset 0 0 0 2px #f7a600,
    inset 0 0 0 999px rgba(247, 166, 0, 0.18);
}

th.colHover {
  color: #fff;
}

/* The input of the active row stays visible, even when scrolled sideways. */
.rowHover .icon,
.rowPinned .icon {
  box-shadow: inset 3px 0 0 #f7a600;
}

.table .left {
  text-align: left;
}

.check {
  width: 18px;
  text-align: center !important;
}

.icon {
  width: 32px;
  padding: 0;
  text-align: left !important;
}

.baseHead {
  color: #7fb3d5;
  vertical-align: bottom;
  min-width: 52px;
}

.baseName {
  cursor: pointer;
  max-width: 80px;
  margin-left: auto;
  overflow: hidden;
  text-overflow: ellipsis;
}

.baseName:hover {
  text-decoration: underline;
}

.baseSub {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 2px;
}

.baseDays {
  font-size: 10px;
  color: #888;
}

.hide {
  cursor: pointer;
  color: #666;
  font-size: 11px;
}

.hide:hover {
  color: #d9534f;
}

.sep {
  border-left: 2px solid #2b485a;
}

.total {
  color: #fff;
  font-weight: bold;
}

.need {
  color: #ddd;
}

.need.red {
  color: #fff;
  background: rgba(217, 83, 79, 0.3);
}

.need.yellow {
  color: #f0d080;
  background: rgba(240, 173, 78, 0.12);
}

.baseDays.red {
  color: #d9534f;
}

.baseDays.yellow {
  color: #f0ad4e;
}

.dot {
  color: #444;
  text-align: center !important;
}

.short {
  color: #d9534f;
  font-weight: bold;
}

.missing {
  color: #fff;
  font-weight: bold;
  background: #8a2a27;
}

.ok {
  color: #5cb85c;
  text-align: center !important;
}

.producers {
  text-align: left !important;
  color: #5cb85c;
  font-size: 11px;
}

.more {
  color: #888;
}

.zero {
  color: #555;
}

.emptyRow {
  text-align: center !important;
  color: #777;
  padding: 8px;
}

.footBase {
  color: #7fb3d5;
  vertical-align: top;
  font-size: 11px;
  line-height: 1.3;
}

.footSub {
  color: #999;
}

.ship {
  color: #f7a600;
  font-weight: bold;
}

.summary {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  padding: 6px 8px;
  color: #aaa;
  font-size: 11px;
  border-top: 1px solid #333;
}

.summary b {
  color: #fff;
}

.summary .red {
  color: #d9534f;
}
</style>
