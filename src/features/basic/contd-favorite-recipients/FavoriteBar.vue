<script setup lang="ts">
const { names, counts, current, onPick, onRemove, onAdd } = defineProps<{
  // Sorted with the most contracts first.
  names: string[];
  // Contracts per name, sent and received.
  counts: Record<string, number>;
  // Name typed in the recipient field.
  current: string;
  onPick: (name: string) => void;
  onRemove: (name: string) => void;
  onAdd: (name: string) => void;
}>();

const editing = ref(false);
const draftInput = useTemplateRef<HTMLInputElement>('draft-input');
const draft = ref('');

const typedName = computed(() => current.trim());
const canAddTyped = computed(
  () =>
    typedName.value.length > 0 &&
    !names.some(x => x.toLowerCase() === typedName.value.toLowerCase()),
);

function startAdd() {
  draft.value = '';
  editing.value = true;
  void nextTick(() => draftInput.value?.focus());
}

// Several names can be pasted at once, separated by commas or spaces.
function confirmAdd() {
  for (const name of draft.value.split(/[,;\s]+/)) {
    if (name) {
      onAdd(name);
    }
  }
  editing.value = false;
}

const copied = ref(false);

async function copyList() {
  await navigator.clipboard.writeText(names.join(', '));
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}
</script>

<template>
  <!-- The game form handles mouse events and steals focus from extension inputs. -->
  <div :class="$style.bar" @mousedown.stop @pointerdown.stop @click.stop>
    <div :class="$style.header">
      <span :class="$style.title">★ FAVORITE RECIPIENTS</span>
      <span :class="$style.hint">Most contracts first · click to fill · × to remove</span>
      <span
        v-if="names.length > 0"
        :class="$style.copy"
        data-tooltip="Copy the list. Paste it in + ADD on another PC."
        data-tooltip-position="top"
        @click="copyList"
        >{{ copied ? 'COPIED' : 'COPY LIST' }}</span
      >
    </div>
    <div :class="$style.chips">
      <span
        v-for="name in names"
        :key="name"
        :class="$style.chip"
        @mousedown.prevent
        @click="onPick(name)">
        ★ {{ name }}
        <span
          v-if="(counts[name] ?? 0) > 0"
          :class="$style.count"
          :data-tooltip="`${counts[name]} contracts with ${name}`"
          data-tooltip-position="top"
          >{{ counts[name] }}</span
        >
        <span :class="$style.remove" @click.stop="onRemove(name)">×</span>
      </span>
      <span
        v-if="canAddTyped && !editing"
        :class="$style.add"
        @mousedown.prevent
        @click="onAdd(typedName)">
        + ★ {{ typedName }}
      </span>
      <form v-if="editing" :class="$style.form" @submit.prevent="confirmAdd">
        <input
          ref="draft-input"
          v-model="draft"
          :class="$style.input"
          placeholder="Name(s), comma separated"
          @keydown.esc.prevent="editing = false" />
        <button type="submit" :class="$style.ok">OK</button>
      </form>
      <span v-else :class="$style.add" @click="startAdd">+ ADD</span>
    </div>
  </div>
</template>

<style module>
.bar {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin: 4px 0;
  padding: 6px 8px;
  border: 1px solid rgba(247, 166, 0, 0.5);
  border-radius: 3px;
  background: linear-gradient(90deg, rgba(247, 166, 0, 0.14), rgba(247, 166, 0, 0.03));
}

.header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 5px;
}

.title {
  font-size: 10px;
  font-weight: bold;
  letter-spacing: 0.5px;
  color: #f7a600;
}

.hint {
  font-size: 10px;
  color: #888;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 4px 3px 9px;
  border: 1px solid #f7a600;
  border-radius: 12px;
  background-color: rgba(247, 166, 0, 0.18);
  color: #fdd28a;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s;

  &:hover {
    background-color: rgba(247, 166, 0, 0.4);
    color: #fff;
  }
}

.count {
  padding: 0 5px;
  border-radius: 8px;
  background-color: rgba(0, 0, 0, 0.35);
  color: #f7a600;
  font-size: 10px;
  font-weight: bold;
}

.remove {
  padding: 0 4px;
  border-radius: 50%;
  color: #b08a4a;
  font-weight: bold;

  &:hover {
    background-color: rgba(217, 83, 79, 0.7);
    color: #fff;
  }
}

.add {
  padding: 3px 9px;
  border: 1px dashed #f7a600;
  border-radius: 12px;
  color: #f7a600;
  font-size: 11px;
  cursor: pointer;
  user-select: none;

  &:hover {
    background-color: rgba(247, 166, 0, 0.2);
  }
}

.form {
  display: inline-flex;
  gap: 3px;
}

.copy {
  margin-left: auto;
  font-size: 10px;
  color: #888;
  cursor: pointer;

  &:hover {
    color: #f7a600;
  }
}

.input {
  width: 180px;
  padding: 2px 6px;
  border: 1px solid #f7a600;
  border-radius: 3px;
  background-color: #222;
  color: #eee;
  font-size: 11px;
}

.ok {
  padding: 2px 8px;
  border: none;
  border-radius: 3px;
  background-color: #f7a600;
  color: #222;
  font-size: 11px;
  font-weight: bold;
  cursor: pointer;
}
</style>
