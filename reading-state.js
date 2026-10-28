// Preserve disclosure state by message identity, including when new messages
// are inserted above the one being read.
export function captureReadingState(root){
 const entries=[...root.querySelectorAll('details[data-whisper-response]')];
 const focused=root.ownerDocument.activeElement;
 const anchor=entries.find(e=>e.open&&e.getBoundingClientRect().bottom>0&&e.getBoundingClientRect().top<innerHeight);
 return {open:entries.filter(e=>e.open).map(e=>e.dataset.whisperResponse),focus:entries.find(e=>e.contains(focused))?.dataset.whisperResponse,anchor:anchor?{id:anchor.dataset.whisperResponse,top:anchor.getBoundingClientRect().top}:null};
}
export function restoreReadingState(root,state){
 const entries=[...root.querySelectorAll('details[data-whisper-response]')],open=new Set(state.open);
 for(const e of entries)e.open=open.has(e.dataset.whisperResponse);
 const focused=entries.find(e=>e.dataset.whisperResponse===state.focus);focused?.querySelector('summary')?.focus({preventScroll:true});
 const anchor=entries.find(e=>e.dataset.whisperResponse===state.anchor?.id);
 if(anchor){const delta=anchor.getBoundingClientRect().top-state.anchor.top;if(Math.abs(delta)>1)window.scrollBy(0,delta);}
}
