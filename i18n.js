import {LANGUAGES,resolveLanguage,normalizeText,messageAge} from './i18n-core.js';
const STORE='underwatch.language',AUTO='underwatch.localTranslation';
let language=resolveLanguage(read(STORE),navigator.languages||[navigator.language]),catalog={},english={},index=new Map(),generation=0,enabled=read(AUTO)==='1',detector=null,scanTimer,working=false,queue=[];
const pendingSources=new Set();
const records=new WeakMap(),tracked=new Set(),cache=new Map(),translators=new Map();
function read(key){try{return localStorage.getItem(key);}catch{return null;}}
function store(key,value){try{localStorage.setItem(key,value);}catch{}}
const excluded='script,style,textarea,input,code,pre,canvas,iframe,[translate="no"],[data-i18n-skip],.brand,[data-inspect-agent],.inhabitant-chip,.observed-heading h2,.character-details h2,.community-card h3,.community-person h2,.camera-copy h3,.language-control';
const dynamic='.voice-line p,.history-card blockquote,.history-card details p,.feed-entry>p,.observed-entry>p,.observed-entry details p,.observed-intention,.queue-text p';
const timeout=(promise,ms=30000)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Error('Translation timed out')),ms))]);
const control=document.createElement('details');control.className='language-control';control.dataset.i18nSkip='';
control.innerHTML='<summary aria-label="Language">🌐 <span></span></summary><div class="language-menu"><label>Language / Idioma<select aria-label="Language / Idioma"></select></label><button type="button" class="language-device">Enable local translation</button><label class="language-original"><input type="checkbox"> Show original messages</label><p role="status"></p></div>';
const select=control.querySelector('select'),status=control.querySelector('[role=status]'),button=control.querySelector('button'),original=control.querySelector('input');
for(const [code,label]of Object.entries(LANGUAGES))select.append(new Option(label,code));select.value=language;
document.querySelector('.account-nav')?.prepend(control);
const style=document.createElement('style');style.textContent='.language-control{position:relative;font-size:12px;flex:none}.language-control summary{cursor:pointer;list-style:none;padding:10px;border:1px solid var(--line);color:var(--green);white-space:nowrap}.language-menu{position:absolute;right:0;top:calc(100% + 10px);width:260px;padding:18px;background:#142219;border:1px solid #75865e;box-shadow:0 12px 30px #0008;z-index:100}.language-menu label{display:flex;flex-direction:column;gap:9px;color:#dbe3cc}.language-menu select,.language-menu button{padding:10px;border:1px solid #647752;background:#0e1912;color:#e1e8d2;width:100%;font:inherit}.language-menu button{margin:14px 0;cursor:pointer}.language-menu .language-original{flex-direction:row;align-items:center;font-size:12px}.language-menu input{width:auto}.language-menu p{font:12px/1.5 Arial;color:#b9c7a8;margin:12px 0 0}@media(max-width:600px){.language-control summary{padding:8px}.language-menu{position:fixed;top:80px;right:12px;width:min(290px,calc(100vw - 24px))}}';document.head.append(style);
function say(text){status.textContent=text;}
async function setLanguage(value){language=resolveLanguage(value);store(STORE,language);const version=++generation;queue=[];select.value=language;control.querySelector('summary span').textContent=language.toUpperCase();control.querySelector('.language-original').lastChild.textContent=language==='pt'?' Mostrar mensagens originais':' Show original messages';document.documentElement.lang=language;document.documentElement.dir='ltr';
 try{const [a,b]=await Promise.all([fetch('locale-en.json').then(r=>r.json()),(['en','pt','es','fr','de','it'].includes(language)?fetch('locale-'+language+'.json').then(r=>r.ok?r.json():{}).catch(()=>({})):Promise.resolve({}))]);if(version!==generation)return;english=a;catalog=b;index=new Map(Object.entries(a).flatMap(([key,text])=>[[normalizeText(text),key],[normalizeText(text).toLowerCase(),key]]));}catch{say('Interface translations unavailable.');}
 for(const node of tracked){if(!node.isConnected){tracked.delete(node);continue;}const r=records.get(node);if(r&&node.data===r.last){node.data=r.original;r.last=r.original;}}
 button.textContent=language==='pt'?'Ativar tradução local':'Enable local translation';say('Translator' in self?(enabled?'Local translation enabled.':'Messages stay original until enabled.'):'Automatic messages: use your browser’s Translate page option.');scan();
}
async function model(source,target,download=false){const key=source+':'+target;if(translators.has(key))return timeout(translators.get(key));if(!('Translator'in self))return null;const options={sourceLanguage:source,targetLanguage:target};const available=await Translator.availability(options);if(available==='unavailable'||!download&&available!=='available')return null;const promise=Translator.create({...options,monitor(m){m.addEventListener('downloadprogress',e=>say('Downloading language pack · '+Math.round(e.loaded*100)+'%'));}});translators.set(key,promise);try{return await timeout(promise);}catch{translators.delete(key);return null;}}
button.addEventListener('click',async()=>{if(!('Translator'in self)){say('This browser cannot translate locally. Use its Translate page option.');return;}button.disabled=true;say('Preparing local translation…');try{const sources=[...new Set(['en',...pendingSources])].filter(s=>s!==language);const detection=(async()=>{if('LanguageDetector'in self&&await LanguageDetector.availability()!=='unavailable')return timeout(LanguageDetector.create({monitor(m){m.addEventListener('downloadprogress',e=>say('Preparing language detection · '+Math.round(e.loaded*100)+'%'));}}));return null;})();const [det,models]=await Promise.all([detection,Promise.all(sources.map(source=>model(source,language,true)))]);detector=det;pendingSources.clear();if(models.some(m=>!m))throw Error();enabled=true;store(AUTO,'1');generation++;queue=[];say(detector?'Ready · texts stay on this device.':'Interface ready. Message language detection unavailable.');scan();}catch{say('This language pair is unavailable. Original text is preserved.');}finally{button.disabled=false;}});
select.addEventListener('change',()=>void setLanguage(select.value));original.addEventListener('change',()=>{generation++;queue=[];for(const node of tracked){const r=records.get(node);if(r?.dynamic&&node.isConnected&&node.data===r.last){node.data=r.original;r.last=r.original;}}scan();});
function known(text,element){const key=element.closest('[data-i18n]')?.dataset.i18n||index.get(normalizeText(text))||index.get(normalizeText(text).toLowerCase())||index.get(normalizeText(text).replace(/\.$/,'').toLowerCase());if(!key)return null;let result=catalog[key]??english[key]??text;if(text.endsWith('.')&&!result.endsWith('.'))result+='.';if(text===text.toUpperCase())result=result.toUpperCase();return result;}
function scan(){
 if(!document.body)return;
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
 while(node=walker.nextNode()){
  const element=node.parentElement;if(!element||element.closest(excluded)||!node.data.trim())continue;
  let record=records.get(node);if(!record||node.data!==record.last){record={original:node.data,last:node.data,dynamic:Boolean(element.closest(dynamic))};records.set(node,record);tracked.add(node);}
  const source=record.original,text=normalizeText(source);if(!/[\p{L}]/u.test(text)||text.length>4000)continue;
  const local=record.dynamic?null:messageAge(text,language)??known(text,element);
  if(local!==null){apply(node,record,source.replace(source.trim(),local));continue;}
  if(!enabled||record.dynamic&&original.checked)continue;
  if(!record.dynamic&&language==='en')continue;
  const key=language+':'+text;if(cache.has(key)){apply(node,record,cache.get(key));continue;}
  if(queue.length<250&&!record.queued&&record.attempted!==generation){record.queued=true;record.attempted=generation;queue.push({node,record,text,language,version:generation});}
 }
 for(const el of document.querySelectorAll('[placeholder]')){if(el.closest('.language-control'))continue;const current=el.getAttribute('placeholder');el.dataset.i18nPlaceholderOriginal??=current;const text=el.dataset.i18nPlaceholderOriginal,key=el.dataset.i18nPlaceholder||index.get(normalizeText(text));if(key)el.setAttribute('placeholder',catalog[key]??english[key]??text);}
 if(tracked.size>6000)for(const node of tracked)if(!node.isConnected)tracked.delete(node);
 void drain();
}
function apply(node,r,value){if(node.data!==value){r.last=value;node.data=value;}}
async function drain(){if(working)return;working=true;try{while(queue.length){const job=queue.shift(),{node,record,text,version}=job;record.queued=false;if(version!==generation||!node.isConnected)continue;let source='en';try{
 if(!detector&&'LanguageDetector'in self&&await LanguageDetector.availability()==='available')detector=await LanguageDetector.create();
 if(detector){const [detected]=await timeout(detector.detect(text));if(!detected||detected.confidence<.5)continue;source=detected.detectedLanguage;}else if(record.dynamic)continue;
 if(source===job.language){continue;}const translator=await model(source,job.language);if(!translator){pendingSources.add(source);say('Click Enable local translation to prepare additional language packs.');continue;}const translated=await timeout(translator.translate(text));if(version!==generation||!node.isConnected||node.data!==record.last)continue;
 cache.set(job.language+':'+text,translated);if(cache.size>1000)cache.delete(cache.keys().next().value);apply(node,record,translated);
 }catch{/* Original content remains readable. */}
 }}finally{working=false;}}
const observer=new MutationObserver(()=>{clearTimeout(scanTimer);scanTimer=setTimeout(scan,150);});observer.observe(document.body,{childList:true,subtree:true,characterData:true});
void setLanguage(language);document.addEventListener('visibilitychange',()=>{if(!document.hidden)scan();});

export function getLanguage(){return language;}

document.addEventListener('click',e=>{if(e.target.closest('[data-action=logout]')){generation++;queue=[];cache.clear();}});

// New features can use semantic keys directly, without embedding English copy.
export function t(key,variables={}){let value=catalog[key]??english[key]??key;for(const [name,text]of Object.entries(variables))value=value.replaceAll('{'+name+'}',String(text));return value;}
