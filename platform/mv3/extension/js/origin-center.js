import { browser, sendMessage, i18n } from './ext.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const t=k=>i18n.getMessage(k)||k;
const msg=(what,extra={})=>sendMessage({what,...extra});
const fmt=x=>Number(x||0).toLocaleString();
const el=(tag,txt,cls)=>{const e=document.createElement(tag);if(txt!==undefined)e.textContent=txt;if(cls)e.className=cls;return e;};
let config, modes, stats, activity, generation=0;
function status(id,key){$(id).textContent=t(key);}
function chart(){
    const root=$('#originChart');root.replaceChildren();
    const data=[];
    for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const key=d.toLocaleDateString('en-CA');data.push({label:d.toLocaleDateString(undefined,{weekday:'short'}),value:stats.days[key]||0});}
    const max=Math.max(1,...data.map(d=>d.value));
    for(const d of data){const column=el('div');column.append(el('span',fmt(d.value)));const bar=el('div',undefined,'bar');bar.style.height=(d.value/max*120)+'px';column.append(bar,el('span',d.label));root.append(column);}
    root.setAttribute('aria-label',data.map(d=>d.label+': '+d.value).join(', '));
}
function renderOverview(){
    const active=config.defaultFilteringMode>0;
    $('#originGlobalStatus').textContent=t(active?'originGlobalOn':'originGlobalOff');
    $('#originGlobal').setAttribute('aria-checked',String(active));
    $('#originGlobal').disabled=config.disabledFeatures?.includes('filteringMode')===true;
    $('#originEnabled').textContent=fmt(config.enabledRulesets.length);
    const enabled=new Set(config.enabledRulesets);
    const n=config.rulesetDetails.filter(r=>enabled.has(r.id)).reduce((sum,r)=>sum+(r.rules?.plain||0)+(r.rules?.regex||0),0);
    $('#originRuleTotal').textContent=fmt(n)+' '+t('originRules');
    $('#originExceptionCount').textContent=fmt(modes.none.filter(x=>x!=='all-urls').length);
    $('#originToday').textContent=stats.enabled?fmt(stats.days[new Date().toLocaleDateString('en-CA')]):'—';
    $('#originStatsOpt').checked=stats.enabled;
    $('#originStatsNote').textContent=t(stats.enabled?'originSampleHint':'originNoStats');
    chart();
}
function renderPrivacy(){
    const root=$('#originPrivacyLists');root.replaceChildren();
    const enabled=new Set(config.enabledRulesets);
    const lists=config.rulesetDetails.filter(r=>r.id==='easyprivacy'||r.group==='privacy'||r.group==='annoyances');
    for(const r of lists){
        const row=el('label',undefined,'origin-item'), info=el('div');
        info.append(el('strong',r.name),el('small',fmt((r.rules?.plain||0)+(r.rules?.regex||0))+' '+t('originRules')));
        const input=el('input');input.type='checkbox';input.checked=enabled.has(r.id);input.disabled=(config.adminRulesets||[]).some(id=>[r.id,'+'+r.id,'-'+r.id].includes(id));
        input.addEventListener('change',async()=>{
            input.disabled=true;
            try{const ids=new Set(await msg('getEnabledRulesets'));if(input.checked)ids.add(r.id);else ids.delete(r.id);
                await msg('applyRulesets',{enabledRulesets:[...ids]});
                const actual=await msg('getEnabledRulesets');status('#originPrivacyStatus',actual.includes(r.id)===input.checked?'originSaved':'originSaveError');
            }catch{status('#originPrivacyStatus','originSaveError');}finally{await refresh();}
        });row.append(info,input);root.append(row);
    }
}
function renderExceptions(){
    const root=$('#originExceptionsList');root.replaceChildren();
    const paused=config.defaultFilteringMode===0;
    $('#originExceptionInput').disabled=paused;
    $('#originExceptionForm button').disabled=paused;
    const hosts=modes.none.filter(x=>x!=='all-urls').sort();
    if(!hosts.length)root.append(el('p',t(paused?'originPausedHint':'originEmpty')));
    for(const host of hosts){const row=el('div',undefined,'origin-item'),button=el('button',t('originRemove'));button.type='button';button.disabled=paused;
        button.addEventListener('click',async()=>{button.disabled=true;const ok=await msg('originException',{hostname:host,remove:true});status('#originExceptionsStatus',ok?'originSaved':'originSaveError');await refresh();});
        row.append(el('strong',host),button);root.append(row);
    }
}
function renderActivity(){
    const root=$('#originActivityTable');root.replaceChildren();
    $('#originActivityHost').textContent=activity?.hostname||'—';
    const search=$('#originActivitySearch').value.toLowerCase();
    if(!activity||activity.unavailable){status('#originActivityStatus','originActivityUnavailable');return;}
    $('#originActivityStatus').textContent=new Date(activity.at).toLocaleString();
    const rows=(activity.matches||[]).filter(r=>JSON.stringify(r.rule||{}).toLowerCase().includes(search)).slice(0,250);
    if(!rows.length){root.append(el('p',t('originEmpty')));return;}
    const table=el('table'),head=el('tr');for(const name of [t('originTime'),t('originRuleset'),t('originRuleId')])head.append(el('th',name));table.append(head);
    for(const m of rows.sort((a,b)=>b.timeStamp-a.timeStamp)){const tr=el('tr');for(const v of [new Date(m.timeStamp).toLocaleTimeString(),m.rule?.rulesetId,m.rule?.ruleId])tr.append(el('td',String(v??'—')));table.append(tr);}
    root.append(table);
}
async function refresh(){
    const id=++generation;
    const [c,m,s,a]=await Promise.all([msg('getOptionsPageData'),msg('getFilteringModeDetails'),msg('originGetStats'),browser.storage.session.get('origin.activity').catch(()=>({}))]);
    if(id!==generation||!c||!m||!s)return;
    config=c;modes=m;stats=s;activity=a['origin.activity'];
    renderOverview();renderPrivacy();renderExceptions();renderActivity();
}
$('#originGlobal').addEventListener('click',async e=>{
    const b=e.currentTarget;b.disabled=true;
    try{await msg('originGlobalToggle',{enabled:b.getAttribute('aria-checked')!=='true'});}finally{b.disabled=false;await refresh();}
});
$('#originStatsOpt').addEventListener('change',async e=>{await msg('originSetStats',{enabled:e.target.checked});await refresh();});
$('#originClearStats').addEventListener('click',async()=>{await msg('originClearStats');await refresh();});
$('#originExceptionForm').addEventListener('submit',async e=>{
    e.preventDefault();let host;
    try{const raw=$('#originExceptionInput').value.trim();host=new URL(raw.includes('://')?raw:'https://'+raw).hostname.toLowerCase().replace(/\.$/,'');if(!host.includes('.')||host==='all-urls')throw Error();}catch{status('#originExceptionsStatus','originInvalid');return;}
    const ok=await msg('originException',{hostname:host});status('#originExceptionsStatus',ok?'originSaved':'originSaveError');if(ok)$('#originExceptionInput').value='';await refresh();
});
$('#originActivitySearch').addEventListener('input',renderActivity);
$('#originUpdateLists').addEventListener('click',async e=>{
    const b=e.currentTarget;b.disabled=true;status('#originUpdateStatus','originUpdating');
    try{const result=await browser.runtime.sendMessage({what:'originRefreshLists'});if(!result||!Number.isInteger(result.count))throw Error();status('#originUpdateStatus','originUpdated');}catch{status('#originUpdateStatus','originSaveError');}finally{b.disabled=false;await refresh();}
});
for(const b of $$('[data-origin-open]'))b.addEventListener('click',()=>$(`#dashboard-nav [data-pane="${b.dataset.originOpen}"]`).click());
for(const b of $$('[data-origin-refresh]'))b.addEventListener('click',refresh);
const channel=new BroadcastChannel('uBOL');channel.addEventListener('message',()=>refresh());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
new MutationObserver(()=>refresh()).observe(document.body,{attributes:true,attributeFilter:['data-pane']});
refresh();
