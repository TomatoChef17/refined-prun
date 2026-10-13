<script setup lang="ts">
import { ComponentPublicInstance } from 'vue';
import PrunButton from '@src/components/PrunButton.vue';
import { clamp } from '@src/utils/clamp';
import { MaterialEntry } from './parsers';
import { DraggedStack, QuickAmount, getDraggedStacks, quickAmounts, shipAmounts } from './drag';
import { SHIP_BAYS, bayUsage, cargoLoad } from './ship-fill';
import { parseDisplayedInteger } from './numbers';
import { useTile } from '@src/hooks/use-tile';
import { BaseLookup, balanceBay, needAmount, needFill, sortByBaseStock } from './base-supply';
import { fixed0 } from '@src/utils/format';
import {
  getBaseLookup,
  getBaseOptions,
  getDraftBase,
  getHrtStock,
  getResupplyDays,
} from './base-lookup';

const materials = defineModel<MaterialEntry[]>({ required: true });

const tile = useTile();

// Destination base: found in the draft conditions, or picked by hand.
const pickedBaseKey = 'rprun-contd-drag-base';
const pickedBase = ref(localStorage.getItem(pickedBaseKey) ?? '');
const draftBase = computed(() => getDraftBase(tile.parameter));
const baseOptions = computed(() => getBaseOptions());
const baseId = computed(() => draftBase.value ?? (pickedBase.value || undefined));
const onBasePick = (e: Event) => {
  pickedBase.value = (e.target as HTMLSelectElement).value;
  localStorage.setItem(pickedBaseKey, pickedBase.value);
};
const baseLookup = computed<BaseLookup | undefined>(() => getBaseLookup(baseId.value));
const resupplyDays = computed(() => getResupplyDays(baseId.value));

// Keeps the list in XIT BURN Inv order of the destination base, largest first.
const sortList = () => {
  const lookup = baseLookup.value;
  if (!lookup) {
    return;
  }
  const sorted = sortByBaseStock(materials.value, lookup);
  if (sorted.some((x, i) => x !== materials.value[i])) {
    materials.value.splice(0, materials.value.length, ...sorted);
  }
};
watch(baseLookup, sortList);

// Days the base lasts on the least covered material after adding the entries.
const daysAfter = (entries: MaterialEntry[], lookup: BaseLookup) => {
  let days = Infinity;
  for (const entry of entries) {
    const mat = lookup(entry.ticker);
    if (!mat || mat.usePerDay <= 0) {
      continue;
    }
    const listed = sumBy(
      materials.value.filter(x => x.ticker === entry.ticker),
      x => (x.amount > 0 ? x.amount : 0),
    );
    days = Math.min(days, (mat.stock + listed + entry.amount) / mat.usePerDay);
  }
  return Number.isFinite(days) ? Math.floor(days) : undefined;
};

const hrtStock = computed(() => getHrtStock());

const listedOf = (ticker: string) =>
  sumBy(
    materials.value.filter(x => x.ticker === ticker),
    x => (x.amount > 0 ? x.amount : 0),
  );

const baseName = computed(
  () => baseOptions.value.find(x => x.naturalId === baseId.value)?.name ?? baseId.value ?? '',
);

// One row per dragged material, also when nothing can be sent, with the reason.
const explain = (
  dragged: DraggedStack[],
  entries: MaterialEntry[],
  lookup: BaseLookup,
  mode: 'need' | 'bay',
): MaterialEntry[] =>
  dragged.map(({ ticker }) => {
    const amount = entries.find(x => x.ticker === ticker)?.amount ?? 0;
    const base = lookup(ticker);
    if (!base || base.usePerDay <= 0) {
      return {
        ticker,
        amount: 0,
        level: 'none',
        note: `${baseName.value} does not use ${ticker}.`,
      };
    }
    const listed = listedOf(ticker);
    const hrt = hrtStock.value(ticker);
    const free = Math.max(0, hrt.free - listed);
    const freeText =
      `Free at HRT: ${fixed0(free)} = stock ${fixed0(hrt.stock)}` +
      ` − my contracts ${fixed0(hrt.contracts)}` +
      ` − reserved in XIT SUPPLY ${fixed0(hrt.kept)}` +
      (listed > 0 ? ` − already listed ${fixed0(listed)}` : '') +
      '.';
    if (mode === 'bay') {
      return free > 0 ? { ticker, amount } : { ticker, amount: 0, level: 'none', note: freeText };
    }
    const need = needAmount(base, resupplyDays.value, listed, Infinity);
    if (need === 0) {
      return {
        ticker,
        amount: 0,
        level: 'enough',
        note: `No need: the base has enough for ${resupplyDays.value} days.`,
      };
    }
    if (amount >= need) {
      return { ticker, amount };
    }
    return {
      ticker,
      amount,
      level: amount > 0 ? 'partial' : 'none',
      note: `Need ${fixed0(need)}, only ${fixed0(amount)} sent. ${freeText}`,
    };
  });

