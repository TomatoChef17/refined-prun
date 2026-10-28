import PrunButton from '@src/components/PrunButton.vue';
import { userData } from '@src/store/user-data';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { selectAddress } from '@src/infrastructure/prun-ui/utils/select-address';
import $style from './sfc-custom-destinations.module.css';

function onTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, C.AddressSelector.container), container => {
    createFragmentApp(() => (
      <div class={$style.row}>
        {userData.cosm.sfcDestinations.map(name => (
          <PrunButton
            key={name}
            dark
            inline
            class={$style.button}
            onClick={() => selectAddress(container, name)}>
            {name}
          </PrunButton>
        ))}
        <span
          class={$style.edit}
          data-tooltip="Edit your destination shortcuts in XIT SET COSM."
          onClick={() => showBuffer('XIT SET COSM')}>
          {userData.cosm.sfcDestinations.length === 0 ? '+ MY DESTINATIONS' : '✎'}
        </span>
      </div>
    )).after(container);
  });
}

function init() {
  tiles.observe('SFC', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'SFC: Adds your own destination shortcut buttons (XIT SET COSM) under the destination field.',
);
