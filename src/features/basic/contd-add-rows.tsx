import PrunButton from '@src/components/PrunButton.vue';
import { clickElement } from '@src/util';
import { waitUntil } from '@src/utils/wait';
import $style from './contd-add-rows.module.css';

const maxRows = 30;

function isAddRowButton(button: Element) {
  return (
    button.textContent === L.TemplateSelection.action.addCommodity() ||
    button.textContent === L.TemplateSelection.action.addShipment()
  );
}

function onTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, 'button'), button => {
    if (!isAddRowButton(button)) {
      return;
    }
    const count = ref(5);
    let adding = false;

    // Clicks the game button once per row and waits for each row, like a player would.
    async function addRows() {
      if (adding) {
        return;
      }
      adding = true;
      try {
        const target = Math.min(Math.max(Math.floor(count.value), 1), maxRows);
        for (let i = 0; i < target; i++) {
          const before = _$$(tile.anchor, C.TemplateSelection.group).length;
          await clickElement(button as HTMLElement);
          const added = await waitUntil(
            () => _$$(tile.anchor, C.TemplateSelection.group).length > before,
            2000,
          );
          if (!added) {
            break;
          }
        }
      } finally {
        adding = false;
      }
    }

    createFragmentApp(() => (
      <span class={$style.container} data-tooltip="Adds this many rows at once.">
        <input
          class={$style.input}
          type="number"
          min={1}
          max={maxRows}
          value={count.value}
          onInput={e => (count.value = Number((e.target as HTMLInputElement).value))}
          onKeydown={e => {
            // Enter would submit the game form.
            e.stopPropagation();
            if (e.key === 'Enter') {
              e.preventDefault();
              void addRows();
            }
          }}
        />
        <PrunButton dark inline onClick={addRows}>
          + ROWS
        </PrunButton>
      </span>
    )).after(button);
  });
}

function init() {
  tiles.observe('CONTD', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'CONTD: Adds a row count beside the add commodity button to add several rows in one click.',
);
