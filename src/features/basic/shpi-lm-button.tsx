import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { getLocationLineFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import ContextControlsItem from '@src/components/ContextControlsItem.vue';
import { openCompanionBuffer } from '@src/infrastructure/prun-ui/companion-buffer';

async function onTileReady(tile: PrunTile) {
  const ship = computed(() => shipsStore.getByRegistration(tile.parameter));

  // Natural id of the planet or station where the ship is landed.
  const locationNaturalId = computed(() => {
    if (ship.value?.flightId !== null) {
      return undefined;
    }
    return getLocationLineFromAddress(ship.value.address)?.entity.naturalId;
  });

  const contextBar = await $(tile.frame, C.ContextControls.container);

  createFragmentApp(() => {
    const id = locationNaturalId.value;
    if (!id) {
      return null;
    }
    const cmd = `LM ${id}`;
    return <ContextControlsItem cmd={cmd} onShiftClick={() => openCompanionBuffer(tile, cmd)} />;
  }).appendTo(contextBar);
}

function init() {
  tiles.observe('SHPI', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'SHPI: Adds an LM context button for the local market where the ship is landed.',
);
