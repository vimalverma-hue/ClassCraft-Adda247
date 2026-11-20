import {hasLanguageFonts,languageFontFields,validateLanguageFonts} from './languageFonts';
import {forgetLayerOrder} from './layerOrder';
import {uid,type Project,type Slide,type SlideTextBox,type Element} from './model';
import {fixedSlot} from './classSlides';
import {measure,wrap} from './parser';
import {readableColour} from './colourContrast';
export const textBoxFonts=['Noto Sans Devanagari','Noto Sans','Kokila','Mangal','Aptos','Rajdhani'];
const bounded=(n:number,min:number,max:number,fallback:number)=>Math.max(min,Math.min(max,Number.isFinite(n)?n:fallback));
export function normalizeTextBox(box:SlideTextBox):SlideTextBox{
 const w=bounded(box.w,80,1920,800),h=bounded(box.h,60,1080,160),font=textBoxFonts.includes(box.font)?box.font:'Noto Sans Devanagari';
 return{...box,w,h,x:bounded(box.x,0,1920-w,120),y:bounded(box.y,0,1080-h,220),font,size:bounded(box.size,8,120,28),bold:(!hasLanguageFonts(box)&&['Kokila','Mangal','Aptos'].includes(font))||!!box.bold,color:/^#[0-9a-f]{6}$/i.test(box.color)?box.color:'',align:['left','center','right'].includes(box.align)?box.align:'left',lineHeight:bounded(box.lineHeight,1.1,2,1.35)};
}
export function fitTextBox(value:SlideTextBox):SlideTextBox{
 const box=normalizeTextBox({...value,w:80,h:60}),x=bounded(value.x,0,1888,120);
 // Stored frame dimensions must not leave empty space or shift the typing anchor.
 const longest=(box.text||'Type here…').split('\n').reduce((width,line)=>Math.max(width,measure(line,box.size,box.font,box.bold,box)),0);
 const w=Math.min(1920-x,Math.max(32,Math.ceil(longest)+18));
 const needed=Math.ceil(wrap(box.text||' ',w-16,box.size,box.font,box.bold,box).length*box.size*2*box.lineHeight+16);
 const h=Math.min(1080,needed);return{...box,x,w,h,y:bounded(value.y,0,1080-h,220)};
}
export function newTextBox(p:Project,s:Slide):SlideTextBox{
 const style={...p.style,...s.style},offset=((s.textBoxes?.length||0)%8)*32;
 return fitTextBox({id:uid(),text:'',x:120+offset,y:220+offset,w:800,h:60,font:style.font,...languageFontFields(style),size:style.size,bold:style.bold,color:'',align:'left',lineHeight:1.35});
}
export function addTextBox(p:Project,selected:string,all:boolean,box:SlideTextBox):Project{
 return{...p,slides:p.slides.map(s=>(all?!fixedSlot(s):s.id===selected)?{...s,textBoxes:[...(s.textBoxes||[]),structuredClone(box)],manual:true}:s)};
}
export function changeTextBox(p:Project,selected:string,all:boolean,id:string,patch:Partial<SlideTextBox>|null):Project{
 const source=p.slides.find(s=>s.id===selected)?.textBoxes?.find(b=>b.id===id);
 if(!source)return p;
 const value=patch===null?null:fitTextBox({...source,...patch,id:source.id});
 return{...p,slides:p.slides.map(s=>{
  if(!(all?!fixedSlot(s):s.id===selected)||!s.textBoxes?.some(b=>b.id===id))return s;
  return{...s,...(!value?forgetLayerOrder(s,'text-box-'+id):{}),manual:true,textBoxes:value?s.textBoxes.map(b=>b.id===id?structuredClone(value):b):s.textBoxes.filter(b=>b.id!==id),lockedElements:value?s.lockedElements:s.lockedElements.filter(key=>key!=='text-box-'+id)};
 })};
}
export function textBoxElement(p:Project,s:Slide,value:SlideTextBox):Element{
 const box=fitTextBox(value),theme={...p.theme,...s.theme},background=theme.mode==='original'?(s.templateIndex===1?'#ffffff':theme.variant==='dark'?'#191b1c':'#ffffff'):theme.background;
 const color=box.color?readableColour(box.color,background):theme.variant==='dark'?'#ffffff':'#000000',lines=wrap(box.text,box.w-16,box.size,box.font,box.bold,box);
 return{id:'text-box-'+box.id,kind:'text',textBox:box,text:box.text,lines,x:box.x+8,y:box.y+8,w:box.w-16,h:box.h-16,size:box.size,font:box.font,...languageFontFields(box),bold:box.bold,color,align:box.align,lineHeight:box.lineHeight,editable:true};
}

export function validateTextBoxes(boxes:unknown){
 if(boxes===undefined)return;
 if(!Array.isArray(boxes)||boxes.length>200)throw Error('Invalid text boxes.');
 const ids=new Set<string>();
 for(const box of boxes){
  if(!box||typeof box.id!=='string'||!box.id||ids.has(box.id)||typeof box.text!=='string'||typeof box.font!=='string'||typeof box.bold!=='boolean'||typeof box.color!=='string'||!['left','center','right'].includes(box.align)||!['x','y','w','h','size','lineHeight'].every(key=>typeof box[key]==='number'&&Number.isFinite(box[key]))||box.w<=0||box.h<=0)throw Error('Invalid text box.');
  validateLanguageFonts(box);ids.add(box.id);
 }
}