// NEED and the balanced fills take the units from HRT, not from the dragged stack:
// drag from the destination base only to pick the materials.
const fromHrt = (stacks: DraggedStack[]): DraggedStack[] =>
  stacks.map(stack => {
    const listed = sumBy(
      materials.value.filter(x => x.ticker === stack.ticker),
      x => (x.amount > 0 ? x.amount : 0),
    );
    return {
      ticker: stack.ticker,
      quantity: Math.max(0, hrtStock.value(stack.ticker).free - listed),
    };
  });

const baseAmounts = (dragged: DraggedStack[]): QuickAmount[] => {
  const lookup = baseLookup.value;
  if (!lookup) {
    return [];
  }
  const days = resupplyDays.value;
  const stacks = fromHrt(dragged);
  const needOption: QuickAmount = {
    label: 'NEED',
    amount: sumBy(needFill(stacks, materials.value, lookup, days), x => x.amount),
    resolve: stack => needFill(fromHrt([stack]), materials.value, lookup, days)[0]?.amount ?? 0,
    fill: list =>
      explain(list, needFill(fromHrt(list), materials.value, lookup, days), lookup, 'need'),
    title: `Units the base needs to last ${days} days, up to the free HRT stock: ${describe(
      needFill(stacks, materials.value, lookup, days),
    )}`,
  };
  const balanced = SHIP_BAYS.map<QuickAmount>(bay => {
    const balance = (list: DraggedStack[]) =>
      balanceBay(bay, materials.value, fromHrt(list), lookup);
    const fill = (list: DraggedStack[]) => explain(list, balance(list), lookup, 'bay');
    const preview = balance(stacks);
    const after = daysAfter(preview, lookup);
    return {
      label: `=${bay.label}`,
      amount: sumBy(preview, x => x.amount),
      resolve: stack => fill([stack])[0]?.amount ?? 0,
      fill,
      title:
        `${bay.label} shared so every material lasts the same days, from the free HRT stock` +
        (after !== undefined ? ` (${after} d)` : '') +
        `: ${describe(preview)}`,
    };
  });
  return [needOption, ...balanced];
};

const describe = (entries: MaterialEntry[]) =>
  entries.map(x => `${x.amount} ${x.ticker}`).join(', ') || 'nothing';

const dragHover = ref<DraggedStack[] | undefined>();

// AMT opens a local prompt, prefilled with the stack quantity.
const amountPrompt = ref<DraggedStack | undefined>();
const promptAmount = ref('');

// Focus only when the prompt opens.
let promptNeedsFocus = false;
let dragDepth = 0;
const hoveredOption = ref<number | undefined>();

const options = computed<QuickAmount[]>(() => {
  const stacks = dragHover.value;
  if (!stacks) {
    return [];
  }
  return [
    ...quickAmounts(Math.max(...stacks.map(x => x.quantity)), stacks.length === 1),
    ...shipAmounts(stacks, materials.value),
    ...baseAmounts(stacks),
  ];
});

const load = computed(() => cargoLoad(materials.value));

const formatLoad = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });

const loadSummary = computed(() => {
  const current = load.value;
  const usage = SHIP_BAYS.map(bay => `${bay.label} ${Math.round(bayUsage(bay, current) * 100)}%`);
  return `${formatLoad(current.weight)}t · ${formatLoad(current.volume)}m³ — ${usage.join(' · ')}`;
});

// Ship fills add to an existing row of the same material instead of duplicating it.
const addMaterial = (entry: MaterialEntry) => {
  const { ticker, amount, note, level } = entry;
  const row = materials.value.find(x => x.ticker === ticker && x.price === undefined);
  if (row) {
    row.amount += amount;
    row.note = note;
    row.level = level;
  } else {
    materials.value.push({ ticker, amount, note, level });
  }
};

// Block the game's dragover handler from resetting dropEffect to none.
const acceptDrag = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy';
  }
};

