export interface OnSaleItem {
  ticker: string;
  amount: number;
  // Lowest limit of my sell orders for this ticker.
  price: number;
  // Lowest ask of the other sellers, if known.
  bestOther: number | undefined;
  // True when the other asks come from a live order book, false when from the price snapshot.
  live: boolean;
  undercut: boolean;
}

interface SellOrder {
  id: string;
  ticker: string;
  amount: number;
  price: number;
}

interface BookOrder {
  id: string;
  price: number;
}

// Groups my sell orders by ticker and checks if another seller asks less.
// The live book excludes my own orders by id. The snapshot ask may be my own order,
// so only a lower snapshot ask counts as undercut.
export function getOnSaleItems(
  orders: SellOrder[],
  getBook: (ticker: string) => BookOrder[] | undefined,
  getSnapshotAsk: (ticker: string) => number | undefined,
): OnSaleItem[] {
  const myIds = new Set(orders.map(x => x.id));
  const byTicker = new Map<string, { amount: number; price: number }>();
  for (const order of orders) {
    const item = byTicker.get(order.ticker);
    if (item) {
      item.amount += order.amount;
      item.price = Math.min(item.price, order.price);
    } else {
      byTicker.set(order.ticker, { amount: order.amount, price: order.price });
    }
  }
  const items: OnSaleItem[] = [];
  for (const [ticker, { amount, price }] of byTicker) {
    const book = getBook(ticker);
    let bestOther: number | undefined;
    if (book) {
      const others = book.filter(x => !myIds.has(x.id)).map(x => x.price);
      bestOther = others.length > 0 ? Math.min(...others) : undefined;
    } else {
      bestOther = getSnapshotAsk(ticker);
    }
    items.push({
      ticker,
      amount,
      price,
      bestOther,
      live: book !== undefined,
      undercut: bestOther !== undefined && bestOther < price,
    });
  }
  return items.sort((a, b) => a.ticker.localeCompare(b.ticker));
}
