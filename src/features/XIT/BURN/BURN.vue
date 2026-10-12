<script setup lang="ts">
import CopyButton from '@src/components/CopyButton.vue';
import RadioItem from '@src/components/forms/RadioItem.vue';
import {
  BurnValues,
  clampNearZeroDailyAmount,
  getInboundShips,
  getResupplyDays,
  getPlanetBurn,
  MaterialBurn,
  PlanetBurn,
} from '@src/core/burn';
import { comparePlanets } from '@src/util';
import BurnSection from '@src/features/XIT/BURN/BurnSection.vue';
import { useTileState } from '@src/features/XIT/BURN/tile-state';
import { getContractInbound } from '@src/features/XIT/BURN/contract-inbound';
import { BURN_COLUMNS, useBurnColumns } from '@src/features/XIT/BURN/columns';
import PrunButton from '@src/components/PrunButton.vue';
import Tooltip from '@src/components/Tooltip.vue';
import LoadingSpinner from '@src/components/LoadingSpinner.vue';
import MaterialRow from '@src/features/XIT/BURN/MaterialRow.vue';
import { useXitParameters } from '@src/hooks/use-xit-parameters';
import { materialsStore } from '@src/infrastructure/prun-api/data/materials';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import {
  BurnSortKey,
  burnSortNaturalDesc,
  computeNeedAll,
  countDays,
  getBuyAmount,
  getDaysAll,
  getSortedTickers,
  getWarehouseAmounts,
  HRT_NATURAL_ID,
} from '@src/features/XIT/BURN/utils';
import InlineFlex from '@src/components/InlineFlex.vue';
import { findWithQuery } from '@src/utils/find-with-query';
import { convertToPlanetNaturalId } from '@src/core/planet-natural-id';

const parameters = useXitParameters();

// Fake site for overall burn.
const overall: PrunApi.Site = {} as PrunApi.Site;

const queryResult = computed(() => {
  if (!sitesStore.all.value) {
    return undefined;
  }

  const allSites = sitesStore.all.value;
  if (parameters.length === 0) {
    return {
      sites: allSites,
      includeOverall: true,
      overallOnly: false,
    };
  }
  const result = findWithQuery(parameters, findSites);
  let matches = result.include;
  if (result.includeAll) {
    matches = allSites;
  }
  if (result.excludeAll) {
    matches = [];
  }
  matches = matches.filter(x => !result.exclude.has(x));
  const nonOverallMatches = matches.filter(x => x !== overall);
  const overallIncluded =
    nonOverallMatches.length > 1 ||
    matches.length !== nonOverallMatches.length ||
    result.includeAll;
  const overallExcluded = result.exclude.has(overall) || result.excludeAll;

  let includeOverall = overallIncluded && !overallExcluded;
  let overallOnly = false;
  let overallOnlySites = allSites;
  if (matches.length === 1 && matches[0] === overall && !overallExcluded) {
    // `XIT BURN OVERALL`,
    overallOnlySites = allSites.filter(x => !result.exclude.has(x));
    includeOverall = true;
    overallOnly = true;
  }

  return {
    sites: overallOnly ? overallOnlySites : nonOverallMatches,
    includeOverall,
    overallOnly,
  };
});

function findSites(term: string, parts: string[]) {
  if (term === 'all') {
    return sitesStore.all.value;
  }

  if (term === 'overall') {
    return overall;
  }

  const naturalId = convertToPlanetNaturalId(term, parts);
  return sitesStore.getByPlanetNaturalId(naturalId);
}

const red = useTileState('red');
const yellow = useTileState('yellow');
const green = useTileState('green');
const inf = useTileState('inf');
const prod = useTileState('prod');
const wf = useTileState('wf');
const io = useTileState('io');
const excludeInbound = useTileState('excludeInbound');
const excludeContractInbound = useTileState('excludeContractInbound');
const sortBy = useTileState('sortBy');
const sortDesc = useTileState('sortDesc');
const showColumnPicker = useTileState('showColumnPicker');
const { show: showCol, toggle: toggleColumn } = useBurnColumns();
const hiddenCount = computed(() => BURN_COLUMNS.filter(x => !showCol.value[x.id]).length);

// Click cycle: natural direction -> reversed -> default order.
function onSortClick(key: BurnSortKey) {
  if (sortBy.value !== key) {
    sortBy.value = key;
    sortDesc.value = burnSortNaturalDesc[key];
  } else if (sortDesc.value === burnSortNaturalDesc[key]) {
    sortDesc.value = !sortDesc.value;
  } else {
    sortBy.value = '';
    sortDesc.value = false;
  }
}

