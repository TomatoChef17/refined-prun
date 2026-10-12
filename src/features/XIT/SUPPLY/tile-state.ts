import { createTileStateHook } from '@src/store/user-data-tiles';

export const useTileState = createTileStateHook({
  // 'SET' uses the resupply days of XIT SET (per planet), otherwise a number of days.
  target: 'SET' as string,
  // MISSING: only inputs missing at HRT, NEED: inputs with a need, ALL: every consumed input.
  show: 'NEED' as string,
  prod: true,
  wf: true,
  // Missing inputs left out of COPY LIST.
  unchecked: [] as string[],
});
