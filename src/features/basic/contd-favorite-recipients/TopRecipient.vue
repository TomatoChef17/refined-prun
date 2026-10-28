<script setup lang="ts">
const { name, count, onPick } = defineProps<{
  name: string;
  count: number;
  onPick: (name: string) => void;
}>();
</script>

<template>
  <!-- The game form handles mouse events and steals focus from extension inputs. -->
  <span
    :class="$style.top"
    :data-tooltip="`Top partner: ${count} contracts. Click to fill the recipient.`"
    data-tooltip-position="top"
    @mousedown.stop.prevent
    @pointerdown.stop
    @click.stop="onPick(name)">
    <span :class="$style.crown">♛</span>
    {{ name }}
    <span :class="$style.count">{{ count }}</span>
  </span>
</template>

<style module>
.top {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-right: 8px;
  padding: 2px 6px 2px 8px;
  border: 1px solid #3fa2de;
  border-radius: 12px;
  background: linear-gradient(90deg, rgba(63, 162, 222, 0.35), rgba(63, 162, 222, 0.12));
  box-shadow: 0 0 6px rgba(63, 162, 222, 0.45);
  color: #e6f4ff;
  font-size: 12px;
  font-weight: bold;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;

  &:hover {
    background: rgba(63, 162, 222, 0.55);
    color: #fff;
  }
}

.crown {
  color: #f7a600;
  font-size: 13px;
}

.count {
  padding: 0 5px;
  border-radius: 8px;
  background-color: rgba(0, 0, 0, 0.35);
  color: #9fd6f7;
  font-size: 10px;
}
</style>
