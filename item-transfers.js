import {relativeTime} from './relative-time.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function itemTransfersMarkup(rows=[],iconBase=''){
 return rows.length?'<div class="item-transfers">'+rows.map(r=>`<article class="item-transfer"><img src="${esc(iconBase)}/item-icons/${esc(r.item)}.svg" alt="" loading="lazy"><div><span class="eyebrow">${r.direction==='given'?'GIVEN':'RECEIVED'}</span><h3>${esc(r.count)} × ${esc(r.item.replaceAll('_',' '))}</h3><p>${esc(r.from.name)} <span aria-hidden="true">→</span> ${esc(r.to.name)}</p></div><time datetime="${esc(r.at)}" title="${esc(new Date(r.at).toLocaleString())}">${esc(relativeTime(r.at))}</time></article>`).join('')+'</div>':'<p class="observation-empty">No confirmed transfers yet.</p>';
}
