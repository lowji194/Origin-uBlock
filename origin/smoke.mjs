import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import http from 'node:http';
const dir=mkdtempSync(join(tmpdir(),'origin-smoke-'));
const chrome=spawn(process.env.CHROME_BIN||'google-chrome',['--headless','--no-sandbox','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--no-proxy-server','--host-resolver-rules=MAP origin-smoke.test 127.0.0.1','--remote-debugging-pipe','--enable-unsafe-extension-debugging','--user-data-dir='+dir,'about:blank'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
let serial=0,buf='',pending=new Map();
chrome.stdio[4].on('data',chunk=>{
  buf+=chunk.toString();
  for(let i;(i=buf.indexOf('\0'))>=0;){
    const raw=buf.slice(0,i);buf=buf.slice(i+1);
    if(!raw)continue;
    const m=JSON.parse(raw);const p=pending.get(m.id);
    if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}
  }
});
const cdp=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
  const id=++serial;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},12000);
  pending.set(id,{resolve,reject,timer});chrome.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0');
});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const hits=[];const server=http.createServer((req,res)=>{hits.push(req.url);res.setHeader('Content-Type','text/html');res.end('<html><body>Origin smoke test</body></html>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{
  console.log('Browser', (await cdp('Browser.getVersion')).product);
  const {id}=await cdp('Extensions.loadUnpacked',{path:resolve(process.argv[2]||'dist/build/uBOLite.chromium')});
  assert.match(id,/^[a-p]{32}$/);console.log('Loaded extension:',id);
  const {targetId}=await cdp('Target.createTarget',{url:'chrome-extension://'+id+'/dashboard.html'});
  const {sessionId}=await cdp('Target.attachToTarget',{targetId,flatten:true});
  const evaluate=async(expression,s=sessionId)=>{
    const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},s);
    if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  await wait(1800);
  const info=await evaluate("({title:document.title,name:chrome.runtime.getManifest().name,version:chrome.runtime.getManifest().version,mv:chrome.runtime.getManifest().manifest_version,loading:!document.querySelector('[data-page=overview]'),nav:!!document.querySelector('.side-nav'),css:getComputedStyle(document.querySelector('.side-nav')).display})");
  console.log('Dashboard',info);assert.equal(info.mv,3);assert.equal(info.version,'2.0.1');assert.equal(info.loading,false);assert.equal(info.nav,true);
  const command=async(what,extra={})=>evaluate('chrome.runtime.sendMessage('+JSON.stringify({what,...extra})+')');
  const home=await evaluate("({shown:!!document.querySelector('[data-page=overview]'),nav:document.querySelectorAll('.side-nav button').length,cards:document.querySelectorAll('.stat-card').length,old:!!document.querySelector('#dashboard-nav')})");
  console.log('Independent Vue dashboard',home);assert(home.shown);assert.equal(home.nav,8);assert.equal(home.cards,3);assert.equal(home.old,false);
  assert.equal(await command('originException',{hostname:'allow-smoke.test'}),true);
  assert((await command('getFilteringModeDetails')).none.includes('allow-smoke.test'));
  assert.equal(await command('originGlobalToggle',{enabled:false}),0);
  assert.equal(await command('getFilteringMode',{hostname:'unlisted-smoke.test'}),0);
  assert.equal(await command('originGlobalToggle',{enabled:true}),2);
  assert((await command('getFilteringModeDetails')).none.includes('allow-smoke.test'));
  assert.equal(await command('originException',{hostname:'allow-smoke.test',remove:true}),true);
  assert(!(await command('getFilteringModeDetails')).none.includes('allow-smoke.test'));
  console.log('Global pause/resume preserves exceptions: passed');
  await command('originSetStats',{enabled:true});
  await command('originObserve',{count:8,tabId:987654});
  await command('originObserve',{count:12,tabId:987654});
  await command('originObserve',{count:12,tabId:987654});
  const stats=await command('originGetStats');assert.equal(Object.values(stats.days).reduce((a,b)=>a+b,0),12);
  await command('originClearStats');assert.equal(Object.keys((await command('originGetStats')).days).length,0);
  await command('originSetStats',{enabled:false});
  console.log('Opt-in local counts, deduplication and clearing: passed');
  for(const [i,pane] of ['overview','filters','privacy','exceptions','rules','activity','settings','about'].entries()){
    await evaluate("document.querySelectorAll('.side-nav button')["+i+"].click()");
    await wait(150);
    assert.equal(await evaluate("Boolean(document.querySelector('[data-page="+pane+"]'))"),true);
  }
  await evaluate("document.querySelectorAll('.side-nav button')[1].click()");
  await wait(300);
  const vnFlag=await evaluate("Array.from(document.querySelectorAll('.list-row')).filter(r=>r.textContent.includes('ABPVN List')).some(r=>{const img=r.querySelector('img.filter-country-flag');return img&&img.complete&&img.naturalWidth>0&&img.src.endsWith('/vn.png')})");
  assert.equal(vnFlag,true);console.log('Vietnam regional flag: passed');
  if(process.env.ORIGIN_TEST_VIETNAM_IMPORT==='1'){
    const url='https://raw.githubusercontent.com/lowji194/AdsBlock-Filter/main/filters/Vietnam_Filter_Desktop.txt';
    await command('importFilterList',{url});
    await wait(2000);
    assert((await command('getEnabledRulesets')).includes(url));
    await cdp('Page.reload',{},sessionId);await wait(1800);
    await evaluate("document.querySelectorAll('.side-nav button')[1].click()");await wait(350);
    const importedFlag=await evaluate("Array.from(document.querySelectorAll('.list-row')).filter(r=>r.textContent.includes('Lowji194')).some(r=>{const img=r.querySelector('img.filter-country-flag');return img&&img.complete&&img.naturalWidth>0&&img.src.endsWith('/vn.png')})");
    assert.equal(importedFlag,true);console.log('Imported Vietnam Filter flag: passed');
  }

  await evaluate("document.querySelectorAll('.side-nav button')[0].click()");
  await evaluate("document.querySelector('.page-header button').click()");
  await wait(500);
  assert.equal(await evaluate("document.querySelector('.banner-switch').getAttribute('aria-checked')"),'true');
  await evaluate("document.querySelector('.banner-switch').click()");
  await wait(500);assert.equal(await command('getDefaultFilteringMode'),0);
  await evaluate("document.querySelector('.banner-switch').click()");
  await wait(500);assert.equal(await command('getDefaultFilteringMode'),2);
  console.log('Eight independent pages and global toggle UI: passed');
  if(process.env.ORIGIN_SCREENSHOTS){
    mkdirSync(process.env.ORIGIN_SCREENSHOTS,{recursive:true});
    await evaluate("chrome.storage.local.set({'origin.ui.language':'vi'})");await wait(200);
    await evaluate("document.querySelector('.toast button')?.click()");
    await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:850,deviceScaleFactor:1,mobile:false},sessionId);
    await wait(100);
    const shot=await cdp('Page.captureScreenshot',{format:'png'},sessionId);
    writeFileSync(join(process.env.ORIGIN_SCREENSHOTS,'dashboard.png'),Buffer.from(shot.data,'base64'));
  }
  // Real UI actions with engine read-back.
  await evaluate("document.querySelectorAll('.side-nav button')[2].click()");
  await wait(150);
  await evaluate("document.querySelector('button[role=switch][aria-label=EasyPrivacy]').click()");
  await wait(700);assert(!(await command('getEnabledRulesets')).includes('easyprivacy'));
  await evaluate("document.querySelector('button[role=switch][aria-label=EasyPrivacy]').click()");
  await wait(700);assert((await command('getEnabledRulesets')).includes('easyprivacy'));
  console.log('Privacy toggle updates engine: passed');
  await evaluate("document.querySelectorAll('.side-nav button')[3].click()");
  await wait(150);
  await evaluate("(()=>{let e=document.querySelector('[data-page=exceptions] form input');e.value='ui-smoke.test';e.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-page=exceptions] form').requestSubmit();})()");
  await wait(500);assert((await command('getFilteringModeDetails')).none.includes('ui-smoke.test'));
  await evaluate("document.querySelector('[data-page=exceptions] .list-row .icon-button').click()");
  await wait(500);assert(!(await command('getFilteringModeDetails')).none.includes('ui-smoke.test'));
  console.log('Allowlist UI add/remove: passed');
  await evaluate("document.querySelectorAll('.side-nav button')[4].click()");
  await wait(300);
  await evaluate("(()=>{let e=document.querySelector('textarea.editor');e.value='||origin-custom-smoke.test^';e.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await wait(100);
  await evaluate("document.querySelector('[data-page=rules] button.primary').click()");
  await wait(1000);assert((await command('getSandboxFilters'))?.includes('origin-custom-smoke.test'));
  await command('setSandboxFilters',{text:'/custom-block^'});
  console.log('Custom rule editor saves engine rule: passed');
  await evaluate("document.querySelectorAll('.side-nav button')[6].click()");
  await wait(150);
  await evaluate("document.querySelector('.theme-options button[title=dark]').click()");
  await wait(150);assert.equal(await evaluate("document.documentElement.dataset.theme"),'dark');
  await evaluate("document.querySelector('.theme-options button[title=light]').click()");
  console.log('Theme change: passed');
  const backup=await evaluate("(async()=>{const m=await import(chrome.runtime.getURL('js/backup-restore.js'));return m.backupToObject(await chrome.runtime.sendMessage({what:'getOptionsPageData'}));})()");
  assert(backup.filteringModes);assert(Array.isArray(backup.filteringModes.none));
  console.log('Backup engine serialization: passed');
  if(process.env.ORIGIN_SCREENSHOTS){
    await evaluate("document.querySelector('.toast button')?.click()");
    const shot=await cdp('Page.captureScreenshot',{format:'png'},sessionId);
    writeFileSync(join(process.env.ORIGIN_SCREENSHOTS,'settings.png'),Buffer.from(shot.data,'base64'));
    await evaluate("document.querySelectorAll('.side-nav button')[1].click()");
    await wait(200);
    const filters=await cdp('Page.captureScreenshot',{format:'png'},sessionId);
    writeFileSync(join(process.env.ORIGIN_SCREENSHOTS,'filters.png'),Buffer.from(filters.data,'base64'));
  }
  const rules=await evaluate('chrome.declarativeNetRequest.getEnabledRulesets()');
  console.log('Enabled rulesets',rules);assert(rules.includes('vie-1'));assert(rules.includes('easylist'));
  const data=await evaluate("chrome.runtime.sendMessage({what:'popupPanelData',origin:'https://example.com',hostname:'example.com'})");
  console.log('Engine response',data);assert(data.level>0);
  const off=await evaluate("chrome.runtime.sendMessage({what:'setFilteringMode',hostname:'example.com',level:0})");
  assert.equal(off,0);
  const on=await evaluate("chrome.runtime.sendMessage({what:'setFilteringMode',hostname:'example.com',level:1})");assert.equal(on,1);
  console.log('Site protection off/on: passed');
  const p=await cdp('Target.createTarget',{url:'http://origin-smoke.test:'+server.address().port});
  const ps=(await cdp('Target.attachToTarget',{targetId:p.targetId,flatten:true})).sessionId;
  await wait(400);
  const req=async(path)=>evaluate("fetch("+JSON.stringify(path)+").then(r=>r.status).catch(()=>0)",ps);
  assert.equal(await req('/normal'),200);
  assert.equal(await req('/custom-block'),0);
  await command('setSandboxFilters',{text:''});
  assert.equal(await req('/custom-block?after=1'),200);
  console.log('Custom network rule actually blocks and clears: passed');
  const blocked=await req('/test.ashx?adid=123');
  console.log('EasyList fixture:',blocked,'server hits:',hits);assert.equal(blocked,0);assert(!hits.includes('/test.ashx?adid=123'));
  assert.equal(await evaluate("chrome.runtime.sendMessage({what:'setFilteringMode',hostname:'origin-smoke.test',level:0})"),0);
  await cdp('Page.reload',{ignoreCache:true},ps);await wait(500);
  assert.equal(await req('/test.ashx?adid=789'),200);
  assert.equal(await evaluate("chrome.runtime.sendMessage({what:'setFilteringMode',hostname:'origin-smoke.test',level:1})"),1);
  await cdp('Page.reload',{ignoreCache:true},ps);await wait(500);
  assert.equal(await req('/test.ashx?adid=456'),0);
  console.log('Actual request blocking and per-site exception passed');
  await cdp('Target.activateTarget',{targetId:p.targetId});
  try {
    await evaluate('chrome.action.openPopup()');
    await wait(400);
    const targets=(await cdp('Target.getTargets')).targetInfos;
    const popup=targets.find(t=>t.url==='chrome-extension://'+id+'/popup.html');
    if(popup){
      const session=(await cdp('Target.attachToTarget',{targetId:popup.targetId,flatten:true})).sessionId;
      const state=await evaluate("({status:document.querySelector('.popup-hero h1').textContent,active:document.querySelector('.power-button').getAttribute('aria-pressed'),hostname:document.querySelector('.host').textContent,loading:document.querySelector('.power-button').disabled})",session);
      console.log('Popup:',state);assert.equal(state.loading,false);assert.equal(state.active,'true');
      assert.equal(await evaluate("document.querySelectorAll('.segmented button').length",session),3);
      assert.equal(await evaluate("document.querySelectorAll('.quick-nav button').length",session),4);
      await evaluate("document.querySelector('.power-button').click()",session);
      await wait(600);assert.equal(await command('getFilteringMode',{hostname:'origin-smoke.test'}),0);
      await evaluate("document.querySelector('.power-button').click()",session);
      await wait(600);assert.equal(await command('getFilteringMode',{hostname:'origin-smoke.test'}),1);
      console.log('Actual popup power control: passed');
      if(process.env.ORIGIN_SCREENSHOTS){
        try{

          const shot=await cdp('Page.captureScreenshot',{format:'png'},session);
          writeFileSync(join(process.env.ORIGIN_SCREENSHOTS,'popup.png'),Buffer.from(shot.data,'base64'));
        }catch(e){console.log('Popup screenshot unavailable',e.message);}
      }
    }else throw Error('Popup target not exposed in headless browser');
  }catch(e){console.log('Popup headless check unavailable:',e.message);throw e;}
  console.log('Smoke passed');
}finally{server.close();chrome.kill();await wait(500);try{rmSync(dir,{recursive:true,force:true});}catch{}}
