import FavoriteBar from './FavoriteBar.vue';
import { userData } from '@src/store/user-data';
import { refValue } from '@src/utils/reactive-dom';
import { changeInputValue, clickElement, focusElement } from '@src/util';
import { sleep } from '@src/utils/sleep';
import { contractsStore } from '@src/infrastructure/prun-api/data/contracts';

// Remembers the partner player of every contract the game sends, so the count keeps
// old contracts after the game stops listing them.
function recordContracts(contracts: PrunApi.Contract[] | undefined) {
  const known = userData.conts.partnerContracts;
  let changed = false;
  const next = { ...known };
  for (const contract of contracts ?? []) {
    const code = contract.partner.code;
    const name = (code ? userData.conts.players[code] : undefined) ?? contract.partner.name;
    const key = name?.toLowerCase();
    if (key && next[contract.id] !== key) {
      next[contract.id] = key;
      changed = true;
    }
  }
  if (changed) {
    userData.conts.partnerContracts = next;
  }
}

const contractCounts = computed(() => {
  const counts = new Map<string, number>();
  for (const name of Object.values(userData.conts.partnerContracts)) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
});

function countFor(name: string) {
  return contractCounts.value.get(name.toLowerCase()) ?? 0;
}

// Favorites with the most contracts first; ties keep the order they were added in.
const favorites = computed(() =>
  userData.conts.favorites
    .map((name, index) => ({ name, index, count: countFor(name) }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.index - b.index)),
);
const favoriteNames = computed(() => favorites.value.map(x => x.name));

function isFavorite(name: string) {
  return userData.conts.favorites.some(x => x.toLowerCase() === name.toLowerCase());
}

function addFavorite(name: string) {
  name = name.trim();
  if (name && !isFavorite(name)) {
    userData.conts.favorites = [...userData.conts.favorites, name];
  }
}

function removeFavorite(name: string) {
  userData.conts.favorites = userData.conts.favorites.filter(
    x => x.toLowerCase() !== name.toLowerCase(),
  );
}

// The game renders the search results next to the selector, so look in the whole tile.
function getEntries(root: Element) {
  const entries = new Set<Element>();
  for (const cls of [C.UserSelector.suggestionEntry, C.UserSelector.suggestion]) {
    for (const element of _$$(root, cls)) {
      entries.add(element);
    }
  }
  return [...entries];
}

function getEntryName(entry: Element) {
  return (_$(entry, C.UserSelector.suggestionName) ?? entry).textContent?.trim();
}

// Types the name like the player does, then clicks the matching search result.
async function pickRecipient(root: Element, input: HTMLInputElement, name: string) {
  input.focus();
  focusElement(input);
  changeInputValue(input, name);
  for (let i = 0; i < 30; i++) {
    const match = getEntries(root).find(x => getEntryName(x)?.toLowerCase() === name.toLowerCase());
    if (match) {
      await clickElement(match as HTMLElement);
      return;
    }
    await sleep(100);
  }
}

function onTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, C.UserSelector.container), async selector => {
    const input = (await $(selector, 'input')) as HTMLInputElement;
    const typed = refValue(input);
    // Full-width bar under the Recipient row: the search results open above it.
    const row =
      selector.closest(`.${C.forms.formComponent}`) ??
      selector.closest(`.${C.FormComponent.containerActive}`) ??
      selector;
    createFragmentApp(
      FavoriteBar,
      reactive({
        names: favoriteNames,
        counts: computed(() => Object.fromEntries(favorites.value.map(x => [x.name, x.count]))),
        current: typed,
        onPick: (name: string) => void pickRecipient(tile.anchor, input, name),
        onRemove: removeFavorite,
        onAdd: addFavorite,
      }),
    ).after(row);
  });
}

function init() {
  watch(() => contractsStore.all.value, recordContracts, { immediate: true });
  tiles.observe('CONTD', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'CONTD: Favorite recipients as one-click chips under the recipient field, most contracts first.',
);
