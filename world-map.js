import {playerServices} from './deployment.js';

export const mapSection = () => `<section class="island-atlas" aria-label="Island map" data-island-map><header class="atlas-heading"><div><span class="eyebrow">THE LIVING WORLD</span><h2>The first island.</h2></div><span class="atlas-state" role="status"><i></i><span>Connecting</span></span></header><div class="atlas-viewport" tabindex="0" role="region" aria-label="Interactive island map. Use arrow keys to pan, plus or minus to zoom, and Home to fit."><canvas aria-hidden="true"></canvas><div class="atlas-markers"></div><span class="atlas-north" aria-hidden="true">N</span><div class="atlas-tools" aria-label="Map controls"><button type="button" data-map="in" aria-label="Zoom in">+</button><button type="button" data-map="out" aria-label="Zoom out">−</button><button type="button" data-map="fit">Fit</button></div><span class="atlas-scale"><span></span><b></b></span><span class="atlas-empty">Waiting for inhabitants</span></div><footer class="atlas-footer"><label>Follow <select aria-label="Follow a character"><option value="">Explore freely</option></select></label><span class="atlas-detail">Scroll to zoom · Drag to explore</span></footer><div class="atlas-terrain-note"><span>Surveyed terrain · Live inhabitants</span><span>640 × 640 blocks</span></div></section>`;

