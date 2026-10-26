<script setup lang="ts">
import { isSelfCondition } from '@src/features/XIT/CONTS/utils';
import ShipmentIcon from '@src/components/ShipmentIcon.vue';
import MaterialIcon from '@src/components/MaterialIcon.vue';
import { objectId } from '@src/utils/object-id';
import MoreToggle from '@src/features/XIT/CONTS/MoreToggle.vue';

const { contract, limit, onToggle } = defineProps<{
  contract: PrunApi.Contract;
  limit?: number;
  onToggle?: () => void;
}>();

interface ShipmentIconProps {
  type: 'SHIPMENT';
  shipmentId: string;
}

interface MaterialIconProps {
  type: 'MATERIAL';
  ticker: string;
  amount: number;
}

const icons = computed(() => {
  const result: (ShipmentIconProps | MaterialIconProps)[] = [];
  for (const condition of contract.conditions) {
    switch (condition.type) {
      case 'DELIVERY_SHIPMENT': {
        if (isSelfCondition(contract, condition)) {
          result.push({ type: 'SHIPMENT', shipmentId: condition.shipmentItemId! });
          continue;
        }
        break;
      }
      case 'PROVISION':
      case 'PICKUP_SHIPMENT': {
        continue;
      }
    }

    const quantity = condition.quantity;
    if (!quantity?.material) {
      continue;
    }

    const amount = quantity.amount;
    const ticker = quantity.material.ticker;
    result.push({ type: 'MATERIAL', ticker: ticker, amount: amount });
  }
  return result;
});

const shown = computed(() => (limit === undefined ? icons.value : icons.value.slice(0, limit)));
</script>

<template>
  <div>
    <template v-for="icon in shown" :key="objectId(icon)">
      <div v-if="icon.type === 'SHIPMENT'" :style="{ marginBottom: '4px' }">
        <ShipmentIcon size="medium" :shipment-id="icon.shipmentId" />
      </div>
      <div v-if="icon.type === 'MATERIAL'" :style="{ marginBottom: '4px' }">
        <MaterialIcon size="medium" :ticker="icon.ticker" :amount="icon.amount" />
      </div>
    </template>
    <MoreToggle :total="icons.length" :shown="shown.length" :on-toggle="onToggle" />
  </div>
</template>

<style scoped></style>
