import { getPrunId } from '@src/infrastructure/prun-ui/attributes';
import { alertsStore } from '@src/infrastructure/prun-api/data/alerts';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';

function onTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, C.AlertListItem.container), container => {
    const alert = alertsStore.getById(getPrunId(container));
    if (alert?.type !== 'COGC_PROGRAM_CHANGED' || !alert.naturalId) {
      return;
    }
    // The CoGC buffer shows the new program and the vote for the next one.
    container.addEventListener('click', e => {
      showBuffer(`COGC ${alert.naturalId}`);
      e.preventDefault();
      e.stopPropagation();
    });
  });
}

function init() {
  tiles.observe('NOTS', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'NOTS: Opens the CoGC buffer with the program vote on a "CoGC program changed" notification click.',
);
