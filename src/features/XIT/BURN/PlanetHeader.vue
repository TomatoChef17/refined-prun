<script setup lang="ts">
import DaysCell from '@src/features/XIT/BURN/DaysCell.vue';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import PrunButton from '@src/components/PrunButton.vue';
import { PlanetBurn } from '@src/core/burn';
import { countDays, countDaysAll } from '@src/features/XIT/BURN/utils';
import { planetContextMenu } from '@src/components/planet-context-menu/planet-context-menu';
import { useTileState } from '@src/features/XIT/BURN/tile-state';
import { useBurnColumns } from '@src/features/XIT/BURN/columns';
import {
  getContractInbound,
  getPurchaseContractInbound,
} from '@src/features/XIT/BURN/contract-inbound';
import fa from '@src/utils/font-awesome.module.css';

const { burn } = defineProps<{
  burn: PlanetBurn;
  hasInboundShips: boolean;
  hasMinimize?: boolean;
  minimized?: boolean;
  onClick: () => void;
}>();

const excludeInbound = useTileState('excludeInbound');
const includesInbound = computed(() => !excludeInbound.value.includes(burn.naturalId));
const inboundTooltip = computed(() =>
  includesInbound.value
    ? 'Includes inbound cargo. Click to exclude it.'
    : 'Excludes inbound cargo. Click to include it.',
);
const days = computed(() => countDays(burn.burn));
const daysAll = computed(() => countDaysAll(burn.burn));
const { show, nameColspan, actionColspan } = useBurnColumns();

// Partner ships delivering here under an accepted shipping contract (purple icon).
const excludeContractInbound = useTileState('excludeContractInbound');
const contractInbound = computed(() => getContractInbound(burn.naturalId || undefined));
const hasContractInbound = computed(() => contractInbound.value.lines.length > 0);
const includesContractInbound = computed(
  () => !excludeContractInbound.value.includes(burn.naturalId),
);
const contractInboundTooltip = computed(() => {
  const lines = contractInbound.value.lines.map(
    x => `${x.contract} ${x.partner}: ${x.amount} ${x.ticker}`,
  );
  const action = includesContractInbound.value
    ? 'Counted. Click to exclude it.'
    : 'Not counted. Click to include it.';
  return `Partner ship(s): ${lines.join(' · ')} — ${action}`;
});

function toggleContractInbound() {
  excludeContractInbound.value = includesContractInbound.value
    ? [...excludeContractInbound.value, burn.naturalId]
    : excludeContractInbound.value.filter(x => x !== burn.naturalId);
}

// Goods sellers deliver here under an accepted purchase contract (blue cart icon).
const excludePurchaseInbound = useTileState('excludePurchaseInbound');
const purchaseInbound = computed(() => getPurchaseContractInbound(burn.naturalId || undefined));
const hasPurchaseInbound = computed(() => purchaseInbound.value.lines.length > 0);
const includesPurchaseInbound = computed(
  () => !excludePurchaseInbound.value.includes(burn.naturalId),
);
const purchaseInboundTooltip = computed(() => {
  const lines = purchaseInbound.value.lines.map(
    x => `${x.contract} ${x.partner}: ${x.amount} ${x.ticker}`,
  );
  const action = includesPurchaseInbound.value
    ? 'Counted in Inv and Days. Click to exclude it.'
    : 'Not counted. Click to include it.';
  return `Bought, not delivered yet (purchase contracts): ${lines.join(' · ')} — ${action}`;
});

function togglePurchaseInbound() {
  excludePurchaseInbound.value = includesPurchaseInbound.value
    ? [...excludePurchaseInbound.value, burn.naturalId]
    : excludePurchaseInbound.value.filter(x => x !== burn.naturalId);
}

// Managed base: someone else supplies the production inputs.
const managedProduction = useTileState('managedProduction');
const isManaged = computed(() => managedProduction.value.includes(burn.naturalId));
const managedTooltip = computed(() =>
  isManaged.value
    ? 'Managed production: inputs are supplied by someone else, so they are ignored here. Only workforce materials count in Days. Click to count production inputs again.'
    : 'Production inputs are counted. Click if someone else supplies this base (managed base): only workforce materials will count in Days.',
);

function toggleManaged() {
  managedProduction.value = isManaged.value
    ? managedProduction.value.filter(x => x !== burn.naturalId)
    : [...managedProduction.value, burn.naturalId];
}

