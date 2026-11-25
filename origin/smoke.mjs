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
  const info=await evaluate("({title:document.title,name:chrome.runtime.getManifest().name,version:chrome.runtime.getManifest().version,mv:chrome.runtime.getManifest().manifest_version,loading:document.body.classList.contains('loading'),nav:!!document.querySelector('.origin-nav-brand'),css:getComputedStyle(document.querySelector('#dashboard-nav')).display})");
  console.log('Dashboard',info);assert.equal(info.mv,3);assert.equal(info.version,'1.1.0');assert.equal(info.loading,false);assert.equal(info.nav,true);
  const command=async(what,extra={})=>evaluate('chrome.runtime.sendMessage('+JSON.stringify({what,...extra})+')');
  const home=await evaluate("({pane:document.body.dataset.pane,shown:getComputedStyle(document.querySelector('section[data-pane=overview]')).display,enabled:document.querySelector('#originEnabled').textContent,stats:document.querySelector('#originStatsOpt').checked,nav:document.querySelectorAll('#dashboard-nav .tabButton').length})");
  console.log('New dashboard',home);assert.equal(home.pane,'overview');assert.equal(home.shown,'block');assert.equal(home.enabled,'7');assert.equal(home.stats,false);assert(home.nav>=8);
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
  for(const pane of ['privacy','exceptions','activity','rulesets','filters','settings','overview']){
    await evaluate("document.querySelector('#dashboard-nav [data-pane="+pane+"]').click()");
    await wait(100);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('section[data-pane="+pane+"]')).display"),'block');
  }
  console.log('Sidebar navigation: passed');
  if(process.env.ORIGIN_SCREENSHOTS){
    mkdirSync(process.env.ORIGIN_SCREENSHOTS,{recursive:true});
    await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:850,deviceScaleFactor:1,mobile:false},sessionId);
    await wait(100);
    const shot=await cdp('Page.captureScreenshot',{format:'png'},sessionId);
    writeFileSync(join(process.env.ORIGIN_SCREENSHOTS,'dashboard.png'),Buffer.from(shot.data,'base64'));
  }
  // Toggle an actual privacy filter using its visible control.
  await evaluate("document.querySelector('#dashboard-nav [data-pane=privacy]').click()");
  await wait(150);
  await evaluate("document.querySelector('#originPrivacyLists input').click()");
  await wait(700);
  const afterPrivacy=await command('getEnabledRulesets');
  assert(!afterPrivacy.includes('easyprivacy'));
  await evaluate("document.querySelector('#originPrivacyLists input').click()");
  await wait(700);
  assert((await command('getEnabledRulesets')).includes('easyprivacy'));
  console.log('Privacy toggle updates engine: passed');
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
      const state=await evaluate("({status:document.querySelector('#originStatus').textContent,active:document.body.dataset.originActive,hostname:document.querySelector('#hostname').textContent,loading:document.body.classList.contains('loading')})",session);
      console.log('Popup:',state);assert.equal(state.loading,false);assert.equal(state.active,'true');
      assert.equal(await evaluate("document.querySelectorAll('[data-origin-level]').length",session),3);
      assert.equal(await evaluate("document.querySelectorAll('.origin-shortcuts button').length",session),4);
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