const camera={x:null,z:null,zoom:1.45,selected:'',following:false};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
let current=null;
export function syncWorldMap({apiBase=''}={}) {
  const root=document.querySelector('[data-island-map]');
  if(current?.root===root)return;
  current?.destroy();current=null;
  if(root)current=mount(root,apiBase);
}
function mount(root,apiBase){
  const view=root.querySelector('.atlas-viewport'),canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d'),
    pins=root.querySelector('.atlas-markers'),select=root.querySelector('select'),state=root.querySelector('.atlas-state'),
    detail=root.querySelector('.atlas-detail'),empty=root.querySelector('.atlas-empty'),controller=new AbortController();
  let terrain,image,dead=false,frame,timer,w=1,h=1,scale=1,agents=[],lastOptions='',lastSuccess=0;
  const elements=new Map(),pointers=new Map();let pinch=null;
  const on=(el,event,fn,options={})=>el.addEventListener(event,fn,{...options,signal:controller.signal});
  function fit(level=1){if(!terrain)return;camera.x=terrain.bounds.x+terrain.bounds.width/2;camera.z=terrain.bounds.z+terrain.bounds.height/2;camera.zoom=level;camera.following=false;select.value="";}
  function transform(){if(!terrain)return;scale=Math.min(w/terrain.bounds.width,h/terrain.bounds.height)*camera.zoom;camera.x=clamp(camera.x,terrain.bounds.x,terrain.bounds.x+terrain.bounds.width);camera.z=clamp(camera.z,terrain.bounds.z,terrain.bounds.z+terrain.bounds.height);}
  function zoom(factor,px=w/2,py=h/2){if(!terrain)return;const x=camera.x+(px-w/2)/scale,z=camera.z+(py-h/2)/scale;camera.zoom=clamp(camera.zoom*factor,1,12);transform();camera.x=x-(px-w/2)/scale;camera.z=z-(py-h/2)/scale;}
  function markState(live,label){state.dataset.live=String(live);state.lastElementChild.textContent=label;empty.hidden=live;}
  function clearLive(label='Connection lost'){agents=[];pins.replaceChildren();elements.clear();lastOptions='';select.replaceChildren(new Option('Explore freely',''));markState(false,label);camera.following=false;detail.textContent='Scroll to zoom · Drag to explore';}
  function accept(data){
    if(data.worldId!==terrain.worldId||!Number.isFinite(data.at)||!Array.isArray(data.inhabitants))throw Error('Wrong map snapshot');
    const received=performance.now(),previous=new Map(agents.map(a=>[a.id,a]));
    agents=data.inhabitants.slice(0,20).filter(a=>/^(?:C0[1-4]|A\d{2,8})$/.test(a.id)&&Number.isFinite(a.x)&&Number.isFinite(a.z)).map(a=>{
      const old=previous.get(a.id);return {...a,name:String(a.name).slice(0,40),from:old?position(old,received):{x:a.x,z:a.z},received};
    });
    lastSuccess=Date.now();
    for(const [id,el]of elements)if(!agents.some(a=>a.id===id)){el.remove();elements.delete(id);}
    for(const a of agents){let el=elements.get(a.id);if(!el){el=document.createElement('button');el.type='button';el.className='atlas-pin';el.append(document.createElement('span'));on(el,'click',()=>choose(a.id));pins.append(el);elements.set(a.id,el);}el.firstChild.textContent=a.name;el.setAttribute('aria-label',a.name);el.dataset.mapCommunity=String(a.community);}
    const options=JSON.stringify(agents.map(a=>[a.id,a.name]));
    if(options!==lastOptions){select.replaceChildren(new Option('Explore freely',''),...agents.map(a=>new Option(a.name,a.id)));lastOptions=options;}
    if(!agents.some(a=>a.id===camera.selected))camera.following=false;
    select.value=camera.following?camera.selected:'';
    markState(agents.length>0,agents.length?`${agents.length} in the world`:'World offline');
    updateDetail();
  }
  function choose(id){camera.selected=id;camera.following=true;select.value=id;camera.zoom=Math.max(camera.zoom,3);updateDetail();}
  function updateDetail(){const a=agents.find(a=>a.id===camera.selected);detail.replaceChildren();if(!a){detail.textContent='Scroll to zoom · Drag to explore';return;}const label=document.createElement('span');label.textContent=a.name;detail.append(label);if(!camera.following){const button=document.createElement('button');button.type='button';button.textContent='Follow';on(button,'click',()=>choose(a.id));detail.append(button);}}
  function position(a,now){const t=clamp((now-a.received)/1500,0,1);return {x:a.from.x+(a.x-a.from.x)*t,z:a.from.z+(a.z-a.from.z)*t};}
  function draw(now){
    if(dead)return;
    if(terrain&&image){
      if(lastSuccess&&Date.now()-lastSuccess>=10000){clearLive();lastSuccess=0;}
      const target=agents.find(a=>a.id===camera.selected);
      if(camera.following&&target){const p=position(target,now);camera.x=p.x;camera.z=p.z;}
      transform();const b=terrain.bounds,ox=w/2+(b.x-camera.x)*scale,oy=h/2+(b.z-camera.z)*scale;
      const dpr=Math.min(devicePixelRatio||1,2);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#122c30';ctx.fillRect(0,0,w,h);ctx.imageSmoothingEnabled=false;ctx.drawImage(image,ox,oy,b.width*scale,b.height*scale);
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
      root.querySelector('[data-map=in]').disabled=camera.zoom>=12;root.querySelector('[data-map=out]').disabled=camera.zoom<=1;
    }
    frame=requestAnimationFrame(draw);
  }
  async function poll(){
    if(dead||playerServices==='unavailable')return;
    if(!document.hidden)try{const res=await fetch(apiBase+'/api/rpg/world-map',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(5000)])});if(!res.ok)throw Error('Map unavailable');accept(await res.json());}catch{if(!dead)clearLive('Connection lost');}
    if(!dead)timer=setTimeout(poll,2000);
  }
  on(select,'change',()=>{if(select.value)choose(select.value);else{camera.following=false;updateDetail();}});
  on(root.querySelector('.atlas-tools'),'click',e=>{const key=e.target.dataset.map;if(key==='fit')fit();else if(key)zoom(key==='in'?1.4:1/1.4);updateDetail();});
  on(view,'wheel',e=>{e.preventDefault();const r=view.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
  on(view,'keydown',e=>{if(e.target!==view)return;const moves={ArrowLeft:[-65,0],ArrowRight:[65,0],ArrowUp:[0,-65],ArrowDown:[0,65]};if(moves[e.key]){e.preventDefault();camera.following=false;camera.x+=moves[e.key][0]/scale;camera.z+=moves[e.key][1]/scale;updateDetail();}else if(['+','=','-','Home'].includes(e.key)){e.preventDefault();if(e.key==='Home')fit();else zoom(e.key==='-'?1/1.4:1.4);}});
  on(view,'pointerdown',e=>{if(e.target.closest('button'))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});view.setPointerCapture(e.pointerId);camera.following=false;select.value='';updateDetail();});
  on(view,'pointermove',e=>{const old=pointers.get(e.pointerId);if(!old)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y),r=view.getBoundingClientRect();if(pinch)zoom(distance/pinch,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);pinch=distance;}else{camera.x-=(e.clientX-old.x)/scale;camera.z-=(e.clientY-old.y)/scale;}});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])on(view,event,e=>{pointers.delete(e.pointerId);pinch=null;});
  const resize=new ResizeObserver(()=>{w=view.clientWidth;h=view.clientHeight;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);});resize.observe(view);
  (async()=>{try{const response=await fetch('island-map.json',{signal:controller.signal});if(!response.ok)throw Error('No terrain');terrain=await response.json();image=new Image();image.src=terrain.image;await image.decode();if(dead)return;if(camera.x===null)fit(1.45);if(playerServices==='unavailable')markState(false,'World offline');else await poll();frame=requestAnimationFrame(draw);}catch{if(!dead)markState(false,'Map unavailable');}})();
  return {root,destroy(){dead=true;controller.abort();clearTimeout(timer);cancelAnimationFrame(frame);resize.disconnect();}};
}
