<script setup lang="ts">
const { names, current, onPick, onRemove, onAdd } = defineProps<{
  names: string[];
  // Name typed in the recipient field.
  current: string;
  onPick: (name: string) => void;
  onRemove: (name: string) => void;
  onAdd: (name: string) => void;
}>();

const canAdd = computed(() => {
  const name = current.trim();
  return name.length > 0 && !names.some(x => x.toLowerCase() === name.toLowerCase());
});
</script>

<template>
  <div :class="$style.bar">
    <span :class="$style.title">★ FAVORITES</span>
    <span v-if="names.length === 0 && !canAdd" :class="$style.hint">
      Click ☆ next to a name in the list to pin it here.
    </span>
    <span
      v-for="name in names"
      :key="name"
      :class="$style.chip"
      :data-tooltip="`Send to ${name}`"
      data-tooltip-position="top"
      @mousedown.prevent
      @click="onPick(name)">
      {{ name }}
      <span
        :class="$style.remove"
        data-tooltip="Remove from favorites"
        data-tooltip-position="top"
        @click.stop="onRemove(name)"
        >×</span
      >
    </span>
    <span
      v-if="canAdd"
      :class="$style.add"
      data-tooltip="Add the typed name to favorites"
      data-tooltip-position="top"
      @mousedown.prevent
      @click="onAdd(current.trim())">
      + ★ {{ current.trim() }}
    </span>
  </div>
</template>

<style module>
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin: 4px 0;
  padding: 5px 6px;
  border: 1px solid rgba(247, 166, 0, 0.45);
  border-radius: 3px;
  background: linear-gradient(90deg, rgba(247, 166, 0, 0.12), rgba(247, 166, 0, 0.03));
}

.title {
  margin-right: 4px;
  font-size: 10px;
  font-weight: bold;
  letter-spacing: 0.5px;
  color: #f7a600;
}

.hint {
  font-size: 10px;
  color: #888;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px 2px 8px;
  border: 1px solid #f7a600;
  border-radius: 10px;
  background-color: rgba(247, 166, 0, 0.15);
  color: #fdd28a;
  font-size: 11px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s;

  &:hover {
    background-color: rgba(247, 166, 0, 0.35);
    color: #fff;
  }
}

.remove {
  padding: 0 3px;
  border-radius: 50%;
  color: #b08a4a;
  font-weight: bold;

  &:hover {
    background-color: rgba(217, 83, 79, 0.6);
    color: #fff;
  }
}

.add {
  padding: 2px 8px;
  border: 1px dashed #f7a600;
  border-radius: 10px;
  color: #f7a600;
  font-size: 11px;
  cursor: pointer;
  user-select: none;

  &:hover {
    background-color: rgba(247, 166, 0, 0.2);
  }
}
</style>
