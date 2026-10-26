<script setup lang="ts">
import MaterialIcon from '@src/components/MaterialIcon.vue';
import { cxosStore } from '@src/infrastructure/prun-api/data/cxos';
import { cxobStore } from '@src/infrastructure/prun-api/data/cxob';
import { cxStore } from '@src/infrastructure/fio/cx';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { fixed0, fixed02 } from '@src/utils/format';
import { getOnSaleItems, OnSaleItem } from './sell-order-status';

const { exchange } = defineProps<{ exchange: string }>();

const items = computed(() => {
  const orders = (cxosStore.active.value ?? [])
    .filter(x => x.type === 'SELLING' && x.exchange.code === exchange && x.amount > 0)
    .map(x => ({
      id: x.id,
      ticker: x.material.ticker,
      amount: x.amount,
      price: x.limit.amount,
    }));
  return getOnSaleItems(
    orders,
    ticker =>
      cxobStore.getByTicker(`${ticker}.${exchange}`)?.sellingOrders.map(x => ({
        id: x.id,
        price: x.limit.amount,
      })),
    ticker => cxStore.prices?.get(exchange)?.get(ticker)?.Ask ?? undefined,
  );
});

function formatPrice(value: number) {
  return value >= 100 ? fixed0(value) : fixed02(value);
}

function tooltip(item: OnSaleItem) {
  const lines = [`Selling ${fixed0(item.amount)} ${item.ticker} at ${formatPrice(item.price)}.`];
  const source = item.live ? 'live order book' : 'price snapshot, up to ~15 min old';
  if (item.bestOther === undefined) {
    lines.push(`No other seller found (${source}).`);
  } else if (item.undercut) {
    lines.push(`Undercut: another seller asks ${formatPrice(item.bestOther)} (${source}).`);
  } else {
    lines.push(`Cheapest seller. Next ask: ${formatPrice(item.bestOther)} (${source}).`);
  }
  lines.push('Click to open CXPO.');
  return lines.join('\n');
}
</script>

<template>
  <div :class="$style.section">
    <div :class="$style.title">
      ON SALE AT {{ exchange }} ({{ items.length }})
      <span v-if="!cxosStore.fetched.value"> · loading orders…</span>
      <span v-else-if="items.length === 0"> · no open sell order</span>
    </div>
    <div v-if="items.length > 0" :class="$style.grid">
      <div
        v-for="item in items"
        :key="item.ticker"
        :class="[$style.item, item.undercut ? $style.undercut : $style.cheapest]"
        :data-tooltip="tooltip(item)"
        data-tooltip-position="top"
        @click="showBuffer(`CXPO ${item.ticker}.${exchange}`)">
        <MaterialIcon :ticker="item.ticker" :amount="item.amount" />
        <div :class="$style.price">
          {{ formatPrice(item.price) }}
          <span v-if="item.undercut" :class="$style.best">▼{{ formatPrice(item.bestOther!) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style module>
.section {
  margin-top: 8px;
  padding-top: 4px;
  border-top: 1px solid #2b485a;
}

.title {
  color: #888;
  font-size: 11px;
  margin: 0 4px 4px;
}

.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 2px 4px 4px;
}

.item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3px;
  border-radius: 3px;
  border: 2px dashed;
  cursor: pointer;

  > div:first-child {
    pointer-events: none;
  }
}

.cheapest {
  border-color: #5cb85c;
}

.undercut {
  border-color: #d9534f;
  background-color: rgba(217, 83, 79, 0.15);
}

.price {
  margin-top: 2px;
  font-size: 10px;
  color: #eee;
  white-space: nowrap;
}

.best {
  margin-left: 3px;
  color: #d9534f;
}
</style>
