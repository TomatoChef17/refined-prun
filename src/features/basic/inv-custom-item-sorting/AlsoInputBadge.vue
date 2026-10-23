<script setup lang="ts">
import { fixed0, fixed1 } from '@src/utils/format';

const { ticker, made, used, queued, input, workforce } = defineProps<{
  ticker: string;
  // Units per day used by production and by the workforce.
  input: number;
  workforce: number;
  // Units per day.
  made: number;
  used: number;
  // Units the production orders that did not start yet still take.
  queued: number;
}>();

// IN: production input, CON: workforce consumable, IN+C: both.
const label = computed(() => {
  if (input > 0) {
    return workforce > 0 ? 'IN+C' : 'IN';
  }
  return 'CON';
});

const uses = computed(() => {
  const parts: string[] = [];
  if (input > 0) {
    parts.push(`production input ${fixed1(input)}/day`);
  }
  if (workforce > 0) {
    parts.push(`workforce consumable ${fixed1(workforce)}/day`);
  }
  return parts.join(', ');
});

const tooltip = computed(() => {
  const lines = [
    `${ticker} is also used here: ${uses.value}.`,
    `Made ${fixed1(made)}/day, used ${fixed1(used)}/day (net +${fixed1(made - used)}/day).`,
  ];
  if (queued > 0) {
    lines.push(`Keep at least ${fixed0(queued)} for the queued orders.`);
  }
  lines.push('Do not sell it all.');
  return lines.join('\n');
});
</script>

<template>
  <span :class="$style.badge" :title="tooltip">{{ label }}</span>
</template>

<style module>
.badge {
  position: absolute;
  top: 1px;
  left: 1px;
  z-index: 1;
  padding: 0 2px;
  font-size: 9px;
  line-height: 11px;
  font-weight: bold;
  color: #222;
  background: #f7a600;
  border-radius: 2px;
  cursor: help;
}
</style>
