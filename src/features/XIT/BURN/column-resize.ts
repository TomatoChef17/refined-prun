import { useTileState } from '@src/features/XIT/BURN/tile-state';

// Width of a column that has no saved width yet, after the player resized another one.
const defaultWidth = 60;
const minWidth = 24;

// Lets the player drag the right edge of a header cell to change the column width.
// The first drag freezes every visible column at its current width, so the table
// switches to a fixed layout where each column keeps exactly its width.
export function useColumnResize(columns: Ref<string[]>) {
  const saved = useTileState('colWidths');
  // Widths while a drag runs, so the tile state is written once per drag.
  const live = ref<Record<string, number> | undefined>(undefined);
  const widths = computed(() => live.value ?? saved.value);
  const isFixed = computed(() => Object.keys(widths.value).length > 0);

  const widthOf = (key: string) => widths.value[key] ?? defaultWidth;

  const tableStyle = computed(() => {
    if (!isFixed.value) {
      return {};
    }
    const total = sumBy(columns.value, widthOf);
    return { tableLayout: 'fixed', width: `${total}px` };
  });

  function colStyle(key: string) {
    return isFixed.value ? { width: `${widthOf(key)}px` } : {};
  }

  function startResize(e: MouseEvent, key: string) {
    const th = (e.target as HTMLElement).closest('th');
    const row = th?.parentElement;
    if (!th || !row) {
      return;
    }
    const start = { ...widths.value };
    if (!isFixed.value) {
      for (const cell of Array.from(row.children) as HTMLElement[]) {
        const col = cell.dataset.col;
        if (col) {
          start[col] = cell.offsetWidth;
        }
      }
    }
    const startX = e.clientX;
    const startWidth = start[key] ?? th.offsetWidth;
    live.value = start;
    const onMove = (move: MouseEvent) => {
      const width = Math.max(minWidth, Math.round(startWidth + move.clientX - startX));
      live.value = { ...live.value, [key]: width };
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      saved.value = live.value ?? saved.value;
      live.value = undefined;
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function resetWidths() {
    saved.value = {};
  }

  return { isFixed, tableStyle, colStyle, startResize, resetWidths };
}
