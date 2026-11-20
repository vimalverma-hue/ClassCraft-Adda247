import {hasQuestionColours} from './questionColours';
import {languageFontRuns,hasLanguageFonts} from './languageFonts';
import {layerId} from './layerOrder';
import {CanvasTextBox,type TextBoxChange} from './CanvasTextBox';
import {SlideImage} from './SlideImage';
import type {ImagePlacement} from './model';
import {KeywordMark} from './KeywordMark';
import {AnalogTimer} from './AnalogTimer';
import {CanvasTimer} from './CanvasTimer';
import type {SlideTimer} from './timers';
import {highlightedRuns,editingTextRuns} from './textHighlight';
﻿import React,{useEffect,useRef,useState} from 'react';
import katex from 'katex';
import type {Element,ResolvedSlide} from './model';
function RenderElement({e,onEdit,onSelect,selected,locked,editable,timersInteractive,timerStarted,timerPaused,scale,onTimerMove,onImageChange,onImageDelete,onTextBoxChange}:{e:Element;onEdit?:(id:string,text:string)=>void;onSelect?:(id:string)=>void;selected?:boolean;locked?:boolean;editable?:boolean;timersInteractive?:boolean;timerStarted?:boolean;timerPaused?:boolean;scale:number;onTimerMove?:(timer:SlideTimer)=>void;onImageChange?:(id:string,image:ImagePlacement)=>void;onImageDelete?:(id:string)=>void;onTextBoxChange?:TextBoxChange}){
 const ref=useRef<HTMLDivElement>(null);const [editing,setEditing]=useState(false);const common:React.CSSProperties={position:'absolute',left:e.x,top:e.y,width:e.w,height:e.h,opacity:e.opacity??1};
 if(e.kind==='timer'&&e.timer&&editable&&onTimerMove)return <CanvasTimer timer={e.timer} scale={scale} onMove={onTimerMove}/>;
 if(e.kind==='timer'&&e.timer)return <AnalogTimer timer={e.timer} interactive={timersInteractive} started={timerStarted} paused={timerPaused}/>;
 if(e.textBox)return <CanvasTextBox element={e} scale={scale} editable={editable&&!locked} selected={selected} onSelect={()=>onSelect?.(e.id)} onChange={onTextBoxChange}/>;
 if(e.kind==='rect')return <div style={{...common,background:e.fill}}/>;
 if(e.kind==='image'&&e.imageSize)return <SlideImage element={e} scale={scale} editable={editable&&!locked} selected={selected} onSelect={()=>onSelect?.(e.id)} onChange={onImageChange&&!e.imageFixed?image=>onImageChange(e.id,image):undefined} onDelete={onImageDelete?()=>onImageDelete(e.id):undefined}/>;
 if(e.kind==='image')return e.src?<img draggable={false} alt="" src={e.src} style={{...common,objectFit:e.fit==='fill'?'fill':e.fit||'contain',objectPosition:e.objectPosition||'center'}}/>:null;
 if(e.kind==='table'){const cols=Math.max(...(e.rows||[]).map(r=>r.length));return <table style={{...common,borderCollapse:'collapse',tableLayout:'fixed',fontFamily:`"${e.font}","Noto Sans",sans-serif`,fontSize:(e.size||26)*2,fontWeight:e.bold?700:400,color:e.color,lineHeight:e.lineHeight}}><tbody>{e.rows?.map((row,i)=><tr key={i} style={{height:e.rowHeights?.[i],background:i===0?e.fill:'transparent',color:i===0?'white':e.color}}>{Array.from({length:cols},(_,j)=><td key={j} style={{border:'2px solid #a5a5a5',padding:'10px 16px',verticalAlign:'top',overflowWrap:'anywhere',whiteSpace:'pre-wrap'}}>{hasLanguageFonts(e)?languageFontRuns(row[j]||'',e.font||'Noto Sans Devanagari',i===0||!!e.bold,e).map((run,k)=><span key={k} style={{fontFamily:'"'+run.font+'","Noto Sans",sans-serif',fontWeight:run.bold?700:400}}>{run.text}</span>):row[j]||''}</td>)}</tr>)}</tbody></table>;}
 if(e.kind==='equation'){let html='';try{html=katex.renderToString(e.text||'',{throwOnError:true,trust:false,strict:'warn'});}catch{html='';}return <div style={{...common,fontSize:(e.size||26)*2,color:e.color}}>{html?<span dangerouslySetInnerHTML={{__html:html}}/>:<span>{e.text}</span>}</div>;}
 const canEdit=editable&&e.editable&&!locked;return <>{e.answerBox&&<div data-answer-background="true" style={{position:"absolute",left:e.answerBox.x,top:e.answerBox.y,width:e.answerBox.w,height:e.answerBox.h,background:e.fill,borderRadius:12,pointerEvents:"none"}}/>}<div ref={ref} data-element={e.id} data-highlight-selectable={editable&&!locked&&e.id!=='answer-reveal'?true:undefined} className={editable?`slide-text ${selected?'element-selected':''} ${locked?'element-locked':''}`:''} contentEditable={editing} suppressContentEditableWarning spellCheck={false} tabIndex={canEdit?0:undefined} onClick={ev=>{if(editable){ev.stopPropagation();onSelect?.(layerId(e));if(canEdit&&(window.getSelection()?.isCollapsed??true)){setEditing(true);requestAnimationFrame(()=>ref.current?.focus());}}}} onDoubleClick={()=>{if(canEdit){setEditing(true);requestAnimationFrame(()=>ref.current?.focus());}}} onBlur={()=>{if(editing){const text=ref.current?.innerText??ref.current?.textContent??'';if(text!==(e.editText??e.text??''))onEdit?.(e.editId||e.id,text);setEditing(false);}}} onKeyDown={ev=>{ev.stopPropagation();if(ev.key==='Escape')ref.current?.blur();}} style={{...common,padding:e.padding?.map(v=>v+'px').join(' '),boxSizing:e.padding?'border-box':undefined,background:e.answerBox?undefined:e.fill,borderRadius:e.fill?12:undefined,color:e.color,fontSize:(e.size||26)*2,fontFamily:`"${e.font}","Noto Sans",sans-serif`,fontWeight:e.bold?700:400,lineHeight:e.lineHeight||1.35,textAlign:e.align||'left',whiteSpace:e.id==='answer-reveal'?'pre':'pre-wrap',overflowWrap:'normal',outline:editing?'3px solid var(--action-accent)':undefined,cursor:canEdit?'text':'default'}}>{editing?(hasLanguageFonts(e)||hasQuestionColours(e)?editingTextRuns(e).map((run,i)=><span key={i} style={{fontFamily:run.font?'"'+run.font+'","Noto Sans",sans-serif':undefined,fontWeight:run.bold===undefined?undefined:run.bold?700:400,color:run.color}}>{run.text}</span>):e.editText??e.text):highlightedRuns(e).map((r,i)=><span key={i} style={{fontFamily:r.font?'"'+r.font+'","Noto Sans",sans-serif':undefined,fontWeight:r.bold===undefined?undefined:r.bold?700:400,color:r.color}}>{r.highlight?<KeywordMark text={r.text} color={r.highlight} ink={r.color} font={r.font||e.font||'Noto Sans Devanagari'} size={e.size||26} bold={r.bold??e.bold??false}/>:r.text}</span>)}</div></>;
}
export function SlideCanvas({slide,scale=1,onEdit,onSelect,onTextSelect,onTimerMove,onImageChange,onImageDelete,onTextBoxChange,selected,lockedElements=[],editable=false,guides,timersInteractive=false,timerStarted}:{slide:ResolvedSlide;scale?:number;onEdit?:(id:string,text:string)=>void;onSelect?:(id:string)=>void;onTextSelect?:(text:string)=>void;onTimerMove?:(timer:SlideTimer)=>void;onImageChange?:(id:string,image:ImagePlacement)=>void;onImageDelete?:(id:string)=>void;onTextBoxChange?:TextBoxChange;selected?:string;lockedElements?:string[];editable?:boolean;timersInteractive?:boolean;timerStarted?:boolean;guides?:{side:string;width:number;bottom:number}}){
 const canvasRef=useRef<HTMLDivElement>(null),selectionCallback=useRef(onTextSelect);selectionCallback.current=onTextSelect;
 const captureSelection=()=>{
  const selection=window.getSelection();if(!editable||!selection?.rangeCount||selection.isCollapsed)return;
  const range=selection.getRangeAt(0),element=(node:Node)=>(node.nodeType===Node.ELEMENT_NODE?node as HTMLElement:node.parentElement)?.closest('[data-highlight-selectable="true"]');
  const start=element(range.startContainer),end=element(range.endContainer);
  if(start&&start===end&&canvasRef.current?.contains(start))selectionCallback.current?.(selection.toString().trim());
 };
 const captureRef=useRef(captureSelection);captureRef.current=captureSelection;
 useEffect(()=>{
  selectionCallback.current?.('');
  if(!editable)return;
  const capture=()=>captureRef.current();document.addEventListener('selectionchange',capture);
  return()=>document.removeEventListener('selectionchange',capture);
 },[slide.id,editable]);
 return <div style={{width:1920*scale,height:1080*scale,position:'relative',flexShrink:0}}>
  <div ref={canvasRef} className="slide-canvas" onPointerDownCapture={()=>selectionCallback.current?.('')} onMouseUp={captureSelection} onKeyUp={captureSelection} style={{width:1920,height:1080,position:'absolute',left:0,top:0,background:slide.background,transform:'scale('+scale+')',transformOrigin:'top left'}}>
   {slide.elements.map(e=><RenderElement key={slide.id+':'+e.id} e={e} scale={scale} onTimerMove={onTimerMove} onImageChange={onImageChange} onImageDelete={onImageDelete} onTextBoxChange={onTextBoxChange} onEdit={onEdit} onSelect={onSelect} selected={selected===layerId(e)} locked={lockedElements.includes(e.editId||e.id)} editable={editable} timersInteractive={timersInteractive} timerStarted={timerStarted} timerPaused={slide.elements.some(e=>e.id==='answer-reveal')}/>)}
   {guides?.side!=='none'&&guides&&<div className="reserve-guide" style={{left:guides.side==='left'?30:1920-guides.width-30,top:160,width:guides.width,height:790}}>Teacher / webcam</div>}
   {!!guides?.bottom&&<div className="reserve-guide" style={{left:80,bottom:90,width:1760,height:guides.bottom}}>Working space</div>}
  </div>
 </div>;
}
export function AutoSlide({slide,...props}:Omit<React.ComponentProps<typeof SlideCanvas>,'scale'>&{slide:ResolvedSlide}){const ref=useRef<HTMLDivElement>(null);const[width,setWidth]=useState(240);useEffect(()=>{const ob=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width));if(ref.current)ob.observe(ref.current);return()=>ob.disconnect();},[]);return<div ref={ref} style={{width:'100%',aspectRatio:'16/9',overflow:'hidden'}}><SlideCanvas {...props} slide={slide} scale={width/1920}/></div>;}



