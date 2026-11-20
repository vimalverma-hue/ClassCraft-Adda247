import {useRef,useState,type PointerEvent} from 'react';
import {AnalogTimer} from './AnalogTimer';
import {timerConfig,type SlideTimer} from './timers';

export function CanvasTimer({timer,scale,onMove}:{timer:SlideTimer;scale:number;onMove:(timer:SlideTimer)=>void}){
 const [draft,setDraft]=useState<SlideTimer|null>(null);
 const drag=useRef<{pointer:number;x:number;y:number;original:SlideTimer}|null>(null);
 const value=draft??timer;
 const position=(event:PointerEvent<HTMLDivElement>)=>{
  const start=drag.current!;
  return timerConfig({...start.original,x:start.original.x+(event.clientX-start.x)/scale,y:start.original.y+(event.clientY-start.y)/scale})!;
 };
 return <div className="timer-drag" role="button" aria-label="Move timer" tabIndex={0}
  style={{position:'absolute',zIndex:2,left:value.x,top:value.y,width:value.size,height:value.size,cursor:draft?'grabbing':'grab',touchAction:'none',userSelect:'none'}}
  onClick={event=>event.stopPropagation()}
  onPointerDown={event=>{
   if(event.button!==0||drag.current)return;
   event.preventDefault();event.stopPropagation();event.currentTarget.focus();
   drag.current={pointer:event.pointerId,x:event.clientX,y:event.clientY,original:timer};
   event.currentTarget.setPointerCapture(event.pointerId);setDraft(timer);
  }}
  onPointerMove={event=>{if(drag.current?.pointer!==event.pointerId)return;event.preventDefault();const next=position(event);setDraft(next);}}
  onPointerUp={event=>{
   if(drag.current?.pointer!==event.pointerId)return;
   const original=drag.current.original,next=position(event);drag.current=null;setDraft(null);
   event.currentTarget.releasePointerCapture(event.pointerId);
   if(next.x!==original.x||next.y!==original.y)onMove(next);
  }}
  onPointerCancel={()=>{drag.current=null;setDraft(null);}}
  onLostPointerCapture={()=>{drag.current=null;setDraft(null);}}
  onKeyDown={event=>{
   if(event.key==='Escape'&&drag.current){event.stopPropagation();drag.current=null;setDraft(null);return;}
   const arrows:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
   const direction=arrows[event.key];if(!direction||drag.current)return;
   event.preventDefault();event.stopPropagation();const step=event.shiftKey?1:10;
   onMove(timerConfig({...timer,x:timer.x+direction[0]*step,y:timer.y+direction[1]*step})!);
  }}>
  <AnalogTimer timer={{...value,x:0,y:0}}/>
 </div>;
}
