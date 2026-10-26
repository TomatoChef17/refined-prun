<script setup lang="ts">
import { userData } from '@src/store/user-data';
import { homeStations } from '@src/core/home-station';
import SectionHeader from '@src/components/SectionHeader.vue';
import Active from '@src/components/forms/Active.vue';
import Passive from '@src/components/forms/Passive.vue';
import TextInput from '@src/components/forms/TextInput.vue';
import SelectInput from '@src/components/forms/SelectInput.vue';
import Commands from '@src/components/forms/Commands.vue';
import PrunButton from '@src/components/PrunButton.vue';

const stationOptions = homeStations.map(x => ({
  label: `${x.naturalId} – ${x.name} (${x.exchange})`,
  value: x.naturalId,
}));

const destination = ref('');

function addDestination() {
  const names = destination.value
    .split(',')
    .map(x => x.trim())
    .filter(x => x.length > 0);
  for (const name of names) {
    if (!userData.cosm.sfcDestinations.some(x => x.toLowerCase() === name.toLowerCase())) {
      userData.cosm.sfcDestinations.push(name);
    }
  }
  destination.value = '';
}

function removeDestination(name: string) {
  userData.cosm.sfcDestinations = userData.cosm.sfcDestinations.filter(x => x !== name);
}
</script>

<template>
  <SectionHeader>Trade Hub</SectionHeader>
  <form @submit.prevent>
    <Active
      label="Home station"
      tooltip="The station whose warehouse (WAR) and commodity exchange you use most. XIT BURN and XIT SUPPLY show its warehouse stock, and your open sell orders on its exchange show under its warehouse inventory.">
      <SelectInput v-model="userData.cosm.homeStation" :options="stationOptions" />
    </Active>
  </form>
  <SectionHeader>SFC Destination Shortcuts</SectionHeader>
  <Passive v-if="userData.cosm.sfcDestinations.length === 0" label="Destinations">None</Passive>
  <Passive v-for="name in userData.cosm.sfcDestinations" :key="name" :label="name">
    <PrunButton danger @click="removeDestination(name)">x</PrunButton>
  </Passive>
  <form @submit.prevent="addDestination">
    <Active
      label="Add"
      tooltip="Planet or station names or natural ids, separated by commas. They show as one-click buttons under the destination field in SFC.">
      <TextInput v-model="destination" />
    </Active>
    <Commands>
      <PrunButton primary @click="addDestination">ADD</PrunButton>
    </Commands>
  </form>
</template>
