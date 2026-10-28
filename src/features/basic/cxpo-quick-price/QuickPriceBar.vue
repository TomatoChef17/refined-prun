<script setup lang="ts">
import PrunButton from '@src/components/PrunButton.vue';
import { fixed2 } from '@src/utils/format';
import { QuickPrices } from './quick-price';

const { prices, onPick } = defineProps<{
  prices: QuickPrices;
  onPick: (price: number) => void;
}>();

const sellTooltip = computed(() => {
  if (prices.bestAsk === undefined) {
    return 'No other seller.';
  }
  const lines = [`Best other ask: ${fixed2(prices.bestAsk)}. Fills the price one tick lower.`];
  if (prices.sellCrosses) {
    lines.push('Warning: this price is at or under the best bid, so the order sells at once.');
  }
  return lines.join('\n');
});

const buyTooltip = computed(() => {
  if (prices.bestBid === undefined) {
    return 'No other buyer.';
  }
  const lines = [`Best other bid: ${fixed2(prices.bestBid)}. Fills the price one tick higher.`];
  if (prices.buyCrosses) {
    lines.push('Warning: this price is at or over the best ask, so the order buys at once.');
  }
  return lines.join('\n');
});
</script>

<template>
  <div :class="$style.bar">
    <span :class="$style.label">QUICK PRICE</span>
    <span :data-tooltip="sellTooltip" data-tooltip-position="bottom">
      <PrunButton
        dark
        inline
        :disabled="prices.sellPrice === undefined"
        :class="prices.sellCrosses && $style.crosses"
        @click="onPick(prices.sellPrice!)">
        SELL ▼ {{ prices.sellPrice !== undefined ? fixed2(prices.sellPrice) : '--' }}
      </PrunButton>
    </span>
    <span :data-tooltip="buyTooltip" data-tooltip-position="bottom">
      <PrunButton
        dark
        inline
        :disabled="prices.buyPrice === undefined"
        :class="prices.buyCrosses && $style.crosses"
        @click="onPick(prices.buyPrice!)">
        BUY ▲ {{ prices.buyPrice !== undefined ? fixed2(prices.buyPrice) : '--' }}
      </PrunButton>
    </span>
  </div>
</template>

<style module>
.bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 5px 4px;
}

.label {
  min-width: 120px;
  color: #999;
  font-size: 11px;
}

.crosses {
  color: #d9534f;
}
</style>
