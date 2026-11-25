import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
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
  console.log('Dashboard',info);assert.equal(info.mv,3);assert.equal(info.version,'1.0.0');assert.equal(info.loading,false);assert.equal(info.nav,true);
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
    }else throw Error('Popup target not exposed in headless browser');
  }catch(e){console.log('Popup headless check unavailable:',e.message);throw e;}
  console.log('Smoke passed');
}finally{server.close();chrome.kill();await wait(500);try{rmSync(dir,{recursive:true,force:true});}catch{}}
