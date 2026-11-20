import {it,expect} from 'vitest';
import fs from 'node:fs';
import JSZip from 'jszip';
import {JSDOM} from 'jsdom';
import {answerOverlay,answerColour} from '../src/answers';
import {answerInkBounds} from '../src/answerGeometry';
import {blankSlide,newProject,type ResolvedSlide,type TemplateSet} from '../src/model';
import {resolveSlide} from '../src/layout';
import {measure} from '../src/parser';
import {exportDeck} from '../src/exporter';

it('pads the option label and centres the box around its own lines instead of the taller column cell',()=>{
 const s={...blankSlide(),layout:'mcq' as const,text:'Q.1 Tribe?\nA) Sentinelese\nB) Gond',correctOption:0,answerReveal:true};
 const target={id:'option-0',kind:'text' as const,x:80,y:300,w:750,h:180,size:24,lineHeight:1.35,text:'A) Sentinelese',lines:['A) Sentinelese']};
 const r:ResolvedSlide={id:s.id,name:'Test',background:'#191b1c',notes:'',warnings:[],elements:[target]};
 const e=answerOverlay(s,r)!;
 expect(e.x).toBeLessThan(target.x);expect(e.padding).toEqual([8,18,8,18]);
 expect(e.x+e.padding![3]).toBe(target.x);expect(e.y+e.padding![0]).toBe(target.y);
 expect(e.w).toBeLessThan(target.w*.65);expect(e.w-36).toBeGreaterThanOrEqual(measure(target.text,24,'Noto Sans Devanagari'));
 expect(e.h).toBeCloseTo(24*2*1.35+16);expect(e.h).toBeLessThan(target.h);
 const ink=answerInkBounds(target);expect(e.answerBox!.h).toBeLessThan(e.h);expect(ink.top-e.answerBox!.y).toBeCloseTo(3);expect(e.answerBox!.y+e.answerBox!.h-ink.bottom).toBeCloseTo(5);
 expect(e.fill).toBe('#86efac');expect(e.valign).toBe('middle');
});

it('refreshes the legacy default green while preserving custom highlight colours',()=>{
 expect(answerColour('#bbf7d0')).toBe('#86efac');expect(answerColour('#BBF7D0')).toBe('#86efac');
 expect(answerColour('#ffff00')).toBe('#ffff00');
});

it('retains exact custom answer fills and independent answer targets in PPT export for both themes and partial ranges',async()=>{
 const prior=(globalThis as any).document;
 (globalThis as any).document={fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>({getContext:()=>null})};
 try{
  const p=newProject();p.theme.mode='custom';p.slides=[];
  for(const variant of ['dark','light'] as const)for(const [index,colour] of ['#00cfee','#174d36'].entries())p.slides.push({...blankSlide(),layout:'mcq',text:'Q.1 Capital?\nA) Delhi\nB) Mumbai',correctOption:index,answerReveal:true,answerColor:colour,theme:{variant}});
  const t=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
  for(const range of ['all','2-3']){
   const indexes=range==='all'?[0,1,2,3]:[1,2],zip=await JSZip.loadAsync(await(await exportDeck(p,t,{format:'editable',range,answers:false,notes:false,clickAnswers:true},()=>{})).arrayBuffer());
   for(const [out,index] of indexes.entries()){
    const s=p.slides[index],expected=answerOverlay(s,resolveSlide(p,s,t,index))!;
    const doc=new JSDOM(await zip.file(`ppt/slides/slide${out+1}.xml`)!.async('string'),{contentType:'text/xml'}).window.document;
    const shape=[...doc.getElementsByTagNameNS('*','cNvPr')].find(n=>n.getAttribute('name')==='ClassSlide Answer Reveal')!.parentElement!.parentElement!;
    const background=[...doc.getElementsByTagNameNS('*','cNvPr')].find(n=>n.getAttribute('name')==='ClassSlide Answer Background')!.parentElement!.parentElement!;
    const fill=background.getElementsByTagNameNS('*','spPr')[0].getElementsByTagNameNS('*','solidFill')[0].getElementsByTagNameNS('*','srgbClr')[0].getAttribute('val');
    expect(fill?.toLowerCase()).toBe(s.answerColor!.slice(1));expect('#'+fill?.toLowerCase()).toBe(expected.fill);
    expect(shape.textContent).toContain(s.correctOption===0?'Delhi':'Mumbai');
    if(s.answerColor==='#174d36'){
     expect(expected.color).toBe('#ffffff');expect(expected.runs!.every(run=>run.color==='#ffffff')).toBe(true);
     const colours=[...shape.getElementsByTagNameNS('*','srgbClr')].map(n=>n.getAttribute('val')!.toLowerCase());expect(colours.length).toBeGreaterThan(0);expect(colours.every(colour=>colour==='ffffff')).toBe(true);
    }else expect(expected.color).not.toBe('#ffffff');
   }
  }
 }finally{(globalThis as any).document=prior;}
});

it('adapts width to short, longer and wrapped answers while preserving their text alignment',()=>{
 const s={...blankSlide(),layout:'mcq' as const,text:'Q.1 Tribe?\nA) Haida\nB) Gond',correctOption:0,answerReveal:true};
 for(const align of ['left','center','right'] as const){
  const target={id:'option-0',kind:'text' as const,x:80,y:300,w:1100,h:150,size:24,lineHeight:1.35,font:'Kokila',bold:true,align,text:'A) Haida',lines:['A) Haida']};
  const r:ResolvedSlide={id:s.id,name:'Test',background:'#191b1c',notes:'',warnings:[],elements:[target]};
  const short=answerOverlay(s,r)!;expect(short.w).toBeLessThan(350);
  const inset=short.padding!,textX=short.x+inset[3],width=short.w-inset[3]-inset[1];
  if(align==='left')expect(textX).toBe(target.x);
  if(align==='right')expect(textX+width).toBe(target.x+target.w);
  if(align==='center')expect(textX+width/2).toBe(target.x+target.w/2);
  target.lines=['A) A much longer answer','Second line'];
  const long=answerOverlay(s,r)!;expect(long.w).toBeGreaterThan(short.w);expect(long.lines).toEqual(target.lines);
  target.lines=['A) '+('long content '.repeat(30))];
  expect(answerOverlay(s,r)!.w).toBeLessThanOrEqual(target.w+36);
 }
});

