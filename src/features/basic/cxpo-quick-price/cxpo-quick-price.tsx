import QuickPriceBar from './QuickPriceBar.vue';
import { getQuickPrices } from './quick-price';
import { cxobStore } from '@src/infrastructure/prun-api/data/cxob';
import { companyStore } from '@src/infrastructure/prun-api/data/company';
import { cxosStore } from '@src/infrastructure/prun-api/data/cxos';
import { changeInputValue } from '@src/util';
import { fixed02 } from '@src/utils/format';

function toBookOrders(orders: PrunApi.CXBrokerOrder[] | undefined) {
  return (orders ?? []).map(x => ({ id: x.id, ownerId: x.trader.id, price: x.limit.amount }));
}

function onTileReady(tile: PrunTile) {
  const prices = computed(() => {
    const book = cxobStore.getByTicker(tile.parameter);
    return getQuickPrices(toBookOrders(book?.sellingOrders), toBookOrders(book?.buyingOrders), {
      companyId: companyStore.value?.id,
      orderIds: new Set((cxosStore.active.value ?? []).map(x => x.id)),
    });
  });

  subscribe($$(tile.anchor, C.ComExPlaceOrderForm.form), form => {
    // The second input of the order form is the limit price.
    const priceInput = _$$(form, 'input')[1] as HTMLInputElement | undefined;
    if (priceInput === undefined) {
      return;
    }
    createFragmentApp(
      QuickPriceBar,
      reactive({
        prices,
        onPick: (price: number) => changeInputValue(priceInput, fixed02(price)),
      }),
    ).prependTo(form);
  });
}

function init() {
  tiles.observe('CXPO', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'CXPO: Adds one-click prices one tick under the best ask and over the best bid.',
);
