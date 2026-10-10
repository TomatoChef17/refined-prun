import $style from './screen-controls-compact.module.css';
import HeadItem from './screen-tab-bar/HeadItem.vue';

const storageKey = 'rprun-screen-controls-collapsed';

function readCollapsed() {
  try {
    return localStorage.getItem(storageKey) !== 'false';
  } catch {
    return true;
  }
}

// Collapsed by default: SCRN, ADD, FLDR and FULL are behind one menu button.
const collapsed = ref(readCollapsed());
watch(collapsed, value => {
  try {
    localStorage.setItem(storageKey, String(value));
  } catch {
    // The state then lasts only for this session.
  }
});

function isGroupedItem(item: Element) {
  const label = _$(item, C.HeadItem.label)?.textContent?.trim();
  if (!label) {
    return false;
  }
  const labels = [
    'SCRN',
    'ADD',
    'FLDR',
    'FULL',
    L.ScreenControls.action.add(),
    L.ScreenControls.action.fullscreen(),
  ];
  return labels.some(x => x?.trim() === label);
}

function onContainerReady(container: HTMLElement) {
  let toggleAdded = false;

  // Only toggles a class on the game items: they stay in place and keep working.
  const apply = () => {
    for (const child of Array.from(container.children)) {
      if (child.classList.contains(C.HeadItem.container) && isGroupedItem(child)) {
        child.classList.toggle($style.collapsed, collapsed.value);
      }
    }
  };

  subscribe($$(container, C.HeadItem.label), () => {
    apply();
    if (toggleAdded) {
      return;
    }
    const first = Array.from(container.children).find(
      x => x.classList.contains(C.HeadItem.container) && isGroupedItem(x),
    );
    if (!first) {
      return;
    }
    toggleAdded = true;
    createFragmentApp(() => (
      <div
        class={$style.toggle}
        data-tooltip={collapsed.value ? 'Show SCRN / ADD / FLDR / FULL' : 'Hide the screen buttons'}
        onClick={() => (collapsed.value = !collapsed.value)}>
        <HeadItem label={collapsed.value ? '☰' : '◂'} />
      </div>
    )).before(first);
  });

  watch(collapsed, apply);
}

function init() {
  applyCssRule(`.${C.ScreenControls.currentScreenName}`, $style.currentScreenName);
  subscribe($$(document, C.ScreenControls.container), onContainerReady);
}

features.add(
  import.meta.url,
  init,
  'Screen bar: removes the empty space after the screen name and groups SCRN, ADD, FLDR and FULL behind one button.',
);
