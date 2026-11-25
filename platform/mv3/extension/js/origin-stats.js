import { browser, localRead, localWrite, sessionRead, sessionWrite } from './ext.js';
let queue=Promise.resolve();
const serial=fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;};
const dateKey=()=>new Date().toLocaleDateString('en-CA');
export function observe(count,tabId){return serial(async()=>{
    if(await localRead('origin.stats.enabled')!==true)return;
    if(!Number.isSafeInteger(count)||count<0||!Number.isInteger(tabId)||tabId<0)return;
    const day=dateKey(), state=await sessionRead('origin.stats.tabs')||{};
    const before=state[tabId];
    const delta=before?.day===day?Math.max(0,count-before.count):count;
    state[tabId]={day,count:Math.max(before?.day===day?before.count:0,count)};
    await sessionWrite('origin.stats.tabs',state);
    const days=await localRead('origin.stats.days')||{};
    days[day]=(days[day]||0)+delta;
    const keys=Object.keys(days).sort();
    for(const key of keys.slice(0,-30))delete days[key];
    await localWrite('origin.stats.days',days);
});}
export async function getStats(){return {enabled:await localRead('origin.stats.enabled')===true,days:await localRead('origin.stats.days')||{}};}
export function setStats(enabled){return serial(async()=>{await localWrite('origin.stats.enabled',enabled===true);});}
export function clearStats(){return serial(async()=>{await localWrite('origin.stats.days',{});await sessionWrite('origin.stats.tabs',{});});}
// Do not collect URL or history. Observe numeric browser badge values only.
async function sample(tabId){
    if(await localRead('origin.stats.enabled')!==true)return;
    try{const v=await browser.action.getBadgeText({tabId});if(/^\d+$/.test(v))await observe(Number(v),tabId);}catch{}
}
browser.tabs.onUpdated.addListener((tabId,change)=>{if(change.status==='complete')sample(tabId);});
browser.tabs.onActivated.addListener(({tabId})=>sample(tabId));
browser.tabs.onRemoved.addListener(tabId=>serial(async()=>{const state=await sessionRead('origin.stats.tabs')||{};delete state[tabId];await sessionWrite('origin.stats.tabs',state);}));
