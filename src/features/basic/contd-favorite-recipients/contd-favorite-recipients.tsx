import FavoriteBar from './FavoriteBar.vue';
import { userData } from '@src/store/user-data';
import { refValue } from '@src/utils/reactive-dom';
import { changeInputValue, clickElement, focusElement } from '@src/util';
import { sleep } from '@src/utils/sleep';

const favorites = computed(() => userData.conts.favorites);

function isFavorite(name: string) {
  return favorites.value.some(x => x.toLowerCase() === name.toLowerCase());
}

function addFavorite(name: string) {
  name = name.trim();
  if (name && !isFavorite(name)) {
    userData.conts.favorites = [...favorites.value, name];
  }
}

function removeFavorite(name: string) {
  userData.conts.favorites = favorites.value.filter(x => x.toLowerCase() !== name.toLowerCase());
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
        names: favorites,
        current: typed,
        onPick: (name: string) => void pickRecipient(tile.anchor, input, name),
        onRemove: removeFavorite,
        onAdd: addFavorite,
      }),
    ).after(row);
  });
}

function init() {
  tiles.observe('CONTD', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'CONTD: Favorite recipients as one-click chips under the recipient field.',
);