const onZoneDragEnter = (e: DragEvent) => {
  acceptDrag(e);
  dragDepth++;
  // A new drag supersedes any amount prompt still open from the last drop.
  amountPrompt.value = undefined;
  if (!dragHover.value) {
    const stacks = getDraggedStacks();
    dragHover.value = stacks.length > 0 ? stacks : undefined;
  }
};

const onZoneDragOver = (e: DragEvent) => acceptDrag(e);

const onZoneDragLeave = (e: DragEvent) => {
  e.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) {
    dragHover.value = undefined;
    hoveredOption.value = undefined;
  }
};

const onZoneDrop = (e: DragEvent) => {
  e.preventDefault();
  dragDepth = 0;
  dragHover.value = undefined;
  hoveredOption.value = undefined;
};

// Dragover tracks the current quantity choice.
const onOptionDragOver = (e: DragEvent, index: number) => {
  acceptDrag(e);
  hoveredOption.value = index;
};

const onOptionDrop = (e: DragEvent, option: QuickAmount) => {
  e.preventDefault();
  e.stopPropagation();
  dragDepth = 0;
  const stacks = dragHover.value;
  dragHover.value = undefined;
  hoveredOption.value = undefined;
  if (!stacks) {
    return;
  }
  if (option.fill) {
    for (const entry of option.fill(stacks)) {
      addMaterial(entry);
    }
    sortList();
    return;
  }
  if (option.prompt) {
    amountPrompt.value = stacks[0];
    promptAmount.value = String(stacks[0].quantity);
    promptNeedsFocus = true;
    return;
  }
  for (const stack of stacks) {
    const amount = option.resolve(stack);
    if (amount >= 1) {
      materials.value.push({ ticker: stack.ticker, amount });
    }
  }
  sortList();
};

// A typed amount replaces the NEED explanation.
const onAmountInput = (material: MaterialEntry, e: Event) => {
  material.amount = Number((e.target as HTMLInputElement).value);
  material.note = undefined;
  material.level = undefined;
};

const confirmPrompt = () => {
  const stack = amountPrompt.value;
  if (!stack) {
    return;
  }
  const typed = parseDisplayedInteger(promptAmount.value);
  if (typed === undefined) {
    return;
  }
  const amount = clamp(typed, 1, stack.quantity);
  materials.value.push({ ticker: stack.ticker, amount });
  amountPrompt.value = undefined;
  sortList();
};

const onPromptKeydown = (e: KeyboardEvent) => {
  if (e.key !== 'Enter' && e.key !== 'Escape') {
    return;
  }
  // Keep Enter/Escape away from the game's own document-level handlers.
  e.stopPropagation();
  if (e.key === 'Enter') {
    confirmPrompt();
  } else {
    amountPrompt.value = undefined;
  }
};

const focusPrompt = (el: Element | ComponentPublicInstance | null) => {
  if (!promptNeedsFocus || el === null) {
    return;
  }
  promptNeedsFocus = false;
  const input = el as HTMLInputElement;
  // Wait for the game's drag-end focus handling.
  setTimeout(() => {
    input.focus();
    input.select();
  });
};
</script>

