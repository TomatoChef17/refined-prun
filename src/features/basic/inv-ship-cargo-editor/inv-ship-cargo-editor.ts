import $style from './inv-ship-cargo-editor.module.css';
import CargoAmountEditor from './CargoAmountEditor.vue';
import { getInvStore } from '@src/core/store-id';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { materialsStore } from '@src/infrastructure/prun-api/data/materials';
import { showTileOverlay } from '@src/infrastructure/prun-ui/tile-overlay';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { changeInputValue, selectMaterialInMaterialSelector } from '@src/util';

function getShipStoreId(tile: PrunTile) {
  if (tile.command === 'SHPI') {
    return shipsStore.getByRegistration(tile.parameter)?.idShipStore;
  }
  const store = getInvStore(tile.parameter);
  return store?.type === 'SHIP_STORE' ? store.id : undefined;
}

function onTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, C.StoreView.container), container => {
    subscribe($$(container, C.GridItemView.image), async image => {
      const indicator = await $(image, C.MaterialIcon.indicator);
      const label = _$(image, C.ColoredIcon.label);
      if (getShipStoreId(tile)) {
        indicator.classList.add($style.amount);
      }
      indicator.addEventListener('click', e => {
        const ticker = label?.textContent ?? '';
        const shipStoreId = getShipStoreId(tile);
        if (!shipStoreId || !materialsStore.getByTicker(ticker)) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        showTileOverlay(e, CargoAmountEditor, { shipStoreId, ticker, onTransfer: openMtra });
      });
    });
  });
}

// Opens MTRA with the material and amount filled in. The player still clicks TRANSFER.
async function openMtra(from: string, to: string, ticker: string, amount: number) {
  const window = await showBuffer(`MTRA from-${from.substring(0, 8)} to-${to.substring(0, 8)}`);
  const container = await $(window, C.MaterialSelector.container);
  if (!(await selectMaterialInMaterialSelector(container, ticker))) {
    return;
  }
  const input = _$$(window, 'input')[1] as HTMLInputElement | undefined;
  if (!input) {
    return;
  }
  changeInputValue(input, amount.toString());
  input.focus();
  input.select();
}

function init() {
  tiles.observe(['INV', 'SHPI'], onTileReady);
}

features.add(
  import.meta.url,
  init,
  'INV/SHPI: Click an item amount in a ship cargo to set a new amount and open MTRA prefilled.',
);
