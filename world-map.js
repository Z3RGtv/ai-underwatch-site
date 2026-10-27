import * as deployment from './deployment.js';
const {playerServices}=deployment;

export const mapSection = () => `<section class="island-atlas" aria-label="Island map" data-island-map><header class="atlas-heading"><div><span class="eyebrow">THE LIVING WORLD</span><h2>The first island.</h2></div><span class="atlas-state" role="status"><i></i><span>Connecting</span></span></header><div class="atlas-stage"><div class="atlas-viewport" tabindex="0" role="region" aria-label="Interactive island map. Use arrow keys to pan, plus or minus to zoom, and Home to fit."><canvas aria-hidden="true"></canvas><div class="atlas-markers"></div><span class="atlas-north" aria-hidden="true">N</span><div class="atlas-tools" aria-label="Map controls"><button type="button" data-map="in" aria-label="Zoom in">+</button><button type="button" data-map="out" aria-label="Zoom out">−</button><button type="button" data-map="fit">Fit</button></div><span class="atlas-scale"><span></span><b></b></span><span class="atlas-empty">Waiting for inhabitants</span></div><aside class="atlas-agent" hidden aria-label="Character details"></aside></div><footer class="atlas-footer"><label>Follow <select aria-label="Follow a character"><option value="">Explore freely</option></select></label><span class="atlas-detail">Scroll to zoom · Drag to explore</span></footer><div class="atlas-terrain-note"><span>Surface map · Block detail</span><span>640 × 640 blocks</span></div></section>`;

