// Smallest price step on the commodity exchanges.
export const priceTick = 0.01;

export interface BookOrder {
  id: string;
  ownerId: string;
  price: number;
}

export interface QuickPrices {
  // Best ask and bid of other traders.
  bestAsk?: number;
  bestBid?: number;
  // One tick under the best other ask, and one tick over the best other bid.
  sellPrice?: number;
  buyPrice?: number;
  // True when the price would trade at once against the other side of the book.
  sellCrosses: boolean;
  buyCrosses: boolean;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

// Asks and bids can come in any order; own orders never count as competition.
// An order is own when its trader is my company or its id is one of my open orders.
export function getQuickPrices(
  asks: BookOrder[],
  bids: BookOrder[],
  own: { companyId?: string; orderIds?: Set<string> } = {},
): QuickPrices {
  const isOther = (x: BookOrder) => x.ownerId !== own.companyId && !own.orderIds?.has(x.id);
  const otherAsks = asks.filter(isOther).map(x => x.price);
  const otherBids = bids.filter(isOther).map(x => x.price);
  const bestAsk = otherAsks.length > 0 ? Math.min(...otherAsks) : undefined;
  const bestBid = otherBids.length > 0 ? Math.max(...otherBids) : undefined;
  const sellPrice =
    bestAsk !== undefined ? Math.max(priceTick, round(bestAsk - priceTick)) : undefined;
  const buyPrice = bestBid !== undefined ? round(bestBid + priceTick) : undefined;
  return {
    bestAsk,
    bestBid,
    sellPrice,
    buyPrice,
    sellCrosses: sellPrice !== undefined && bestBid !== undefined && sellPrice <= bestBid,
    buyCrosses: buyPrice !== undefined && bestAsk !== undefined && buyPrice >= bestAsk,
  };
}
