import {it,expect} from 'vitest';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import JSZip from 'jszip';
import {createCanvas} from '@napi-rs/canvas';
import {blankSlide,newProject,type Asset,type Element,type TemplateSet} from '../src/model';
import {ensureClassSlides,fixedSlot} from '../src/classSlides';
import {resolveSlide} from '../src/layout';
import {layerId,layerIds,orderedElements,moveLayerOrder,validateLayerOrder} from '../src/layerOrder';
import {addSlideImage,changeSlideImage} from '../src/imageLayers';
import {addTextBox,newTextBox,changeTextBox} from '../src/textBoxes';
import {exportProject,importProject} from '../src/storage';
import {exportDeck} from '../src/exporter';
import {SlideCanvas} from '../src/SlideCanvas';
const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
function asset(id:string,colour:string):Asset{const c=createCanvas(600,300),ctx=c.getContext('2d');ctx.fillStyle=colour;ctx.fillRect(0,0,600,300);return{id,name:id+'.png',width:600,height:300,data:c.toDataURL('image/png')};}
const red=asset('red','#ff0000'),blue=asset('blue','#0000ff');
const moved=(p:ReturnType<typeof newProject>,id:string,all:boolean,element:string,direction:'front'|'back')=>moveLayerOrder(p,id,all,element,direction,(s,i)=>resolveSlide(p,s,templates,i).elements);
it('moves images and text across each other, preserving geometry, templates, fixed slides and locked layers',async()=>{
 let p=ensureClassSlides({...newProject(),slides:[{...blankSlide(),layout:'mcq',text:'Q.1 Capital?\nA) Delhi\nB) Mumbai'},blankSlide(),{...blankSlide(),locked:true}]});const selected=p.slides[2].id;
 p=addSlideImage(p,selected,true,red).project;const box={...newTextBox(p,p.slides[2]),text:'भारत / India'};p=addTextBox(p,selected,true,box);
 const before=structuredClone(p),ids=(deck:typeof p,i:number)=>layerIds(resolveSlide(deck,deck.slides[i],templates,i).elements);
 p=moved(p,selected,true,'content-image','back');
 expect(ids(p,2)[0]).toBe('content-image');expect(ids(p,3)[0]).toBe('content-image');expect(p.slides[4]).toEqual(before.slides[4]);expect(p.slides.filter(s=>fixedSlot(s))).toEqual(before.slides.filter(s=>fixedSlot(s)));
 const oldElements=resolveSlide(before,before.slides[2],templates,2).elements;
 for(const e of resolveSlide(p,p.slides[2],templates,2).elements)expect(e).toEqual(oldElements.find(old=>old.id===e.id));
 p=moved(p,selected,false,'text-box-'+box.id,'back');expect(ids(p,2)[0]).toBe('text-box-'+box.id);expect(ids(p,3)[0]).toBe('content-image');
 p=moved(p,selected,false,'question','front');expect(ids(p,2).at(-1)).toBe('question');
 const restored=await importProject(new File([await(await exportProject(p)).arrayBuffer()],'order.zip'));expect(restored.slides).toEqual(p.slides);
 p.slides[2].lockedElements=['question'];expect(moved(p,selected,false,'question','back')).toBe(p);
 p=changeSlideImage(p,selected,false,'content-image');expect(p.slides[2].layerOrder).not.toContain('content-image');
 p=changeTextBox(p,selected,false,box.id,null);expect(p.slides[2].layerOrder).not.toContain('text-box-'+box.id);
 expect(()=>validateLayerOrder(['question','question'])).toThrow();expect(()=>validateLayerOrder([12])).toThrow();
});
it('keeps bilingual theory and its bullet together, appends new layers and preserves background/timer/reveal slots',()=>{
 const text=(id:string,editId?:string):Element=>({id,editId,kind:'text',x:0,y:0,w:100,h:40,text:id});
 const base:Element[]=[{id:'background',kind:'image',x:0,y:0,w:1920,h:1080},text('theory-bullet-0'),text('theory-item-0','theory-item-0'),text('theory-item-0-en','theory-item-0'),{id:'content-image',kind:'image',imageSize:[600,300],x:0,y:0,w:600,h:300},text('new-box'),text('answer-reveal'),{id:'analog-timer',kind:'timer',x:0,y:0,w:100,h:100}];
 const sorted=orderedElements(base,['content-image','obsolete','theory-item-0']);
 expect(sorted.map(e=>e.id)).toEqual(['background','content-image','theory-bullet-0','theory-item-0','theory-item-0-en','new-box','answer-reveal','analog-timer']);
 expect(layerIds(sorted)).toEqual(['content-image','theory-item-0','new-box']);expect(sorted[0]).toBe(base[0]);expect(sorted.at(-1)).toBe(base.at(-1));
});
it('exports the exact preview stacking order for overlapping selected images and text in native PowerPoint',async()=>{
 const prior=(globalThis as any).document;(globalThis as any).document={fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>createCanvas(1,1)};
 try{
  let p=newProject();p.theme={...p.theme,mode:'custom',headerHeight:0};const s=blankSlide();p.slides=[s];p=addSlideImage(p,s.id,false,red).project;const extra=addSlideImage(p,s.id,false,blue);p=extra.project;
  p=changeSlideImage(p,s.id,false,'content-image',{x:200,y:300,w:600,h:300,fit:'contain'});p=changeSlideImage(p,s.id,false,extra.elementId,{x:400,y:400,w:300,h:150,fit:'contain'});
  const box={...newTextBox(p,s),text:'FRONT',font:'Noto Sans',bold:true,size:40,color:'#ffffff',x:220,y:320};p=addTextBox(p,s.id,false,box);const boxId='text-box-'+box.id;
  const cases=[{id:'content-image',direction:'front' as const,top:'#ff0000',text:false},{id:'content-image',direction:'back' as const,top:'#0000ff',text:true},{id:boxId,direction:'back' as const,top:'#0000ff',text:false},{id:boxId,direction:'front' as const,top:'#0000ff',text:true}];
  const deck={...p,slides:cases.map((c,i)=>({...moved(p,s.id,false,c.id,c.direction).slides[0],id:'case-'+i}))};
  const bytes=await(await exportDeck(deck,templates,{format:'editable',range:'all',answers:false,notes:false},()=>{})).arrayBuffer(),zip=await JSZip.loadAsync(bytes),report=[];
  for(const [i,slide] of deck.slides.entries()){
   const resolved=resolveSlide(deck,slide,templates,i),expected=layerIds(resolved.elements);
   const dom=new JSDOM(renderToStaticMarkup(React.createElement(SlideCanvas,{slide:resolved,editable:true,selected:cases[i].id}))).window.document;
   const preview=[...dom.querySelector('.slide-canvas')!.children].map(n=>n.getAttribute('data-slide-image')||(n.hasAttribute('data-text-box')?'text-box-'+n.getAttribute('data-text-box'):n.getAttribute('data-element'))).filter(Boolean);expect(preview).toEqual(expected);
   for(const image of dom.querySelectorAll('[data-slide-image]'))expect((image as HTMLElement).style.zIndex).toBe('');
   const xml=new JSDOM(await zip.file('ppt/slides/slide'+(i+1)+'.xml')!.async('string'),{contentType:'text/xml'}).window.document,shapeTree=xml.getElementsByTagNameNS('*','spTree')[0];
   const actual=[...shapeTree.children].filter(n=>['pic','sp'].includes(n.localName)).map(n=>{const name=n.getElementsByTagNameNS('*','cNvPr')[0].getAttribute('name')!;return name==='ClassSlide Content Image'?'content-image':name.startsWith('ClassSlide Content Image ')?name.slice('ClassSlide Content Image '.length):'text-box-'+name.slice('ClassSlide Text Box '.length);});
   expect(actual).toEqual(expected);report.push({slide:i+1,order:expected,pixel:{x:450,y:450,color:cases[i].top},textVisible:cases[i].text});
  }
  fs.mkdirSync('test-output',{recursive:true});fs.writeFileSync('test-output/layer-order.pptx',Buffer.from(bytes));fs.writeFileSync('test-output/layer-order.json',JSON.stringify(report,null,2));
 }finally{(globalThis as any).document=prior;}
});