const camera={x:null,z:null,zoom:1.45,selected:'',following:false};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
let current=null;
export function syncWorldMap({apiBase=''}={}) {
  const root=document.querySelector('[data-island-map]');
  if(current?.root===root)return;
  // Account refreshes rebuild the page; keep the existing live map and selection.
  if(root&&current&&!current.root.isConnected){root.replaceWith(current.root);return;}
  current?.destroy();current=null;
  if(root)current=mount(root,deployment.publicWorldOrigin||apiBase);
}
function mount(root,apiBase){
  const view=root.querySelector('.atlas-viewport'),canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d'),
    pins=root.querySelector('.atlas-markers'),select=root.querySelector('select'),state=root.querySelector('.atlas-state'),
    panel=root.querySelector('.atlas-agent'),detail=root.querySelector('.atlas-detail'),empty=root.querySelector('.atlas-empty'),controller=new AbortController();
  let terrain,image,dead=false,frame,timer,w=1,h=1,scale=1,agents=[],lastOptions='',footerKey='',lastSuccess=0,emptySince=0,detailSuccess=0,detailImage,terrainEpoch='',terrainRevision=0,lastView='',tileBusy=0,detailBusy=false,detailAt=0,detailKey='',nextTilesAt=0;
  const elements=new Map(),pointers=new Map(),tiles=new Map(),tileQueue=new Map();let pinch=null;
  const on=(el,event,fn,options={})=>el.addEventListener(event,fn,{...options,signal:controller.signal});
  function fit(level=1){if(!terrain)return;camera.x=terrain.bounds.x+terrain.bounds.width/2;camera.z=terrain.bounds.z+terrain.bounds.height/2;camera.zoom=level;camera.following=false;select.value="";}
  function transform(){if(!terrain)return;scale=Math.min(w/terrain.bounds.width,h/terrain.bounds.height)*camera.zoom;camera.x=clamp(camera.x,terrain.bounds.x,terrain.bounds.x+terrain.bounds.width);camera.z=clamp(camera.z,terrain.bounds.z,terrain.bounds.z+terrain.bounds.height);}
  function zoom(factor,px=w/2,py=h/2){if(!terrain)return;const x=camera.x+(px-w/2)/scale,z=camera.z+(py-h/2)/scale;camera.zoom=clamp(camera.zoom*factor,1,32);transform();camera.x=x-(px-w/2)/scale;camera.z=z-(py-h/2)/scale;}
  function markState(live,label){state.dataset.live=String(live);if(state.lastElementChild.textContent!==label)state.lastElementChild.textContent=label;empty.hidden=live;}
  function clearLive(label='Connection lost'){agents=[];pins.replaceChildren();elements.clear();lastOptions='';select.replaceChildren(new Option('Explore freely',''));markState(false,label);camera.following=false;detail.textContent='Scroll to zoom · Drag to explore';if(camera.selected)showOfflinePanel();}
  function accept(data){
    if(dead)return;
    if(data.worldId!==terrain.worldId||!Number.isFinite(data.at)||!Array.isArray(data.inhabitants))throw Error('Wrong map snapshot');
    if(data.terrain)acceptTiles(data.terrain);
    // Debounce a temporarily empty frame, but never keep an offline world live.
    if(agents.length&&!data.inhabitants.length){emptySince||=Date.now();if(Date.now()-emptySince<2000)return;}
    else emptySince=0;
    const received=performance.now(),previous=new Map(agents.map(a=>[a.id,a]));
    agents=data.inhabitants.slice(0,20).filter(a=>/^(?:C0[1-4]|A\d{2,8})$/.test(a.id)&&Number.isFinite(a.x)&&Number.isFinite(a.z)).map(a=>{
      const old=previous.get(a.id);return {...a,name:String(a.name).slice(0,40),from:old&&Math.hypot(old.x-a.x,old.z-a.z)<16?position(old,received):{x:a.x,z:a.z},received};
    });
    lastSuccess=Date.now();
    for(const [id,el]of elements)if(!agents.some(a=>a.id===id)){el.remove();elements.delete(id);}
    for(const a of agents){let el=elements.get(a.id);if(!el){el=document.createElement('button');el.type='button';el.className='atlas-pin';el.append(document.createElement('span'));on(el,'click',()=>choose(a.id));pins.append(el);elements.set(a.id,el);}el.firstChild.textContent=a.name;el.setAttribute('aria-label',a.name);el.dataset.mapCommunity=String(a.community);}
    const options=JSON.stringify(agents.map(a=>[a.id,a.name]));
    if(options!==lastOptions){select.replaceChildren(new Option('Explore freely',''),...agents.map(a=>new Option(a.name,a.id)));lastOptions=options;}
    if(!agents.some(a=>a.id===camera.selected))camera.following=false;
    select.value=camera.following?camera.selected:'';
    markState(agents.length>0,agents.length?`${agents.length} in the world`:'World offline');
    updateDetail();if(camera.selected&&Date.now()-detailAt>=1000)void loadAgent();
  }
  function choose(id,follow=false){camera.selected=id;camera.following=follow;select.value=follow?id:'';if(follow)camera.zoom=Math.max(camera.zoom,3);detailKey='';panel.innerHTML=panelHeader(agents.find(a=>a.id===id)?.name||'Character',agents.find(a=>a.id===id)?.community)+'<p class="atlas-agent-empty">Loading…</p>';updateDetail();void loadAgent();}
  function updateDetail(){panel.hidden=!camera.selected;const a=agents.find(a=>a.id===camera.selected),key=JSON.stringify([camera.selected,a?.name,camera.following]);if(key===footerKey)return;footerKey=key;detail.replaceChildren();if(!a){detail.textContent='Scroll to zoom · Drag to explore';return;}const label=document.createElement('span');label.textContent=a.name;detail.append(label);if(!camera.following){const button=document.createElement('button');button.type='button';button.textContent='Follow';on(button,'click',()=>choose(a.id,true));detail.append(button);}}
  function position(a,now){const t=clamp((now-a.received)/100,0,1);return {x:a.from.x+(a.x-a.from.x)*t,z:a.from.z+(a.z-a.from.z)*t};}
  function acceptTiles(data){
    if(typeof data.epoch!=='string'||!Number.isSafeInteger(data.revision)||!Array.isArray(data.tiles))return;
    if(data.epoch!==terrainEpoch){for(const t of tiles.values())t.image.close?.();tiles.clear();tileQueue.clear();terrainEpoch=data.epoch;}
    terrainRevision=data.revision;
    for(const t of data.tiles){if(!Number.isInteger(t.x)||!Number.isInteger(t.z)||t.x<0||t.z<0||t.x>=16||t.z>=16||!Number.isSafeInteger(t.revision))continue;const key=t.x+'-'+t.z;if(tiles.get(key)?.revision!==t.revision)tileQueue.set(key,{...t,epoch:data.epoch});}
    void pumpTiles();
  }
  async function pumpTiles(){
    if(dead||Date.now()<nextTilesAt)return;
    while(tileBusy<4&&tileQueue.size){const [key,t]=tileQueue.entries().next().value;tileQueue.delete(key);tileBusy++;
      (async()=>{try{const response=await fetch(`${apiBase}/api/rpg/world-map/tile/${t.x}/${t.z}.png?v=${t.revision}`,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(5000)])});if(!response.ok)throw Error('Tile unavailable');const bitmap=await createImageBitmap(await response.blob());if(dead||terrainEpoch!==t.epoch){bitmap.close();return;}if((tiles.get(key)?.revision??0)>t.revision){bitmap.close();return;}tiles.get(key)?.image.close?.();tiles.set(key,{...t,image:bitmap});}catch{if(!dead&&terrainEpoch===t.epoch){if(!tileQueue.has(key))tileQueue.set(key,t);nextTilesAt=Date.now()+1000;}}finally{tileBusy--;if(!dead&&Date.now()>=nextTilesAt)void pumpTiles();}})();
    }
  }
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pretty=value=>String(value??'').replaceAll('_',' ');
  function slot(item,selected=false){const valid=item&&/^[a-z0-9_]{1,80}$/.test(item.item)&&Number.isInteger(item.count)&&item.count>0;
    return `<span class="atlas-item${selected?' selected':''}"${valid?` title="${safe(pretty(item.item))} ×${item.count}"`:''}>${valid?`<img src="${safe(apiBase)}/item-icons/${item.item}.svg" alt="${safe(pretty(item.item))}" loading="lazy"><b>${item.count>1?item.count:''}</b>`:''}</span>`;}
  function panelHeader(name,community){return `<div class="atlas-agent-top"><div><span class="eyebrow">${community?'COMMUNITY':'INHABITANT'}</span><h3>${safe(name)}</h3></div><button type="button" data-map-agent="close" aria-label="Close character details">×</button></div>`;}
  function showOfflinePanel(){panel.hidden=false;panel.innerHTML=panelHeader(agents.find(a=>a.id===camera.selected)?.name||'Character',false)+'<p class="atlas-agent-empty">Character offline.</p>';detailKey='';}
  async function loadAgent(){
    if(dead||detailBusy||!camera.selected||playerServices==='unavailable')return;
    const id=camera.selected;detailBusy=true;detailAt=Date.now();panel.hidden=false;
    if(!detailKey)panel.innerHTML=panelHeader(agents.find(a=>a.id===id)?.name||'Character',agents.find(a=>a.id===id)?.community)+'<p class="atlas-agent-empty">Loading…</p>';
    try{const response=await fetch(apiBase+'/api/rpg/world-map/agent/'+encodeURIComponent(id),{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(3000)])});if(!response.ok)throw Error('Character offline');const data=await response.json();if(dead||camera.selected!==id)return;
      detailSuccess=Date.now();const key=JSON.stringify([data.id,data.name,data.stats,data.inventoryView,data.inventory,data.activity,camera.following]);if(key===detailKey)return;detailKey=key;
      const stats=data.stats??{},value=n=>typeof n==='number'&&Number.isFinite(n)?Math.round(n*10)/10:'—',v=data.inventoryView;
      const bar=(label,n,cls)=>`<div class="atlas-vital ${cls}"><span>${label}</span><strong>${value(n)} <small>/ 20</small></strong><i><b style="width:${typeof n==='number'?clamp(n/20*100,0,100):0}%"></b></i></div>`;
      const focus=panel.contains(document.activeElement)?document.activeElement.dataset.mapAgent:null;
      panel.innerHTML=panelHeader(data.name,data.community)+`<button type="button" class="atlas-follow" data-map-agent="follow">${camera.following?'Following · Stop':'Follow on map'}</button><div class="atlas-agent-vitals">${bar('Health',stats.health,'health')}${bar('Hunger',stats.hunger,'hunger')}</div><dl class="atlas-agent-stats">${[['Armor',stats.armor],['Level',stats.xpLevel],['Deaths',stats.deaths],['Wellbeing',stats.wellbeing]].map(([label,n])=>`<div><dt>${label}</dt><dd>${value(n)}</dd></div>`).join('')}</dl>${data.activity?`<div class="atlas-activity">${safe(pretty(data.activity))}</div>`:''}<h4>Inventory</h4>${v?`<div class="atlas-equipped" aria-label="Armor and offhand">${v.armor.map(a=>slot(a)).join('')}${slot(v.offhand)}</div><div class="atlas-bag" aria-label="Backpack">${v.backpack.map(a=>slot(a)).join('')}</div><div class="atlas-hotbar" aria-label="Hotbar">${v.hotbar.map((a,i)=>slot(a,i===v.selectedSlot)).join('')}</div>`:Array.isArray(data.inventory)&&data.inventory.length?`<div class="atlas-bag summary">${data.inventory.map(a=>slot(a)).join('')}</div>`:'<p class="atlas-agent-empty">No items.</p>'}`;
      if(focus)panel.querySelector(`[data-map-agent="${focus}"]`)?.focus();
    }catch{if(!dead&&camera.selected===id&&(!detailKey||Date.now()-detailSuccess>=10000))showOfflinePanel();}finally{detailBusy=false;}
  }
  on(panel,'click',e=>{const action=e.target.closest('[data-map-agent]')?.dataset.mapAgent;if(action==='close'){camera.selected='';camera.following=false;panel.hidden=true;select.value='';detailKey='';updateDetail();}else if(action==='follow'){camera.following=!camera.following;if(camera.following)camera.zoom=Math.max(camera.zoom,3);select.value=camera.following?camera.selected:'';detailKey='';updateDetail();void loadAgent();}});
  function draw(now){
    if(dead)return;
    if(terrain&&image){
      if(lastSuccess&&Date.now()-lastSuccess>=10000){clearLive();lastSuccess=0;}
      const target=agents.find(a=>a.id===camera.selected);
      if(camera.following&&target){const p=position(target,now);camera.x=p.x;camera.z=p.z;}
      transform();const b=terrain.bounds,ox=w/2+(b.x-camera.x)*scale,oy=h/2+(b.z-camera.z)*scale;
      const dpr=Math.min(devicePixelRatio||1,2);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#122c30';ctx.fillRect(0,0,w,h);ctx.imageSmoothingEnabled=false;ctx.drawImage(scale>=1&&detailImage?detailImage:image,ox,oy,b.width*scale,b.height*scale);
      for(const t of tiles.values()){const x=ox+t.x*64*scale,y=oy+t.z*64*scale;if(x+64*scale<0||y+64*scale<0||x>w||y>h)continue;ctx.drawImage(t.image,x,y,64*scale,64*scale);}
      if(scale>=6){ctx.strokeStyle='#0a141126';const left=Math.max(b.x,Math.floor(camera.x-w/2/scale)),right=Math.min(b.x+b.width,Math.ceil(camera.x+w/2/scale)),top=Math.max(b.z,Math.floor(camera.z-h/2/scale)),bottom=Math.min(b.z+b.height,Math.ceil(camera.z+h/2/scale));ctx.beginPath();for(let x=left;x<=right;x++){const px=w/2+(x-camera.x)*scale;ctx.moveTo(px,0);ctx.lineTo(px,h);}for(let z=top;z<=bottom;z++){const py=h/2+(z-camera.z)*scale;ctx.moveTo(0,py);ctx.lineTo(w,py);}ctx.stroke();}
      ctx.strokeStyle='#91b49e16';ctx.lineWidth=1;
      for(let n=0;n<=b.width;n+=64){ctx.beginPath();ctx.moveTo(ox+n*scale,oy);ctx.lineTo(ox+n*scale,oy+b.height*scale);ctx.stroke();}
      for(let n=0;n<=b.height;n+=64){ctx.beginPath();ctx.moveTo(ox,oy+n*scale);ctx.lineTo(ox+b.width*scale,oy+n*scale);ctx.stroke();}
      const occupied=agents.map(a=>{const p=position(a,now);return {x:w/2+(p.x-camera.x)*scale-10,y:h/2+(p.z-camera.z)*scale-10,w:20,h:20};});
      for(const a of [...agents].sort((a,b)=>Number(b.id===camera.selected)-Number(a.id===camera.selected))){
        const p=position(a,now),x=w/2+(p.x-camera.x)*scale,y=h/2+(p.z-camera.z)*scale,el=elements.get(a.id),label=el.firstChild;
        el.style.left=x+'px';el.style.top=y+'px';el.hidden=x<0||x>w||y<0||y>h;el.setAttribute('aria-pressed',String(a.id===camera.selected));
        if(el.hidden)continue;
        const lw=label.offsetWidth||65,lh=label.offsetHeight||25;let spot=null;
        for(const dy of [-12,-40,16,-68,44,-96,72]){
          for(const dx of [18,-lw-12,-lw/2]){
            const r={x:x+dx,y:y+dy,w:lw,h:lh};
            if(r.x<8||r.x+lw>w-8||r.y<8||r.y+lh>h-8||occupied.some(o=>r.x<o.x+o.w+4&&r.x+r.w+4>o.x&&r.y<o.y+o.h+3&&r.y+r.h+3>o.y))continue;
            spot={...r,dx,dy};break;
          }if(spot)break;
        }
        label.style.visibility=spot?'visible':'hidden';el.title=a.name;
        if(spot){occupied.push(spot);label.style.left=(spot.dx+7)+'px';label.style.top=(spot.dy+7)+'px';if(Math.abs(spot.dy)>16||spot.dx<0){ctx.strokeStyle='#c4cc9860';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(spot.x+clamp(x-spot.x,0,lw),spot.y+lh/2);ctx.stroke();}}
      }
      const blocks=[1,2,5,10,20,50,100,200].filter(n=>n*scale<=110).at(-1)||1;
      root.querySelector('.atlas-scale span').textContent=blocks+' blocks';root.querySelector('.atlas-scale b').style.width=blocks*scale+'px';
      root.querySelector('[data-map=in]').disabled=camera.zoom>=32;root.querySelector('[data-map=out]').disabled=camera.zoom<=1;
    }
    frame=requestAnimationFrame(draw);
  }
  async function poll(){
    if(dead||playerServices==='unavailable')return;
    if(!document.hidden)try{const b=terrain.bounds,view=[Math.floor((camera.x-w/2/scale)/64)*64-64,Math.floor((camera.z-h/2/scale)/64)*64-64,Math.ceil((camera.x+w/2/scale)/64)*64+64,Math.ceil((camera.z+h/2/scale)/64)*64+64].map((v,i)=>clamp(v,i%2?b.z:b.x,i%2?b.z+b.height:b.x+b.width)).join(',');if(view!==lastView){terrainRevision=0;lastView=view;}const query=new URLSearchParams({after:String(terrainRevision),epoch:terrainEpoch,view});const res=await fetch(apiBase+'/api/rpg/world-map?'+query,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(5000)])});if(!res.ok)throw Error('Map unavailable');accept(await res.json());}catch{if(!dead&&(!lastSuccess||Date.now()-lastSuccess>=10000))clearLive('Connection lost');}
    if(!dead){void pumpTiles();timer=setTimeout(poll,250);}
  }
  on(select,'change',()=>{if(select.value)choose(select.value,true);else{camera.following=false;updateDetail();}});
  on(root.querySelector('.atlas-tools'),'click',e=>{const key=e.target.dataset.map;if(key==='fit')fit();else if(key)zoom(key==='in'?1.4:1/1.4);updateDetail();});
  on(view,'wheel',e=>{e.preventDefault();const r=view.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
  on(view,'keydown',e=>{if(e.target!==view)return;const moves={ArrowLeft:[-65,0],ArrowRight:[65,0],ArrowUp:[0,-65],ArrowDown:[0,65]};if(moves[e.key]){e.preventDefault();camera.following=false;camera.x+=moves[e.key][0]/scale;camera.z+=moves[e.key][1]/scale;updateDetail();}else if(['+','=','-','Home'].includes(e.key)){e.preventDefault();if(e.key==='Home')fit();else zoom(e.key==='-'?1/1.4:1.4);}});
  on(view,'pointerdown',e=>{if(e.target.closest('button'))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});view.setPointerCapture(e.pointerId);camera.following=false;select.value='';updateDetail();});
  on(view,'pointermove',e=>{const old=pointers.get(e.pointerId);if(!old)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y),r=view.getBoundingClientRect();if(pinch)zoom(distance/pinch,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);pinch=distance;}else{camera.x-=(e.clientX-old.x)/scale;camera.z-=(e.clientY-old.y)/scale;}});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])on(view,event,e=>{pointers.delete(e.pointerId);pinch=null;});
  const resize=new ResizeObserver(()=>{w=view.clientWidth;h=view.clientHeight;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);});resize.observe(view);
  (async()=>{try{const response=await fetch('island-map.json',{signal:controller.signal});if(!response.ok)throw Error('No terrain');terrain=await response.json();image=new Image();image.src=terrain.image;await image.decode();if(terrain.detailImage){detailImage=new Image();detailImage.src=terrain.detailImage;await detailImage.decode();}if(dead)return;if(camera.x===null)fit(1.45);w=view.clientWidth;h=view.clientHeight;transform();if(playerServices==='unavailable')markState(false,'World offline');else await poll();frame=requestAnimationFrame(draw);}catch{if(!dead)markState(false,'Map unavailable');}})();
  return {root,destroy(){dead=true;controller.abort();clearTimeout(timer);cancelAnimationFrame(frame);resize.disconnect();for(const t of tiles.values())t.image.close?.();}};
}
