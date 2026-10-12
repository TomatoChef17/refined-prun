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
  // Planets where goods bought under purchase contracts are not counted.
  excludePurchaseInbound: [] as string[],
  // Planets whose production inputs are supplied by someone else (managed bases):
  // only workforce materials count there.
  managedProduction: [] as string[],
  expand: [] as string[],
  sortBy: '' as string,
  sortDesc: false,
  // Columns hidden in this tile (see columns.ts).
  hiddenColumns: [] as string[],
  showColumnPicker: false,
});
