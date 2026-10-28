import { closeTileWindow } from '@src/infrastructure/prun-ui/utils/close-prun-window';
import {
  canOpenCompanion,
  openCompanionBuffer,
} from '@src/infrastructure/prun-ui/companion-buffer';

// A buffer opened this long after a shift-click is taken as its result.
const pendingTimeoutMs = 3000;

interface Pending {
  // Commands the game is expected to open, or undefined for any command.
  commands?: string[];
  until: number;
  onOpened: (opened: PrunTile) => void;
}

let pending: Pending | undefined;

// Lets the game open its buffer as usual, then hands the new tile to onOpened.
function expectBuffer(commands: string[] | undefined, onOpened: (opened: PrunTile) => void) {
  pending = { commands, until: Date.now() + pendingTimeoutMs, onOpened };
}

function onAnyTileReady(tile: PrunTile) {
  const current = pending;
  if (!current || Date.now() > current.until || tile.docked) {
    return;
  }
  if (current.commands && !current.commands.includes(tile.command.toUpperCase())) {
    return;
  }
  pending = undefined;
  current.onOpened(tile);
}

// Moves the buffer the game just opened next to the source tile.
function moveNextTo(source: PrunTile) {
  return (opened: PrunTile) => {
    // A docked source cannot get a companion: keep the new window as the game opened it.
    if (!canOpenCompanion(source)) {
      return;
    }
    const command = opened.fullCommand;
    closeTileWindow(opened);
    void openCompanionBuffer(source, command);
  };
}

// PROD: the Queue and Order buttons of a line open PRODQ and PRODCO side by side.
function onProdReady(tile: PrunTile) {
  tile.anchor.addEventListener(
    'click',
    e => {
      if (!e.shiftKey || !(e.target instanceof Element)) {
        return;
      }
      const button = e.target.closest('button');
      const row = button?.closest('tr');
      if (!button || !row) {
        return;
      }
      const buttons = _$$(row, 'button');
      const index = buttons.indexOf(button);
      // The last two buttons of a line row are Queue (PRODQ) and Order (PRODCO).
      const queueIndex = buttons.length - 2;
      if (buttons.length < 2 || index < queueIndex) {
        return;
      }
      const opens = index === queueIndex ? 'PRODQ' : 'PRODCO';
      const other = opens === 'PRODQ' ? 'PRODCO' : 'PRODQ';
      expectBuffer([opens], opened => {
        if (opened.parameter) {
          void openCompanionBuffer(opened, `${other} ${opened.parameter}`);
        }
      });
    },
    true,
  );
}

// POPI: the details button opens POPID next to POPI.
function onPopiReady(tile: PrunTile) {
  tile.anchor.addEventListener(
    'click',
    e => {
      if (e.shiftKey && e.target instanceof Element && e.target.closest('button')) {
        expectBuffer(['POPID'], moveNextTo(tile));
      }
    },
    true,
  );
}

// NOTS: a notification opens its target next to the notification list.
function onNotsReady(tile: PrunTile) {
  tile.anchor.addEventListener(
    'click',
    e => {
      if (
        e.shiftKey &&
        e.target instanceof Element &&
        e.target.closest(`.${C.AlertListItem.container}`)
      ) {
        expectBuffer(undefined, moveNextTo(tile));
      }
    },
    true,
  );
}

function init() {
  tiles.observe('PROD', onProdReady);
  tiles.observe('POPI', onPopiReady);
  tiles.observe('NOTS', onNotsReady);
  tiles.observeAll(onAnyTileReady);
}

features.add(
  import.meta.url,
  init,
  'Shift-click opens related buffers side by side: PRODQ + PRODCO from PROD, POPID next to POPI, and a notification target next to NOTS.',
);
