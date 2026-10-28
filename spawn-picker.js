const ns='http://www.w3.org/2000/svg';
const svgNode=(tag,attrs={})=>{const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
export function mountSpawnPicker(root,{choices,selected='',locked=false,onChange=()=>{}}){
  let data=choices,selection=selected,zoom=1,terrain=null,dead=false;
  root.className='spawn-picker';
  root.innerHTML='<header><div><span class="eyebrow">THE FIRST STEP</span><h3>Choose your starting place.</h3></div><span class="spawn-count"></span></header><div class="spawn-map"><svg role="group" aria-label="Initial spawn map"></svg><div class="spawn-map-tools"><button type="button" data-zoom="in" aria-label="Zoom spawn map in">+</button><button type="button" data-zoom="out" aria-label="Zoom spawn map out">−</button><button type="button" data-zoom="fit">Fit</button></div><span class="spawn-north" aria-hidden="true">N ↑</span></div><footer><div class="spawn-legend"><span>Available</span><span>Community</span><span>Occupied</span></div><strong role="status" class="spawn-selection"></strong></footer>';
  const svg=root.querySelector('svg'),count=root.querySelector('.spawn-count'),status=root.querySelector('.spawn-selection');
  const image=svgNode('image'),markers=svgNode('g');svg.append(image,markers);
  function draw(){
    if(!data?.slots?.length){status.textContent='Spawn map unavailable. Try again shortly.';onChange('');return;}
    const grouped=data.selectionMode==='group',options=grouped?data.groups.map(g=>({...g,slotId:g.id,name:g.name})):data.slots;
    root.querySelector('h3').textContent=grouped?'Choose your group.':'Choose your starting place.';
    const xs=data.slots.map(s=>s.x),zs=data.slots.map(s=>s.z),cx=(Math.min(...xs)+Math.max(...xs))/2,cz=(Math.min(...zs)+Math.max(...zs))/2;
    const w=Math.max(320,Math.max(...xs)-Math.min(...xs)+120,(Math.max(...zs)-Math.min(...zs)+120)/.72)/zoom,h=w*.72;
    svg.setAttribute('viewBox',`${cx-w/2} ${cz-h/2} ${w} ${h}`);
    if(terrain){const b=terrain.bounds;image.setAttribute('href',terrain.detailImage||terrain.image);for(const [k,v]of Object.entries({x:b.x,y:b.z,width:b.width,height:b.height}))image.setAttribute(k,String(v));}
    if(!locked&&selection&&!options.some(s=>s.slotId===selection&&s.status==='available')){selection='';onChange('');}
    markers.replaceChildren();
    for(const s of options){const available=!locked&&s.status==='available',chosen=selection===s.slotId;
      const node=svgNode('g',{transform:`translate(${s.x} ${s.z})`,class:`spawn-marker ${s.status}${chosen?' selected':''}`,role:'button',tabindex:available?0:-1,'aria-disabled':String(!available),'aria-pressed':String(chosen),'aria-label':`${s.slotId} · ${s.status}${s.name?' · '+s.name:''}`});
      node.append(svgNode('circle',{r:grouped?(chosen?14:12):(chosen?8:6)}),svgNode('circle',{r:2,class:'spawn-center'}));
      const text=svgNode('text',{y:grouped?-20:-12,'text-anchor':'middle'});text.textContent=grouped?`${s.name} · ${s.players}/${s.playerCapacity??4}`:s.slotId.slice(2);node.append(text);
      const title=svgNode('title');title.textContent=s.name||s.slotId;node.append(title);
      const choose=()=>{if(!available)return;selection=s.slotId;draw();onChange(selection);};
      node.addEventListener('click',choose);node.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();choose();}});markers.append(node);
    }
    const places=data.playerPlacesAvailable??16,free=data.slots.filter(s=>s.status==='available'||s.status==='community-pool').length;
    count.textContent=grouped?`${places} player places · 4 community AIs`:places>0?`${free} free spots · ${places} player places`:`${free} spots · Community pool`;
    root.querySelector('.spawn-legend').innerHTML=places>0?'<span class="available">Available</span><span class="occupied">Occupied</span>':'<span class="occupied">Occupied</span><span class="community-pool">Community pool</span>';
    status.textContent=grouped?(selection?`${options.find(g=>g.slotId===selection)?.name??selection} · ${locked?'Saved':'Selected'}`:'Choose a group · Your spot is assigned automatically'):selection?`${selection} · ${locked?'Initial spawn saved':'Selected'}`:'Select a free marker';
    if(!locked)onChange(selection);
  }
  root.addEventListener('click',e=>{const z=e.target.closest('[data-zoom]')?.dataset.zoom;if(!z)return;zoom=z==='fit'?1:Math.max(.75,Math.min(2.5,zoom*(z==='in'?1.25:.8)));draw();});
  fetch('island-map.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(t=>{if(dead)return;terrain=t;draw();}).catch(()=>{if(!dead)status.textContent='Map image unavailable. Choose an available marker.';});
  draw();return {getSelected:()=>selection,update(next){if(dead)return;data=next;draw();},destroy(){dead=true;}};
}
