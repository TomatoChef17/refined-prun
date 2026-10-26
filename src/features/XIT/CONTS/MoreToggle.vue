<script setup lang="ts">
// Lists longer than this collapse in XIT CONTS.
const collapsedSize = 3;

const { total, shown, onToggle } = defineProps<{
  total: number;
  shown: number;
  onToggle?: () => void;
}>();
</script>

<template>
  <template v-if="onToggle">
    <div
      v-if="shown < total"
      :class="$style.toggle"
      data-tooltip="Show all entries of this contract."
      @click="onToggle">
      +{{ total - shown }} more
    </div>
    <div v-else-if="total > collapsedSize" :class="$style.toggle" @click="onToggle">less</div>
  </template>
</template>

<style module>
.toggle {
  color: #3fa2de;
  font-size: 10px;
  cursor: pointer;

  &:hover {
    color: #fff;
  }
}
</style>