function toggleInbound() {
  excludeInbound.value = includesInbound.value
    ? [...excludeInbound.value, burn.naturalId]
    : excludeInbound.value.filter(x => x !== burn.naturalId);
}
</script>

<template>
  <tr :class="$style.row">
    <td
      :colspan="nameColspan"
      :class="$style.cell"
      @click="onClick"
      @contextmenu.prevent="burn.naturalId && planetContextMenu.showMenu($event, burn.naturalId)">
      <span v-if="hasMinimize" :class="$style.minimize">
        {{ minimized ? '+' : '-' }}
      </span>
      <span>{{ burn.planetName }}</span>
      <button
        v-if="burn.naturalId"
        type="button"
        :class="[$style.managed, { [$style.managedOn]: isManaged }]"
        :data-tooltip="managedTooltip"
        :aria-label="managedTooltip"
        :aria-pressed="isManaged"
        @click.stop="toggleManaged">
        <span :class="fa.solid">{{ '\uf275' }}</span>
        {{ isManaged ? 'PROD MANAGED' : '' }}
      </button>
      <button
        v-if="hasInboundShips"
        type="button"
        :class="[fa.solid, $style.inbound, { [$style.inboundExcluded]: !includesInbound }]"
        :data-tooltip="inboundTooltip"
        :aria-label="inboundTooltip"
        :aria-pressed="includesInbound"
        @click.stop="toggleInbound">
        {{ '\uf135' }}
      </button>
      <button
        v-if="hasContractInbound"
        type="button"
        :class="[
          fa.solid,
          $style.inbound,
          $style.partnerShip,
          { [$style.inboundExcluded]: !includesContractInbound },
        ]"
        :data-tooltip="contractInboundTooltip"
        :aria-label="contractInboundTooltip"
        :aria-pressed="includesContractInbound"
        @click.stop="toggleContractInbound">
        {{ '\uf135' }}
      </button>
      <button
        v-if="hasPurchaseInbound"
        type="button"
        :class="[
          fa.solid,
          $style.inbound,
          $style.purchase,
          { [$style.inboundExcluded]: !includesPurchaseInbound },
        ]"
        :data-tooltip="purchaseInboundTooltip"
        :aria-label="purchaseInboundTooltip"
        :aria-pressed="includesPurchaseInbound"
        @click.stop="togglePurchaseInbound">
        {{ '\uf07a' }}
      </button>
    </td>
    <DaysCell v-if="show.days" :days="days" />
    <DaysCell v-if="show.daysAll" :days="daysAll" />
    <td :colspan="actionColspan">
      <div :class="$style.buttons">
        <PrunButton dark inline @click="showBuffer(`BS ${burn.naturalId}`)">BS</PrunButton>
        <PrunButton dark inline @click="showBuffer(`INV ${burn.storeId.substring(0, 8)}`)">
          INV
        </PrunButton>
        <PrunButton dark inline @click="showBuffer(`XIT BURNACT ${burn.naturalId}`)">
          ACT
        </PrunButton>
      </div>
    </td>
  </tr>
</template>

<style module>
.row {
  border-bottom: 1px solid #2b485a;
}

.cell {
  font-weight: bold;
  font-size: 12px;
  cursor: pointer;
}

.minimize {
  display: inline-block;
  width: 26px;
  text-align: center;
}

.inbound {
  float: right;
  border: 0;
  padding: 0;
  background: none;
  color: inherit;
  cursor: pointer;
  font-size: 12px;
  line-height: inherit;
}

/* Partner ship under a shipping contract: purple, next to my own (white) ship. */
.partnerShip {
  color: #b57edc;
  margin-right: 6px;
}

/* Goods bought under a purchase contract: blue cart. */
.purchase {
  color: #3fa2de;
  margin-right: 6px;
}

/* Managed production toggle, next to the planet name. */
.managed {
  margin-left: 8px;
  border: 0;
  padding: 0 4px;
  background: none;
  color: #555;
  cursor: pointer;
  font-size: 10px;
  font-weight: bold;
  line-height: inherit;
}

.managedOn {
  color: #f7a600;
  border: 1px solid #f7a600;
  border-radius: 2px;
}

.inboundExcluded {
  color: #666;
}

.buttons {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  column-gap: 0.25rem;
  justify-content: flex-end;
}
</style>
