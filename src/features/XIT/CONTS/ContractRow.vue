<script setup lang="ts">
import ContractLink from '@src/features/XIT/CONTS/ContractLink.vue';
import MaterialList from '@src/features/XIT/CONTS/MaterialList.vue';
import PartnerLink from '@src/features/XIT/CONTS/PartnerLink.vue';
import ConditionList from '@src/features/XIT/CONTS/ConditionList.vue';
import { isPartnerCondition, isSelfCondition } from '@src/features/XIT/CONTS/utils';

const { contract } = defineProps<{ contract: PrunApi.Contract }>();

const self = computed(() => contract.conditions.filter(x => isSelfCondition(contract, x)));
const partner = computed(() => contract.conditions.filter(x => isPartnerCondition(contract, x)));

// Long cells show the first entries only; one click expands the whole row.
const expanded = ref(false);
const limit = computed(() => (expanded.value ? undefined : 3));
const toggle = () => (expanded.value = !expanded.value);
</script>

<template>
  <tr>
    <td>
      <ContractLink :contract="contract" />
    </td>
    <td :style="{ width: '32px', paddingLeft: '10px' }">
      <MaterialList :contract="contract" :limit="limit" :on-toggle="toggle" />
    </td>
    <td>
      <PartnerLink :contract="contract" />
      <ConditionList
        :conditions="partner"
        :contract="contract"
        :limit="limit"
        :on-toggle="toggle" />
    </td>
    <td>
      <ConditionList :conditions="self" :contract="contract" :limit="limit" :on-toggle="toggle" />
    </td>
  </tr>
</template>
