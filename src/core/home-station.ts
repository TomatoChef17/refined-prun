import { userData } from '@src/store/user-data';

export interface HomeStation {
  naturalId: string;
  name: string;
  exchange: UserData.Exchange;
  currency: string;
}

// The six commodity exchange stations and their exchange codes.
export const homeStations: HomeStation[] = [
  { naturalId: 'ANT', name: 'Antares Station', exchange: 'AI1', currency: 'AIC' },
  { naturalId: 'BEN', name: 'Benten Station', exchange: 'CI1', currency: 'CIS' },
  { naturalId: 'ARC', name: 'Arclight Station', exchange: 'CI2', currency: 'CIS' },
  { naturalId: 'HRT', name: 'Hortus Station', exchange: 'IC1', currency: 'ICA' },
  { naturalId: 'MOR', name: 'Moria Station', exchange: 'NC1', currency: 'NCC' },
  { naturalId: 'HUB', name: 'Hubur Station', exchange: 'NC2', currency: 'NCC' },
];

const fallback = homeStations.find(x => x.naturalId === 'HRT')!;

// A BUY contract JSON for the CONTD paste box: delivered to the home station warehouse.
export function buildBuyContractJson(
  station: HomeStation,
  materials: { ticker: string; amount: number; price?: number }[],
  deadlineDays = 7,
) {
  return JSON.stringify({
    type: 'BUY',
    currency: station.currency,
    deadline: deadlineDays,
    location: station.naturalId,
    materials: materials.map(x => ({
      ticker: x.ticker,
      amount: Math.ceil(x.amount),
      ...(x.price !== undefined && x.price > 0 ? { price: Math.round(x.price * 100) / 100 } : {}),
    })),
  });
}

// The station the player uses as a trade hub: its warehouse is the stock column in
// XIT BURN and XIT SUPPLY, and its exchange is where sell orders are watched.
export const homeStation = computed(
  () => homeStations.find(x => x.naturalId === userData.cosm.homeStation) ?? fallback,
);
