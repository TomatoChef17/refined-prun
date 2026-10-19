import { alertsStore } from '@src/infrastructure/prun-api/data/alerts';
import { onNodeDisconnected } from '@src/utils/on-node-disconnected';
import NextReport from './NextReport.vue';
import { parseReportAge } from './report-time';

// Exact time of the last report from the game alert, when the player has one for this planet.
function getAlertReportTime(planet: string) {
  const key = planet.toLowerCase();
  let latest: number | undefined;
  for (const alert of alertsStore.all.value ?? []) {
    if (alert.type !== 'POPULATION_REPORT_AVAILABLE') {
      continue;
    }
    if (!JSON.stringify(alert).toLowerCase().includes(key)) {
      continue;
    }
    const time = alert.time.timestamp;
    if (latest === undefined || time > latest) {
      latest = time;
    }
  }
  return latest;
}

function onTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, C.Population.controls), controls => {
    const ageText = ref(controls.textContent ?? '');
    const observer = new MutationObserver(() => {
      ageText.value = controls.textContent ?? '';
    });
    observer.observe(controls, { childList: true, subtree: true, characterData: true });
    onNodeDisconnected(controls, () => observer.disconnect());

    // Real report time from the age text: the game rounds the age down,
    // so the report is up to one unit older. Take the middle of that range.
    const estimated = computed(() => {
      const age = parseReportAge(ageText.value);
      return age ? Date.now() - age.ms - age.precisionMs / 2 : undefined;
    });

    const fromAlert = computed(() => {
      const time = getAlertReportTime(tile.parameter ?? '');
      const guess = estimated.value;
      // Use the alert only when it is the report shown (or one a whole week before it).
      if (time === undefined || guess === undefined) {
        return undefined;
      }
      const week = 7 * 24 * 60 * 60 * 1000;
      const offset = (((guess - time) % week) + week) % week;
      return Math.min(offset, week - offset) < 2 * 60 * 60 * 1000 ? time : undefined;
    });

    const props = reactive({
      lastReport: computed(() => fromAlert.value ?? estimated.value),
      exact: computed(() => fromAlert.value !== undefined),
    });
    createFragmentApp(NextReport, props).after(controls);
  });
}

function init() {
  tiles.observe('POPR', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'POPR: Shows the date and local time of the next population report.',
);
