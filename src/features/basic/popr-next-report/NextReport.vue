<script setup lang="ts">
import { timestampEachMinute } from '@src/utils/dayjs';
import { formatDenseEta } from '@src/utils/format';
import { getNextReport } from './report-time';

const { lastReport, exact } = defineProps<{
  lastReport: number | undefined;
  exact: boolean;
}>();

const next = computed(() =>
  lastReport === undefined ? undefined : getNextReport(lastReport, timestampEachMinute.value),
);

const dateText = computed(() =>
  next.value === undefined
    ? ''
    : new Date(next.value).toLocaleString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
);
</script>

<template>
  <div
    v-if="next !== undefined"
    :class="$style.box"
    :title="exact ? undefined : 'Estimated from the report age: up to 1 hour later.'">
    <span :class="$style.label">Next POPR</span>
    <span :class="$style.date">{{ exact ? '' : '≈ ' }}{{ dateText }}</span>
    <span :class="$style.left">in {{ formatDenseEta(timestampEachMinute, next) }}</span>
  </div>
</template>

<style module>
.box {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 10px;
  margin: 6px auto;
  padding: 4px 12px;
  width: fit-content;
  border: 1px solid rgb(247, 166, 0);
  border-radius: 3px;
  background: rgba(247, 166, 0, 0.12);
}

.label {
  color: rgb(247, 166, 0);
  font-weight: bold;
  text-transform: uppercase;
}

.date {
  color: rgb(238, 238, 238);
  font-size: 14px;
  font-weight: bold;
}

.left {
  color: rgb(153, 153, 153);
}
</style>
