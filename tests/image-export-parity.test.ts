import {it,expect} from 'vitest';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import JSZip from 'jszip';
import {createCanvas} from '@napi-rs/canvas';
import {blankSlide,newProject,type Asset,type ImagePlacement,type TemplateSet} from '../src/model';
import {SlideCanvas} from '../src/SlideCanvas';
import {resolveSlide} from '../src/layout';
import {exportDeck} from '../src/exporter';
const palette=['#ff0000','#00ff00','#0000ff','#ffff00','#ff00ff','#00ffff','#ff8000','#8000ff','#0080ff','#80ff00','#ff0080','#00ff80'];
function grid(id:string,width:number,height:number):Asset{const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');palette.forEach((color,i)=>{ctx.fillStyle=color;ctx.fillRect(i%4*width/4,Math.floor(i/4)*height/3,width/4,height/3);});return{id,name:id+'.png',width,height,data:canvas.toDataURL('image/png')};}
const cases:{name:string;asset:string;thumbnail?:boolean;frame:ImagePlacement}[]=[
 {name:'Whole landscape thumbnail',asset:'landscape',thumbnail:true,frame:{x:0,y:0,w:1920,h:1080,fit:'cover'}},
 {name:'Old portrait thumbnail crop restored',asset:'portrait',thumbnail:true,frame:{x:0,y:0,w:1920,h:1080,fit:'cover',crop:{x:.1,y:.42,w:.7,h:.4}}},
 {name:'Landscape fit and resize',asset:'landscape',frame:{x:137.25,y:210.5,w:625.75,h:510.25,fit:'contain'}},
 {name:'Portrait fit with crop',asset:'portrait',frame:{x:1002.5,y:180.25,w:710.5,h:790.75,fit:'contain',crop:{x:.2,y:.1,w:.6,h:.7}}},
 {name:'Wide fill with crop',asset:'portrait',frame:{x:60.25,y:510.5,w:1100.5,h:450.25,fit:'cover',crop:{x:.12,y:.2,w:.82,h:.6}}},
 {name:'Tall fill at slide edge',asset:'landscape',frame:{x:1530,y:340,w:390,h:740,fit:'cover',crop:{x:.1,y:.15,w:.8,h:.65}}}
];
it('matches actual preview DOM position, dimensions and crop in editable PPTX across twelve image cases',async()=>{
 const prior=(globalThis as any).document;(globalThis as any).document={fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>({getContext:()=>null})};
 try{
  const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet,p=newProject();p.theme.mode='custom';p.assets={landscape:grid('landscape',1200,800),portrait:grid('portrait',800,1200)};
  p.slides=(['dark','light'] as const).flatMap(variant=>cases.map(c=>({...blankSlide(),...(c.thumbnail?{kind:'original' as const,templateIndex:1,fixedSlot:'thumbnail' as const}:{}),name:variant+' '+c.name,image:c.asset,imagePlacement:c.frame,theme:{variant,background:variant==='dark'?'#191b1c':'#ffffff'}})));
  const bytes=await(await exportDeck(p,templates,{format:'editable',range:'all',answers:false,notes:false},()=>{})).arrayBuffer(),zip=await JSZip.loadAsync(bytes),report=[];
  for(const [index,slide] of p.slides.entries()){
   const resolved=resolveSlide(p,slide,templates,index),html=new JSDOM(renderToStaticMarkup(React.createElement(SlideCanvas,{slide:resolved}))).window.document,outer=html.querySelector('[data-slide-image]') as HTMLElement,viewport=outer.firstElementChild as HTMLElement,img=viewport.firstElementChild as HTMLImageElement,num=(s:string)=>parseFloat(s);
   const frame={x:num(outer.style.left)+num(viewport.style.left),y:num(outer.style.top)+num(viewport.style.top),w:num(viewport.style.width),h:num(viewport.style.height)},iw=num(img.style.width),ih=num(img.style.height),ix=num(img.style.left),iy=num(img.style.top),crop={l:-ix/iw,r:1-(frame.w-ix)/iw,t:-iy/ih,b:1-(frame.h-iy)/ih};
   const doc=new JSDOM(await zip.file('ppt/slides/slide'+(index+1)+'.xml')!.async('string'),{contentType:'text/xml'}).window.document,pic=[...doc.getElementsByTagNameNS('*','pic')].find(e=>e.getElementsByTagNameNS('*','cNvPr')[0].getAttribute('name')==='ClassSlide Content Image')!,off=pic.getElementsByTagNameNS('*','off')[0],ext=pic.getElementsByTagNameNS('*','ext')[0],src=pic.getElementsByTagNameNS('*','srcRect')[0];
   for(const [attribute,value] of [['x',frame.x],['y',frame.y]] as const)expect(Math.abs(Number(off.getAttribute(attribute))/6350-value)).toBeLessThan(.001);
   for(const [attribute,value] of [['cx',frame.w],['cy',frame.h]] as const)expect(Math.abs(Number(ext.getAttribute(attribute))/6350-value)).toBeLessThan(.001);
   for(const side of ['l','r','t','b'] as const)expect(Math.abs(Number(src.getAttribute(side))/100000-crop[side])).toBeLessThan(.000011);
   if(slide.fixedSlot==='thumbnail')for(const side of ['l','r','t','b'] as const)expect(crop[side]).toBeCloseTo(0,6);
   const samples=[];for(const u of [.07,.23,.41,.61,.89])for(const v of [.09,.27,.47,.71,.91]){const x=Math.floor(frame.x+u*frame.w),y=Math.floor(frame.y+v*frame.h),sx=(x+.5-frame.x-ix)/iw,sy=(y+.5-frame.y-iy)/ih;const cellX=sx*4,cellY=sy*3;if(Math.abs(cellX-Math.round(cellX))<.03||Math.abs(cellY-Math.round(cellY))<.03)continue;samples.push({x,y,color:palette[Math.floor(cellY)*4+Math.floor(cellX)]});}
   report.push({slide:index+1,name:slide.name,frame,crop,samples});
  }
  fs.mkdirSync('test-output',{recursive:true});fs.writeFileSync('test-output/image-parity.pptx',Buffer.from(bytes));fs.writeFileSync('test-output/image-parity.json',JSON.stringify(report,null,2));
 }finally{(globalThis as any).document=prior;}
});
