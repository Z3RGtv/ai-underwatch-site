export function relativeTime(value,now=Date.now()){
 const at=typeof value==='number'?value:Date.parse(value);if(!Number.isFinite(at))return '—';
 const seconds=Math.floor(Math.abs(now-at)/1000);if(seconds<10)return 'just now';
 const [n,unit]=seconds<60?[seconds,'second']:seconds<3600?[Math.floor(seconds/60),'minute']:seconds<86400?[Math.floor(seconds/3600),'hour']:seconds<2592000?[Math.floor(seconds/86400),'day']:seconds<31536000?[Math.floor(seconds/2592000),'month']:[Math.floor(seconds/31536000),'year'];
 const text=n+' '+unit+(n===1?'':'s');return at>now?'in '+text:text+' ago';
}
export function updateRelativeTimes(root=document,now=Date.now()){
 for(const el of root.querySelectorAll('[data-relative-at],time[datetime]')){const value=el.dataset.relativeAt||el.getAttribute('datetime');if(value){const text=relativeTime(value,now);if(el.textContent!==text)el.textContent=text;}}
}
if(typeof document!=='undefined')setInterval(()=>{if(!document.hidden)updateRelativeTimes();},5000);
