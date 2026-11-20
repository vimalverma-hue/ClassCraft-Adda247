import {it,expect} from 'vitest';
import fs from 'node:fs';
import JSZip from 'jszip';
import {JSDOM} from 'jsdom';
import {createCanvas} from '@napi-rs/canvas';
import {blankSlide,newProject,type Asset,type TemplateSet} from '../src/model';
import {defaultImage,imageCrop,imageView,moveImageBox} from '../src/slideImages';
import {resolveSlide} from '../src/layout';
import {exportDeck} from '../src/exporter';
import {exportProject,importProject} from '../src/storage';

const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
const canvas=createCanvas(1200,800),context=canvas.getContext('2d');context.fillStyle='#ff0000';context.fillRect(0,0,400,800);context.fillStyle='#00ff00';context.fillRect(400,0,400,800);context.fillStyle='#0000ff';context.fillRect(800,0,400,800);
const asset:Asset={id:'picture',name:'Crop test.png',width:1200,height:800,data:canvas.toDataURL('image/png')};

it('fits complete thumbnail images and adds teaching images without reallocating text space',()=>{
 const p=newProject();p.assets.picture=asset;const s={...blankSlide(),layout:'mcq' as const,text:'Q.1 Capital?\nA) Delhi\nB) Mumbai'},before=resolveSlide(p,s,templates,0);
 const withImage={...s,image:'picture',imagePlacement:defaultImage(s,asset)},after=resolveSlide(p,withImage,templates,0);
 expect(after.elements.filter(e=>e.id!=='content-image')).toEqual(before.elements);expect(withImage.layout).toBe('mcq');expect(withImage.imagePlacement).toMatchObject({x:1200,y:220,w:640});
 const thumbnail={...p.slides[1],image:'picture',imagePlacement:defaultImage(p.slides[1],asset)},r=resolveSlide(p,thumbnail,templates,1),image=r.elements.find(e=>e.id==='content-image')!;
 expect(image).toMatchObject({x:0,y:0,w:1920,h:1080,fit:'contain'});expect(r.elements.some(e=>e.text?.includes('Paste Your Thumbnail'))).toBe(false);
 expect(imageView(thumbnail.imagePlacement,1200,800)).toMatchObject({x:150,y:0,w:1620,h:1080,crop:{x:0,y:0,w:1,h:1}});
});
it('keeps drag and aspect-preserving corner resize within the slide and normalizes bad crop data',()=>{
 const start={x:100,y:200,w:600,h:400};expect(moveImageBox(start,'move',-900,2000)).toEqual({...start,x:0,y:680});
 for(const corner of ['nw','ne','sw','se'] as const)for(const delta of [-3000,100,3000]){const box=moveImageBox(start,corner,delta,delta);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.x+box.w).toBeLessThanOrEqual(1920.001);expect(box.y+box.h).toBeLessThanOrEqual(1080.001);expect(box.w/box.h).toBeCloseTo(1.5);}
 expect(imageCrop({x:2,y:-1,w:0,h:5})).toEqual({x:.98,y:0,w:.02,h:1});
});
it('retains original pixels and crop/placement in project backup',async()=>{
 const p=newProject();p.assets.picture=asset;p.slides=[{...blankSlide(),image:'picture',imagePlacement:{x:100,y:200,w:600,h:400,fit:'contain',crop:{x:.2,y:.1,w:.4,h:.5}}}];
 const file=new File([await(await exportProject(p)).arrayBuffer()],'backup.zip'),restored=await importProject(file);expect(restored.slides).toEqual(p.slides);expect(restored.assets.picture).toEqual(asset);
});
it('exports image coordinates and editable native crops, including uncropped thumbnail fit',async()=>{
 const prior=(globalThis as any).document;(globalThis as any).document={fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>({getContext:()=>null})};
 try{
  const p=newProject();p.theme.mode='custom';p.assets.picture=asset;
  const thumbnail={...p.slides[1],image:'picture',imagePlacement:defaultImage(p.slides[1],asset)};
  const teaching={...blankSlide(),image:'picture',imagePlacement:{x:100,y:200,w:400,h:400,fit:'contain' as const,crop:{x:1/3,y:0,w:1/3,h:1}}};p.slides=[thumbnail,teaching];
  const bytes=await(await exportDeck(p,templates,{format:'editable',range:'all',answers:false,notes:false},()=>{})).arrayBuffer(),zip=await JSZip.loadAsync(bytes);
  for(const [index,expected] of [{x:150,y:0,w:1620,h:1080,l:0,r:0,t:0,b:0},{x:200,y:200,w:200,h:400,l:33333,r:33333,t:0,b:0}].entries()){
   const doc=new JSDOM(await zip.file(`ppt/slides/slide${index+1}.xml`)!.async('string'),{contentType:'text/xml'}).window.document,pic=[...doc.getElementsByTagNameNS('*','pic')].find(p=>p.getElementsByTagNameNS('*','cNvPr')[0].getAttribute('name')==='ClassSlide Content Image')!;
   const off=pic.getElementsByTagNameNS('*','off')[0],ext=pic.getElementsByTagNameNS('*','ext')[0],crop=pic.getElementsByTagNameNS('*','srcRect')[0];expect(Number(off.getAttribute('x'))).toBe(expected.x*6350);expect(Number(off.getAttribute('y'))).toBe(expected.y*6350);expect(Number(ext.getAttribute('cx'))).toBe(expected.w*6350);expect(Number(ext.getAttribute('cy'))).toBe(expected.h*6350);
   for(const side of ['l','r','t','b'] as const)expect(Number(crop.getAttribute(side))).toBe(expected[side]);
  }
  fs.mkdirSync('test-output',{recursive:true});fs.writeFileSync('test-output/image-crop-export.pptx',Buffer.from(bytes));
 }finally{(globalThis as any).document=prior;}
});