function sortArrow(key: BurnSortKey) {
  if (sortBy.value !== key) {
    return '';
  }
  return sortDesc.value ? ' ▼' : ' ▲';
}

function filterBurn(burn: BurnValues, naturalId: string): BurnValues {
  const filtered: BurnValues = {};
  const warehouse = getWarehouseAmounts(naturalId);
  // Read live from the Hortus Station WAR store; reactive, so it refreshes on every change.
  const hrt = getWarehouseAmounts(HRT_NATURAL_ID);
  // Overall ('') sums the planets, which already include their partner ships.
  const contractInbound = getContractInbound(naturalId || undefined);
  for (const ticker of Object.keys(burn)) {
    const mat = {
      ...withWarehouse(burn[ticker], warehouse[ticker]),
      hrtInventory: hrt[ticker] ?? 0,
    };
    const hasProd = mat.input > 0 || mat.output > 0;
    const hasWf = mat.workforce > 0;
    if (!(hasProd && prod.value) && !(hasWf && wf.value)) {
      continue;
    }
    const ownShips = excludeInbound.value.includes(naturalId) ? 0 : mat.inboundInventory;
    const partnerShips = excludeContractInbound.value.includes(naturalId)
      ? 0
      : (contractInbound.totals[ticker] ?? 0);
    const inbound = ownShips + partnerShips;
    const remaining = mat.inventory + inbound + mat.remainingAllocation;
    filtered[ticker] = {
      ...mat,
      inboundInventory: inbound,
      contractInventory: partnerShips,
      daysLeft: mat.dailyAmount >= 0 ? Number.POSITIVE_INFINITY : remaining / -mat.dailyAmount,
    };
  }
  return filtered;
}

// Adds the planet warehouse stock. Without a value, the material is kept as is
// (the overall section already holds the summed warehouse stock).
function withWarehouse(mat: MaterialBurn, amount: number | undefined) {
  if (amount === undefined) {
    return mat;
  }
  return { ...mat, warehouseInventory: amount };
}

const planetBurn = computed(() => {
  if (queryResult.value === undefined) {
    return undefined;
  }

  const filtered = queryResult.value.sites
    .filter(x => x !== overall)
    .map(getPlanetBurn)
    .filter(x => x !== undefined)
    .map(x => ({
      ...x,
      burn: filterBurn(x.burn, x.naturalId),
      hasInboundShips: getInboundShips(x.naturalId).length > 0,
    }));
  if (filtered.length <= 1) {
    return filtered;
  }

  filtered.sort((a, b) => {
    const daysA = countDays(a.burn);
    const daysB = countDays(b.burn);
    if (daysA !== daysB) {
      return daysA - daysB;
    }
    return comparePlanets(a.naturalId, b.naturalId);
  });

  const overallBurn: BurnValues = {};
  for (const planet of filtered) {
    for (const ticker of Object.keys(planet.burn)) {
      const mat = planet.burn[ticker];
      overallBurn[ticker] ??= {
        input: 0,
        output: 0,
        workforce: 0,
        dailyAmount: 0,
        remainingAllocation: 0,
        inventory: 0,
        inboundInventory: 0,
        daysLeft: 0,
        type: 'output',
      };
      overallBurn[ticker].input += mat.input;
      overallBurn[ticker].output += mat.output;
      overallBurn[ticker].workforce += mat.workforce;
      overallBurn[ticker].remainingAllocation += mat.remainingAllocation;
      overallBurn[ticker].inventory += mat.inventory;
      overallBurn[ticker].inboundInventory += mat.inboundInventory;
      overallBurn[ticker].warehouseInventory =
        (overallBurn[ticker].warehouseInventory ?? 0) + (mat.warehouseInventory ?? 0);
    }
  }

  for (const ticker of Object.keys(overallBurn)) {
    const mat = overallBurn[ticker];
    mat.dailyAmount = clampNearZeroDailyAmount(mat.output - mat.input - mat.workforce);
    const remaining = mat.inventory + mat.inboundInventory + mat.remainingAllocation;
    mat.daysLeft = mat.dailyAmount >= 0 ? Number.POSITIVE_INFINITY : remaining / -mat.dailyAmount;
  }

  const overallSection = {
    hasInboundShips: filtered.some(x => x.hasInboundShips),
    burn: filterBurn(overallBurn, ''),
    planetName: 'Overall',
    naturalId: '',
    storeId: '',
  };

  if (queryResult.value.overallOnly) {
    return [overallSection];
  }
  const sections = filtered.slice();
  if (queryResult.value.includeOverall) {
    sections.push(overallSection);
  }
  return sections;
});

