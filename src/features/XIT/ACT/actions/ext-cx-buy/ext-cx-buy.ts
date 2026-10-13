import { act } from '@src/features/XIT/ACT/act-registry';
import Edit from '@src/features/XIT/ACT/actions/ext-cx-buy/Edit.vue';
import Configure from '@src/features/XIT/ACT/actions/cont-trade/Configure.vue';
import { CONT_TRADE } from '@src/features/XIT/ACT/action-steps/CONT_TRADE';
import { Config } from '@src/features/XIT/ACT/actions/cont-trade/config';
import { AssertFn, configurableValue } from '@src/features/XIT/ACT/shared-types';
import {
  displayLocationValue,
  resolveLocation,
} from '@src/features/XIT/ACT/actions/cont-locations';
import { billQuantities } from '@src/features/XIT/ACT/material-bill';
import { companyStore } from '@src/infrastructure/prun-api/data/company';
import { fetchJson } from '@src/utils/fetch';
import { fixed0 } from '@src/utils/format';
import {
  DEFAULT_ECAPI_URL,
  isEcapiResponse,
  planPurchases,
} from '@src/features/XIT/ACT/actions/ext-cx-buy/ecapi';

export function parseExcludeList(text: string | undefined) {
  return (text ?? '')
    .split(/[,;\n]/)
    .map(x => x.trim())
    .filter(x => x.length > 0);
}

act.addAction<Config>({
  type: 'External CX Buy',
  shortDescription: 'Buy from player vendors of an external market (PUNoted or any ECAPI market)',
  description: (action, config) => {
    if (!action.group || !action.contLocation) {
      return '--';
    }
    const location =
      action.contLocation === configurableValue
        ? (config?.location ?? 'configured location')
        : displayLocationValue(action.contLocation);
    return `Buy [${action.group}] from external vendors at ${location}`;
  },
  editComponent: Edit,
  configureComponent: Configure,
  needsConfigure: data => data.contLocation === configurableValue,
  isValidConfig: (data, config) =>
    data.contLocation !== configurableValue || config.location !== undefined,
  generateSteps: async ctx => {
    const { data, config, packageName, getMaterialGroup, getMaterialGroupPlanet, emitStep, log } =
      ctx;
    const assert: AssertFn = ctx.assert;

    const materials = await getMaterialGroup(data.group);
    assert(materials, 'Invalid material group');
    const wanted = billQuantities(materials, (_, quantity) => quantity > 0);
    assert(Object.keys(wanted).length > 0, 'Material group has no materials to buy');

    const location = resolveLocation(data.contLocation, config?.location, getMaterialGroupPlanet);
    assert(location, 'Invalid location');

    const customUrl = data.extCxUrl?.trim() ?? '';
    const url = customUrl.length > 0 ? customUrl : DEFAULT_ECAPI_URL;
    let response: unknown;
    try {
      response = await fetchJson(url);
    } catch {
      response = undefined;
    }
    assert(isEcapiResponse(response), `Could not read the vendor list from ${url}`);

    // Never buy from yourself.
    const exclude = parseExcludeList(data.extCxExclude);
    const ownCode = companyStore.value?.code;
    if (ownCode) {
      exclude.push(ownCode);
    }

    const plan = planPurchases(response, wanted, { location, exclude });
    for (const [ticker, amount] of Object.entries(plan.missing)) {
      log.warning(`No vendor has ${fixed0(amount)} ${ticker} at ${location}`);
    }
    assert(plan.purchases.length > 0, `No vendor sells these materials at ${location}`);

    for (const purchase of plan.purchases) {
      log.info(
        `${purchase.vendor}: ${Object.entries(purchase.materials)
          .map(([ticker, x]) => `${fixed0(x.quantity)} ${ticker}`)
          .join(', ')} for ${fixed0(purchase.total)} ${data.currency ?? 'ICA'}`,
      );
      emitStep(
        CONT_TRADE({
          packageName: `${packageName} - ${purchase.vendor}`,
          materials: purchase.materials,
          tradeType: 'BUYING',
          location,
          currency: data.currency ?? 'ICA',
          daysToFulfill: data.daysToFulfill ?? 3,
          recipient: purchase.vendor,
        }),
      );
    }
  },
});
