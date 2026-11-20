import {languageFontRuns,hasLanguageFonts,editingFontStack} from './languageFonts';
import {useLayoutEffect,useRef,useState,type PointerEvent,type CSSProperties} from 'react';
import {Move,Check,Trash2} from 'lucide-react';
import type {Element,SlideTextBox} from './model';
import {moveImageBox,type ResizeCorner} from './slideImages';
import {fitTextBox} from './textBoxes';
export type TextBoxChange=(id:string,value:Partial<SlideTextBox>|null,historyEntry?:boolean)=>void;
export function CanvasTextBox({element,scale=1,editable=false,selected=false,onSelect,onChange}:{element:Element;scale?:number;editable?:boolean;selected?:boolean;onSelect?:()=>void;onChange?:TextBoxChange}){
 const box=element.textBox!,frame=useRef<HTMLDivElement>(null),input=useRef<HTMLTextAreaElement>(null);
 const [editing,setEditing]=useState(editable&&selected&&!box.text),[draft,setDraft]=useState<SlideTextBox|null>(null);
 const historyStarted=useRef(false),drag=useRef<{pointer:number;x:number;y:number;box:SlideTextBox;mode:'move'|ResizeCorner}|null>(null),skipClick=useRef(false);
 const value=draft??box,canEdit=editable&&!!onChange;
 useLayoutEffect(()=>{if(editing&&canEdit)input.current?.focus();},[editing,canEdit]);
 useLayoutEffect(()=>{if(!selected||!canEdit){setEditing(false);historyStarted.current=false;}},[selected,canEdit]);
 const startEditing=()=>{if(!canEdit)return;onSelect?.();historyStarted.current=false;setEditing(true);};
 const stopEditing=()=>{setEditing(false);historyStarted.current=false;};
 const begin=(event:PointerEvent<HTMLElement>,mode:'move'|ResizeCorner)=>{
  if(!canEdit||event.button!==0||drag.current)return;event.preventDefault();event.stopPropagation();input.current?.blur();stopEditing();onSelect?.();frame.current?.focus();skipClick.current=false;
  drag.current={pointer:event.pointerId,x:event.clientX,y:event.clientY,box,mode};frame.current?.setPointerCapture(event.pointerId);setDraft(box);
 };
 const next=(event:PointerEvent<HTMLDivElement>)=>{const start=drag.current!,geometry=moveImageBox(start.box,start.mode,(event.clientX-start.x)/scale,(event.clientY-start.y)/scale),size=start.mode==='move'?start.box.size:start.box.size*geometry.w/start.box.w;return fitTextBox({...start.box,...geometry,size});};
 const textStyle:CSSProperties={fontFamily:editingFontStack(value.font,value),fontSize:value.size*2,fontWeight:value.bold?700:400,color:element.color,lineHeight:value.lineHeight,textAlign:value.align,whiteSpace:'pre-wrap',overflowWrap:'normal',wordBreak:'normal'};
 return <div ref={frame} data-text-box={box.id} tabIndex={canEdit?0:undefined} role={canEdit?'group':undefined} aria-label={canEdit?'Text box':undefined}
  style={{position:'absolute',left:value.x,top:value.y,width:value.w,height:value.h,outline:canEdit&&selected?'3px solid var(--action-accent)':undefined,touchAction:editing?'auto':'none'}}
  onClick={event=>{if(!canEdit)return;event.stopPropagation();if(skipClick.current){skipClick.current=false;return;}startEditing();}}
  onPointerDown={event=>{if(!editing)begin(event,'move');}}
  onPointerMove={event=>{if(drag.current?.pointer===event.pointerId)setDraft(next(event));}}
  onPointerUp={event=>{if(drag.current?.pointer!==event.pointerId)return;const updated=next(event),start=drag.current;drag.current=null;setDraft(null);frame.current?.releasePointerCapture(event.pointerId);const changed=['x','y','w','h','size'].some(key=>updated[key as keyof SlideTextBox]!==start.box[key as keyof SlideTextBox]);if(changed){skipClick.current=true;requestAnimationFrame(()=>{skipClick.current=false;});onChange?.(box.id,updated);}}}
  onPointerCancel={()=>{drag.current=null;setDraft(null);}} onLostPointerCapture={()=>{drag.current=null;setDraft(null);}}
  onKeyDown={event=>{if(!canEdit||editing)return;if(event.key==='Delete'&&selected&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.nativeEvent.isComposing){event.preventDefault();event.stopPropagation();if(!event.repeat)onChange?.(box.id,null);return;}if(event.key==='Enter'){event.preventDefault();event.stopPropagation();startEditing();return;}if(event.key==='Escape'){drag.current=null;setDraft(null);onSelect?.();return;}const direction:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(direction[event.key]){event.preventDefault();event.stopPropagation();const [x,y]=direction[event.key],step=event.shiftKey?1:10;onChange?.(box.id,moveImageBox(box,'move',x*step,y*step));}}}>
  {editing&&canEdit?<textarea ref={input} aria-label="Edit added text" value={box.text} spellCheck={false}
   style={{...textStyle,position:'absolute',left:8,top:8,width:value.w-16,height:value.h-16,padding:0,margin:0,border:0,borderRadius:0,outline:0,background:'transparent',resize:'none',overflow:'auto',touchAction:'auto'}}
   onPointerDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()}
   onChange={event=>{onChange?.(box.id,{text:event.target.value},!historyStarted.current);historyStarted.current=true;}}
   onBlur={stopEditing} onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'&&!event.nativeEvent.isComposing){event.preventDefault();stopEditing();frame.current?.focus();}}}
  />:<div data-element={element.id} style={{...textStyle,position:'absolute',left:8,top:8,width:value.w-16,height:value.h-16,cursor:canEdit?'text':undefined}}>{hasLanguageFonts(value)?languageFontRuns(element.lines?.join('\n')||element.text||'',value.font,value.bold,value).map((run,i)=><span key={i} style={{fontFamily:'"'+run.font+'","Noto Sans",sans-serif',fontWeight:run.bold?700:400}}>{run.text}</span>):element.lines?.join('\n')||element.text||''}{canEdit&&!box.text&&<span style={{opacity:.5}}>Type here…</span>}</div>}
  {canEdit&&selected&&<>
   <div className="text-box-toolbar" style={{top:value.y>=38/scale?-34/scale:0,left:Math.min(0,1920-value.x-102/scale),transform:'scale('+1/scale+')',transformOrigin:'left top'}} onClick={event=>event.stopPropagation()}>
    <button type="button" aria-label="Move text box" title="Move text" onPointerDown={event=>begin(event,'move')}><Move size={16}/></button>
    <button type="button" aria-label="Finish editing text" title="Done" onPointerDown={event=>event.preventDefault()} onClick={()=>{stopEditing();frame.current?.focus();}}><Check size={16}/></button>
    <button type="button" aria-label="Delete text box" title="Delete text" onPointerDown={event=>event.preventDefault()} onClick={()=>onChange?.(box.id,null)}><Trash2 size={16}/></button>
   </div>
   {(['nw','ne','sw','se'] as const).map(corner=><div key={corner} role="button" aria-label={'Resize text box '+corner} style={{position:'absolute',width:22,height:22,background:'#fff',border:'3px solid var(--action-accent)',borderRadius:3,left:corner.includes('w')?-11:undefined,right:corner.includes('e')?-11:undefined,top:corner.includes('n')?-11:undefined,bottom:corner.includes('s')?-11:undefined,cursor:corner==='nw'||corner==='se'?'nwse-resize':'nesw-resize'}} onPointerDown={event=>begin(event,corner)} onClick={event=>event.stopPropagation()}/>)}
  </>}
 </div>;
}