const fakeBurn: MaterialBurn = {
  dailyAmount: -100000,
  daysLeft: 10,
  remainingAllocation: 0,
  inventory: 100000,
  inboundInventory: 0,
  type: 'input',
  input: 100000,
  output: 100000,
  workforce: 0,
};

const rat = materialsStore.getByTicker('RAT')!;

const expand = useTileState('expand');

const anyExpanded = computed(() => expand.value.length > 0);

function onExpandAllClick() {
  if (expand.value.length > 0) {
    expand.value = [];
  } else {
    expand.value = planetBurn.value?.map(x => x.naturalId) ?? [];
  }
}

// Exports all materials regardless of active color filters (RED/YELLOW/GREEN/INF)
// so spreadsheet users always get the complete dataset.
function formatBurnTable(burns: PlanetBurn[]) {
  const header = io.value
    ? 'Planet\tTicker\tIn\tOut\tNet\tInv\tDays\tDays All\tNeed\tInv HRT\tBuy'
    : 'Planet\tTicker\tBurn/day\tInv\tDays\tDays All\tNeed\tInv HRT\tBuy';
  const lines = [header];
  const round = (x: number) => Math.round(x * 1000) / 1000;
  for (const planet of burns) {
    const sorted = getSortedTickers(planet);
    for (const material of sorted) {
      const mat = planet.burn[material.ticker];
      const days = mat.dailyAmount >= 0 ? '' : Math.floor(mat.daysLeft).toString();
      const daysAll = mat.dailyAmount >= 0 ? '' : Math.floor(getDaysAll(mat)).toString();
      const burn = round(mat.dailyAmount);
      const inv = mat.inventory + mat.inboundInventory + mat.remainingAllocation;
      const invHrt = mat.hrtInventory ?? 0;
      const resupply = getResupplyDays(planet.naturalId || undefined);
      const need = computeNeedAll(mat, resupply);
      const buy = getBuyAmount(mat, resupply);
      if (io.value) {
        const inAmt = round(mat.input + mat.workforce);
        const outAmt = round(mat.output);
        lines.push(
          `${planet.planetName}\t${material.ticker}\t${inAmt}\t${outAmt}\t${burn}\t${inv}\t${days}\t${daysAll}\t${need}\t${invHrt}\t${buy}`,
        );
      } else {
        lines.push(
          `${planet.planetName}\t${material.ticker}\t${burn}\t${inv}\t${days}\t${daysAll}\t${need}\t${invHrt}\t${buy}`,
        );
      }
    }
  }
  return lines.join('\n');
}

function copyBurnTable() {
  if (!planetBurn.value) {
    return '';
  }
  return formatBurnTable(planetBurn.value);
}
</script>

