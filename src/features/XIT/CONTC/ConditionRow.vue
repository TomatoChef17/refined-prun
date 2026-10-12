<script setup lang="ts">
import ContractLink from '@src/features/XIT/CONTC/ContractLink.vue';
import { timestampEachSecond } from '@src/utils/dayjs';
import dayjs from 'dayjs';
import ConditionText from '@src/features/XIT/CONTC/ConditionText.vue';
import PrunButton from '@src/components/PrunButton.vue';
import { isFulfillable } from '@src/core/contract-conditions';
import { fulfillCondition } from '@src/infrastructure/prun-ui/utils/fulfill-condition';

const { deadline, contract, condition } = defineProps<{
  condition: PrunApi.ContractCondition;
  contract: PrunApi.Contract;
  deadline: number;
  showFulfill: boolean;
}>();

function onFulfillClick(event: MouseEvent) {
  void fulfillCondition(event.currentTarget as Element, contract, condition, event.shiftKey);
}

// Deadlines are read on the computer clock.
// Hours when the player sleeps: from 23:00 to 10:00.
const SLEEP_START = 23;
const SLEEP_END = 10;

const end = computed(() => (isFinite(deadline) ? new Date(deadline) : undefined));

const endHour = computed(() => {
  if (!end.value) {
    return undefined;
  }
  // Local hour from 0 to 23 on the computer clock.
  return end.value.getHours();
});

// The deadline falls in the night: nobody is there to fulfill the condition.
const atNight = computed(
  () =>
    endHour.value !== undefined &&
    deadline > timestampEachSecond.value &&
    (endHour.value >= SLEEP_START || endHour.value < SLEEP_END),
);

const endTime = computed(() => {
  if (!end.value) {
    return undefined;
  }
  const day = end.value.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
  const time = end.value.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const night = atNight.value ? ' — pendant ton sommeil (23h-10h)' : '';
  return `Fin : ${day} à ${time} (heure du Maroc)${night}`;
});

const eta = computed(() => {
  if (!isFinite(deadline)) {
    return '∞';
  }
  if (deadline <= timestampEachSecond.value) {
    return '-';
  }
  let duration = dayjs.duration({ milliseconds: deadline - timestampEachSecond.value });
  const days = Math.floor(duration.asDays());
  duration = duration.subtract(days, 'days');
  const hours = Math.floor(duration.asHours());
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  duration = duration.subtract(hours, 'hours');
  const minutes = Math.floor(duration.asMinutes());
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  duration = duration.subtract(minutes, 'minutes');
  const seconds = Math.floor(duration.asSeconds());
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
});
</script>

<template>
  <tr>
    <td>
      <ContractLink :contract="contract" />
    </td>
    <td :class="{ [$style.night]: atNight }">
      <span :class="$style.eta" :data-tooltip="endTime">{{ eta }}</span>
    </td>
    <td>
      <ConditionText :condition="condition" />
    </td>
    <td v-if="showFulfill" :class="$style.fulfillCell">
      <PrunButton v-if="isFulfillable(contract, condition)" success inline @click="onFulfillClick">
        {{ L.ContractCondition.fulfill() }}
      </PrunButton>
    </td>
  </tr>
</template>

<style module>
/* The deadline falls between 23:00 and 10:00. */
.night {
  background-color: rgba(217, 83, 79, 0.45) !important;
  color: #fff !important;
}

.eta {
  white-space: nowrap;
}

.fulfillCell {
  padding: 2px 4px;
  width: 0;
  height: 0;
}
</style>