it('exports padded, vertically centred multi-line Hindi/English answers without losing wrapping',async()=>{
 const prior=(globalThis as any).document;
 (globalThis as any).document={fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>({getContext:()=>null})};
 try{
  const p=newProject();p.theme.mode='custom';p.theme.variant='light';p.theme.background='#ffffff';p.theme.textColor='#171925';p.style.bold=true;
  p.slides=[{...blankSlide(),layout:'mcq',optionsMode:'vertical',text:'Q.1 सही कथन चुनें / Choose the correct statement.\nA) तरल पदार्थ का द्रव्यमान और उसका आयतन दोनों मापे जाते हैं / Both the mass and the volume of a liquid are measured.\nB) केवल आयतन / Volume only\nC) केवल द्रव्यमान / Mass only\nD) इनमें से कोई नहीं / None of these',correctOption:0,answerReveal:true}];
  const t=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
  const resolved=resolveSlide(p,p.slides[0],t,0),e=answerOverlay(p.slides[0],resolved)!;
  expect(e.lines!.length).toBeGreaterThan(1);expect(resolved.warnings).toEqual([]);
  const blob=await exportDeck(p,t,{format:'editable',range:'all',answers:false,notes:false,clickAnswers:true},()=>{});
  const zip=await JSZip.loadAsync(await blob.arrayBuffer()),xml=await zip.file('ppt/slides/slide1.xml')!.async('string');
  const doc=new JSDOM(xml,{contentType:'text/xml'}).window.document;
  const shape=[...doc.getElementsByTagNameNS('*','cNvPr')].find(n=>n.getAttribute('name')==='ClassSlide Answer Reveal')!.parentElement!.parentElement!;
  const body=shape.getElementsByTagNameNS('*','bodyPr')[0];
  expect(shape.getElementsByTagNameNS('*','prstGeom')[0].getAttribute('prst')).toBe('roundRect');
  expect(shape.getElementsByTagNameNS('*','ln')[0].getElementsByTagNameNS('*','solidFill')).toHaveLength(0);
  expect(body.getAttribute('anchor')).toBe('ctr');expect(body.getAttribute('wrap')).toBe('none');expect(Number(body.getAttribute('lIns'))).toBe(9*12700);expect(Number(body.getAttribute('rIns'))).toBe(9*12700);
  expect(Number(body.getAttribute('tIns'))).toBe(4*12700);expect(Number(body.getAttribute('bIns'))).toBe(4*12700);
  const background=[...doc.getElementsByTagNameNS('*','cNvPr')].find(n=>n.getAttribute('name')==='ClassSlide Answer Background')!.parentElement!.parentElement!;
  const off=background.getElementsByTagNameNS('*','off')[0],ext=background.getElementsByTagNameNS('*','ext')[0];
  expect(Number(off.getAttribute('y'))/6350).toBeCloseTo(e.answerBox!.y,3);expect(Number(ext.getAttribute('cy'))/6350).toBeCloseTo(e.answerBox!.h,3);
  const click=[...doc.getElementsByTagNameNS('*','cTn')].filter(n=>n.getAttribute('nodeType')==='clickEffect');expect(click).toHaveLength(1);
  const targets=[...click[0].getElementsByTagNameNS('*','spTgt')].map(n=>n.getAttribute('spid'));expect(targets).toEqual([shape,background].map(s=>s.getElementsByTagNameNS('*','cNvPr')[0].getAttribute('id')));
  expect(shape.textContent!.replace(/\s/g,'')).toContain('Boththemassandthevolumeofaliquidaremeasured.');
  fs.mkdirSync('test-output',{recursive:true});fs.writeFileSync('test-output/answer-alignment-light.pptx',Buffer.from(await blob.arrayBuffer()));
 }finally{(globalThis as any).document=prior;}
});
it('keeps glyph-fitting backgrounds between neighbouring options and follows multiline edits',()=>{
 const s={...blankSlide(),layout:'mcq' as const,text:'Q.1 Choose\nA) First\nB) Second\nC) Third',correctOption:1,answerReveal:true};
 for(const font of ['Kokila','Mangal','Aptos']){
  const elements=[0,1,2].map(i=>({id:'option-'+i,kind:'text' as const,text:['A) पहला / First','B) हरियाणा / Haryana','C) तीसरा / Third'][i],x:80,y:300+i*60,w:900,h:60,size:24,lineHeight:1.2,font,bold:true}));
  const r:ResolvedSlide={id:s.id,name:'Test',background:'#191b1c',notes:'',warnings:[],elements};const overlay=answerOverlay(s,r)!,box=overlay.answerBox!;
  expect(box.y).toBeGreaterThan(answerInkBounds(elements[0]).bottom);expect(box.y+box.h).toBeLessThan(answerInkBounds(elements[2]).top);
  expect(overlay.y+overlay.padding![0]).toBe(elements[1].y);
  elements[1].text+='\nLonger second line';elements[2].y+=60;const multiline=answerOverlay(s,r)!;expect(multiline.answerBox!.h).toBeGreaterThan(box.h);expect(multiline.answerBox!.y+multiline.answerBox!.h).toBeLessThan(answerInkBounds(elements[2]).top);
 }
});
