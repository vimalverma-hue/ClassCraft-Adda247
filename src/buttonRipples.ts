/** One delegated listener also covers buttons added by dialogs and accordions. */
export function installButtonRipples(doc:Document=document){
 const win=doc.defaultView;
 if(!win)return()=>{};
 const active=new Map<HTMLElement,()=>void>();
 function onClick(event:MouseEvent){
  const target=event.target instanceof Element?event.target:null;
  const host=target?.closest<HTMLElement>('button,summary,label.upload-button');
  // A label forwards a second click to its file input; animate only the label click.
  if(!host||target?.matches('input')||host.matches(':disabled,[aria-disabled="true"]')||host.closest('[inert]')||host.querySelector('input:disabled'))return;
  if(win!.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  active.get(host)?.();
  const rect=host.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  const computed=win!.getComputedStyle(host);
  const width=host.clientWidth||rect.width,height=host.clientHeight||rect.height;
  const scaleX=(host.offsetWidth||rect.width)/rect.width,scaleY=(host.offsetHeight||rect.height)/rect.height;
  const x=event.detail===0?width/2:Math.max(0,Math.min(width,(event.clientX-rect.left)*scaleX-host.clientLeft));
  const y=event.detail===0?height/2:Math.max(0,Math.min(height,(event.clientY-rect.top)*scaleY-host.clientTop));
  const diameter=2*Math.hypot(Math.max(x,width-x),Math.max(y,height-y));
  const ripple=doc.createElement('span');
  ripple.className='button-ripple';ripple.setAttribute('aria-hidden','true');
  Object.assign(ripple.style,{width:diameter+'px',height:diameter+'px',left:(x-diameter/2)+'px',top:(y-diameter/2)+'px'});
  const oldPosition=host.style.position,oldOverflow=host.style.overflow;
  const changePosition=!computed.position||computed.position==='static';
  if(changePosition)host.style.position='relative';
  host.style.overflow='hidden';
  let timeout:number;
  const cleanup=()=>{
   win!.clearTimeout(timeout);ripple.removeEventListener('animationend',cleanup);ripple.remove();
   if(changePosition&&host.style.position==='relative')host.style.position=oldPosition;
   if(host.style.overflow==='hidden')host.style.overflow=oldOverflow;
   active.delete(host);
  };
  ripple.addEventListener('animationend',cleanup);
  active.set(host,cleanup);host.appendChild(ripple);
  // Also clean up when a button disappears or an animation is disabled mid-click.
  timeout=win!.setTimeout(cleanup,550);
 }
 doc.addEventListener('click',onClick,true);
 return()=>{doc.removeEventListener('click',onClick,true);for(const cleanup of active.values())cleanup();};
}
