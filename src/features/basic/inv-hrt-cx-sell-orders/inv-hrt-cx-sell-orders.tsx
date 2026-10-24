import OnSaleRow from './OnSaleRow.vue';
import { getInvStore } from '@src/core/store-id';
import { warehousesStore } from '@src/infrastructure/prun-api/data/warehouses';

// The warehouse at Hortus Station holds the goods for the IC1 exchange.
const station = 'HRT';
const exchange = 'IC1';

function onTileReady(tile: PrunTile) {
  const isStationWarehouse = computed(() => {
    const store = getInvStore(tile.parameter);
    const warehouse = warehousesStore.getByEntityNaturalId(station);
    return store !== undefined && store.id === warehouse?.storeId;
  });
  subscribe($$(tile.anchor, C.StoreView.container), container => {
    createFragmentApp(() =>
      isStationWarehouse.value ? <OnSaleRow exchange={exchange} /> : null,
    ).after(container);
  });
}

function init() {
  tiles.observe('INV', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'INV: Shows my open IC1 sell orders under the Hortus Station warehouse, red when undercut.',
);
