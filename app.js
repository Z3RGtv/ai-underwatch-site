import {getLanguage} from './i18n.js';
import {captureReadingState,restoreReadingState} from './reading-state.js';
import {relativeTime} from './relative-time.js';
'use strict';
import {achievementsView,syncAchievements} from './achievements.js?v=20261028-collections';
import {syncObservationUI} from './observation.js?v=20261028-world-heads';
import {mapSection,syncWorldMap} from './world-map.js';
import { mountWardrobe } from './wardrobe.js?v=20261026-poollight';
import {mountSpawnPicker} from './spawn-picker.js?v=20261028-four-players';
import { publicView,loadTwitchPlayer,privacyView } from './public-view.js?v=20261028-world-heads';
import * as deployment from './deployment.js';
const {playerServices}=deployment;
let characterWardrobe = null;
let characterSpawn=null,spawnPoll=null;
// UI contract: see ../PLAYER-PORTAL-HANDOFF.md. Authentication belongs to the server.
const API_BASE = window.TWITCH_RPG_API_BASE || '';
const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const fmt = value => num(value).toLocaleString('en-GB');
const color = (value, fallback = '#3b5134') => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
const time = value => relativeTime(value);
const clock = seconds => {const s=Math.max(0,Math.ceil(num(seconds)));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
const itemNames = {wooden_pickaxe:'Wooden pickaxe',oak_log:'Oak log',crafting_table:'Crafting table',bread:'Bread',torch:'Torch'};
let state = null, fetchedAt = 0, online = false, pending = false, refreshing = false;
let page = location.hash.slice(1) || 'refugio', journal = 'resumo', speechFilter = 'all', search = '', communityId = null;
let whisperDraft = '', suggestionDrafts = {}, toastTimer;
let publicSession={};
let archiveRows=[],archiveCursor=null,archiveKind='all',archiveBusy=false,archiveUser=null;
const pendingActions=new Map();
const pages = ['refugio','mundo','comunidade','conquistas','codice'];
const ownAgent = () => state?.agents?.find(a => a.id === state.currentUser?.agentId && a.ownerId === state.currentUser?.id);
const wallet = () => state?.currentUser?.wallet || {};
const demo = () => state?.mode !== 'live';
const canAct = () => online && !pending && Boolean(state?.currentUser);
const remaining = seconds => Math.max(0,num(seconds) - (Date.now()-fetchedAt)/1000);
const avatar = (agent, cls='') => `<canvas class="${cls}" width="440" height="500" data-avatar="${esc(agent.id)}" role="img" aria-label="Character: ${esc(agent.customName)}"></canvas>`;
const empty = (title, copy = '') => `<div class="empty-state"><span class="rune">◇</span><h3>${esc(title)}</h3>${copy?`<p>${esc(copy)}</p>`:''}</div>`;
const authNotice=({cancelled:'Sign-in cancelled.',expired:'Sign-in expired. Please try again.',failed:'Could not sign in with Twitch. Please try again.'})[new URLSearchParams(location.search).get('auth')];
if(authNotice){const clean=new URL(location.href);clean.searchParams.delete('auth');history.replaceState(null,'',clean.pathname+clean.search+clean.hash);}
function toast(message,error=false){const el=$('#toast');el.textContent=message;el.classList.toggle('error',error);el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,5500);}
async function request(path, body) {
  if(playerServices==='unavailable'){
    if(path==='/api/rpg/auth/session')return {authenticated:false,oauthConfigured:false,servicesAvailable:false};
    throw Object.assign(new Error('Player services are not open yet.'),{status:path==='/api/rpg/state'?401:503});
  }
  const csrf=document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('rpg_csrf='))?.slice(9);
  const locale=['pt','es'].includes(getLanguage())?getLanguage():'en';
  const localizedPath=path+(path.includes('?')?'&':'?')+'lang='+locale;
  const response = await fetch(API_BASE + localizedPath, {method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json',...(csrf?{'X-CSRF-Token':decodeURIComponent(csrf)}:{})}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
  let data;try {data=await response.json();}catch {throw new Error('Unexpected response. Try again.');}
  if(!response.ok)throw Object.assign(new Error(data.error || 'Could not complete the request.'),{status:response.status});
  return data;
}
function acceptState(data){state=data;state.agents=Array.isArray(data.agents)?data.agents:[];fetchedAt=Date.now();online=true;characterSpawn?.update(data.spawnChoices);header();}
function clearIdentity(){state=null;whisperDraft='';suggestionDrafts={};search='';communityId=null;archiveRows=[];archiveUser=null;pendingActions.clear();closeDialog();header();}
async function showSignIn(){
  document.title='AI Underwatch · A society under your eye';
  let session;try{session=await request('/api/rpg/auth/session');online=true;}catch{session={};online=false;}
  publicSession={...session,servicesAvailable:online&&session.servicesAvailable!==false};
  if(state&&session.authenticated){header();return;}
  header();
  $('#main').innerHTML=publicView(page,publicSession);syncWorldMap({apiBase:API_BASE});syncObservationUI({apiBase:API_BASE});syncAchievements({apiBase:API_BASE});
  ensureWorldStream();
}
async function refresh(force=false){
  if(refreshing || pending || (!force && (document.hidden || $('#dialog').open || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName))))return;
  refreshing=true;
  try{if(!force&&!state){const session=await request('/api/rpg/auth/session');online=true;if(!session.authenticated){publicSession={...session,servicesAvailable:session.servicesAvailable!==false};header();return;}}const data=await request('/api/rpg/state');acceptState(data);render();}
  catch(error){online=false;if(error.status===401){clearIdentity();await showSignIn();}else if(!state)await showSignIn();else updateTimers();header();}
  finally{refreshing=false;}
}
async function mutate(path,body,message){
  if(!canAct())return toast('Waiting for connection.',true);
  const {requestId:_oldRequest,actionAt:_oldTime,...choice}=body,key=path+':'+JSON.stringify(choice);
  if(!pendingActions.has(key))pendingActions.set(key,{...choice,requestId:crypto.randomUUID(),actionAt:Date.now()});
  const action=pendingActions.get(key);if(pendingActions.size>100)pendingActions.delete(pendingActions.keys().next().value);
  pending=true;updateTimers();
  const disabledBefore = new Map([...document.querySelectorAll('button[data-spend], form button[type=submit]')].map(el=>[el,el.disabled]));
  disabledBefore.forEach((_,el)=>el.disabled=true);
  try{const data=await request(path,action);pendingActions.delete(key);if(data.state)acceptState(data.state);else acceptState(await request('/api/rpg/state'));toast(message);return true;}
  catch(error){if(error.status===409)pendingActions.delete(key);if(error.status===401){online=false;clearIdentity();await showSignIn();}toast(error.message,true);return false;}
  finally{pending=false;render();disabledBefore.forEach((disabled,el)=>{if(el.isConnected)el.disabled=disabled;});}
}
function header(){
  $('#connectionStatus').textContent=state?(online?'Connected':'Offline · saved data'):(publicSession.oauthConfigured?'Player sign-in available':'Player access opens soon');
  $('#environmentLabel').textContent=state&&demo()?'DEMO':state?'SEASON':'PREPARING';
  $('#walletCount').closest('button').disabled=!state;
  $('#walletCount').textContent=state?fmt(Object.entries(wallet()).filter(([k])=>/Tokens$|Credits$/.test(k)).reduce((s,[,v])=>s+num(v),0)):'—';
  $('#twitchSignIn').hidden=Boolean(state);$('#twitchSignIn').disabled=!publicSession.oauthConfigured;$('#twitchSignIn').title=publicSession.oauthConfigured?'Log in with Twitch':'Sign-in opens soon';$('.account-button').hidden=!state;
  $('#accountInitial').textContent=(state?.currentUser?.displayName || '?').slice(0,1).toUpperCase();
  document.querySelectorAll('[data-page]').forEach(el=>{if(el.dataset.page===page)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
}
function ensureWorldStream(){if(page==='mundo'&&$('.watch-screen')&&!$('.watch-screen iframe'))loadTwitchPlayer({autoplay:true,muted:true});}
function drawAvatars(){document.querySelectorAll('[data-avatar]').forEach(canvas=>{const a=state.agents.find(a=>a.id===canvas.dataset.avatar);if(a)window.drawVoxelAvatar(canvas,a.appearance);});}
function render(){
  if(!state){header();$('#main').innerHTML=publicView(page,publicSession);syncWorldMap({apiBase:API_BASE});syncObservationUI({apiBase:API_BASE});syncAchievements({apiBase:API_BASE});ensureWorldStream();return;} if(!pages.includes(page))page='refugio';header();
  document.title=`${({refugio:'Refuge',mundo:'World',comunidade:'Community',conquistas:'Achievements',codice:'Rules'})[page]} · AI Underwatch`;
  if(page==='mundo'&&$('#main [data-world-roster]')&&$('#main .watch-screen iframe')){syncObservationUI({apiBase:API_BASE});return;}
  const livePlayer=$('#main .watch-screen iframe');
  const reading=captureReadingState($('#main'));
  $('#main').innerHTML=({refugio:renderHome,mundo:renderWorld,comunidade:renderCommunity,conquistas:achievementsView,codice:renderCodex})[page]();drawAvatars();updateTimers();syncWorldMap({apiBase:API_BASE});syncObservationUI({apiBase:API_BASE});syncAchievements({apiBase:API_BASE});
  if(livePlayer&&$('#main .watch-screen'))$('#main .watch-screen').replaceChildren(livePlayer);
  ensureWorldStream();
  restoreReadingState($('#main'),reading);
  const journalSection=document.querySelector('.journal-section');if(journalSection){const button=document.createElement('button');button.className='text-link archive-button';button.dataset.action='history-archive';button.textContent='Journal archive ↗';journalSection.prepend(button);}
  document.querySelectorAll('.avatar-label').forEach(label=>{if(!label.textContent.trim())label.remove();});
}
function renderHome(){
  const a=ownAgent();
  const slots=state.slotsStatus||{},position=num(state.currentUser?.waitlistPosition),grace=num(state.currentUser?.gracePeriodRemainingSeconds);
  const hero=`<section class="hero" aria-label="Illustrated world"><div class="hero-inner"><h1>Your refuge.</h1></div></section><div class="season-availability"><span>${state.season?.status==='open'?'Season open':'Season in preparation'}</span><span>${fmt(slots.availablePlayerSlots)} / ${fmt(slots.totalPlayerSlots)} player places available${position?' · Waitlist #'+position:''}${grace?' · Place held for '+Math.ceil(grace/86400)+' days':''}</span></div>`;
  if(!a)return hero+`<div class="page-wrap">${empty('No character yet.',state.currentUser?.canCreateAgent?'':`Own subscription or ${fmt(state.pricing?.nonSubAgentPassPoints)} Channel Points.`)}<div class="btn-row" style="justify-content:center;margin-top:20px"><button class="btn" data-action="customize" ${!state.currentUser?.canCreateAgent?'disabled':''}>Create character</button><a class="btn secondary" href="#comunidade">Community</a></div></div>`;
  const max=a.tier===3?280:a.tier===2?220:180;const v=a.vitals||{};
  return hero+`<div class="page-wrap"><div class="section-heading season-heading"><span class="season-mark">SEASON ${esc(state.season?.number || 1)}</span></div><div class="overview-grid"><section class="panel"><div class="panel-header"><h3>Your character</h3><button class="text-link" data-action="customize">Appearance</button></div><div class="character-sheet"><div class="avatar-stage">${avatar(a)}<span class="avatar-label">${esc(a.appearance?.trait||'')}</span></div><div class="character-details"><div class="eyebrow">${esc(a.title||'OBSERVED')}</div><h2>${esc(a.customName)}</h2><p class="character-title">${esc(({plains:'Plains',forest:'Forest',savanna:'Savanna'})[a.biome]||a.biome||'Unknown')} <span aria-hidden="true">·</span> Tier ${num(a.tier)}${!demo()?' · '+(a.runtime?.status==='running'?'In the world':'Offline'):''}</p><div class="vitals">${vital('Health',v.health,num(v.maxHealth)||20,'health')}${vital('Hunger',v.hunger,20,'food')}<div class="wellbeing"><span>✦ Wellbeing</span><strong>${num(a.happiness)>0?'+':''}${num(a.happiness).toFixed(1)}</strong></div></div></div></div><div class="character-bottom"><div><strong>${fmt(a.deaths)}</strong><span>deaths</span></div><div><strong>${fmt(a.blocksPlacedTotal)}</strong><span>blocks placed</span></div><div><strong>${fmt(a.routines?.length)}</strong><span>routines</span></div></div></section><section class="panel whisper-panel"><div class="whisper-heading"><div><img src="ai-underwatch-eye-animated.svg" alt=""><h3>Whisper</h3></div><span class="badge sage" id="cooldownBadge">Ready</span></div><form id="whisperForm"><div class="input-shell"><textarea id="whisperInput" aria-label="Your whisper" maxlength="${max}" placeholder="Write a whisper…">${esc(whisperDraft)}</textarea><span class="char-counter" id="charCount">${whisperDraft.length} / ${max}</span></div><div class="whisper-foot"><span>◷ <span id="whisperAvailability">Every ${num(a.whisperTotalCooldownSeconds||1800)/60} min</span></span><span>Extra · ${fmt(wallet().whisperCredits)}</span></div><div class="btn-row"><button type="submit" class="btn" id="sendWhisper" data-spend>Send whisper <span aria-hidden="true">↗</span></button><button type="button" class="btn secondary" data-action="extra-whisper" id="extraWhisper" data-spend>Extra · 1 token</button></div></form><div id="whisperQueue">${renderWhisperQueue(a)}</div>${demo()?'<div class="quiet-note">Simulated results</div>':''}</section></div><div class="intention-strip"><span aria-hidden="true">⌖</span><div><div class="eyebrow">CURRENT INTENTION</div><p>${esc(a.currentIntention||'No current intention.')}</p></div></div><section class="journal-section" aria-label="Character journal"><div class="subnav" role="tablist" aria-label="Character details">${[['resumo','Journal',''],['falas','Conversations',a.spokenAndHeard?.length],['sussurros','Whispers',a.whispersHistory?.length],['rotinas','Routines',a.routines?.length],['inventario','Inventory',a.inventory?.length]].map(([id,label,count])=>`<button role="tab" id="tab-${id}" aria-controls="journalContent" data-journal="${id}" aria-selected="${journal===id}" tabindex="${journal===id?0:-1}">${label}${count?`<span>${count}</span>`:''}</button>`).join('')}</div><div id="journalContent" role="tabpanel" aria-labelledby="tab-${journal}">${renderJournal(a)}</div></section></div>`;
}
function vital(label,value,max,cls){const known=value!==null&&value!==undefined&&Number.isFinite(Number(value));return `<div><div class="vital-head"><span>${label}</span><strong>${known?value:'—'} <span class="muted">/ ${max}</span></strong></div><div class="meter ${cls}" role="meter" aria-label="${label}" aria-valuenow="${Math.max(0,Math.min(max,value))}" aria-valuemin="0" aria-valuemax="${max}"><span style="width:${Math.max(0,Math.min(100,value/max*100))}%"></span></div></div>`;}
function feed(messages){return messages.length?messages.map(m=>`<article class="feed-entry"><div class="feed-meta"><span class="direction">${m.direction==='spoken'?'Said':'Heard'}</span><strong>${esc(m.speaker||'Unknown')}</strong><time datetime="${esc(m.at)}">${time(m.at)}</time></div><p>“${esc(m.text)}”</p></article>`).join(''):empty('No conversations yet.');}
function renderJournal(a){
  if(journal==='resumo')return `<div class="journal-grid"><section class="panel journal-panel"><div class="section-title"><h3>Recent intentions</h3></div><div class="timeline">${[...(a.recentIntentions||[])].sort((x,y)=>new Date(y.at)-new Date(x.at)).slice(0,3).map(i=>`<article class="timeline-item"><div class="timeline-meta"><span>${esc(i.source||'Autonomous')}</span><time datetime="${esc(i.at)}">${time(i.at)}</time></div><p>${esc(i.text)}</p></article>`).join('')||empty('No recent intentions.')}</div></section><section class="panel journal-panel"><div class="section-title"><h3>Recent conversations</h3><button class="text-link" data-journal="falas">View all</button></div>${feed((a.spokenAndHeard||[]).slice(0,2))}</section></div><div class="section-heading" style="margin-top:20px"><button class="text-link" data-action="extras">Interventions</button></div>`;
  if(journal==='falas')return `<section class="panel journal-panel"><div class="filter-row"><div class="filters" aria-label="Filter conversations">${[['all','All'],['spoken','Said'],['heard','Heard']].map(([id,label])=>`<button class="filter ${speechFilter===id?'active':''}" data-filter="${id}" aria-pressed="${speechFilter===id}">${label}</button>`).join('')}</div><input class="search" id="speechSearch" type="search" aria-label="Search conversations" placeholder="Search…" value="${esc(search)}"></div><div id="speechResults">${speechResults(a)}</div></section>`;
  if(journal==='sussurros')return (a.whispersHistory||[]).map(w=>renderWhisperHistory(w,a.whisperQueue?.entries?.some(entry=>entry.id===w.id&&entry.canCancel))).join('')||empty('No whispers yet.');
  if(journal==='rotinas')return `<div class="section-heading"><span class="badge">${fmt(wallet().routineTokens)} routine tokens</span></div><div class="routine-list">${(a.routines||[]).map(r=>`<article class="panel routine-card"><span class="eyebrow">${esc(r.origin||'Learned routine')}</span><h3>${esc(r.name?.replaceAll('_',' '))}</h3><p>${esc(r.trigger)}</p><details><summary>Steps</summary><p>${esc(r.steps)}</p></details><div class="routine-actions"><small>Runs · ${fmt(r.executions)}${demo()?' · simulated':''}</small><button class="text-link" data-action="routine" data-id="${esc(r.id)}">Edit</button></div></article>`).join('')}</div>`;
  return `<div class="section-heading"><span class="badge">${fmt(a.inventory?.length)} item types</span></div><div class="inventory-grid">${(a.inventory||[]).map(i=>`<div class="inventory-item"><strong>×${fmt(i.count)}</strong><img src="${esc(deployment.publicWorldOrigin||API_BASE)}/item-icons/${/^[a-z0-9_]+$/.test(i.item)?i.item:'unknown'}.svg" alt=""><span>${esc(itemNames[i.item]||String(i.item).replaceAll('_',' '))}</span></div>`).join('')}</div>`;
}
function speechResults(a){return feed((a.spokenAndHeard||[]).filter(m=>(speechFilter==='all'||m.direction===speechFilter)&&`${m.text} ${m.speaker}`.toLocaleLowerCase('en').includes(search.toLocaleLowerCase('en'))));}
function renderCommunity(){
  const agents=state.agents.filter(a=>a.isCommunity);if(!agents.some(a=>a.id===communityId))communityId=agents[0]?.id;
  const selected=agents.find(a=>a.id===communityId), suggestions=(state.communityVoting?.suggestions||[]).filter(s=>s.agentId===communityId&&s.status==='open').sort((a,b)=>num(b.votes)-num(a.votes)||new Date(a.createdAt)-new Date(b.createdAt));
  return `<div class="page-wrap"><div class="page-intro"><div><h1>Community.</h1></div><div class="countdown"><small>NEXT DISPATCH</small><span id="communityClock">—</span></div></div><div class="community-grid">${agents.map((a,i)=>`<button class="community-card ${a.id===communityId?'selected':''}" data-community="${esc(a.id)}" data-inspect-agent="${esc(a.id)}" aria-pressed="${a.id===communityId}"><div class="portrait" style="--accent:${color(a.appearance?.tunicColor)}">${avatar(a)}</div><div class="card-copy"><h3>${esc(a.customName)}</h3><p>${esc(a.appearance?.trait||'Community agent')}</p><div class="card-footer"><span>AGENT 0${i+1}</span><span>${(state.communityVoting?.suggestions||[]).filter(s=>s.agentId===a.id&&s.status==='open').length} queued</span></div></div></button>`).join('')}</div><section data-community-inspector hidden></section><div class="community-layout"><section><div class="section-title"><h3>Queue · ${esc(selected?.customName||'agent')}</h3></div>${suggestions.map((s,i)=>{const used=num(s.voters?.[state.currentUser?.id]),max=num(state.communityVoting?.maxVotesPerUser)||5;return `<article class="queue-item"><span class="rank">${String(i+1).padStart(2,'0')}</span><div class="queue-text"><p>${esc(s.text)}</p><small>${esc(s.authorName)} · ${used}/${max} votes used</small></div><button class="vote-button" data-action="vote" data-id="${esc(s.id)}" data-spend ${!canAct()||num(wallet().voteTokens)<1||used>=max?'disabled':''} aria-label="Vote on suggestion ${i+1}, spend 1 token"><strong>${fmt(s.votes)}</strong>↑ Vote</button></article>`;}).join('')||empty('No suggestions yet.')}</section><section class="panel suggest-panel"><h3>Suggest a whisper</h3><form id="suggestionForm"><label for="suggestionText">To ${esc(selected?.customName||'community')}</label><textarea id="suggestionText" maxlength="220" placeholder="Write a suggestion…" required>${esc(suggestionDrafts[communityId]||'')}</textarea><button type="submit" id="suggestionSubmit" class="btn full" data-spend ${!canAct()||!selected||(!state.communityVoting?.freeAccess?.suggestionAvailable&&num(wallet().suggestionTokens)<1)?'disabled':''}>${state.communityVoting?.freeAccess?.suggestionAvailable?'Suggest · Free':'Suggest · 1 token'}</button></form><p class="balance-note">Votes · ${fmt(wallet().voteTokens)}${state.communityVoting?.freeAccess?.enabled?' / 25':''} · Suggestions · ${fmt(wallet().suggestionTokens)}</p>${state.communityVoting?.freeAccess?.enabled?'<p class="balance-note" id="communityAllowanceClock"></p>':''}<button class="text-link" data-action="wallet">Wallet</button></section></div></div>`;
}
function renderWorld(){
  const slots=Array.isArray(state.cameras?.slots)?state.cameras.slots:Object.values(state.cameras?.slots||{});
  const order=['Cam_Center','Cam_L1','Cam_R1','Cam_L2','Cam_R2','Cam_World'];
  return `<div class="page-wrap"><div class="page-intro"><div><h1>World.</h1></div><span class="badge sage">${state.agents.length} characters</span></div><nav class="inhabitant-strip" data-world-roster aria-label="Inhabitants"></nav>${mapSection()}<div class="section-heading world-stream-heading"><h2>Live on Twitch.</h2><a class="text-link" href="https://www.twitch.tv/aiunderwatch" target="_blank" rel="noopener noreferrer">Open Twitch ↗</a></div><section class="watch-screen world-stream" aria-label="AI Underwatch Twitch stream"><div class="watch-placeholder"><span class="eyebrow">AI UNDERWATCH · TWITCH</span><button class="btn secondary" data-action="load-stream">Watch live ▷</button></div></section><div class="section-title"><h3>Cameras</h3><button class="text-link" data-action="camera-info">Camera rules</button></div><div class="camera-grid">${order.map((id,i)=>{const slot=slots.find(s=>s.id===id);const a=state.agents.find(a=>a.id===(slot?.targetAgentId||slot?.agent?.id));return `<article class="camera-tile ${id==='Cam_Center'?'center':''}"><span class="camera-slot">${id==='Cam_Center'?'Center':id==='Cam_R2'?'Community':({Cam_L1:'Side 1',Cam_L2:'Side 2',Cam_R1:'Side 3',Cam_World:'World'})[id]}</span>${a?avatar(a):''}<div class="camera-copy"><h3>${esc(a?.customName||'Unassigned')}</h3>${slot?.lockRemainingSeconds>0?`<p>Reserved · ${clock(slot.lockRemainingSeconds)}</p>`:''}</div></article>`;}).join('')}</div><p class="camera-label">Camera preview · no live video</p></div>`;
}
function renderCodex(){const p=state.pricing||{};return `<div class="page-wrap"><div class="page-intro"><h1>Rules.</h1></div><div class="codex-grid"><article class="panel codex-card"><h2>Character access</h2><ul><li>Own subscription or ${fmt(p.nonSubAgentPassPoints)} Channel Points.</li><li>Gift subs do not unlock characters.</li><li>${num(state.season?.maxAgents)||20} characters per season; full seasons use a waitlist.</li><li>First appearance included. Further changes require Channel Points.</li></ul></article><article class="panel codex-card"><h2>Whispers</h2><table class="tier-table"><thead><tr><th>Tier</th><th>Included</th><th>Extra</th></tr></thead><tbody>${[1,2,3].map(t=>`<tr><td>${t}</td><td>Every ${num(state.tiers?.[t]?.whisperCooldownSeconds||1800)/60} min</td><td>${fmt(p.extraWhisperBits)} Bits</td></tr>`).join('')}</tbody></table></article><article class="panel codex-card"><h2>Community voting</h2><ul>${state.communityVoting?.freeAccess?.enabled?'<li>One free suggestion every 2 hours.</li><li>Five vote tokens every 2 hours, up to 25.</li>':`<li>Suggest · ${fmt(p.communitySuggestionPoints)} Channel Points.</li><li>Vote · ${fmt(p.communityVotePoints)} Channel Points.</li>`}<li>Up to ${fmt(state.communityVoting?.maxVotesPerUser||5)} votes per person, per suggestion.</li><li>Each agent receives its top suggestion every ${num(p.communityDispatchIntervalSeconds||1800)/60} min.</li></ul><a class="text-link" href="#comunidade">Community</a></article><article class="panel codex-card"><h2>Tokens</h2><p>Redeem on Twitch. Spend from your wallet.</p><button class="text-link" data-action="wallet">Wallet & prices</button></article></div></div>`;}
function renderWhisperHistory(w,canRemove=false){
  const terminal=['cancelled','interrupted','rejected'].includes(w.status),retrying=w.status==='retrying';
  const label=({queued:'Queued',processing:w.steps?.aiSentAt?'Waiting for AI':'Queued',retrying:`Retrying · ${Math.min(3,num(w.failures)+1)} / 3`,interrupted:'Interrupted',cancelled:w.failureReason?'Cancelled after delivery failure':'Removed',rejected:'Rejected',action_prepared:'Interpreted',confirmed:'Completed'})[w.status]||w.status;
  const reason=({model_timeout:'The AI response timed out.',runtime_restarted:'The session restarted.',model_error:'The AI request failed.',invalid_response:'The AI response was invalid.',decision_rejected:'The response could not be applied.',retry_cancelled:'Retry cancelled.'})[w.failureReason]||'';
  const received=w.steps?.aiSentAt?whisperTimestamp('Received by AI',w.steps.aiSentAt):terminal?'':w.steps?.interpreted?'<span>Delivery time unavailable</span>':'<span>Not delivered yet</span>';
  return `<article class="panel history-card"><div class="timeline-meta"><span>${esc(w.sourceLabel||'Your whisper')}</span><span class="whisper-times">${whisperTimestamp('Sent',w.at)}${received}</span></div><blockquote>“${esc(w.prompt)}”</blockquote><div class="whisper-result"><span class="badge ${retrying?'sage':''}">${esc(label)}</span>${retrying?`<span>Next attempt · ${time(w.retryAt)}</span><button class="text-link whisper-remove" data-action="remove-whisper" data-id="${esc(w.id)}" data-spend>Cancel retry</button>`:''}${canRemove&&!terminal&&!retrying?`<button type="button" class="text-link whisper-remove" data-action="remove-whisper" data-id="${esc(w.id)}" data-spend ${!canAct()?'disabled':''}>Remove</button>`:''}${w.compensation?'<span>1 replacement whisper returned · use Extra</span>':''}${terminal?`<button class="text-link" data-action="reuse-whisper" data-id="${esc(w.id)}">Reuse text</button>`:''}</div>${reason&&(terminal||retrying)?`<p class="whisper-failure">${esc(reason)}</p>`:''}${!terminal&&!retrying?`<div class="history-steps"><span class="done">01 · ${w.steps?.aiSentAt?'Sent to AI':'Queued'}</span><span class="${w.steps?.interpreted?'done':''}">02 · Interpreted</span><span class="${w.steps?.routineGenerated?'done':''}">03 · Action ready</span><span class="${w.steps?.resultConfirmed?'done':''}">04 · ${demo()?'Simulated result':'Result'}</span></div>`:''}${w.steps?.interpreted||w.steps?.resultConfirmed?`<details data-whisper-response="${esc(w.id)}"><summary>Response</summary><p>${esc(w.steps?.interpreted||'')}</p><p>${esc(w.steps?.resultConfirmed||'')}</p></details>`:''}</article>`;
}
function whisperTimestamp(label,value){const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';const full=d.toLocaleString('en-GB',{timeZone:'Europe/Lisbon',dateStyle:'medium',timeStyle:'medium'})+' · Lisbon';return `<span>${label} <time datetime="${esc(d.toISOString())}" title="${esc(full)}">${time(value)}</time></span>`;}
function renderWhisperQueue(a){const q=a?.whisperQueue;if(!q)return '';return `<div class="whisper-queue-head"><span>QUEUE · ${num(q.normalQueued)} / ${num(q.capacity)}</span><span>${num(q.normalAvailable)} free places</span></div>${q.entries.map((w,i)=>`<div class="whisper-queue-entry"><span>${w.extra?'EXTRA':String(i+1).padStart(2,'0')}</span><p>${esc(w.prompt)}</p>${w.canCancel?`<button type="button" class="text-link whisper-remove" data-action="remove-whisper" data-id="${esc(w.id)}" data-spend aria-label="Remove queued whisper ${i+1}" ${!canAct()?'disabled':''}>Remove</button>`:''}</div>`).join('')}`;}
function updateTimers(){
  if(!state)return;const a=ownAgent(),q=a?.whisperQueue,cd=remaining(q?.nextNormalInSeconds??a?.whisperCooldownRemainingSeconds);
  if($('#cooldownBadge')){
    $('#cooldownBadge').textContent=q?`${num(q.normalQueued)} / ${num(q.capacity)} queued`:cd>0?clock(cd):'Ready';
    $('#whisperAvailability').textContent=q?(cd>0?`Next AI delivery in ${clock(cd)}`:`Every ${num(a?.whisperTotalCooldownSeconds||1800)/60} min`):cd>0?`Ready in ${clock(cd)}`:`Every ${num(a?.whisperTotalCooldownSeconds||1800)/60} min`;
    $('#sendWhisper').disabled=!canAct()||(q?!q.canQueueNormal:cd>0)||!whisperDraft.trim();
    $('#extraWhisper').disabled=!canAct()||num(wallet().whisperCredits)<1||!whisperDraft.trim();
  }
  if($('#communityClock'))$('#communityClock').textContent=clock(remaining(state.communityVoting?.nextDispatchInSeconds));
  const free=state.communityVoting?.freeAccess;
  if($('#communityAllowanceClock')&&free?.enabled)$('#communityAllowanceClock').textContent=`${free.suggestionAvailable?'Free suggestion ready':`Free suggestion in ${clock(remaining(free.nextSuggestionInSeconds))}`} · +5 votes in ${clock(remaining(free.nextVotesInSeconds))}`;
}
function disposeCustomizer(){characterWardrobe?.destroy();characterWardrobe=null;characterSpawn?.destroy();characterSpawn=null;clearInterval(spawnPoll);spawnPoll=null;}
function openDialog(html){disposeCustomizer();$('#dialog').classList.remove('wardrobe-dialog');$('#dialogBody').innerHTML=html;if(!$('#dialog').open)$('#dialog').showModal();}
function closeDialog(){disposeCustomizer();$('#dialog').close();}
$('#dialog').addEventListener('close',disposeCustomizer);
const productLabel=type=>({redeem_vote_token:'Vote',redeem_suggestion_token:'Suggestion',redeem_skin_change:'Appearance',redeem_camera_switch:'Side camera',bits_center_spotlight:'Main spotlight',bits_camera_lock:'Camera reservation',bits_global_rumor:'World rumor',redeem_sound_token:'Omen',redeem_gift_token:'Supplies',bits_gift_token:'Supplies',redeem_routine_token:'Routine',bits_routine_token:'Routine',bits_extra_whisper:'Whisper',sub:'Subscription',sub_expired:'Subscription',redeem_agent_pass:'Character pass',hear_sound:'Omen',divine_gift:'Supplies',global_rumor:'World rumor',routine_edit:'Routine change',routine_delete:'Routine removal'})[type]||'Token';
const receiptRows=items=>items.map(r=>`<div class="receipt-row"><span>${esc(productLabel(r.type))}<small>${time(r.at)}</small></span><span class="receipt-status ${esc(r.status)}">${esc(({pending:'Pending',delivered:'Delivered',cancelled:'Cancelled',refunded:'Token returned',partial:'Partly delivered',review:'Checking delivery'})[r.status]||r.status)}</span></div>`).join('');
function openWallet(){
  const p=state.pricing||{},items=[['suggestionTokens','Suggestions','✧',state.communityVoting?.freeAccess?.enabled?'1 free / 2 hours':`${fmt(p.communitySuggestionPoints)} points`],['voteTokens','Votes','↑',state.communityVoting?.freeAccess?.enabled?'+5 / 2 hours · max 25':`${fmt(p.communityVotePoints)} points`],['whisperCredits','Extra whispers','◇',`${fmt(p.extraWhisperBits)} Bits`],['skinChangeCredits','Appearance','◇','Channel Points'],['routineTokens','Routines','⌘',`${fmt(p.routineTokenPoints)} points / ${fmt(p.routineTokenBits)} Bits · !routine`],['cameraSwitchCredits','Side camera','▣',`${fmt(p.sideCameraSwitchPoints)} points`],['cameraLockCredits','Side reservation','▣',`${fmt(p.cameraLock1hBits)} Bits · 1 hour`],['centerSpotlightCredits','Main spotlight','◈',`${fmt(p.centerSpotlightBits)} Bits · 5 min`],['giftCredits','Supplies','✦',`${fmt(p.divineGiftPoints)} points / ${fmt(p.divineGiftBits)} Bits · !gift`],['soundCredits','Omens','≋',`${fmt(p.hearSoundNowPoints)} points`],['rumorCredits','World rumors','⌁',`${fmt(p.globalRumorBits)} Bits`]];
  openDialog(`<h2 id="dialogTitle">Wallet</h2><div class="wallet-grid">${items.map(([key,label,icon,cost])=>`<div class="wallet-item"><span class="rune">${icon}</span><div><h3>${label}</h3><p>${cost}</p></div><strong>${fmt(wallet()[key])}</strong></div>`).join('')}</div>${demo()?'<span class="badge wallet-twitch">Demo balances</span>':'<a class="text-link wallet-twitch" href="https://www.twitch.tv/aiunderwatch" target="_blank" rel="noopener noreferrer">Redeem on Twitch</a>'}<div class="btn-row wallet-twitch"><button class="text-link" data-action="extras">Use tokens</button></div>${state.purchases?.length?`<div class="receipt-list"><div class="section-title"><h3>Recent redemptions</h3><button class="text-link" data-action="refresh-wallet">Refresh</button></div>${receiptRows(state.purchases.slice(0,5))}</div>`:''}`);
}
function openCustomizer(){
  if(!state.currentUser?.canCreateAgent)return toast('Unlock your character first.',true);
  const a=ownAgent(),tier=state.currentUser.subTier||1,models=state.tiers?.[tier]?.models||[];
  const credit=num(wallet().skinChangeCredits),saved=Boolean(a?.customized),locked=saved&&credit<1;
  const policy=locked?'To change your look, redeem a skin change with Twitch Channel Points.':saved?'Save uses 1 skin change. Your appearance locks again.':'First look included. Further changes require Twitch Channel Points.';
  openDialog(`<h2 id="dialogTitle">Your appearance.</h2><form id="customizerForm"><div id="characterWardrobe"></div><fieldset class="wardrobe-save-fields" ${locked?'disabled':''}><div class="form-field">Character name<strong>${esc(state.currentUser.displayName||state.currentUser.twitchUsername||'Twitch account')}</strong></div><label class="form-field">Mind<select name="modelKey">${models.map(m=>`<option value="${esc(m.key)}" ${m.key===a?.modelKey?'selected':''}>${esc(m.label)}</option>`).join('')}</select></label></fieldset><div class="wardrobe-save-row"><p>${policy}${locked?' <a href="https://www.twitch.tv/aiunderwatch" target="_blank" rel="noopener noreferrer">Twitch ↗</a>':''}</p><button class="btn" type="submit" ${!online||locked?'disabled':''}>${locked?'Appearance saved':saved?'Save appearance · 1 change':'Save appearance ↗'}</button></div></form>`);
  $('#dialog').classList.add('wardrobe-dialog');
  characterWardrobe=mountWardrobe($('#characterWardrobe'),{appearance:a?.appearance||{},locked});
  const picker=document.createElement('section');$('#customizerForm .wardrobe-save-row').before(picker);
  characterSpawn=mountSpawnPicker(picker,{choices:state.spawnChoices,selected:(state.spawnChoices?.selectionMode==='group'?a?.initialSpawn?.groupId:a?.initialSpawn?.slotId)||'',locked:saved,onChange:id=>{$('#customizerForm button[type="submit"]').disabled=!online||locked||!id;}});
  if(!saved){$('#customizerForm button[type="submit"]').disabled=true;spawnPoll=setInterval(async()=>{if(document.hidden||pending||refreshing)return;try{const data=await request('/api/rpg/state');if(!characterSpawn)return;acceptState(data);}catch{}},5000);}
}
function appearanceFromForm(){return characterWardrobe?.getAppearance()||{};}
function drawArchive(){
  if(!$('#dialog').open||!state||archiveUser!==state.currentUser.id)return;
  $('#dialogBody').innerHTML=`<h2 id="dialogTitle">Journal archive</h2><div class="filters archive-filters">${[['all','All'],['speech','Conversations'],['intention','Intentions'],['whisper','Whispers']].map(([kind,label])=>`<button data-action="history-kind" data-id="${kind}" class="filter ${archiveKind===kind?'active':''}" aria-pressed="${archiveKind===kind}">${label}</button>`).join('')}</div><div class="archive-entries">${archiveRows.map(row=>`<article class="feed-entry"><div class="feed-meta"><span>${esc(row.type==='speech'?(row.direction==='spoken'?'Said':'Heard'):row.type==='whisper'?'Whisper':'Intention')}</span><time datetime="${esc(row.at)}">${time(row.at)}</time></div>${row.speaker?`<strong>${esc(row.speaker)}</strong>`:''}${row.prompt?`<blockquote>“${esc(row.prompt)}”</blockquote>`:''}<p>${esc(row.text||row.status||'')}</p></article>`).join('')||empty(archiveBusy?'Loading…':'No archived entries yet.')}</div>${archiveCursor?`<button class="btn secondary" data-action="history-more" ${archiveBusy?'disabled':''}>${archiveBusy?'Loading…':'Load older'}</button>`:''}`;
}
async function openArchive(reset=true){
  if(archiveBusy||!state)return;
  if(reset){archiveRows=[];archiveCursor=null;archiveUser=state.currentUser.id;openDialog('<h2 id="dialogTitle">Journal archive</h2>');}
  archiveBusy=true;drawArchive();
  try{const params=new URLSearchParams({kind:archiveKind,limit:'30'});if(archiveCursor)params.set('cursor',archiveCursor);const result=await request('/api/rpg/history?'+params);if(state?.currentUser.id!==archiveUser)return;archiveRows.push(...result.entries);archiveCursor=result.nextCursor;}
  catch(error){toast(error.message,true);}finally{archiveBusy=false;drawArchive();}
}
function openRoutine(id){const a=ownAgent(),r=a?.routines?.find(r=>r.id===id);if(!r)return;const enabled=num(wallet().routineTokens)>0&&(demo()||a.interventionsAvailable?.includes('routine_edit'));openDialog(`<h2 id="dialogTitle">Edit routine</h2><form id="routineForm" data-id="${esc(id)}" class="detail-form"><label>Label<input name="name" maxlength="80" value="${esc(r.name?.replaceAll('_',' '))}" required></label><label>When<select name="trigger"><option value="keep">Keep current condition</option><option value="always">Always</option><option value="low_health">Low health</option><option value="low_food">Hungry</option></select></label><label>Action<select name="steps"><option value="keep">Keep current actions</option><option value="wait:5">Wait 5 seconds</option><option value="wait:15">Wait 15 seconds</option><option value="say">Say something</option></select></label><label id="routineSpeech" hidden>Speech<input name="speech" maxlength="140" placeholder="What should they say?"></label><div class="btn-row"><button type="button" class="btn danger" data-action="delete-routine" data-id="${esc(id)}" ${!enabled?'disabled':''}>Delete · 1 token</button><button type="submit" class="btn" ${!enabled?'disabled':''}>Save · 1 token</button></div></form>`);}
function confirmSpend(title,copy,action,id=''){openDialog(`<h2 id="dialogTitle">${esc(title)}</h2><p class="dialog-copy">${esc(copy)}</p><div class="btn-row"><button class="btn secondary" data-action="close-dialog">Cancel</button><button class="btn" data-action="${action}" data-id="${esc(id)}" data-spend>Confirm</button></div>`);}
function openExtras(){const a=ownAgent(),active=demo()||a?.runtime?.status==='running';openDialog(`<h2 id="dialogTitle">Interventions</h2>${!active?'<span class="badge">Character offline</span>':''}<div class="action-list">${[['sound','≋','Omen','',wallet().soundCredits,'hear_sound'],['gift','✦','Supplies','2 items',wallet().giftCredits,'divine_gift'],['rumor','⌁','World rumor','Everyone hears',wallet().rumorCredits,'global_rumor'],['switch','▣','Side camera','',wallet().cameraSwitchCredits],['camera','▣','Reserve side camera','1 hour',wallet().cameraLockCredits],['spotlight','◈','Main spotlight','5 minutes',wallet().centerSpotlightCredits]].map(([id,icon,title,desc,balance,capability])=>`<div class="action-item"><span class="rune">${icon}</span><div><h3>${title}</h3>${desc?`<p>${desc}</p>`:''}<small>${fmt(balance)} available</small></div><button class="btn secondary small" data-action="extra-detail" data-id="${id}" ${num(balance)<1||(id==='rumor'?!state.worldInterventionsAvailable?.includes('global_rumor'):!active)||(!demo()&&id!=='rumor'&&capability&&!a?.interventionsAvailable?.includes(capability))?'disabled':''}>Choose</button></div>`).join('')}</div>${state.interventions?.length?`<div class="receipt-list"><h3>Recent interventions</h3>${receiptRows(state.interventions.slice(0,5))}</div>`:''}`);}
function extraDetail(id){
  if(['camera','switch','spotlight'].includes(id)){
    const title=({camera:'Reserve side camera',switch:'Show my character',spotlight:'Main spotlight'})[id];
    const slots=Array.isArray(state.cameras?.slots)?state.cameras.slots:Object.values(state.cameras?.slots||{}),a=ownAgent();
    const available=s=>!(s?.lockedUntil>Date.now()&&s?.targetAgentId!==a?.id);
    openDialog(`<h2 id="dialogTitle">${title}</h2><form id="extraForm" data-type="${id}" class="detail-form">${id!=='spotlight'?`<label>Camera<select name="slotId">${['Cam_L1','Cam_L2','Cam_R1'].map((sid,i)=>{const slot=slots.find(s=>s.id===sid);return `<option value="${sid}" ${!available(slot)?'disabled':''}>Side ${i+1}${!available(slot)?' · Reserved':''}</option>`}).join('')}</select></label>`:''}<button type="submit" class="btn">${id==='camera'?'Reserve 1 hour':id==='spotlight'?'Spotlight 5 minutes':'Show character'} · 1 token</button></form>`);return;
  }
  openDialog(`<h2 id="dialogTitle">${id==='sound'?'Send an omen':id==='rumor'?'Start a rumor':'Give supplies'}</h2><form id="extraForm" data-type="${id}" class="detail-form">${id!=='gift'?'<label>Message<textarea name="text" maxlength="160" required placeholder="Write a message…"></textarea></label>':'<label>Item<select name="item"><option value="bread">Bread ×2</option><option value="torch">Torch ×2</option><option value="oak_log">Wood ×2</option><option value="golden_apple">Golden apple ×2</option></select></label>'}<button type="submit" class="btn">Send · 1 token</button></form>`);
}
document.addEventListener('input',e=>{
  if(e.target.id==='whisperInput'){whisperDraft=e.target.value;$('#charCount').textContent=`${whisperDraft.length} / ${e.target.maxLength}`;updateTimers();}
  if(e.target.id==='suggestionText')suggestionDrafts[communityId]=e.target.value;
  if(e.target.id==='speechSearch'){search=e.target.value;$('#speechResults').innerHTML=speechResults(ownAgent());}

});
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  if(b.dataset.action==='twitch-signin'){if(publicSession.oauthConfigured)location.assign(API_BASE+'/api/rpg/auth/twitch/login');return;}
  if(b.dataset.action==='load-stream'){loadTwitchPlayer();return;}
  if(b.dataset.action==='privacy'){openDialog(privacyView());return;}
  if(b.dataset.journal){journal=b.dataset.journal;const y=scrollY;render();window.scrollTo(0,y);return;}
  if(b.dataset.filter){speechFilter=b.dataset.filter;render();return;}
  if(b.dataset.community){communityId=b.dataset.community;render();return;}

  if(!state&&b.dataset.action==='account'){await showSignIn();return;}
  if(!state && b.dataset.action!=='retry')return;
  const id=b.dataset.id,a=ownAgent();
  switch(b.dataset.action){
    case 'retry':await refresh(true);break;
    case 'close-dialog':closeDialog();break;
    case 'wallet':openWallet();break;
    case 'refresh-wallet':await refresh(true);openWallet();break;
    case 'customize':await refresh(true);openCustomizer();break;
    case 'routine':openRoutine(id);break;
    case 'extras':openExtras();break;
    case 'history-archive':await openArchive();break;
    case 'history-more':await openArchive(false);break;
    case 'history-kind':if(!archiveBusy){archiveKind=id;await openArchive();}break;
    case 'extra-detail':extraDetail(id);break;
    case 'account':openDialog(`<h2 id="dialogTitle">${esc(state.currentUser?.displayName||'Account')}</h2>${demo()?'<span class="badge">Demo account</span>':''}<div class="info-box">${a?`${esc(a.customName)} · Tier ${num(a.tier)}`:'No character.'}</div>${!demo()?'<div class="btn-row account-actions"><a class="btn secondary" href="/api/rpg/auth/twitch/login">Switch Twitch account</a><button class="btn secondary" data-action="logout">Sign out</button></div>':''}`);break;
    case 'logout':if(pending)break;pending=true;try{await request('/api/rpg/auth/logout',{});clearIdentity();}catch(error){toast(error.message,true);}finally{pending=false;}await refresh(true);break;
    case 'camera-info':openDialog('<h2 id="dialogTitle">Cameras</h2><ul class="compact-rules"><li>Center · highlights</li><li>Three sides · players</li><li>Community · four rotating agents</li><li>World · nearby activity</li></ul><span class="badge">Preview · no live video</span>');break;
    case 'reuse-whisper':{const w=a?.whispersHistory?.find(w=>w.id===id);if(w){whisperDraft=w.prompt;page='refugio';render();$('#whisperInput')?.focus();$('#whisperForm')?.scrollIntoView({block:'center',behavior:'smooth'});}break;}
    case 'remove-whisper':await mutate('/api/rpg/whisper',{agentId:a?.id,whisperId:id,action:'cancel'},'Whisper removed.');break;
    case 'extra-whisper':confirmSpend('Send extra whisper?',`1 extra whisper token: “${whisperDraft.trim()}”`,'confirm-extra');break;
    case 'confirm-extra':if(await mutate('/api/rpg/whisper',{agentId:a?.id,prompt:whisperDraft.trim(),useExtraCredit:true},'Whisper queued.')){whisperDraft='';closeDialog();render();}break;
    case 'vote':confirmSpend('Vote?','1 vote token.','confirm-vote',id);break;
    case 'confirm-vote':if(await mutate('/api/rpg/community/vote',{suggestionId:id,votes:1},'Vote counted.'))closeDialog();break;
    case 'delete-routine':confirmSpend('Delete routine?','1 routine token. This removes the routine.','confirm-delete',id);break;
    case 'confirm-delete':if(await mutate('/api/rpg/routine',{agentId:a?.id,routineId:id,action:'delete'},demo()?'Routine deleted.':'Routine change queued.'))closeDialog();break;
  }
});
document.addEventListener('submit',async e=>{
  const f=e.target;if(!['whisperForm','suggestionForm','customizerForm','routineForm','extraForm'].includes(f.id))return;e.preventDefault();if(pending)return;
  const a=ownAgent(),d=Object.fromEntries(new FormData(f));
  if(f.id==='whisperForm'&&await mutate('/api/rpg/whisper',{agentId:a?.id,prompt:whisperDraft.trim(),useExtraCredit:false},'Whisper queued.')){whisperDraft='';render();}
  if(f.id==='suggestionForm'&&await mutate('/api/rpg/community/suggest',{agentId:communityId,text:suggestionDrafts[communityId]?.trim()},'Suggestion added.')){suggestionDrafts[communityId]='';render();}
  if(f.id==='customizerForm'){const appearance=appearanceFromForm(),spawnSlotId=characterSpawn?.getSelected();if(!a&&!spawnSlotId)return toast('Choose an available spawn on the map.',true);if(await mutate('/api/rpg/customize',{modelKey:d.modelKey,appearance,...(state.spawnChoices?.selectionMode==='group'?{spawnGroupId:spawnSlotId}:{spawnSlotId})},'Appearance saved and locked.'))closeDialog();else if(!a)try{acceptState(await request('/api/rpg/state'));}catch{}}
  if(f.id==='routineForm'){const steps=d.steps==='say'?'say:'+d.speech:d.steps;if(await mutate('/api/rpg/routine',{agentId:a?.id,routineId:f.dataset.id,action:'edit',name:d.name,trigger:d.trigger,steps},demo()?'Routine saved.':'Routine change queued.'))closeDialog();}
  if(f.id==='extraForm'){
    const type=f.dataset.type,camera=['camera','switch','spotlight'].includes(type);f.dataset.requestId??=crypto.randomUUID();
    const body=camera?{agentId:a?.id,action:({camera:'bits_lock_1h',switch:'points_switch',spotlight:'center_spotlight'})[type],slotId:d.slotId}:{agentId:a?.id,actionType:({sound:'hear_sound',gift:'divine_gift',rumor:'global_rumor'})[type],requestId:f.dataset.requestId,...d};
    if(await mutate(camera?'/api/rpg/camera':'/api/rpg/world-action',body,camera?'Camera updated.':demo()?'Intervention sent.':'Delivery queued.'))closeDialog();
  }
});
document.addEventListener('change',e=>{if(e.target.matches('#routineForm select[name="steps"]')){$('#routineSpeech').hidden=e.target.value!=='say';$('#routineSpeech input').required=e.target.value==='say';}});
document.addEventListener('keydown',e=>{const tab=e.target.closest('[role=tab]');if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const all=[...document.querySelectorAll('[role=tab]')],i=all.indexOf(tab),next=e.key==='Home'?0:e.key==='End'?all.length-1:(i+(e.key==='ArrowRight'?1:-1)+all.length)%all.length;journal=all[next].dataset.journal;render();$(`#tab-${journal}`).focus();}});
$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
window.addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(!pages.includes(next))return;page=next;closeDialog();render();if(!state&&page==='mundo')document.querySelector('.watch-wrap')?.scrollIntoView();else window.scrollTo(0,0);});
setInterval(updateTimers,1000);setInterval(()=>{if(state)refresh();},30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});refresh(true).then(()=>{if(authNotice)toast(authNotice,true);});
