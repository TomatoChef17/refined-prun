import { userData } from '@src/store/user-data';

export interface HomeStation {
  naturalId: string;
  name: string;
  exchange: UserData.Exchange;
}

// The six commodity exchange stations and their exchange codes.
export const homeStations: HomeStation[] = [
  { naturalId: 'ANT', name: 'Antares Station', exchange: 'AI1' },
  { naturalId: 'BEN', name: 'Benten Station', exchange: 'CI1' },
  { naturalId: 'ARC', name: 'Arclight Station', exchange: 'CI2' },
  { naturalId: 'HRT', name: 'Hortus Station', exchange: 'IC1' },
  { naturalId: 'MOR', name: 'Moria Station', exchange: 'NC1' },
  { naturalId: 'HUB', name: 'Hubur Station', exchange: 'NC2' },
];

const fallback = homeStations.find(x => x.naturalId === 'HRT')!;

// The station the player uses as a trade hub: its warehouse is the stock column in
// XIT BURN and XIT SUPPLY, and its exchange is where sell orders are watched.
export const homeStation = computed(
  () => homeStations.find(x => x.naturalId === userData.cosm.homeStation) ?? fallback,
);
