import {it,expect} from 'vitest';
import fs from 'node:fs';
import JSZip from 'jszip';
import {JSDOM} from 'jsdom';
import {createCanvas} from '@napi-rs/canvas';
import {blankSlide,newProject,type Asset,type TemplateSet} from '../src/model';
import {ensureClassSlides,fixedSlot} from '../src/classSlides';
import {addSlideImage,changeSlideImage,slideImages,validateSlideImages} from '../src/imageLayers';
import {imageView} from '../src/slideImages';
import {newTextBox} from '../src/textBoxes';
import {resolveSlide} from '../src/layout';
import {exportDeck} from '../src/exporter';
import {exportProject,importProject} from '../src/storage';
const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
function picture(id:string,color:string):Asset{const canvas=createCanvas(1200,800),ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,1200,800);return{id,name:id+'.png',data:canvas.toDataURL('image/png'),width:1200,height:800};}
const a=picture('first','#ff0000'),b=picture('second','#0000ff');
it('appends independent and linked image layers, scopes edits/deletion by ID and retains them in backups',async()=>{
 let p=ensureClassSlides({...newProject(),slides:[blankSlide(),blankSlide(5)]});const id=p.slides[2].id,fixed=p.slides.filter(s=>fixedSlot(s));
 p=addSlideImage(p,id,false,a).project;const added=addSlideImage(p,id,true,b);p=added.project;
 expect(p.slides[2].image).toBe(a.id);expect(p.slides[2].images).toEqual(p.slides[3].images);expect(p.slides.filter(s=>fixedSlot(s))).toEqual(fixed);
 const frame={x:300,y:200,w:480,h:300,fit:'contain' as const,crop:{x:.2,y:.1,w:.7,h:.8}};
 p=changeSlideImage(p,id,true,added.elementId,frame);expect(p.slides[2].images![0].placement).toEqual(frame);expect(p.slides[3].images).toEqual(p.slides[2].images);expect(p.slides[2].image).toBe(a.id);
 const backup=await importProject(new File([await(await exportProject(p)).arrayBuffer()],'multi.zip'));expect(backup.slides).toEqual(p.slides);expect(backup.assets).toEqual(p.assets);
 p=changeSlideImage(p,id,false,added.elementId,{...frame,x:400});expect(p.slides[3].images![0].placement.x).toBe(300);
 p=changeSlideImage(p,id,true,added.elementId);expect(p.slides[2].images).toEqual([]);expect(p.slides[3].images).toEqual([]);expect(slideImages(p.slides[2])).toHaveLength(1);
 expect(()=>validateSlideImages([{id:'image-x',assetId:a.id,placement:{...frame,w:NaN}}])).toThrow();
});
it('repairs old thumbnail crop/fill in preview and keeps all source pixels with either aspect ratio',()=>{
 for(const [width,height] of [[1200,800],[800,1200],[1600,900]]){
  const p=newProject(),s={...p.slides[1],image:a.id,imagePlacement:{x:80,y:100,w:500,h:300,fit:'cover' as const,crop:{x:.2,y:.1,w:.4,h:.5}}};p.assets[a.id]={...a,width,height};
  const e=resolveSlide(p,s,templates,1).elements.find(e=>e.id==='content-image')!,v=imageView({...e,fit:'contain',crop:e.imageCrop},width,height);
  expect(e.imageFixed).toBe(true);expect(e).toMatchObject({x:0,y:0,w:1920,h:1080,fit:'contain'});expect(v.crop).toEqual({x:0,y:0,w:1,h:1});expect(v.w/v.h).toBeCloseTo(width/height);expect(v.x+v.w/2).toBe(960);expect(v.y+v.h/2).toBe(540);
 }
});
it('exports multiple pictures and Hindi/English questions, options, headers and added text as editable native objects',async()=>{
 const prior=(globalThis as any).document;(globalThis as any).document={fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>({getContext:()=>null})};
 try{
  let p=newProject();p.theme.mode='custom';p.theme.headerText='मेरी कक्षा / My class';const s={...blankSlide(),layout:'mcq' as const,text:'Q.1 Capital?\nA) Delhi\nB) Mumbai',edits:{question:'Q.1 भारत की राजधानी? / Capital of India?','option-0':'A) नई दिल्ली / New Delhi'}};
  p.slides=[s];p=addSlideImage(p,s.id,false,a).project;const extra=addSlideImage(p,s.id,false,b);p=extra.project;
  p=changeSlideImage(p,s.id,false,'content-image',{x:100,y:600,w:300,h:200,fit:'contain',crop:{x:0,y:0,w:1,h:1}});
  p=changeSlideImage(p,s.id,false,extra.elementId,{x:800,y:600,w:400,h:240,fit:'contain',crop:{x:.2,y:.1,w:.7,h:.8}});
  p.slides[0].textBoxes=[{...newTextBox(p,s),text:'पहला नोट / First note',x:120,y:850},{...newTextBox(p,s),text:'दूसरा नोट / Second note',x:1000,y:850}];
  const bytes=await(await exportDeck(p,templates,{format:'editable',range:'all',answers:false,notes:false},()=>{})).arrayBuffer(),zip=await JSZip.loadAsync(bytes),doc=new JSDOM(await zip.file('ppt/slides/slide1.xml')!.async('string'),{contentType:'text/xml'}).window.document;
  const shapes=[...doc.getElementsByTagNameNS('*','sp')];for(const text of ['मेरी कक्षा / My class',s.edits.question,s.edits['option-0'],'पहला नोट / First note','दूसरा नोट / Second note'])expect(shapes.some(shape=>[...shape.getElementsByTagNameNS('*','t')].map(n=>n.textContent).join('').includes(text))).toBe(true);
  const pics=[...doc.getElementsByTagNameNS('*','pic')];expect(pics).toHaveLength(2);const resolved=resolveSlide(p,p.slides[0],templates,0),report=[];
  for(const e of resolved.elements.filter(e=>e.kind==='image')){
   const name='ClassSlide Content Image'+(e.id==='content-image'?'':' '+e.id),pic=pics.find(n=>n.getElementsByTagNameNS('*','cNvPr')[0].getAttribute('name')===name)!,view=imageView({...e,fit:e.fit==='cover'?'cover':'contain',crop:e.imageCrop},...e.imageSize!),off=pic.getElementsByTagNameNS('*','off')[0],ext=pic.getElementsByTagNameNS('*','ext')[0],crop=pic.getElementsByTagNameNS('*','srcRect')[0];
   expect(Number(off.getAttribute('x'))/6350).toBeCloseTo(view.x,3);expect(Number(off.getAttribute('y'))/6350).toBeCloseTo(view.y,3);expect(Number(ext.getAttribute('cx'))/6350).toBeCloseTo(view.w,3);expect(Number(ext.getAttribute('cy'))/6350).toBeCloseTo(view.h,3);expect(Number(crop.getAttribute('l'))/100000).toBeCloseTo(view.crop.x,4);
   report.push({name,view});
  }
  fs.mkdirSync('test-output',{recursive:true});fs.writeFileSync('test-output/multiple-editable.pptx',Buffer.from(bytes));fs.writeFileSync('test-output/multiple-editable.json',JSON.stringify(report,null,2));
 }finally{(globalThis as any).document=prior;}
});
