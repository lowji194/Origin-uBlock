/*******************************************************************************

    Origin uBlock - Timed Protection Pause (Snooze)
    GPL-3.0-or-later

*******************************************************************************/

import { browser, localRead, localWrite } from './ext.js';
import { broadcastMessage } from './utils.js';

const STORAGE_KEY = 'origin.timers';
const ALARM_GLOBAL = 'origin.resume.global';
const ALARM_SITE_PREFIX = 'origin.resume.site:';

let pendingOp = Promise.resolve();
const serial = fn => {
    const next = pendingOp.then(fn);
    pendingOp = next.catch(() => {});
    return next;
};

function sanitizeState(raw) {
    const out = { global: null, sites: {} };
    if ( !raw || typeof raw !== 'object' ) { return out; }
    if ( raw.global && typeof raw.global.resumeAt === 'number' ) {
        out.global = {
            resumeAt: raw.global.resumeAt,
            prevMode: Number(raw.global.prevMode) || 2,
        };
    }
    if ( raw.sites && typeof raw.sites === 'object' ) {
        for ( const [ hn, info ] of Object.entries(raw.sites) ) {
            if ( info && typeof info.resumeAt === 'number' ) {
                out.sites[hn] = {
                    resumeAt: info.resumeAt,
                    prevLevel: Number(info.prevLevel) || 2,
                };
            }
        }
    }
    return out;
}

export async function getTimers() {
    const state = sanitizeState(await localRead(STORAGE_KEY));
    const now = Date.now();
    if ( state.global && state.global.resumeAt <= now ) {
        state.global = null;
    }
    for ( const [ hn, info ] of Object.entries(state.sites) ) {
        if ( info.resumeAt <= now ) {
            delete state.sites[hn];
        }
    }
    return state;
}

export function scheduleTimedPause(options, handlers) {
    return serial(async () => {
        const { scope, hostname = '', minutes } = options || {};
        const mins = Math.min(Math.max(Number(minutes) || 0, 0.5), 1440);
        const resumeAt = Date.now() + Math.round(mins * 60 * 1000);
        const state = sanitizeState(await localRead(STORAGE_KEY));

        if ( scope === 'global' ) {
            const currentMode = await handlers.getDefaultMode();
            const prevMode = currentMode > 0 ? currentMode : (state.global?.prevMode || 2);
            if ( currentMode > 0 ) {
                await handlers.pauseGlobal();
            }
            state.global = { resumeAt, prevMode };
            await localWrite(STORAGE_KEY, state);
            await browser.alarms.create(ALARM_GLOBAL, { when: resumeAt });
            broadcastMessage({ originTimers: state });
            return state;
        }

        if ( scope === 'site' && typeof hostname === 'string' && hostname.includes('.') ) {
            const currentLevel = await handlers.getSiteMode(hostname);
            const prevLevel = currentLevel > 0 ? currentLevel : (state.sites[hostname]?.prevLevel || 2);
            if ( currentLevel > 0 ) {
                await handlers.pauseSite(hostname);
            }
            state.sites[hostname] = { resumeAt, prevLevel };
            await localWrite(STORAGE_KEY, state);
            await browser.alarms.create(ALARM_SITE_PREFIX + hostname, { when: resumeAt });
            broadcastMessage({ originTimers: state });
            return state;
        }

        return state;
    });
}

export function clearTimerRecord(scope, hostname = '') {
    return serial(async () => {
        const state = sanitizeState(await localRead(STORAGE_KEY));
        let changed = false;
        if ( scope === 'global' && state.global ) {
            state.global = null;
            changed = true;
            await browser.alarms.clear(ALARM_GLOBAL).catch(() => {});
        } else if ( scope === 'site' && hostname && state.sites[hostname] ) {
            delete state.sites[hostname];
            changed = true;
            await browser.alarms.clear(ALARM_SITE_PREFIX + hostname).catch(() => {});
        }
        if ( changed ) {
            await localWrite(STORAGE_KEY, state);
            broadcastMessage({ originTimers: state });
        }
        return state;
    });
}

export function cancelAndResumeTimer(options, handlers) {
    return serial(async () => {
        const { scope, hostname = '' } = options || {};
        const state = sanitizeState(await localRead(STORAGE_KEY));
        if ( scope === 'global' && state.global ) {
            state.global = null;
            await localWrite(STORAGE_KEY, state);
            await browser.alarms.clear(ALARM_GLOBAL).catch(() => {});
            await handlers.resumeGlobal();
            broadcastMessage({ originTimers: state });
            return state;
        }
        if ( scope === 'site' && hostname && state.sites[hostname] ) {
            const prevLevel = state.sites[hostname].prevLevel || 2;
            delete state.sites[hostname];
            await localWrite(STORAGE_KEY, state);
            await browser.alarms.clear(ALARM_SITE_PREFIX + hostname).catch(() => {});
            await handlers.resumeSite(hostname, prevLevel);
            broadcastMessage({ originTimers: state });
            return state;
        }
        return state;
    });
}

export function handleTimerAlarm(alarmName, handlers) {
    if ( alarmName === ALARM_GLOBAL ) {
        return cancelAndResumeTimer({ scope: 'global' }, handlers);
    }
    if ( alarmName.startsWith(ALARM_SITE_PREFIX) ) {
        const hostname = alarmName.slice(ALARM_SITE_PREFIX.length);
        return cancelAndResumeTimer({ scope: 'site', hostname }, handlers);
    }
}

export function processDueTimers(handlers) {
    return serial(async () => {
        const state = sanitizeState(await localRead(STORAGE_KEY));
        const now = Date.now();
        let changed = false;

        if ( state.global ) {
            if ( state.global.resumeAt <= now ) {
                state.global = null;
                changed = true;
                await browser.alarms.clear(ALARM_GLOBAL).catch(() => {});
                await handlers.resumeGlobal();
            } else {
                await browser.alarms.create(ALARM_GLOBAL, { when: state.global.resumeAt });
            }
        }

        for ( const [ hostname, info ] of Object.entries(state.sites) ) {
            if ( info.resumeAt <= now ) {
                delete state.sites[hostname];
                changed = true;
                await browser.alarms.clear(ALARM_SITE_PREFIX + hostname).catch(() => {});
                await handlers.resumeSite(hostname, info.prevLevel || 2);
            } else {
                await browser.alarms.create(ALARM_SITE_PREFIX + hostname, { when: info.resumeAt });
            }
        }

        if ( changed ) {
            await localWrite(STORAGE_KEY, state);
            broadcastMessage({ originTimers: state });
        }
        return state;
    });
}
