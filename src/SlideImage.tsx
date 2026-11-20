import {useRef,useState,type PointerEvent} from 'react';
import type {Element,ImagePlacement} from './model';
import {imageView,moveImageBox,type ResizeCorner} from './slideImages';

export function SlideImage({element,scale=1,editable=false,selected=false,onSelect,onChange,onDelete}:{element:Element;scale?:number;editable?:boolean;selected?:boolean;onSelect?:()=>void;onChange?:(image:ImagePlacement)=>void;onDelete?:()=>void}){
 const base:ImagePlacement={x:element.x,y:element.y,w:element.w,h:element.h,fit:element.fit==='cover'?'cover':'contain',crop:element.imageCrop};
 const frameRef=useRef<HTMLDivElement>(null),[draft,setDraft]=useState<ImagePlacement|null>(null),drag=useRef<{pointer:number;x:number;y:number;original:ImagePlacement;mode:'move'|ResizeCorner}|null>(null);
 const value=draft??base,view=imageView({...value,x:0,y:0},element.imageSize![0],element.imageSize![1]);
 const begin=(event:PointerEvent<HTMLDivElement>,mode:'move'|ResizeCorner)=>{
  if(!editable||!onChange||event.button!==0||drag.current)return;event.preventDefault();event.stopPropagation();onSelect?.();frameRef.current?.focus();
  drag.current={pointer:event.pointerId,x:event.clientX,y:event.clientY,original:base,mode};frameRef.current?.setPointerCapture(event.pointerId);setDraft(base);
 };
 const next=(event:PointerEvent<HTMLDivElement>)=>{const start=drag.current!;return{...start.original,...moveImageBox(start.original,start.mode,(event.clientX-start.x)/scale,(event.clientY-start.y)/scale)};};
 return <div ref={frameRef} data-slide-image={element.id} className={editable?'editable-slide-image':''} tabIndex={editable?0:undefined} role={editable?'group':undefined} aria-label={editable?'Slide image':undefined}
  style={{position:'absolute',left:value.x,top:value.y,width:value.w,height:value.h,opacity:element.opacity??1,touchAction:editable?'none':undefined,cursor:editable?(onChange?(draft?'grabbing':'grab'):'pointer'):'default',outline:editable&&selected?'3px solid var(--action-accent)':undefined}}
  onClick={event=>{if(editable){event.stopPropagation();onSelect?.();frameRef.current?.focus();}}}
  onPointerDown={event=>begin(event,'move')}
  onPointerMove={event=>{if(drag.current?.pointer===event.pointerId)setDraft(next(event));}}
  onPointerUp={event=>{if(drag.current?.pointer!==event.pointerId)return;const image=next(event),original=drag.current.original;drag.current=null;setDraft(null);event.currentTarget.releasePointerCapture(event.pointerId);if((['x','y','w','h'] as const).some(key=>image[key]!==original[key]))onChange?.(image);}}
  onPointerCancel={()=>{drag.current=null;setDraft(null);}} onLostPointerCapture={()=>{drag.current=null;setDraft(null);}}
  onKeyDown={event=>{if(!editable)return;if(event.key==='Delete'&&selected&&onDelete&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.nativeEvent.isComposing){event.preventDefault();event.stopPropagation();if(event.repeat)return;drag.current=null;setDraft(null);onDelete();return;}if(event.key==='Escape'&&drag.current){event.stopPropagation();drag.current=null;setDraft(null);return;}const arrows:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};const direction=arrows[event.key];if(direction){event.preventDefault();event.stopPropagation();onChange?.({...base,...moveImageBox(base,'move',direction[0]*(event.shiftKey?1:10),direction[1]*(event.shiftKey?1:10))});}}}>
  <div style={{position:'absolute',left:view.x,top:view.y,width:view.w,height:view.h,overflow:'hidden',pointerEvents:'none'}}>
   <img draggable={false} alt="" src={element.src} style={{position:'absolute',maxWidth:'none',width:view.w/view.crop.w,height:view.h/view.crop.h,left:-view.crop.x*view.w/view.crop.w,top:-view.crop.y*view.h/view.crop.h}}/>
  </div>
  {editable&&selected&&onChange&&(['nw','ne','sw','se'] as const).map(corner=><div key={corner} role="button" aria-label={'Resize image '+corner} className="image-resize-handle" style={{position:'absolute',width:22,height:22,background:'#fff',border:'3px solid var(--action-accent)',borderRadius:3,left:corner.includes('w')?-11:undefined,right:corner.includes('e')?-11:undefined,top:corner.includes('n')?-11:undefined,bottom:corner.includes('s')?-11:undefined,cursor:corner==='nw'||corner==='se'?'nwse-resize':'nesw-resize'}} onPointerDown={event=>begin(event,corner)}/>)}
 </div>;
}
