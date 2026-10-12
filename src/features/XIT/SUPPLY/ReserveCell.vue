<script setup lang="ts">
import { ComponentPublicInstance } from 'vue';
import { fixed0 } from '@src/utils/format';
import { userData } from '@src/store/user-data';
import { ContractLine } from './supply-calc';

const { ticker, total, lines } = defineProps<{
  ticker: string;
  total: number;
  lines: ContractLine[];
}>();

const manual = computed(() => userData.supply.reserved[ticker] ?? 0);

const tooltip = computed(() => {
  const parts = lines.map(x => `${x.contract} ${x.partner}: ${fixed0(x.amount)}`);
  if (manual.value > 0) {
    parts.push(`manual: ${fixed0(manual.value)}`);
  }
  parts.push('click to set a manual reserve');
  return parts.join(' · ');
});

const editing = ref(false);
const draft = ref('');

function startEdit() {
  draft.value = manual.value > 0 ? String(manual.value) : '';
  editing.value = true;
}

function save() {
  const value = Math.floor(Number(draft.value.replace(/[\s,]/g, '')));
  if (!Number.isFinite(value) || value <= 0) {
    delete userData.supply.reserved[ticker];
  } else {
    userData.supply.reserved[ticker] = value;
  }
  editing.value = false;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter' && e.key !== 'Escape') {
    return;
  }
  // Keep Enter/Escape away from the game's own handlers.
  e.stopPropagation();
  if (e.key === 'Enter') {
    save();
  } else {
    editing.value = false;
  }
}

const focus = (el: Element | ComponentPublicInstance | null) => {
  if (el) {
    const input = el as HTMLInputElement;
    setTimeout(() => {
      input.focus();
      input.select();
    });
  }
};
</script>

<template>
  <td :class="$style.cell" @click="!editing && startEdit()">
    <input
      v-if="editing"
      :ref="focus"
      v-model="draft"
      type="text"
      inputmode="numeric"
      placeholder="manual"
      :class="$style.input"
      @keydown="onKeydown"
      @blur="save" />
    <span v-else-if="total > 0" :class="{ [$style.manual]: manual > 0 }" :data-tooltip="tooltip">{{
      fixed0(total)
    }}</span>
    <span v-else :class="$style.empty" :data-tooltip="tooltip">–</span>
  </td>
</template>

<style module>
.cell {
  cursor: pointer;
}

.input {
  width: 64px;
  background: rgb(66, 54, 29);
  color: rgb(187, 187, 187);
  border: none;
  border-bottom: 1px solid rgb(247, 166, 0);
  font-family: monospace;
  text-align: right;
}

.manual {
  text-decoration: underline dotted;
}

.empty {
  color: #555;
}
</style>
