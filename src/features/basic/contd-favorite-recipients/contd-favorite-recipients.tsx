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
async function pickRecipient(selector: Element, input: HTMLInputElement, name: string) {
  input.focus();
  focusElement(input);
  changeInputValue(input, name);
  for (let i = 0; i < 30; i++) {
    const match = _$$(selector, C.UserSelector.suggestionEntry).find(
      x => getEntryName(x)?.toLowerCase() === name.toLowerCase(),
    );
    if (match) {
      await clickElement(match as HTMLElement);
      return;
    }
    await sleep(100);
  }
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
    createFragmentApp(
      FavoriteBar,
      reactive({
        names: favorites,
        current: typed,
        onPick: (name: string) => void pickRecipient(selector, input, name),
        onRemove: removeFavorite,
        onAdd: addFavorite,
      }),
    ).before(selector);

    subscribe($$(selector, C.UserSelector.suggestionEntry), entry => {
      const name = getEntryName(entry);
      if (!name) {
        return;
      }
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
        star.textContent = on ? '★' : '☆';
        star.dataset.tooltip = on ? 'Remove from favorites' : 'Add to favorites';
      });
    });
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
