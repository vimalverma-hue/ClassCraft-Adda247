import {it,expect} from 'vitest';
import fs from 'node:fs';
import JSZip from 'jszip';
import {JSDOM} from 'jsdom';
import {createCanvas,GlobalFonts} from '@napi-rs/canvas';
import {blankSlide,newProject,setVariant,type TemplateSet} from '../src/model';
import {ensureClassSlides,fixedSlot} from '../src/classSlides';
import {newTextBox,fitTextBox,addTextBox,changeTextBox,textBoxElement,validateTextBoxes} from '../src/textBoxes';
import {resolveSlide} from '../src/layout';
import {measure} from '../src/parser';
import {exportProject,importProject} from '../src/storage';
import {exportDeck} from '../src/exporter';
const templates=JSON.parse(fs.readFileSync('public/templates/manifest.json','utf8')) as TemplateSet;
it('adds linked boxes without affecting existing teaching layout and preserves unrelated boxes during scoped edits',()=>{
 let p=ensureClassSlides({...newProject(),slides:[{...blankSlide(),layout:'mcq',text:'Q.1 Capital?\nA) Delhi\nB) Mumbai'},{...blankSlide(5),kind:'original',name:'Home Work'}]});
 const selected=p.slides[2].id,first=newTextBox(p,p.slides[2]),second=newTextBox(p,p.slides[2]),before=resolveSlide(p,p.slides[2],templates,2);
 p=addTextBox(p,selected,true,first);p=addTextBox(p,selected,false,second);
 expect(p.slides.filter(s=>fixedSlot(s)).every(s=>!s.textBoxes?.length)).toBe(true);
 expect(resolveSlide(p,p.slides[2],templates,2).elements.filter(e=>!e.textBox)).toEqual(before.elements);
 p=changeTextBox(p,selected,true,first.id,{text:'भारत / India',x:1600,y:1000,size:36});
 expect(p.slides[2].textBoxes![0]).toEqual(p.slides[3].textBoxes![0]);expect(p.slides[2].textBoxes![0].x+p.slides[2].textBoxes![0].w).toBeLessThanOrEqual(1920);expect(p.slides[2].textBoxes![0].y+p.slides[2].textBoxes![0].h).toBeLessThanOrEqual(1080);
 p=changeTextBox(p,selected,false,first.id,{text:'Local edit'});expect(p.slides[3].textBoxes![0].text).toBe('भारत / India');
 p=changeTextBox(p,selected,true,first.id,null);expect(p.slides[2].textBoxes!.map(b=>b.id)).toEqual([second.id]);expect(p.slides[3].textBoxes).toHaveLength(0);
});
it('grows text boxes for multiline text and adapts automatic text colour when the slide theme changes',()=>{
 const p=newProject(),s=blankSlide(),box=fitTextBox({...newTextBox(p,s),text:Array(8).fill('Hindi / English').join('\n'),h:60,y:900});
 expect(box.h).toBeGreaterThan(500);expect(box.y+box.h).toBeLessThanOrEqual(1080);
 expect(textBoxElement(p,s,box).color).toBe('#ffffff');expect(textBoxElement(setVariant(p,'light'),s,box).color).toBe('#000000');
 expect(()=>validateTextBoxes([{...box,w:NaN}])).toThrow();expect(()=>validateTextBoxes([box,box])).toThrow();
});
it('round-trips multiple editable text boxes and shared IDs in a project backup',async()=>{
 let p=ensureClassSlides(newProject());const selected=p.slides[2],box={...newTextBox(p,selected),text:'भारत / India',color:'#00aa99',align:'center' as const};p=addTextBox(p,selected.id,true,box);
 const restored=await importProject(new File([await(await exportProject(p)).arrayBuffer()],'text-boxes.zip'));expect(restored.slides).toEqual(p.slides);
});
it('exports editable Hindi/English boxes with exact position, size, line spacing and formatting',async()=>{
 GlobalFonts.registerFromPath('public/fonts/kokilab.ttf','Kokila');GlobalFonts.registerFromPath('public/fonts/mangalb.ttf','Mangal');
 const prior=(globalThis as any).document;(globalThis as any).document={fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>createCanvas(1,1)};
 try{
  const p=newProject();p.theme.mode='custom';p.slides=[];
  for(const variant of ['dark','light'] as const)for(const font of ['Kokila','Mangal','Noto Sans Devanagari']){
   const s=blankSlide(),box=fitTextBox({...newTextBox(p,s),text:'भारत की राजधानी\nCapital of India',font,size:32,bold:true,x:220,y:240,w:1000,h:240,align:'center',color:''});p.slides.push({...s,theme:{mode:'custom',variant,background:variant==='dark'?'#191b1c':'#ffffff',textColor:variant==='dark'?'#ffffff':'#171925'},textBoxes:[box]});
  }
  const bytes=await(await exportDeck(p,templates,{format:'editable',range:'all',answers:false,notes:false},()=>{})).arrayBuffer(),zip=await JSZip.loadAsync(bytes),report=[];
  for(const [i,s] of p.slides.entries()){
   const e=resolveSlide(p,s,templates,i).elements.find(e=>e.textBox)!,doc=new JSDOM(await zip.file('ppt/slides/slide'+(i+1)+'.xml')!.async('string'),{contentType:'text/xml'}).window.document;
   const shape=[...doc.getElementsByTagNameNS('*','sp')].find(e=>e.getElementsByTagNameNS('*','cNvPr')[0]?.getAttribute('name')?.startsWith('ClassSlide Text Box'))!,off=shape.getElementsByTagNameNS('*','off')[0],ext=shape.getElementsByTagNameNS('*','ext')[0];
   expect(Number(off.getAttribute('x'))/6350).toBeCloseTo(e.x,3);expect(Number(off.getAttribute('y'))/6350).toBeCloseTo(e.y,3);expect(Number(ext.getAttribute('cx'))/6350).toBeCloseTo(e.w,3);expect(Number(ext.getAttribute('cy'))/6350).toBeCloseTo(e.h,3);
   expect(shape.textContent).toContain('भारत की राजधानी');expect(shape.textContent).toContain('Capital of India');expect(shape.getElementsByTagNameNS('*','spcPts')[0].getAttribute('val')).toBe(String(Math.round(32*1.35*100)));
   expect(shape.getElementsByTagNameNS('*','pPr')[0].getAttribute('algn')).toBe('ctr');expect([...shape.getElementsByTagNameNS('*','rPr')].every(e=>e.getAttribute('sz')==='3200'&&e.getAttribute('b')==='1')).toBe(true);
   const colour=s.theme!.variant==='dark'?'ffffff':'000000';expect(e.color).toBe('#'+colour);expect([...shape.getElementsByTagNameNS('*','srgbClr')].every(n=>n.getAttribute('val')?.toLowerCase()===colour)).toBe(true);
   report.push({slide:i+1,font:s.textBoxes![0].font,color:e.color,box:{x:e.x,y:e.y,w:e.w,h:e.h}});
  }
  fs.mkdirSync('test-output',{recursive:true});fs.writeFileSync('test-output/added-text-export.pptx',Buffer.from(bytes));fs.writeFileSync('test-output/added-text-export.json',JSON.stringify(report,null,2));
 }finally{(globalThis as any).document=prior;}
});

