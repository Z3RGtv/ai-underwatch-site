const asset=name=>new URL(name,import.meta.url).href;
export function minecraftMeter(value,type='health',max=20){
 const known=typeof value==='number'&&Number.isFinite(value),bounded=known?Math.max(0,Math.min(max,value)):0,kind=type==='hunger'||type==='food'?'food':'heart',label=kind==='heart'?'Health':'Hunger';
 return `<span class="mc-meter mc-${kind}" role="img" aria-label="${label}: ${known?bounded:'unknown'} / ${max}">${Array.from({length:10},(_,i)=>{const amount=bounded/max*20-i*2,state=amount>=2?'full':amount>0?'half':'empty';return `<span class="mc-icon" style="background-image:url('${asset('hud-'+kind+'-empty.png')}')">${state==='empty'?'':`<span style="background-image:url('${asset('hud-'+kind+'-'+state+'.png')}')"></span>`}</span>`;}).join('')}</span>`;
}
export function happinessScale(value){const known=typeof value==='number'&&Number.isFinite(value),extent=Math.max(100,known?Math.ceil(Math.abs(value)/100)*100:100),width=known?Math.abs(value)/extent*50:0;return {known,value:known?value:null,extent,width,left:known&&value<0?50-width:50,label:known?(value>0?'+':'')+value.toFixed(1):'—'};}
export function happinessMeter(value){
 const s=happinessScale(value),negative=s.known&&value<0,units=s.known?Math.abs(value)/s.extent*10:0;
 const cells=Array.from({length:20},(_,i)=>{const distance=negative?9-i:i-10,onSide=negative?i<10:i>=10,fill=onSide?Math.max(0,Math.min(1,units-distance))*100:0;return `<span class="happiness-cell"><i class="${negative?'negative':'positive'}" style="width:${fill}%;${negative?'right:0':'left:0'}"></i></span>`;}).join('');
 return `<div class="happiness-meter" role="meter" aria-label="Happiness" aria-valuemin="${-s.extent}" aria-valuemax="${s.extent}" ${s.known?`aria-valuenow="${s.value}"`:''}><div class="happiness-axis"><span aria-hidden="true">👎</span><div class="happiness-track">${cells}<b></b></div><span aria-hidden="true">👍</span><strong class="happiness-value">${s.label}</strong></div></div>`;
}

if(typeof document!=='undefined'&&!document.querySelector('[data-hud-metrics-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href=asset('hud-metrics.css');link.dataset.hudMetricsStyle='';document.head.append(link);}
