<script setup lang="ts">
import ConditionItem from '@src/features/XIT/CONTS/ConditionItem.vue';
import MoreToggle from '@src/features/XIT/CONTS/MoreToggle.vue';

const { conditions, contract, limit, onToggle } = defineProps<{
  conditions: PrunApi.ContractCondition[];
  contract: PrunApi.Contract;
  limit?: number;
  onToggle?: () => void;
}>();

const filtered = computed(() => {
  return conditions
    .slice()
    .sort((a, b) => a.index - b.index)
    .filter(x => x.type !== 'LOAN_INSTALLMENT');
});
const shown = computed(() =>
  limit === undefined ? filtered.value : filtered.value.slice(0, limit),
);
const loanInstallments = computed(() => conditions.filter(x => x.type === 'LOAN_INSTALLMENT'));
const loanTotal = computed(() => loanInstallments.value.length);
const loanFilled = computed(
  () => loanInstallments.value.filter(x => x.status === 'FULFILLED').length,
);
</script>

<template>
  <ConditionItem
    v-for="condition in shown"
    :key="condition.id"
    :condition="condition"
    :contract="contract" />
  <MoreToggle :total="filtered.length" :shown="shown.length" :on-toggle="onToggle" />
  <div v-if="loanTotal !== 0">{{ loanFilled }}/{{ loanTotal }} Loan Installment</div>
</template>
