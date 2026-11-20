import {wrap} from './parser';
import {hasLanguageFonts} from './languageFonts';
import {imageView} from './slideImages';
import {keywordBackgrounds} from './keywordBackgrounds';
import {addTimerShapes,addTimerAnimations} from './timerExport';
﻿import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {rasterizeSlide} from './slideRaster';
import PptxGenJS from 'pptxgenjs';
import {jsPDF} from 'jspdf';
import {SlideCanvas} from './SlideCanvas';
import type {Element,Project,ResolvedSlide,TemplateSet} from './model';
import {resolveSlide} from './layout';
import {download} from './storage';
import {ensureProjectFonts} from './fonts';
import {answerOverlay,revealAnswer} from './answers';
import {addAnswerAnimations} from './animations';
import {nativeText} from './nativeText';
export type ExportOptions={format:'editable'|'visual'|'pdf';range:string;answers:boolean;notes:boolean;clickAnswers?:boolean;pdfHighlights?:boolean};
export function parseRange(range:string,count:number):number[]{if(!range.trim()||range.trim().toLowerCase()==='all')return Array.from({length:count},(_,i)=>i);const result:number[]=[];for(const part of range.split(',')){const m=/^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(part);if(!m)throw new Error('Use slide ranges such as 1-5, 7 or all.');const a=Number(m[1]),b=Number(m[2]||m[1]);if(a<1||b>count||a>b)throw new Error(`Slide range must be within 1-${count}.`);for(let i=a;i<=b;i++)if(!result.includes(i-1))result.push(i-1);}return result;}
export async function renderPNG(slide:ResolvedSlide):Promise<string>{await document.fonts.ready;const host=document.createElement('div');host.style.cssText='position:fixed;left:-20000px;top:0;width:1920px;height:1080px;pointer-events:none;';document.body.appendChild(host);const root=createRoot(host);try{flushSync(()=>root.render(<SlideCanvas slide={slide}/>));await document.fonts.ready;await Promise.all([...host.querySelectorAll('img')].map(async im=>{if(!im.complete)await im.decode();if(!im.naturalWidth)throw new Error('An image failed to load. Export stopped.');}));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return await rasterizeSlide(host.firstElementChild as HTMLElement);}finally{root.unmount();host.remove();}}
async function imageData(src:string){if(src.startsWith('data:image/'))return src;const r=await fetch(src);if(!r.ok)throw new Error('Template image failed to load: '+src);const b=await r.blob();return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(b);});}
async function rasterElement(e:Element):Promise<string>{return renderPNG({id:e.id,name:e.id,notes:'',background:'transparent',warnings:[],elements:[e]});}
export async function exportDeck(p:Project,templates:TemplateSet,options:ExportOptions,onProgress:(s:string)=>void):Promise<Blob>{
 await ensureProjectFonts(p);const indexes=parseRange(options.range,p.slides.length);const chosen=indexes.filter(i=>options.answers||p.slides[i].layout!=='answer');if(!chosen.length)throw new Error('No slides match this export selection.');const resolved=chosen.map(i=>resolveSlide(p,p.slides[i],templates,i));if(resolved.some(s=>s.warnings.some(w=>/overflows|exceeds|too tall|Missing/.test(w))))throw new Error('Some slides overflow or have missing images. Use Reflow / split and resolve warnings before exporting.');
 const ppt=new PptxGenJS();ppt.defineLayout({name:'CLASS_16_9',width:13.333333,height:7.5});ppt.layout='CLASS_16_9';ppt.author='ClassCraft Adda247';ppt.subject='Teaching slides';ppt.title=p.name;
 const pdf=options.format==='pdf'?new jsPDF({orientation:'landscape',unit:'pt',format:[960,540],compress:true}):null;
 const animated:{index:number;picture:boolean}[]=[],timers:{index:number;seconds:number}[]=[];
 for(let i=0;i<resolved.length;i++){const original=p.slides[chosen[i]];const s=options.format==='pdf'&&options.pdfHighlights?revealAnswer(original,resolved[i]):resolved[i];onProgress(`Rendering slide ${i+1} of ${resolved.length}`);const ps=options.format!=='pdf'?ppt.addSlide():null;if(ps)ps.background={color:s.background.replace('#','')};
  if(options.format==='pdf'||options.format==='visual'){const data=await renderPNG(options.format==='visual'?{...s,elements:s.elements.filter(e=>e.kind!=='timer')}:s);if(pdf){if(i)pdf.addPage([960,540],'landscape');pdf.addImage(data,'PNG',0,0,960,540,undefined,'FAST');}else ps!.addImage({data,x:0,y:0,w:13.333333,h:7.5});}
  else for(const e of s.elements){const rect={x:e.x/144,y:e.y/144,w:e.w/144,h:e.h/144};if(e.kind==='text'){for(const [hi,box] of keywordBackgrounds(e,p.fonts?.kokilaBold).entries())ps!.addShape(ppt.ShapeType.rect,{x:box.x/144,y:box.y/144,w:box.w/144,h:box.h/144,line:{transparency:100},fill:{color:box.color.replace('#',''),transparency:Math.round((1-(e.opacity??1))*100)},objectName:'ClassSlide Keyword Highlight '+e.id+' '+hi});ps!.addText(nativeText(e,true),{...rect,fontFace:e.font||p.style.font,fontSize:e.size||p.style.size,color:(e.color||'#171925').slice(1),bold:e.bold,align:e.align,margin:0,breakLine:false,paraSpaceAfter:0,lineSpacing:(e.size||p.style.size)*(e.lineHeight||1.35),wrap:false,valign:'top',objectName:e.textBox?'ClassSlide Text Box '+e.textBox.id:'ClassSlide Text '+e.id,transparency:Math.round((1-(e.opacity??1))*100)});}
   else if(e.kind==='rect')ps!.addShape(ppt.ShapeType.rect,{...rect,line:{transparency:100},fill:{color:(e.fill||'#ffffff').slice(1),transparency:Math.round((1-(e.opacity??1))*100)}});
   else if(e.kind==='image'){if(!e.src)throw new Error('Missing slide image.');const data=await imageData(e.src);if(e.imageSize){const view=imageView({x:e.x,y:e.y,w:e.w,h:e.h,fit:e.fit==='cover'?'cover':'contain',crop:e.imageCrop},...e.imageSize),w=view.w/144/view.crop.w,h=view.h/144/view.crop.h;ps!.addImage({data,x:view.x/144,y:view.y/144,w,h,sizing:{type:'crop',w:view.w/144,h:view.h/144,x:view.crop.x*w,y:view.crop.y*h},objectName:'ClassSlide Content Image'+(e.id==='content-image'?'':' '+e.id),transparency:Math.round((1-(e.opacity??1))*100)});}else if(e.objectPosition&&e.objectPosition!=='50% 50%'){ps!.addImage({data:await rasterElement(e),x:0,y:0,w:13.333333,h:7.5});}else{ps!.addImage({data,...rect,sizing:e.fit==='fill'?undefined:{type:e.fit==='cover'?'cover':'contain',w:rect.w,h:rect.h},transparency:Math.round((1-(e.opacity??1))*100)});}}
   else if(e.kind==='equation')ps!.addImage({data:await rasterElement(e),x:0,y:0,w:13.333333,h:7.5});
   else if(e.kind==='table'){
    const cols=Math.max(...e.rows!.map(r=>r.length)),size=e.size||26;
    const rows=e.rows!.map((r,ri)=>Array.from({length:cols},(_,ci)=>{
     const bold=!!e.bold||(ri===0&&hasLanguageFonts(e)),text=r[ci]||'';
     const cell={...e,text,lines:wrap(text,e.w/cols-32,size,e.font||p.style.font,bold,e),bold,highlight:undefined};
     return{text:nativeText(cell),options:{fill:{color:ri===0?(e.fill||'#e21b2e').slice(1):'FFFFFF',transparency:ri===0?0:100},color:ri===0?'ffffff':(e.color||'#171925').slice(1),bold}};
    }));
    const tableOptions={...rect,fontFace:e.font,fontSize:size,color:(e.color||'#171925').slice(1),border:{type:'solid' as const,pt:1,color:'a5a5a5'},margin:[5,8,5,8] as [number,number,number,number],colW:Array(cols).fill(e.w/144/cols),rowH:e.rowHeights!.map(h=>h/144),lineSpacing:size*(e.lineHeight||1.35),paraSpaceAfter:0,valign:'top' as const,autoPage:false,verbose:false};
    ps!.addTable(rows,tableOptions);
   }
  }
  if(ps&&options.clickAnswers){const e=answerOverlay(original,s);if(e){if(options.format==='visual')ps.addImage({data:await rasterElement(e),x:0,y:0,w:13.333333,h:7.5,objectName:'ClassSlide Answer Reveal'});else {if(e.answerBox)ps.addShape(ppt.ShapeType.roundRect,{x:e.answerBox.x/144,y:e.answerBox.y/144,w:e.answerBox.w/144,h:e.answerBox.h/144,rectRadius:12/144,line:{transparency:100},fill:{color:e.fill!.slice(1)},objectName:"ClassSlide Answer Background"});ps.addText(nativeText(e),{x:e.x/144,y:e.y/144,w:e.w/144,h:e.h/144,fontFace:e.font,fontSize:e.size,bold:e.bold,color:(e.color||'#12291c').slice(1),fill:e.answerBox?undefined:{color:e.fill!.slice(1)},shape:ppt.ShapeType.roundRect,rectRadius:12/144,line:{transparency:100},margin:e.padding?[e.padding[3]/2,e.padding[1]/2,e.padding[2]/2,e.padding[0]/2]:0,align:e.align,valign:'middle',wrap:false,lineSpacing:(e.size||24)*(e.lineHeight||1.35),paraSpaceAfter:0,objectName:'ClassSlide Answer Reveal'});}animated.push({index:i,picture:options.format==='visual'});}}
  if(ps){const timer=s.elements.find(e=>e.kind==='timer')?.timer;if(timer){addTimerShapes(ppt,ps,timer);timers.push({index:i,seconds:timer.seconds});}}
  if(ps&&options.notes&&s.notes)ps.addNotes(s.notes);
 }
 onProgress('Packaging download');if(pdf)return pdf.output('blob');if(animated.length||timers.length){let bytes=await ppt.write({outputType:'arraybuffer',compression:true}) as ArrayBuffer;if(animated.length)bytes=await(await addAnswerAnimations(bytes,animated)).arrayBuffer();if(timers.length)return addTimerAnimations(bytes,timers);return new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'});}return await ppt.write({outputType:'blob',compression:true}) as Blob;
}
export async function downloadDeck(p:Project,t:TemplateSet,o:ExportOptions,progress:(s:string)=>void){const blob=await exportDeck(p,t,o,progress);download(blob,`${p.name.replace(/[<>:"/\\|?*]/g,'-')}-${o.format}.${o.format==='pdf'?'pdf':'pptx'}`);}



