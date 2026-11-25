/*******************************************************************************

    Origin uBlock - MV3 Stealth & Anti-Tracking DNR Rules
    GPL-3.0-or-later

*******************************************************************************/

import { dnr } from './ext-compat.js';
import { localRead, localWrite } from './ext.js';
import { ubolErr, ubolLog } from './debug.js';
import { getFilteringModeDetails } from './mode-manager.js';

export const STEALTH_RULE_BASE = 6000000;
export const STEALTH_RULE_IDS = [
    STEALTH_RULE_BASE + 1, // blockPing
    STEALTH_RULE_BASE + 2, // stripReferrer
    STEALTH_RULE_BASE + 3, // stripClientData
    STEALTH_RULE_BASE + 4, // stripUtmCustom
];

export const DEFAULT_STEALTH_CONFIG = Object.freeze({
    blockPing: false,
    stripReferrer: false,
    stripClientData: false,
    stripUtmCustom: false,
});

const TRACKING_QUERY_PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
    'fbclid', 'gclid', 'dclid', 'yclid', 'mc_cid', 'mc_eid',
    '_hsenc', '_hsmi', 'igshid', 'si', 'ref_src',
];

let pendingSync = Promise.resolve();

export async function getStealthConfig() {
    const stored = await localRead('origin.stealth');
    const out = Object.assign({}, DEFAULT_STEALTH_CONFIG);
    if ( stored && typeof stored === 'object' ) {
        for ( const key of Object.keys(DEFAULT_STEALTH_CONFIG) ) {
            if ( typeof stored[key] === 'boolean' ) {
                out[key] = stored[key];
            }
        }
    }
    return out;
}

export async function setStealthConfig(patch = {}) {
    const current = await getStealthConfig();
    for ( const key of Object.keys(DEFAULT_STEALTH_CONFIG) ) {
        if ( typeof patch[key] === 'boolean' ) {
            current[key] = patch[key];
        }
    }
    await localWrite('origin.stealth', current);
    await syncStealthDnrRules();
    return current;
}

export function syncStealthDnrRules() {
    pendingSync = pendingSync.then(_syncStealthDnrRules).catch(err => {
        ubolErr(`syncStealthDnrRules/${err}`);
    });
    return pendingSync;
}

async function _syncStealthDnrRules() {
    const [ stealth, modes ] = await Promise.all([
        getStealthConfig(),
        getFilteringModeDetails(true),
    ]);
    const noneList = Array.isArray(modes?.none) ? modes.none : [];
    const globalPaused = noneList.includes('all-urls');
    const excludedDomains = noneList.filter(h => h !== 'all-urls');

    const addRules = [];
    if ( globalPaused === false ) {
        if ( stealth.blockPing ) {
            const condition = {
                domainType: 'thirdParty',
                resourceTypes: [ 'ping', 'csp_report' ],
            };
            if ( excludedDomains.length !== 0 ) {
                condition.excludedInitiatorDomains = excludedDomains;
            }
            addRules.push({
                id: STEALTH_RULE_BASE + 1,
                priority: 100,
                action: { type: 'block' },
                condition,
            });
        }
        if ( stealth.stripReferrer ) {
            const condition = {
                domainType: 'thirdParty',
                excludedResourceTypes: [ 'main_frame' ],
            };
            if ( excludedDomains.length !== 0 ) {
                condition.excludedInitiatorDomains = excludedDomains;
            }
            addRules.push({
                id: STEALTH_RULE_BASE + 2,
                priority: 100,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [
                        { header: 'Referer', operation: 'remove' },
                    ],
                },
                condition,
            });
        }
        if ( stealth.stripClientData ) {
            const condition = {
                domainType: 'thirdParty',
            };
            if ( excludedDomains.length !== 0 ) {
                condition.excludedInitiatorDomains = excludedDomains;
            }
            addRules.push({
                id: STEALTH_RULE_BASE + 3,
                priority: 100,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [
                        { header: 'X-Client-Data', operation: 'remove' },
                    ],
                },
                condition,
            });
        }
        if ( stealth.stripUtmCustom ) {
            const condition = {
                resourceTypes: [ 'main_frame' ],
            };
            if ( excludedDomains.length !== 0 ) {
                condition.excludedRequestDomains = excludedDomains;
            }
            addRules.push({
                id: STEALTH_RULE_BASE + 4,
                priority: 100,
                action: {
                    type: 'redirect',
                    redirect: {
                        transform: {
                            queryTransform: {
                                removeParams: TRACKING_QUERY_PARAMS,
                            },
                        },
                    },
                },
                condition,
            });
        }
    }

    await dnr.updateDynamicRules({
        removeRuleIds: STEALTH_RULE_IDS,
        addRules,
    });
    ubolLog(`Synced ${addRules.length} stealth DNR rules`);
    return addRules.length;
}

export async function getActiveStealthRuleCount() {
    const rules = await dnr.getDynamicRules();
    const idSet = new Set(STEALTH_RULE_IDS);
    return rules.filter(r => idSet.has(r.id)).length;
}