<template>
  <div :class="[$style.baseRow, C.type.typeSmall]">
    <span>For base</span>
    <span v-if="draftBase">{{
      baseOptions.find(x => x.naturalId === draftBase)?.name ?? draftBase
    }}</span>
    <select v-else :class="$style.baseSelect" :value="pickedBase" @change="onBasePick">
      <option value="">none</option>
      <option v-for="option in baseOptions" :key="option.naturalId" :value="option.naturalId">
        {{ option.name }}
      </option>
    </select>
    <span v-if="baseLookup" :class="$style.baseHint"
      >BURN Inv order · NEED {{ resupplyDays }} d · from free HRT stock</span
    >
  </div>
  <div
    :class="[$style.dropZone, dragHover && $style.dropZoneHover]"
    @dragenter="onZoneDragEnter"
    @dragover="onZoneDragOver"
    @dragleave="onZoneDragLeave"
    @drop="onZoneDrop">
    <div v-if="materials.length === 0 && !dragHover && !amountPrompt" :class="$style.dropZoneHint">
      Drag a material stack here from another inventory
    </div>
    <div v-for="(material, index) in materials" :key="index" :class="$style.materialRow">
      <span :class="[$style.materialTicker, C.type.typeSmall]">{{ material.ticker }}</span>
      <input
        type="number"
        :class="[
          $style.amountInput,
          material.level === 'partial' && $style.amountPartial,
          material.level === 'none' && $style.amountNone,
        ]"
        :value="material.amount"
        :data-tooltip="material.note"
        @input="onAmountInput(material, $event)" />
      <PrunButton dark inline @click="materials.splice(index, 1)">x</PrunButton>
    </div>
    <div v-if="amountPrompt" :class="$style.materialRow">
      <span :class="[$style.materialTicker, C.type.typeSmall]">{{ amountPrompt.ticker }}</span>
      <input
        :ref="focusPrompt"
        v-model="promptAmount"
        type="text"
        inputmode="numeric"
        :class="$style.amountInput"
        @keydown="onPromptKeydown" />
      <PrunButton dark inline @click="confirmPrompt">add</PrunButton>
      <PrunButton dark inline @click="amountPrompt = undefined">x</PrunButton>
    </div>
    <div v-if="materials.length > 0 && !dragHover" :class="[$style.loadSummary, C.type.typeSmall]">
      {{ loadSummary }}
    </div>
    <div v-if="dragHover" :class="$style.dropOverlay">
      <div :class="[$style.dropOverlayLabel, C.type.typeSmall]">
        {{ dragHover.map(x => x.ticker).join(', ') }}
      </div>
      <div
        v-for="(option, index) in options"
        :key="option.label"
        :class="$style.overlayCell"
        :title="option.title"
        @dragover="onOptionDragOver($event, index)"
        @drop="onOptionDrop($event, option)">
        <div
          :class="[
            C.DropTargetView.item,
            $style.overlaySquare,
            option.fill && $style.shipSquare,
            option.label === 'NEED' && $style.needSquare,
            option.fill && option.amount < 1 && $style.shipFull,
            hoveredOption === index && C.DropTargetView.isOver,
          ]">
          {{ option.label }}
        </div>
      </div>
    </div>
  </div>
</template>

<style module>
.dropZone {
  min-height: 100px;
  width: 100%;
  position: relative;
  border: 1px dashed rgb(141, 100, 17);
  background: rgba(66, 54, 29, 0.4);
  padding: 4px;
}

.dropZoneHover {
  border-color: rgb(247, 166, 0);
}

/* Match the textarea placeholder font and color. */
.dropZoneHint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  text-align: center;
  font: 13.3333px monospace;
  color: rgb(136, 136, 136);
}

.materialRow {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 0;
}

.materialTicker {
  width: 40px;
}

.amountInput {
  width: 80px;
  background: rgb(66, 54, 29);
  color: rgb(187, 187, 187);
  border: none;
  border-bottom: 1px solid rgb(141, 100, 17);
  font-family: monospace;
  padding: 1px 4px 2px;
}

.amountInput:focus {
  border-bottom-color: rgb(247, 166, 0);
  outline: none;
}

/* Wrap quantity choices into equal columns with centered squares. */
.dropOverlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-wrap: wrap;
  align-content: center;
}

/* Keep the stack label above the quantity choices. */
.dropOverlayLabel {
  flex: 1 0 100%;
  text-align: center;
  color: rgb(136, 136, 136);
}

.overlayCell {
  flex: 1 1 auto;
  min-width: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.overlaySquare {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Handle drops on the whole cell, not just the square. */
  pointer-events: none;
}

/* Ship bay choices stand out from plain quantities. */
.shipSquare {
  border-color: rgb(63, 162, 222);
  color: rgb(63, 162, 222);
}

/* NEED gave less than the base needs. */
.amountPartial {
  background: rgba(247, 166, 0, 0.35);
}

/* Nothing could be sent. */
.amountNone {
  background: rgba(217, 83, 79, 0.45);
}

/* NEED stands out from the bay fills. */
.needSquare {
  border-color: rgb(92, 184, 92);
  color: rgb(92, 184, 92);
}

.baseRow {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0 4px;
  color: rgb(136, 136, 136);
}

.baseSelect {
  background: rgb(66, 54, 29);
  color: rgb(187, 187, 187);
  border: none;
  border-bottom: 1px solid rgb(141, 100, 17);
  font-size: inherit;
}

.baseHint {
  margin-left: auto;
}

/* The bay is already full with the listed materials. */
.shipFull {
  opacity: 0.35;
}

.loadSummary {
  padding: 4px 0 0;
  color: rgb(136, 136, 136);
}

/* Allow a second row of quantity choices in narrow buffers. */
@container (max-width: 360px) {
  .dropZone {
    min-height: 100px;
  }
}
</style>
