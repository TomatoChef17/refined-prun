import OnSaleRow from './OnSaleRow.vue';
import { getInvStore } from '@src/core/store-id';
import { homeStations } from '@src/core/home-station';
import { warehousesStore } from '@src/infrastructure/prun-api/data/warehouses';

function onTileReady(tile: PrunTile) {
  // The exchange of the station whose warehouse this INV shows, if any.
  const exchange = computed(() => {
    const store = getInvStore(tile.parameter);
    if (store === undefined) {
      return undefined;
    }
    const station = homeStations.find(
      x => warehousesStore.getByEntityNaturalId(x.naturalId)?.storeId === store.id,
    );
    return station?.exchange;
  });
  subscribe($$(tile.anchor, C.InventoryView.grid), grid => {
    createFragmentApp(() =>
      exchange.value !== undefined ? <OnSaleRow exchange={exchange.value} /> : null,
    ).after(grid);
  });
}

function init() {
  tiles.observe('INV', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'INV: Shows my open sell orders under each exchange station warehouse, red when undercut.',
);