it('exports an unwritten text box without instructional placeholder text',async()=>{
 const prior=(globalThis as any).document;(globalThis as any).document={fonts:{load:async()=>[],ready:Promise.resolve()},getElementById:()=>null,createElement:()=>createCanvas(1,1)};
 try{const p=newProject();p.theme.mode='custom';const s=blankSlide();p.slides=[{...s,textBoxes:[newTextBox(p,s)]}];const bytes=await(await exportDeck(p,templates,{format:'editable',range:'all',answers:false,notes:false},()=>{})).arrayBuffer(),zip=await JSZip.loadAsync(bytes);expect(await zip.file('ppt/slides/slide1.xml')!.async('string')).not.toContain('Type here');}finally{(globalThis as any).document=prior;}
});

it('fits text height both ways, preserves padding and refits older oversized boxes without shifting their top',()=>{
 const p=newProject(),s=blankSlide(),one=fitTextBox({...newTextBox(p,s),text:'भारत / India',h:900,y:300});
 expect(one.h).toBe(Math.ceil(one.size*2*one.lineHeight+16));expect(one.h).toBeLessThan(100);expect(one.y).toBe(300);
 const three=fitTextBox({...one,text:'भारत / India\nSecond line\nThird line'});expect(three.h).toBe(Math.ceil(3*one.size*2*one.lineHeight+16));expect(three.y).toBe(one.y);
 const shortened=fitTextBox({...three,text:'Short'});expect(shortened.h).toBe(one.h);expect(shortened.w).toBeLessThan(one.w);expect(shortened.size).toBe(one.size);
 const empty=fitTextBox({...three,text:''});expect(empty.h).toBe(one.h);
 const wrapped=fitTextBox({...one,x:1760,text:'A longer phrase that wraps onto several lines'});expect(wrapped.h).toBeGreaterThan(one.h);expect(fitTextBox({...wrapped,w:800,text:'Short'}).h).toBe(one.h);
 const small=fitTextBox({...one,size:8,y:1040});expect(small.h).toBeLessThan(60);expect(small.y).toBe(1040);expect(small.y+small.h).toBeLessThanOrEqual(1080);
});

it('fits width to the longest line, grows and shrinks at the same anchor and wraps at the slide edge',()=>{
 const p=newProject(),s=blankSlide(),short=fitTextBox({...newTextBox(p,s),text:'Hi',x:1000,w:1800});
 expect(short.x).toBe(1000);expect(short.w).toBe(Math.max(32,Math.ceil(measure('Hi',short.size,short.font,short.bold))+18));expect(short.w).toBeLessThan(120);
 const long=fitTextBox({...short,text:'भारत / India\nLonger class title'});
 expect(long.w).toBeGreaterThan(short.w);expect(long.x).toBe(short.x);expect(fitTextBox({...long,text:'Hi'})).toEqual(short);
 const edge=fitTextBox({...short,x:1760,text:'This sentence continues beyond the available slide width and must wrap.'});
 expect(edge.x).toBe(1760);expect(edge.w).toBe(160);expect(edge.h).toBeGreaterThan(short.h);
 const e=textBoxElement(p,s,edge);expect(e.lines!.length).toBeGreaterThan(1);expect(e.lines!.every(line=>measure(line,edge.size,edge.font,edge.bold)<=e.w)).toBe(true);
 expect(fitTextBox(edge)).toEqual(edge);
});
