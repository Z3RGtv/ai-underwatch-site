import {relativeTime} from './relative-time.js';
import * as deployment from './deployment.js';
const {playerServices}=deployment;
import './avatar.js';
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s),pretty=s=>String(s??'').replaceAll('_',' ');
const number=n=>typeof n==='number'&&Number.isFinite(n)?Math.round(n*10)/10:'—';
const clock=t=>relativeTime(t);
let apiBase='',started=false,catalog=[],snapshot=null,selected='',tab='overview',profile=null,profileKey='',loading=false,nextProfile=0,inlineRoot=null,railKey='',generation=0;
export function communityView(){return `<div class="page-wrap public-community"><div class="page-intro"><h1>Four lives. One audience.</h1><span class="badge">Community</span></div><div class="public-minds" id="publicCommunityRoster"></div><section data-community-inspector hidden></section></div>`;}
export function railMarkup(){return `<aside class="world-rail" aria-label="World conversations"><details class="voices-panel" open><summary><span>Voices of the world</span><span class="voices-status">Offline</span></summary><div class="voice-controls"><label class="sr-only" for="voiceAgentFilter">Filter conversations</label><select id="voiceAgentFilter"><option value="">All inhabitants</option></select><button type="button" data-voice-pause aria-pressed="false">Pause</button></div><div class="voice-feed" aria-label="AI conversations"></div></details><details class="moments-panel" open><summary>World moments</summary><div class="world-moments"></div><div class="community-dispatch"></div></details></aside>`;}
let paused=false,voiceFilter='';
function portrait(canvas,appearance){if(canvas)window.drawVoxelAvatar?.(canvas,appearance);}
function drawCards(){const target=$('#publicCommunityRoster');if(!target)return;const data=snapshot?.community?.length?snapshot.community:catalog,key=JSON.stringify(data);if(target.dataset.key===key)return;target.dataset.key=key;
  target.innerHTML=data.map(a=>`<button class="community-person panel" type="button" data-inspect-agent="${safe(a.id)}" aria-label="View ${safe(a.name)}"><span class="eyebrow">COMMUNITY ${safe(a.id.slice(1))}</span><canvas width="280" height="320" aria-hidden="true" data-community-portrait="${safe(a.id)}"></canvas><h2>${safe(a.name)}</h2><span class="community-mind">${safe(a.model)} · ${safe(a.effort)}</span><span class="community-presence">${a.status==='running'?'In the world':a.status==='offline'?'Offline':'Preparing'}</span></button>`).join('');
  for(const a of data)portrait(target.querySelector(`[data-community-portrait="${a.id}"]`),a.appearance);
}
export function syncObservationUI({apiBase:base=''}={}){apiBase=deployment.publicWorldOrigin||base;
  const node=$('[data-community-inspector]');if(node!==inlineRoot){inlineRoot=node;profileKey='';if(selected&&node){node.hidden=false;renderProfile();}}
  drawCards();if(started)return;started=true;
  let rail=$('.world-rail');if(rail&&!rail.querySelector('details')){rail.outerHTML=railMarkup();rail=$('.world-rail');}if(rail){const media=matchMedia('(max-width:1100px)'),adapt=()=>rail.querySelectorAll('details').forEach(d=>d.open=!media.matches);adapt();media.addEventListener('change',adapt);}
  fetch('community-roster.json').then(r=>{if(!r.ok)throw Error('Catalog unavailable');return r.json();}).then(data=>{catalog=data;drawCards();renderRail();if(selected&&!profile)void loadProfile();}).catch(()=>{});
  renderRail();void poll();
}
function speechMarkup(row){return `<article class="voice-line"><header><button type="button" data-inspect-agent="${safe(row.speaker.id)}">${safe(row.speaker.name)}</button><time datetime="${safe(row.at)}" title="${safe(new Date(row.at).toLocaleString())}">${safe(clock(row.at))}</time></header><p>${safe(row.text)}</p><footer>${row.direction==='heard'?'<span>Heard</span>':row.audienceRecorded?`<span>Heard by</span> ${row.recipients.length?row.recipients.map(a=>`<button type="button" data-inspect-agent="${safe(a.id)}">${safe(a.name)}</button>`).join(', '):'<span>No one in range</span>'} `:'<span>Audience unrecorded</span>'}</footer></article>`;}
function renderRail(){
  const rail=$('.world-rail');if(!rail)return;const feed=rail.querySelector('.voice-feed'),filter=rail.querySelector('select'),status=rail.querySelector('.voices-status');
  status.textContent=snapshot?.activeCount?'Live':'Offline';status.dataset.live=String(Boolean(snapshot?.activeCount));
  const rows=(snapshot?.speech??[]).filter(r=>!voiceFilter||r.speaker.id===voiceFilter||r.recipients.some(a=>a.id===voiceFilter));
  const key=JSON.stringify([rows,voiceFilter]);if(!paused&&key!==railKey){const y=feed.scrollTop;railKey=key;feed.innerHTML=rows.length?rows.map(speechMarkup).join(''):'<p class="observation-empty">No conversations yet.</p>';feed.scrollTop=y;}
  const people=new Map((snapshot?.speech??[]).flatMap(r=>[r.speaker,...r.recipients]).map(a=>[a.id,a]));for(const a of snapshot?.community??catalog)people.set(a.id,a);
  const options=JSON.stringify([...people.values()].map(a=>[a.id,a.name]));if(filter.dataset.options!==options){filter.dataset.options=options;filter.replaceChildren(new Option('All inhabitants',''),...[...people.values()].map(a=>new Option(a.name,a.id)));filter.value=voiceFilter;}
  const moments=rail.querySelector('.world-moments'),events=snapshot?.events??[],eventKey=JSON.stringify(events);
  if(moments.dataset.key!==eventKey){moments.dataset.key=eventKey;moments.innerHTML=events.length?events.slice(0,6).map(e=>`<article><span>${safe(({death:'†',attack:'⚔',block_placed:'▧',mining:'⌁',crafting:'◇',working:'⌖'})[e.type])}</span><div><button type="button" data-inspect-agent="${safe(e.agent.id)}">${safe(e.agent.name)}</button><small>${safe(({death:'Died',attack:'In combat',block_placed:'Building',mining:'Mining',crafting:'Crafting',working:'Working'})[e.type])}</small></div><time datetime="${safe(e.at)}">${safe(clock(e.at))}</time></article>`).join(''):'<p class="observation-empty">The world is quiet.</p>';}
  const dispatch=rail.querySelector('.community-dispatch');dispatch.innerHTML='<span>Next community whisper</span><strong data-dispatch-clock>—</strong>';updateDispatch();
}
function updateDispatch(){const el=$('[data-dispatch-clock]');if(!el)return;if(!snapshot?.activeCount||!snapshot.nextDispatchAt){el.textContent='Waiting';return;}const s=Math.max(0,Math.ceil((snapshot.nextDispatchAt-Date.now())/1000));el.textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
async function poll(){if(!document.hidden&&playerServices!=='unavailable')try{const r=await fetch(apiBase+'/api/rpg/observation',{cache:'no-store',signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error('Offline');snapshot=await r.json();drawCards();renderRail();}catch{if(snapshot){snapshot={...snapshot,activeCount:0};renderRail();}}
  if(selected&&!document.hidden&&Date.now()>=nextProfile)void loadProfile();setTimeout(poll,1500);
}
function inspectorRoot(){if(inlineRoot?.isConnected)return inlineRoot;return $('#observedCharacterDialog .observed-body');}
function openProfile(id){if(!/^(?:C0[1-4]|A\d{2,8})$/.test(id))return;selected=id;generation++;profile=null;profileKey='';tab='overview';
  if(inlineRoot?.isConnected)inlineRoot.hidden=false;else{let dialog=$('#observedCharacterDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='observedCharacterDialog';dialog.innerHTML='<div class="observed-body"></div>';document.body.append(dialog);dialog.addEventListener('close',()=>{selected='';profile=null;});}if(!dialog.open)dialog.showModal();}
  renderProfile();if(inlineRoot?.isConnected)inlineRoot.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});void loadProfile();
}
async function loadProfile(){if(loading||!selected)return;const id=selected,version=generation;loading=true;nextProfile=Date.now()+3000;
  try{if(playerServices==='unavailable'){const a=catalog.find(a=>a.id===id);if(!a)throw Error('Unavailable');profile={...a,stats:{},inventory:[],intentions:[],speech:[],routines:[],whispers:[]};}
    else{const r=await fetch(apiBase+'/api/rpg/observation/agents/'+id,{cache:'no-store',signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error('Unavailable');const data=await r.json();if(id!==selected||version!==generation)return;profile=data;}renderProfile();
  }catch{if(id===selected){profile={id,name:catalog.find(a=>a.id===id)?.name??'Character',status:'offline',stats:{},inventory:[],intentions:[],speech:[],routines:[],whispers:[]};renderProfile();}}finally{loading=false;}
}
function itemSlot(item,chosen=false){return `<span class="observed-item${chosen?' chosen':''}">${item&&/^[a-z0-9_]{1,80}$/.test(item.item)?`<img src="${safe(apiBase)}/item-icons/${item.item}.svg" alt="${safe(pretty(item.item))}" title="${safe(pretty(item.item))}"><b>${number(item.count)>1?number(item.count):''}</b>`:''}</span>`;}
function profileContent(a){
  const s=a.stats??{},v=a.inventoryView;
  if(tab==='inventory')return v?`<div class="observed-equipment">${v.armor.map(item=>itemSlot(item)).join('')}${itemSlot(v.offhand)}</div><div class="observed-inventory">${v.backpack.map(item=>itemSlot(item)).join('')}</div><div class="observed-inventory hotbar">${v.hotbar.map((item,i)=>itemSlot(item,i===v.selectedSlot)).join('')}</div>`:a.inventory?.length?`<div class="observed-inventory">${a.inventory.map(item=>itemSlot(item)).join('')}</div>`:'<p class="observation-empty">No inventory recorded.</p>';
  if(tab==='conversations')return a.speech?.length?a.speech.map(speechMarkup).join(''):'<p class="observation-empty">No conversations yet.</p>';
  if(tab==='intentions')return a.intentions?.length?a.intentions.map(r=>`<article class="observed-entry"><time datetime="${safe(r.at)}">${safe(clock(r.at))}</time><p>${safe(r.text)}</p></article>`).join(''):'<p class="observation-empty">No intentions recorded.</p>';
  if(tab==='routines')return a.routines?.length?a.routines.map(r=>`<article class="observed-entry"><h3>${safe(pretty(r.name))}</h3><p>${safe(r.trigger)}</p><details><summary>Steps</summary><p>${safe(r.steps)}</p></details></article>`).join(''):'<p class="observation-empty">No routines learned yet.</p>';
  if(tab==='whispers')return a.whispers?.length?a.whispers.map(r=>`<article class="observed-entry"><header><time datetime="${safe(r.at)}">${safe(clock(r.at))}</time><span>${safe(pretty(r.status))}</span></header><p>${safe(r.text)}</p>${r.interpretation?`<details><summary>Response</summary><p>${safe(r.interpretation)}</p><p>${safe(r.result)}</p></details>`:''}</article>`).join(''):'<p class="observation-empty">No community whispers yet.</p>';
  return `<div class="observed-overview"><canvas width="280" height="320" data-observed-portrait aria-label="${safe(a.name)}"></canvas><div><div class="observed-vitals">${[['Health',s.health,'health'],['Hunger',s.hunger,'hunger']].map(([label,n,cls])=>`<div class="${cls}"><span>${label}</span><strong>${number(n)} / 20</strong><i><b style="width:${Number.isFinite(n)?Math.max(0,Math.min(100,n*5)):0}%"></b></i></div>`).join('')}</div><dl class="observed-stats">${[['Armor',s.armor],['Level',s.xpLevel],['Deaths',s.deaths],['Wellbeing',s.wellbeing],['Blocks placed',s.blocksPlaced]].map(([label,n])=>`<div><dt>${label}</dt><dd>${number(n)}</dd></div>`).join('')}</dl>${a.currentIntention?`<p class="observed-intention">${safe(a.currentIntention)}</p>`:''}</div></div>`;
}
function renderProfile(){const root=inspectorRoot();if(!root||!selected)return;const a=profile??catalog.find(a=>a.id===selected)??{name:'Character'},key=JSON.stringify([profile?{...profile,updatedAt:null}:null,selected,tab]);if(key===profileKey)return;profileKey=key;
  const y=root.querySelector('.observed-content')?.scrollTop??0,focus=root.contains(document.activeElement)?document.activeElement.dataset.observedTab:null;
  root.innerHTML=`<div class="observed-heading"><div><span class="eyebrow">${a.community?'COMMUNITY':'INHABITANT'}</span><h2>${safe(a.name)}</h2><span>${safe(a.model??'')}${a.effort?' · '+safe(a.effort):''} <small>${a.status==='running'?'In the world':a.status==='offline'?'Offline':'Preparing'}</small></span></div><button type="button" data-observed-close aria-label="Close character profile">×</button></div><div class="observed-tabs" role="tablist" aria-label="Character information">${[['overview','Character'],['inventory','Inventory'],['intentions','Intentions'],['conversations','Conversations'],['routines','Routines'],['whispers','Community whispers']].filter(([id])=>a.community||!['intentions','routines','whispers'].includes(id)).map(([id,label])=>`<button type="button" role="tab" data-observed-tab="${id}" aria-selected="${tab===id}" tabindex="${tab===id?0:-1}">${label}</button>`).join('')}</div><div class="observed-content" role="tabpanel">${profile?profileContent(profile):'<p class="observation-empty">Loading…</p>'}</div>`;
  root.querySelector('.observed-content').scrollTop=y;if(focus)root.querySelector(`[data-observed-tab="${focus}"]`)?.focus();portrait(root.querySelector('[data-observed-portrait]'),a.appearance);
}
document.addEventListener('click',e=>{
  const agent=e.target.closest('[data-inspect-agent]')?.dataset.inspectAgent;if(agent){queueMicrotask(()=>openProfile(agent));return;}
  const id=e.target.closest('[data-observed-tab]')?.dataset.observedTab;if(id){tab=id;renderProfile();return;}
  if(e.target.closest('[data-observed-close]')){selected='';profile=null;if(inlineRoot)inlineRoot.hidden=true;$('#observedCharacterDialog')?.close();return;}
  const pause=e.target.closest('[data-voice-pause]');if(pause){paused=!paused;pause.textContent=paused?'Resume':'Pause';pause.setAttribute('aria-pressed',String(paused));if(!paused){railKey='';renderRail();}}
});
document.addEventListener('change',e=>{if(e.target.id==='voiceAgentFilter'){voiceFilter=e.target.value;railKey='';renderRail();}});
document.addEventListener('keydown',e=>{const button=e.target.closest('[data-observed-tab]');if(!button||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...button.parentElement.querySelectorAll('button')],i=buttons.indexOf(button),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;tab=buttons[next].dataset.observedTab;renderProfile();inspectorRoot()?.querySelector(`[data-observed-tab="${tab}"]`)?.focus();});
setInterval(updateDispatch,1000);
