import {ref,computed} from 'vue';
declare const chrome:any;
export const web=chrome;
export const version=web.runtime.getManifest().version;
export const language=ref<'vi'|'en'>(web.i18n.getUILanguage().startsWith('vi')?'vi':'en');
export const theme=ref<'system'|'light'|'dark'>('system');
export const tr=(vi:string,en:string)=>language.value==='vi'?vi:en;
export const modeName=(n:number)=>[tr('Tắt','Off'),tr('Cơ bản','Basic'),tr('Tối ưu','Optimal'),tr('Tối đa','Complete')][n]||'—';
export const num=(n:number)=>Number(n).toLocaleString(language.value==='vi'?'vi-VN':'en-US');
const media=matchMedia('(prefers-color-scheme: dark)');
function applyTheme(){document.documentElement.dataset.theme=theme.value==='system'?(media.matches?'dark':'light'):theme.value;document.documentElement.lang=language.value;}
export async function loadPrefs(){const s=await web.storage.local.get(['origin.ui.theme','origin.ui.language']);if(['system','light','dark'].includes(s['origin.ui.theme']))theme.value=s['origin.ui.theme'];if(['vi','en'].includes(s['origin.ui.language']))language.value=s['origin.ui.language'];applyTheme();}
export async function savePrefs(){applyTheme();await web.storage.local.set({'origin.ui.theme':theme.value,'origin.ui.language':language.value});}
media.addEventListener('change',applyTheme);
web.storage.onChanged.addListener((changes:any,area:string)=>{if(area==='local'&&(changes['origin.ui.theme']||changes['origin.ui.language']))void loadPrefs();});
export async function api<T=any>(what:string,extra:Record<string,any>={}):Promise<T>{return web.runtime.sendMessage({what,...extra});}
export async function navigate(pane:string){await web.tabs.create({url:web.runtime.getURL('dashboard.html?pane='+encodeURIComponent(pane))});}
export async function readCenter(){const [config,modes,stats,imported]=await Promise.all([api('getOptionsPageData'),api('getFilteringModeDetails'),api('originGetStats'),api('getImportedLists')]);if(!config||!modes||!stats)throw Error(tr('Không kết nối được engine','Could not connect to engine'));return {config,modes,stats,imported:imported||[]};}
export async function setDefault(level:number){if(level>1&&!await web.permissions.contains({origins:['<all_urls>']})){if(!await web.permissions.request({origins:['<all_urls>']}))throw Error(tr('Chưa cấp quyền truy cập website','Site permission not granted'));}const actual=await api('setDefaultFilteringMode',{level});if(actual!==level)throw Error(tr('Không thể đổi mức bảo vệ','Could not change protection level'));return actual;}
export function hostname(raw:string){const url=new URL(raw.includes('://')?raw:'https://'+raw);const h=url.hostname.toLowerCase().replace(/\.$/,'');if(!['http:','https:'].includes(url.protocol)||!h.includes('.')||h==='all-urls'||h.includes('..')||url.username||url.password)throw Error(tr('Tên miền không hợp lệ','Invalid hostname'));return h;}
export function download(name:string,text:string,type='text/plain'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function snapshot(tabId:number,host:string){let result:any={hostname:host,at:Date.now(),unavailable:true};try{const data=await web.declarativeNetRequest.getMatchedRules({tabId});result={hostname:host,at:Date.now(),matches:data.rulesMatchedInfo||[]};}catch{}await web.storage.session.set({'origin.activity':result});return result;}
export const protectionModes=computed(()=>[{id:1,name:modeName(1),desc:tr('Chặn yêu cầu mạng quảng cáo và theo dõi.','Block advertising and tracking network requests.')},{id:2,name:modeName(2),desc:tr('Lọc mạng và ẩn thành phần theo từng website.','Network and site-specific cosmetic filtering.')},{id:3,name:modeName(3),desc:tr('Bổ sung lọc giao diện tổng quát. Có thể ảnh hưởng website.','Adds generic cosmetic filtering. May affect sites.')}]);