<template>
  <LoadingSpinner v-if="planetBurn === undefined" />
  <template v-else>
    <div :class="C.ComExOrdersPanel.filter">
      <RadioItem v-model="red" horizontal>RED</RadioItem>
      <RadioItem v-model="yellow" horizontal>YELLOW</RadioItem>
      <RadioItem v-model="green" horizontal>GREEN</RadioItem>
      <RadioItem v-model="inf" horizontal>INF</RadioItem>
      <div :class="$style.separator" />
      <RadioItem
        v-model="prod"
        horizontal
        :class="$style.radioItemWithTooltip"
        data-tooltip="Toggle materials with production consumption. When off, hides materials only used in production."
        data-tooltip-position="bottom">
        PROD
      </RadioItem>
      <RadioItem
        v-model="wf"
        horizontal
        :class="$style.radioItemWithTooltip"
        data-tooltip="Toggle materials with workforce consumption. When off, hides materials only consumed by workforce."
        data-tooltip-position="bottom">
        WF
      </RadioItem>
      <div :class="$style.separator" />
      <RadioItem v-model="io" horizontal>I/O</RadioItem>
      <div :class="$style.separator" />
      <PrunButton
        dark
        inline
        data-tooltip="Show or hide columns in this tile"
        data-tooltip-position="bottom"
        @click="showColumnPicker = !showColumnPicker">
        COLS{{ hiddenCount > 0 ? ` (${hiddenCount} hidden)` : '' }}
      </PrunButton>
      <div :class="$style.spacer" />
      <CopyButton :copy-fn="copyBurnTable" data-tooltip-position="bottom" />
    </div>
    <div v-if="showColumnPicker" :class="[C.ComExOrdersPanel.filter, $style.columnPicker]">
      <span :class="$style.pickerLabel">Columns</span>
      <RadioItem
        v-for="col in BURN_COLUMNS"
        :key="col.id"
        :model-value="showCol[col.id]"
        horizontal
        @update:model-value="toggleColumn(col.id)">
        {{ col.label }}
      </RadioItem>
    </div>
    <table>
      <thead>
        <tr>
          <th v-if="planetBurn.length > 1" :class="$style.expand" @click="onExpandAllClick">
            {{ anyExpanded ? '-' : '+' }}
          </th>
          <th v-else />
          <template v-if="showCol.burn && io">
            <th>In</th>
            <th>Out</th>
            <th :class="$style.sortable" @click="onSortClick('burn')"
              >Net{{ sortArrow('burn') }}</th
            >
          </template>
          <th v-else-if="showCol.burn" :class="$style.sortable" @click="onSortClick('burn')">
            <InlineFlex>
              Burn{{ sortArrow('burn') }}
              <Tooltip position="bottom" tooltip="How much of a material is consumed per day." />
            </InlineFlex>
          </th>
          <th v-if="showCol.inv" :class="$style.sortable" @click="onSortClick('inv')">
            <InlineFlex>
              Inv{{ sortArrow('inv') }}
              <Tooltip
                position="right"
                tooltip="Stock at the base plus cargo on inbound ships when enabled. Fractional amount
                 represents the leftover materials since the last workforce consumption event." />
            </InlineFlex>
          </th>
          <th v-if="showCol.days" :class="$style.sortable" @click="onSortClick('days')">
            Days{{ sortArrow('days') }}
          </th>
          <th v-if="showCol.daysAll" :class="$style.sortable" @click="onSortClick('daysAll')">
            <span data-tooltip="Days left with the stock of the warehouse on the same planet."
              >Days All{{ sortArrow('daysAll') }}</span
            >
          </th>
          <th
            v-if="showCol.need"
            :class="[$style.sortable, $style.supplyStart]"
            @click="onSortClick('need')">
            <InlineFlex>
              Need{{ sortArrow('need') }}
              <Tooltip
                position="bottom"
                tooltip="How much to deliver to reach the resupply target, counting the base, inbound
                 cargo and the warehouse on the same planet (same basis as Days All)." />
            </InlineFlex>
          </th>
          <th v-if="showCol.invHrt" :class="$style.sortable" @click="onSortClick('invHrt')">
            <span
              data-tooltip="Stock available in your warehouse (WAR) at Hortus Station, updated live. Red when it cannot cover the need."
              >INV HRT{{ sortArrow('invHrt') }}</span
            >
          </th>
          <th v-if="showCol.buy" :class="$style.sortable" @click="onSortClick('buy')">
            <span
              data-tooltip="Part of the need that Hortus Station cannot cover: the amount to buy."
              >Buy{{ sortArrow('buy') }}</span
            >
          </th>
          <th>CMD</th>
        </tr>
      </thead>
      <tbody :class="$style.fakeRow">
        <MaterialRow always-visible :burn="fakeBurn" :material="rat" />
      </tbody>
      <BurnSection
        v-for="burn in planetBurn"
        :key="burn.planetName"
        :can-minimize="planetBurn.length > 1"
        :has-inbound-ships="burn.hasInboundShips"
        :burn="burn" />
    </table>
  </template>
</template>

<style module>
.fakeRow {
  visibility: collapse;
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

.expand {
  text-align: center;
  cursor: pointer;
  user-select: none;
  font-size: 12px;
  padding-left: 18px;
  font-weight: bold;
}

.sortable {
  cursor: pointer;
  user-select: none;
}

.supplyStart {
  border-left: 1px solid #2b485a;
}

.columnPicker {
  flex-wrap: wrap;
}

.pickerLabel {
  color: #888;
  font-size: 11px;
  margin: 0 4px;
}

.radioItemWithTooltip {
  padding: 0;
}
</style>
