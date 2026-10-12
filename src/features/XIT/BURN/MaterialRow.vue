<script setup lang="ts">
import { getResupplyDays, MaterialBurn } from '@src/core/burn';
import MaterialIcon from '@src/components/MaterialIcon.vue';
import DaysCell from '@src/features/XIT/BURN/DaysCell.vue';
import { fixed0, fixed1, fixed2, trunc0, trunc01, trunc02 } from '@src/utils/format';
import { useTileState } from '@src/features/XIT/BURN/tile-state';
import { useBurnColumns } from '@src/features/XIT/BURN/columns';
import {
  computeNeedAll,
  getBurnThresholds,
  getBuyAmount,
  getDaysAll,
} from '@src/features/XIT/BURN/utils';
import PrunButton from '@src/components/PrunButton.vue';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';

const { alwaysVisible, burn, material, naturalId } = defineProps<{
  alwaysVisible?: boolean;
  burn: MaterialBurn;
  material: PrunApi.Material;
  naturalId?: string;
}>();

const production = computed(() => burn.dailyAmount);
const invAmount = computed(() => {
  const amount = burn.inventory + burn.inboundInventory + burn.remainingAllocation;
  // Truncate, don't round, so the shown amount never exceeds what you hold.
  if (amount >= 100) {
    return trunc0(amount);
  }
  if (amount >= 10) {
    return trunc01(amount);
  }
  return trunc02(amount);
});
const invWhole = computed(() => {
  const dot = invAmount.value.indexOf('.');
  return dot === -1 ? invAmount.value : invAmount.value.slice(0, dot);
});
const invFraction = computed(() => {
  const dot = invAmount.value.indexOf('.');
  return dot === -1 ? '' : invAmount.value.slice(dot);
});
const hrtAmount = computed(() => burn.hrtInventory ?? 0);
const hrtText = computed(() =>
  hrtAmount.value >= 100 ? trunc0(hrtAmount.value) : trunc01(hrtAmount.value),
);
const isInf = computed(() => production.value >= 0);
const days = computed(() => (isInf.value ? Number.POSITIVE_INFINITY : burn.daysLeft));

const daysAll = computed(() => getDaysAll(burn));

const thresholds = computed(() => getBurnThresholds(days.value));

const red = useTileState('red');
const yellow = useTileState('yellow');
const green = useTileState('green');
const inf = useTileState('inf');
const io = useTileState('io');
const { show } = useBurnColumns();

const isVisible = computed(() => {
  if (alwaysVisible) {
    return true;
  }
  if (isInf.value) {
    return inf.value;
  }
  const { isRed, isYellow, isGreen } = thresholds.value;
  return (isRed && red.value) || (isYellow && yellow.value) || (isGreen && green.value);
});

function formatAmount(value: number) {
  const abs = Math.abs(value);
  return abs >= 1000 ? fixed0(abs) : abs >= 100 ? fixed1(abs) : fixed2(abs);
}

const changeText = computed(() => {
  if (production.value === 0) {
    return 0;
  }
  const fixed = formatAmount(production.value);
  return production.value > 0 ? '+' + fixed : '-' + fixed;
});

const changeClass = computed(() => ({
  [C.ColoredValue.positive]: production.value > 0,
}));

const inAmount = computed(() => burn.input + burn.workforce);
const outAmount = computed(() => burn.output);

const inText = computed(() => (inAmount.value === 0 ? 0 : '-' + formatAmount(inAmount.value)));
const outText = computed(() => (outAmount.value === 0 ? 0 : '+' + formatAmount(outAmount.value)));

const outClass = computed(() => ({
  [C.ColoredValue.positive]: outAmount.value > 0,
}));

const resupplyDays = computed(() => getResupplyDays(naturalId));
const needAmt = computed(() => computeNeedAll(burn, resupplyDays.value));
const buyAmt = computed(() => getBuyAmount(burn, resupplyDays.value));
// HRT cannot cover the whole need.
const hrtShort = computed(() => buyAmt.value > 0);
</script>

<template>
  <tr v-if="isVisible">
    <td :class="$style.materialContainer">
      <MaterialIcon size="inline-table" :ticker="material.ticker" />
    </td>
    <template v-if="show.burn">
      <template v-if="io">
        <td>
          <span>{{ inText }}</span>
        </td>
        <td>
          <span :class="outClass">{{ outText }}</span>
        </td>
        <td>
          <span :class="changeClass">{{ changeText }}</span>
        </td>
      </template>
      <td v-else>
        <span :class="changeClass">{{ changeText }}</span>
      </td>
    </template>
    <td v-if="show.inv">
      <span
        :class="{ [$style.partner]: (burn.contractInventory ?? 0) > 0 }"
        :data-tooltip="
          (burn.contractInventory ?? 0) > 0
            ? `Includes ${fixed0(burn.contractInventory ?? 0)} on a partner ship`
            : undefined
        ">
        {{ invWhole }}<span :class="$style.fraction">{{ invFraction }}</span>
      </span>
    </td>
    <DaysCell v-if="show.days" :days="days" />
    <DaysCell v-if="show.daysAll" :days="daysAll" />
    <td v-if="show.need" :class="$style.supplyStart">
      <span :class="{ [$style.empty]: needAmt === 0 }">{{ fixed0(needAmt) }}</span>
    </td>
    <td v-if="show.invHrt">
      <span :class="{ [$style.empty]: hrtAmount === 0, [$style.short]: hrtShort }">
        {{ hrtText }}
      </span>
    </td>
    <td v-if="show.buy">
      <span v-if="buyAmt > 0" :class="$style.short">{{ fixed0(buyAmt) }}</span>
      <span v-else :class="$style.empty">–</span>
    </td>
    <td>
      <PrunButton dark inline @click="showBuffer(`CXM ${material.ticker}`)">CXM</PrunButton>
    </td>
  </tr>
</template>

<style module>
.materialContainer {
  width: 32px;
  padding: 0;
}

.empty {
  color: #666;
}

.short {
  color: #d9534f;
  font-weight: bold;
}

/* Separates the base situation from the resupply columns. */
.supplyStart {
  border-left: 1px solid #2b485a;
}

.partner {
  color: #b57edc;
}

.fraction {
  color: #999;
}
</style>
