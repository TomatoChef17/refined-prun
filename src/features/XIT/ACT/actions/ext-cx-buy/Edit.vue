<script setup lang="ts">
import Active from '@src/components/forms/Active.vue';
import SelectInput from '@src/components/forms/SelectInput.vue';
import NumericInput from '@src/components/forms/NumericInput.vue';
import TextInput from '@src/components/forms/TextInput.vue';
import { configurableValue, groupTargetPrefix } from '@src/features/XIT/ACT/shared-types';
import { useContLocations } from '@src/features/XIT/ACT/actions/cont-locations';
import { balancesStore } from '@src/infrastructure/prun-api/data/balances';
import { maxContractDays, minContractDays } from '@src/features/XIT/ACT/actions/cont-limits';
import { DEFAULT_ECAPI_URL } from '@src/features/XIT/ACT/actions/ext-cx-buy/ecapi';

const { action, pkg } = defineProps<{
  action: UserData.ActionData;
  pkg: UserData.ActionPackageData;
}>();

const materialGroups = computed(() => pkg.groups.map(x => x.name!).filter(x => x));
const materialGroup = ref(action.group ?? materialGroups.value[0]);

const staticLocations = useContLocations();

const groupTargetOptions = computed(() =>
  pkg.groups
    .filter(x => x.name && x.planet)
    .map(x => ({
      label: `[${x.name}] target`,
      value: `${groupTargetPrefix}${x.name}`,
    })),
);

const locationOptions = computed(() => [
  configurableValue,
  ...groupTargetOptions.value,
  ...staticLocations.value,
]);

const currencies = computed(() => balancesStore.currencies.value ?? []);

const contLocation = ref(action.contLocation ?? staticLocations.value[0] ?? '');
const currency = ref(action.currency ?? 'ICA');
const daysToFulfill = ref(action.daysToFulfill ?? 3);
const url = ref(action.extCxUrl ?? DEFAULT_ECAPI_URL);
const exclude = ref(action.extCxExclude ?? '');

function validate() {
  if (!materialGroup.value) {
    return false;
  }
  const locations = locationOptions.value.map(x => (typeof x === 'string' ? x : x.value));
  if (!locations.includes(contLocation.value)) {
    return false;
  }
  const days = Number(daysToFulfill.value);
  if (!Number.isInteger(days) || days < minContractDays || days > maxContractDays) {
    return false;
  }
  return url.value.trim().startsWith('https://');
}

function save() {
  action.group = materialGroup.value;
  action.contLocation = contLocation.value;
  action.currency = currency.value;
  action.daysToFulfill = Number(daysToFulfill.value);
  action.extCxUrl = url.value.trim();
  action.extCxExclude = exclude.value.trim();
}

defineExpose({ validate, save });
</script>

<template>
  <Active label="Material Group">
    <SelectInput v-model="materialGroup" :options="materialGroups" />
  </Active>

  <Active label="Location" tooltip="Where the vendors must have the stock, and where you buy.">
    <SelectInput v-model="contLocation" :options="locationOptions" />
  </Active>

  <Active label="Currency">
    <SelectInput v-model="currency" :options="currencies" />
  </Active>

  <Active label="Days to Fulfill">
    <NumericInput v-model="daysToFulfill" :min="minContractDays" :max="maxContractDays" :step="1" />
  </Active>

  <Active
    label="Market URL"
    tooltip="Vendor list in the External CX API (ECAPI) format. PUNoted is the default.">
    <TextInput v-model="url" />
  </Active>

  <Active
    label="Exclude"
    tooltip="Player names or company codes never to buy from, separated by commas.">
    <TextInput v-model="exclude" />
  </Active>
</template>
