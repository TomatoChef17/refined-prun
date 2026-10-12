import { useTileState } from '@src/features/XIT/BURN/tile-state';

// Columns that can be hidden in XIT BURN. CMD and the material icon always stay.
export const BURN_COLUMNS = [
  { id: 'burn', label: 'BURN' },
  { id: 'inv', label: 'INV' },
  { id: 'days', label: 'DAYS' },
  { id: 'daysAll', label: 'DAYS ALL' },
  { id: 'need', label: 'NEED' },
  { id: 'invHrt', label: 'INV HRT' },
  { id: 'buy', label: 'BUY' },
] as const;

export type BurnColumnId = (typeof BURN_COLUMNS)[number]['id'];

export function useBurnColumns() {
  const hidden = useTileState('hiddenColumns');
  const io = useTileState('io');

  const show = computed(() => {
    const set = new Set(hidden.value);
    return Object.fromEntries(BURN_COLUMNS.map(x => [x.id, !set.has(x.id)])) as Record<
      BurnColumnId,
      boolean
    >;
  });

  function toggle(id: BurnColumnId) {
    hidden.value = hidden.value.includes(id)
      ? hidden.value.filter(x => x !== id)
      : [...hidden.value, id];
  }

  // Cells under the planet name: icon + burn (3 with I/O) + inv.
  const nameColspan = computed(
    () => 1 + (show.value.burn ? (io.value ? 3 : 1) : 0) + (show.value.inv ? 1 : 0),
  );

  // Cells under the planet buttons: need, INV HRT, buy and the CMD column.
  const actionColspan = computed(
    () => 1 + [show.value.need, show.value.invHrt, show.value.buy].filter(Boolean).length,
  );

  return { show, toggle, nameColspan, actionColspan };
}
