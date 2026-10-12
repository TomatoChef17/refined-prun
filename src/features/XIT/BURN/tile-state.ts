import { createTileStateHook } from '@src/store/user-data-tiles';

export const useTileState = createTileStateHook({
  red: true,
  yellow: true,
  green: true,
  inf: true,
  prod: true,
  wf: true,
  io: false,
  excludeInbound: [] as string[],
  // Planets where partner ships (shipping contracts) are not counted.
  excludeContractInbound: [] as string[],
  expand: [] as string[],
  sortBy: '' as string,
  sortDesc: false,
  // Columns hidden in this tile (see columns.ts).
  hiddenColumns: [] as string[],
  showColumnPicker: false,
});
