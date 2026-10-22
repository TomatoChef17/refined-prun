<script setup lang="ts">
import Active from '@src/components/forms/Active.vue';
import Passive from '@src/components/forms/Passive.vue';
import Commands from '@src/components/forms/Commands.vue';
import NumberInput from '@src/components/forms/NumberInput.vue';
import SelectInput from '@src/components/forms/SelectInput.vue';
import PrunButton from '@src/components/PrunButton.vue';
import CargoBar from '@src/components/CargoBar.vue';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import { materialsStore } from '@src/infrastructure/prun-api/data/materials';
import { fixed0, fixed02 } from '@src/utils/format';
import { clamp } from '@src/utils/clamp';
import { getAmountLimits, simulateStore } from './cargo-transfer';
import { getPartnerStores } from './partner-stores';

const { shipStoreId, ticker, onTransfer } = defineProps<{
  shipStoreId: string;
  ticker: string;
  onTransfer: (from: string, to: string, ticker: string, amount: number) => void;
}>();

const emit = defineEmits<{ (e: 'close'): void }>();

const material = computed(() => materialsStore.getByTicker(ticker));
const ship = computed(() => storagesStore.getById(shipStoreId));
const partners = computed(() => getPartnerStores(shipStoreId));
const partnerId = ref(partners.value[0]?.id);
const partner = computed(() => storagesStore.getById(partnerId.value));
const partnerLabel = computed(
  () => partners.value.find(x => x.id === partnerId.value)?.label ?? '',
);

function amountIn(store: PrunApi.Store | undefined) {
  const item = store?.items.find(x => x.quantity?.material.ticker === ticker);
  return item?.quantity?.amount ?? 0;
}

const shipAmount = computed(() => amountIn(ship.value));
const partnerAmount = computed(() => amountIn(partner.value));
const target = ref<number | undefined>(shipAmount.value);

const limits = computed(() => {
  if (!ship.value || !partner.value || !material.value) {
    return { min: shipAmount.value, max: shipAmount.value };
  }
  return getAmountLimits(
    ship.value,
    partner.value,
    material.value,
    shipAmount.value,
    partnerAmount.value,
  );
});

const clampedTarget = computed(() => clamp(target.value ?? 0, limits.value.min, limits.value.max));
const delta = computed(() => clampedTarget.value - shipAmount.value);

const simulated = computed(() => {
  if (!ship.value || !material.value) {
    return undefined;
  }
  return simulateStore(ship.value, ticker, material.value, clampedTarget.value);
});

const loadText = computed(() => {
  const store = simulated.value;
  if (!store) {
    return '';
  }
  return (
    `${fixed02(store.weightLoad)} / ${fixed0(store.weightCapacity)} t · ` +
    `${fixed02(store.volumeLoad)} / ${fixed0(store.volumeCapacity)} m³`
  );
});

const deltaText = computed(() => {
  if (delta.value === 0) {
    return 'No change';
  }
  if (delta.value > 0) {
    return `Load ${fixed0(delta.value)} ${ticker} from ${partnerLabel.value}`;
  }
  return `Unload ${fixed0(-delta.value)} ${ticker} to ${partnerLabel.value}`;
});

function step(value: number) {
  target.value = clamp(clampedTarget.value + value, limits.value.min, limits.value.max);
}

function onOpenMtra() {
  if (delta.value === 0 || !partnerId.value) {
    return;
  }
  if (delta.value > 0) {
    onTransfer(partnerId.value, shipStoreId, ticker, delta.value);
  } else {
    onTransfer(shipStoreId, partnerId.value, ticker, -delta.value);
  }
  emit('close');
}
</script>

<template>
  <form @submit.prevent="onOpenMtra">
    <Passive label="Material">{{ ticker }}</Passive>
    <Passive v-if="partners.length === 0" label="Partner">
      No warehouse or base here (ship in flight?)
    </Passive>
    <template v-else>
      <Active v-if="partners.length > 1" label="Partner">
        <SelectInput
          v-model="partnerId"
          :options="partners.map(x => ({ label: x.label, value: x.id }))" />
      </Active>
      <Passive v-else label="Partner">{{ partnerLabel }}</Passive>
      <Passive label="In ship / partner">
        {{ fixed0(shipAmount) }} / {{ fixed0(partnerAmount) }}
      </Passive>
      <Active label="Amount in ship">
        <NumberInput v-model="target" />
      </Active>
      <Commands label="Adjust">
        <div :class="$style.steps">
          <PrunButton dark inline @click="target = limits.min">MIN</PrunButton>
          <PrunButton dark inline @click="step(-1000)">-1k</PrunButton>
          <PrunButton dark inline @click="step(-100)">-100</PrunButton>
          <PrunButton dark inline @click="step(100)">+100</PrunButton>
          <PrunButton dark inline @click="step(1000)">+1k</PrunButton>
          <PrunButton dark inline @click="target = limits.max">MAX</PrunButton>
        </div>
      </Commands>
      <Passive label="Range">{{ fixed0(limits.min) }} – {{ fixed0(limits.max) }}</Passive>
      <Passive label="Ship now">
        <CargoBar :store="ship" disable-mini-mode />
      </Passive>
      <Passive label="Ship after">
        <div :class="$style.after">
          <CargoBar :store="simulated" disable-mini-mode />
          <span>{{ loadText }}</span>
        </div>
      </Passive>
      <Passive label="Transfer">{{ deltaText }}</Passive>
      <Commands>
        <PrunButton primary :disabled="delta === 0" @click="onOpenMtra">OPEN MTRA</PrunButton>
      </Commands>
    </template>
  </form>
</template>

<style module>
.steps {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

.after {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
}
</style>
