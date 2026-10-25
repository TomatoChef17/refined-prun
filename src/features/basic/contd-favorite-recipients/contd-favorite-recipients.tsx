import $style from './contd-favorite-recipients.module.css';
import FavoriteBar from './FavoriteBar.vue';
import { userData } from '@src/store/user-data';
import { refValue } from '@src/utils/reactive-dom';
import { watchEffectWhileNodeAlive } from '@src/utils/watch';
import { changeInputValue, clickElement, focusElement } from '@src/util';
import { sleep } from '@src/utils/sleep';

const favorites = computed(() => userData.conts.favorites);

function isFavorite(name: string) {
  return favorites.value.some(x => x.toLowerCase() === name.toLowerCase());
}

function addFavorite(name: string) {
  if (name && !isFavorite(name)) {
    userData.conts.favorites = [...favorites.value, name];
  }
}

function removeFavorite(name: string) {
  userData.conts.favorites = favorites.value.filter(x => x.toLowerCase() !== name.toLowerCase());
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

// The game renders the search results next to the selector, so look in the whole tile.
// The entry element is the closest suggestion entry around a name.
function toEntry(element: Element) {
  return (element.closest(`.${C.UserSelector.suggestionEntry}`) ??
    element.closest(`.${C.UserSelector.suggestion}`) ??
    element) as HTMLElement;
}

function getEntries(root: Element) {
  const entries = new Set<HTMLElement>();
  for (const cls of [
    C.UserSelector.suggestionEntry,
    C.UserSelector.suggestion,
    C.UserSelector.suggestionName,
  ]) {
    for (const element of _$$(root, cls)) {
      entries.add(toEntry(element));
    }
  }
  return [...entries];
}

function getEntryName(entry: Element) {
  return (_$(entry, C.UserSelector.suggestionName) ?? entry).textContent
    ?.replace(/[★☆]/g, '')
    .trim();
}

function onTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, C.UserSelector.container), async selector => {
    const input = (await $(selector, 'input')) as HTMLInputElement;
    const typed = refValue(input);
    // Full-width bar above the whole Recipient row.
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
    ).before(row);
  });

  for (const cls of [
    C.UserSelector.suggestionEntry,
    C.UserSelector.suggestion,
    C.UserSelector.suggestionName,
  ]) {
    subscribe($$(tile.anchor, cls), element => addStar(toEntry(element)));
  }
}

function addStar(entry: HTMLElement) {
  if (entry.dataset.rpFavorite !== undefined) {
    return;
  }
  const name = getEntryName(entry);
  if (!name) {
    return;
  }
  entry.dataset.rpFavorite = '';
  entry.classList.add($style.entry);
  const star = document.createElement('span');
  star.classList.add($style.star);
  star.addEventListener('mousedown', e => {
    e.preventDefault();
    e.stopPropagation();
  });
  star.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    if (isFavorite(name)) {
      removeFavorite(name);
    } else {
      addFavorite(name);
    }
  });
  entry.appendChild(star);
  watchEffectWhileNodeAlive(entry, () => {
    const on = isFavorite(name);
    entry.classList.toggle($style.favoriteEntry, on);
    star.classList.toggle($style.starOn, on);
    star.textContent = on ? '\u2605' : '\u2606';
    star.dataset.tooltip = on ? 'Remove from favorites' : 'Add to favorites';
  });
}

function init() {
  applyCssRule('CONTD', `.${C.UserSelector.suggestionsList}`, $style.suggestionsList);
  tiles.observe('CONTD', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'CONTD: Favorite recipients pinned above the recipient field and first in the search list.',
);
